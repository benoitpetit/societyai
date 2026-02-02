import { MetricsBuilder, TokenMetrics } from '../src';

async function run(): Promise<void> {
  // Setup metrics tracker
  const metrics = MetricsBuilder.create()
    .withTokenTracking()
    .withCostTracking({
      inputCostPer1K: 0.01,
      outputCostPer1K: 0.03,
      model: 'gpt-4',
    })
    .build();

  // Simulate usage
  const workflowId = 'test-workflow';
  metrics.start(workflowId);

  // ... work happens ...

  const snapshot = metrics.end(workflowId, {
    tokens: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      model: 'gpt-4',
    } as TokenMetrics,
  });

  console.log('Metrics Snapshot:', snapshot);
}

run().catch(console.error);
