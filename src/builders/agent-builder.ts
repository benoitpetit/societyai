/**
 * @fileoverview Agent Builder for SocietyAI
 *
 * Provides fluent builder API for creating agent configurations
 */

import { AIModel, Agent, Role } from '../core/types';
import { MemorySystem } from '../capabilities/memory';
import { Tool } from '../capabilities/tools';
import { InvalidConfigurationError } from '../core/errors';
import { FluentRoleBuilder } from './role-builder';

// ============================================================================
// FLUENT AGENT BUILDER
// ============================================================================

/**
 * Fluent builder for creating agent configurations
 */
export class FluentAgentBuilder {
  private _id: string = '';
  private _name?: string;
  private _role?: Role;
  private _model?: AIModel;
  private _canCommunicateWith: string[] = [];
  private _priority: number = 0;
  private _initialContext: Record<string, unknown> = {};
  private _retryConfig?: { maxRetries?: number; initialBackoff?: number };
  private _tags: string[] = [];
  private _metadata: Record<string, unknown> = {};
  private _memory?: MemorySystem;
  private _tools: Tool[] = [];

  /**
   * Create a new instance of FluentAgentBuilder
   */
  static create(): FluentAgentBuilder {
    return new FluentAgentBuilder();
  }

  /**
   * Set the unique identifier for this agent
   */
  withId(id: string): this {
    this._id = id;
    if (!this._name) this._name = id;
    return this;
  }

  /**
   * Set the display name for this agent
   */
  withName(name: string): this {
    this._name = name;
    return this;
  }

  /**
   * Set the role using a builder function, builder instance, or direct role object
   */
  withRole(
    roleOrBuilder: Role | FluentRoleBuilder | ((builder: FluentRoleBuilder) => FluentRoleBuilder)
  ): this {
    if (typeof roleOrBuilder === 'function') {
      const builder = new FluentRoleBuilder();
      this._role = roleOrBuilder(builder).build();
    } else if (roleOrBuilder instanceof FluentRoleBuilder) {
      this._role = roleOrBuilder.build();
    } else {
      this._role = roleOrBuilder;
    }
    return this;
  }

  /**
   * Set the role directly
   */
  useRole(role: Role): this {
    this._role = role;
    return this;
  }

  /**
   * Set the AI model for this agent
   */
  withModel(model: AIModel): this {
    this._model = model;
    return this;
  }

  /**
   * Define which agents this one can directly communicate with
   */
  canCommunicateWith(agentIds: string[]): this {
    this._canCommunicateWith = agentIds;
    return this;
  }

  /**
   * Set the execution priority (higher = earlier)
   */
  withPriority(priority: number): this {
    this._priority = priority;
    return this;
  }

  /**
   * Set initial context data for this agent
   */
  withInitialContext(context: Record<string, unknown>): this {
    this._initialContext = context;
    return this;
  }

  /**
   * Add a key-value pair to the initial context
   */
  addContext(key: string, value: unknown): this {
    this._initialContext[key] = value;
    return this;
  }

  /**
   * Configure retry behavior for this agent
   */
  withRetry(config: { maxRetries?: number; initialBackoff?: number }): this {
    this._retryConfig = config;
    return this;
  }

  /**
   * Add tags for filtering and grouping agents
   */
  withTags(tags: string[]): this {
    this._tags = tags;
    return this;
  }

  /**
   * Add a single tag
   */
  addTag(tag: string): this {
    this._tags.push(tag);
    return this;
  }

  /**
   * Add custom metadata
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this._metadata = metadata;
    return this;
  }

  /**
   * Attach a memory system to the agent
   */
  withMemory(memory: MemorySystem): this {
    this._memory = memory;
    return this;
  }

  /**
   * Add tools to the agent
   */
  withTools(tools: Tool[]): this {
    this._tools = tools;
    return this;
  }

  /**
   * Add a single tool
   */
  addTool(tool: Tool): this {
    this._tools.push(tool);
    return this;
  }

  /**
   * Build the agent configuration
   */
  build(): Agent & { tags?: string[]; metadata?: Record<string, unknown> } {
    if (!this._id) throw new InvalidConfigurationError('Agent id is required');
    if (!this._role) throw new InvalidConfigurationError('Agent role is required');
    if (!this._model) throw new InvalidConfigurationError('Agent model is required');

    return {
      id: this._id,
      name: this._name,
      role: this._role,
      model: this._model,
      canCommunicateWith:
        this._canCommunicateWith.length > 0 ? this._canCommunicateWith : undefined,
      priority: this._priority,
      initialContext:
        Object.keys(this._initialContext).length > 0 ? this._initialContext : undefined,
      retryConfig: this._retryConfig,
      tags: this._tags.length > 0 ? this._tags : undefined,
      metadata: Object.keys(this._metadata).length > 0 ? this._metadata : undefined,
      memory: this._memory,
      tools: this._tools.length > 0 ? this._tools : undefined,
    };
  }
}
