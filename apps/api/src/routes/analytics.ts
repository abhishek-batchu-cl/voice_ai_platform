import { Router, Response } from 'express';
import { AnalyticsService } from '../services/AnalyticsService';
import { authenticateUser, setOrganizationContext, requirePermission, UserAuthRequest } from '../middleware/userAuth';

const router = Router();

// All routes require authentication and organization context
router.use(authenticateUser);
router.use(setOrganizationContext);

/**
 * GET /api/v1/analytics
 * Get comprehensive analytics for the organization
 */
router.get(
  '/',
  requirePermission('view_analytics'),
  async (req: UserAuthRequest, res: Response) => {
    try {
      const orgId = req.currentOrg!.id;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

      const analytics = await AnalyticsService.getAnalytics(orgId, startDate, endDate);

      res.json({
        success: true,
        data: analytics,
        period: {
          start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: endDate || new Date(),
        },
      });
    } catch (error: any) {
      console.error('Analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/analytics/sessions
 * Get session analytics
 */
router.get(
  '/sessions',
  requirePermission('view_analytics'),
  async (req: UserAuthRequest, res: Response) => {
    try {
      const orgId = req.currentOrg!.id;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

      const sessionAnalytics = await AnalyticsService.getSessionAnalytics(orgId, startDate, endDate);

      res.json({
        success: true,
        data: sessionAnalytics,
      });
    } catch (error: any) {
      console.error('Session analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve session analytics',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/analytics/messages
 * Get message analytics
 */
router.get(
  '/messages',
  requirePermission('view_analytics'),
  async (req: UserAuthRequest, res: Response) => {
    try {
      const orgId = req.currentOrg!.id;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

      const messageAnalytics = await AnalyticsService.getMessageAnalytics(orgId, startDate, endDate);

      res.json({
        success: true,
        data: messageAnalytics,
      });
    } catch (error: any) {
      console.error('Message analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve message analytics',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/analytics/voicemails
 * Get voicemail analytics
 */
router.get(
  '/voicemails',
  requirePermission('view_analytics'),
  async (req: UserAuthRequest, res: Response) => {
    try {
      const orgId = req.currentOrg!.id;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

      const voicemailAnalytics = await AnalyticsService.getVoicemailAnalytics(orgId, startDate, endDate);

      res.json({
        success: true,
        data: voicemailAnalytics,
      });
    } catch (error: any) {
      console.error('Voicemail analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve voicemail analytics',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v1/analytics/export/csv
 * Export analytics to CSV
 */
router.get(
  '/export/csv',
  requirePermission('view_analytics'),
  async (req: UserAuthRequest, res: Response) => {
    try {
      const orgId = req.currentOrg!.id;
      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

      const csv = await AnalyticsService.exportToCSV(orgId, startDate, endDate);

      const filename = `analytics-${orgId}-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      console.error('CSV export error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export analytics',
        message: error.message,
      });
    }
  }
);

export default router;
