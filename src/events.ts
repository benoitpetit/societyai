/**
 * @fileoverview Event System API
 *
 * Event system for monitoring and debugging agent societies.
 *
 * @example
 * ```typescript
 * import { SocietyEventEmitter, ProgressTracker } from 'societyai/events';
 *
 * const emitter = new SocietyEventEmitter();
 * const tracker = new ProgressTracker(emitter);
 *
 * emitter.on('workflow:complete', (event) => {
 *   console.log('Workflow completed:', event.output);
 * });
 *
 * tracker.onProgress((progress) => {
 *   console.log(`Progress: ${progress.percentage}%`);
 * });
 * ```
 */

// Event Emitter
export {
  SocietyEventEmitter,
  FilteredEventEmitter,
  createEventEmitter,
} from './observability/events';

// Progress Tracking
export { ProgressTracker, createProgressTracker } from './observability/events';

// Event Logging
export { EventLogger, createEventLogger } from './observability/events';

// Event Aggregation
export { EventAggregator } from './observability/events';

// Event Types
export type {
  BaseEvent,
  SocietyEvent,
  SocietyEventMap,
  WorkflowStartEvent,
  WorkflowCompleteEvent,
  WorkflowErrorEvent,
  StepStartEvent,
  StepCompleteEvent,
  StepErrorEvent,
  StepSkippedEvent,
  AgentStartEvent,
  AgentCompleteEvent,
  AgentErrorEvent,
  AgentRetryEvent,
  ProgressEvent,
  MessageSentEvent,
  MessageReceivedEvent,
  DebugEvent,
  CustomEvent,
  EventHandler,
  EventFilter,
  EventTransformer,
  EventSummary,
} from './observability/events';
