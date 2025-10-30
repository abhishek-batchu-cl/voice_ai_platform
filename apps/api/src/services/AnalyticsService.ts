import { Database } from '../db/database';

export interface AnalyticsMetrics {
  overview: {
    totalCalls: number;
    totalDuration: number;
    averageDuration: number;
    successRate: number;
    totalCost: number;
  };
  callVolume: Array<{
    date: string;
    count: number;
    duration: number;
  }>;
  callsByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  callsByAssistant: Array<{
    assistantId: string;
    assistantName: string;
    count: number;
    averageDuration: number;
  }>;
  peakHours: Array<{
    hour: number;
    count: number;
  }>;
  callsByDirection: {
    inbound: number;
    outbound: number;
  };
}

export class AnalyticsService {
  /**
   * Get comprehensive analytics for an organization
   */
  static async getAnalytics(
    orgId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AnalyticsMetrics> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const end = endDate || new Date();

    const [overview, callVolume, callsByStatus, callsByAssistant, peakHours, callsByDirection] =
      await Promise.all([
        this.getOverview(orgId, start, end),
        this.getCallVolume(orgId, start, end),
        this.getCallsByStatus(orgId, start, end),
        this.getCallsByAssistant(orgId, start, end),
        this.getPeakHours(orgId, start, end),
        this.getCallsByDirection(orgId, start, end),
      ]);

    return {
      overview,
      callVolume,
      callsByStatus,
      callsByAssistant,
      peakHours,
      callsByDirection,
    };
  }

  /**
   * Get overview metrics
   */
  private static async getOverview(orgId: string, startDate: Date, endDate: Date) {
    const result = await Database.query(
      `SELECT
        COUNT(*) as total_calls,
        COALESCE(SUM(duration_seconds), 0) as total_duration,
        COALESCE(AVG(duration_seconds), 0) as average_duration,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100, 0) as success_rate,
        COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as total_cost
       FROM calls c
       JOIN assistants a ON c.assistant_id = a.id
       WHERE a.org_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3`,
      [orgId, startDate, endDate]
    );

    const row = result.rows[0];

    return {
      totalCalls: parseInt(row.total_calls),
      totalDuration: parseFloat(row.total_duration),
      averageDuration: parseFloat(row.average_duration),
      successRate: parseFloat(row.success_rate),
      totalCost: parseFloat(row.total_cost),
    };
  }

  /**
   * Get call volume by date
   */
  private static async getCallVolume(orgId: string, startDate: Date, endDate: Date) {
    const result = await Database.query(
      `SELECT
        DATE(c.created_at) as date,
        COUNT(*) as count,
        COALESCE(SUM(c.duration_seconds), 0) as duration
       FROM calls c
       JOIN assistants a ON c.assistant_id = a.id
       WHERE a.org_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY DATE(c.created_at)
       ORDER BY date ASC`,
      [orgId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      date: row.date,
      count: parseInt(row.count),
      duration: parseFloat(row.duration),
    }));
  }

  /**
   * Get calls grouped by status
   */
  private static async getCallsByStatus(orgId: string, startDate: Date, endDate: Date) {
    const result = await Database.query(
      `SELECT
        c.status,
        COUNT(*) as count,
        ROUND(COUNT(*)::numeric / (
          SELECT COUNT(*) FROM calls c2
          JOIN assistants a2 ON c2.assistant_id = a2.id
          WHERE a2.org_id = $1
            AND c2.created_at >= $2
            AND c2.created_at <= $3
        ) * 100, 2) as percentage
       FROM calls c
       JOIN assistants a ON c.assistant_id = a.id
       WHERE a.org_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY c.status
       ORDER BY count DESC`,
      [orgId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      status: row.status,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage),
    }));
  }

  /**
   * Get calls by assistant
   */
  private static async getCallsByAssistant(orgId: string, startDate: Date, endDate: Date) {
    const result = await Database.query(
      `SELECT
        a.id as assistant_id,
        a.name as assistant_name,
        COUNT(*) as count,
        COALESCE(AVG(c.duration_seconds), 0) as average_duration
       FROM calls c
       JOIN assistants a ON c.assistant_id = a.id
       WHERE a.org_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY a.id, a.name
       ORDER BY count DESC`,
      [orgId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      assistantId: row.assistant_id,
      assistantName: row.assistant_name,
      count: parseInt(row.count),
      averageDuration: parseFloat(row.average_duration),
    }));
  }

  /**
   * Get peak hours (calls by hour of day)
   */
  private static async getPeakHours(orgId: string, startDate: Date, endDate: Date) {
    const result = await Database.query(
      `SELECT
        EXTRACT(HOUR FROM c.created_at) as hour,
        COUNT(*) as count
       FROM calls c
       JOIN assistants a ON c.assistant_id = a.id
       WHERE a.org_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY EXTRACT(HOUR FROM c.created_at)
       ORDER BY hour ASC`,
      [orgId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      hour: parseInt(row.hour),
      count: parseInt(row.count),
    }));
  }

  /**
   * Get calls by direction
   */
  private static async getCallsByDirection(
    orgId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ inbound: number; outbound: number }> {
    const result = await Database.query(
      `SELECT
        c.direction,
        COUNT(*) as count
       FROM calls c
       JOIN assistants a ON c.assistant_id = a.id
       WHERE a.org_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY c.direction`,
      [orgId, startDate, endDate]
    );

    const directionMap = {
      inbound: 0,
      outbound: 0,
    };

    result.rows.forEach((row) => {
      const direction = row.direction as 'inbound' | 'outbound';
      if (direction === 'inbound' || direction === 'outbound') {
        directionMap[direction] = parseInt(row.count);
      }
    });

    return directionMap;
  }

  /**
   * Get session analytics
   */
  static async getSessionAnalytics(orgId: string, startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const result = await Database.query(
      `SELECT
        COUNT(*) as total_sessions,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as average_duration,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'ended' THEN 1 END) as completed_sessions,
        session_type,
        COUNT(*) as count_by_type
       FROM sessions
       WHERE org_id = $1
         AND started_at >= $2
         AND started_at <= $3
       GROUP BY session_type`,
      [orgId, start, end]
    );

    return {
      totalSessions: result.rows.reduce((sum, row) => sum + parseInt(row.count_by_type), 0),
      averageDuration: result.rows[0]?.average_duration || 0,
      activeSessions: parseInt(result.rows[0]?.active_sessions || '0'),
      completedSessions: parseInt(result.rows[0]?.completed_sessions || '0'),
      sessionsByType: result.rows.map((row) => ({
        type: row.session_type,
        count: parseInt(row.count_by_type),
      })),
    };
  }

  /**
   * Get message analytics
   */
  static async getMessageAnalytics(orgId: string, startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const result = await Database.query(
      `SELECT
        COUNT(*) as total_messages,
        COUNT(CASE WHEN m.role = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN m.role = 'assistant' THEN 1 END) as assistant_messages,
        AVG(LENGTH(m.content)) as average_length
       FROM messages m
       JOIN sessions s ON m.session_id = s.id
       WHERE s.org_id = $1
         AND m.created_at >= $2
         AND m.created_at <= $3`,
      [orgId, start, end]
    );

    const row = result.rows[0];

    return {
      totalMessages: parseInt(row.total_messages),
      userMessages: parseInt(row.user_messages),
      assistantMessages: parseInt(row.assistant_messages),
      averageLength: parseFloat(row.average_length),
    };
  }

  /**
   * Get voicemail analytics
   */
  static async getVoicemailAnalytics(orgId: string, startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const result = await Database.query(
      `SELECT
        COUNT(*) as total_voicemails,
        COUNT(CASE WHEN is_read = true THEN 1 END) as read_voicemails,
        COUNT(CASE WHEN is_read = false THEN 1 END) as unread_voicemails,
        AVG(duration_seconds) as average_duration
       FROM voicemails
       WHERE org_id = $1
         AND created_at >= $2
         AND created_at <= $3`,
      [orgId, start, end]
    );

    const row = result.rows[0];

    return {
      totalVoicemails: parseInt(row.total_voicemails || '0'),
      readVoicemails: parseInt(row.read_voicemails || '0'),
      unreadVoicemails: parseInt(row.unread_voicemails || '0'),
      averageDuration: parseFloat(row.average_duration || '0'),
    };
  }

  /**
   * Export analytics to CSV format
   */
  static async exportToCSV(orgId: string, startDate?: Date, endDate?: Date): Promise<string> {
    const metrics = await this.getAnalytics(orgId, startDate, endDate);

    const rows: string[] = [];

    // Header
    rows.push('Metric,Value');

    // Overview
    rows.push(`Total Calls,${metrics.overview.totalCalls}`);
    rows.push(`Total Duration (seconds),${metrics.overview.totalDuration}`);
    rows.push(`Average Duration (seconds),${metrics.overview.averageDuration.toFixed(2)}`);
    rows.push(`Success Rate (%),${metrics.overview.successRate.toFixed(2)}`);
    rows.push(`Total Cost ($),${metrics.overview.totalCost.toFixed(2)}`);
    rows.push('');

    // Call volume by date
    rows.push('Date,Calls,Duration');
    metrics.callVolume.forEach((item) => {
      rows.push(`${item.date},${item.count},${item.duration}`);
    });
    rows.push('');

    // Calls by status
    rows.push('Status,Count,Percentage');
    metrics.callsByStatus.forEach((item) => {
      rows.push(`${item.status},${item.count},${item.percentage}%`);
    });
    rows.push('');

    // Calls by assistant
    rows.push('Assistant,Calls,Average Duration');
    metrics.callsByAssistant.forEach((item) => {
      rows.push(`${item.assistantName},${item.count},${item.averageDuration.toFixed(2)}`);
    });

    return rows.join('\n');
  }
}
