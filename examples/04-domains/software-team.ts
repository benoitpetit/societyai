/**
 * Example: Software Development Team
 * 
 * A complete software development team simulation
 * with PM, developers, testers, and reviewers.
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
 * Simulated model for software development
 */
class DevModel extends StandardModelBase {
  constructor(role: string) {
    super(
      { name: `Dev-${role}`, timeout: 15000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return `[${role}] Response: ${String(prompt).substring(0, 80)}...`;
      }
    );
  }
}

/**
 * Complete Software Development Team Workflow
 */
async function softwareDevelopmentTeam(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('SOFTWARE DEVELOPMENT TEAM SIMULATION');
  console.log('='.repeat(70) + '\n');

  // Define team roles
  const productOwner = new RoleBuilder('Product Owner')
    
    .withSystemPrompt(`You are a Product Owner. Your responsibilities:
- Define and prioritize features
- Write clear user stories with acceptance criteria
- Ensure business value alignment
- Make scope decisions`)
    .withCapabilities(['requirements', 'prioritization', 'stakeholder-management'])
    .build();

  const techLead = new RoleBuilder('Technical Lead')
    
    .withSystemPrompt(`You are a Technical Lead. Your responsibilities:
- Design technical solutions
- Make architectural decisions
- Guide the development team
- Review technical approaches`)
    .withCapabilities(['architecture', 'technical-design', 'mentoring', 'code-review'])
    .build();

  const seniorDev = new RoleBuilder('Senior Developer')
    
    .withSystemPrompt(`You are a Senior Developer. Your responsibilities:
- Implement complex features
- Write clean, maintainable code
- Mentor junior developers
- Contribute to technical decisions`)
    .withCapabilities(['coding', 'debugging', 'optimization', 'mentoring'])
    .build();

  const juniorDev = new RoleBuilder('Junior Developer')
    
    .withSystemPrompt(`You are a Junior Developer. Your responsibilities:
- Implement assigned features
- Write tests for your code
- Learn from code reviews
- Ask questions when unclear`)
    .withCapabilities(['coding', 'testing', 'documentation'])
    .build();

  const qaEngineer = new RoleBuilder('QA Engineer')
    
    .withSystemPrompt(`You are a QA Engineer. Your responsibilities:
- Create test plans and cases
- Perform thorough testing
- Report bugs with clear steps
- Validate fixes and regressions`)
    .withCapabilities(['testing', 'bug-reporting', 'test-automation'])
    .build();

  const devOps = new RoleBuilder('DevOps Engineer')
    
    .withSystemPrompt(`You are a DevOps Engineer. Your responsibilities:
- Manage CI/CD pipelines
- Handle deployments
- Monitor system health
- Optimize infrastructure`)
    .withCapabilities(['deployment', 'infrastructure', 'monitoring', 'automation'])
    .build();

  // Create team members
  const team = [
    new AgentBuilder('po')
      .withRole(productOwner)
      .withModel(new DevModel('ProductOwner'))
      .build(),
    new AgentBuilder('tech-lead')
      .withRole(techLead)
      .withModel(new DevModel('TechLead'))
      .build(),
    new AgentBuilder('senior-dev')
      .withRole(seniorDev)
      .withModel(new DevModel('SeniorDev'))
      .build(),
    new AgentBuilder('junior-dev')
      .withRole(juniorDev)
      .withModel(new DevModel('JuniorDev'))
      .build(),
    new AgentBuilder('qa')
      .withRole(qaEngineer)
      .withModel(new DevModel('QA'))
      .build(),
    new AgentBuilder('devops')
      .withRole(devOps)
      .withModel(new DevModel('DevOps'))
      .build(),
  ];

  // Sprint workflow
  const sprintWorkflow = new WorkflowConfigBuilder('sprint-workflow')
    .withName('Sprint Development Workflow')
    .withDescription('Complete sprint from planning to deployment')
    .addSteps([
      // Sprint Planning
      new StepBuilder('planning')
        .withName('Sprint Planning')
        .withDescription('PO and Tech Lead plan the sprint')
        .addAgents(['po', 'tech-lead'])
        .withExecutionType('collaborative')
        .build(),

      // Technical Design
      new StepBuilder('design')
        .withName('Technical Design')
        .withDescription('Tech Lead and Senior Dev design solution')
        .addAgents(['tech-lead', 'senior-dev'])
        .withExecutionType('collaborative')
        .build(),

      // Development (parallel)
      new StepBuilder('development')
        .withName('Development')
        .withDescription('Developers implement features')
        .addAgents(['senior-dev', 'junior-dev'])
        .withExecutionType('parallel')
        .build(),

      // Code Review
      new StepBuilder('code-review')
        .withName('Code Review')
        .withDescription('Tech Lead reviews code')
        .addAgents(['tech-lead', 'senior-dev'])
        .withExecutionType('collaborative')
        .build(),

      // Testing
      new StepBuilder('testing')
        .withName('QA Testing')
        .withDescription('QA tests the features')
        .addAgents(['qa'])
        .withExecutionType('sequential')
        .build(),

      // Bug Fixes (if needed)
      new StepBuilder('bugfix')
        .withName('Bug Fixes')
        .withDescription('Fix issues found in testing')
        .addAgents(['senior-dev', 'junior-dev'])
        .withExecutionType('parallel')
        .build(),

      // Deployment
      new StepBuilder('deployment')
        .withName('Deployment')
        .withDescription('DevOps deploys to production')
        .addAgents(['devops'])
        .withExecutionType('sequential')
        .build(),

      // Sprint Review
      new StepBuilder('review')
        .withName('Sprint Review')
        .withDescription('Team reviews the sprint')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Team Composition:');
  team.forEach(member => {
    console.log(`  • ${member.role.name} (${member.role.type})`);
  });

  console.log('\nSprint Phases:');
  sprintWorkflow.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.name} - ${step.executionType}`);
  });

  console.log('\n--- Executing Sprint ---\n');

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(sprintWorkflow, {
    prompt: 'Implement user authentication feature with OAuth2 support',
    stepResults: new Map(),
    metadata: {
      sprintNumber: 12,
      storyPoints: 21,
    },
  });

  console.log('\nSprint Execution Summary:');
  result.stepResults.forEach((stepResult, stepId) => {
    const status = stepResult.success ? '✓' : '✗';
    console.log(`  ${status} ${stepId}: ${stepResult.duration}ms`);
  });
  console.log(`\nTotal Sprint Time: ${result.totalDuration}ms`);
  console.log(`Status: ${result.success ? '✓ Sprint Completed' : '✗ Sprint Failed'}`);
}

/**
 * Code Review Session
 */
async function codeReviewSession(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('CODE REVIEW SESSION');
  console.log('='.repeat(70) + '\n');

  const reviewers = [
    new AgentBuilder('security-reviewer')
      .withRole(
        new RoleBuilder('Security Reviewer')
          .withSystemPrompt('Review code for security vulnerabilities and best practices.')
          .withCapabilities(['security-audit', 'vulnerability-detection'])
          .build()
      )
      .withModel(new DevModel('Security'))
      .build(),

    new AgentBuilder('perf-reviewer')
      .withRole(
        new RoleBuilder('Performance Reviewer')
          .withSystemPrompt('Review code for performance issues and optimizations.')
          .withCapabilities(['performance-analysis', 'optimization'])
          .build()
      )
      .withModel(new DevModel('Performance'))
      .build(),

    new AgentBuilder('style-reviewer')
      .withRole(
        new RoleBuilder('Style Reviewer')
          .withSystemPrompt('Review code for style, readability, and maintainability.')
          .withCapabilities(['code-style', 'documentation'])
          .build()
      )
      .withModel(new DevModel('Style'))
      .build(),

    new AgentBuilder('logic-reviewer')
      .withRole(
        new RoleBuilder('Logic Reviewer')
          .withSystemPrompt('Review code for logical correctness and edge cases.')
          .withCapabilities(['logic-review', 'edge-case-detection'])
          .build()
      )
      .withModel(new DevModel('Logic'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('code-review')
    .withName('Comprehensive Code Review')
    .addSteps([
      // Parallel initial review
      new StepBuilder('initial-review')
        .withName('Initial Review')
        .withAgents(reviewers.map(r => r.id))
        .withExecutionType('parallel')
        .build(),

      // Collaborative discussion
      new StepBuilder('discussion')
        .withName('Review Discussion')
        .withAgents(reviewers.map(r => r.id))
        .withExecutionType('collaborative')
        .build(),

      // Final verdict
      new StepBuilder('verdict')
        .withName('Final Verdict')
        .withAgents(reviewers.map(r => r.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(reviewers)
    .build();

  console.log('Review Team:');
  reviewers.forEach(r => console.log(`  • ${r.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Review PR #123: Add payment processing module',
    stepResults: new Map(),
    metadata: { prNumber: 123 },
  });

  console.log('\nReview Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
  console.log(`  Verdict: ${result.success ? '✓ Approved' : '✗ Changes Requested'}`);
}

/**
 * Bug Triage Process
 */
async function bugTriageProcess(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('BUG TRIAGE PROCESS');
  console.log('='.repeat(70) + '\n');

  const triageTeam = [
    new AgentBuilder('triage-lead')
      .withRole(
        new RoleBuilder('Triage Lead')
          .withSystemPrompt('Lead the bug triage process and make final priority decisions.')
          .build()
      )
      .withModel(new DevModel('TriageLead'))
      .build(),

    new AgentBuilder('dev-rep')
      .withRole(
        new RoleBuilder('Developer Representative')
          .withSystemPrompt('Assess technical complexity and provide effort estimates.')
          .build()
      )
      .withModel(new DevModel('DevRep'))
      .build(),

    new AgentBuilder('support-rep')
      .withRole(
        new RoleBuilder('Support Representative')
          .withSystemPrompt('Provide customer impact assessment and urgency context.')
          .build()
      )
      .withModel(new DevModel('SupportRep'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('bug-triage')
    .withName('Bug Triage')
    .addSteps([
      new StepBuilder('assess')
        .withName('Bug Assessment')
        .withAgents(triageTeam.map(a => a.id))
        .withExecutionType('parallel')
        .build(),

      new StepBuilder('prioritize')
        .withName('Priority Discussion')
        .withAgents(triageTeam.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),

      new StepBuilder('assign')
        .withName('Assignment')
        .addAgents(['triage-lead'])
        .withExecutionType('sequential')
        .build(),
    ])
    .withAgents(triageTeam)
    .build();

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Triage bug: Users unable to reset password in mobile app',
    stepResults: new Map(),
    metadata: { ticketId: 'BUG-4521' },
  });

  console.log('Triage Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
  console.log(`  Status: ${result.success ? '✓ Triaged' : '✗ Failed'}`);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await softwareDevelopmentTeam();
    await codeReviewSession();
    await bugTriageProcess();

    console.log('\n✨ All software team examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { softwareDevelopmentTeam, codeReviewSession, bugTriageProcess };
