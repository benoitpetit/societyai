import { 
  GraphBuilder, 
  NodeType, 
  SocietyAsModel, 
  PipelinePatterns,
  AgentBuilder,
  RoleBuilder,
  AIModel
} from '../src';

// Simple Mock Model for demonstration
class MockModel implements AIModel {
  constructor(private nameStr: string) {}
  
  name(): string { return this.nameStr; }
  
  async process(prompt: unknown): Promise<string> {
    return `[Response from ${this.nameStr} to: "${String(prompt).substring(0, 20)}..."]`;
  }
  
  supportsPromptType(): boolean { return true; }
}

async function demonstrateRecursiveSociety(): Promise<void> {
  console.log('=== Recursive Society Demo ===');
  
  // 1. Create a Sub-Society (e.g., a "Translation Team")
  const translator = AgentBuilder.create()
    .withId('translator')
    .withName('Translator')
    .withRole(RoleBuilder.create().withId('translator').withSystemPrompt('Translate to French').build())
    .withModel(new MockModel('TranslatorBot'))
    .build();
    
  const editor = AgentBuilder.create()
    .withId('editor')
    .withName('Editor')
    .withRole(RoleBuilder.create().withId('editor').withSystemPrompt('Fix grammar').build())
    .withModel(new MockModel('EditorBot'))
    .build();
    
  const teamGraph = GraphBuilder.create()
    .addNode('start', NodeType.START)
    .addNode('translate', NodeType.AGENT, { agentId: 'translator' })
    .addNode('edit', NodeType.AGENT, { agentId: 'editor' })
    .addNode('end', NodeType.END)
    .addEdge('start', 'translate')
    .addEdge('translate', 'edit')
    .addEdge('edit', 'end')
    .build();
    
  // Wrap the society as an AI Model
  const translationTeamModel = new SocietyAsModel(
    teamGraph, 
    [translator, editor], 
    { name: 'TranslationTeam' }
  );
  
  // 2. Create the Main Society that uses the sub-society
  const projectManager = AgentBuilder.create()
    .withId('pm')
    .withName('ProjectManager')
    .withRole(RoleBuilder.create().withId('pm').withSystemPrompt('Manage project').build())
    .withModel(new MockModel('ManagerBot'))
    .build();
    
  const translationAgent = AgentBuilder.create()
    .withId('translation_dept')
    .withName('Translation Department')
    .withRole(RoleBuilder.create().withId('dept').withSystemPrompt('Handle translations').build())
    .withModel(translationTeamModel) // Using the sub-society as the model
    .build();
    
  const companyGraph = GraphBuilder.create()
    .addNode('start', NodeType.START)
    .addNode('plan', NodeType.AGENT, { agentId: 'pm' })
    .addNode('execute', NodeType.AGENT, { agentId: 'translation_dept' })
    .addNode('end', NodeType.END)
    .addEdge('start', 'plan')
    .addEdge('plan', 'execute')
    .addEdge('execute', 'end')
    .build();
    
  console.log('Main Society Structure (Mermaid):');
  console.log(companyGraph.toMermaid());
  
  // Execute
  const result = await companyGraph.execute(
    'Please translate the documentation', 
    [projectManager, translationAgent]
  );
  
  console.log('\nFinal Output:', result.output);
}

async function demonstratePatterns(): Promise<void> {
  console.log('\n=== Patterns Demo ===');
  
  // Create a Self-Correction Graph
  const correctionGraph = PipelinePatterns.selfCorrection(
    'generator_agent',
    'validator_agent',
    3
  );
  
  console.log('Self-Correction Pattern Structure:');
  console.log(correctionGraph.visualize());
}

async function main(): Promise<void> {
  await demonstrateRecursiveSociety();
  await demonstratePatterns();
}

main().catch(console.error);
