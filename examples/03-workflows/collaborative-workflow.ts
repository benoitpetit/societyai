/**
 * Example: Collaborative Workflow
 * 
 * Agents discuss and iterate together to reach consensus.
 * Ideal for complex problems requiring multiple perspectives.
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
} from '../../src';

/**
 * Model that can reference previous discussions
 */
class CollaborativeModel extends StandardModelBase {
  constructor(
    name: string,
    private role: string
  ) {
    super(
      { name, timeout: 15000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return `[${role}] (${name}): Based on the discussion, I think... ` +
          `${String(prompt).substring(0, 50)}...`;
      }
    );
  }
}

/**
 * Example 1: Basic Collaborative Discussion
 */
async function basicCollaboration(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Collaborative Discussion');
  console.log('='.repeat(60) + '\n');

  // Create a discussion panel
  const panelMembers = [
    { id: 'optimist', name: 'Optimist', perspective: 'positive possibilities' },
    { id: 'skeptic', name: 'Skeptic', perspective: 'potential risks' },
    { id: 'pragmatist', name: 'Pragmatist', perspective: 'practical implementation' },
    { id: 'visionary', name: 'Visionary', perspective: 'long-term implications' },
  ];

  const agents = panelMembers.map(member =>
    new AgentBuilder(member.id)
      .withRole(
        new RoleBuilder(member.name)
          
          .withSystemPrompt(`You approach problems from the perspective of ${member.perspective}. Engage with other perspectives constructively.`)
          .build()
      )
      .withModel(new CollaborativeModel(`Model-${member.id}`, member.name))
      .build()
  );

  // Collaborative step where all agents discuss
  const discussionStep = new StepBuilder('discussion')
    .withName('Panel Discussion')
    .withDescription('All panel members share and debate perspectives')
    .withAgents(agents.map(a => a.id))
    .withExecutionType('collaborative')
    .build();

  const workflow = new WorkflowConfigBuilder('panel-discussion')
    .withName('Collaborative Panel Discussion')
    .addSteps([discussionStep])
    .withAgents(agents)
    .build();

  console.log('Panel Members:');
  panelMembers.forEach(m => console.log(`  • ${m.name}: ${m.perspective}`));
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Should we invest in autonomous vehicle technology?',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nDiscussion Complete:');
  console.log(`  Participants: ${panelMembers.length}`);
  console.log(`  Duration: ${result.totalDuration}ms`);
  console.log(`  Status: ${result.success ? '✓ Consensus process completed' : '✗ Failed'}`);
}

/**
 * Example 2: Multi-Round Deliberation
 */
async function multiRoundDeliberation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Multi-Round Deliberation');
  console.log('='.repeat(60) + '\n');

  const agents = [
    new AgentBuilder('analyst')
      .withRole(new RoleBuilder('Analyst').build())
      .withModel(new CollaborativeModel('GPT-4', 'Analyst'))
      .build(),
    new AgentBuilder('critic')
      .withRole(new RoleBuilder('Critic').build())
      .withModel(new CollaborativeModel('GPT-4', 'Critic'))
      .build(),
    new AgentBuilder('mediator')
      .withRole(new RoleBuilder('Mediator').build())
      .withModel(new CollaborativeModel('GPT-4', 'Mediator'))
      .build(),
  ];

  // Multiple rounds of discussion
  const rounds = [
    { id: 'round-1', name: 'Initial Positions', description: 'Each participant states their initial view' },
    { id: 'round-2', name: 'Challenges', description: 'Participants challenge each other\'s positions' },
    { id: 'round-3', name: 'Refinement', description: 'Positions are refined based on feedback' },
    { id: 'round-4', name: 'Synthesis', description: 'Final synthesis and consensus' },
  ];

  const steps = rounds.map(round =>
    new StepBuilder(round.id)
      .withName(round.name)
      .withDescription(round.description)
      .withAgents(agents.map(a => a.id))
      .withExecutionType('collaborative')
      .build()
  );

  const workflow = new WorkflowConfigBuilder('deliberation')
    .withName('Multi-Round Deliberation')
    .addSteps(steps)
    .withAgents(agents)
    .build();

  console.log('Deliberation Rounds:');
  rounds.forEach((r, i) => console.log(`  ${i + 1}. ${r.name}: ${r.description}`));
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Develop a policy for remote work in the organization',
    stepResults: new Map(),
    metadata: { totalRounds: rounds.length },
  });

  console.log('\nDeliberation Summary:');
  result.stepResults.forEach((stepResult, stepId) => {
    console.log(`  ${stepId}: ${stepResult.success ? '✓' : '✗'} (${stepResult.duration}ms)`);
  });
  console.log(`  Total: ${result.totalDuration}ms`);
}

/**
 * Example 3: Design Review Process
 */
async function designReviewProcess(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Collaborative Design Review');
  console.log('='.repeat(60) + '\n');

  // Design review participants
  const reviewers = [
    { id: 'architect', name: 'Solution Architect', focus: 'overall architecture' },
    { id: 'security', name: 'Security Expert', focus: 'security implications' },
    { id: 'performance', name: 'Performance Engineer', focus: 'performance optimization' },
    { id: 'ux', name: 'UX Designer', focus: 'user experience' },
    { id: 'ops', name: 'DevOps Engineer', focus: 'operability and deployment' },
  ];

  const agents = reviewers.map(reviewer =>
    new AgentBuilder(reviewer.id)
      .withRole(
        new RoleBuilder(reviewer.name)
          
          .withSystemPrompt(`Review designs focusing on ${reviewer.focus}. Collaborate with other reviewers to provide comprehensive feedback.`)
          .withCapabilities([reviewer.focus.replace(' ', '-')])
          .build()
      )
      .withModel(new CollaborativeModel(`Model-${reviewer.id}`, reviewer.name))
      .build()
  );

  const steps = [
    // Individual review phase
    new StepBuilder('individual-review')
      .withName('Individual Reviews')
      .withDescription('Each expert reviews from their perspective')
      .withAgents(agents.map(a => a.id))
      .withExecutionType('parallel')
      .build(),

    // Collaborative discussion
    new StepBuilder('collaborative-review')
      .withName('Collaborative Discussion')
      .withDescription('Experts discuss and address cross-cutting concerns')
      .withAgents(agents.map(a => a.id))
      .withExecutionType('collaborative')
      .build(),

    // Final recommendations
    new StepBuilder('recommendations')
      .withName('Final Recommendations')
      .withDescription('Unified recommendations from all reviewers')
      .withAgents(agents.map(a => a.id))
      .withExecutionType('collaborative')
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('design-review')
    .withName('Design Review Process')
    .addSteps(steps)
    .withAgents(agents)
    .build();

  console.log('Review Team:');
  reviewers.forEach(r => console.log(`  • ${r.name}: ${r.focus}`));
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Review the proposed microservices architecture for the e-commerce platform',
    stepResults: new Map(),
    metadata: { designDocument: 'architecture-v2.0' },
  });

  console.log('\nDesign Review Complete:');
  console.log(`  Reviewers: ${reviewers.length}`);
  console.log(`  Phases: Individual → Collaborative → Recommendations`);
  console.log(`  Total time: ${result.totalDuration}ms`);
}

/**
 * Example 4: Problem-Solving Session
 */
async function problemSolvingSession(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Collaborative Problem Solving');
  console.log('='.repeat(60) + '\n');

  // Problem-solving roles
  const solvers = [
    { id: 'definer', name: 'Problem Definer', task: 'clarify the problem' },
    { id: 'ideator', name: 'Ideator', task: 'generate solutions' },
    { id: 'evaluator', name: 'Evaluator', task: 'assess solutions' },
    { id: 'implementer', name: 'Implementation Planner', task: 'plan execution' },
  ];

  const agents = solvers.map(solver =>
    new AgentBuilder(solver.id)
      .withRole(
        new RoleBuilder(solver.name)
          
          .withSystemPrompt(`Your role is to ${solver.task}. Work with others to solve the problem effectively.`)
          .build()
      )
      .withModel(new CollaborativeModel(`Model-${solver.id}`, solver.name))
      .build()
  );

  const workflow = new WorkflowConfigBuilder('problem-solving')
    .withName('Problem Solving Session')
    .addSteps([
      new StepBuilder('define')
        .withName('Problem Definition')
        .withAgents(['definer'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('ideate')
        .withName('Ideation')
        .withAgents(['ideator', 'definer'])
        .withExecutionType('collaborative')
        .build(),

      new StepBuilder('evaluate')
        .withName('Solution Evaluation')
        .withAgents(['evaluator', 'ideator'])
        .withExecutionType('collaborative')
        .build(),

      new StepBuilder('plan')
        .withName('Implementation Planning')
        .withAgents(agents.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(agents)
    .build();

  console.log('Problem Solving Process:');
  console.log('  1. Define → 2. Ideate → 3. Evaluate → 4. Plan');
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'How can we reduce customer churn by 20% in Q4?',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nProblem Solving Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
  console.log(`  Status: ${result.success ? '✓ Solution developed' : '✗ Incomplete'}`);
}

/**
 * Example 5: Collaborative Writing
 */
async function collaborativeWriting(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Collaborative Writing');
  console.log('='.repeat(60) + '\n');

  const writers = [
    { id: 'researcher', name: 'Content Researcher', role: 'gather facts and data' },
    { id: 'writer', name: 'Lead Writer', role: 'draft the content' },
    { id: 'editor', name: 'Editor', role: 'improve clarity and flow' },
    { id: 'fact-checker', name: 'Fact Checker', role: 'verify accuracy' },
  ];

  const agents = writers.map(w =>
    new AgentBuilder(w.id)
      .withRole(
        new RoleBuilder(w.name)
          
          .withSystemPrompt(`Your role: ${w.role}. Collaborate with the team to produce high-quality content.`)
          .build()
      )
      .withModel(new CollaborativeModel(`Model-${w.id}`, w.name))
      .build()
  );

  const steps = [
    new StepBuilder('research')
      .withName('Research Phase')
      .withAgents(['researcher'])
      .withExecutionType('sequential')
      .build(),

    new StepBuilder('draft')
      .withName('Drafting')
      .withAgents(['writer', 'researcher'])
      .withExecutionType('collaborative')
      .build(),

    new StepBuilder('review')
      .withName('Review & Edit')
      .withAgents(['editor', 'fact-checker', 'writer'])
      .withExecutionType('collaborative')
      .build(),

    new StepBuilder('finalize')
      .withName('Final Polish')
      .withAgents(agents.map(a => a.id))
      .withExecutionType('collaborative')
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('collaborative-writing')
    .withName('Collaborative Writing Process')
    .addSteps(steps)
    .withAgents(agents)
    .build();

  console.log('Writing Team:');
  writers.forEach(w => console.log(`  • ${w.name}: ${w.role}`));
  console.log('');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Write a comprehensive guide on sustainable investing for beginners',
    stepResults: new Map(),
    metadata: { targetLength: '3000 words' },
  });

  console.log('\nWriting Process Complete:');
  result.stepResults.forEach((stepResult, stepId) => {
    console.log(`  ${stepId}: ${stepResult.duration}ms`);
  });
  console.log(`  Total: ${result.totalDuration}ms`);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicCollaboration();
    await multiRoundDeliberation();
    await designReviewProcess();
    await problemSolvingSession();
    await collaborativeWriting();

    console.log('\n✨ All collaborative workflow examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  basicCollaboration,
  multiRoundDeliberation,
  designReviewProcess,
  problemSolvingSession,
  collaborativeWriting,
};
