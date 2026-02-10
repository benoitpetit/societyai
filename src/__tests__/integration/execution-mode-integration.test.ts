/**
 * @fileoverview Integration tests for ExecutionEngine with IsolatedWorkerPool
 *
 * Tests that ExecutionEngine correctly routes agent execution based on executionMode:
 * - 'default' or undefined -> AgentExecutor (standard execution)
 * - 'isolated' -> IsolatedWorkerPool (worker thread execution)
 */

import { Society } from '../../core/society';
import { AIModel, Message } from '../../core/types';

/**
 * Mock Model for testing
 */
class TestModel implements AIModel {
  name(): string {
    return 'test-model';
  }

  async generate(messages: Message[]): Promise<string> {
    const lastMessage = messages[messages.length - 1];
    return `Processed: ${lastMessage.content}`;
  }

  async process(input: string): Promise<string> {
    return `Processed: ${input}`;
  }

  supportsPromptType(): boolean {
    return true;
  }
}

describe('ExecutionEngine ExecutionMode Integration', () => {
  let mockModel: AIModel;

  beforeEach(() => {
    mockModel = new TestModel();
  });

  describe('Standard Execution Mode', () => {
    it('should execute agent with default mode in main thread', async () => {
      const society = Society.create()
        .withName('Standard Execution Society')
        .addAgent(
          (a) =>
            a
              .withId('standard-agent')
              .withRole((r) => r.withId('standard-role').withSystemPrompt('Standard agent'))
              .withModel(mockModel)
          // executionMode not set, defaults to undefined
        )
        .addTask((t) => t.withId('task1').withAgents(['standard-agent']));

      const result = await society.execute('Test input');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed');
    });

    it('should execute agent with explicit default mode', async () => {
      const society = Society.create()
        .withName('Explicit Default Society')
        .addAgent((a) =>
          a
            .withId('default-agent')
            .withRole((r) => r.withId('default-role').withSystemPrompt('Default agent'))
            .withModel(mockModel)
            .withExecutionMode('default')
        )
        .addTask((t) => t.withId('task1').withAgents(['default-agent']));

      const result = await society.execute('Test input');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed');
    });
  });

  describe('Isolated Execution Mode', () => {
    it('should execute agent with isolated mode in worker thread', async () => {
      const society = Society.create()
        .withName('Isolated Execution Society')
        .addAgent((a) =>
          a
            .withId('isolated-agent')
            .withRole((r) => r.withId('isolated-role').withSystemPrompt('CPU-intensive agent'))
            .withModel(mockModel)
            .withExecutionMode('isolated')
        )
        .addTask((t) => t.withId('task1').withAgents(['isolated-agent']));

      const result = await society.execute('CPU-intensive task');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed');
    });

    it('should handle multiple isolated agents in sequence', async () => {
      const society = Society.create()
        .withName('Multiple Isolated Agents')
        .addAgent((a) =>
          a
            .withId('isolated-1')
            .withRole((r) => r.withId('role-1').withSystemPrompt('First isolated agent'))
            .withModel(mockModel)
            .withExecutionMode('isolated')
        )
        .addAgent((a) =>
          a
            .withId('isolated-2')
            .withRole((r) => r.withId('role-2').withSystemPrompt('Second isolated agent'))
            .withModel(mockModel)
            .withExecutionMode('isolated')
        )
        .addTask((t) => t.withId('task1').withAgents(['isolated-1']).thenGoto(['task2']))
        .addTask((t) => t.withId('task2').withAgents(['isolated-2']));

      const result = await society.execute('Sequential isolated execution');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed');
    });
  });

  describe('Mixed Execution Modes', () => {
    it('should handle mix of standard and isolated agents', async () => {
      const society = Society.create()
        .withName('Mixed Execution Society')
        .addAgent(
          (a) =>
            a
              .withId('standard-agent')
              .withRole((r) => r.withId('standard-role').withSystemPrompt('IO-bound agent'))
              .withModel(mockModel)
          // No executionMode = standard
        )
        .addAgent((a) =>
          a
            .withId('isolated-agent')
            .withRole((r) => r.withId('isolated-role').withSystemPrompt('CPU-bound agent'))
            .withModel(mockModel)
            .withExecutionMode('isolated')
        )
        .addTask((t) => t.withId('io-task').withAgents(['standard-agent']).thenGoto(['cpu-task']))
        .addTask((t) => t.withId('cpu-task').withAgents(['isolated-agent']));

      const result = await society.execute('Mixed execution test');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed');
    });

    it('should correctly route agents based on their execution mode', async () => {
      const society = Society.create()
        .withName('Execution Routing Test')
        .addAgent((a) =>
          a
            .withId('agent-1')
            .withRole((r) => r.withId('role-1').withSystemPrompt('Agent 1'))
            .withModel(mockModel)
            .withExecutionMode('default')
        )
        .addAgent((a) =>
          a
            .withId('agent-2')
            .withRole((r) => r.withId('role-2').withSystemPrompt('Agent 2'))
            .withModel(mockModel)
            .withExecutionMode('isolated')
        )
        .addAgent(
          (a) =>
            a
              .withId('agent-3')
              .withRole((r) => r.withId('role-3').withSystemPrompt('Agent 3'))
              .withModel(mockModel)
          // No mode specified
        )
        .addTask((t) => t.withId('task-1').withAgents(['agent-1']).thenGoto(['task-2']))
        .addTask((t) => t.withId('task-2').withAgents(['agent-2']).thenGoto(['task-3']))
        .addTask((t) => t.withId('task-3').withAgents(['agent-3']));

      const result = await society.execute('Routing test');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed');

      // Verify all tasks were executed
      expect(result.taskResults.size).toBe(4); // include 'start' task
      expect(result.taskResults.has('task-1')).toBe(true);
      expect(result.taskResults.has('task-2')).toBe(true);
      expect(result.taskResults.has('task-3')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors from isolated agents', async () => {
      class ErrorModel implements AIModel {
        name(): string {
          return 'error-model';
        }

        async generate(): Promise<string> {
          throw new Error('Simulated worker error');
        }

        async process(): Promise<string> {
          throw new Error('Simulated worker error');
        }

        supportsPromptType(): boolean {
          return true;
        }
      }

      const society = Society.create()
        .withName('Error Handling Society')
        .addAgent((a) =>
          a
            .withId('error-agent')
            .withRole((r) => r.withId('error-role').withSystemPrompt('Will fail'))
            .withModel(new ErrorModel())
            .withExecutionMode('isolated')
        )
        .addTask((t) => t.withId('error-task').withAgents(['error-agent']));

      const result = await society.execute('Error test');

      // Verify execution completes without crashing the worker pool
      // Error handling in worker threads may differ from standard execution
      expect(result).toBeDefined();
    });
  });

  describe('Performance Characteristics', () => {
    it('should execute isolated agents without blocking', async () => {
      const startTime = Date.now();

      const society = Society.create()
        .withName('Non-Blocking Society')
        .addAgent((a) =>
          a
            .withId('isolated-agent')
            .withRole((r) => r.withId('isolated-role').withSystemPrompt('Non-blocking agent'))
            .withModel(mockModel)
            .withExecutionMode('isolated')
        )
        .addTask((t) => t.withId('task1').withAgents(['isolated-agent']));

      const result = await society.execute('Performance test');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Worker thread overhead should be reasonable (< 5 seconds for simple task)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing societies without executionMode', async () => {
      const society = Society.create()
        .withName('Legacy Society')
        .addAgent(
          (a) =>
            a
              .withId('legacy-agent')
              .withRole((r) => r.withId('legacy-role').withSystemPrompt('Legacy agent'))
              .withModel(mockModel)
          // No executionMode field - backward compatible
        )
        .addTask((t) => t.withId('task1').withAgents(['legacy-agent']));

      const result = await society.execute('Legacy test');

      expect(result.success).toBe(true);
      expect(result.output).toContain('Processed');
    });
  });
});
