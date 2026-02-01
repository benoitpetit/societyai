# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-02-01

### Initial Release

This is the initial pre-release version of SocietyAI.

### Added - Major Features (Phase 1-3)

#### 🎯 Phase 1: Unified Execution Engine

- **SocietyGraph** - Graph-based execution engine with DAG/Cyclic support
  - 8 node types: START, END, AGENT, PARALLEL, AGGREGATE, CONDITION, TRANSFORM, LOOP
  - Conditional branching and dynamic routing
  - Loop support with termination conditions
  - Parallel execution optimization via WorkerPool
  - Graph visualization for debugging
- **Streaming Support** - Added `stream()` method to AIModel interface for real-time output
- **GraphBuilder** - Fluent API for constructing complex execution graphs

#### 🛠️ Phase 2: Agent Capabilities

- **Tool Calling System** - Enable agents to interact with external functions
  - ToolRegistry for centralized tool management
  - ToolExecutor with automatic retry loop
  - JSON Schema validation for parameters
  - BuiltInTools: calculator, stringManipulation, storage
  - Parallel tool execution support
- **Multi-Level Memory System** - Intelligent context management
  - ShortTermMemory with auto-summarization and decay
  - LongTermMemory with semantic search (RAG) support
  - EntityMemory for tracking entities and facts
  - MemorySystem unified interface
  - Importance scoring and time-based decay

#### 🎯 Phase 3: Production Robustness

- **Structured Output Validation** - Ensure AI outputs conform to schemas
  - JSON Schema validation with automatic retry
  - Error feedback loop for self-correction
  - Support for complex nested objects, arrays, patterns
  - Helper functions: validateJSON(), createSchema()
- **Comprehensive Metrics & Observability** - Track performance and costs
  - MetricsTracker for workflow execution tracking
  - TokenCounter with estimation (~4 chars/token)
  - Cost calculation for major models (GPT-4, Claude, etc.)
  - PerformanceProfiler with mark/measure API
  - OpenTelemetry export format support
  - Custom metrics support

### Added - Examples & Documentation

- 📚 6 comprehensive examples demonstrating all new features:
  - graph-workflow.ts - Complex workflows with conditional logic
  - tool-calling.ts - Agent function calling
  - memory-system.ts - Multi-level context management
  - structured-output.ts - Output validation with retry
  - metrics-tracking.ts - Performance and cost tracking
  - complete-integration.ts - Full integration example
- 📖 examples/README.md with setup instructions and troubleshooting

### Added - Testing

- ✅ 5 new test suites with 100+ test cases:
  - graph.test.ts - Graph execution engine tests
  - tools.test.ts - Tool calling system tests
  - memory.test.ts - Memory system tests (30+ cases)
  - validation.test.ts - Validation tests (25+ cases)
  - metrics.test.ts - Metrics tracking tests (20+ cases)
- Total: 138 tests across 10 test suites

### Changed

- Updated exports in index.ts to include all new modules
- Improved tool extraction logic to handle JSON outputs correctly

## [0.0.1] - Unreleased

First public pre-release.

### Added

- 🎉 Initial release of SocietyAI – TypeScript multi-agent orchestration framework
- 🤖 Multi-agent execution patterns: sequential, parallel, collaborative, conditional
- 🧱 Workflow configuration builders: `RoleBuilder`, `AgentBuilder`, `StepBuilder`, `WorkflowConfigBuilder`
- 🏗️ Fluent Society builder (`Society.create()`) with pipeline helpers (`Pipelines`, `Strategies`)
- 🔌 Model abstraction via `StandardModelBase` and adapter-style integrations
- ⚡ Worker pool for parallel execution
- 🔄 Retry with exponential backoff and jitter (`RetryExecutor`)
- ⏱️ Cancellation/timeouts via `AbortSignal`
- 📊 Logging + observer hooks for lifecycle monitoring
- 🔌 Middleware system for models and workflow steps
- 📚 Full documentation and API reference in `docs/`
- 🧪 Jest test suite (49 tests)

### Removed

- Legacy function-based API (`society()`, `societyCollaborative()`, `runSociety*()`, etc.) – use the workflow/builder API instead.

### Fixed

- Documentation language consistency
- Builder API exports (`createRole()`, `createAgent()` helpers exposed)
