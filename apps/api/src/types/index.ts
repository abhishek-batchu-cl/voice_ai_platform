export interface Assistant {
  id?: string;
  org_id?: string;
  name: string;
  first_message?: string;
  system_prompt: string;
  voice_provider: 'elevenlabs' | 'openai';
  voice_id: string;
  voice_settings?: Record<string, any>;
  stt_provider: 'deepgram' | 'whisper';
  stt_model?: string;
  stt_language?: string;
  model_provider: 'openai' | 'anthropic';
  model_name: string;
  temperature?: number;
  max_tokens?: number;
  interruptions_enabled?: boolean;
  background_denoising?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface Session {
  id: string;
  org_id: string;
  assistant_id: string;
  status: 'active' | 'ended';
  started_at: Date;
  ended_at?: Date;
  metadata?: Record<string, any>;
}

export interface Message {
  id?: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface Organization {
  id: string;
  name: string;
  api_key: string;
  tier: 'free' | 'pro' | 'enterprise' | 'custom';
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  concurrent_sessions: number;
  created_at: Date;
}

export interface User {
  id: string;
  email: string;
  password_hash?: string; // Don't expose in responses
  first_name?: string;
  last_name?: string;
  email_verified: boolean;
  is_active: boolean;
  is_superuser: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at?: Date;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  created_at: Date;
}

export interface UserOrganization {
  id: string;
  user_id: string;
  org_id: string;
  role_id?: string;
  permissions: string[];
  is_active: boolean;
  invited_by?: string;
  invited_at?: Date;
  joined_at: Date;
  created_at: Date;
}
