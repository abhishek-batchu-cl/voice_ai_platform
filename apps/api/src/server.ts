import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { Database } from './db/database';
import { RedisService } from './services/RedisService';
import { MonitoringService } from './services/MonitoringService';
import { LoggerService } from './services/LoggerService';
import { authenticateApiKey } from './middleware/auth';
import { rateLimiters, adaptiveRateLimiter } from './middleware/rateLimiter';
import authRouter from './routes/auth';
import assistantsRouter from './routes/assistants';
import sessionsRouter from './routes/sessions';
import phoneNumbersRouter from './routes/phoneNumbers';
import callsRouter from './routes/calls';
import analyticsRouter from './routes/analytics';
import monitoringRouter from './routes/monitoring';
import twilioRouter from './routes/twilio';
import { startWebSocketServer } from './websocket';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Monitoring routes (no auth required for Prometheus scraping)
app.use('/monitoring', monitoringRouter);

// Backwards compatibility health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes - Authentication (stricter rate limits)
app.use('/api/v1/auth', rateLimiters.auth.middleware(), authRouter);

// API routes - Protected with API key and adaptive rate limiting
app.use('/api/v1/assistants', authenticateApiKey, adaptiveRateLimiter, assistantsRouter);
app.use('/api/v1/sessions', authenticateApiKey, adaptiveRateLimiter, sessionsRouter);
app.use('/api/v1/phone-numbers', authenticateApiKey, adaptiveRateLimiter, phoneNumbersRouter);
app.use('/api/v1/calls', authenticateApiKey, adaptiveRateLimiter, callsRouter);
app.use('/api/v1/analytics', adaptiveRateLimiter, analyticsRouter);

// Twilio webhooks (no auth - Twilio signs requests)
app.use('/api/v1/twilio', twilioRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize services
LoggerService.initialize();
MonitoringService.initialize();
Database.initialize();
RedisService.initialize().catch((err) => {
  LoggerService.warn('Redis initialization failed', { error: err.message });
  console.warn('Continuing without Redis - rate limiting will be disabled');
});

LoggerService.info('Voice AI Platform API starting...');

// Start WebSocket server
startWebSocketServer();

// Start server
app.listen(PORT, () => {
  LoggerService.info(`API server running on http://localhost:${PORT}`);
  LoggerService.info(`Health check: http://localhost:${PORT}/health`);
  LoggerService.info(`Metrics endpoint: http://localhost:${PORT}/monitoring/metrics`);
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/monitoring/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await Database.close();
  await RedisService.close();
  process.exit(0);
});
