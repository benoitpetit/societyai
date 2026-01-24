/**
 * Example: Business Team
 * 
 * Business analysis, consulting, and decision-making teams.
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
 * Simulated business model
 */
class BusinessModel extends StandardModelBase {
  constructor(expertise: string) {
    super(
      { name: `Business-${expertise}`, timeout: 15000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 350));
        return `[${expertise}] Business analysis: ${String(prompt).substring(0, 80)}...`;
      }
    );
  }
}

/**
 * Strategic Consulting Team
 */
async function strategicConsultingTeam(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('STRATEGIC CONSULTING TEAM');
  console.log('='.repeat(70) + '\n');

  const team = [
    new AgentBuilder('engagement-manager')
      .withRole(
        new RoleBuilder('Engagement Manager')
          .withSystemPrompt(`You lead strategic consulting engagements.
- Define project scope and objectives
- Coordinate workstreams
- Manage client relationships
- Ensure quality and timely delivery`)
          .withCapabilities(['project-management', 'client-relations', 'quality-assurance'])
          .build()
      )
      .withModel(new BusinessModel('EM'))
      
      .build(),

    new AgentBuilder('strategy-consultant')
      .withRole(
        new RoleBuilder('Strategy Consultant')
          .withSystemPrompt(`You develop strategic recommendations.
- Analyze market dynamics
- Identify strategic options
- Evaluate trade-offs
- Build compelling business cases`)
          .withCapabilities(['strategy', 'market-analysis', 'business-case'])
          .build()
      )
      .withModel(new BusinessModel('Strategy'))
      
      .build(),

    new AgentBuilder('financial-analyst')
      .withRole(
        new RoleBuilder('Financial Analyst')
          .withSystemPrompt(`You provide financial analysis.
- Build financial models
- Conduct valuation analysis
- Assess ROI and payback
- Identify financial risks`)
          .withCapabilities(['financial-modeling', 'valuation', 'risk-assessment'])
          .build()
      )
      .withModel(new BusinessModel('Finance'))
      
      .build(),

    new AgentBuilder('operations-expert')
      .withRole(
        new RoleBuilder('Operations Expert')
          .withSystemPrompt(`You analyze operational aspects.
- Assess operational capabilities
- Identify efficiency improvements
- Design implementation roadmaps
- Estimate resource requirements`)
          .withCapabilities(['operations', 'process-improvement', 'implementation'])
          .build()
      )
      .withModel(new BusinessModel('Operations'))
      
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('strategic-consulting')
    .withName('Strategic Consulting Engagement')
    .addSteps([
      // Kickoff and scoping
      new StepBuilder('kickoff')
        .withName('Project Kickoff')
        .addAgents(['engagement-manager'])
        .withExecutionType('sequential')
        .build(),

      // Parallel analysis tracks
      new StepBuilder('analysis')
        .withName('Parallel Analysis')
        .addAgents(['strategy-consultant', 'financial-analyst', 'operations-expert'])
        .withExecutionType('parallel')
        .build(),

      // Integration session
      new StepBuilder('integration')
        .withName('Findings Integration')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),

      // Recommendation development
      new StepBuilder('recommendations')
        .withName('Recommendations')
        .addAgents(['strategy-consultant', 'engagement-manager'])
        .withExecutionType('collaborative')
        .build(),

      // Final deliverable
      new StepBuilder('deliverable')
        .withName('Final Deliverable')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Consulting Team:');
  team.forEach(member => console.log(`  • ${member.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Evaluate growth strategies for a regional bank considering digital transformation',
    stepResults: new Map(),
    metadata: { client: 'Regional Bank Corp', engagement: 'Digital Transformation Strategy' },
  });

  console.log('\nConsulting Engagement Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

/**
 * Investment Committee
 */
async function investmentCommittee(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('INVESTMENT COMMITTEE');
  console.log('='.repeat(70) + '\n');

  const committee = [
    new AgentBuilder('cio')
      .withRole(
        new RoleBuilder('Chief Investment Officer')
          .withSystemPrompt('Lead investment decisions and portfolio strategy.')
          .withCapabilities(['portfolio-management', 'asset-allocation', 'risk-oversight'])
          .build()
      )
      .withModel(new BusinessModel('CIO'))
      .build(),

    new AgentBuilder('equity-analyst')
      .withRole(
        new RoleBuilder('Equity Analyst')
          .withSystemPrompt('Analyze equity investments and provide recommendations.')
          .withCapabilities(['equity-research', 'company-analysis', 'valuation'])
          .build()
      )
      .withModel(new BusinessModel('Equity'))
      .build(),

    new AgentBuilder('risk-manager')
      .withRole(
        new RoleBuilder('Risk Manager')
          .withSystemPrompt('Assess and monitor investment risks.')
          .withCapabilities(['risk-assessment', 'portfolio-risk', 'compliance'])
          .build()
      )
      .withModel(new BusinessModel('Risk'))
      .build(),

    new AgentBuilder('macro-analyst')
      .withRole(
        new RoleBuilder('Macro Analyst')
          .withSystemPrompt('Analyze macroeconomic trends and their investment implications.')
          .withCapabilities(['macro-analysis', 'economic-forecasting', 'scenario-planning'])
          .build()
      )
      .withModel(new BusinessModel('Macro'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('investment-committee')
    .withName('Investment Committee Meeting')
    .addSteps([
      // Analysis presentations
      new StepBuilder('analysis')
        .withName('Investment Analysis')
        .addAgents(['equity-analyst', 'macro-analyst'])
        .withExecutionType('parallel')
        .build(),

      // Risk assessment
      new StepBuilder('risk-review')
        .withName('Risk Assessment')
        .addAgents(['risk-manager'])
        .withExecutionType('sequential')
        .build(),

      // Committee deliberation
      new StepBuilder('deliberation')
        .withName('Committee Deliberation')
        .withAgents(committee.map(c => c.id))
        .withExecutionType('collaborative')
        .build(),

      // Decision
      new StepBuilder('decision')
        .withName('Investment Decision')
        .addAgents(['cio'])
        .withExecutionType('sequential')
        .build(),
    ])
    .withAgents(committee)
    .build();

  console.log('Investment Committee:');
  committee.forEach(member => console.log(`  • ${member.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Evaluate proposed investment in emerging market technology sector',
    stepResults: new Map(),
    metadata: { proposal: 'EM Tech Fund Allocation' },
  });

  console.log('\nInvestment Committee Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

/**
 * Due Diligence Team
 */
async function dueDiligenceTeam(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('M&A DUE DILIGENCE TEAM');
  console.log('='.repeat(70) + '\n');

  const team = [
    new AgentBuilder('deal-lead')
      .withRole(
        new RoleBuilder('Deal Lead')
          .withSystemPrompt('Coordinate due diligence process and integrate findings.')
          .build()
      )
      .withModel(new BusinessModel('DealLead'))
      .build(),

    new AgentBuilder('financial-dd')
      .withRole(
        new RoleBuilder('Financial DD Analyst')
          .withSystemPrompt('Analyze target financial statements and quality of earnings.')
          .build()
      )
      .withModel(new BusinessModel('FinancialDD'))
      .build(),

    new AgentBuilder('commercial-dd')
      .withRole(
        new RoleBuilder('Commercial DD Analyst')
          .withSystemPrompt('Assess market position, customer relationships, and commercial viability.')
          .build()
      )
      .withModel(new BusinessModel('CommercialDD'))
      .build(),

    new AgentBuilder('legal-dd')
      .withRole(
        new RoleBuilder('Legal DD Analyst')
          .withSystemPrompt('Review contracts, liabilities, and legal risks.')
          .build()
      )
      .withModel(new BusinessModel('LegalDD'))
      .build(),

    new AgentBuilder('tech-dd')
      .withRole(
        new RoleBuilder('Technology DD Analyst')
          .withSystemPrompt('Assess technology stack, IP, and technical debt.')
          .build()
      )
      .withModel(new BusinessModel('TechDD'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('due-diligence')
    .withName('Due Diligence Process')
    .addSteps([
      // Planning
      new StepBuilder('planning')
        .withName('DD Planning')
        .addAgents(['deal-lead'])
        .withExecutionType('sequential')
        .build(),

      // Parallel workstreams
      new StepBuilder('workstreams')
        .withName('DD Workstreams')
        .addAgents(['financial-dd', 'commercial-dd', 'legal-dd', 'tech-dd'])
        .withExecutionType('parallel')
        .build(),

      // Cross-functional review
      new StepBuilder('cross-functional')
        .withName('Cross-Functional Review')
        .withAgents(team.map(t => t.id))
        .withExecutionType('collaborative')
        .build(),

      // Red flag discussion
      new StepBuilder('red-flags')
        .withName('Red Flag Analysis')
        .withAgents(team.map(t => t.id))
        .withExecutionType('collaborative')
        .build(),

      // Final report
      new StepBuilder('report')
        .withName('DD Report')
        .addAgents(['deal-lead'])
        .withExecutionType('sequential')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Due Diligence Team:');
  team.forEach(member => console.log(`  • ${member.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Conduct due diligence on SaaS company acquisition target',
    stepResults: new Map(),
    metadata: { target: 'CloudTech Inc', dealValue: '$50M' },
  });

  console.log('\nDue Diligence Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

/**
 * Executive Decision Panel
 */
async function executiveDecisionPanel(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('EXECUTIVE DECISION PANEL');
  console.log('='.repeat(70) + '\n');

  const executives = [
    { id: 'ceo', name: 'CEO', focus: 'overall strategy and vision' },
    { id: 'cfo', name: 'CFO', focus: 'financial implications' },
    { id: 'coo', name: 'COO', focus: 'operational feasibility' },
    { id: 'cmo', name: 'CMO', focus: 'market and customer impact' },
    { id: 'cto', name: 'CTO', focus: 'technology requirements' },
  ];

  const team = executives.map(exec =>
    new AgentBuilder(exec.id)
      .withRole(
        new RoleBuilder(exec.name)
          .withSystemPrompt(`You are the ${exec.name}. Focus on ${exec.focus}.`)
          .build()
      )
      .withModel(new BusinessModel(exec.name))
      .build()
  );

  const workflow = new WorkflowConfigBuilder('executive-decision')
    .withName('Executive Decision Process')
    .addSteps([
      // Individual perspectives
      new StepBuilder('perspectives')
        .withName('Individual Perspectives')
        .withAgents(team.map(t => t.id))
        .withExecutionType('parallel')
        .build(),

      // Discussion
      new StepBuilder('discussion')
        .withName('Executive Discussion')
        .withAgents(team.map(t => t.id))
        .withExecutionType('collaborative')
        .build(),

      // Decision
      new StepBuilder('decision')
        .withName('Final Decision')
        .addAgents(['ceo'])
        .withExecutionType('sequential')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Executive Panel:');
  executives.forEach(exec => console.log(`  • ${exec.name}: ${exec.focus}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Should we expand into the European market next year?',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nExecutive Decision Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await strategicConsultingTeam();
    await investmentCommittee();
    await dueDiligenceTeam();
    await executiveDecisionPanel();

    console.log('\n✨ All business team examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { strategicConsultingTeam, investmentCommittee, dueDiligenceTeam, executiveDecisionPanel };
