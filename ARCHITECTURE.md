# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌─────────────────────────────┐   │
│  │   Browser    │         │    Custom Applications      │   │
│  │              │         │   (React, Node.js, Python)  │   │
│  │ - Dashboard  │         │                             │   │
│  │ - Test UI    │         │   - Mobile Apps             │   │
│  │              │         │   - Backend Services        │   │
│  └──────────────┘         └─────────────────────────────┘   │
│         │                              │                     │
│         │ HTTP/WS                      │ HTTP/WS            │
└─────────┴──────────────────────────────┴─────────────────────┘
          │                              │
          ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐           ┌──────────────────────┐     │
│  │   REST API      │           │  WebSocket Server    │     │
│  │  (Express.js)   │           │                      │     │
│  │                 │           │  - Session Manager   │     │
│  │  /assistants    │◄─────────►│  - Voice Handler     │     │
│  │  /sessions      │           │  - Audio Streamer    │     │
│  │  /messages      │           │                      │     │
│  └─────────────────┘           └──────────────────────┘     │
│           │                              │                   │
│           ├──────────────┬───────────────┤                  │
│           ▼              ▼               ▼                   │
│  ┌───────────────────────────────────────────────┐          │
│  │         ORCHESTRATION LAYER                    │          │
│  │                                                 │          │
│  │  ┌─────────────────────────────────────────┐  │          │
│  │  │      Voice Orchestrator                  │  │          │
│  │  │                                           │  │          │
│  │  │  • Manages conversation flow             │  │          │
│  │  │  • Coordinates AI services               │  │          │
│  │  │  • Handles session state                 │  │          │
│  │  │  • Processes user input                  │  │          │
│  │  │  • Generates responses                   │  │          │
│  │  └─────────────────────────────────────────┘  │          │
│  └───────────────────────────────────────────────┘          │
│                          │                                    │
└──────────────────────────┼───────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                      SERVICES LAYER                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   OpenAI     │  │ ElevenLabs   │  │   Database       │  │
│  │   Service    │  │   Service    │  │   Service        │  │
│  │              │  │              │  │                  │  │
│  │ • GPT-4      │  │ • TTS        │  │ • PostgreSQL     │  │
│  │ • GPT-3.5    │  │ • Voices     │  │ • Sessions       │  │
│  │ • TTS        │  │              │  │ • Messages       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                    │            │
└─────────┼──────────────────┼────────────────────┼────────────┘
          │                  │                    │
          ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  OpenAI API  │  │ ElevenLabs   │  │   PostgreSQL     │  │
│  │              │  │     API      │  │    Database      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Request Flow

### 1. Creating an Assistant (REST API)

```
User → Dashboard → POST /api/v1/assistants → Database
                         │
                         └──> Returns Assistant ID
```

### 2. Starting a Voice Session (WebSocket)

```
1. User → Dashboard → POST /api/v1/sessions
                         │
                         └──> Returns WebSocket URL

2. User → Connect to WebSocket
                         │
                         └──> Session Created

3. Voice Orchestrator → Sends First Message (if configured)
                         │
                         └──> User receives greeting
```

### 3. Voice Conversation Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Types message
     ▼
┌─────────────────┐
│   WebSocket     │
│    Client       │
└────┬────────────┘
     │
     │ 2. Send via WebSocket
     ▼
┌─────────────────────────────────────┐
│         Voice Orchestrator          │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 1. Save user message to DB    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 2. Add to conversation history│ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 3. Generate LLM response      │◄─── OpenAI
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 4. Save assistant message     │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 5. Convert text to speech     │◄─── ElevenLabs
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 6. Send back to client        │ │
│  └───────────────────────────────┘ │
└────┬────────────────────────────────┘
     │
     │ 3. Receive response (text + audio)
     ▼
┌─────────────────┐
│   WebSocket     │
│    Client       │
└────┬────────────┘
     │
     │ 4. Display text + play audio
     ▼
┌──────────┐
│   User   │
└──────────┘
```

## Data Models

### Database Schema

```
┌─────────────────┐
│ organizations   │
├─────────────────┤
│ id (PK)         │
│ name            │
│ api_key (UK)    │
│ created_at      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────┐
│      assistants             │
├─────────────────────────────┤
│ id (PK)                     │
│ org_id (FK)                 │
│ name                        │
│ first_message               │
│ system_prompt               │
│ voice_provider              │
│ voice_id                    │
│ voice_settings (JSONB)      │
│ model_provider              │
│ model_name                  │
│ temperature                 │
│ max_tokens                  │
│ interruptions_enabled       │
│ background_denoising        │
│ created_at                  │
│ updated_at                  │
└────────┬────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│    sessions     │
├─────────────────┤
│ id (PK)         │
│ org_id (FK)     │
│ assistant_id(FK)│
│ status          │
│ started_at      │
│ ended_at        │
│ metadata (JSONB)│
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│    messages     │
├─────────────────┤
│ id (PK)         │
│ session_id (FK) │
│ role            │
│ content         │
│ timestamp       │
└─────────────────┘
```

## Component Responsibilities

### Backend Components

#### 1. REST API (`server.ts`)
- **Purpose**: HTTP endpoints for resource management
- **Responsibilities**:
  - Assistant CRUD operations
  - Session creation and management
  - Authentication middleware
  - Health checks

#### 2. WebSocket Server (`websocket.ts`)
- **Purpose**: Real-time communication
- **Responsibilities**:
  - Connection handling
  - Message routing
  - Session validation
  - Error handling

#### 3. Voice Orchestrator (`VoiceOrchestrator.ts`)
- **Purpose**: Conversation management
- **Responsibilities**:
  - Conversation flow control
  - Message history management
  - AI service coordination
  - Response generation

#### 4. OpenAI Service (`OpenAIService.ts`)
- **Purpose**: LLM integration
- **Responsibilities**:
  - Text generation
  - Model configuration
  - Token management
  - Error handling

#### 5. ElevenLabs Service (`ElevenLabsService.ts`)
- **Purpose**: Text-to-speech
- **Responsibilities**:
  - Audio generation
  - Voice selection
  - Quality settings
  - API communication

### Frontend Components

#### 1. API Client (`lib/api.ts`)
- **Purpose**: Backend communication
- **Responsibilities**:
  - HTTP requests
  - Authentication headers
  - Error handling
  - Response parsing

#### 2. Dashboard (`pages/Dashboard.tsx`)
- **Purpose**: Main interface
- **Responsibilities**:
  - Assistant overview
  - Quick actions
  - Statistics display

#### 3. Assistant Builder (`pages/AssistantBuilder.tsx`)
- **Purpose**: Assistant configuration
- **Responsibilities**:
  - Form management
  - Validation
  - Create/Update operations

#### 4. Test Chat (`pages/TestChat.tsx`)
- **Purpose**: Voice testing
- **Responsibilities**:
  - WebSocket connection
  - Message display
  - Audio playback
  - Session management

## Communication Protocols

### REST API

```
Client                  Server
  │                       │
  ├─── POST /assistants ──►
  │                       │
  │◄──── Assistant ───────┤
  │                       │
```

### WebSocket Protocol

```
Client                          Server
  │                              │
  ├──── Connect with session_id ─►
  │                              │
  │◄───── connected ─────────────┤
  │                              │
  │◄── assistant-message ────────┤
  │    (first message)           │
  │                              │
  ├──── user-message ───────────►
  │                              │
  │                              │ [Process: LLM + TTS]
  │                              │
  │◄── assistant-message ────────┤
  │    (text + audio)            │
  │                              │
  ├──── user-message ───────────►
  │                              │
  │                              │ [Process: LLM + TTS]
  │                              │
  │◄── assistant-message ────────┤
  │                              │
  ├──── end-session ────────────►
  │                              │
  │◄──── session-ended ──────────┤
  │                              │
  └──── close connection ────────┘
```

## Scalability Considerations

### Current MVP Architecture

```
Single Server
├── Express API (Port 3000)
├── WebSocket Server (Port 8080)
└── PostgreSQL Database
```

### Production Architecture (Future)

```
                 ┌─────────────┐
                 │   Nginx/    │
                 │   Caddy     │
                 └──────┬──────┘
                        │
         ┌──────────────┴───────────────┐
         │                              │
    ┌────▼────┐                    ┌────▼────┐
    │  API    │                    │  API    │
    │ Server  │                    │ Server  │
    │   #1    │                    │   #2    │
    └────┬────┘                    └────┬────┘
         │                              │
         └──────────────┬───────────────┘
                        │
              ┌─────────▼──────────┐
              │   Redis Cluster    │
              │ (Session Storage)  │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  PostgreSQL with   │
              │  Read Replicas     │
              └────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────┐
│         Application Layer           │
│  • API Key Authentication           │
│  • Request Validation (Zod)         │
│  • Rate Limiting                    │
└─────────────────────────────────────┘
                 │
┌─────────────────────────────────────┐
│         Transport Layer             │
│  • HTTPS/TLS                        │
│  • WSS (Secure WebSocket)           │
│  • CORS Configuration               │
└─────────────────────────────────────┘
                 │
┌─────────────────────────────────────┐
│          Data Layer                 │
│  • Encrypted Database Connection    │
│  • Prepared Statements (SQL)        │
│  • Input Sanitization               │
└─────────────────────────────────────┘
```

## Performance Optimizations

### Current Implementation
- Connection pooling (PostgreSQL)
- In-memory conversation history
- Streaming audio responses
- Efficient WebSocket handling

### Future Optimizations
- Redis caching
- CDN for static assets
- Message queuing (Bull/RabbitMQ)
- Database query optimization
- Audio compression
- WebRTC for lower latency

## Error Handling Flow

```
┌─────────────────────┐
│   Error Occurs      │
└──────────┬──────────┘
           │
    ┌──────▼──────────────────────┐
    │   Service Layer Catches     │
    │   (Try/Catch blocks)        │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │   Log Error                 │
    │   (Console/File/Service)    │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │   Send Error Response       │
    │   (HTTP/WebSocket)          │
    └──────┬──────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │   Client Handles Error      │
    │   (Display/Retry/Fallback)  │
    └─────────────────────────────┘
```

## Development vs Production

### Development (Current)
- Single server
- Local PostgreSQL
- Environment variables in `.env`
- Console logging
- No rate limiting

### Production (Recommended)
- Load balanced servers
- Managed PostgreSQL (AWS RDS, etc.)
- Secrets management (Vault, AWS Secrets)
- Structured logging (Winston, Pino)
- Rate limiting per API key
- Monitoring (Prometheus, Grafana)
- Error tracking (Sentry)
- CDN for static assets
- Docker containers
- Kubernetes orchestration

---

This architecture provides a solid foundation for a voice AI platform while remaining simple enough to understand and extend.
