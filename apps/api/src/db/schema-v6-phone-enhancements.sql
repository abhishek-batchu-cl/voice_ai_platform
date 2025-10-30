-- Phase 3: Enhanced Phone Integration Schema
-- Adds voicemail, recordings, queues, and business hours management

-- Create voicemails table
CREATE TABLE IF NOT EXISTS voicemails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_sid VARCHAR(255),
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  recording_url TEXT,
  recording_sid VARCHAR(255),
  duration_seconds INTEGER,
  transcription TEXT,
  transcription_status VARCHAR(50),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create call_recordings table (separate from voicemails)
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid VARCHAR(255) NOT NULL,
  recording_sid VARCHAR(255) UNIQUE NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  transcription TEXT,
  transcription_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Create call_queues table
CREATE TABLE IF NOT EXISTS call_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  queue_sid VARCHAR(255) UNIQUE NOT NULL,
  max_size INTEGER DEFAULT 100,
  wait_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create business_hours table
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  monday_open TIME,
  monday_close TIME,
  tuesday_open TIME,
  tuesday_close TIME,
  wednesday_open TIME,
  wednesday_close TIME,
  thursday_open TIME,
  thursday_close TIME,
  friday_open TIME,
  friday_close TIME,
  saturday_open TIME,
  saturday_close TIME,
  sunday_open TIME,
  sunday_close TIME,
  after_hours_message TEXT,
  after_hours_action VARCHAR(50) DEFAULT 'voicemail',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id)
);

-- Create call_transfers table
CREATE TABLE IF NOT EXISTS call_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid VARCHAR(255) NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transfer_type VARCHAR(20) NOT NULL CHECK (transfer_type IN ('warm', 'cold')),
  from_number VARCHAR(20),
  to_number VARCHAR(20) NOT NULL,
  transfer_call_sid VARCHAR(255),
  conference_sid VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add columns to calls table for enhanced features
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS answered_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS machine_detection_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS queue_sid VARCHAR(255),
ADD COLUMN IF NOT EXISTS queue_time_seconds INTEGER,
ADD COLUMN IF NOT EXISTS transferred_to VARCHAR(20),
ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(20);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voicemails_org ON voicemails(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voicemails_call_sid ON voicemails(call_sid);
CREATE INDEX IF NOT EXISTS idx_voicemails_is_read ON voicemails(is_read);

CREATE INDEX IF NOT EXISTS idx_call_recordings_org ON call_recordings(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_sid ON call_recordings(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_recordings_deleted ON call_recordings(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_call_queues_org ON call_queues(org_id);
CREATE INDEX IF NOT EXISTS idx_call_queues_active ON call_queues(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_call_transfers_call_sid ON call_transfers(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_transfers_org ON call_transfers(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_answered_by ON calls(answered_by);
CREATE INDEX IF NOT EXISTS idx_calls_queue ON calls(queue_sid);

-- Insert default business hours for existing organizations
INSERT INTO business_hours (org_id, monday_open, monday_close, tuesday_open, tuesday_close,
  wednesday_open, wednesday_close, thursday_open, thursday_close, friday_open, friday_close)
SELECT id, '09:00:00', '17:00:00', '09:00:00', '17:00:00',
       '09:00:00', '17:00:00', '09:00:00', '17:00:00', '09:00:00', '17:00:00'
FROM organizations
WHERE NOT EXISTS (SELECT 1 FROM business_hours WHERE business_hours.org_id = organizations.id);

-- Comments
COMMENT ON TABLE voicemails IS 'Stores voicemail messages with transcriptions';
COMMENT ON TABLE call_recordings IS 'Stores call recordings with optional transcriptions';
COMMENT ON TABLE call_queues IS 'Manages call queues for handling multiple concurrent calls';
COMMENT ON TABLE business_hours IS 'Organization business hours configuration';
COMMENT ON TABLE call_transfers IS 'Tracks call transfer history (warm and cold transfers)';

COMMENT ON COLUMN voicemails.is_read IS 'Whether the voicemail has been listened to';
COMMENT ON COLUMN call_recordings.deleted_at IS 'Soft delete timestamp for recordings';
COMMENT ON COLUMN business_hours.after_hours_action IS 'Action to take after hours: voicemail, message, hangup';
COMMENT ON COLUMN calls.answered_by IS 'Who answered: human, machine_start, machine_end_beep, machine_end_silence, machine_end_other';
