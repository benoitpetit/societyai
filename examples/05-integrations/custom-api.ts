/**
 * Example: Custom API Integration
 * 
 * Create custom model adapters for any AI API.
 * Supports local models, custom endpoints, and third-party services.
 */

import { StandardModelBase, AIModel, society } from '../../src';

/**
 * Example 1: Generic REST API Adapter
 */
class GenericRESTModel extends StandardModelBase {
  constructor(options: {
    name: string;
    endpoint: string;
    apiKey?: string;
    headers?: Record<string, string>;
    bodyTemplate?: (prompt: string) => unknown;
    responseExtractor?: (response: unknown) => string;
    timeout?: number;
  }) {
    super(
      { name: options.name, timeout: options.timeout || 30000 },
      async (prompt: unknown) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...options.headers,
        };

        if (options.apiKey) {
          headers['Authorization'] = `Bearer ${options.apiKey}`;
        }

        const body = options.bodyTemplate 
          ? options.bodyTemplate(String(prompt))
          : { prompt: String(prompt) };

        const response = await fetch(options.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        return options.responseExtractor 
          ? options.responseExtractor(data)
          : String(data);
      }
    );
  }
}

/**
 * Example 2: Local LLM (Ollama) Adapter
 */
class OllamaModel extends StandardModelBase {
  constructor(options: {
    model?: string;
    host?: string;
    temperature?: number;
  } = {}) {
    const model = options.model || 'llama2';
    const host = options.host || 'http://localhost:11434';

    super(
      { name: `Ollama-${model}`, timeout: 120000 },
      async (prompt: unknown) => {
        const response = await fetch(`${host}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            prompt: String(prompt),
            stream: false,
            options: {
              temperature: options.temperature || 0.7,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama error: ${response.status}`);
        }

        const data = await response.json() as { response: string };
        return data.response;
      }
    );
  }
}

/**
 * Example 3: Hugging Face Inference API Adapter
 */
class HuggingFaceModel extends StandardModelBase {
  constructor(options: {
    model: string;
    apiKey?: string;
    maxTokens?: number;
  }) {
    const apiKey = options.apiKey || process.env.HUGGINGFACE_API_KEY || '';

    super(
      { name: `HF-${options.model}`, timeout: 60000 },
      async (prompt: unknown) => {
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${options.model}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              inputs: String(prompt),
              parameters: {
                max_new_tokens: options.maxTokens || 500,
                return_full_text: false,
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HuggingFace error: ${response.status}`);
        }

        const data = await response.json() as Array<{ generated_text: string }>;
        return data[0]?.generated_text || '';
      }
    );
  }
}

/**
 * Example 4: Azure OpenAI Adapter
 */
class AzureOpenAIModel extends StandardModelBase {
  constructor(options: {
    endpoint: string;  // https://{resource}.openai.azure.com
    deploymentId: string;
    apiKey?: string;
    apiVersion?: string;
    maxTokens?: number;
  }) {
    const apiKey = options.apiKey || process.env.AZURE_OPENAI_API_KEY || '';
    const apiVersion = options.apiVersion || '2024-02-15-preview';

    super(
      { name: `Azure-${options.deploymentId}`, timeout: 60000 },
      async (prompt: unknown) => {
        const url = `${options.endpoint}/openai/deployments/${options.deploymentId}/chat/completions?api-version=${apiVersion}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: String(prompt) }],
            max_tokens: options.maxTokens || 1000,
          }),
        });

        if (!response.ok) {
          throw new Error(`Azure OpenAI error: ${response.status}`);
        }

        const data = await response.json() as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices[0]?.message?.content || '';
      }
    );
  }
}

/**
 * Example 5: Custom Model Interface Implementation
 */
class CustomAIModel implements AIModel {
  name = 'CustomModel';
  timeout = 30000;

  private processPrompt: (prompt: string) => Promise<string>;

  constructor(processor: (prompt: string) => Promise<string>) {
    this.processPrompt = processor;
  }

  async process(prompt: unknown): Promise<string> {
    return this.processPrompt(String(prompt));
  }
}

/**
 * Example 6: Caching Wrapper
 */
class CachedModel extends StandardModelBase {
  private cache: Map<string, { response: string; timestamp: number }> = new Map();
  private ttl: number;
  private innerModel: AIModel;

  constructor(
    innerModel: AIModel,
    options: { ttl?: number } = {}
  ) {
    const ttl = options.ttl || 3600000; // 1 hour default
    
    super(
      { name: `Cached-${innerModel.name}`, timeout: innerModel.timeout },
      async (prompt: unknown) => {
        const key = String(prompt);
        const cached = this.cache.get(key);

        if (cached && Date.now() - cached.timestamp < ttl) {
          console.log('  [Cache HIT]');
          return cached.response;
        }

        console.log('  [Cache MISS]');
        const response = await innerModel.process(prompt);
        this.cache.set(key, { response, timestamp: Date.now() });
        return response;
      }
    );

    this.ttl = ttl;
    this.innerModel = innerModel;
  }
}

/**
 * Simulated model for demos
 */
class SimulatedModel extends StandardModelBase {
  constructor(name: string) {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        return `[${name}] Response: ${String(prompt).substring(0, 50)}...`;
      }
    );
  }
}

/**
 * Demo: Generic REST API
 */
async function demoGenericREST(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Generic REST API Adapter');
  console.log('='.repeat(60) + '\n');

  console.log(`
// Create a model for any REST API:
const model = new GenericRESTModel({
  name: 'MyAPI',
  endpoint: 'https://api.example.com/generate',
  apiKey: process.env.MY_API_KEY,
  headers: {
    'X-Custom-Header': 'value',
  },
  bodyTemplate: (prompt) => ({
    text: prompt,
    options: { maxTokens: 1000 },
  }),
  responseExtractor: (response) => response.output.text,
});
`);

  // Demo with simulated model
  const model = new SimulatedModel('GenericREST');
  const result = await society('Test prompt', 2, [model], false);
  console.log('Result:', result.substring(0, 200));
}

/**
 * Demo: Local LLM with Ollama
 */
async function demoOllama(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Local LLM (Ollama)');
  console.log('='.repeat(60) + '\n');

  console.log(`
// Connect to a local Ollama instance:
const model = new OllamaModel({
  model: 'llama2',           // or 'mistral', 'codellama', etc.
  host: 'http://localhost:11434',
  temperature: 0.7,
});

// Use multiple local models:
const models = [
  new OllamaModel({ model: 'llama2' }),
  new OllamaModel({ model: 'mistral' }),
  new OllamaModel({ model: 'codellama' }),
];

const result = await society('Your prompt', 3, models, true);
`);

  // Demo with simulated model
  const model = new SimulatedModel('Ollama-llama2');
  const result = await society('Test prompt', 2, [model], false);
  console.log('Result:', result.substring(0, 200));
}

/**
 * Demo: Hugging Face
 */
async function demoHuggingFace(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Hugging Face Inference API');
  console.log('='.repeat(60) + '\n');

  console.log(`
// Use any Hugging Face model:
const model = new HuggingFaceModel({
  model: 'meta-llama/Llama-2-7b-chat-hf',
  apiKey: process.env.HUGGINGFACE_API_KEY,
  maxTokens: 500,
});

// Popular models:
// - 'meta-llama/Llama-2-7b-chat-hf'
// - 'mistralai/Mistral-7B-Instruct-v0.1'
// - 'google/flan-t5-xxl'
// - 'bigscience/bloom'
`);

  const model = new SimulatedModel('HF-llama2');
  const result = await society('Test prompt', 2, [model], false);
  console.log('Result:', result.substring(0, 200));
}

/**
 * Demo: Azure OpenAI
 */
async function demoAzureOpenAI(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Azure OpenAI');
  console.log('='.repeat(60) + '\n');

  console.log(`
// Azure OpenAI configuration:
const model = new AzureOpenAIModel({
  endpoint: 'https://myresource.openai.azure.com',
  deploymentId: 'gpt-4-deployment',
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: '2024-02-15-preview',
  maxTokens: 1000,
});
`);

  const model = new SimulatedModel('Azure-GPT4');
  const result = await society('Test prompt', 2, [model], false);
  console.log('Result:', result.substring(0, 200));
}

/**
 * Demo: Custom Implementation
 */
async function demoCustomImplementation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Custom Implementation');
  console.log('='.repeat(60) + '\n');

  // Implement AIModel interface directly
  const customModel = new CustomAIModel(async (prompt) => {
    // Your custom logic here
    await new Promise(resolve => setTimeout(resolve, 100));
    return `Processed: ${prompt}`;
  });

  console.log('Custom model created:', customModel.name);

  const result = await society('Test the custom model', 2, [customModel], false);
  console.log('Result:', result.substring(0, 200));
}

/**
 * Demo: Caching
 */
async function demoCaching(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 6: Response Caching');
  console.log('='.repeat(60) + '\n');

  const baseModel = new SimulatedModel('BaseModel');
  const cachedModel = new CachedModel(baseModel, { ttl: 60000 });

  console.log('First call (cache miss):');
  await cachedModel.process('Test prompt');

  console.log('Second call (cache hit):');
  await cachedModel.process('Test prompt');

  console.log('\nCaching reduces API costs and latency for repeated queries.');
}

// Run all examples
async function main(): Promise<void> {
  console.log('\n🔌 Custom API Integration Examples\n');
  console.log('Learn how to connect SocietyAI with any AI provider.\n');

  try {
    await demoGenericREST();
    await demoOllama();
    await demoHuggingFace();
    await demoAzureOpenAI();
    await demoCustomImplementation();
    await demoCaching();

    console.log('\n✨ All custom API examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { 
  GenericRESTModel, 
  OllamaModel, 
  HuggingFaceModel, 
  AzureOpenAIModel, 
  CustomAIModel,
  CachedModel,
};
