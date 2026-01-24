/**
 * Example: Research Team
 * 
 * Academic and business research team simulation
 * with researchers, analysts, and reviewers.
 */

import {
  RoleBuilder,
  AgentBuilder,
  StepBuilder,
  WorkflowConfigBuilder,
  DefaultWorkflowExecutor,
  MessageBus,
  StandardModelBase,
} from '../../src';

/**
 * Simulated model for research
 */
class ResearchModel extends StandardModelBase {
  constructor(specialization: string) {
    super(
      { name: `Research-${specialization}`, timeout: 15000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return `[${specialization}] Research output: ${String(prompt).substring(0, 80)}...`;
      }
    );
  }
}

/**
 * Academic Research Team
 */
async function academicResearchTeam(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('ACADEMIC RESEARCH TEAM');
  console.log('='.repeat(70) + '\n');

  // Define research roles
  const principalInvestigator = new RoleBuilder('Principal Investigator')
    
    .withSystemPrompt(`You are the Principal Investigator leading this research project.
- Define research questions and methodology
- Guide the research direction
- Ensure academic rigor and ethical standards
- Synthesize findings into coherent conclusions`)
    .withCapabilities(['research-design', 'methodology', 'synthesis'])
    .build();

  const literatureReviewer = new RoleBuilder('Literature Reviewer')
    
    .withSystemPrompt(`You conduct comprehensive literature reviews.
- Search and analyze existing research
- Identify gaps in current knowledge
- Synthesize relevant prior work
- Provide context for the research`)
    .withCapabilities(['literature-review', 'gap-analysis', 'citation'])
    .build();

  const dataAnalyst = new RoleBuilder('Data Analyst')
    
    .withSystemPrompt(`You analyze research data using statistical methods.
- Apply appropriate statistical techniques
- Identify patterns and correlations
- Validate findings statistically
- Create visualizations for results`)
    .withCapabilities(['statistical-analysis', 'data-visualization', 'validation'])
    .build();

  const peerReviewer = new RoleBuilder('Peer Reviewer')
    
    .withSystemPrompt(`You conduct rigorous peer review of research.
- Evaluate methodology and rigor
- Check for logical consistency
- Identify potential biases
- Suggest improvements`)
    .withCapabilities(['peer-review', 'methodology-critique', 'bias-detection'])
    .build();

  // Create team
  const team = [
    new AgentBuilder('pi').withRole(principalInvestigator).withModel(new ResearchModel('PI')).build(),
    new AgentBuilder('lit-reviewer').withRole(literatureReviewer).withModel(new ResearchModel('Literature')).build(),
    new AgentBuilder('data-analyst').withRole(dataAnalyst).withModel(new ResearchModel('Data')).build(),
    new AgentBuilder('peer-reviewer').withRole(peerReviewer).withModel(new ResearchModel('PeerReview')).build(),
  ];

  const workflow = new WorkflowConfigBuilder('academic-research')
    .withName('Academic Research Process')
    .addSteps([
      // Research question formulation
      new StepBuilder('question')
        .withName('Research Question Formulation')
        .addAgents(['pi'])
        .withExecutionType('sequential')
        .build(),

      // Literature review
      new StepBuilder('literature')
        .withName('Literature Review')
        .addAgents(['lit-reviewer'])
        .withExecutionType('sequential')
        .build(),

      // Methodology design
      new StepBuilder('methodology')
        .withName('Methodology Design')
        .addAgents(['pi', 'data-analyst'])
        .withExecutionType('collaborative')
        .build(),

      // Data analysis
      new StepBuilder('analysis')
        .withName('Data Analysis')
        .addAgents(['data-analyst'])
        .withExecutionType('sequential')
        .build(),

      // Internal review
      new StepBuilder('internal-review')
        .withName('Internal Review')
        .addAgents(['pi', 'peer-reviewer'])
        .withExecutionType('collaborative')
        .build(),

      // Synthesis and conclusions
      new StepBuilder('synthesis')
        .withName('Synthesis')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Research Team:');
  team.forEach(member => console.log(`  • ${member.role.name}`));

  console.log('\nResearch Phases:');
  workflow.steps.forEach((step, i) => console.log(`  ${i + 1}. ${step.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Investigate the impact of remote work on employee productivity and well-being',
    stepResults: new Map(),
    metadata: { grantNumber: 'NSF-2024-001' },
  });

  console.log('\nResearch Process Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
  console.log(`  Status: ${result.success ? '✓ Research Completed' : '✗ Incomplete'}`);
}

/**
 * Market Research Team
 */
async function marketResearchTeam(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('MARKET RESEARCH TEAM');
  console.log('='.repeat(70) + '\n');

  const team = [
    new AgentBuilder('market-analyst')
      .withRole(
        new RoleBuilder('Market Analyst')
          .withSystemPrompt('Analyze market trends, size, and growth potential.')
          .withCapabilities(['market-analysis', 'trend-identification', 'forecasting'])
          .build()
      )
      .withModel(new ResearchModel('Market'))
      .build(),

    new AgentBuilder('competitive-analyst')
      .withRole(
        new RoleBuilder('Competitive Intelligence Analyst')
          .withSystemPrompt('Analyze competitive landscape and positioning.')
          .withCapabilities(['competitive-analysis', 'swot', 'positioning'])
          .build()
      )
      .withModel(new ResearchModel('Competitive'))
      .build(),

    new AgentBuilder('consumer-researcher')
      .withRole(
        new RoleBuilder('Consumer Researcher')
          .withSystemPrompt('Analyze consumer behavior and preferences.')
          .withCapabilities(['consumer-research', 'survey-analysis', 'persona-development'])
          .build()
      )
      .withModel(new ResearchModel('Consumer'))
      .build(),

    new AgentBuilder('strategist')
      .withRole(
        new RoleBuilder('Strategy Consultant')
          .withSystemPrompt('Synthesize research into strategic recommendations.')
          .withCapabilities(['strategy', 'recommendation', 'presentation'])
          .build()
      )
      .withModel(new ResearchModel('Strategy'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('market-research')
    .withName('Market Research')
    .addSteps([
      // Parallel research tracks
      new StepBuilder('parallel-research')
        .withName('Parallel Research')
        .withDescription('Market, competitive, and consumer research')
        .addAgents(['market-analyst', 'competitive-analyst', 'consumer-researcher'])
        .withExecutionType('parallel')
        .build(),

      // Insight sharing
      new StepBuilder('insight-sharing')
        .withName('Insight Sharing')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),

      // Strategic synthesis
      new StepBuilder('strategic-synthesis')
        .withName('Strategic Synthesis')
        .addAgents(['strategist'])
        .withExecutionType('sequential')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Research Team:');
  team.forEach(member => console.log(`  • ${member.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Research the electric vehicle market opportunity in Southeast Asia',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nMarket Research Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

/**
 * Scientific Discovery Process
 */
async function scientificDiscoveryProcess(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('SCIENTIFIC DISCOVERY PROCESS');
  console.log('='.repeat(70) + '\n');

  const team = [
    new AgentBuilder('hypothesis-generator')
      .withRole(
        new RoleBuilder('Hypothesis Generator')
          .withSystemPrompt('Generate novel hypotheses based on observations and existing knowledge.')
          .build()
      )
      .withModel(new ResearchModel('Hypothesis'))
      .build(),

    new AgentBuilder('experimenter')
      .withRole(
        new RoleBuilder('Experimentalist')
          .withSystemPrompt('Design experiments to test hypotheses.')
          .build()
      )
      .withModel(new ResearchModel('Experiment'))
      .build(),

    new AgentBuilder('data-scientist')
      .withRole(
        new RoleBuilder('Data Scientist')
          .withSystemPrompt('Analyze experimental data and extract insights.')
          .build()
      )
      .withModel(new ResearchModel('DataScience'))
      .build(),

    new AgentBuilder('theorist')
      .withRole(
        new RoleBuilder('Theorist')
          .withSystemPrompt('Develop theoretical frameworks to explain findings.')
          .build()
      )
      .withModel(new ResearchModel('Theory'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('scientific-discovery')
    .withName('Scientific Discovery')
    .addSteps([
      new StepBuilder('observe')
        .withName('Observation')
        .addAgents(['hypothesis-generator'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('hypothesize')
        .withName('Hypothesis Formation')
        .addAgents(['hypothesis-generator', 'theorist'])
        .withExecutionType('collaborative')
        .build(),

      new StepBuilder('experiment')
        .withName('Experiment Design')
        .addAgents(['experimenter'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('analyze')
        .withName('Data Analysis')
        .addAgents(['data-scientist'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('theorize')
        .withName('Theory Development')
        .addAgents(['theorist', 'hypothesis-generator'])
        .withExecutionType('collaborative')
        .build(),

      new StepBuilder('conclude')
        .withName('Conclusions')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Discovery Process:');
  workflow.steps.forEach((step, i) => console.log(`  ${i + 1}. ${step.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Investigate novel materials for more efficient solar cells',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nDiscovery Process Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await academicResearchTeam();
    await marketResearchTeam();
    await scientificDiscoveryProcess();

    console.log('\n✨ All research team examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { academicResearchTeam, marketResearchTeam, scientificDiscoveryProcess };
