# Changelog

All notable changes to this project will be documented in this file.

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
