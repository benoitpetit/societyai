# Migration Guide

Guide for migrating from the legacy function helpers to the workflow-based API.

## Overview

SocietyAI has evolved from a simple function-based API to a powerful workflow builder API. This guide helps you migrate existing code.

## Why Migrate?

The new API offers:

- **More control**: Define custom roles, behaviors, and capabilities
- **Better composition**: Build complex workflows from simple steps
- **Type safety**: Full TypeScript support with compile-time checking
- **Flexibility**: Sequential, parallel, collaborative, and conditional execution
- **Observability**: Better monitoring and debugging
- **Performance**: Optimized execution with worker pools

## Legacy API (Old)

> Note: the legacy helpers (`society`, `societyCollaborative`, `runSociety*`, etc.) are no longer exported.
> If you used them in older code, migrate using the patterns below.

```typescript
import { society, societyCollaborative } from 'societyai';

// Simple usage
const result = await society('What are the benefits of AI?', 3, [model], false);

// Collaborative
const result = await societyCollaborative('How can we solve this problem?', 4, [model], false);
```

## New API (Recommended)

```typescript
import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
} from 'societyai';

// Define roles
const role = RoleBuilder.create()
  .withId('analyst')
  .withSystemPrompt('You analyze information objectively.')
  .build();

// Create agents
const agents = [
  AgentBuilder.create().withId('agent-1').withRole(role).withModel(model).build(),
  // ...
];

// Build workflow
const workflow = WorkflowConfigBuilder.create()
  .withId('my-workflow')
  .addAgents(agents)
  .addStep(
    StepBuilder.create()
      .withId('analysis')
      .withAgents(['agent-1', 'agent-2'])
      .withExecutionType('parallel')
      .build()
  )
  .build();

// Execute
const executor = new DefaultWorkflowExecutor();
const result = await executor.execute(workflow, 'Your input here');
```

## Migration Examples

### Example 1: Simple Society

**Before**:

```typescript
const result = await society('Analyze this data', 3, [model], false, observer);
```

**After**:

```typescript
const analyst = RoleBuilder.create()
  .withId('analyst')
  .withSystemPrompt('Analyze this data')
  .build();

const agents = Array.from({ length: 3 }, (_, i) =>
  AgentBuilder.create().withId(`analyst-${i}`).withRole(analyst).withModel(model).build()
);

const workflow = WorkflowConfigBuilder.create()
  .withId('analysis')
  .addAgents(agents)
  .addStep(
    StepBuilder.create()
      .withId('analyze')
      .withAgents(agents.map((a) => a.id))
      .withExecutionType('parallel')
      .build()
  )
  .build();

const executor = new DefaultWorkflowExecutor(observer);
const result = await executor.execute(workflow, 'Analyze this data');
```

### Example 2: Collaborative Society

**Before**:

```typescript
const result = await societyCollaborative('Discuss this topic', 4, [model], false, observer);
```

**After**:

```typescript
const discussant = RoleBuilder.create()
  .withId('discussant')
  .withSystemPrompt('Participate in discussions thoughtfully.')
  .build();

const agents = Array.from({ length: 4 }, (_, i) =>
  AgentBuilder.create().withId(`discussant-${i}`).withRole(discussant).withModel(model).build()
);

const workflow = WorkflowConfigBuilder.create()
  .withId('discussion')
  .addAgents(agents)
  .addStep(
    StepBuilder.create()
      .withId('discuss')
      .withAgents(agents.map((a) => a.id))
      .withExecutionType('collaborative')
      .withMaxIterations(3)
      .build()
  )
  .build();

const executor = new DefaultWorkflowExecutor(observer);
const result = await executor.execute(workflow, 'Discuss this topic');
```

### Example 3: Custom Perspectives

**Before**:

```typescript
const result = await runSociety(
  {
    prompt: 'Evaluate this proposal',
    agentCount: 3,
    agentPerspectives: [
      'From a technical perspective: ',
      'From a business perspective: ',
      'From a user perspective: ',
    ],
  },
  [model]
);
```

**After**:

```typescript
const perspectives = [
  { id: 'tech', prompt: 'Evaluate from a technical perspective' },
  { id: 'business', prompt: 'Evaluate from a business perspective' },
  { id: 'user', prompt: 'Evaluate from a user perspective' },
];

const agents = perspectives.map((p) =>
  AgentBuilder.create()
    .withId(p.id)
    .withRole(RoleBuilder.create().withId(p.id).withSystemPrompt(p.prompt).build())
    .withModel(model)
    .build()
);

const workflow = WorkflowConfigBuilder.create()
  .withId('evaluation')
  .addAgents(agents)
  .addStep(
    StepBuilder.create()
      .withId('evaluate')
      .withAgents(agents.map((a) => a.id))
      .withExecutionType('parallel')
      .build()
  )
  .build();

const executor = new DefaultWorkflowExecutor();
const result = await executor.execute(workflow, 'Evaluate this proposal');
```

### Example 4: Custom Dimensions

**Before**:

```typescript
const result = await runSocietyCollaborative(
  {
    prompt: 'Analyze market trends',
    agentCount: 3,
    dimensions: ['Economic factors', 'Technological disruption', 'Consumer behavior'],
  },
  [model]
);
```

**After**:

```typescript
const dimensions = ['Economic factors', 'Technological disruption', 'Consumer behavior'];

const agents = dimensions.map((dim, i) =>
  AgentBuilder.create()
    .withId(`analyst-${i}`)
    .withRole(
      RoleBuilder.create()
        .withId(`dim-${i}`)
        .withSystemPrompt(`Analyze focusing on: ${dim}`)
        .build()
    )
    .withModel(model)
    .build()
);

const workflow = WorkflowConfigBuilder.create()
  .withId('market-analysis')
  .addAgents(agents)
  .addSteps([
    // Parallel analysis of each dimension
    StepBuilder.create()
      .withId('analyze-dimensions')
      .withAgents(agents.map((a) => a.id))
      .withExecutionType('parallel')
      .build(),

    // Collaborative integration
    StepBuilder.create()
      .withId('integrate')
      .withAgents(agents.map((a) => a.id))
      .withExecutionType('collaborative')
      .withMaxIterations(2)
      .build(),
  ])
  .build();

const executor = new DefaultWorkflowExecutor();
const result = await executor.execute(workflow, 'Analyze market trends');
```

## Migration Checklist

- [ ] Replace `society()` calls with workflow builders
- [ ] Replace `societyCollaborative()` calls with collaborative steps
- [ ] Convert perspectives to roles
- [ ] Convert dimensions to multiple agents or steps
- [ ] Update observers to use `DefaultWorkflowExecutor` constructor
- [ ] Test with new API
- [ ] Update error handling for new error types
- [ ] Review and optimize execution types (sequential vs parallel)

## Backward Compatibility

The legacy helpers have been removed to keep the public API smaller and more consistent.

## Benefits After Migration

1. **More Control**: Define exact agent behaviors
2. **Better Workflows**: Combine sequential, parallel, and collaborative steps
3. **Type Safety**: Catch errors at compile time
4. **Reusability**: Share roles and workflows across projects
5. **Testing**: Easier to test individual components
6. **Performance**: Better control over parallelization
7. **Monitoring**: Rich observability through hooks and observers

## Getting Help

If you encounter issues during migration:

- Check the docs in `docs/` (workflows, advanced, API reference)
- Read the [API Reference](./api-reference.md)
- Open an issue on [GitHub](https://github.com/benoitpetit/societyai-package/issues)

---

**Previous**: [Advanced Features](./advanced.md) ←
