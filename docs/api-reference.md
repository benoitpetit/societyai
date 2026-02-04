# API Reference

This is the central index for the SocietyAI API documentation. The reference is split into modules for better readability.

## 📦 Core Modules

- **[Society & Workflows](./core/society.md)**
  - `Society` (Entry Point)
  - `Society.create()`
  - `SocietyResult`, `TaskResult`, `Message`
  
- **[Context Management](./core/context.md)**
  - `ContextProvider`
  - `createContextToken<T>()`
  - `ContextScope`

- **[Middleware](./core/middleware.md)**
  - `Middleware` (Interface)
  - `MiddlewareChain`
  - `MiddlewareContext`

- **[Patterns](./core/patterns.md)**
  - `SocietyPatterns` (Sequential, ScatterGather, etc.)
  - `AggregationStrategies` (concat, first, last, best, reduce, structured)

## 🤖 Agents & Builders

- **[Agent Construction](./builders/agent-builder.md)**
  - `FluentAgentBuilder` (`AgentBuilder`)
  - `FluentRoleBuilder` (`RoleBuilder`)
  - `createAgent()`, `createRole()` helpers

- **[Workflow Construction](./builders/society-builder.md)**
  - `Society` (Main Builder)
  - `FluentTaskBuilder`

- **[Agent Interfaces](./agents/interfaces.md)**
  - `AIModel` (Interface for generic model implementation)
  - `Role`
  - `Agent`

## 🛠️ Capabilities

- **[Tools](./capabilities/tools.md)**
  - `ToolRegistry`
  - `Tool` (Interface)
  - `ToolBuilder`

- **[Memory System](./capabilities/memory.md)**
  - `MemoryBuilder`
  - `ShortTermMemory`
  - `EntityMemory`
  - `MemorySystem`

- **[Validation](./capabilities/validation.md)**
  - `StructuredOutputValidator`
  - `StructuredOutputBuilder`

## ⚡ Execution Engine

- **[Execution Graph](./execution/graph.md)**
  - `ExecutionEngine` (`SocietyGraph`)
  - `GraphBuilder`
  - `NodeType`

- **[Transformation](./execution/transformation.md)**
  - How high-level workflows map to low-level graphs.

## 👁️ Observability

- **[Events](./observability/events.md)**
  - `SocietyEventEmitter`
  - Event Types (`society:*`, `task:*`, `agent:*`)
  - `ProgressTracker`
