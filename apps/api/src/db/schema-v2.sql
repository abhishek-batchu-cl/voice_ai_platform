-- Enhanced schema for phone integration and advanced features

-- Organizations table (unchanged)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    twilio_account_sid VARCHAR(255),
    twilio_auth_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Assistants table with call settings
CREATE TABLE IF NOT EXISTS assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    first_message TEXT,
    system_prompt TEXT NOT NULL,

    -- Voice configuration
    voice_provider VARCHAR(50) NOT NULL DEFAULT 'elevenlabs',
    voice_id VARCHAR(255) NOT NULL,
    voice_settings JSONB DEFAULT '{
        "stability": 0.5,
        "similarity_boost": 0.75,
        "style": 0,
        "speed": 1.0,
        "pitch": 1.0
    }'::jsonb,

    -- Model configuration
    model_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    model_name VARCHAR(100) NOT NULL DEFAULT 'gpt-4',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 500,

    -- Call behavior settings
    call_settings JSONB DEFAULT '{
        "max_call_duration": 1800,
        "silence_timeout": 30,
        "voicemail_detection": true,
        "recording_enabled": true,
        "transcription_enabled": true,
        "end_call_phrases": ["goodbye", "thanks bye", "end call"]
    }'::jsonb,

    -- Features
    interruptions_enabled BOOLEAN DEFAULT true,
    background_denoising BOOLEAN DEFAULT true,

    -- Phone settings
    phone_enabled BOOLEAN DEFAULT false,
    transfer_number VARCHAR(20),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Phone Numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    friendly_name VARCHAR(255),
    country_code VARCHAR(5) DEFAULT 'US',

    -- Twilio specific
    twilio_sid VARCHAR(255) UNIQUE,
    capabilities JSONB DEFAULT '{
        "voice": true,
        "sms": false,
        "mms": false
    }'::jsonb,

    -- Assistant assignment
    assistant_id UUID REFERENCES assistants(id) ON DELETE SET NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'active',
    purchased_at TIMESTAMP DEFAULT NOW(),

    created_at TIMESTAMP DEFAULT NOW()
);

-- Calls table (replaces sessions for phone calls)
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,

    -- Call details
    call_sid VARCHAR(255) UNIQUE,
    direction VARCHAR(20), -- 'inbound', 'outbound'
    from_number VARCHAR(20),
    to_number VARCHAR(20),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'initiated',
    answered_by VARCHAR(50), -- 'human', 'machine', 'unknown'

    -- Timing
    started_at TIMESTAMP DEFAULT NOW(),
    answered_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,

    -- Recordings
    recording_url VARCHAR(500),
    recording_duration INTEGER,

    -- Costs
    cost DECIMAL(10,4),
    cost_currency VARCHAR(3) DEFAULT 'USD',

    -- Metadata
    end_reason VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced Sessions table (for web sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
    call_id UUID REFERENCES calls(id) ON DELETE SET NULL,

    session_type VARCHAR(20) DEFAULT 'web', -- 'web', 'phone'
    status VARCHAR(50) DEFAULT 'active',

    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Messages table (enhanced)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,

    -- Audio info
    audio_url VARCHAR(500),
    audio_duration DECIMAL(6,2),

    timestamp TIMESTAMP DEFAULT NOW()
);

-- Call Analytics table
CREATE TABLE IF NOT EXISTS call_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,

    -- Metrics
    total_messages INTEGER DEFAULT 0,
    user_messages INTEGER DEFAULT 0,
    assistant_messages INTEGER DEFAULT 0,

    -- Sentiment
    sentiment_score DECIMAL(3,2),

    -- Performance
    avg_response_time DECIMAL(6,2),
    interruptions_count INTEGER DEFAULT 0,

    -- Outcome
    call_successful BOOLEAN,
    goal_achieved BOOLEAN,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assistants_org_id ON assistants(org_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_org_id ON phone_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_assistant_id ON phone_numbers(assistant_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_assistant_id ON calls(assistant_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_org_id ON sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_sessions_assistant_id ON sessions(assistant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_call_id ON sessions(call_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_call_id ON messages(call_id);
CREATE INDEX IF NOT EXISTS idx_call_analytics_call_id ON call_analytics(call_id);
