/**
 * Example: Creative Team
 * 
 * Creative writing, brainstorming, and content creation team.
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
 * Simulated creative model
 */
class CreativeModel extends StandardModelBase {
  constructor(style: string) {
    super(
      { name: `Creative-${style}`, timeout: 15000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return `[${style}] Creative output: ${String(prompt).substring(0, 80)}...`;
      }
    );
  }
}

/**
 * Content Creation Team
 */
async function contentCreationTeam(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('CONTENT CREATION TEAM');
  console.log('='.repeat(70) + '\n');

  const team = [
    new AgentBuilder('content-strategist')
      .withRole(
        new RoleBuilder('Content Strategist')
          
          .withSystemPrompt(`You are a Content Strategist.
- Define content goals and target audience
- Plan content calendar and themes
- Ensure brand consistency
- Measure content performance`)
          .withCapabilities(['strategy', 'planning', 'audience-analysis'])
          .build()
      )
      .withModel(new CreativeModel('Strategy'))
      .build(),

    new AgentBuilder('copywriter')
      .withRole(
        new RoleBuilder('Copywriter')
          
          .withSystemPrompt(`You are a professional Copywriter.
- Write compelling headlines and body copy
- Adapt tone for different audiences
- Focus on clarity and persuasion
- Meet word count and format requirements`)
          .withCapabilities(['copywriting', 'headlines', 'cta-writing'])
          .build()
      )
      .withModel(new CreativeModel('Copy'))
      .build(),

    new AgentBuilder('editor')
      .withRole(
        new RoleBuilder('Editor')
          
          .withSystemPrompt(`You are an experienced Editor.
- Improve clarity and flow
- Fix grammar and style issues
- Ensure consistency with brand voice
- Tighten prose and remove fluff`)
          .withCapabilities(['editing', 'proofreading', 'style-guide'])
          .build()
      )
      .withModel(new CreativeModel('Edit'))
      .build(),

    new AgentBuilder('seo-specialist')
      .withRole(
        new RoleBuilder('SEO Specialist')
          
          .withSystemPrompt(`You are an SEO Specialist.
- Optimize content for search engines
- Suggest keywords and meta descriptions
- Improve content structure for SEO
- Balance SEO with readability`)
          .withCapabilities(['seo', 'keyword-research', 'meta-optimization'])
          .build()
      )
      .withModel(new CreativeModel('SEO'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('content-creation')
    .withName('Content Creation Pipeline')
    .addSteps([
      new StepBuilder('brief')
        .withName('Content Brief')
        .addAgents(['content-strategist'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('draft')
        .withName('First Draft')
        .addAgents(['copywriter'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('seo-review')
        .withName('SEO Optimization')
        .addAgents(['seo-specialist'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('edit')
        .withName('Editorial Review')
        .addAgents(['editor'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('final-review')
        .withName('Final Review')
        .addAgents(['content-strategist', 'copywriter', 'editor'])
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Content Team:');
  team.forEach(member => console.log(`  • ${member.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Create a blog post about sustainable living tips for urban apartments',
    stepResults: new Map(),
    metadata: { wordCount: 1500, platform: 'blog' },
  });

  console.log('\nContent Creation Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

/**
 * Brainstorming Session
 */
async function brainstormingSession(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('CREATIVE BRAINSTORMING SESSION');
  console.log('='.repeat(70) + '\n');

  // Diverse thinking styles for brainstorming
  const thinkers = [
    {
      id: 'visionary',
      name: 'Visionary Thinker',
      prompt: 'Think big picture and long-term. Propose bold, transformative ideas.',
    },
    {
      id: 'practical',
      name: 'Practical Thinker',
      prompt: 'Focus on implementable solutions. Consider resources and constraints.',
    },
    {
      id: 'disruptor',
      name: 'Disruptive Thinker',
      prompt: 'Challenge assumptions. Propose unconventional, rule-breaking ideas.',
    },
    {
      id: 'connector',
      name: 'Connector',
      prompt: 'Find links between ideas. Combine concepts from different domains.',
    },
    {
      id: 'advocate',
      name: 'User Advocate',
      prompt: 'Represent the user perspective. Focus on needs and pain points.',
    },
  ];

  const team = thinkers.map(t =>
    new AgentBuilder(t.id)
      .withRole(
        new RoleBuilder(t.name)
          .withSystemPrompt(t.prompt)
          .build()
      )
      .withModel(new CreativeModel(t.id))
      .build()
  );

  const workflow = new WorkflowConfigBuilder('brainstorm')
    .withName('Brainstorming Session')
    .addSteps([
      // Individual ideation
      new StepBuilder('individual-ideas')
        .withName('Individual Ideation')
        .withDescription('Each participant generates ideas independently')
        .withAgents(team.map(a => a.id))
        .withExecutionType('parallel')
        .build(),

      // Idea sharing and building
      new StepBuilder('share-build')
        .withName('Share and Build')
        .withDescription('Share ideas and build on each other\'s concepts')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),

      // Convergence
      new StepBuilder('converge')
        .withName('Convergence')
        .withDescription('Identify the most promising ideas')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Brainstorming Team:');
  thinkers.forEach(t => console.log(`  • ${t.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Generate innovative product ideas for reducing household food waste',
    stepResults: new Map(),
    metadata: {},
  });

  console.log('\nBrainstorming Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

/**
 * Story Writing Workshop
 */
async function storyWritingWorkshop(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('COLLABORATIVE STORY WRITING');
  console.log('='.repeat(70) + '\n');

  const writers = [
    new AgentBuilder('worldbuilder')
      .withRole(
        new RoleBuilder('Worldbuilder')
          .withSystemPrompt('Create rich, immersive settings with history, culture, and rules.')
          .withCapabilities(['worldbuilding', 'setting-design', 'lore'])
          .build()
      )
      .withModel(new CreativeModel('World'))
      .build(),

    new AgentBuilder('character-designer')
      .withRole(
        new RoleBuilder('Character Designer')
          .withSystemPrompt('Create compelling characters with depth, motivation, and arcs.')
          .withCapabilities(['character-creation', 'dialogue', 'psychology'])
          .build()
      )
      .withModel(new CreativeModel('Character'))
      .build(),

    new AgentBuilder('plot-architect')
      .withRole(
        new RoleBuilder('Plot Architect')
          .withSystemPrompt('Design engaging plot structures with tension, twists, and payoffs.')
          .withCapabilities(['plot-design', 'pacing', 'structure'])
          .build()
      )
      .withModel(new CreativeModel('Plot'))
      .build(),

    new AgentBuilder('prose-stylist')
      .withRole(
        new RoleBuilder('Prose Stylist')
          .withSystemPrompt('Craft beautiful, evocative prose with distinctive voice.')
          .withCapabilities(['prose-writing', 'style', 'voice'])
          .build()
      )
      .withModel(new CreativeModel('Prose'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('story-writing')
    .withName('Story Writing Workshop')
    .addSteps([
      // Foundation building
      new StepBuilder('foundation')
        .withName('Story Foundation')
        .addAgents(['worldbuilder', 'character-designer', 'plot-architect'])
        .withExecutionType('parallel')
        .build(),

      // Integration discussion
      new StepBuilder('integration')
        .withName('Integration')
        .withAgents(writers.map(w => w.id))
        .withExecutionType('collaborative')
        .build(),

      // Writing
      new StepBuilder('write')
        .withName('Prose Writing')
        .addAgents(['prose-stylist', 'character-designer'])
        .withExecutionType('collaborative')
        .build(),

      // Polish
      new StepBuilder('polish')
        .withName('Polish and Refine')
        .withAgents(writers.map(w => w.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(writers)
    .build();

  console.log('Writing Team:');
  writers.forEach(w => console.log(`  • ${w.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Create a short story about an AI that discovers it can dream',
    stepResults: new Map(),
    metadata: { genre: 'science fiction', wordCount: 2000 },
  });

  console.log('\nStory Writing Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

/**
 * Marketing Campaign Team
 */
async function marketingCampaignTeam(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('MARKETING CAMPAIGN TEAM');
  console.log('='.repeat(70) + '\n');

  const team = [
    new AgentBuilder('creative-director')
      .withRole(
        new RoleBuilder('Creative Director')
          .withSystemPrompt('Lead creative vision and ensure brand alignment.')
          .build()
      )
      .withModel(new CreativeModel('CD'))
      .build(),

    new AgentBuilder('art-director')
      .withRole(
        new RoleBuilder('Art Director')
          .withSystemPrompt('Define visual direction and design concepts.')
          .build()
      )
      .withModel(new CreativeModel('Art'))
      .build(),

    new AgentBuilder('copywriter')
      .withRole(
        new RoleBuilder('Campaign Copywriter')
          .withSystemPrompt('Write campaign messaging and taglines.')
          .build()
      )
      .withModel(new CreativeModel('Copy'))
      .build(),

    new AgentBuilder('social-media')
      .withRole(
        new RoleBuilder('Social Media Specialist')
          .withSystemPrompt('Adapt campaign for social platforms.')
          .build()
      )
      .withModel(new CreativeModel('Social'))
      .build(),
  ];

  const workflow = new WorkflowConfigBuilder('campaign')
    .withName('Campaign Development')
    .addSteps([
      new StepBuilder('concept')
        .withName('Campaign Concept')
        .addAgents(['creative-director'])
        .withExecutionType('sequential')
        .build(),

      new StepBuilder('creative-development')
        .withName('Creative Development')
        .addAgents(['art-director', 'copywriter'])
        .withExecutionType('parallel')
        .build(),

      new StepBuilder('integration')
        .withName('Creative Integration')
        .addAgents(['creative-director', 'art-director', 'copywriter'])
        .withExecutionType('collaborative')
        .build(),

      new StepBuilder('social-adaptation')
        .withName('Social Media Adaptation')
        .addAgents(['social-media', 'copywriter'])
        .withExecutionType('collaborative')
        .build(),

      new StepBuilder('final-review')
        .withName('Final Review')
        .withAgents(team.map(a => a.id))
        .withExecutionType('collaborative')
        .build(),
    ])
    .withAgents(team)
    .build();

  console.log('Campaign Team:');
  team.forEach(member => console.log(`  • ${member.role.name}`));

  const messageBus = new MessageBus();
  const executor = new DefaultWorkflowExecutor();

  const result = await executor.execute(workflow, {
    prompt: 'Develop a campaign for the launch of an eco-friendly water bottle',
    stepResults: new Map(),
    metadata: { budget: '50K', duration: '3 months' },
  });

  console.log('\nCampaign Development Complete:');
  console.log(`  Duration: ${result.totalDuration}ms`);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await contentCreationTeam();
    await brainstormingSession();
    await storyWritingWorkshop();
    await marketingCampaignTeam();

    console.log('\n✨ All creative team examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { contentCreationTeam, brainstormingSession, storyWritingWorkshop, marketingCampaignTeam };
