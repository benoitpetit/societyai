import { GraphBuilder, NodeType, AgentConfig, AgentRole } from '../src';
import { MockModel } from './utils';

// Define agents
const model = new MockModel('GraphModel');

const agents: AgentConfig[] = [
  {
    id: 'analyst',
    name: 'Data Analyst',
    role: { id: 'analyst', name: 'Analyst', systemPrompt: 'Analyze data.' } as AgentRole,
    model: model,
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    role: { id: 'reviewer', name: 'Reviewer', systemPrompt: 'Review analysis.' } as AgentRole,
    model: model,
  },
];

// Build graph
const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('agent1', NodeType.AGENT, { agentId: 'analyst' })
  .addNode('agent2', NodeType.AGENT, { agentId: 'reviewer' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'agent1')
  .addEdge('agent1', 'agent2')
  .addEdge('agent2', 'end')
  .build();

async function run(): Promise<void> {
  console.log('Starting Graph Workflow...');
  // Note: in valid implementation you might need to handle inputs appropriately in MockModel
  // The MockModel in utils.ts just prints the prompt.
  const result = await graph.execute('Analyze market data', agents);
  console.log('Final Result:', result.output);
}

run().catch(console.error);
