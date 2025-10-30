import { Router, Request, Response } from 'express';
import { MonitoringService } from '../services/MonitoringService';
import { Database } from '../db/database';
import { RedisService } from '../services/RedisService';

const router = Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await MonitoringService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).send('Failed to retrieve metrics');
  }
});

/**
 * GET /health
 * Basic health check
 */
router.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/live
 * Kubernetes liveness probe
 * Returns 200 if the application is running
 */
router.get('/health/live', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Kubernetes readiness probe
 * Returns 200 if the application is ready to serve traffic
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  const checks: any = {
    database: false,
    redis: false,
  };

  try {
    // Check database connection
    const dbResult = await Database.query('SELECT 1');
    checks.database = dbResult.rows.length > 0;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  try {
    // Check Redis connection
    checks.redis = RedisService.isAvailable();
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  const isReady = checks.database; // Redis is optional

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/detailed
 * Detailed health check with all dependencies
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  const health: any = {
    status: 'unknown',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: { status: 'unknown', latency: 0 },
      redis: { status: 'unknown', latency: 0 },
    },
  };

  // Check database
  try {
    const start = Date.now();
    await Database.query('SELECT 1');
    health.checks.database = {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error: any) {
    health.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  // Check Redis
  try {
    const start = Date.now();
    const available = RedisService.isAvailable();
    health.checks.redis = {
      status: available ? 'healthy' : 'unavailable',
      latency: Date.now() - start,
    };
  } catch (error: any) {
    health.checks.redis = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  // Determine overall status
  const allHealthy = health.checks.database.status === 'healthy';
  health.status = allHealthy ? 'healthy' : 'degraded';

  res.status(allHealthy ? 200 : 503).json(health);
});

export default router;
