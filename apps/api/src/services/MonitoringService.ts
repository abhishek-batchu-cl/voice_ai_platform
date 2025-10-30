import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class MonitoringService {
  private static registry: Registry;
  private static initialized = false;

  // HTTP Metrics
  static httpRequestsTotal: Counter;
  static httpRequestDuration: Histogram;
  static httpRequestErrors: Counter;

  // WebSocket Metrics
  static wsConnectionsActive: Gauge;
  static wsMessagesTotal: Counter;
  static wsMessageErrors: Counter;

  // Voice AI Metrics
  static callsTotal: Counter;
  static callDuration: Histogram;
  static sttDuration: Histogram;
  static llmDuration: Histogram;
  static ttsDuration: Histogram;
  static transcriptionAccuracy: Histogram;

  // Business Metrics
  static apiCostTotal: Counter;
  static voicemailsTotal: Counter;
  static toolExecutionsTotal: Counter;

  // System Metrics
  static databaseConnectionsActive: Gauge;
  static redisConnectionsActive: Gauge;

  static initialize() {
    if (this.initialized) {
      return;
    }

    this.registry = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.registry });

    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestErrors = new Counter({
      name: 'http_request_errors_total',
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_type'],
      registers: [this.registry],
    });

    // WebSocket Metrics
    this.wsConnectionsActive = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry],
    });

    this.wsMessagesTotal = new Counter({
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['type', 'direction'],
      registers: [this.registry],
    });

    this.wsMessageErrors = new Counter({
      name: 'websocket_message_errors_total',
      help: 'Total number of WebSocket message errors',
      labelNames: ['type', 'error_type'],
      registers: [this.registry],
    });

    // Voice AI Metrics
    this.callsTotal = new Counter({
      name: 'calls_total',
      help: 'Total number of calls',
      labelNames: ['direction', 'status'],
      registers: [this.registry],
    });

    this.callDuration = new Histogram({
      name: 'call_duration_seconds',
      help: 'Call duration in seconds',
      buckets: [10, 30, 60, 120, 300, 600, 1800],
      registers: [this.registry],
    });

    this.sttDuration = new Histogram({
      name: 'stt_transcription_duration_seconds',
      help: 'Speech-to-text transcription duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.llmDuration = new Histogram({
      name: 'llm_response_duration_seconds',
      help: 'LLM response generation duration in seconds',
      buckets: [0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.ttsDuration = new Histogram({
      name: 'tts_generation_duration_seconds',
      help: 'Text-to-speech generation duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.transcriptionAccuracy = new Histogram({
      name: 'transcription_accuracy_score',
      help: 'Transcription accuracy score (0-1)',
      buckets: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0],
      registers: [this.registry],
    });

    // Business Metrics
    this.apiCostTotal = new Counter({
      name: 'api_cost_total_usd',
      help: 'Total API cost in USD',
      labelNames: ['provider', 'service'],
      registers: [this.registry],
    });

    this.voicemailsTotal = new Counter({
      name: 'voicemails_total',
      help: 'Total number of voicemails received',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.toolExecutionsTotal = new Counter({
      name: 'tool_executions_total',
      help: 'Total number of tool executions',
      labelNames: ['tool_name', 'status'],
      registers: [this.registry],
    });

    // System Metrics
    this.databaseConnectionsActive = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });

    this.redisConnectionsActive = new Gauge({
      name: 'redis_connections_active',
      help: 'Number of active Redis connections',
      registers: [this.registry],
    });

    this.initialized = true;
  }

  static getRegistry(): Registry {
    if (!this.initialized) {
      this.initialize();
    }
    return this.registry;
  }

  static async getMetrics(): Promise<string> {
    if (!this.initialized) {
      this.initialize();
    }
    return await this.registry.metrics();
  }

  // Helper methods to track metrics

  static trackHTTPRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  static trackHTTPError(method: string, route: string, errorType: string) {
    this.httpRequestErrors.inc({ method, route, error_type: errorType });
  }

  static trackWebSocketConnection(increment: boolean) {
    if (increment) {
      this.wsConnectionsActive.inc();
    } else {
      this.wsConnectionsActive.dec();
    }
  }

  static trackWebSocketMessage(type: string, direction: 'inbound' | 'outbound') {
    this.wsMessagesTotal.inc({ type, direction });
  }

  static trackWebSocketError(type: string, errorType: string) {
    this.wsMessageErrors.inc({ type, error_type: errorType });
  }

  static trackCall(direction: 'inbound' | 'outbound', status: string, duration?: number) {
    this.callsTotal.inc({ direction, status });
    if (duration !== undefined) {
      this.callDuration.observe(duration);
    }
  }

  static trackSTT(duration: number) {
    this.sttDuration.observe(duration);
  }

  static trackLLM(duration: number) {
    this.llmDuration.observe(duration);
  }

  static trackTTS(duration: number) {
    this.ttsDuration.observe(duration);
  }

  static trackAPICost(provider: string, service: string, cost: number) {
    this.apiCostTotal.inc({ provider, service }, cost);
  }

  static trackVoicemail(status: 'received' | 'read' | 'deleted') {
    this.voicemailsTotal.inc({ status });
  }

  static trackToolExecution(toolName: string, status: 'completed' | 'failed') {
    this.toolExecutionsTotal.inc({ tool_name: toolName, status });
  }

  static setDatabaseConnections(count: number) {
    this.databaseConnectionsActive.set(count);
  }

  static setRedisConnections(count: number) {
    this.redisConnectionsActive.set(count);
  }
}
