/**
 * Tests for Metrics and Observability
 */

import {
  MetricsBuilder,
  MetricsTracker,
  TokenCounter,
  PerformanceProfiler,
  CommonCostConfigs,
} from '..';

describe('Metrics and Observability', () => {
  describe('MetricsTracker', () => {
    let tracker: MetricsTracker;

    beforeEach(() => {
      tracker = MetricsBuilder.create()
        .withTokenTracking()
        .withCostTracking(CommonCostConfigs['gpt-4'])
        .build();
    });

    it('should track workflow execution', () => {
      tracker.start('test-workflow');
      const snapshot = tracker.end('test-workflow');

      expect(snapshot.id).toBe('test-workflow');
      expect(snapshot.execution.success).toBe(true);
      expect(snapshot.execution.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track token metrics', () => {
      tracker.start('test');
      const snapshot = tracker.end('test', {
        tokens: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          model: 'gpt-4',
        },
      });

      expect(snapshot.tokens?.totalTokens).toBe(150);
    });

    it('should calculate costs', () => {
      tracker.start('test');
      const snapshot = tracker.end('test', {
        tokens: {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          model: 'gpt-4',
        },
      });

      expect(snapshot.cost).toBeDefined();
      expect(snapshot.cost?.totalCost).toBeGreaterThan(0);
    });

    it('should track custom metrics', () => {
      tracker.start('test');
      const snapshot = tracker.end('test', {
        custom: {
          apiCalls: 5,
          cacheHits: 2,
        },
      });

      expect(snapshot.custom?.apiCalls).toBe(5);
      expect(snapshot.custom?.cacheHits).toBe(2);
    });

    it('should track failures', () => {
      tracker.start('test');
      const error = new Error('Test error');
      const snapshot = tracker.fail('test', error);

      expect(snapshot.execution.success).toBe(false);
      expect(snapshot.execution.error).toBe(error);
    });

    it('should get history', () => {
      tracker.start('test-1');
      tracker.end('test-1');

      tracker.start('test-2');
      tracker.end('test-2');

      const history = tracker.getHistory();
      expect(history).toHaveLength(2);
    });

    it('should filter history', () => {
      tracker.start('workflow-1');
      tracker.end('workflow-1');

      tracker.start('workflow-2');
      tracker.fail('workflow-2', new Error('Failed'));

      const successfulOnly = tracker.getHistory({ success: true });
      expect(successfulOnly).toHaveLength(1);

      const failedOnly = tracker.getHistory({ success: false });
      expect(failedOnly).toHaveLength(1);
    });

    it('should aggregate metrics', () => {
      for (let i = 0; i < 5; i++) {
        tracker.start(`test-${i}`);
        tracker.end(`test-${i}`, {
          tokens: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            model: 'gpt-4',
          },
        });
      }

      const aggregated = tracker.getAggregated();

      expect(aggregated.totalExecutions).toBe(5);
      expect(aggregated.successfulExecutions).toBe(5);
      expect(aggregated.totalTokens).toBe(750);
      expect(aggregated.averageDuration).toBeGreaterThanOrEqual(0);
    });

    it('should export as JSON', () => {
      tracker.start('test');
      tracker.end('test');

      const json = tracker.export();
      expect(json).toBeDefined();

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('history');
      expect(parsed).toHaveProperty('aggregated');
    });

    it('should export as OpenTelemetry', () => {
      tracker.start('test');
      tracker.end('test', {
        tokens: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          model: 'gpt-4',
        },
      });

      const otelTraces = tracker.exportOTel();

      expect(otelTraces).toHaveLength(1);
      expect(otelTraces[0]).toHaveProperty('traceId');
      expect(otelTraces[0]).toHaveProperty('spanId');
      expect(otelTraces[0].name).toBe('test');
      expect(otelTraces[0].attributes['societyai.success']).toBe(true);
    });

    it('should clear history', () => {
      tracker.start('test');
      tracker.end('test');

      tracker.clearHistory();

      const history = tracker.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('TokenCounter', () => {
    it('should estimate token count', () => {
      const text = 'This is a test message with some words';
      const tokens = TokenCounter.estimate(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should count tokens for prompt and response', () => {
      const prompt = 'What is TypeScript?';
      const response = 'TypeScript is a typed superset of JavaScript.';

      const metrics = TokenCounter.count(prompt, response);

      expect(metrics.inputTokens).toBeGreaterThan(0);
      expect(metrics.outputTokens).toBeGreaterThan(0);
      expect(metrics.totalTokens).toBe(metrics.inputTokens + metrics.outputTokens);
    });
  });

  describe('PerformanceProfiler', () => {
    let profiler: PerformanceProfiler;

    beforeEach(() => {
      profiler = new PerformanceProfiler();
    });

    it('should mark and measure durations', async () => {
      profiler.mark('start');
      await new Promise((resolve) => setTimeout(resolve, 50));
      profiler.mark('end');

      const duration = profiler.measure('test', 'start', 'end');

      expect(duration).toBeGreaterThanOrEqual(45);
    });

    it('should measure to current time if end mark is missing', () => {
      profiler.mark('start');
      const duration = profiler.measure('test', 'start');

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for missing marks', () => {
      expect(() => {
        profiler.measure('test', 'nonexistent');
      }).toThrow('Start mark not found');
    });

    it('should get all measures', async () => {
      profiler.mark('m1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      profiler.mark('m2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      profiler.mark('m3');

      profiler.measure('phase1', 'm1', 'm2');
      profiler.measure('phase2', 'm2', 'm3');

      const measures = profiler.getMeasures();

      expect(measures).toHaveProperty('phase1');
      expect(measures).toHaveProperty('phase2');
    });

    it('should clear marks and measures', () => {
      profiler.mark('test');
      profiler.measure('test-measure', 'test');

      profiler.clear();

      const measures = profiler.getMeasures();
      expect(Object.keys(measures)).toHaveLength(0);
    });
  });

  describe('MetricsBuilder', () => {
    it('should create tracker with token tracking', () => {
      const tracker = MetricsBuilder.create().withTokenTracking().build();

      expect(tracker).toBeInstanceOf(MetricsTracker);
    });

    it('should create tracker with cost tracking', () => {
      const tracker = MetricsBuilder.create().withCostTracking(CommonCostConfigs['gpt-4']).build();

      expect(tracker).toBeInstanceOf(MetricsTracker);
    });

    it('should create tracker with multiple cost configs', () => {
      const tracker = MetricsBuilder.create()
        .withTokenTracking()
        .withCostTracking(CommonCostConfigs['gpt-4'])
        .withCostTracking(CommonCostConfigs['claude-3-sonnet'])
        .build();

      expect(tracker).toBeInstanceOf(MetricsTracker);
    });
  });

  describe('CommonCostConfigs', () => {
    it('should have configs for common models', () => {
      expect(CommonCostConfigs['gpt-4']).toBeDefined();
      expect(CommonCostConfigs['gpt-4-turbo']).toBeDefined();
      expect(CommonCostConfigs['gpt-3.5-turbo']).toBeDefined();
      expect(CommonCostConfigs['claude-3-opus']).toBeDefined();
      expect(CommonCostConfigs['claude-3-sonnet']).toBeDefined();
    });

    it('should have valid cost configurations', () => {
      const config = CommonCostConfigs['gpt-4'];

      expect(config.model).toBe('gpt-4');
      expect(config.inputCostPer1K).toBeGreaterThan(0);
      expect(config.outputCostPer1K).toBeGreaterThan(0);
      expect(config.currency).toBe('USD');
    });
  });
});
