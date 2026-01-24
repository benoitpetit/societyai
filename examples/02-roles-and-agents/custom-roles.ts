/**
 * Example: Custom Roles
 * 
 * Define custom agent roles with specific behaviors,
 * system prompts, capabilities, and constraints.
 */
import { 
  RoleBuilder, 
  AgentBuilder,
  AgentRole,
  AgentConfig,
  StandardModelBase
} from '../../src';
/**
 * Simulated model for demonstration
 */
class SimulatedModel extends StandardModelBase {
  constructor(name = 'SimulatedAI') {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return `[${name}] Processed: ${String(prompt).substring(0, 100)}...`;
      }
    );
  }
}
/**
 * Example 1: Pre-defined Role Templates
 */
function preDefinedRolesExample(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Pre-defined Role Templates');
  console.log('='.repeat(60) + '\n');
  // Create common role types manually
  const analyst = new RoleBuilder('data-analyst')
    .withName('Data Analyst')
    .withSystemPrompt('You are a data analyst focused on numerical trends and statistical patterns.')
    .withCapabilities(['data-analysis', 'statistics', 'reporting'])
    .build();
  const creative = new RoleBuilder('content-creator')
    .withName('Content Creator')
    .withSystemPrompt('You are a creative content creator focused on blog posts and social media.')
    .withCapabilities(['writing', 'social-media', 'content-strategy'])
    .build();
  const reviewer = new RoleBuilder('quality-reviewer')
    .withName('Quality Reviewer')
    .withSystemPrompt('You are a quality reviewer focused on content accuracy and clarity.')
    .withCapabilities(['review', 'quality-assurance', 'editing'])
    .build();
  const synthesizer = new RoleBuilder('summary-expert')
    .withName('Summary Expert')
    .withSystemPrompt('You are a synthesis expert who creates concise summaries.')
    .withCapabilities(['synthesis', 'summarization', 'analysis'])
    .build();
  const roles = [analyst, creative, reviewer, synthesizer];
  roles.forEach(role => {
    console.log(`📋 ${role.name}`);
    console.log(`   ID: ${role.id}`);
    console.log(`   Capabilities: ${role.capabilities?.slice(0, 2).join(', ') || 'none'}`);
    console.log('');
  });
}
/**
 * Example 2: Creating Custom Roles with RoleBuilder
 */
function customRolesExample(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Custom Roles with RoleBuilder');
  console.log('='.repeat(60) + '\n');
  // Project Manager Role
  const projectManager: AgentRole = new RoleBuilder('project-manager')
    .withName('Project Manager')
    .withSystemPrompt(`You are an experienced project manager.
Focus on planning, coordination, and resource allocation.
Always consider timelines, dependencies, and team capacity.
Communicate clearly and prioritize tasks effectively.`)
    .withCapabilities([
      'task-planning',
      'resource-allocation',
      'risk-assessment',
      'team-coordination',
      'progress-tracking',
    ])
    .withConstraints([
      'Stay within budget parameters',
      'Consider team workload',
      'Maintain realistic timelines',
    ])
    .build();
  console.log('Project Manager Role:');
  console.log(JSON.stringify(projectManager, null, 2));
  // Technical Architect Role
  const architect: AgentRole = new RoleBuilder('technical-architect')
    .withName('Technical Architect')
    .withSystemPrompt(`You are a senior technical architect.
Design scalable, maintainable systems.
Consider security, performance, and future growth.
Document decisions and their rationale.`)
    .withCapabilities([
      'system-design',
      'technology-selection',
      'architecture-review',
      'performance-optimization',
      'security-assessment',
    ])
    .withConstraints([
      'Follow industry best practices',
      'Ensure backward compatibility',
      'Document all decisions',
    ])
    .build();
  console.log('\nTechnical Architect Role:');
  console.log(JSON.stringify(architect, null, 2));
  // QA Lead Role
  const qaLead: AgentRole = new RoleBuilder('qa-lead').withName('QA Lead')
    .withSystemPrompt(`You are a quality assurance lead.
Ensure thorough testing and quality standards.
Identify edge cases and potential issues.
Advocate for user experience quality.`)
    .withCapabilities([
      'test-planning',
      'quality-metrics',
      'defect-analysis',
      'automation-strategy',
    ])
    .withConstraints([
      'Maintain quality thresholds',
      'Balance speed vs thoroughness',
    ])
    .build();
  console.log('\nQA Lead Role:');
  console.log(JSON.stringify(qaLead, null, 2));
}
/**
 * Example 3: Domain-Specific Roles
 */
function domainSpecificRoles(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Domain-Specific Roles');
  console.log('='.repeat(60) + '\n');
  // Marketing Domain Roles
  const marketingRoles = {
    strategist: new RoleBuilder('marketing-strategist').withName('Marketing Strategist')
      .withSystemPrompt('Develop comprehensive marketing strategies aligned with business goals.')
      .withCapabilities(['market-analysis', 'campaign-planning', 'brand-positioning'])
      .build(),
    copywriter: new RoleBuilder('copywriter').withName('Copywriter')
      .withSystemPrompt('Create compelling, persuasive marketing copy.')
      .withCapabilities(['content-creation', 'storytelling', 'seo-optimization'])
      .build(),
    dataAnalyst: new RoleBuilder('marketing-analyst').withName('Marketing Analyst')
      .withSystemPrompt('Analyze marketing data to drive insights and recommendations.')
      .withCapabilities(['data-analysis', 'reporting', 'roi-calculation'])
      .build(),
  };
  console.log('Marketing Team Roles:');
  Object.entries(marketingRoles).forEach(([key, role]) => {
    console.log(`  • ${key}: ${role.name}`);
  });
  // Research Domain Roles
  const researchRoles = {
    principalInvestigator: new RoleBuilder('principal-investigator').withName('Principal Investigator')
      .withSystemPrompt('Lead research direction and methodology.')
      .withCapabilities(['research-design', 'hypothesis-formation', 'peer-review'])
      .build(),
    dataScientist: new RoleBuilder('data-scientist').withName('Data Scientist')
      .withSystemPrompt('Apply advanced statistical methods and ML techniques.')
      .withCapabilities(['statistical-analysis', 'machine-learning', 'data-visualization'])
      .build(),
    literatureReviewer: new RoleBuilder('literature-reviewer').withName('Literature Reviewer')
      .withSystemPrompt('Conduct comprehensive literature reviews.')
      .withCapabilities(['source-evaluation', 'gap-analysis', 'citation-management'])
      .build(),
  };
  console.log('\nResearch Team Roles:');
  Object.entries(researchRoles).forEach(([key, role]) => {
    console.log(`  • ${key}: ${role.name}`);
  });
  // Healthcare Domain Roles
  const healthcareRoles = {
    diagnostician: new RoleBuilder('diagnostic-specialist').withName('Diagnostic Specialist')
      .withSystemPrompt('Analyze symptoms and test results for accurate diagnosis.')
      .withCapabilities(['symptom-analysis', 'differential-diagnosis', 'test-interpretation'])
      .withConstraints(['Follow medical guidelines', 'Consider patient history'])
      .build(),
    treatmentPlanner: new RoleBuilder('treatment-planner').withName('Treatment Planner')
      .withSystemPrompt('Develop personalized treatment plans.')
      .withCapabilities(['treatment-selection', 'drug-interaction-check', 'outcome-prediction'])
      .withConstraints(['Minimize side effects', 'Consider patient preferences'])
      .build(),
  };
  console.log('\nHealthcare Team Roles:');
  Object.entries(healthcareRoles).forEach(([key, role]) => {
    console.log(`  • ${key}: ${role.name}`);
  });
}
/**
 * Example 4: Creating Agents from Roles
 */
function agentsFromRoles(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Creating Agents from Roles');
  console.log('='.repeat(60) + '\n');
  const model = new SimulatedModel('GPT-4');
  // Define a role
  const analyticRole = new RoleBuilder('financial-analyst').withName('Financial Analyst')
    .withSystemPrompt('Analyze financial data and provide investment insights.')
    .withCapabilities(['financial-modeling', 'risk-assessment', 'market-analysis'])
    .withConstraints(['Provide balanced views', 'Cite data sources'])
    .build();
  // Create an agent with this role
  const agent: AgentConfig = new AgentBuilder('analyst-1')
    .withRole(analyticRole)
    .withModel(model)
    // .withMetadata() // metadata not yet supported
    .build();
  console.log('Created Agent:');
  console.log(`  ID: ${agent.id}`);
  console.log(`  Role: ${agent.role.name}`);
  console.log(`  Capabilities: ${agent.role.capabilities?.join(', ') || 'none'}`);
}
/**
 * Example 5: Role Inheritance Pattern
 */
function roleInheritancePattern(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Role Inheritance Pattern');
  console.log('='.repeat(60) + '\n');
  // Base role that others will extend
  const createBaseRole = (name: string, roleId: string): RoleBuilder => {
    return new RoleBuilder(roleId)
      .withName(name)
      .withSystemPrompt(`Base instructions for ${name} roles.`)
      .withCapabilities(['communication', 'documentation']);
  };
  // Extend base role for different contexts
  const juniorDeveloper = createBaseRole('Junior Developer', 'junior-dev')
    .withSystemPrompt(`You are a junior developer.
Focus on implementing tasks assigned to you.
Ask for clarification when needed.
Learn from code reviews.`)
    .withCapabilities(['coding', 'testing', 'documentation'])
    .withConstraints(['Follow coding standards', 'Write tests'])
    .build();
  const seniorDeveloper = createBaseRole('Senior Developer', 'senior-dev')
    .withSystemPrompt(`You are a senior developer.
Lead by example and mentor juniors.
Design solutions and review code.
Make architectural decisions.`)
    .withCapabilities(['coding', 'testing', 'documentation', 'architecture', 'mentoring'])
    .withConstraints(['Follow coding standards', 'Ensure code quality'])
    .build();
  const leadDeveloper = createBaseRole('Lead Developer', 'lead-dev')
    .withSystemPrompt(`You are a lead developer.
Guide the team technically and strategically.
Balance technical debt with feature delivery.
Coordinate with other teams and stakeholders.`)
    .withCapabilities(['coding', 'testing', 'documentation', 'architecture', 'mentoring', 'planning'])
    .withConstraints(['Follow coding standards', 'Ensure team velocity'])
    .build();
  console.log('Developer Hierarchy:');
  [leadDeveloper, seniorDeveloper, juniorDeveloper].forEach(role => {
    console.log(`\n${role.name}:`);
    console.log(`    ID: ${role.id}`);
    console.log(`    Capabilities: ${role.capabilities?.join(', ') || 'none'}`);
  });
}
// Run all examples
function main(): void {
  try {
    preDefinedRolesExample();
    customRolesExample();
    domainSpecificRoles();
    agentsFromRoles();
    roleInheritancePattern();
    console.log('\n✨ All custom roles examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}
if (require.main === module) {
  main();
}
export { 
  preDefinedRolesExample, 
  customRolesExample, 
  domainSpecificRoles, 
  agentsFromRoles,
  roleInheritancePattern 
};
