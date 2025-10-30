# Voice AI Platform

A production-ready enterprise voice AI platform with real-time speech-to-text, LLM conversation, text-to-speech, phone integration, and comprehensive monitoring.

## Features

### Core Capabilities
- **Real-time Voice Conversations** - WebSocket-based voice chat with streaming audio
- **Speech-to-Text** - Deepgram (real-time) and OpenAI Whisper (batch) support
- **LLM Integration** - OpenAI GPT models with conversation history
- **Text-to-Speech** - ElevenLabs and OpenAI TTS
- **Phone Integration** - Twilio integration for inbound/outbound calls

### Authentication & Security
- JWT authentication with access and refresh tokens
- Role-based access control (RBAC) with 4 default roles
- Multi-tenant organization support
- Rate limiting with Redis
- API key authentication

### Phone Features
- Voicemail detection and handling
- Call transfers (warm and cold)
- Call recording management
- Call queuing
- Business hours management

### Analytics & Monitoring
- Comprehensive call analytics
- Real-time metrics with Prometheus
- Grafana dashboards
- Structured logging with Winston
- Health checks (liveness, readiness)

### AI Tools & Functions
- OpenAI function calling support
- Built-in tools (weather, time, search, calculator)
- Custom webhook-based tools

## Quick Start

### Docker Compose (Recommended)

\`\`\`bash
docker-compose up -d
curl http://localhost:3000/monitoring/health/ready
\`\`\`

Access:
- API: http://localhost:3000
- Metrics: http://localhost:3000/monitoring/metrics
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001

### Manual Setup

\`\`\`bash
npm install
cp .env.example .env
# Edit .env with your API keys
cd apps/api && npm run migrate
npm run dev
\`\`\`

## Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Architecture](./ARCHITECTURE.md)
- [Setup Instructions](./SETUP.md)

## API Endpoints

- Authentication: \`/api/v1/auth/*\`
- Assistants: \`/api/v1/assistants\`
- Sessions: \`/api/v1/sessions\`
- Calls: \`/api/v1/calls\`
- Analytics: \`/api/v1/analytics\`
- Monitoring: \`/monitoring/*\`

## License

MIT
