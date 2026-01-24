/**
 * Example: Agent Capabilities
 * 
 * Demonstrate how to define and use agent capabilities
 * for specialized task assignment and validation.
 */

import { 
  RoleBuilder, 
  AgentBuilder,
  AgentConfig,
  StandardModelBase
} from '../../src';

/**
 * Simulated models with different specializations
 */
class SpecializedModel extends StandardModelBase {
  constructor(
    name: string,
    private specialization: string
  ) {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return `[${name}] (Specialization: ${specialization})\n` +
          `Response to: ${String(prompt).substring(0, 80)}...`;
      }
    );
  }
}

/**
 * Example 1: Defining Capabilities
 */
function capabilitiesDefinition(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Capability Definitions');
  console.log('='.repeat(60) + '\n');

  // Define a comprehensive capability taxonomy
  const capabilityTaxonomy = {
    // Analysis capabilities
    analysis: [
      'data-analysis',
      'trend-identification',
      'pattern-recognition',
      'statistical-analysis',
      'comparative-analysis',
    ],

    // Creative capabilities
    creative: [
      'content-creation',
      'ideation',
      'storytelling',
      'visual-design',
      'copywriting',
    ],

    // Technical capabilities
    technical: [
      'coding',
      'architecture-design',
      'system-integration',
      'debugging',
      'performance-optimization',
    ],

    // Communication capabilities
    communication: [
      'summarization',
      'translation',
      'documentation',
      'presentation',
      'stakeholder-communication',
    ],

    // Decision-making capabilities
    decision: [
      'risk-assessment',
      'prioritization',
      'trade-off-analysis',
      'recommendation',
      'validation',
    ],
  };

  console.log('Capability Taxonomy:');
  Object.entries(capabilityTaxonomy).forEach(([category, caps]) => {
    console.log(`\n  ${category.toUpperCase()}:`);
    caps.forEach(cap => console.log(`    • ${cap}`));
  });
}

/**
 * Example 2: Capability-Based Agent Selection
 */
function capabilityBasedSelection(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Capability-Based Agent Selection');
  console.log('='.repeat(60) + '\n');

  // Create agents with different capabilities
  const agents: AgentConfig[] = [
    new AgentBuilder('analyst-1')
      .withRole(
        new RoleBuilder('data-analyst').withName('Data Analyst')
          .withCapabilities(['data-analysis', 'statistical-analysis', 'visualization'])
          .build()
      )
      .withModel(new SpecializedModel('AnalyticsGPT', 'Data Science'))
      .build(),

    new AgentBuilder('creative-1')
      .withRole(
        new RoleBuilder('creative-director').withName('Creative Director')
          .withCapabilities(['ideation', 'storytelling', 'content-creation', 'visual-design'])
          .build()
      )
      .withModel(new SpecializedModel('CreativeGPT', 'Marketing'))
      .build(),

    new AgentBuilder('tech-1')
      .withRole(
        new RoleBuilder('tech-lead').withName('Tech Lead')
          .withCapabilities(['coding', 'architecture-design', 'code-review', 'debugging'])
          .build()
      )
      .withModel(new SpecializedModel('TechGPT', 'Engineering'))
      .build(),

    new AgentBuilder('pm-1')
      .withRole(
        new RoleBuilder('project-manager').withName('Project Manager')
          .withCapabilities(['planning', 'stakeholder-communication', 'risk-assessment', 'prioritization'])
          .build()
      )
      .withModel(new SpecializedModel('ManagementGPT', 'Project Management'))
      .build(),
  ];

  // Function to find agents by capability
  const findAgentsByCapability = (capability: string): AgentConfig[] => {
    return agents.filter(agent => 
      agent.role.capabilities?.includes(capability)
    );
  };

  // Function to find agents with any of the required capabilities
  const findAgentsWithAnyCapability = (capabilities: string[]): AgentConfig[] => {
    return agents.filter(agent =>
      capabilities.some(cap => agent.role.capabilities?.includes(cap))
    );
  };

  // Function to find agents with all required capabilities
  const findAgentsWithAllCapabilities = (capabilities: string[]): AgentConfig[] => {
    return agents.filter(agent =>
      capabilities.every(cap => agent.role.capabilities?.includes(cap))
    );
  };

  // Test capability-based selection
  console.log('Available Agents:');
  agents.forEach(agent => {
    console.log(`  • ${agent.role.name}: ${agent.role.capabilities?.join(', ') || 'none'}`);
  });

  console.log('\n--- Capability Queries ---\n');

  console.log('Find agents with "data-analysis":');
  findAgentsByCapability('data-analysis').forEach(a => 
    console.log(`  → ${a.role.name}`)
  );

  console.log('\nFind agents with ANY of ["coding", "ideation"]:');
  findAgentsWithAnyCapability(['coding', 'ideation']).forEach(a => 
    console.log(`  → ${a.role.name}`)
  );

  console.log('\nFind agents with ALL of ["planning", "risk-assessment"]:');
  findAgentsWithAllCapabilities(['planning', 'risk-assessment']).forEach(a => 
    console.log(`  → ${a.role.name}`)
  );
}

/**
 * Example 3: Capability Scoring
 */
function capabilityScoring(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Capability Scoring');
  console.log('='.repeat(60) + '\n');

  // Create agents with weighted capabilities
  interface WeightedCapability {
    name: string;
    proficiency: number; // 0-1 scale
  }

  interface ScoredAgent {
    config: AgentConfig;
    capabilities: WeightedCapability[];
  }

  const scoredAgents: ScoredAgent[] = [
    {
      config: new AgentBuilder('senior-analyst')
        .withRole(
          new RoleBuilder('Senior Analyst')
            .withCapabilities(['data-analysis', 'statistical-analysis', 'reporting'])
            .build()
        )
        .withModel(new SpecializedModel('GPT-4', 'Analytics'))
        .build(),
      capabilities: [
        { name: 'data-analysis', proficiency: 0.95 },
        { name: 'statistical-analysis', proficiency: 0.90 },
        { name: 'reporting', proficiency: 0.85 },
      ],
    },
    {
      config: new AgentBuilder('junior-analyst')
        .withRole(
          new RoleBuilder('Junior Analyst')
            .withCapabilities(['data-analysis', 'reporting'])
            .build()
        )
        .withModel(new SpecializedModel('GPT-3.5', 'Analytics'))
        .build(),
      capabilities: [
        { name: 'data-analysis', proficiency: 0.70 },
        { name: 'reporting', proficiency: 0.75 },
      ],
    },
  ];

  // Function to score an agent for a task
  const scoreAgentForTask = (agent: ScoredAgent, requiredCapabilities: string[]): number => {
    let totalScore = 0;
    let matchedCapabilities = 0;

    for (const required of requiredCapabilities) {
      const capability = agent.capabilities.find(c => c.name === required);
      if (capability) {
        totalScore += capability.proficiency;
        matchedCapabilities++;
      }
    }

    // Return average proficiency, penalized for missing capabilities
    const coverageRatio = matchedCapabilities / requiredCapabilities.length;
    return (totalScore / requiredCapabilities.length) * coverageRatio;
  };

  // Example task requirements
  const taskRequirements = ['data-analysis', 'statistical-analysis'];

  console.log('Task Requirements:', taskRequirements.join(', '));
  console.log('\nAgent Scores:');

  scoredAgents.forEach(agent => {
    const score = scoreAgentForTask(agent, taskRequirements);
    console.log(`  ${agent.config.role.name}: ${(score * 100).toFixed(1)}%`);
  });

  // Find best agent
  const bestAgent = scoredAgents.reduce((best, current) => {
    const bestScore = scoreAgentForTask(best, taskRequirements);
    const currentScore = scoreAgentForTask(current, taskRequirements);
    return currentScore > bestScore ? current : best;
  });

  console.log(`\n✓ Best match: ${bestAgent.config.role.name}`);
}

/**
 * Example 4: Capability Constraints
 */
function capabilityConstraints(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Capability Constraints');
  console.log('='.repeat(60) + '\n');

  // Define constraints that limit when capabilities can be used
  const constrainedRole = new RoleBuilder('Regulated Advisor')
    .withSystemPrompt('Provide advice within regulatory constraints.')
    .withCapabilities([
      'financial-advice',
      'investment-recommendation',
      'tax-guidance',
    ])
    .withConstraints([
      'Only provide general information, not personalized advice',
      'Include appropriate disclaimers',
      'Recommend consulting a licensed professional',
      'Do not guarantee specific outcomes',
      'Disclose potential conflicts of interest',
    ])
    .build();

  console.log('Regulated Advisor Role:');
  console.log(`  Capabilities: ${constrainedRole.capabilities?.join(', ') || 'none'}`);
  console.log('\n  Constraints:');
  constrainedRole.constraints?.forEach(constraint => {
    console.log(`    ⚠ ${constraint}`);
  });

  // Medical domain example
  const medicalRole = new RoleBuilder('Medical Information Assistant')
    .withSystemPrompt('Provide general health information.')
    .withCapabilities([
      'symptom-information',
      'medication-info',
      'lifestyle-guidance',
    ])
    .withConstraints([
      'Cannot diagnose medical conditions',
      'Cannot prescribe medications',
      'Must advise seeking professional medical care',
      'Cannot provide emergency medical advice',
      'Must note individual variations apply',
    ])
    .build();

  console.log('\nMedical Information Assistant Role:');
  console.log(`  Capabilities: ${medicalRole.capabilities?.join(', ') || 'none'}`);
  console.log('\n  Constraints:');
  medicalRole.constraints?.forEach(constraint => {
    console.log(`    ⚠ ${constraint}`);
  });
}

/**
 * Example 5: Dynamic Capability Discovery
 */
function dynamicCapabilityDiscovery(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Dynamic Capability Discovery');
  console.log('='.repeat(60) + '\n');

  // Registry pattern for capability discovery
  class CapabilityRegistry {
    private capabilities: Map<string, {
      description: string;
      requiredModels: string[];
      examples: string[];
    }> = new Map();

    register(name: string, config: {
      description: string;
      requiredModels: string[];
      examples: string[];
    }): void {
      this.capabilities.set(name, config);
    }

    get(name: string): typeof config | undefined {
      const config = this.capabilities.get(name);
      return config;
    }

    list(): string[] {
      return Array.from(this.capabilities.keys());
    }

    search(query: string): string[] {
      return this.list().filter(name => 
        name.includes(query) || 
        this.capabilities.get(name)?.description.toLowerCase().includes(query.toLowerCase())
      );
    }
  }

  const registry = new CapabilityRegistry();

  // Register capabilities
  registry.register('code-generation', {
    description: 'Generate source code from requirements',
    requiredModels: ['GPT-4', 'Claude', 'Codex'],
    examples: ['Generate a REST API', 'Create unit tests'],
  });

  registry.register('code-review', {
    description: 'Review code for quality and issues',
    requiredModels: ['GPT-4', 'Claude'],
    examples: ['Security audit', 'Performance review'],
  });

  registry.register('natural-language-processing', {
    description: 'Analyze and process natural language text',
    requiredModels: ['GPT-4', 'Claude', 'BERT'],
    examples: ['Sentiment analysis', 'Entity extraction'],
  });

  console.log('Registered Capabilities:');
  registry.list().forEach(cap => {
    const info = registry.get(cap);
    console.log(`\n  ${cap}:`);
    console.log(`    ${info?.description}`);
    console.log(`    Models: ${info?.requiredModels.join(', ')}`);
  });

  console.log('\n--- Search Results for "code" ---');
  registry.search('code').forEach(cap => console.log(`  • ${cap}`));
}

// Run all examples
function main(): void {
  try {
    capabilitiesDefinition();
    capabilityBasedSelection();
    capabilityScoring();
    capabilityConstraints();
    dynamicCapabilityDiscovery();

    console.log('\n✨ All capability examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export {
  capabilitiesDefinition,
  capabilityBasedSelection,
  capabilityScoring,
  capabilityConstraints,
  dynamicCapabilityDiscovery,
};
