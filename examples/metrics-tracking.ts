/**
 * Example: Metrics and Observability
 * 
 * This example demonstrates comprehensive tracking of token usage,
 * execution time, costs, and OpenTelemetry-compatible trace export.
 */

import {
  MetricsBuilder,
  MetricsTracker,
  TokenCounter,
  PerformanceProfiler,
  CommonCostConfigs,
  StandardModelBase,
} from '../src';

// Example model with token tracking (for reference)
// This class demonstrates how to integrate metrics tracking into a custom model
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class TrackedModel extends StandardModelBase {
  constructor(name: string, private tracker: MetricsTracker) {
    super({ name }, async (prompt: unknown) => {
      const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = `Processed: ${promptStr.substring(0, 50)}...`;
      
      // Track tokens
      // Count tokens for tracking
      // const tokens = TokenCounter.count(promptStr, response);
      
      return response;
    });
  }
}

async function runMetricsExample(): Promise<void> {
  console.log('=== Metrics and Observability Example ===\n');

  // Create metrics tracker
  const tracker = MetricsBuilder.create()
    .withTokenTracking()
    .withCostTracking(CommonCostConfigs['gpt-4'])
    .withCostTracking(CommonCostConfigs['claude-3-sonnet'])
    .build();

  console.log('--- Basic Tracking ---');
  
  // Start tracking a workflow
  tracker.start('workflow-1', { userId: 'user123', task: 'analysis' });
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 150));
  
  // End tracking with token metrics
  const snapshot1 = tracker.end('workflow-1', {
    tokens: {
      inputTokens: 500,
      outputTokens: 300,
      totalTokens: 800,
      model: 'gpt-4',
    },
    custom: {
      apiCalls: 3,
      cacheHits: 1,
    },
  });

  console.log('Workflow completed:');
  console.log('- Duration:', snapshot1.execution.duration, 'ms');
  console.log('- Tokens:', snapshot1.tokens?.totalTokens);
  console.log('- Estimated cost:', `$${snapshot1.cost?.totalCost.toFixed(4)}`);
  console.log('- Custom metrics:', snapshot1.custom);

  // Track multiple workflows
  console.log('\n--- Multiple Workflows ---');
  
  for (let i = 0; i < 3; i++) {
    tracker.start(`agent-${i}`);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    tracker.end(`agent-${i}`, {
      tokens: {
        inputTokens: Math.floor(Math.random() * 500) + 100,
        outputTokens: Math.floor(Math.random() * 300) + 50,
        totalTokens: 0,
        model: 'claude-3-sonnet',
      },
    });
  }

  // Get aggregated metrics
  const aggregated = tracker.getAggregated();
  
  console.log('Aggregated metrics:');
  console.log('- Total executions:', aggregated.totalExecutions);
  console.log('- Successful:', aggregated.successfulExecutions);
  console.log('- Average duration:', aggregated.averageDuration.toFixed(2), 'ms');
  console.log('- Total tokens:', aggregated.totalTokens);
  console.log('- Total cost:', `$${aggregated.totalCost?.toFixed(4)}`);

  // Track failure
  console.log('\n--- Failure Tracking ---');
  
  tracker.start('failing-workflow');
  await new Promise(resolve => setTimeout(resolve, 50));
  
  try {
    throw new Error('Simulated failure');
  } catch (error) {
    tracker.fail('failing-workflow', error as Error);
  }

  const failedMetrics = tracker.getAggregated();
  console.log('Failed executions:', failedMetrics.failedExecutions);

  // Performance profiling
  console.log('\n--- Performance Profiling ---');
  
  const profiler = new PerformanceProfiler();
  
  profiler.mark('start');
  await new Promise(resolve => setTimeout(resolve, 50));
  
  profiler.mark('phase-1-complete');
  await new Promise(resolve => setTimeout(resolve, 75));
  
  profiler.mark('phase-2-complete');
  await new Promise(resolve => setTimeout(resolve, 25));
  
  profiler.mark('end');
  
  const phase1Duration = profiler.measure('phase-1', 'start', 'phase-1-complete');
  const phase2Duration = profiler.measure('phase-2', 'phase-1-complete', 'phase-2-complete');
  const totalDuration = profiler.measure('total', 'start', 'end');
  
  console.log('Phase 1 duration:', phase1Duration, 'ms');
  console.log('Phase 2 duration:', phase2Duration, 'ms');
  console.log('Total duration:', totalDuration, 'ms');
  
  console.log('\nAll measures:', profiler.getMeasures());

  // Token estimation
  console.log('\n--- Token Estimation ---');
  
  const text1 = 'This is a short text message.';
  const text2 = 'This is a much longer text message with more content and details that will result in more tokens being counted.';
  
  console.log('Text 1 estimated tokens:', TokenCounter.estimate(text1));
  console.log('Text 2 estimated tokens:', TokenCounter.estimate(text2));
  
  const promptTokens = TokenCounter.count(text2, text1);
  console.log('Prompt + response tokens:', promptTokens);

  // Export metrics
  console.log('\n--- Metrics Export ---');
  
  const jsonExport = tracker.export();
  console.log('JSON export length:', jsonExport.length, 'characters');
  console.log('(Truncated preview):', jsonExport.substring(0, 200), '...');

  // OpenTelemetry export
  const otelTraces = tracker.exportOTel();
  console.log('\nOpenTelemetry traces:', otelTraces.length);
  console.log('Sample trace:');
  console.log({
    name: otelTraces[0]?.name,
    duration: otelTraces[0]?.endTimeUnixNano - otelTraces[0]?.startTimeUnixNano,
    status: otelTraces[0]?.status.code,
    attributes: Object.keys(otelTraces[0]?.attributes || {}),
  });

  // Filter history
  console.log('\n--- Filtered History ---');
  
  const workflow1History = tracker.getHistory({ id: 'workflow-1' });
  console.log('Workflow-1 executions:', workflow1History.length);
  
  const successfulHistory = tracker.getHistory({ success: true });
  console.log('Successful executions:', successfulHistory.length);
  
  const failedHistory = tracker.getHistory({ success: false });
  console.log('Failed executions:', failedHistory.length);

  // Per-agent breakdown
  console.log('\n--- Per-Agent Breakdown ---');
  
  const byAgent = aggregated.byAgent;
  if (byAgent) {
    for (const [agentId, snapshots] of Object.entries(byAgent)) {
      console.log(`\n${agentId}:`);
      console.log(`  - Executions: ${snapshots.length}`);
      
      const totalDuration = snapshots.reduce((sum, s) => sum + (s.execution.duration || 0), 0);
      console.log(`  - Total duration: ${totalDuration}ms`);
      
      const totalTokens = snapshots.reduce((sum, s) => sum + (s.tokens?.totalTokens || 0), 0);
      if (totalTokens > 0) {
        console.log(`  - Total tokens: ${totalTokens}`);
      }
      
      const totalCost = snapshots.reduce((sum, s) => sum + (s.cost?.totalCost || 0), 0);
      if (totalCost > 0) {
        console.log(`  - Total cost: $${totalCost.toFixed(4)}`);
      }
    }
  }

  // Cost comparison across models
  console.log('\n--- Cost Comparison ---');
  
  const models = [
    { name: 'gpt-4', tokens: 1000 },
    { name: 'gpt-4-turbo', tokens: 1000 },
    { name: 'gpt-3.5-turbo', tokens: 1000 },
    { name: 'claude-3-opus', tokens: 1000 },
    { name: 'claude-3-sonnet', tokens: 1000 },
  ];

  console.log('Cost for 1000 tokens (500 input + 500 output):');
  
  for (const model of models) {
    const config = CommonCostConfigs[model.name as keyof typeof CommonCostConfigs];
    if (config) {
      const inputCost = (500 / 1000) * config.inputCostPer1K;
      const outputCost = (500 / 1000) * config.outputCostPer1K;
      const totalCost = inputCost + outputCost;
      
      console.log(`- ${model.name}: $${totalCost.toFixed(4)}`);
    }
  }
}

// Run the example
if (require.main === module) {
  (async (): Promise<void> => {
    await runMetricsExample().catch(console.error);
  })();
}

export { runMetricsExample };
