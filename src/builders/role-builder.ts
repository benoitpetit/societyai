/**
 * @fileoverview Role Builder for SocietyAI
 *
 * Provides fluent builder API for creating agent roles
 */

import { Role } from '../core/types';
import { InvalidConfigurationError } from '../core/errors';

// ============================================================================
// FLUENT ROLE BUILDER
// ============================================================================

/**
 * Fluent builder for creating agent roles
 * Roles define the behavior and capabilities of an agent
 */
export class FluentRoleBuilder {
  private _id: string = '';
  private _name: string = '';
  private _description?: string;
  private _systemPrompt: string = '';
  private _capabilities: string[] = [];
  private _constraints: string[] = [];
  private _promptTemplate?: string;

  /**
   * Create a new instance of FluentRoleBuilder
   */
  static create(): FluentRoleBuilder {
    return new FluentRoleBuilder();
  }

  /**
   * Set the unique identifier for this role
   */
  withId(id: string): this {
    this._id = id;
    if (!this._name) this._name = id;
    return this;
  }

  /**
   * Set the display name for this role
   */
  withName(name: string): this {
    this._name = name;
    return this;
  }

  /**
   * Set the description explaining what this role does
   */
  withDescription(description: string): this {
    this._description = description;
    return this;
  }

  /**
   * Set the system prompt that defines the role's behavior
   * This is the primary instruction set for the AI model
   */
  withSystemPrompt(prompt: string): this {
    this._systemPrompt = prompt;
    return this;
  }

  /**
   * Define the capabilities this role has
   * Capabilities are used for routing and constraint checking
   */
  withCapabilities(capabilities: string[]): this {
    this._capabilities = capabilities;
    return this;
  }

  /**
   * Add a single capability to this role
   */
  addCapability(capability: string): this {
    this._capabilities.push(capability);
    return this;
  }

  /**
   * Define constraints/limitations for this role
   */
  withConstraints(constraints: string[]): this {
    this._constraints = constraints;
    return this;
  }

  /**
   * Add a single constraint to this role
   */
  addConstraint(constraint: string): this {
    this._constraints.push(constraint);
    return this;
  }

  /**
   * Set a custom prompt template for this role
   * Available placeholders: {systemPrompt}, {input}, {context}, {history}, {capabilities}, {constraints}
   */
  withPromptTemplate(template: string): this {
    this._promptTemplate = template;
    return this;
  }

  /**
   * Build the role configuration
   */
  build(): Role {
    // Auto-generate ID if not set
    if (!this._id) {
      this._id = `role-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    if (!this._name) this._name = this._id;
    if (!this._systemPrompt) throw new InvalidConfigurationError('Role systemPrompt is required');

    return {
      id: this._id,
      name: this._name,
      description: this._description,
      systemPrompt: this._systemPrompt,
      capabilities: this._capabilities.length > 0 ? this._capabilities : undefined,
      constraints: this._constraints.length > 0 ? this._constraints : undefined,
      promptTemplate: this._promptTemplate,
    };
  }
}
