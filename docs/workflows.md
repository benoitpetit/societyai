# Workflow Patterns

This guide covers common workflow patterns and how to implement them in SocietyAI.

## Table of Contents

- [Execution Types](#execution-types)
- [Common Patterns](#common-patterns)
- [Pattern Library](#pattern-library)
- [Custom Patterns](#custom-patterns)
- [Best Practices](#best-practices)

## Execution Types

### Sequential Execution

Agents execute one after another. Each agent can access results from previous agents.

```typescript
const step = StepBuilder.create()
  .withId('sequential-step')
  .withAgents(['agent-1', 'agent-2', 'agent-3'])
  .withExecutionType('sequential')
  .build();
```

**Execution Order**:

```
Agent 1 → Agent 2 → Agent 3
```

**When to use**:

- Tasks with dependencies
- Progressive refinement
- Quality review processes
- Step-by-step analysis

### Parallel Execution

All agents execute simultaneously for maximum speed.

```typescript
const step = StepBuilder.create()
  .withId('parallel-step')
  .withAgents(['agent-1', 'agent-2', 'agent-3'])
  .withExecutionType('parallel')
  .build();
```

**Execution Order**:

```
┌─ Agent 1 ─┐
├─ Agent 2 ─┤ → All at once
└─ Agent 3 ─┘
```

**When to use**:

- Independent analyses
- Multiple perspectives
- Speed optimization
- Batch processing

### Collaborative Execution

Agents exchange messages across multiple iterations.

```typescript
const step = StepBuilder.create()
  .withId('collaborative-step')
  .withAgents(['agent-1', 'agent-2', 'agent-3'])
  .withExecutionType('collaborative')
  .withMaxIterations(3)
  .withCompletionCondition((results, iteration) => {
    // Custom completion logic
    return iteration >= 2;
  })
  .build();
```

**Execution Order**:

```
Round 1: Agent 1, Agent 2, Agent 3 (all share messages)
Round 2: Agent 1, Agent 2, Agent 3 (consider round 1)
Round 3: Agent 1, Agent 2, Agent 3 (consider rounds 1-2)
```

**When to use**:

- Discussions and debates
- Consensus building
- Iterative refinement
- Complex decision-making

### Conditional Execution

Steps execute only when conditions are met.

```typescript
const step = StepBuilder.create()
  .withId('conditional-step')
  .withAgents(['agent-1'])
  .withExecutionType('conditional')
  .withCondition((previousResults) => {
    const prevStep = previousResults.get('previous-step-id');
    return prevStep?.[0]?.success === true;
  })
  .build();
```

**When to use**:

- Error handling
- Dynamic workflows
- Optimization (skip unnecessary work)
- Branching logic

## Common Patterns

### 1. Pipeline Pattern

Process data through a sequence of transformations.

```typescript
const workflow = WorkflowConfigBuilder.create()
  .withId('pipeline')
  .withName('Data Processing Pipeline')
  .addAgents([collectorAgent, analyzerAgent, formatterAgent])
  .addSteps([
    // Step 1: Collect data
    StepBuilder.create()
      .withId('collect')
      .withAgents(['collector'])
      .withExecutionType('sequential')
      .withInstructions('Gather and organize raw data.')
      .build(),
    // Step 2: Analyze
    StepBuilder.create()
      .withId('analyze')
      .withAgents(['analyzer'])
      .withExecutionType('sequential')
      .withInstructions('Analyze the collected data.')
      .build(),
    // Step 3: Format
    StepBuilder.create()
      .withId('format')
      .withAgents(['formatter'])
      .withExecutionType('sequential')
      .withInstructions('Format the analysis for presentation.')
      .build(),
  ])
  .build();
```

**Flow**: Collector → Analyzer → Formatter

### 2. Parallel Analysis + Synthesis

Multiple agents analyze independently, then synthesize results.

```typescript
const workflow = WorkflowConfigBuilder.create()
  .withId('parallel-synthesis')
  .withName('Multi-Perspective Analysis')
  .addAgents([analyst1, analyst2, analyst3, synthesizer])
  .addSteps([
    // Step 1: Parallel analysis
    StepBuilder.create()
      .withId('analyze')
      .withAgents(['analyst-1', 'analyst-2', 'analyst-3'])
      .withExecutionType('parallel')
      .withInstructions('Analyze from your unique perspective.')
      .build(),
    // Step 2: Synthesize
    StepBuilder.create()
      .withId('synthesize')
      .withAgents(['synthesizer'])
      .withExecutionType('sequential')
      .withInstructions('Combine all perspectives into a unified analysis.')
      .build(),
  ])
  .build();
```

**Flow**: [Analyst 1, Analyst 2, Analyst 3] → Synthesizer

### 3. Review Loop

One agent produces, another reviews, with potential iteration.

```typescript
const workflow = WorkflowConfigBuilder.create()
  .withId('review-loop')
  .withName('Producer-Reviewer Loop')
  .addAgents([producer, reviewer])
  .addSteps([
    // Step 1: Production
    StepBuilder.create()
      .withId('produce')
      .withAgents(['producer'])
      .withExecutionType('sequential')
      .withInstructions('Create the initial version.')
      .build(),
    // Step 2: Review
    StepBuilder.create()
      .withId('review')
      .withAgents(['reviewer'])
      .withExecutionType('sequential')
      .withInstructions('Review and provide feedback.')
      .withNextStepResolver((results) => {
        const hasIssues = results[0]?.content.includes('NEEDS_REVISION');
        return hasIssues ? 'produce' : null; // Loop back or finish
      })
      .build(),
  ])
  .build();
```

**Flow**: Producer → Reviewer → (loop if issues) → Producer → ...

### 4. Hierarchical Pattern

Coordinator distributes work, team executes, coordinator validates.

```typescript
const workflow = WorkflowConfigBuilder.create()
  .withId('hierarchical')
  .withName('Hierarchical Team')
  .addAgents([coordinator, worker1, worker2, worker3])
  .addSteps([
    // Step 1: Planning
    StepBuilder.create()
      .withId('plan')
      .withAgents(['coordinator'])
      .withExecutionType('sequential')
      .withInstructions('Break down the task and assign work.')
      .build(),
    // Step 2: Execution
    StepBuilder.create()
      .withId('execute')
      .withAgents(['worker-1', 'worker-2', 'worker-3'])
      .withExecutionType('parallel')
      .withInstructions('Complete your assigned task.')
      .build(),
    // Step 3: Validation
    StepBuilder.create()
      .withId('validate')
      .withAgents(['coordinator'])
      .withExecutionType('sequential')
      .withInstructions('Validate and combine team results.')
      .build(),
  ])
  .build();
```

**Flow**: Coordinator → [Worker 1, Worker 2, Worker 3] → Coordinator

### 5. Consensus Pattern

Agents discuss until they reach agreement.

```typescript
const workflow = WorkflowConfigBuilder.create()
  .withId('consensus')
  .withName('Consensus Building')
  .addAgents([agent1, agent2, agent3])
  .addSteps([
    StepBuilder.create()
      .withId('discussion')
      .withAgents(['agent-1', 'agent-2', 'agent-3'])
      .withExecutionType('collaborative')
      .withMaxIterations(5)
      .withCompletionCondition((results, iteration) => {
        // Check if all agents agree
        const contents = results.filter((r) => r.iteration === iteration).map((r) => r.content);
        return checkConsensus(contents) || iteration >= 4;
      })
      .build(),
  ])
  .build();

function checkConsensus(contents: string[]): boolean {
  // Custom logic to detect consensus
  const keywords = ['agreed', 'consensus', 'accept'];
  return contents.every((c) => keywords.some((k) => c.toLowerCase().includes(k)));
}
```

**Flow**: Multiple rounds of discussion until consensus

## Pattern Library

### Software Development Team

```typescript
const devWorkflow = WorkflowConfigBuilder.create()
  .withId('dev-team')
  .withName('Software Development Workflow')
  .addAgents([pm, architect, dev1, dev2, qa])
  .addSteps([
    // Planning
    StepBuilder.create()
      .withId('planning')
      .withAgents(['pm'])
      .withExecutionType('sequential')
      .build(),
    // Architecture
    StepBuilder.create()
      .withId('architecture')
      .withAgents(['architect'])
      .withExecutionType('sequential')
      .build(),
    // Implementation (parallel)
    StepBuilder.create()
      .withId('implementation')
      .withAgents(['dev-1', 'dev-2'])
      .withExecutionType('parallel')
      .build(),
    // Testing
    StepBuilder.create()
      .withId('testing')
      .withAgents(['qa'])
      .withExecutionType('sequential')
      .build(),
    // Review (conditional - only if tests fail)
    StepBuilder.create()
      .withId('review')
      .withAgents(['architect'])
      .withExecutionType('conditional')
      .withCondition((results) => {
        const testResults = results.get('testing');
        return testResults?.[0]?.content.includes('FAILED');
      })
      .build(),
  ])
  .build();
```

### Research Team

```typescript
const researchWorkflow = WorkflowConfigBuilder.create()
  .withId('research-team')
  .withName('Research Workflow')
  .addAgents([researcher1, researcher2, statistician, writer])
  .addSteps([
    // Literature review (parallel)
    StepBuilder.create()
      .withId('literature')
      .withAgents(['researcher-1', 'researcher-2'])
      .withExecutionType('parallel')
      .withInstructions('Review relevant literature.')
      .build(),
    // Statistical analysis
    StepBuilder.create()
      .withId('analysis')
      .withAgents(['statistician'])
      .withExecutionType('sequential')
      .withInstructions('Perform statistical analysis.')
      .build(),
    // Paper writing
    StepBuilder.create()
      .withId('writing')
      .withAgents(['writer'])
      .withExecutionType('sequential')
      .withInstructions('Write the research paper.')
      .build(),
    // Peer review (collaborative)
    StepBuilder.create()
      .withId('peer-review')
      .withAgents(['researcher-1', 'researcher-2', 'statistician'])
      .withExecutionType('collaborative')
      .withMaxIterations(2)
      .build(),
  ])
  .build();
```

### Content Creation

```typescript
const contentWorkflow = WorkflowConfigBuilder.create()
  .withId('content-creation')
  .withName('Content Production Workflow')
  .addAgents([researcher, writer, editor, designer])
  .addSteps([
    // Research
    StepBuilder.create()
      .withId('research')
      .withAgents(['researcher'])
      .withExecutionType('sequential')
      .build(),
    // Writing
    StepBuilder.create()
      .withId('writing')
      .withAgents(['writer'])
      .withExecutionType('sequential')
      .build(),
    // Parallel: Editing & Design
    StepBuilder.create()
      .withId('polish')
      .withAgents(['editor', 'designer'])
      .withExecutionType('parallel')
      .build(),
  ])
  .build();
```

### Business Analysis

```typescript
const businessWorkflow = WorkflowConfigBuilder.create()
  .withId('business-analysis')
  .withName('Business Analysis Workflow')
  .addAgents([marketAnalyst, financialAnalyst, strategist, executive])
  .addSteps([
    // Market & Financial analysis (parallel)
    StepBuilder.create()
      .withId('analysis')
      .withAgents(['market-analyst', 'financial-analyst'])
      .withExecutionType('parallel')
      .build(),
    // Strategic recommendations
    StepBuilder.create()
      .withId('strategy')
      .withAgents(['strategist'])
      .withExecutionType('sequential')
      .build(),
    // Executive review and decision
    StepBuilder.create()
      .withId('decision')
      .withAgents(['executive'])
      .withExecutionType('sequential')
      .build(),
  ])
  .build();
```

## Custom Patterns

### Dynamic Routing

Route to different steps based on results:

```typescript
StepBuilder.create()
  .withId('router')
  .withAgents(['router-agent'])
  .withExecutionType('sequential')
  .withNextStepResolver((results) => {
    const content = results[0]?.content || '';

    if (content.includes('TECHNICAL')) return 'technical-step';
    if (content.includes('BUSINESS')) return 'business-step';
    if (content.includes('DESIGN')) return 'design-step';

    return 'default-step';
  })
  .build();
```

### Iterative Refinement

```typescript
let iteration = 0;
const maxIterations = 3;

StepBuilder.create()
  .withId('refine')
  .withAgents(['refiner'])
  .withExecutionType('sequential')
  .withNextStepResolver((results) => {
    iteration++;
    const quality = assessQuality(results[0]?.content);

    if (quality >= 0.9 || iteration >= maxIterations) {
      return null; // Done
    }
    return 'refine'; // Loop back
  })
  .build();
```

### Conditional Branching

```typescript
const workflow = WorkflowConfigBuilder.create()
  .addSteps([
    // Main step
    StepBuilder.create()
      .withId('main')
      .withAgents(['main-agent'])
      .withExecutionType('sequential')
      .build(),

    // Branch A (if condition 1)
    StepBuilder.create()
      .withId('branch-a')
      .withAgents(['agent-a'])
      .withExecutionType('conditional')
      .withCondition((results) => checkConditionA(results))
      .build(),

    // Branch B (if condition 2)
    StepBuilder.create()
      .withId('branch-b')
      .withAgents(['agent-b'])
      .withExecutionType('conditional')
      .withCondition((results) => checkConditionB(results))
      .build(),

    // Merge step
    StepBuilder.create()
      .withId('merge')
      .withAgents(['merger'])
      .withExecutionType('sequential')
      .build(),
  ])
  .build();
```

### Progressive Depth

Start shallow, go deeper based on needs:

```typescript
const workflow = WorkflowConfigBuilder.create()
  .addSteps([
    // Level 1: Quick analysis
    StepBuilder.create()
      .withId('level-1')
      .withAgents(['quick-analyst'])
      .withExecutionType('sequential')
      .withNextStepResolver((results) => {
        const needsDeeper = results[0]?.content.includes('COMPLEX');
        return needsDeeper ? 'level-2' : null;
      })
      .build(),

    // Level 2: Deeper analysis (conditional)
    StepBuilder.create()
      .withId('level-2')
      .withAgents(['deep-analyst'])
      .withExecutionType('conditional')
      .withCondition((results) => results.has('level-1'))
      .withNextStepResolver((results) => {
        const needsExpert = results[0]?.content.includes('EXPERT_NEEDED');
        return needsExpert ? 'level-3' : null;
      })
      .build(),

    // Level 3: Expert analysis (conditional)
    StepBuilder.create()
      .withId('level-3')
      .withAgents(['expert'])
      .withExecutionType('conditional')
      .withCondition((results) => results.has('level-2'))
      .build(),
  ])
  .build();
```

## Best Practices

### 1. Choose the Right Execution Type

| Pattern               | Use Sequential | Use Parallel | Use Collaborative |
| --------------------- | -------------- | ------------ | ----------------- |
| Dependent tasks       | ✅             | ❌           | ❌                |
| Independent tasks     | ❌             | ✅           | ❌                |
| Need discussion       | ❌             | ❌           | ✅                |
| Quality review        | ✅             | ❌           | ❌                |
| Multiple perspectives | ❌             | ✅           | ✅                |
| Consensus building    | ❌             | ❌           | ✅                |

### 2. Optimize for Performance

- **Use parallel** when tasks are independent
- **Limit iterations** in collaborative steps
- **Set timeouts** for each step
- **Cache expensive results** in context

### 3. Design for Maintainability

- **Clear step names** describe what happens
- **Meaningful IDs** for steps and agents
- **Document conditions** and routing logic
- **Use result transformers** to normalize data

### 4. Handle Errors Gracefully

- **Add conditional steps** for error recovery
- **Implement fallback paths** in resolvers
- **Use onAfterStep hooks** to validate results
- **Store error context** for debugging

### 5. Context Management

```typescript
// Store intermediate results
context.sharedData.set('step1-result', data);

// Retrieve for later steps
const previous = context.sharedData.get('step1-result');

// Clean up when done
context.sharedData.delete('temporary-data');
```

### 6. Testing Workflows

```typescript
// Test with simulated models
class TestModel extends StandardModelBase {
  constructor(name: string, mockResponse: string) {
    super({ name }, async () => mockResponse);
  }
}

// Test individual steps
const testResult = await executor.executeStep(step, agentsMap, testContext);

// Test complete workflows
const testWorkflow = workflow; // Your workflow
const result = await executor.execute(testWorkflow, 'test input');

expect(result.success).toBe(true);
```

## Example: Complete Custom Pattern

```typescript
/**
 * Research-Debate-Conclude Pattern
 *
 * 1. Multiple researchers gather information (parallel)
 * 2. Experts debate findings (collaborative)
 * 3. Synthesizer creates final report (sequential)
 */
const researchDebateWorkflow = WorkflowConfigBuilder.create()
  .withId('research-debate')
  .withName('Research-Debate-Conclude')
  .addAgents([
    researcher1Agent,
    researcher2Agent,
    expert1Agent,
    expert2Agent,
    expert3Agent,
    synthesizerAgent,
  ])
  .addSteps([
    // Phase 1: Research (parallel)
    StepBuilder.create()
      .withId('research')
      .withName('Information Gathering')
      .withAgents(['researcher-1', 'researcher-2'])
      .withExecutionType('parallel')
      .withInstructions('Gather comprehensive information on the topic.')
      .withResultTransformer((results) => {
        // Combine research findings
        return {
          findings: results.map((r) => r.content),
          sources: results.length,
        };
      })
      .build(),

    // Phase 2: Expert debate (collaborative)
    StepBuilder.create()
      .withId('debate')
      .withName('Expert Discussion')
      .withAgents(['expert-1', 'expert-2', 'expert-3'])
      .withExecutionType('collaborative')
      .withMaxIterations(3)
      .withInstructions('Discuss the research findings and reach expert consensus.')
      .withCompletionCondition((results, iteration) => {
        if (iteration < 2) return false;

        // Check for consensus keywords
        const lastRound = results.filter((r) => r.iteration === iteration);
        const consensusCount = lastRound.filter(
          (r) =>
            r.content.toLowerCase().includes('agree') ||
            r.content.toLowerCase().includes('consensus')
        ).length;

        return consensusCount >= 2; // Majority agreement
      })
      .build(),

    // Phase 3: Synthesis (sequential)
    StepBuilder.create()
      .withId('synthesis')
      .withName('Final Report')
      .withAgents(['synthesizer'])
      .withExecutionType('sequential')
      .withInstructions(
        'Create a comprehensive final report synthesizing ' + 'the research and expert debate.'
      )
      .build(),
  ])
  .withFinalResultGenerator(async (stepResults, context) => {
    const research = stepResults.get('research');
    const debate = stepResults.get('debate');
    const synthesis = stepResults.get('synthesis');

    return `
# Research-Debate-Conclude Report

## Research Phase
${research?.map((r) => `- ${r.agentId}: ${r.content}`).join('\n')}

## Expert Debate (${debate?.length} contributions)
${debate
  ?.slice(-3)
  .map((r) => `- ${r.agentId}: ${r.content.substring(0, 100)}...`)
  .join('\n')}

## Final Synthesis
${synthesis?.[0]?.content || 'No synthesis available'}
    `.trim();
  })
  .build();

// Execute
const result = await executor.execute(
  researchDebateWorkflow,
  'What are the implications of quantum computing on cryptography?'
);
```

---

**Next**: [API Reference](./api-reference.md) →

**Previous**: [Architecture](./architecture.md) ←
