/**
 * @fileoverview Builder API for SocietyAI - Main Entry Point
 *
 * Re-exports all builder components for backward compatibility
 */

// Role Builder
export { FluentRoleBuilder } from './role-builder';

// Agent Builder
export { FluentAgentBuilder } from './agent-builder';

// Workflow Builders (Task, Pipeline)
export {
  FluentTaskBuilder,
  FluentPipelineBuilder,
  AggregationStrategies,
  createRole,
  createAgent,
} from './society-builder';

// Core Society
export { Society, SocietyPatterns } from '../core/society';

// Types
export type { PipelineConfig, PipelinePattern } from './society-builder';
