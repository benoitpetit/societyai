# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6]

### Added
- **Thread-Safe Parallel Execution**: Implemented Copy-on-Write mechanism with conflict detection for shared context in parallel nodes
  - Each parallel branch now receives an isolated snapshot of `sharedData`
  - Automatic merge with Last-Write-Wins strategy after parallel execution
  - Conflict detection logs warnings when multiple branches modify the same key
- **Memory Management (Retention Policy)**: Added configurable retention policies to prevent memory exhaustion in long-running executions
  - New `RetentionPolicy` interface in `SocietyConfig`
  - `maxNodeResults` to limit the number of node results kept in memory
  - `maxMessages` to limit message history size
  - Configurable overflow strategies: `discard` or `archive` to storage adapter
  - Option to preserve critical nodes (START, END, errors) even beyond limits
  - Automatic application during execution loop
- **Worker Threads Support**: Execute CPU-intensive agents in isolated worker threads
  - New `IsolatedWorkerPool` for managing worker thread execution
  - `executionMode` field in Agent interface (`'default'` | `'isolated'`)
  - `withExecutionMode()` method in FluentAgentBuilder
  - Automatic routing in ExecutionEngine based on agent execution mode
  - Prevents main event loop blocking for heavy computational tasks
- **OpenTelemetry Integration**: Built-in distributed tracing for production observability
  - `createOpenTelemetryObserver()` helper for easy setup
  - Automatic span creation for agents, tasks, and phases
  - Support for console and OTLP exporters
  - Graceful degradation if @opentelemetry/api not installed
  - Integration via `Society.withObserver()`
- **MCP (Model Context Protocol) Support**: Integrate external tools and services
  - `MCPToolProvider` for MCP tool integration
  - `MCPServers` helpers for common services (filesystem, git, brave-search, etc.)
  - Tools serialization support for worker threads
  - Integration via `FluentAgentBuilder.withTools()`
- **Comprehensive End-to-End Tests**: 21 new integration tests covering all new features

### Changed
- Updated package description to highlight production-grade reliability features
- Modified `ExecutionEngine.execute()` signature to accept `retentionPolicy` parameter
- Enhanced `executeParallelNode()` to use isolated contexts for race condition prevention
- ExecutionEngine now checks `agent.executionMode` to route execution
- Agent interface extended with optional `executionMode` field
- FluentAgentBuilder enhanced with execution mode configuration

### Fixed
- Race conditions in parallel node execution when modifying shared context
- Potential memory leaks in long-running workflows with loops
- Inconsistencies between roadmap claims and actual implemented features

### Documentation
- Updated README with Worker Threads and OpenTelemetry examples
- Enhanced documentation in /docs/4-advanced/ directory
- Added complete-integration.ts example demonstrating all new features

## [0.0.4, 0.0.5] - Previous Release

### Features
- Model-agnostic multi-agent orchestration
- DAG-based workflow execution
- Sequential, parallel, and collaborative execution modes
- Circuit breaker middleware (already implemented but not documented in roadmap)
- Memory system with short/long-term storage
- Persistence and recovery capabilities
- Human-in-the-loop support
- Comprehensive event system for observability
- Zero runtime dependencies
- CpuWorkerPool exists but not integrated into main execution flow
