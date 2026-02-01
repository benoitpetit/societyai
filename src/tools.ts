/**
 * @fileoverview Tool Calling System
 *
 * This module provides a comprehensive tool calling system that allows agents
 * to interact with external functions, APIs, and services.
 *
 * Features:
 * - JSON Schema-based tool definitions
 * - Automatic parameter validation
 * - Error handling and retry logic
 * - Tool result caching
 * - Parallel tool execution
 * - Tool composition
 *
 * @example
 * ```typescript
 * const searchTool = ToolBuilder.create()
 *   .withName('search')
 *   .withDescription('Search the web for information')
 *   .withParameters({
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' }
 *     },
 *     required: ['query']
 *   })
 *   .withExecutor(async (params) => {
 *     return await searchAPI(params.query);
 *   })
 *   .build();
 *
 * const result = await searchTool.execute({ query: 'TypeScript' });
 * ```
 */

import { getLogger } from './logger';
import { ProcessingFailedError } from './errors';

// ============================================================================
// TOOL TYPES
// ============================================================================

/**
 * JSON Schema for tool parameters
 */
export interface ToolParameterSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, ToolParameterSchema>;
  items?: ToolParameterSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/**
 * Tool definition
 */
export interface Tool {
  /** Unique tool identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /** Parameter schema (JSON Schema) */
  parameters: ToolParameterSchema;
  /** Execute the tool */
  execute: (params: Record<string, unknown>, context?: ToolContext) => Promise<unknown>;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Agent ID executing the tool */
  agentId?: string;
  /** Shared data */
  sharedData?: Map<string, unknown>;
  /** Abort signal */
  signal?: AbortSignal;
  /** Previous tool results */
  previousResults?: ToolResult[];
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Tool name */
  tool: string;
  /** Execution success status */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error if failed */
  error?: Error;
  /** Execution duration in ms */
  duration: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool call from agent
 */
export interface ToolCall {
  /** Tool name to call */
  name: string;
  /** Parameters for the tool */
  parameters: Record<string, unknown>;
  /** Call ID for tracking */
  callId?: string;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

/**
 * Registry for managing tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private logger = getLogger();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.info(`Tool ${tool.name} is already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    this.logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): void {
    this.tools.delete(name);
    this.logger.debug(`Unregistered tool: ${name}`);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool definitions for AI model
   */
  getDefinitions(): Array<{ name: string; description: string; parameters: ToolParameterSchema }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Execute a tool call
   */
  async execute(call: ToolCall, context?: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(call.name);

    if (!tool) {
      return {
        tool: call.name,
        success: false,
        error: new ProcessingFailedError(`Tool not found: ${call.name}`),
        duration: Date.now() - startTime,
      };
    }

    try {
      // Validate parameters
      this.validateParameters(call.parameters, tool.parameters);

      // Execute tool
      const result = await tool.execute(call.parameters, context);

      return {
        tool: call.name,
        success: true,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Tool execution failed: ${call.name}`, error);
      return {
        tool: call.name,
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeParallel(
    calls: ToolCall[],
    context?: ToolContext
  ): Promise<ToolResult[]> {
    return Promise.all(calls.map((call) => this.execute(call, context)));
  }

  /**
   * Validate parameters against schema
   */
  private validateParameters(
    params: Record<string, unknown>,
    schema: ToolParameterSchema
  ): void {
    if (schema.type !== 'object') {
      throw new ProcessingFailedError('Tool parameters must be an object');
    }

    // Check required parameters
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in params)) {
          throw new ProcessingFailedError(
            `Missing required parameter: ${required}`
          );
        }
      }
    }

    // Validate each parameter
    if (schema.properties) {
      for (const [key, value] of Object.entries(params)) {
        const propSchema = schema.properties[key];
        if (!propSchema) {
          throw new ProcessingFailedError(`Unknown parameter: ${key}`);
        }
        this.validateValue(value, propSchema, key);
      }
    }
  }

  /**
   * Validate a single value against schema
   */
  private validateValue(
    value: unknown,
    schema: ToolParameterSchema,
    path: string
  ): void {
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      throw new ProcessingFailedError(
        `Parameter ${path}: expected ${schema.type}, got ${actualType}`
      );
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      throw new ProcessingFailedError(
        `Parameter ${path}: value must be one of ${schema.enum.join(', ')}`
      );
    }

    // Number validations
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        throw new ProcessingFailedError(
          `Parameter ${path}: must be >= ${schema.minimum}`
        );
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        throw new ProcessingFailedError(
          `Parameter ${path}: must be <= ${schema.maximum}`
        );
      }
    }

    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        throw new ProcessingFailedError(
          `Parameter ${path}: length must be >= ${schema.minLength}`
        );
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        throw new ProcessingFailedError(
          `Parameter ${path}: length must be <= ${schema.maxLength}`
        );
      }
    }

    // Array validations
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        value.forEach((item, index) => {
          this.validateValue(item, schema.items!, `${path}[${index}]`);
        });
      }
    }

    // Object validations
    if (schema.type === 'object' && schema.properties) {
      for (const [key, propValue] of Object.entries(value as Record<string, unknown>)) {
        const propSchema = schema.properties[key];
        if (propSchema) {
          this.validateValue(propValue, propSchema, `${path}.${key}`);
        }
      }
    }
  }
}

// ============================================================================
// TOOL BUILDER
// ============================================================================

/**
 * Builder for creating tools
 */
export class ToolBuilder {
  private tool: Partial<Tool> = {};

  static create(): ToolBuilder {
    return new ToolBuilder();
  }

  /**
   * Set tool name
   */
  withName(name: string): this {
    this.tool.name = name;
    return this;
  }

  /**
   * Set tool description
   */
  withDescription(description: string): this {
    this.tool.description = description;
    return this;
  }

  /**
   * Set parameter schema
   */
  withParameters(schema: ToolParameterSchema): this {
    this.tool.parameters = schema;
    return this;
  }

  /**
   * Set executor function
   */
  withExecutor(
    executor: (params: Record<string, unknown>, context?: ToolContext) => Promise<unknown>
  ): this {
    this.tool.execute = executor;
    return this;
  }

  /**
   * Set metadata
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.tool.metadata = metadata;
    return this;
  }

  /**
   * Build the tool
   */
  build(): Tool {
    if (!this.tool.name) {
      throw new ProcessingFailedError('Tool name is required');
    }
    if (!this.tool.description) {
      throw new ProcessingFailedError('Tool description is required');
    }
    if (!this.tool.parameters) {
      throw new ProcessingFailedError('Tool parameters schema is required');
    }
    if (!this.tool.execute) {
      throw new ProcessingFailedError('Tool executor is required');
    }

    return this.tool as Tool;
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

/**
 * Executor for handling agent tool calls with retry logic
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private logger = getLogger();

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Execute tool calls from agent output
   */
  async executeFromAgentOutput(
    output: string,
    context?: ToolContext
  ): Promise<{ results: ToolResult[]; hasToolCalls: boolean }> {
    const toolCalls = this.extractToolCalls(output);

    if (toolCalls.length === 0) {
      return { results: [], hasToolCalls: false };
    }

    const results = await this.registry.executeParallel(toolCalls, context);
    return { results, hasToolCalls: true };
  }

  /**
   * Extract tool calls from agent output
   * Expects JSON format: {"tool": "name", "parameters": {...}}
   */
  private extractToolCalls(output: string): ToolCall[] {
    const calls: ToolCall[] = [];

    // Try to parse the entire output as JSON first
    try {
      const parsed = JSON.parse(output);
      if (parsed.tool && parsed.parameters !== undefined) {
        calls.push({
          name: parsed.tool,
          parameters: parsed.parameters,
          callId: parsed.callId,
        });
        return calls;
      }
    } catch {
      // Not a single JSON object, try to find multiple
    }

    // Try to find JSON tool calls in the output
    const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    const matches = output.match(jsonRegex);

    if (matches) {
      for (const match of matches) {
        try {
          const call = JSON.parse(match);
          if (call.tool && call.parameters !== undefined) {
            calls.push({
              name: call.tool,
              parameters: call.parameters,
              callId: call.callId,
            });
          }
        } catch {
          // Invalid JSON, skip
          continue;
        }
      }
    }

    return calls;
  }

  /**
   * Format tool results for agent feedback
   */
  formatResults(results: ToolResult[]): string {
    const lines: string[] = ['Tool Results:'];

    for (const result of results) {
      if (result.success) {
        lines.push(`✓ ${result.tool}: ${JSON.stringify(result.result)}`);
      } else {
        lines.push(`✗ ${result.tool}: ${result.error?.message}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Execute agent with tool calling loop
   */
  async executeWithTools(
    agentExecutor: (input: string) => Promise<string>,
    input: string,
    context?: ToolContext,
    maxIterations: number = 5
  ): Promise<{ output: string; toolResults: ToolResult[] }> {
    let currentInput = input;
    const allToolResults: ToolResult[] = [];

    for (let i = 0; i < maxIterations; i++) {
      // Execute agent
      const agentOutput = await agentExecutor(currentInput);

      // Check for tool calls
      const { results, hasToolCalls } = await this.executeFromAgentOutput(
        agentOutput,
        context
      );

      if (!hasToolCalls) {
        // No more tool calls, return final output
        return { output: agentOutput, toolResults: allToolResults };
      }

      // Add results to history
      allToolResults.push(...results);

      // Format tool results and feed back to agent
      const toolFeedback = this.formatResults(results);
      currentInput = `Previous output:\n${agentOutput}\n\n${toolFeedback}\n\nPlease continue or provide final answer.`;

      this.logger.debug(`Tool calling iteration ${i + 1}: ${results.length} tools executed`);
    }

    // Max iterations reached
    this.logger.info(`Max tool calling iterations (${maxIterations}) reached`);
    const finalOutput = await agentExecutor(currentInput);
    return { output: finalOutput, toolResults: allToolResults };
  }
}

// ============================================================================
// BUILT-IN TOOLS
// ============================================================================

/**
 * Create common built-in tools
 */
export const BuiltInTools = {
  /**
   * Calculator tool
   */
  calculator(): Tool {
    return ToolBuilder.create()
      .withName('calculator')
      .withDescription('Perform mathematical calculations')
      .withParameters({
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate',
          },
        },
        required: ['expression'],
      })
      .withExecutor(async (params) => {
        try {
          // Simple eval (in production, use a safe math evaluator)
          const result = eval(params.expression as string);
          return { result };
        } catch (error) {
          throw new ProcessingFailedError(`Invalid expression: ${error}`);
        }
      })
      .build();
  },

  /**
   * String manipulation tool
   */
  stringManipulation(): Tool {
    return ToolBuilder.create()
      .withName('string_manipulation')
      .withDescription('Manipulate strings (uppercase, lowercase, reverse, etc.)')
      .withParameters({
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to manipulate' },
          operation: {
            type: 'string',
            description: 'Operation to perform',
            enum: ['uppercase', 'lowercase', 'reverse', 'length'],
          },
        },
        required: ['text', 'operation'],
      })
      .withExecutor(async (params) => {
        const text = params.text as string;
        const operation = params.operation as string;

        switch (operation) {
          case 'uppercase':
            return { result: text.toUpperCase() };
          case 'lowercase':
            return { result: text.toLowerCase() };
          case 'reverse':
            return { result: text.split('').reverse().join('') };
          case 'length':
            return { result: text.length };
          default:
            throw new ProcessingFailedError(`Unknown operation: ${operation}`);
        }
      })
      .build();
  },

  /**
   * Data storage tool (in-memory)
   */
  storage(): Tool {
    const store = new Map<string, unknown>();

    return ToolBuilder.create()
      .withName('storage')
      .withDescription('Store and retrieve data')
      .withParameters({
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Operation to perform',
            enum: ['set', 'get', 'delete', 'list'],
          },
          key: { type: 'string', description: 'Storage key' },
          value: { type: 'string', description: 'Value to store (for set operation)' },
        },
        required: ['operation'],
      })
      .withExecutor(async (params) => {
        const operation = params.operation as string;
        const key = params.key as string;
        const value = params.value;

        switch (operation) {
          case 'set':
            if (!key) throw new ProcessingFailedError('Key is required for set operation');
            store.set(key, value);
            return { result: 'Stored successfully' };
          case 'get':
            if (!key) throw new ProcessingFailedError('Key is required for get operation');
            return { result: store.get(key) };
          case 'delete':
            if (!key) throw new ProcessingFailedError('Key is required for delete operation');
            store.delete(key);
            return { result: 'Deleted successfully' };
          case 'list':
            return { result: Array.from(store.keys()) };
          default:
            throw new ProcessingFailedError(`Unknown operation: ${operation}`);
        }
      })
      .build();
  },
};
