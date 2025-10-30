-- Phase 5: Function Calling & Tools Support Schema
-- Adds tool definitions and execution tracking

-- Create tools table
CREATE TABLE IF NOT EXISTS tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  handler_type VARCHAR(20) NOT NULL CHECK (handler_type IN ('builtin', 'webhook', 'custom')),
  handler_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  requires_confirmation BOOLEAN DEFAULT false,
  permissions_required JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(org_id, name)
);

-- Create tool_executions table
CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  tool_name VARCHAR(100) NOT NULL,
  arguments JSONB NOT NULL,
  result JSONB,
  error TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'executing' CHECK (status IN ('executing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tools_org ON tools(org_id);
CREATE INDEX IF NOT EXISTS idx_tools_enabled ON tools(org_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_tools_handler_type ON tools(handler_type);

CREATE INDEX IF NOT EXISTS idx_tool_executions_org ON tool_executions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions(status);

-- Insert built-in tools
INSERT INTO tools (org_id, name, description, parameters, handler_type, handler_config)
SELECT o.id, 'get_current_time', 'Get the current time in a specific timezone',
  '{
    "type": "object",
    "properties": {
      "timezone": {
        "type": "string",
        "description": "Timezone name (e.g., America/New_York, UTC)",
        "default": "UTC"
      }
    }
  }'::jsonb,
  'builtin',
  '{}'::jsonb
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.org_id = o.id AND t.name = 'get_current_time'
);

INSERT INTO tools (org_id, name, description, parameters, handler_type, handler_config)
SELECT o.id, 'get_weather', 'Get current weather information for a location',
  '{
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name or coordinates"
      },
      "units": {
        "type": "string",
        "enum": ["fahrenheit", "celsius"],
        "default": "fahrenheit",
        "description": "Temperature units"
      }
    },
    "required": ["location"]
  }'::jsonb,
  'builtin',
  '{}'::jsonb
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.org_id = o.id AND t.name = 'get_weather'
);

INSERT INTO tools (org_id, name, description, parameters, handler_type, handler_config)
SELECT o.id, 'web_search', 'Search the web for information',
  '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query"
      },
      "num_results": {
        "type": "number",
        "default": 5,
        "description": "Number of results to return"
      }
    },
    "required": ["query"]
  }'::jsonb,
  'builtin',
  '{}'::jsonb
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.org_id = o.id AND t.name = 'web_search'
);

INSERT INTO tools (org_id, name, description, parameters, handler_type, handler_config)
SELECT o.id, 'calculate', 'Perform mathematical calculations',
  '{
    "type": "object",
    "properties": {
      "expression": {
        "type": "string",
        "description": "Mathematical expression to evaluate (e.g., 2 + 2, sqrt(16))"
      }
    },
    "required": ["expression"]
  }'::jsonb,
  'builtin',
  '{}'::jsonb
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM tools t WHERE t.org_id = o.id AND t.name = 'calculate'
);

-- Comments
COMMENT ON TABLE tools IS 'Defines available tools/functions for AI assistants';
COMMENT ON TABLE tool_executions IS 'Tracks tool execution history and results';

COMMENT ON COLUMN tools.handler_type IS 'How the tool is executed: builtin, webhook, or custom code';
COMMENT ON COLUMN tools.handler_config IS 'Configuration for the handler (webhook URL, etc.)';
COMMENT ON COLUMN tools.requires_confirmation IS 'Whether user confirmation is needed before execution';
COMMENT ON COLUMN tools.permissions_required IS 'Array of permissions needed to use this tool';

COMMENT ON COLUMN tool_executions.status IS 'Execution status: executing, completed, failed, cancelled';
COMMENT ON COLUMN tool_executions.arguments IS 'Input arguments passed to the tool';
COMMENT ON COLUMN tool_executions.result IS 'Output result from the tool';
