import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}] ${message}`;

  // Add metadata if present
  const metadataKeys = Object.keys(metadata);
  if (metadataKeys.length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// JSON format for production
const jsonFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  winston.format.json()
);

// Pretty format for development
const prettyFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  logFormat
);

export class LoggerService {
  private static logger: winston.Logger;

  static initialize() {
    const isProduction = process.env.NODE_ENV === 'production';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: isProduction ? jsonFormat : prettyFormat,
      defaultMeta: {
        service: 'voice-ai-api',
        environment: process.env.NODE_ENV || 'development',
      },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: isProduction ? jsonFormat : prettyFormat,
        }),

        // Error log file (only errors)
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: jsonFormat,
        }),

        // Combined log file (all levels)
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: jsonFormat,
        }),
      ],
    });
  }

  static getLogger(): winston.Logger {
    if (!this.logger) {
      this.initialize();
    }
    return this.logger;
  }

  // Convenience methods
  static info(message: string, meta?: any) {
    this.getLogger().info(message, meta);
  }

  static error(message: string, error?: Error | any, meta?: any) {
    this.getLogger().error(message, {
      ...meta,
      error: error?.message,
      stack: error?.stack,
    });
  }

  static warn(message: string, meta?: any) {
    this.getLogger().warn(message, meta);
  }

  static debug(message: string, meta?: any) {
    this.getLogger().debug(message, meta);
  }

  static http(message: string, meta?: any) {
    this.getLogger().http(message, meta);
  }

  // Structured logging for specific events
  static logAPIRequest(req: any, res: any, duration: number) {
    this.info('API Request', {
      method: req.method,
      path: req.path,
      query: req.query,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  static logCallEvent(event: string, callSid: string, data?: any) {
    this.info(`Call Event: ${event}`, {
      callSid,
      event,
      ...data,
    });
  }

  static logWebSocketEvent(event: string, sessionId: string, data?: any) {
    this.debug(`WebSocket Event: ${event}`, {
      sessionId,
      event,
      ...data,
    });
  }

  static logToolExecution(toolName: string, status: string, duration: number, data?: any) {
    this.info('Tool Execution', {
      toolName,
      status,
      duration: `${duration}ms`,
      ...data,
    });
  }

  static logDatabaseQuery(query: string, duration: number, error?: Error) {
    if (error) {
      this.error('Database Query Failed', error, { query, duration });
    } else {
      this.debug('Database Query', { query: query.substring(0, 100), duration: `${duration}ms` });
    }
  }

  static logAuth(event: string, userId?: string, success?: boolean, data?: any) {
    this.info(`Auth Event: ${event}`, {
      event,
      userId,
      success,
      ...data,
    });
  }
}
