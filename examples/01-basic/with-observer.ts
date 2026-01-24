/**
 * Example: Using Observers
 * 
 * Monitor the society execution with the observer pattern.
 * Useful for logging, debugging, and UI updates.
 */

import { society, societyCollaborative, StandardModelBase, SocietyObserver, setGlobalLogLevel, LogLevel } from '../../src';

setGlobalLogLevel(LogLevel.SILENT); // We'll use our own logging via observer

/**
 * Simple simulated model
 */
class SimulatedModel extends StandardModelBase {
  constructor(name = 'SimulatedAI') {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
        return `Response from ${name}: Analyzed "${String(prompt).substring(0, 30)}..."`;
      }
    );
  }
}

/**
 * Example 1: Basic Console Observer
 */
async function basicObserver(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Console Observer');
  console.log('='.repeat(60) + '\n');

  const observer: SocietyObserver = {
    onSocietyStart(prompt: string, agentCount: number): void {
      console.log(`🏁 Society started with ${agentCount} agents`);
      console.log(`📝 Prompt: "${prompt.substring(0, 50)}..."`);
    },

    onAgentStart(agentId: number, modelName: string, _prompt: unknown): void {
      console.log(`  🤖 Agent ${agentId} (${modelName}) starting...`);
    },

    onAgentComplete(agentId: number, modelName: string, _result: string): void {
      console.log(`  ✅ Agent ${agentId} (${modelName}) completed`);
    },

    onAgentError(agentId: number, modelName: string, error: Error): void {
      console.log(`  ❌ Agent ${agentId} (${modelName}) failed: ${error.message}`);
    },

    onPhaseStart(phase: string): void {
      console.log(`\n📍 Phase started: ${phase}`);
    },

    onPhaseComplete(phase: string): void {
      console.log(`✓ Phase completed: ${phase}`);
    },

    onSocietyComplete(_finalResult: string): void {
      console.log(`\n🎉 Society completed successfully!`);
    },
  };

  const model = new SimulatedModel('GPT-4');
  await society('Analyze climate change solutions', 3, [model], false, observer);
}

/**
 * Example 2: Progress Tracking Observer
 */
async function progressObserver(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Progress Tracking Observer');
  console.log('='.repeat(60) + '\n');

  let totalAgents = 0;
  let completedAgents = 0;
  const startTime = Date.now();

  const observer: SocietyObserver = {
    onSocietyStart(_prompt: string, agentCount: number): void {
      totalAgents = agentCount;
      completedAgents = 0;
      console.log(`Starting... [0/${totalAgents}]`);
    },

    onAgentStart(_agentId: number, _modelName: string, _prompt: unknown): void {
      // Silent
    },

    onAgentComplete(_agentId: number, _modelName: string, _result: string): void {
      completedAgents++;
      const progress = Math.round((completedAgents / totalAgents) * 100);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Progress: [${'█'.repeat(progress / 5)}${'░'.repeat(20 - progress / 5)}] ${progress}% (${elapsed}s)`);
    },

    onAgentError(_agentId: number, _modelName: string, _error: Error): void {
      completedAgents++;
    },

    onPhaseStart(_phase: string): void {},
    onPhaseComplete(_phase: string): void {},

    onSocietyComplete(_finalResult: string): void {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✓ Completed in ${totalTime}s`);
    },
  };

  const model = new SimulatedModel('Claude');
  await society('Discuss AI ethics', 5, [model], false, observer);
}

/**
 * Example 3: Detailed Metrics Observer
 */
async function metricsObserver(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Metrics Collection Observer');
  console.log('='.repeat(60) + '\n');

  interface AgentMetrics {
    agentId: number;
    modelName: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    resultLength?: number;
  }

  const metrics: {
    startTime: number;
    agents: Map<number, AgentMetrics>;
    phases: string[];
    totalDuration?: number;
  } = {
    startTime: 0,
    agents: new Map(),
    phases: [],
  };

  const observer: SocietyObserver = {
    onSocietyStart(_prompt: string, _agentCount: number): void {
      metrics.startTime = Date.now();
    },

    onAgentStart(agentId: number, modelName: string, _prompt: unknown): void {
      metrics.agents.set(agentId, {
        agentId,
        modelName,
        startTime: Date.now(),
        success: false,
      });
    },

    onAgentComplete(agentId: number, _modelName: string, result: string): void {
      const agent = metrics.agents.get(agentId);
      if (agent) {
        agent.endTime = Date.now();
        agent.duration = agent.endTime - agent.startTime;
        agent.success = true;
        agent.resultLength = result.length;
      }
    },

    onAgentError(agentId: number, _modelName: string, _error: Error): void {
      const agent = metrics.agents.get(agentId);
      if (agent) {
        agent.endTime = Date.now();
        agent.duration = agent.endTime - agent.startTime;
        agent.success = false;
      }
    },

    onPhaseStart(phase: string): void {
      metrics.phases.push(phase);
    },

    onPhaseComplete(_phase: string): void {},

    onSocietyComplete(_finalResult: string): void {
      metrics.totalDuration = Date.now() - metrics.startTime;
    },
  };

  const model = new SimulatedModel('Gemini');
  await societyCollaborative('Explore future of work', 3, [model], false, observer);

  // Display collected metrics
  console.log('\n📊 Execution Metrics:');
  console.log('-'.repeat(40));
  console.log(`Total Duration: ${metrics.totalDuration}ms`);
  console.log(`Phases: ${metrics.phases.join(' → ')}`);
  console.log('\nAgent Performance:');
  
  for (const [id, agent] of metrics.agents) {
    console.log(`  Agent ${id} (${agent.modelName}):`);
    console.log(`    Duration: ${agent.duration}ms`);
    console.log(`    Success: ${agent.success ? '✓' : '✗'}`);
    if (agent.resultLength) {
      console.log(`    Result Length: ${agent.resultLength} chars`);
    }
  }

  // Calculate averages
  const durations = Array.from(metrics.agents.values())
    .map(a => a.duration || 0);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  
  console.log(`\nAverage Agent Duration: ${avgDuration.toFixed(0)}ms`);
}

/**
 * Example 4: Custom Event Emitter Observer
 */
async function eventEmitterObserver(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Event-based Observer');
  console.log('='.repeat(60) + '\n');

  // Simulate an event emitter pattern
  type EventType = 'start' | 'agent' | 'phase' | 'complete' | 'error';
  const events: Array<{ type: EventType; timestamp: number; data: unknown }> = [];

  const emit = (type: EventType, data: unknown): void => {
    events.push({ type, timestamp: Date.now(), data });
  };

  const observer: SocietyObserver = {
    onSocietyStart(prompt: string, agentCount: number): void {
      emit('start', { prompt: prompt.substring(0, 50), agentCount });
    },

    onAgentStart(agentId: number, modelName: string, _prompt: unknown): void {
      emit('agent', { agentId, modelName, status: 'started' });
    },

    onAgentComplete(agentId: number, modelName: string, _result: string): void {
      emit('agent', { agentId, modelName, status: 'completed' });
    },

    onAgentError(agentId: number, modelName: string, error: Error): void {
      emit('error', { agentId, modelName, error: error.message });
    },

    onPhaseStart(phase: string): void {
      emit('phase', { phase, status: 'started' });
    },

    onPhaseComplete(phase: string): void {
      emit('phase', { phase, status: 'completed' });
    },

    onSocietyComplete(_finalResult: string): void {
      emit('complete', { success: true });
    },
  };

  const model = new SimulatedModel('GPT-4');
  await society('Analyze market trends', 2, [model], false, observer);

  // Display event log
  console.log('\n📋 Event Log:');
  events.forEach((event, index) => {
    console.log(`  ${index + 1}. [${event.type.toUpperCase()}] ${JSON.stringify(event.data)}`);
  });
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicObserver();
    await progressObserver();
    await metricsObserver();
    await eventEmitterObserver();

    console.log('\n✨ All observer examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { basicObserver, progressObserver, metricsObserver, eventEmitterObserver };
