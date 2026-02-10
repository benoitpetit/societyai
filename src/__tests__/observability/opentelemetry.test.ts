/**
 * Tests for OpenTelemetry Observer
 */

import {
  OpenTelemetryObserver,
  createOpenTelemetryObserver,
} from '../../observability/opentelemetry';
import { Agent } from '../../core/types';

describe('OpenTelemetryObserver', () => {
  let observer: OpenTelemetryObserver;

  beforeEach(() => {
    observer = new OpenTelemetryObserver({
      serviceName: 'test-society',
      exporterType: 'console',
    });
  });

  afterEach(async () => {
    await observer.shutdown();
  });

  describe('Initialization', () => {
    it('should create observer with default config', () => {
      expect(observer).toBeDefined();
    });

    it('should create observer with custom config', () => {
      const customObserver = new OpenTelemetryObserver({
        serviceName: 'custom-society',
        exporterType: 'jaeger',
        exporterEndpoint: 'http://localhost:14268',
        globalAttributes: {
          environment: 'test',
        },
        enableMetrics: true,
        sampleRate: 0.5,
      });

      expect(customObserver).toBeDefined();
      customObserver.shutdown();
    });

    it('should work without OpenTelemetry installed', () => {
      // Should not throw error even if OpenTelemetry is not available
      expect(() => {
        new OpenTelemetryObserver({
          serviceName: 'test',
        });
      }).not.toThrow();
    });
  });

  describe('Society Events', () => {
    it('should handle society start event', () => {
      expect(() => {
        observer.onSocietyStart('test prompt', 3);
      }).not.toThrow();
    });

    it('should handle society complete event', () => {
      observer.onSocietyStart('test prompt', 3);

      expect(() => {
        observer.onSocietyComplete('test output');
      }).not.toThrow();
    });

    it('should handle society error event', () => {
      observer.onSocietyStart('test prompt', 3);

      expect(() => {
        observer.onSocietyError(new Error('Test error'));
      }).not.toThrow();
    });
  });

  describe('Node Events', () => {
    it('should handle node start event', () => {
      expect(() => {
        observer.onNodeStart('node-1', 'test input');
      }).not.toThrow();
    });

    it('should handle node end event', () => {
      observer.onNodeStart('node-1', 'test input');

      expect(() => {
        observer.onNodeEnd('node-1', 'test output', 100);
      }).not.toThrow();
    });

    it('should handle node error event', () => {
      observer.onNodeStart('node-1', 'test input');

      expect(() => {
        observer.onNodeError('node-1', new Error('Node error'));
      }).not.toThrow();
    });
  });

  describe('Agent Events', () => {
    it('should handle agent start event', () => {
      expect(() => {
        observer.onAgentStart('agent-1', 'test-model', 'test input');
      }).not.toThrow();
    });

    it('should handle agent complete event', () => {
      observer.onAgentStart('agent-1', 'test-model', 'test input');

      expect(() => {
        observer.onAgentComplete('agent-1', 'test-model', 'test output');
      }).not.toThrow();
    });

    it('should handle agent error event', () => {
      observer.onAgentStart('agent-1', 'test-model', 'test input');

      expect(() => {
        observer.onAgentError('agent-1', 'test-model', new Error('Agent error'));
      }).not.toThrow();
    });
  });

  describe('Task Events', () => {
    const mockAgent: Agent = {
      id: 'test-agent',
      name: 'Test Agent',
      role: {
        id: 'test-role',
        name: 'Test Role',
        systemPrompt: 'You are a test agent',
      },
      model: {
        name: () => 'test-model',
        process: async () => 'test output',
        supportsPromptType: () => true,
      },
    };

    it('should handle task start event', () => {
      expect(() => {
        observer.onTaskStart('task-1', [mockAgent]);
      }).not.toThrow();
    });

    it('should handle task end event', () => {
      observer.onTaskStart('task-1', [mockAgent]);

      expect(() => {
        observer.onTaskEnd('task-1', {
          agentId: 'test-agent',
          taskId: 'task-1',
          output: 'test output',
          success: true,
          timestamp: Date.now(),
          duration: 100,
        });
      }).not.toThrow();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      observer.onSocietyStart('test prompt', 3);
      observer.onNodeStart('node-1', 'test input');
      observer.onAgentStart('agent-1', 'test-model', 'test input');

      await expect(observer.shutdown()).resolves.not.toThrow();
    });

    it('should clear all spans on shutdown', async () => {
      observer.onNodeStart('node-1', 'test input');
      observer.onNodeStart('node-2', 'test input');

      await observer.shutdown();

      // Should not throw when ending already cleaned spans
      expect(() => {
        observer.onNodeEnd('node-1', 'output', 100);
      }).not.toThrow();
    });
  });

  describe('Helper Functions', () => {
    it('should create observer using helper function', () => {
      const obs = createOpenTelemetryObserver({
        serviceName: 'test-society',
        exporterType: 'console',
      });

      expect(obs).toBeDefined();
      obs.shutdown();
    });
  });

  describe('Full Lifecycle', () => {
    it('should handle complete execution lifecycle', async () => {
      const mockAgent: Agent = {
        id: 'test-agent',
        name: 'Test Agent',
        role: {
          id: 'test-role',
          name: 'Test Role',
          systemPrompt: 'You are a test agent',
        },
        model: {
          name: () => 'test-model',
          process: async () => 'test output',
          supportsPromptType: () => true,
        },
      };

      // Full execution flow
      observer.onSocietyStart('test prompt', 3);
      observer.onTaskStart('task-1', [mockAgent]);
      observer.onNodeStart('node-1', 'test input');
      observer.onAgentStart('agent-1', 'test-model', 'test input');

      // Complete execution
      observer.onAgentComplete('agent-1', 'test-model', 'test output');
      observer.onNodeEnd('node-1', 'test output', 100);
      observer.onTaskEnd('task-1', {
        agentId: 'test-agent',
        taskId: 'task-1',
        output: 'test output',
        success: true,
        timestamp: Date.now(),
        duration: 100,
      });
      observer.onSocietyComplete('final output');

      await observer.shutdown();
    });
  });
});
