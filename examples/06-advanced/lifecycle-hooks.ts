/**
 * Example: Lifecycle Hooks
 * 
 * Hook into workflow execution at various stages.
 */

import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
  MessageBus,
  StandardModelBase,
  WorkflowContext,
  WorkflowConfig,
  SocietyObserver,
  society,
} from '../../src';

/**
 * Simple model for demonstrations
 */
class SimpleModel extends StandardModelBase {
  constructor(name = 'SimpleModel') {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return `${name} response: ${String(prompt).substring(0, 50)}...`;
      }
    );
  }
}

/**
 * Example 1: Comprehensive Observer Hooks
 */
async function comprehensiveObserver(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Comprehensive Observer Hooks');
  console.log('='.repeat(60) + '\n');

  const events: Array<{ type: string; timestamp: number; data: unknown }> = [];
  const startTime = Date.now();

  const observer: SocietyObserver = {
    onSocietyStart(prompt: string, agentCount: number): void {
      events.push({
        type: 'SOCIETY_START',
        timestamp: Date.now() - startTime,
        data: { prompt: prompt.substring(0, 50), agentCount },
      });
      console.log('🚀 Society started');
    },

    onAgentStart(agentId: number, modelName: string, _prompt: unknown): void {
      events.push({
        type: 'AGENT_START',
        timestamp: Date.now() - startTime,
        data: { agentId, modelName },
      });
      console.log(`  ▶ Agent ${agentId} (${modelName}) started`);
    },

    onAgentComplete(agentId: number, modelName: string, result: string): void {
      events.push({
        type: 'AGENT_COMPLETE',
        timestamp: Date.now() - startTime,
        data: { agentId, modelName, resultLength: result.length },
      });
      console.log(`  ✓ Agent ${agentId} (${modelName}) completed`);
    },

    onAgentError(agentId: number, modelName: string, error: Error): void {
      events.push({
        type: 'AGENT_ERROR',
        timestamp: Date.now() - startTime,
        data: { agentId, modelName, error: error.message },
      });
      console.log(`  ✗ Agent ${agentId} (${modelName}) error: ${error.message}`);
    },

    onPhaseStart(phase: string): void {
      events.push({
        type: 'PHASE_START',
        timestamp: Date.now() - startTime,
        data: { phase },
      });
      console.log(`📍 Phase: ${phase}`);
    },

    onPhaseComplete(phase: string): void {
      events.push({
        type: 'PHASE_COMPLETE',
        timestamp: Date.now() - startTime,
        data: { phase },
      });
      console.log(`✓ Phase complete: ${phase}`);
    },

    onSocietyComplete(finalResult: string): void {
      events.push({
        type: 'SOCIETY_COMPLETE',
        timestamp: Date.now() - startTime,
        data: { resultLength: finalResult.length },
      });
      console.log('🎉 Society completed');
    },
  };

  const model = new SimpleModel('TestModel');
  await society('Test comprehensive hooks', 3, [model], false, observer);

  console.log('\n📋 Event Timeline:');
  events.forEach((event, i) => {
    console.log(`  ${i + 1}. +${event.timestamp}ms ${event.type}`);
  });
}

/**
 * Example 2: Workflow Lifecycle Wrapper
 */
async function workflowLifecycleWrapper(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Workflow Lifecycle Wrapper');
  console.log('='.repeat(60) + '\n');

  interface LifecycleHooks {
    beforeWorkflow?: (config: WorkflowConfig, context: WorkflowContext) => void | Promise<void>;
    afterWorkflow?: (config: WorkflowConfig, context: WorkflowContext, result: unknown) => void | Promise<void>;
    beforeStep?: (stepId: string, context: WorkflowContext) => void | Promise<void>;
    afterStep?: (stepId: string, context: WorkflowContext, result: unknown) => void | Promise<void>;
    onError?: (error: Error, context: WorkflowContext) => void | Promise<void>;
  }

  class LifecycleWorkflowExecutor extends DefaultWorkflowExecutor {
    constructor(
      messageBus: MessageBus,
      private hooks: LifecycleHooks = {}
    ) {
      super(messageBus);
    }

    async execute(config: WorkflowConfig, context: WorkflowContext) {
      try {
        // Before workflow hook
        if (this.hooks.beforeWorkflow) {
          await this.hooks.beforeWorkflow(config, context);
        }

        // Execute workflow
        const result = await super.execute(config, context);

        // After workflow hook
        if (this.hooks.afterWorkflow) {
          await this.hooks.afterWorkflow(config, context, result);
        }

        return result;
      } catch (error) {
        if (this.hooks.onError) {
          await this.hooks.onError(error as Error, context);
        }
        throw error;
      }
    }
  }

  const agents = [
    new AgentBuilder('agent-1')
      .withRole(new RoleBuilder('agent-1').withName('Agent 1').withSystemPrompt('Agent 1 role').build())
      .withModel(new SimpleModel('Model-1'))
      .build(),
    new AgentBuilder('agent-2')
      .withRole(new RoleBuilder('agent-2').withName('Agent 2').withSystemPrompt('Agent 2 role').build())
      .withModel(new SimpleModel('Model-2'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('lifecycle-demo')
    .withName('Lifecycle Demo')
    .addSteps([
      new StepBuilder('step-1')
        .withName('Step 1')
        .addAgents(['agent-1'])
        .withExecutionType('sequential')
        .build(),
      new StepBuilder('step-2')
        .withName('Step 2')
        .addAgents(['agent-2'])
        .withExecutionType('sequential')
        .build(),
    ])
    .withAgents(agents)
    .build();

  const executor = new LifecycleWorkflowExecutor(new MessageBus(), {
    beforeWorkflow: async (config, _context) => {
      console.log(`📁 Starting workflow: ${config.name}`);
      console.log(`   Steps: ${config.steps.length}`);
    },

    afterWorkflow: async (config, _context, _result) => {
      console.log(`✅ Workflow completed: ${config.name}`);
    },

    onError: async (error, _context) => {
      console.log(`❌ Workflow error: ${error.message}`);
    },
  });

  await executor.execute(workflow, {
    prompt: 'Test lifecycle',
    stepResults: new Map(),
    metadata: {},
  });
}

/**
 * Example 3: Metrics Collection Hooks
 */
async function metricsCollectionHooks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Metrics Collection Hooks');
  console.log('='.repeat(60) + '\n');

  interface Metrics {
    totalDuration: number;
    agentDurations: Map<number, number>;
    successCount: number;
    errorCount: number;
    tokenEstimates: Map<number, number>;
  }

  const metrics: Metrics = {
    totalDuration: 0,
    agentDurations: new Map(),
    successCount: 0,
    errorCount: 0,
    tokenEstimates: new Map(),
  };

  const agentStartTimes = new Map<number, number>();
  let societyStartTime = 0;

  const metricsObserver: SocietyObserver = {
    onSocietyStart(_prompt: string, _agentCount: number): void {
      societyStartTime = Date.now();
    },

    onAgentStart(agentId: number, _modelName: string, prompt: unknown): void {
      agentStartTimes.set(agentId, Date.now());
      // Estimate tokens (rough approximation)
      const tokenEstimate = Math.ceil(String(prompt).length / 4);
      metrics.tokenEstimates.set(agentId, tokenEstimate);
    },

    onAgentComplete(agentId: number, _modelName: string, result: string): void {
      const startTime = agentStartTimes.get(agentId) || Date.now();
      metrics.agentDurations.set(agentId, Date.now() - startTime);
      metrics.successCount++;
      
      // Update token estimate with response
      const currentEstimate = metrics.tokenEstimates.get(agentId) || 0;
      metrics.tokenEstimates.set(agentId, currentEstimate + Math.ceil(result.length / 4));
    },

    onAgentError(agentId: number, _modelName: string, _error: Error): void {
      const startTime = agentStartTimes.get(agentId) || Date.now();
      metrics.agentDurations.set(agentId, Date.now() - startTime);
      metrics.errorCount++;
    },

    onPhaseStart(_phase: string): void {},
    onPhaseComplete(_phase: string): void {},

    onSocietyComplete(_finalResult: string): void {
      metrics.totalDuration = Date.now() - societyStartTime;
    },
  };

  const model = new SimpleModel('MetricsModel');
  await society('Collect metrics', 5, [model], false, metricsObserver);

  console.log('📊 Metrics Report:');
  console.log(`   Total Duration: ${metrics.totalDuration}ms`);
  console.log(`   Success Count: ${metrics.successCount}`);
  console.log(`   Error Count: ${metrics.errorCount}`);
  console.log(`   Success Rate: ${((metrics.successCount / (metrics.successCount + metrics.errorCount)) * 100).toFixed(1)}%`);
  
  console.log('\n   Agent Durations:');
  metrics.agentDurations.forEach((duration, agentId) => {
    console.log(`     Agent ${agentId}: ${duration}ms`);
  });

  const totalTokens = Array.from(metrics.tokenEstimates.values()).reduce((a, b) => a + b, 0);
  console.log(`\n   Estimated Total Tokens: ~${totalTokens}`);
}

/**
 * Example 4: Logging Hooks
 */
async function loggingHooks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Structured Logging Hooks');
  console.log('='.repeat(60) + '\n');

  interface LogEntry {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
    context: Record<string, unknown>;
  }

  const logs: LogEntry[] = [];

  const log = (level: LogEntry['level'], message: string, context: Record<string, unknown> = {}): void => {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    logs.push(entry);
    
    const prefix = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    }[level];
    
    console.log(`${prefix} [${level.toUpperCase()}] ${message}`);
  };

  const loggingObserver: SocietyObserver = {
    onSocietyStart(prompt: string, agentCount: number): void {
      log('info', 'Society started', { prompt: prompt.substring(0, 50), agentCount });
    },

    onAgentStart(agentId: number, modelName: string, _prompt: unknown): void {
      log('debug', `Agent ${agentId} started`, { agentId, modelName });
    },

    onAgentComplete(agentId: number, modelName: string, result: string): void {
      log('info', `Agent ${agentId} completed`, { 
        agentId, 
        modelName, 
        resultLength: result.length 
      });
    },

    onAgentError(agentId: number, modelName: string, error: Error): void {
      log('error', `Agent ${agentId} failed`, { 
        agentId, 
        modelName, 
        error: error.message,
        stack: error.stack,
      });
    },

    onPhaseStart(phase: string): void {
      log('debug', `Phase started: ${phase}`, { phase });
    },

    onPhaseComplete(phase: string): void {
      log('debug', `Phase completed: ${phase}`, { phase });
    },

    onSocietyComplete(_finalResult: string): void {
      log('info', 'Society completed successfully', {});
    },
  };

  const model = new SimpleModel('LoggingModel');
  await society('Test logging hooks', 3, [model], false, loggingObserver);

  console.log(`\n📋 Total log entries: ${logs.length}`);
}

/**
 * Example 5: Audit Trail Hooks
 */
async function auditTrailHooks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Audit Trail Hooks');
  console.log('='.repeat(60) + '\n');

  interface AuditEntry {
    id: string;
    action: string;
    actor: string;
    timestamp: Date;
    details: Record<string, unknown>;
    parentId?: string;
  }

  const auditTrail: AuditEntry[] = [];
  let currentSocietyId = '';

  const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const audit = (action: string, actor: string, details: Record<string, unknown>, parentId?: string): void => {
    auditTrail.push({
      id: generateId(),
      action,
      actor,
      timestamp: new Date(),
      details,
      parentId,
    });
  };

  const auditObserver: SocietyObserver = {
    onSocietyStart(prompt: string, agentCount: number): void {
      currentSocietyId = generateId();
      audit('SOCIETY_INITIATED', 'system', {
        societyId: currentSocietyId,
        prompt: prompt.substring(0, 100),
        agentCount,
      });
    },

    onAgentStart(agentId: number, modelName: string, _prompt: unknown): void {
      audit('AGENT_TASK_ASSIGNED', 'scheduler', {
        agentId,
        modelName,
      }, currentSocietyId);
    },

    onAgentComplete(agentId: number, modelName: string, result: string): void {
      audit('AGENT_TASK_COMPLETED', `agent-${agentId}`, {
        modelName,
        resultHash: result.length.toString(16), // Simplified hash
      }, currentSocietyId);
    },

    onAgentError(agentId: number, modelName: string, error: Error): void {
      audit('AGENT_TASK_FAILED', `agent-${agentId}`, {
        modelName,
        errorType: error.name,
        errorMessage: error.message,
      }, currentSocietyId);
    },

    onPhaseStart(_phase: string): void {},
    onPhaseComplete(_phase: string): void {},

    onSocietyComplete(_finalResult: string): void {
      audit('SOCIETY_COMPLETED', 'system', {
        societyId: currentSocietyId,
      });
    },
  };

  const model = new SimpleModel('AuditModel');
  await society('Audit trail test', 3, [model], false, auditObserver);

  console.log('📜 Audit Trail:');
  auditTrail.forEach((entry, i) => {
    console.log(`  ${i + 1}. ${entry.action}`);
    console.log(`     Actor: ${entry.actor}`);
    console.log(`     Time: ${entry.timestamp.toISOString()}`);
    if (entry.parentId) {
      console.log(`     Parent: ${entry.parentId}`);
    }
  });
}

/**
 * Example 6: Notification Hooks
 */
async function notificationHooks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 6: Notification Hooks');
  console.log('='.repeat(60) + '\n');

  // Simulated notification channels
  const notifications = {
    slack: [] as string[],
    email: [] as string[],
    webhook: [] as string[],
  };

  const notify = (channel: keyof typeof notifications, message: string): void => {
    notifications[channel].push(message);
    console.log(`  📤 [${channel.toUpperCase()}] ${message}`);
  };

  const notificationObserver: SocietyObserver = {
    onSocietyStart(_prompt: string, agentCount: number): void {
      notify('slack', `🚀 Society started with ${agentCount} agents`);
    },

    onAgentStart(_agentId: number, _modelName: string, _prompt: unknown): void {
      // Don't notify for every agent start (too noisy)
    },

    onAgentComplete(_agentId: number, _modelName: string, _result: string): void {
      // Don't notify for every completion
    },

    onAgentError(agentId: number, modelName: string, error: Error): void {
      notify('slack', `⚠️ Agent ${agentId} (${modelName}) error: ${error.message}`);
      notify('email', `Alert: Agent failure - ${error.message}`);
    },

    onPhaseStart(_phase: string): void {},
    onPhaseComplete(_phase: string): void {},

    onSocietyComplete(_finalResult: string): void {
      notify('slack', '✅ Society completed successfully');
      notify('webhook', JSON.stringify({ event: 'society_complete', success: true }));
    },
  };

  const model = new SimpleModel('NotifyModel');
  await society('Notification test', 3, [model], false, notificationObserver);

  console.log('\n📬 Notification Summary:');
  Object.entries(notifications).forEach(([channel, messages]) => {
    console.log(`  ${channel}: ${messages.length} notifications`);
  });
}

// Run all examples
async function main(): Promise<void> {
  try {
    await comprehensiveObserver();
    await workflowLifecycleWrapper();
    await metricsCollectionHooks();
    await loggingHooks();
    await auditTrailHooks();
    await notificationHooks();

    console.log('\n✨ All lifecycle hooks examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SimpleModel };
