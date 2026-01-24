/**
 * @fileoverview SocietyAI - Model-Agnostic Multi-Agent Orchestration Framework
 *
 * SocietyAI is a TypeScript library for creating collaborative AI agent societies.
 * It provides a model-agnostic, domain-independent framework with zero runtime dependencies.
 *
 * Key Features:
 * - Fluent Builder API for configuring agents, roles, and workflows
 * - Composable Pipeline Patterns (chain, scatter-gather, router, etc.)
 * - Middleware System for cross-cutting concerns
 * - Pluggable Aggregation Strategies
 * - Type-safe Context Injection
 * - Event System for monitoring and debugging
 *
 * @example
 * ```typescript
 * import { Society, createRole, Strategies, Pipelines } from '@societyai/core';
 *
 * // Create a simple society
 * const result = await Society.create()
 *   .withName('Analysis Team')
 *   .addAgent(a => a
 *     .withId('analyst')
 *     .withRole(r => r
 *       .withSystemPrompt('You are a data analyst'))
 *     .withModel(myModel))
 *   .scatterGather(Strategies.consensus(0.7).aggregate)
 *   .execute('Analyze this data');
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// CORE TYPES AND INTERFACES
// ============================================================================

export * from './types';
export * from './config';

// ============================================================================
// ERROR HANDLING
// ============================================================================

export * from './errors';

// ============================================================================
// LOGGING
// ============================================================================

export * from './logger';

// ============================================================================
// RETRY MECHANISM
// ============================================================================

export * from './retry';

// ============================================================================
// WORKER POOL (Parallel Execution)
// ============================================================================

export * from './worker-pool';

// ============================================================================
// MODEL ADAPTERS
// ============================================================================

export * from './models';

// ============================================================================
// CORE SOCIETY (Main Logic)
// ============================================================================

// Export ciblé: on expose le système de workflow, sans ré-exporter les helpers legacy.
export {
  MessageBus,
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
} from './society';

// ============================================================================
// FLUENT BUILDER API
// ============================================================================

export {
  // Main builder
  Society,
  SocietyPatterns,
  AggregationStrategies,
  // Fluent builders
  FluentRoleBuilder,
  FluentAgentBuilder,
  FluentStepBuilder,
  FluentPipelineBuilder,
  // Quick helpers
  createRole,
  createAgent,
} from './builder';

// Note: les primitives workflow/builder issues de society.ts sont ré-exportées explicitement.
// Cela évite d’exposer l’API legacy via un `export *`.

// Builder types
export type { PipelineConfig, PipelinePattern } from './builder';

// ============================================================================
// MIDDLEWARE SYSTEM
// ============================================================================

export {
  // Middleware chain
  MiddlewareChain,
  ComposedMiddleware,
  MiddlewareWrappedModel,
  // Built-in middlewares
  Middlewares,
  // Step middlewares
  StepMiddlewares,
  // Metrics
  InMemoryMetricsCollector,
} from './middleware';

// Middleware types
export type {
  Middleware,
  MiddlewareFn,
  MiddlewareContext,
  MiddlewareResult,
  NextFunction,
  MetricsCollector,
  StepMiddleware,
  StepMiddlewareFn,
  StepMiddlewareContext,
} from './middleware';

// ============================================================================
// AGGREGATION STRATEGIES
// ============================================================================

export {
  // Strategy builder
  StrategyBuilder,
  // Built-in strategies
  Strategies,
  // Utilities
  createStrategy,
  chainStrategies,
  parallelStrategies,
} from './strategies';

// Strategy types
export type {
  AggregationStrategy,
  AggregationResult,
  StrategyFactory,
} from './strategies';

// ============================================================================
// PIPELINE PATTERNS
// ============================================================================

export {
  // Pipeline builder
  PipelineBuilder as PipelinePatternBuilder,
  // Pre-built pipelines
  Pipelines,
  // Pipeline composition
  composePipelines,
  parallelPipelines,
} from './pipeline';

// Pipeline types
export type {
  Pipeline,
  PipelineContext,
  PipelineResult,
  PipelineStep,
} from './pipeline';

// ============================================================================
// CONTEXT SYSTEM
// ============================================================================

export {
  // Context tokens
  createContextToken,
  isContextToken,
  // Context provider
  ContextProvider,
  ContextProviderBuilder,
  // Context scope
  ContextScope,
  // Common contexts
  CommonContexts,
  // Context utilities
  ContextStore,
  ContextMap,
  selectContext,
  fromObject,
  toObject,
  mergeContexts,
  // Agent context injection
  AgentContextInjector,
  ContextAwarePromptBuilder,
} from './context';

// Context types
export type {
  ContextToken,
  IContextProvider,
  IMutableContextProvider,
} from './context';

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export {
  // Event emitter
  SocietyEventEmitter,
  FilteredEventEmitter,
  // Progress tracking
  ProgressTracker,
  // Event logging
  EventLogger,
  // Event aggregation
  EventAggregator,
  // Factory functions
  createEventEmitter,
  createProgressTracker,
  createEventLogger,
} from './events';

// Event types
export type {
  // Base event
  BaseEvent,
  SocietyEvent,
  SocietyEventMap,
  // Workflow events
  WorkflowStartEvent,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  // Step events
  StepStartEvent,
  StepCompleteEvent,
  StepErrorEvent,
  StepSkippedEvent,
  // Agent events
  AgentStartEvent,
  AgentCompleteEvent,
  AgentErrorEvent,
  AgentRetryEvent,
  // Other events
  ProgressEvent,
  MessageSentEvent,
  MessageReceivedEvent,
  DebugEvent,
  CustomEvent,
  // Handler types
  EventHandler,
  EventFilter,
  EventTransformer,
  // Summary
  EventSummary,
} from './events';
