/**
 * Example: OpenAI Integration
 * 
 * Connect SocietyAI with OpenAI's GPT models.
 * Requires OPENAI_API_KEY environment variable.
 */

import { StandardModelBase, society, societyCollaborative } from '../../src';

/**
 * OpenAI Model Adapter
 * 
 * This demonstrates how to create a real AI model adapter.
 * In production, you would install the OpenAI SDK.
 */
class OpenAIModel extends StandardModelBase {
  private apiKey: string;
  private model: string;

  constructor(options: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}) {
    const model = options.model || 'gpt-4';
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';

    super(
      { name: `OpenAI-${model}`, timeout: 60000 },
      async (prompt: unknown) => {
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY is required');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: String(prompt) }
            ],
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json() as { 
          choices: Array<{ message: { content: string } }> 
        };
        return data.choices[0]?.message?.content || '';
      }
    );

    this.apiKey = apiKey;
    this.model = model;
  }
}

/**
 * OpenAI Model with System Prompt
 */
class OpenAIWithSystemPrompt extends StandardModelBase {
  constructor(options: {
    apiKey?: string;
    model?: string;
    systemPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    const model = options.model || 'gpt-4';
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';

    super(
      { name: `OpenAI-${model}`, timeout: 60000 },
      async (prompt: unknown) => {
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY is required');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: options.systemPrompt },
              { role: 'user', content: String(prompt) }
            ],
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json() as { 
          choices: Array<{ message: { content: string } }> 
        };
        return data.choices[0]?.message?.content || '';
      }
    );
  }
}

/**
 * Simulated OpenAI for demo purposes
 */
class SimulatedOpenAI extends StandardModelBase {
  constructor(model = 'gpt-4') {
    super(
      { name: `Simulated-${model}`, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return `[${model}] Response to: ${String(prompt).substring(0, 100)}...`;
      }
    );
  }
}

/**
 * Example 1: Basic OpenAI Usage
 */
async function basicOpenAIUsage(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic OpenAI Usage');
  console.log('='.repeat(60) + '\n');

  const hasApiKey = !!process.env.OPENAI_API_KEY;
  console.log(`API Key available: ${hasApiKey ? 'Yes' : 'No (using simulation)'}`);

  // Use real or simulated model based on API key availability
  const model = hasApiKey 
    ? new OpenAIModel({ model: 'gpt-4' })
    : new SimulatedOpenAI('gpt-4');

  const result = await society(
    'Explain the benefits of renewable energy',
    3,
    [model],
    false
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 2: Multiple OpenAI Models
 */
async function multipleOpenAIModels(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Multiple OpenAI Models');
  console.log('='.repeat(60) + '\n');

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  // Use different GPT variants
  const models = hasApiKey ? [
    new OpenAIModel({ model: 'gpt-4' }),
    new OpenAIModel({ model: 'gpt-4-turbo' }),
    new OpenAIModel({ model: 'gpt-3.5-turbo' }),
  ] : [
    new SimulatedOpenAI('gpt-4'),
    new SimulatedOpenAI('gpt-4-turbo'),
    new SimulatedOpenAI('gpt-3.5-turbo'),
  ];

  console.log('Models:');
  models.forEach(m => console.log(`  • ${m.name}`));

  const result = await society(
    'What are the key considerations for building a startup?',
    3,
    models,
    true  // Multi-model mode
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 3: OpenAI with Role-Based System Prompts
 */
async function roleBasedOpenAI(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Role-Based System Prompts');
  console.log('='.repeat(60) + '\n');

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  // Create models with different personas
  const models = hasApiKey ? [
    new OpenAIWithSystemPrompt({
      systemPrompt: 'You are a technical expert who focuses on implementation details.',
      model: 'gpt-4',
    }),
    new OpenAIWithSystemPrompt({
      systemPrompt: 'You are a business strategist who focuses on market opportunities.',
      model: 'gpt-4',
    }),
    new OpenAIWithSystemPrompt({
      systemPrompt: 'You are a user experience designer who focuses on human-centered design.',
      model: 'gpt-4',
    }),
  ] : [
    new SimulatedOpenAI('technical-expert'),
    new SimulatedOpenAI('business-strategist'),
    new SimulatedOpenAI('ux-designer'),
  ];

  console.log('Personas:');
  console.log('  • Technical Expert');
  console.log('  • Business Strategist');
  console.log('  • UX Designer');

  const result = await societyCollaborative(
    'Design a mobile app for personal finance management',
    3,
    models,
    true
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 4: OpenAI with Custom Parameters
 */
async function customParametersOpenAI(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Custom Parameters');
  console.log('='.repeat(60) + '\n');

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  // Different temperature settings for different purposes
  const models = hasApiKey ? [
    new OpenAIModel({ 
      model: 'gpt-4', 
      temperature: 0.2,  // More focused/deterministic
      maxTokens: 500,
    }),
    new OpenAIModel({ 
      model: 'gpt-4', 
      temperature: 0.7,  // Balanced
      maxTokens: 500,
    }),
    new OpenAIModel({ 
      model: 'gpt-4', 
      temperature: 1.0,  // More creative
      maxTokens: 500,
    }),
  ] : [
    new SimulatedOpenAI('focused'),
    new SimulatedOpenAI('balanced'),
    new SimulatedOpenAI('creative'),
  ];

  console.log('Temperature Settings:');
  console.log('  • Focused (0.2)');
  console.log('  • Balanced (0.7)');
  console.log('  • Creative (1.0)');

  const result = await society(
    'Generate marketing taglines for an eco-friendly product',
    3,
    models,
    true
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 5: Production-Ready Configuration
 */
function productionConfiguration(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Production Configuration');
  console.log('='.repeat(60) + '\n');

  console.log(`
// Recommended production setup:

import { StandardModelBase, society } from 'societyai';

// 1. Environment-based configuration
const config = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || 'gpt-4',
  maxTokens: parseInt(process.env.MAX_TOKENS || '1000'),
  timeout: parseInt(process.env.TIMEOUT || '60000'),
};

// 2. Error handling and retry logic is built-in
const model = new StandardModelBase(
  { name: 'Production-GPT', timeout: config.timeout },
  async (prompt) => {
    // Your API call here
  }
);

// 3. Use with observer for monitoring
const observer = {
  onAgentStart: (id, name) => console.log(\`Agent \${id} starting\`),
  onAgentComplete: (id, name, result) => console.log(\`Agent \${id} done\`),
  onAgentError: (id, name, error) => console.error(\`Agent \${id} failed\`),
};

// 4. Execute with observer
const result = await society(
  'Your prompt',
  3,
  [model],
  false,
  observer
);
`);
}

// Run all examples
async function main(): Promise<void> {
  console.log('\n🔌 OpenAI Integration Examples\n');
  console.log('Note: Set OPENAI_API_KEY environment variable for real API calls.');
  console.log('Without API key, simulated responses will be used.\n');

  try {
    await basicOpenAIUsage();
    await multipleOpenAIModels();
    await roleBasedOpenAI();
    await customParametersOpenAI();
    productionConfiguration();

    console.log('\n✨ All OpenAI examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { OpenAIModel, OpenAIWithSystemPrompt, SimulatedOpenAI };
