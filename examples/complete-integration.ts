import { GraphBuilder, NodeType, AgentConfig, AgentRole, ToolBuilder, ToolRegistry } from '../src';
import { MockModel } from './utils';

async function run(): Promise<void> {
  console.log('Running Complete Integration Example...');

  // 1. Setup Tools
  const calculator = ToolBuilder.create()
    .withName('calculator')
    .withDescription('Add numbers')
    .withParameters({
      type: 'object',
      properties: {
        a: { type: 'number', description: 'A' },
        b: { type: 'number', description: 'B' },
      },
      required: ['a', 'b'],
    })
    .withExecutor(async (params: Record<string, unknown>) => {
      const { a, b } = params as { a: number | string; b: number | string };
      return Number(a) + Number(b);
    })
    .build();

  const tools = new ToolRegistry();
  tools.register(calculator);

  // 2. Setup Agents
  const model = new MockModel('IntegrationModel');
  const agents: AgentConfig[] = [
    {
      id: 'worker',
      role: { id: 'worker', name: 'Worker', systemPrompt: 'Work hard.' } as AgentRole,
      model: model,
      initialContext: { tools: ['calculator'] },
    },
  ];

  // 3. Setup Workflow (Graph)
  const graph = GraphBuilder.create()
    .addNode('start', NodeType.START)
    .addNode('worker', NodeType.AGENT, { agentId: 'worker' })
    .addNode('end', NodeType.END)
    .addEdge('start', 'worker')
    .addEdge('worker', 'end')
    .build();

  // 4. Execute
  const result = await graph.execute('Do the job', agents);
  console.log('Integration Result:', result.output);
}

run().catch(console.error);
