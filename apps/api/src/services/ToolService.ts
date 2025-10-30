import { Database } from '../db/database';

export interface ToolDefinition {
  id?: string;
  org_id: string;
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  handler_type: 'builtin' | 'webhook' | 'custom';
  handler_config: Record<string, any>;
  is_enabled: boolean;
  requires_confirmation?: boolean;
  permissions_required?: string[];
}

export interface ToolCall {
  id: string;
  tool_name: string;
  arguments: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export class ToolService {
  /**
   * Convert tool definitions to OpenAI function format
   */
  static toOpenAIFormat(tools: ToolDefinition[]): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }> {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Get all enabled tools for an organization
   */
  static async getEnabledTools(orgId: string): Promise<ToolDefinition[]> {
    const result = await Database.query(
      `SELECT * FROM tools
       WHERE org_id = $1 AND is_enabled = true
       ORDER BY name ASC`,
      [orgId]
    );

    return result.rows;
  }

  /**
   * Get a specific tool by name
   */
  static async getTool(orgId: string, toolName: string): Promise<ToolDefinition | null> {
    const result = await Database.query(
      `SELECT * FROM tools
       WHERE org_id = $1 AND name = $2
       LIMIT 1`,
      [orgId, toolName]
    );

    return result.rows[0] || null;
  }

  /**
   * Execute a tool call
   */
  static async executeTool(
    orgId: string,
    toolCall: ToolCall,
    sessionId?: string
  ): Promise<ToolExecutionResult> {
    try {
      const tool = await this.getTool(orgId, toolCall.tool_name);

      if (!tool) {
        return {
          success: false,
          error: `Tool ${toolCall.tool_name} not found`,
        };
      }

      if (!tool.is_enabled) {
        return {
          success: false,
          error: `Tool ${toolCall.tool_name} is disabled`,
        };
      }

      // Log tool execution
      await Database.query(
        `INSERT INTO tool_executions (
          org_id, session_id, tool_id, tool_name,
          arguments, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [orgId, sessionId, tool.id, tool.name, JSON.stringify(toolCall.arguments), 'executing']
      );

      // Execute based on handler type
      let result: any;

      switch (tool.handler_type) {
        case 'builtin':
          result = await this.executeBuiltinTool(tool.name, toolCall.arguments);
          break;
        case 'webhook':
          result = await this.executeWebhookTool(tool.handler_config, toolCall.arguments);
          break;
        case 'custom':
          result = await this.executeCustomTool(tool.handler_config, toolCall.arguments);
          break;
        default:
          throw new Error(`Unknown handler type: ${tool.handler_type}`);
      }

      // Update execution log
      await Database.query(
        `UPDATE tool_executions
         SET status = 'completed',
             result = $1,
             completed_at = NOW()
         WHERE org_id = $2 AND tool_name = $3 AND status = 'executing'
         ORDER BY created_at DESC
         LIMIT 1`,
        [JSON.stringify(result), orgId, tool.name]
      );

      return {
        success: true,
        result,
      };
    } catch (error: any) {
      console.error(`Tool execution error (${toolCall.tool_name}):`, error);

      // Log error
      await Database.query(
        `UPDATE tool_executions
         SET status = 'failed',
             error = $1,
             completed_at = NOW()
         WHERE org_id = $2 AND tool_name = $3 AND status = 'executing'
         ORDER BY created_at DESC
         LIMIT 1`,
        [error.message, orgId, toolCall.tool_name]
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute built-in tools
   */
  private static async executeBuiltinTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    switch (toolName) {
      case 'get_current_time':
        return this.getCurrentTime(args as { timezone?: string });
      case 'get_weather':
        return this.getWeather(args as { location: string; units?: string });
      case 'web_search':
        return this.webSearch(args as { query: string; num_results?: number });
      case 'calculate':
        return this.calculate(args as { expression: string });
      default:
        throw new Error(`Unknown builtin tool: ${toolName}`);
    }
  }

  /**
   * Execute webhook-based tools
   */
  private static async executeWebhookTool(
    config: Record<string, any>,
    args: Record<string, any>
  ): Promise<any> {
    const { url, method = 'POST', headers = {} } = config;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Execute custom code-based tools
   */
  private static async executeCustomTool(
    config: Record<string, any>,
    args: Record<string, any>
  ): Promise<any> {
    // Custom tool execution logic
    // This could involve running sandboxed code, calling internal services, etc.
    throw new Error('Custom tools not yet implemented');
  }

  // Built-in tool implementations

  private static async getCurrentTime(args: { timezone?: string }): Promise<any> {
    const timezone = args.timezone || 'UTC';
    const now = new Date();

    return {
      timestamp: now.toISOString(),
      timezone: timezone,
      formatted: now.toLocaleString('en-US', { timeZone: timezone }),
      unix: Math.floor(now.getTime() / 1000),
    };
  }

  private static async getWeather(args: { location: string; units?: string }): Promise<any> {
    // Mock implementation - in production, call a real weather API
    return {
      location: args.location,
      temperature: 72,
      units: args.units || 'fahrenheit',
      conditions: 'Partly cloudy',
      humidity: 65,
      wind_speed: 8,
      forecast: 'Sunny with a high of 75°F',
    };
  }

  private static async webSearch(args: { query: string; num_results?: number }): Promise<any> {
    // Mock implementation - in production, call a real search API
    return {
      query: args.query,
      results: [
        {
          title: 'Example Result 1',
          url: 'https://example.com/1',
          snippet: 'This is an example search result',
        },
        {
          title: 'Example Result 2',
          url: 'https://example.com/2',
          snippet: 'Another example result',
        },
      ].slice(0, args.num_results || 5),
    };
  }

  private static async calculate(args: { expression: string }): Promise<any> {
    try {
      // Simple calculator - in production, use a safe math expression evaluator
      // For now, return mock result
      return {
        expression: args.expression,
        result: 'Math evaluation requires safe evaluator implementation',
      };
    } catch (error: any) {
      throw new Error(`Calculation error: ${error.message}`);
    }
  }

  /**
   * Create a new tool
   */
  static async createTool(tool: ToolDefinition): Promise<ToolDefinition> {
    const result = await Database.query(
      `INSERT INTO tools (
        org_id, name, description, parameters,
        handler_type, handler_config, is_enabled,
        requires_confirmation, permissions_required
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tool.org_id,
        tool.name,
        tool.description,
        JSON.stringify(tool.parameters),
        tool.handler_type,
        JSON.stringify(tool.handler_config),
        tool.is_enabled !== false,
        tool.requires_confirmation || false,
        JSON.stringify(tool.permissions_required || []),
      ]
    );

    return result.rows[0];
  }

  /**
   * Update a tool
   */
  static async updateTool(toolId: string, updates: Partial<ToolDefinition>): Promise<ToolDefinition> {
    const setClause = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClause.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.parameters !== undefined) {
      setClause.push(`parameters = $${paramIndex++}`);
      values.push(JSON.stringify(updates.parameters));
    }
    if (updates.handler_config !== undefined) {
      setClause.push(`handler_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.handler_config));
    }
    if (updates.is_enabled !== undefined) {
      setClause.push(`is_enabled = $${paramIndex++}`);
      values.push(updates.is_enabled);
    }
    if (updates.requires_confirmation !== undefined) {
      setClause.push(`requires_confirmation = $${paramIndex++}`);
      values.push(updates.requires_confirmation);
    }

    values.push(toolId);

    const result = await Database.query(
      `UPDATE tools
       SET ${setClause.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete a tool
   */
  static async deleteTool(toolId: string): Promise<void> {
    await Database.query(`DELETE FROM tools WHERE id = $1`, [toolId]);
  }

  /**
   * Get tool execution history
   */
  static async getToolExecutionHistory(
    orgId: string,
    limit: number = 50
  ): Promise<any[]> {
    const result = await Database.query(
      `SELECT * FROM tool_executions
       WHERE org_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [orgId, limit]
    );

    return result.rows;
  }
}
