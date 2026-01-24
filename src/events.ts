/**
 * @fileoverview Event System for SocietyAI
 *
 * This module provides a typed event emitter system for lifecycle events,
 * progress tracking, debugging, and integration with external systems.
 *
 * Features:
 * - Strongly typed events
 * - Async event handlers
 * - Event filtering and transformation
 * - Event history and replay
 * - Progress tracking
 * - Debug hooks
 *
 * Design principles:
 * - Type-safe: Full TypeScript support for event types
 * - Zero runtime deps: Pure TypeScript implementation
 * - Extensible: Easy to add custom events
 * - Non-blocking: Async handlers don't block execution
 *
 * @example
 * ```typescript
 * const emitter = new SocietyEventEmitter();
 *
 * emitter.on('agent:start', (event) => {
 *   console.log(`Agent ${event.agentId} started`);
 * });
 *
 * emitter.on('workflow:complete', async (event) => {
 *   await saveResults(event.result);
 * });
 *
 * // With progress tracking
 * emitter.on('progress', (event) => {
 *   updateProgressBar(event.percent);
 * });
 * ```
 */

import { StepResult, WorkflowResult, SocietyObserver } from './types';

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Base event interface
 */
export interface BaseEvent {
  /** Event type identifier */
  type: string;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Optional correlation ID for tracing */
  correlationId?: string;
}

/**
 * Workflow lifecycle events
 */
export interface WorkflowStartEvent extends BaseEvent {
  type: 'workflow:start';
  workflowId: string;
  workflowName: string;
  input: string;
  agentCount: number;
}

export interface WorkflowCompleteEvent extends BaseEvent {
  type: 'workflow:complete';
  workflowId: string;
  workflowName: string;
  result: WorkflowResult;
  duration: number;
}

export interface WorkflowErrorEvent extends BaseEvent {
  type: 'workflow:error';
  workflowId: string;
  workflowName: string;
  error: Error;
}

/**
 * Step lifecycle events
 */
export interface StepStartEvent extends BaseEvent {
  type: 'step:start';
  stepId: string;
  stepName: string;
  agentIds: string[];
  executionType: string;
}

export interface StepCompleteEvent extends BaseEvent {
  type: 'step:complete';
  stepId: string;
  stepName: string;
  results: StepResult[];
  duration: number;
}

export interface StepErrorEvent extends BaseEvent {
  type: 'step:error';
  stepId: string;
  stepName: string;
  error: Error;
}

export interface StepSkippedEvent extends BaseEvent {
  type: 'step:skipped';
  stepId: string;
  stepName: string;
  reason: string;
}

/**
 * Agent lifecycle events
 */
export interface AgentStartEvent extends BaseEvent {
  type: 'agent:start';
  agentId: string;
  agentName?: string;
  modelName: string;
  prompt: unknown;
}

export interface AgentCompleteEvent extends BaseEvent {
  type: 'agent:complete';
  agentId: string;
  agentName?: string;
  modelName: string;
  result: string;
  duration: number;
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error';
  agentId: string;
  agentName?: string;
  modelName: string;
  error: Error;
}

export interface AgentRetryEvent extends BaseEvent {
  type: 'agent:retry';
  agentId: string;
  agentName?: string;
  attempt: number;
  maxAttempts: number;
  error: Error;
}

/**
 * Progress events
 */
export interface ProgressEvent extends BaseEvent {
  type: 'progress';
  /** Current progress (0-100) */
  percent: number;
  /** Current step/phase description */
  phase: string;
  /** Estimated time remaining in ms (optional) */
  estimatedTimeRemaining?: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Message events (for agent communication)
 */
export interface MessageSentEvent extends BaseEvent {
  type: 'message:sent';
  from: string;
  to: string | 'broadcast';
  messageType: string;
  content: string;
}

export interface MessageReceivedEvent extends BaseEvent {
  type: 'message:received';
  from: string;
  to: string;
  messageType: string;
  content: string;
}

/**
 * Debug events
 */
export interface DebugEvent extends BaseEvent {
  type: 'debug';
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

/**
 * Custom event for extensibility
 */
export interface CustomEvent extends BaseEvent {
  type: 'custom';
  name: string;
  data: unknown;
}

/**
 * All society events
 */
export type SocietyEvent =
  | WorkflowStartEvent
  | WorkflowCompleteEvent
  | WorkflowErrorEvent
  | StepStartEvent
  | StepCompleteEvent
  | StepErrorEvent
  | StepSkippedEvent
  | AgentStartEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | AgentRetryEvent
  | ProgressEvent
  | MessageSentEvent
  | MessageReceivedEvent
  | DebugEvent
  | CustomEvent;

/**
 * Event type to event map for type safety
 */
export interface SocietyEventMap {
  'workflow:start': WorkflowStartEvent;
  'workflow:complete': WorkflowCompleteEvent;
  'workflow:error': WorkflowErrorEvent;
  'step:start': StepStartEvent;
  'step:complete': StepCompleteEvent;
  'step:error': StepErrorEvent;
  'step:skipped': StepSkippedEvent;
  'agent:start': AgentStartEvent;
  'agent:complete': AgentCompleteEvent;
  'agent:error': AgentErrorEvent;
  'agent:retry': AgentRetryEvent;
  'progress': ProgressEvent;
  'message:sent': MessageSentEvent;
  'message:received': MessageReceivedEvent;
  'debug': DebugEvent;
  'custom': CustomEvent;
  '*': SocietyEvent; // Wildcard for all events
}

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Event handler function type
 */
export type EventHandler<T extends SocietyEvent> = (event: T) => void | Promise<void>;

/**
 * Event filter function
 */
export type EventFilter<T extends SocietyEvent> = (event: T) => boolean;

/**
 * Event transformer function
 */
export type EventTransformer<T extends SocietyEvent, R extends SocietyEvent> = (event: T) => R;

// ============================================================================
// EVENT EMITTER
// ============================================================================

/**
 * Typed event emitter for SocietyAI events
 */
export class SocietyEventEmitter {
  private handlers = new Map<string, Set<EventHandler<SocietyEvent>>>();
  private history: SocietyEvent[] = [];
  private historyEnabled = false;
  private maxHistorySize = 1000;
  private correlationId?: string;

  /**
   * Enable event history
   */
  enableHistory(maxSize: number = 1000): this {
    this.historyEnabled = true;
    this.maxHistorySize = maxSize;
    return this;
  }

  /**
   * Disable event history
   */
  disableHistory(): this {
    this.historyEnabled = false;
    return this;
  }

  /**
   * Set correlation ID for all events
   */
  setCorrelationId(id: string): this {
    this.correlationId = id;
    return this;
  }

  /**
   * Subscribe to an event type
   */
  on<K extends keyof SocietyEventMap>(
    type: K,
    handler: EventHandler<SocietyEventMap[K]>
  ): () => void {
    const handlers = this.handlers.get(type) ?? new Set();
    handlers.add(handler as EventHandler<SocietyEvent>);
    this.handlers.set(type, handlers);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as EventHandler<SocietyEvent>);
    };
  }

  /**
   * Subscribe to an event type once
   */
  once<K extends keyof SocietyEventMap>(
    type: K,
    handler: EventHandler<SocietyEventMap[K]>
  ): () => void {
    const wrappedHandler = (event: SocietyEventMap[K]): void => {
      unsubscribe();
      handler(event);
    };
    const unsubscribe = this.on(type, wrappedHandler);
    return unsubscribe;
  }

  /**
   * Subscribe to multiple event types
   */
  onMany<K extends keyof SocietyEventMap>(
    types: K[],
    handler: EventHandler<SocietyEventMap[K]>
  ): () => void {
    const unsubscribes = types.map((type) => this.on(type, handler));
    return () => unsubscribes.forEach((unsub) => unsub());
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: EventHandler<SocietyEvent>): () => void {
    return this.on('*', handler);
  }

  /**
   * Unsubscribe from an event type
   */
  off<K extends keyof SocietyEventMap>(
    type: K,
    handler: EventHandler<SocietyEventMap[K]>
  ): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler as EventHandler<SocietyEvent>);
    }
  }

  /**
   * Remove all handlers for an event type
   */
  removeAllListeners(type?: keyof SocietyEventMap): void {
    if (type) {
      this.handlers.delete(type);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Emit an event
   */
  emit<K extends keyof SocietyEventMap>(
    type: K,
    event: Omit<SocietyEventMap[K], 'type' | 'timestamp' | 'correlationId'>
  ): void {
    const fullEvent = {
      ...event,
      type,
      timestamp: Date.now(),
      correlationId: this.correlationId,
    } as SocietyEventMap[K];

    // Store in history if enabled
    if (this.historyEnabled) {
      this.history.push(fullEvent);
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }
    }

    // Notify specific handlers
    const handlers = this.handlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        this.safeCall(handler, fullEvent);
      }
    }

    // Notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        this.safeCall(handler, fullEvent);
      }
    }
  }

  /**
   * Emit a custom event
   */
  emitCustom(name: string, data: unknown): void {
    this.emit('custom', { name, data });
  }

  /**
   * Get event history
   */
  getHistory(filter?: EventFilter<SocietyEvent>): SocietyEvent[] {
    if (filter) {
      return this.history.filter(filter);
    }
    return [...this.history];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Wait for an event
   */
  waitFor<K extends keyof SocietyEventMap>(
    type: K,
    timeout?: number
  ): Promise<SocietyEventMap[K]> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.once(type, (event) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(event);
      });

      let timeoutId: NodeJS.Timeout | undefined;
      if (timeout) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${type}`));
        }, timeout);
      }
    });
  }

  /**
   * Create a filtered emitter that only handles certain events
   */
  filter(predicate: EventFilter<SocietyEvent>): FilteredEventEmitter {
    return new FilteredEventEmitter(this, predicate);
  }

  /**
   * Create a SocietyObserver that emits events
   */
  toObserver(): SocietyObserver {
    return new EventEmitterObserver(this);
  }

  /**
   * Get listener count for an event type
   */
  listenerCount(type: keyof SocietyEventMap): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  private safeCall(handler: EventHandler<SocietyEvent>, event: SocietyEvent): void {
    try {
      const result = handler(event);
      if (result instanceof Promise) {
        result.catch((error) => {
          console.error('Error in event handler:', error);
        });
      }
    } catch (error) {
      console.error('Error in event handler:', error);
    }
  }
}

// ============================================================================
// FILTERED EVENT EMITTER
// ============================================================================

/**
 * Event emitter with filtering
 */
export class FilteredEventEmitter {
  constructor(
    private source: SocietyEventEmitter,
    private predicate: EventFilter<SocietyEvent>
  ) {}

  /**
   * Subscribe to filtered events
   */
  on<K extends keyof SocietyEventMap>(
    type: K,
    handler: EventHandler<SocietyEventMap[K]>
  ): () => void {
    return this.source.on(type, (event) => {
      if (this.predicate(event)) {
        handler(event);
      }
    });
  }

  /**
   * Subscribe to all filtered events
   */
  onAll(handler: EventHandler<SocietyEvent>): () => void {
    return this.source.onAll((event) => {
      if (this.predicate(event)) {
        handler(event);
      }
    });
  }
}

// ============================================================================
// SOCIETY OBSERVER ADAPTER
// ============================================================================

/**
 * Adapter that converts event emitter to SocietyObserver
 */
class EventEmitterObserver implements SocietyObserver {
  constructor(private emitter: SocietyEventEmitter) {}

  onAgentStart(agentId: number, modelName: string, prompt: unknown): void {
    this.emitter.emit('agent:start', {
      agentId: String(agentId),
      modelName,
      prompt,
    });
  }

  onAgentComplete(agentId: number, modelName: string, result: string): void {
    this.emitter.emit('agent:complete', {
      agentId: String(agentId),
      modelName,
      result,
      duration: 0, // Duration would need to be tracked separately
    });
  }

  onAgentError(agentId: number, modelName: string, error: Error): void {
    this.emitter.emit('agent:error', {
      agentId: String(agentId),
      modelName,
      error,
    });
  }

  onPhaseStart(phase: string): void {
    this.emitter.emit('step:start', {
      stepId: phase,
      stepName: phase,
      agentIds: [],
      executionType: 'unknown',
    });
  }

  onPhaseComplete(phase: string): void {
    this.emitter.emit('step:complete', {
      stepId: phase,
      stepName: phase,
      results: [],
      duration: 0,
    });
  }

  onSocietyStart(prompt: string, agentCount: number): void {
    this.emitter.emit('workflow:start', {
      workflowId: 'society',
      workflowName: 'Society',
      input: prompt,
      agentCount,
    });
  }

  onSocietyComplete(finalResult: string): void {
    this.emitter.emit('workflow:complete', {
      workflowId: 'society',
      workflowName: 'Society',
      result: {
        success: true,
        output: finalResult,
        stepResults: new Map(),
        messages: [],
        duration: 0,
      },
      duration: 0,
    });
  }
}

// ============================================================================
// PROGRESS TRACKER
// ============================================================================

/**
 * Progress tracker that emits progress events
 */
export class ProgressTracker {
  private currentPhase = '';
  private totalSteps = 0;
  private completedSteps = 0;
  private startTime = 0;

  constructor(private emitter: SocietyEventEmitter) {}

  /**
   * Start tracking
   */
  start(totalSteps: number): void {
    this.totalSteps = totalSteps;
    this.completedSteps = 0;
    this.startTime = Date.now();
    this.emit();
  }

  /**
   * Set current phase
   */
  setPhase(phase: string): void {
    this.currentPhase = phase;
    this.emit();
  }

  /**
   * Increment progress
   */
  increment(steps: number = 1): void {
    this.completedSteps = Math.min(this.completedSteps + steps, this.totalSteps);
    this.emit();
  }

  /**
   * Set progress directly
   */
  setProgress(completed: number): void {
    this.completedSteps = Math.min(completed, this.totalSteps);
    this.emit();
  }

  /**
   * Complete tracking
   */
  complete(): void {
    this.completedSteps = this.totalSteps;
    this.emit();
  }

  /**
   * Get current percent
   */
  getPercent(): number {
    if (this.totalSteps === 0) return 0;
    return Math.round((this.completedSteps / this.totalSteps) * 100);
  }

  private emit(): void {
    const elapsed = Date.now() - this.startTime;
    const percent = this.getPercent();
    
    let estimatedTimeRemaining: number | undefined;
    if (percent > 0 && percent < 100) {
      const avgTimePerPercent = elapsed / percent;
      estimatedTimeRemaining = avgTimePerPercent * (100 - percent);
    }

    this.emitter.emit('progress', {
      percent,
      phase: this.currentPhase,
      estimatedTimeRemaining,
      details: {
        completedSteps: this.completedSteps,
        totalSteps: this.totalSteps,
        elapsed,
      },
    });
  }
}

// ============================================================================
// EVENT LOGGER
// ============================================================================

/**
 * Log events to console or custom logger
 */
export class EventLogger {
  private unsubscribe?: () => void;

  constructor(
    private emitter: SocietyEventEmitter,
    private logger: Pick<Console, 'log' | 'error' | 'warn' | 'info'> = console
  ) {}

  /**
   * Start logging all events
   */
  start(filter?: (event: SocietyEvent) => boolean): this {
    this.unsubscribe = this.emitter.onAll((event) => {
      if (filter && !filter(event)) return;
      this.logEvent(event);
    });
    return this;
  }

  /**
   * Stop logging
   */
  stop(): this {
    this.unsubscribe?.();
    return this;
  }

  private logEvent(event: SocietyEvent): void {
    const timestamp = new Date(event.timestamp).toISOString();
    const prefix = `[${timestamp}] [${event.type}]`;

    switch (event.type) {
      case 'workflow:start':
        this.logger.info(`${prefix} Workflow "${event.workflowName}" started with ${event.agentCount} agents`);
        break;
      case 'workflow:complete':
        this.logger.info(`${prefix} Workflow completed in ${event.duration}ms`);
        break;
      case 'workflow:error':
        this.logger.error(`${prefix} Workflow error:`, event.error.message);
        break;
      case 'step:start':
        this.logger.info(`${prefix} Step "${event.stepName}" started (${event.executionType})`);
        break;
      case 'step:complete':
        this.logger.info(`${prefix} Step "${event.stepName}" completed with ${event.results.length} results`);
        break;
      case 'step:error':
        this.logger.error(`${prefix} Step "${event.stepName}" error:`, event.error.message);
        break;
      case 'agent:start':
        this.logger.info(`${prefix} Agent ${event.agentId} started (${event.modelName})`);
        break;
      case 'agent:complete':
        this.logger.info(`${prefix} Agent ${event.agentId} completed in ${event.duration}ms`);
        break;
      case 'agent:error':
        this.logger.error(`${prefix} Agent ${event.agentId} error:`, event.error.message);
        break;
      case 'progress':
        this.logger.info(`${prefix} Progress: ${event.percent}% - ${event.phase}`);
        break;
      case 'debug':
        this.logger[event.level === 'error' ? 'error' : event.level === 'warn' ? 'warn' : 'log'](
          `${prefix} ${event.message}`,
          event.data
        );
        break;
      default:
        this.logger.log(`${prefix}`, event);
    }
  }
}

// ============================================================================
// EVENT AGGREGATOR
// ============================================================================

/**
 * Aggregate and summarize events
 */
export class EventAggregator {
  private events: SocietyEvent[] = [];

  constructor(emitter?: SocietyEventEmitter) {
    if (emitter) {
      emitter.onAll((event) => {
        this.events.push(event);
      });
    }
  }

  /**
   * Add an event
   */
  add(event: SocietyEvent): void {
    this.events.push(event);
  }

  /**
   * Get summary statistics
   */
  getSummary(): EventSummary {
    const workflowEvents = this.events.filter((e) => e.type.startsWith('workflow:'));
    const stepEvents = this.events.filter((e) => e.type.startsWith('step:'));
    const agentEvents = this.events.filter((e) => e.type.startsWith('agent:'));

    const agentDurations = this.events
      .filter((e): e is AgentCompleteEvent => e.type === 'agent:complete')
      .map((e) => e.duration);

    const errors = this.events.filter(
      (e): e is WorkflowErrorEvent | StepErrorEvent | AgentErrorEvent =>
        e.type.endsWith(':error')
    );

    return {
      totalEvents: this.events.length,
      workflowCount: workflowEvents.length,
      stepCount: stepEvents.length,
      agentCount: agentEvents.length,
      errorCount: errors.length,
      avgAgentDuration: agentDurations.length > 0
        ? agentDurations.reduce((a, b) => a + b, 0) / agentDurations.length
        : 0,
      minAgentDuration: agentDurations.length > 0 ? Math.min(...agentDurations) : 0,
      maxAgentDuration: agentDurations.length > 0 ? Math.max(...agentDurations) : 0,
      errors: errors.map((e) => ({ type: e.type, message: e.error.message })),
    };
  }

  /**
   * Get events by type
   */
  getByType<K extends keyof SocietyEventMap>(type: K): SocietyEventMap[K][] {
    return this.events.filter((e) => e.type === type) as SocietyEventMap[K][];
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }
}

/**
 * Event summary statistics
 */
export interface EventSummary {
  totalEvents: number;
  workflowCount: number;
  stepCount: number;
  agentCount: number;
  errorCount: number;
  avgAgentDuration: number;
  minAgentDuration: number;
  maxAgentDuration: number;
  errors: Array<{ type: string; message: string }>;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Create a new event emitter
 */
export function createEventEmitter(): SocietyEventEmitter {
  return new SocietyEventEmitter();
}

/**
 * Create a progress tracker
 */
export function createProgressTracker(emitter: SocietyEventEmitter): ProgressTracker {
  return new ProgressTracker(emitter);
}

/**
 * Create an event logger
 */
export function createEventLogger(
  emitter: SocietyEventEmitter,
  logger?: Pick<Console, 'log' | 'error' | 'warn' | 'info'>
): EventLogger {
  return new EventLogger(emitter, logger);
}
