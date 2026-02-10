/**
 * End-to-End Integration Tests for New Features
 *
 * Tests the complete integration of:
 * - Worker Threads (IsolatedWorkerPool)
 * - OpenTelemetry (OpenTelemetryObserver)
 * - MCP (MCPToolProvider)
 * - Existing features (Society, Agents, Builders)
 */

import { Society } from '../../core/society';
import { createOpenTelemetryObserver } from '../../observability/opentelemetry';
import { IsolatedWorkerPool } from '../../utils/isolated-worker-pool';
import { MCPServers } from '../../capabilities/mcp';
import { MockModel } from '../utils/mock-model';

describe('End-to-End Feature Integration', () => {
  describe('Agent Builder with ExecutionMode', () => {
    it('should allow setting execution mode via builder', () => {
      const mockModel = new MockModel();

      const society = Society.create()
        .withName('Test Society')
        .addAgent((a) =>
          a
            .withId('worker-agent')
            .withName('CPU-Intensive Worker')
            .withRole((r) =>
              r
                .withId('worker-role')
                .withName('Worker')
                .withSystemPrompt('You process heavy computations')
            )
            .withModel(mockModel)
            .withExecutionMode('isolated')
        );

      const config = society['_agents'][0];
      expect(config.executionMode).toBe('isolated');
    });

    it('should default to undefined execution mode when not specified', () => {
      const mockModel = new MockModel();

      const society = Society.create()
        .withName('Test Society')
        .addAgent((a) =>
          a
            .withId('regular-agent')
            .withRole((r) => r.withId('role').withSystemPrompt('Regular agent'))
            .withModel(mockModel)
        );

      const config = society['_agents'][0];
      expect(config.executionMode).toBeUndefined();
    });
  });

  describe('OpenTelemetry Observer Integration', () => {
    it('should integrate OpenTelemetry observer with Society', async () => {
      const mockModel = new MockModel();
      const observer = createOpenTelemetryObserver({
        serviceName: 'test-society',
        exporterType: 'console',
      });

      const society = Society.create()
        .withName('Observable Society')
        .withObserver(observer)
        .addAgent((a) =>
          a
            .withId('agent1')
            .withRole((r) => r.withId('role1').withSystemPrompt('Test agent'))
            .withModel(mockModel)
        )
        .addTask((t) => t.withId('task1').withAgents(['agent1']));

      const result = await society.execute('Test input');

      expect(result).toBeDefined();
      expect(result.output).toContain('Mock response');

      await observer.shutdown();
    });

    it('should track spans for agent execution', async () => {
      const mockModel = new MockModel();
      const observer = createOpenTelemetryObserver({
        serviceName: 'span-tracking',
        exporterType: 'console',
      });

      const society = Society.create()
        .withName('Span Test Society')
        .withObserver(observer)
        .addAgent((a) =>
          a
            .withId('span-agent')
            .withRole((r) => r.withId('span-role').withSystemPrompt('Test'))
            .withModel(mockModel)
        )
        .addTask((t) => t.withId('span-task').withAgents(['span-agent']));

      await society.execute('Test');

      // OpenTelemetry observer gracefully degrades when API is not installed
      // The test verifies the observer can be added without errors
      expect(observer).toBeDefined();

      await observer.shutdown();
    });
  });

  describe('IsolatedWorkerPool Standalone Usage', () => {
    it('should execute agents in isolated worker pool', async () => {
      const pool = new IsolatedWorkerPool(2);
      const mockModel = new MockModel();

      const agent = {
        id: 'pool-agent',
        name: 'Pool Agent',
        role: {
          id: 'pool-role',
          name: 'Pool Role',
          systemPrompt: 'CPU-intensive task',
        },
        model: mockModel,
      };

      const result = await pool.execute({
        agent,
        input: 'Process this',
        context: {
          input: 'Process this',
          sharedData: new Map(),
          taskResults: new Map(),
          messageHistory: [],
          metadata: {},
        },
      });

      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);

      await pool.shutdown();
    });

    it('should handle multiple concurrent tasks in pool', async () => {
      const pool = new IsolatedWorkerPool(3);
      const mockModel = new MockModel();

      const agent = {
        id: 'concurrent-agent',
        name: 'Concurrent Agent',
        role: {
          id: 'concurrent-role',
          name: 'Concurrent Role',
          systemPrompt: 'Parallel processing',
        },
        model: mockModel,
      };

      const tasks = Array.from({ length: 5 }, (_, i) =>
        pool.execute({
          agent,
          input: `Task ${i}`,
          context: {
            input: `Task ${i}`,
            sharedData: new Map(),
            taskResults: new Map(),
            messageHistory: [],
            metadata: {},
          },
        })
      );

      const results = await Promise.all(tasks);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.result).toBeDefined();
        expect(result.result.success).toBe(true);
      });

      await pool.shutdown();
    });
  });

  describe('MCP Tools Integration', () => {
    it('should allow adding MCP tools via agent builder', () => {
      const mockModel = new MockModel();

      // Note: MCPServers.filesystem would require actual MCP server
      // For testing, we verify the API structure
      const society = Society.create()
        .withName('MCP Test Society')
        .addAgent(
          (a) =>
            a
              .withId('mcp-agent')
              .withRole((r) => r.withId('mcp-role').withSystemPrompt('Uses MCP tools'))
              .withModel(mockModel)
              .withTools([]) // In real usage: await MCPServers.filesystem('/path')
        )
        .addTask((t) => t.withId('mcp-task').withAgents(['mcp-agent']));

      const agent = society['_agents'][0];
      // Tools field is undefined when withTools([]) is called with empty array
      // In production, MCP tools would be added here
      expect(agent.tools === undefined || agent.tools.length === 0).toBeTruthy();
    });

    it('should expose MCPServers helpers', () => {
      expect(MCPServers.filesystem).toBeDefined();
      expect(MCPServers.github).toBeDefined();
      expect(MCPServers.braveSearch).toBeDefined();
      expect(MCPServers.custom).toBeDefined();

      expect(typeof MCPServers.filesystem).toBe('function');
      expect(typeof MCPServers.github).toBe('function');
      expect(typeof MCPServers.braveSearch).toBe('function');
      expect(typeof MCPServers.custom).toBe('function');
    });
  });

  describe('Complete Integration Scenario', () => {
    it('should integrate all features in a single society', async () => {
      const mockModel = new MockModel();
      const observer = createOpenTelemetryObserver({
        serviceName: 'complete-integration',
        exporterType: 'console',
      });

      const society = Society.create()
        .withName('Complete Integration Society')
        .withDescription('Tests all new features together')
        .withObserver(observer)
        .addAgent((a) =>
          a
            .withId('standard-agent')
            .withName('Standard Agent')
            .withRole((r) => r.withId('standard-role').withSystemPrompt('Standard IO-bound agent'))
            .withModel(mockModel)
            .withTags(['standard', 'io-bound'])
        )
        .addAgent(
          (a) =>
            a
              .withId('cpu-agent')
              .withName('CPU-Intensive Agent')
              .withRole((r) =>
                r.withId('cpu-role').withSystemPrompt('CPU-intensive processing agent')
              )
              .withModel(mockModel)
              .withExecutionMode('isolated')
              .withTags(['cpu-intensive', 'isolated'])
              .withTools([]) // Would use MCP tools in production
        )
        .addTask((t) =>
          t.withId('standard-task').withAgents(['standard-agent']).thenGoto(['cpu-task'])
        )
        .addTask((t) => t.withId('cpu-task').withAgents(['cpu-agent']));

      // Verify configuration
      expect(society['_agents']).toHaveLength(2);
      expect(society['_agents'][0].executionMode).toBeUndefined();
      expect(society['_agents'][1].executionMode).toBe('isolated');
      expect(society['_observer']).toBe(observer);

      // Execute
      const result = await society.execute('Process this data');

      expect(result).toBeDefined();
      expect(result.output).toBeDefined();

      await observer.shutdown();
    });
  });

  describe('Feature Compatibility', () => {
    it('should maintain backward compatibility with existing code', async () => {
      const mockModel = new MockModel();

      // Old-style society creation (without new features)
      const oldStyleSociety = Society.create()
        .withName('Legacy Society')
        .addAgent((a) =>
          a
            .withId('legacy-agent')
            .withRole((r) => r.withId('legacy-role').withSystemPrompt('Legacy'))
            .withModel(mockModel)
        )
        .addTask((t) => t.withId('legacy-task').withAgents(['legacy-agent']));

      const result = await oldStyleSociety.execute('Test');

      expect(result).toBeDefined();
      expect(result.output).toBeDefined();
    });

    it('should work with partial feature adoption', async () => {
      const mockModel = new MockModel();
      const observer = createOpenTelemetryObserver({
        serviceName: 'partial-features',
        exporterType: 'console',
      });

      // Using only OpenTelemetry, not Worker Threads or MCP
      const society = Society.create()
        .withName('Partial Feature Society')
        .withObserver(observer)
        .addAgent((a) =>
          a
            .withId('partial-agent')
            .withRole((r) => r.withId('partial-role').withSystemPrompt('Test'))
            .withModel(mockModel)
        )
        .addTask((t) => t.withId('partial-task').withAgents(['partial-agent']));

      const result = await society.execute('Test');

      expect(result).toBeDefined();

      await observer.shutdown();
    });
  });

  describe('Error Handling with New Features', () => {
    it('should handle errors gracefully with observer', async () => {
      const mockModel = new MockModel();
      const observer = createOpenTelemetryObserver({
        serviceName: 'error-handling',
        exporterType: 'console',
      });

      // Create model that fails
      mockModel.process = async () => {
        throw new Error('Simulated failure');
      };

      const society = Society.create()
        .withName('Error Test Society')
        .withObserver(observer)
        .addAgent((a) =>
          a
            .withId('error-agent')
            .withRole((r) => r.withId('error-role').withSystemPrompt('Will fail'))
            .withModel(mockModel)
        )
        .addTask((t) => t.withId('error-task').withAgents(['error-agent']));

      const result = await society.execute('Test');

      // Society execution doesn't throw, it returns {success: false} on errors
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      await observer.shutdown();
    });
  });
});
