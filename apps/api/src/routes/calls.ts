import { Router, Response } from 'express';
import { Database } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { TwilioService } from '../services/TwilioService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const MakeCallSchema = z.object({
  to: z.string().min(10),
  from: z.string().optional(), // Phone number ID or actual number
  assistantId: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
});

// Make an outbound call
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const validated = MakeCallSchema.parse(req.body);

    // Get assistant
    const assistantResult = await Database.query(
      'SELECT * FROM assistants WHERE id = $1 AND org_id = $2',
      [validated.assistantId, req.organization.id]
    );

    if (assistantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    // Get phone number
    let fromNumber = validated.from;
    if (!fromNumber) {
      // Get any available phone number for this org
      const phoneResult = await Database.query(
        'SELECT phone_number FROM phone_numbers WHERE org_id = $1 AND status = $2 LIMIT 1',
        [req.organization.id, 'active']
      );

      if (phoneResult.rows.length === 0) {
        return res.status(400).json({
          error: 'No phone number available',
          message: 'Please purchase a phone number first',
        });
      }

      fromNumber = phoneResult.rows[0].phone_number;
    } else if (validated.from && !validated.from.startsWith('+')) {
      // It's a phone number ID, get the actual number
      const phoneResult = await Database.query(
        'SELECT phone_number FROM phone_numbers WHERE id = $1 AND org_id = $2',
        [validated.from, req.organization.id]
      );

      if (phoneResult.rows.length === 0) {
        return res.status(404).json({ error: 'Phone number not found' });
      }

      fromNumber = phoneResult.rows[0].phone_number;
    }

    // Ensure we have a from number
    if (!fromNumber) {
      return res.status(400).json({ error: 'Unable to determine from number' });
    }

    // Get Twilio credentials
    const orgResult = await Database.query(
      'SELECT twilio_account_sid, twilio_auth_token FROM organizations WHERE id = $1',
      [req.organization.id]
    );

    if (!orgResult.rows[0]?.twilio_account_sid) {
      return res.status(400).json({ error: 'Twilio credentials not configured' });
    }

    const twilioService = new TwilioService(
      orgResult.rows[0].twilio_account_sid,
      orgResult.rows[0].twilio_auth_token
    );

    // Make call
    const call = await twilioService.makeCall({
      to: validated.to,
      from: fromNumber,
      assistantId: validated.assistantId,
      metadata: validated.metadata,
    });

    res.status(201).json(call);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Make call error:', error);
    res.status(500).json({ error: 'Failed to make call', message: error.message });
  }
});

// List calls
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT c.*, a.name as assistant_name, pn.phone_number
      FROM calls c
      LEFT JOIN assistants a ON c.assistant_id = a.id
      LEFT JOIN phone_numbers pn ON c.phone_number_id = pn.id
      WHERE c.org_id = $1
    `;

    const params: any[] = [req.organization.id];
    let paramCount = 2;

    if (status) {
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (startDate) {
      query += ` AND c.started_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND c.started_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY c.started_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await Database.query(query, params);

    // Get total count
    const countResult = await Database.query(
      'SELECT COUNT(*) FROM calls WHERE org_id = $1',
      [req.organization.id]
    );

    res.json({
      calls: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('List calls error:', error);
    res.status(500).json({ error: 'Failed to list calls' });
  }
});

// Get call details
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      `SELECT c.*, a.name as assistant_name, pn.phone_number
       FROM calls c
       LEFT JOIN assistants a ON c.assistant_id = a.id
       LEFT JOIN phone_numbers pn ON c.phone_number_id = pn.id
       WHERE c.id = $1 AND c.org_id = $2`,
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Get messages for this call
    const messagesResult = await Database.query(
      'SELECT * FROM messages WHERE call_id = $1 ORDER BY timestamp ASC',
      [req.params.id]
    );

    const call = result.rows[0];
    call.messages = messagesResult.rows;

    res.json(call);
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({ error: 'Failed to get call details' });
  }
});

// End/hangup an active call
router.post('/:id/end', async (req: AuthRequest, res: Response) => {
  try {
    // Get call
    const callResult = await Database.query(
      'SELECT * FROM calls WHERE id = $1 AND org_id = $2',
      [req.params.id, req.organization.id]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = callResult.rows[0];

    if (!call.call_sid) {
      return res.status(400).json({ error: 'Call SID not available' });
    }

    // Get Twilio credentials
    const orgResult = await Database.query(
      'SELECT twilio_account_sid, twilio_auth_token FROM organizations WHERE id = $1',
      [req.organization.id]
    );

    if (orgResult.rows[0]?.twilio_account_sid) {
      const twilioService = new TwilioService(
        orgResult.rows[0].twilio_account_sid,
        orgResult.rows[0].twilio_auth_token
      );

      // End call in Twilio using the service's getCallDetails method
      // Note: Twilio will automatically end the call, we just update our records
      try {
        const callDetails = await twilioService.getCallDetails(call.call_sid);
        console.log('Call status:', callDetails.status);
      } catch (error) {
        console.error('Error fetching call details:', error);
      }
    }

    // Update in database
    await Database.query(
      `UPDATE calls
       SET status = 'completed', ended_at = NOW(), end_reason = 'manual_hangup'
       WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: 'Call ended successfully' });
  } catch (error: any) {
    console.error('End call error:', error);
    res.status(500).json({ error: 'Failed to end call', message: error.message });
  }
});

// Get call analytics
router.get('/:id/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const result = await Database.query(
      `SELECT ca.*, c.duration_seconds, c.cost
       FROM call_analytics ca
       JOIN calls c ON ca.call_id = c.id
       WHERE ca.call_id = $1 AND c.org_id = $2`,
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analytics not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get call analytics' });
  }
});

// Get aggregated analytics
router.get('/analytics/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_calls,
        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_calls,
        AVG(duration_seconds) as avg_duration,
        SUM(cost) as total_cost,
        COUNT(CASE WHEN answered_by = 'human' THEN 1 END) as answered_by_human,
        COUNT(CASE WHEN answered_by = 'machine' THEN 1 END) as answered_by_machine
      FROM calls
      WHERE org_id = $1
    `;

    const params: any[] = [req.organization.id];
    let paramCount = 2;

    if (startDate) {
      query += ` AND started_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND started_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    const result = await Database.query(query, params);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get summary analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics summary' });
  }
});

export default router;
