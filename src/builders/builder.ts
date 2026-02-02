/**
 * @fileoverview Builder API for SocietyAI - Main Entry Point
 *
 * Re-exports all builder components for backward compatibility
 */

// Role Builder
export { FluentRoleBuilder } from './role-builder';

// Agent Builder
export { FluentAgentBuilder } from './agent-builder';

// Workflow Builders (Step, Pipeline, Society)
export {
  FluentStepBuilder,
  FluentPipelineBuilder,
  Society,
  SocietyPatterns,
  AggregationStrategies,
  createRole,
  createAgent,
} from './workflow-builder';

// Types
export type { PipelineConfig, PipelinePattern } from './workflow-builder';
