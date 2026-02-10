# Design Patterns

## `SocietyPatterns`

Ready-to-use composition patterns.

```typescript
import { Society, SocietyPatterns, AggregationStrategies, createAgent, createRole } from 'societyai';

// Sequential execution (chain)
Society.create()
  .addAgent(a => a.withId('agent1').withModel(model).withRole(role1))
  .addAgent(a => a.withId('agent2').withModel(model).withRole(role2))
  .chain()  // Executes agents sequentially
  .execute(input);

// Scatter-Gather (parallel with aggregation)
Society.create()
  .addAgent(a => a.withId('agent1').withModel(model).withRole(role1))
  .addAgent(a => a.withId('agent2').withModel(model).withRole(role2))
  .addAgent(a => a.withId('agent3').withModel(model).withRole(role3))
  .scatterGather(AggregationStrategies.concat('\n\n---\n\n'))
  .execute(input);

// Router using FluentPipelineBuilder
Society.create()
  .addAgent(a => a.withId('agent1').withModel(model).withRole(role1))
  .addAgent(a => a.withId('agent2').withModel(model).withRole(role2))
  .usePipeline(p => p
    .router(['agent1', 'agent2'], (input) => 
      input.includes('technical') ? 'agent1' : 'agent2'
    )
  )
  .execute(input);

// Or use factory patterns
const chainSociety = SocietyPatterns.chain([agent1, agent2]);
const parallelSociety = SocietyPatterns.parallel([agent1, agent2, agent3]);
const collaborativeSociety = SocietyPatterns.collaborative([agent1, agent2], 3);
const reviewPipeline = SocietyPatterns.review(writer, reviewer);
```

## `AggregationStrategies`

Aggregation strategies for parallel results.

### Available Strategies

- **`AggregationStrategies.concat(separator?)`**: Concatenates all results with optional separator.
- **`AggregationStrategies.first()`**: Takes the first successful result.
- **`AggregationStrategies.last()`**: Takes the last successful result.
- **`AggregationStrategies.best(scoreFn)`**: Selects the best result according to a score function.
- **`AggregationStrategies.reduce(reducer, initial, finalize)`**: Custom reducer function.
- **`AggregationStrategies.structured(format?)`**: Formats results as JSON, markdown, or list.

### Coming Soon

> ⚠️ The following strategies are documented but not yet implemented. They will be added in a future release:

- **`AggregationStrategies.consensus(threshold)`**: Detects consensus based on similarity threshold (planned)
- **`AggregationStrategies.voting()`**: Majority vote aggregation (planned)
