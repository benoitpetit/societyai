/**
 * @fileoverview Integration Test for Complete Workflow
 *
 * Tests the new DAG scheduler and conditional routing features
 */

import { DependencyGraph, Scheduler } from '../execution/scheduler';
import { ConditionalRouter, RouterConditions } from '../execution/routing';
import { Orchestrator } from '../execution/orchestrator';
import { FluentAgentBuilder } from '../builders/agent-builder';
import { FluentRoleBuilder } from '../builders/role-builder';
import { FluentStepBuilder } from '../builders/workflow-builder';
import { AIModel, WorkflowContext } from '../core/types';

describe('Complete Workflow Integration', () => {
  // Mock AI Model for testing
  class MockModel implements AIModel {
    constructor(private response: string = 'Success') {}

    name(): string {
      return 'mock-model';
    }

    supportsPromptType(_promptType: string): boolean {
      return true;
    }

    async process(_prompt: string): Promise<string> {
      return this.response;
    }
  }

  describe('DependencyGraph and Scheduler', () => {
    it('should build and validate a dependency graph', () => {
      const graph = new DependencyGraph();

      // Add steps
      graph.addStep('step1');
      graph.addStep('step2');
      graph.addStep('step3');

      // Step3 depends on Step2
      // Step2 depends on Step1
      graph.addDependency('step3', 'step2');
      graph.addDependency('step2', 'step1');

      // Validate
      expect(() => graph.validate()).not.toThrow();

      // Check dependencies
      expect(graph.getDependencies('step3')).toEqual(['step2']);
      expect(graph.getDependencies('step2')).toEqual(['step1']);
      expect(graph.getDependencies('step1')).toEqual([]);
    });

    it('should detect cycles in dependency graph', () => {
      const graph = new DependencyGraph();

      graph.addStep('step1');
      graph.addStep('step2');
      graph.addDependency('step2', 'step1');

      // Try to create a cycle
      expect(() => {
        graph.addDependency('step1', 'step2');
      }).toThrow('would create a cycle');
    });

    it('should compute topological order', () => {
      const graph = new DependencyGraph();

      graph.addStep('step1');
      graph.addStep('step2');
      graph.addStep('step3');
      graph.addDependency('step3', 'step2');
      graph.addDependency('step2', 'step1');

      const scheduler = new Scheduler(graph);
      const order = scheduler.computeOrder();

      // Step1 should come before Step2, Step2 before Step3
      const idx1 = order.indexOf('step1');
      const idx2 = order.indexOf('step2');
      const idx3 = order.indexOf('step3');

      expect(idx1).toBeLessThan(idx2);
      expect(idx2).toBeLessThan(idx3);
    });

    it('should compute execution levels for parallel execution', () => {
      const graph = new DependencyGraph();

      // Level 0: step1, step2 (no dependencies)
      graph.addStep('step1');
      graph.addStep('step2');

      // Level 1: step3, step4 (depend on step1, step2)
      graph.addStep('step3');
      graph.addStep('step4');
      graph.addDependency('step3', 'step1');
      graph.addDependency('step4', 'step2');

      // Level 2: step5 (depends on both step3 and step4)
      graph.addStep('step5');
      graph.addDependency('step5', 'step3');
      graph.addDependency('step5', 'step4');

      const scheduler = new Scheduler(graph);
      const levels = scheduler.computeLevels();

      expect(levels).toHaveLength(3);
      expect(levels[0].steps).toContain('step1');
      expect(levels[0].steps).toContain('step2');
      expect(levels[1].steps).toContain('step3');
      expect(levels[1].steps).toContain('step4');
      expect(levels[2].steps).toContain('step5');
    });

    it('should get statistics about execution plan', () => {
      const graph = new DependencyGraph();

      graph.addStep('step1');
      graph.addStep('step2');
      graph.addStep('step3');
      graph.addDependency('step3', 'step1');
      graph.addDependency('step3', 'step2');

      const scheduler = new Scheduler(graph);
      const stats = scheduler.getStatistics();

      expect(stats.totalSteps).toBe(3);
      expect(stats.totalLevels).toBe(2);
      expect(stats.maxParallelism).toBe(2); // step1 and step2 can run in parallel
    });
  });

  describe('Conditional Router', () => {
    it('should route based on success condition', () => {
      const router = new ConditionalRouter(
        [
          {
            condition: RouterConditions.allSuccess,
            nextStep: 'success-step',
          },
          {
            condition: RouterConditions.allFailed,
            nextStep: 'failure-step',
          },
        ],
        'default-step'
      );

      // All success case
      const successResults = [
        {
          agentId: 'agent1',
          stepId: 'step1',
          content: 'Success',
          timestamp: Date.now(),
          success: true,
        },
      ];
      expect(router.route(successResults)).toBe('success-step');

      // All failed case
      const failedResults = [
        {
          agentId: 'agent1',
          stepId: 'step1',
          content: '',
          timestamp: Date.now(),
          success: false,
        },
      ];
      expect(router.route(failedResults)).toBe('failure-step');

      // No condition matched - should use default
      const mixedResults = [
        {
          agentId: 'agent1',
          stepId: 'step1',
          content: 'Success',
          timestamp: Date.now(),
          success: true,
        },
        {
          agentId: 'agent2',
          stepId: 'step1',
          content: '',
          timestamp: Date.now(),
          success: false,
        },
      ];
      expect(router.route(mixedResults)).toBe('default-step');
    });

    it('should route based on content condition', () => {
      const router = new ConditionalRouter([
        {
          condition: RouterConditions.contains('error'),
          nextStep: 'error-handler',
        },
        {
          condition: RouterConditions.contains('success'),
          nextStep: 'success-handler',
        },
      ]);

      const results = [
        {
          agentId: 'agent1',
          stepId: 'step1',
          content: 'Process completed with success',
          timestamp: Date.now(),
          success: true,
        },
      ];

      expect(router.route(results)).toBe('success-handler');
    });

    it('should handle consensus-based routing', () => {
      const router = new ConditionalRouter([
        {
          condition: RouterConditions.consensus(0.7),
          nextStep: 'consensus-reached',
        },
      ]);

      // 3 out of 4 agents succeeded (75% > 70%)
      const results = [
        { agentId: 'agent1', stepId: 'step1', content: 'OK', timestamp: Date.now(), success: true },
        { agentId: 'agent2', stepId: 'step1', content: 'OK', timestamp: Date.now(), success: true },
        { agentId: 'agent3', stepId: 'step1', content: 'OK', timestamp: Date.now(), success: true },
        { agentId: 'agent4', stepId: 'step1', content: '', timestamp: Date.now(), success: false },
      ];

      expect(router.route(results)).toBe('consensus-reached');
    });
  });

  describe('Orchestrator with Strategies', () => {
    it('should execute a step using sequential strategy', async () => {
      const orchestrator = new Orchestrator();

      const step = new FluentStepBuilder()
        .withId('test-step')
        .withName('Test Step')
        .withAgents(['agent1', 'agent2'])
        .sequential()
        .build();

      const agent1 = new FluentAgentBuilder()
        .withId('agent1')
        .withRole((r: FluentRoleBuilder) =>
          r.withId('role1').withSystemPrompt('You are a test agent')
        )
        .withModel(new MockModel('Agent 1 response'))
        .build();

      const agent2 = new FluentAgentBuilder()
        .withId('agent2')
        .withRole((r: FluentRoleBuilder) =>
          r.withId('role2').withSystemPrompt('You are another test agent')
        )
        .withModel(new MockModel('Agent 2 response'))
        .build();

      const agents = new Map();
      agents.set('agent1', agent1);
      agents.set('agent2', agent2);

      const context: WorkflowContext = {
        input: 'test input',
        sharedData: new Map(),
        stepResults: new Map(),
        messageHistory: [],

        metadata: {},
      };

      const results = await orchestrator.executeStep(step, agents, context, 'test input');

      expect(results).toHaveLength(2);
      expect(results[0].agentId).toBe('agent1');
      expect(results[0].success).toBe(true);
      expect(results[1].agentId).toBe('agent2');
      expect(results[1].success).toBe(true);
    });

    it('should execute a step using parallel strategy', async () => {
      const orchestrator = new Orchestrator();

      const step = new FluentStepBuilder()
        .withId('test-step')
        .withName('Test Step')
        .withAgents(['agent1', 'agent2', 'agent3'])
        .parallel()
        .build();

      const agents = new Map();
      for (let i = 1; i <= 3; i++) {
        const agent = new FluentAgentBuilder()
          .withId(`agent${i}`)
          .withRole((r: FluentRoleBuilder) =>
            r.withId(`role${i}`).withSystemPrompt('You are a test agent')
          )
          .withModel(new MockModel(`Agent ${i} response`))
          .build();
        agents.set(`agent${i}`, agent);
      }

      const context: WorkflowContext = {
        input: 'test input',
        sharedData: new Map(),
        stepResults: new Map(),
        messageHistory: [],

        metadata: {},
      };

      const results = await orchestrator.executeStep(step, agents, context, 'test input');

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should use router to determine next steps', () => {
      const router = new ConditionalRouter([
        {
          condition: RouterConditions.allSuccess,
          nextStep: 'next-step',
        },
      ]);

      const orchestrator = new Orchestrator(router);

      const results = [
        { agentId: 'agent1', stepId: 'step1', content: 'OK', timestamp: Date.now(), success: true },
      ];

      const nextStep = orchestrator.determineNextSteps(results);
      expect(nextStep).toBe('next-step');
    });
  });

  describe('Step Builder with dependencies', () => {
    it('should build a step with dependencies', () => {
      const step = new FluentStepBuilder()
        .withId('step3')
        .withName('Step 3')
        .withAgents(['agent1'])
        .dependsOn(['step1', 'step2'])
        .build();

      expect(step.dependencies).toEqual(['step1', 'step2']);
    });

    it('should accept single dependency as string', () => {
      const step = new FluentStepBuilder()
        .withId('step2')
        .withName('Step 2')
        .withAgents(['agent1'])
        .dependsOn('step1')
        .build();

      expect(step.dependencies).toEqual(['step1']);
    });
  });
});
