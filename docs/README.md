# SocietyAI Documentation

Complete documentation for the SocietyAI library - a powerful TypeScript framework for building collaborative multi-agent AI systems.

## 📚 Documentation Guide

### For Beginners

Start here if you're new to SocietyAI:

1. **[Getting Started](./getting-started.md)** - Installation, setup, and your first workflow
2. **[Architecture Overview](./architecture.md)** - Core concepts and design principles
3. **[Examples Index](./examples.md)** - Browse all code examples

### For Developers

Build your own multi-agent systems:

4. **[Workflow Patterns](./workflows.md)** - Common workflow configurations and patterns
5. **[API Reference](./api-reference.md)** - Complete API documentation
6. **[Advanced Features](./advanced.md)** - Error handling, retry, observability, performance

### For Migrating Users

Upgrading from the legacy API:

7. **[Migration Guide](./migration.md)** - Step-by-step migration instructions

## 🚀 Quick Links

| Topic | Document | Description |
|-------|----------|-------------|
| **Installation** | [Getting Started](./getting-started.md#installation) | How to install SocietyAI |
| **First Workflow** | [Getting Started](./getting-started.md#your-first-society) | Create your first multi-agent system |
| **Core Concepts** | [Architecture](./architecture.md#core-components) | Understanding roles, agents, workflows |
| **Execution Types** | [Workflows](./workflows.md#execution-types) | Sequential, parallel, collaborative patterns |
| **Error Handling** | [Advanced](./advanced.md#error-handling) | Robust error handling strategies |
| **API Reference** | [API Reference](./api-reference.md) | Complete API documentation |
| **Code Examples** | [Examples](./examples.md) | Browse all example code |

## 📖 Documentation Structure

```
docs/
├── README.md              # This file - Documentation index
├── getting-started.md     # Installation and basics
├── architecture.md        # Core concepts and design
├── workflows.md          # Workflow patterns
├── api-reference.md      # Complete API documentation
├── advanced.md           # Advanced features
├── migration.md          # Migration from legacy API
└── examples.md           # Examples index
```

## 🎯 Learn by Use Case

### Software Development
- **Examples**: [software-team.ts](../examples/04-domains/software-team.ts)
- **Patterns**: [Hierarchical Pattern](./workflows.md#4-hierarchical-pattern)
- **API**: [WorkflowConfigBuilder](./api-reference.md#workflowconfigbuilder)

### Research & Analysis
- **Examples**: [research-team.ts](../examples/04-domains/research-team.ts)
- **Patterns**: [Parallel Analysis + Synthesis](./workflows.md#2-parallel-analysis--synthesis)
- **API**: [Parallel Execution](./api-reference.md#parallel-execution)

### Content Creation
- **Examples**: [creative-team.ts](../examples/04-domains/creative-team.ts)
- **Patterns**: [Pipeline Pattern](./workflows.md#1-pipeline-pattern)
- **API**: [Sequential Execution](./api-reference.md#sequential-execution)

### Business Analysis
- **Examples**: [business-team.ts](../examples/04-domains/business-team.ts)
- **Patterns**: [Multiple Perspectives](./workflows.md#common-use-cases)
- **API**: [StepBuilder](./api-reference.md#stepbuilder)

## 🔍 Find What You Need

### I want to...

**Create a simple multi-agent system**
→ [Getting Started](./getting-started.md) → [Simple Example](./getting-started.md#your-first-society)

**Make agents work in parallel**
→ [Workflows](./workflows.md) → [Parallel Execution](./workflows.md#parallel-execution)

**Have agents discuss together**
→ [Workflows](./workflows.md) → [Collaborative Execution](./workflows.md#collaborative-execution)

**Handle errors properly**
→ [Advanced](./advanced.md) → [Error Handling](./advanced.md#error-handling)

**Integrate with OpenAI/Anthropic**
→ [Examples](./examples.md) → [05-integrations](./examples.md#05-integrations---ai-service-integrations)

**Monitor execution**
→ [Advanced](./advanced.md) → [Observability](./advanced.md#observability)

**Optimize performance**
→ [Advanced](./advanced.md) → [Performance](./advanced.md#performance-optimization)

**Test my workflows**
→ [Advanced](./advanced.md) → [Testing](./advanced.md#testing)

**Deploy to production**
→ [Advanced](./advanced.md) → [Production](./advanced.md#production-deployment)

**Migrate from old API**
→ [Migration Guide](./migration.md)

## 💡 Key Concepts

### 1. Roles
Define agent behavior with system prompts, capabilities, and constraints.
```typescript
const role = RoleBuilder.create()
  .withSystemPrompt('You are a data analyst')
  .build();
```
**Read more**: [Architecture - AgentRole](./architecture.md#2-agentrole)

### 2. Agents
Combine roles with AI models to create functional agents.
```typescript
const agent = AgentBuilder.create()
  .withRole(role)
  .withModel(model)
  .build();
```
**Read more**: [Architecture - AgentConfig](./architecture.md#3-agentconfig)

### 3. Steps
Define what agents do and how (sequential, parallel, collaborative).
```typescript
const step = StepBuilder.create()
  .withAgents(['agent-1', 'agent-2'])
  .withExecutionType('parallel')
  .build();
```
**Read more**: [Architecture - WorkflowStep](./architecture.md#4-workflowstep)

### 4. Workflows
Orchestrate agents and steps into complete systems.
```typescript
const workflow = WorkflowConfigBuilder.create()
  .addAgents([agent1, agent2])
  .addSteps([step1, step2])
  .build();
```
**Read more**: [Architecture - WorkflowConfig](./architecture.md#5-workflowconfig)

### 5. Execution
Run workflows and get results.
```typescript
const executor = new DefaultWorkflowExecutor();
const result = await executor.execute(workflow, input);
```
**Read more**: [Architecture - WorkflowExecutor](./architecture.md#6-workflowexecutor)

## 🎓 Learning Path

### Level 1: Basics (30 minutes)
1. [Install and setup](./getting-started.md#installation)
2. [Create your first workflow](./getting-started.md#your-first-society)
3. [Understand core concepts](./getting-started.md#understanding-the-basics)

### Level 2: Intermediate (1 hour)
1. [Learn workflow patterns](./workflows.md#common-patterns)
2. [Try different execution types](./workflows.md#execution-types)
3. [Explore domain examples](./examples.md#04-domains---domain-specific-examples)

### Level 3: Advanced (2 hours)
1. [Master error handling](./advanced.md#error-handling)
2. [Implement observability](./advanced.md#observability)
3. [Optimize performance](./advanced.md#performance-optimization)
4. [Deploy to production](./advanced.md#production-deployment)

## 📝 API Quick Reference

| Builder | Purpose | Documentation |
|---------|---------|---------------|
| `RoleBuilder` | Define agent roles | [API Ref](./api-reference.md#rolebuilder) |
| `AgentBuilder` | Create agents | [API Ref](./api-reference.md#agentbuilder) |
| `StepBuilder` | Define workflow steps | [API Ref](./api-reference.md#stepbuilder) |
| `WorkflowConfigBuilder` | Build workflows | [API Ref](./api-reference.md#workflowconfigbuilder) |
| `DefaultWorkflowExecutor` | Execute workflows | [API Ref](./api-reference.md#defaultworkflowexecutor) |
| `StandardModelBase` | Create AI models | [API Ref](./api-reference.md#standardmodelbase) |
| `MessageBus` | Agent communication | [API Ref](./api-reference.md#messagebus) |

## 🤝 Getting Help

- **Questions**: [GitHub Discussions](https://github.com/benoitpetit/societyai/discussions)
- **Bugs**: [GitHub Issues](https://github.com/benoitpetit/societyai/issues)
- **Examples**: [Browse examples](../examples/)
- **API Docs**: [API Reference](./api-reference.md)

## 🔗 External Resources

- **npm Package**: [@societyai/core](https://www.npmjs.com/package/@societyai/core)
- **GitHub**: [societyai-package](https://github.com/benoitpetit/societyai-package)
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)
- **License**: [MIT](../LICENSE)

## 📋 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Getting Started | ✅ Complete | 2026-01-24 |
| Architecture | ✅ Complete | 2026-01-24 |
| Workflows | ✅ Complete | 2026-01-24 |
| API Reference | ✅ Complete | 2026-01-24 |
| Advanced Features | ✅ Complete | 2026-01-24 |
| Migration Guide | ✅ Complete | 2026-01-24 |
| Examples Index | ✅ Complete | 2026-01-24 |

---

**Start Learning**: [Getting Started →](./getting-started.md)
