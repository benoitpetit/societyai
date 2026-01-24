/**
 * Example: Anthropic Claude Integration
 * 
 * Connect SocietyAI with Anthropic's Claude models.
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import { StandardModelBase, society, societyCollaborative } from '../../src';

/**
 * Anthropic Claude Model Adapter
 */
class AnthropicModel extends StandardModelBase {
  constructor(options: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}) {
    const model = options.model || 'claude-3-sonnet-20240229';
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';

    super(
      { name: `Anthropic-${model}`, timeout: 60000 },
      async (prompt: unknown) => {
        if (!apiKey) {
          throw new Error('ANTHROPIC_API_KEY is required');
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: options.maxTokens || 1024,
            messages: [
              { role: 'user', content: String(prompt) }
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as {
          content: Array<{ type: string; text: string }>;
        };
        
        const textContent = data.content.find(c => c.type === 'text');
        return textContent?.text || '';
      }
    );
  }
}

/**
 * Anthropic Model with System Prompt
 */
class AnthropicWithSystemPrompt extends StandardModelBase {
  constructor(options: {
    apiKey?: string;
    model?: string;
    systemPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    const model = options.model || 'claude-3-sonnet-20240229';
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || '';

    super(
      { name: `Anthropic-${model}`, timeout: 60000 },
      async (prompt: unknown) => {
        if (!apiKey) {
          throw new Error('ANTHROPIC_API_KEY is required');
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: model,
            max_tokens: options.maxTokens || 1024,
            system: options.systemPrompt,
            messages: [
              { role: 'user', content: String(prompt) }
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json() as {
          content: Array<{ type: string; text: string }>;
        };
        
        const textContent = data.content.find(c => c.type === 'text');
        return textContent?.text || '';
      }
    );
  }
}

/**
 * Simulated Claude for demo purposes
 */
class SimulatedClaude extends StandardModelBase {
  constructor(model = 'claude-3-sonnet') {
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
 * Example 1: Basic Claude Usage
 */
async function basicClaudeUsage(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Claude Usage');
  console.log('='.repeat(60) + '\n');

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  console.log(`API Key available: ${hasApiKey ? 'Yes' : 'No (using simulation)'}`);

  const model = hasApiKey 
    ? new AnthropicModel({ model: 'claude-3-sonnet-20240229' })
    : new SimulatedClaude('claude-3-sonnet');

  const result = await society(
    'What are the ethical considerations of AI development?',
    3,
    [model],
    false
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 2: Claude Model Variants
 */
async function claudeModelVariants(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Claude Model Variants');
  console.log('='.repeat(60) + '\n');

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  // Different Claude variants
  const models = hasApiKey ? [
    new AnthropicModel({ model: 'claude-3-opus-20240229' }),     // Most capable
    new AnthropicModel({ model: 'claude-3-sonnet-20240229' }),   // Balanced
    new AnthropicModel({ model: 'claude-3-haiku-20240307' }),    // Fastest
  ] : [
    new SimulatedClaude('claude-3-opus'),
    new SimulatedClaude('claude-3-sonnet'),
    new SimulatedClaude('claude-3-haiku'),
  ];

  console.log('Models:');
  console.log('  • Claude 3 Opus (most capable)');
  console.log('  • Claude 3 Sonnet (balanced)');
  console.log('  • Claude 3 Haiku (fastest)');

  const result = await society(
    'Analyze the future of space exploration',
    3,
    models,
    true
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 3: Claude for Long-Form Analysis
 */
async function claudeLongFormAnalysis(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Long-Form Analysis');
  console.log('='.repeat(60) + '\n');

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  // Claude excels at thoughtful, nuanced analysis
  const model = hasApiKey
    ? new AnthropicWithSystemPrompt({
        model: 'claude-3-opus-20240229',
        systemPrompt: `You are a thoughtful analyst who provides nuanced, 
well-reasoned perspectives. Consider multiple viewpoints and acknowledge 
uncertainty where appropriate. Structure your analysis clearly.`,
        maxTokens: 2000,
      })
    : new SimulatedClaude('claude-3-opus-analyst');

  const result = await societyCollaborative(
    'Analyze the societal implications of widespread AI adoption',
    3,
    [model],
    false
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 4: Mixed Provider Society
 */
async function mixedProviderSociety(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Mixed Provider Society');
  console.log('='.repeat(60) + '\n');

  console.log('Combining Claude with other providers gives diverse perspectives.\n');

  // In production, you might combine:
  // - Claude for nuanced reasoning
  // - GPT-4 for broad knowledge
  // - Gemini for multimodal tasks

  const models = [
    new SimulatedClaude('claude-reasoning'),
    new SimulatedClaude('gpt-4-knowledge'),
    new SimulatedClaude('gemini-synthesis'),
  ];

  console.log('Provider Mix:');
  console.log('  • Claude: Nuanced reasoning');
  console.log('  • GPT-4: Broad knowledge');
  console.log('  • Gemini: Synthesis');

  const result = await society(
    'How should we approach the development of AGI?',
    3,
    models,
    true
  );

  console.log('\nResult:', result.substring(0, 500) + '...');
}

/**
 * Example 5: Claude-Specific Features
 */
function claudeSpecificFeatures(): void {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Claude-Specific Features');
  console.log('='.repeat(60) + '\n');

  console.log(`
Claude-Specific Integration Tips:

1. Constitutional AI Alignment
   - Claude is designed for helpful, harmless, honest responses
   - Great for applications requiring safety and ethics

2. Long Context Window
   - Claude 3 supports up to 200K tokens context
   - Ideal for analyzing long documents

3. System Prompts
   const model = new AnthropicWithSystemPrompt({
     systemPrompt: 'You are a helpful legal assistant...',
     model: 'claude-3-opus-20240229',
   });

4. Streaming Responses
   // For real-time feedback, implement streaming:
   // See Anthropic docs for streaming API

5. Tool Use (Function Calling)
   // Claude supports tool use for complex workflows
   // Can be integrated with SocietyAI agents

6. Vision Capabilities
   // Claude 3 can analyze images
   // Pass images as base64 in the messages

Best Practices:
- Use Opus for complex reasoning
- Use Sonnet for balanced performance
- Use Haiku for high-volume, simple tasks
- Leverage long context for document analysis
- Use system prompts to define agent personas
`);
}

// Run all examples
async function main(): Promise<void> {
  console.log('\n🔌 Anthropic Claude Integration Examples\n');
  console.log('Note: Set ANTHROPIC_API_KEY environment variable for real API calls.');
  console.log('Without API key, simulated responses will be used.\n');

  try {
    await basicClaudeUsage();
    await claudeModelVariants();
    await claudeLongFormAnalysis();
    await mixedProviderSociety();
    claudeSpecificFeatures();

    console.log('\n✨ All Anthropic examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AnthropicModel, AnthropicWithSystemPrompt, SimulatedClaude };
