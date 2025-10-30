-- Migration v3: Add Speech-to-Text (STT) configuration to assistants

-- Add STT configuration columns to assistants table
ALTER TABLE assistants
ADD COLUMN IF NOT EXISTS stt_provider VARCHAR(50) NOT NULL DEFAULT 'deepgram',
ADD COLUMN IF NOT EXISTS stt_model VARCHAR(100) DEFAULT 'nova-2',
ADD COLUMN IF NOT EXISTS stt_language VARCHAR(10) DEFAULT 'en-US';

-- Create comment for documentation
COMMENT ON COLUMN assistants.stt_provider IS 'Speech-to-text provider: deepgram or whisper';
COMMENT ON COLUMN assistants.stt_model IS 'STT model to use (e.g., nova-2 for Deepgram, whisper-1 for OpenAI)';
COMMENT ON COLUMN assistants.stt_language IS 'Language code for transcription (e.g., en-US, es-ES)';
