import { Society, ToolBuilder } from '../../index';
import { MockModel } from '../utils/mock-model';
import { MemorySystem } from '../../capabilities/memory';
import { JSONSchema } from '../../capabilities/validation';

describe('SocietyAI Functional Integration', () => {
  let mockModel: MockModel;

  beforeEach(() => {
    mockModel = new MockModel();
    mockModel.withDefaultResponse('Analysis complete');
  });

  test('should use MemorySystem to retrieve and store context', async () => {
    // 1. Setup Memory
    const memory = new MemorySystem({ maxMessages: 10 });
    // Add pre-existing memory
    await memory.add('My secret code is 12345', { importance: 1 });

    // 2. Setup Agent with Memory
    const agent = Society.create()
      .addAgent((a) =>
        a
          .withId('mem-agent')
          .withModel(mockModel)
          .withRole({ id: 'r', name: 'r', systemPrompt: 'You retrieve secrets.' })
          .withMemory(memory)
      )
      .addTask((s) =>
        s.withId('step1').withAgents(['mem-agent']).withInstructions('What is the secret?')
      );

    // 3. Mock response
    mockModel.when('My secret code is 12345').thenReturn('The secret is 12345');
    mockModel.withDefaultResponse('I do not know');

    // 4. Execution
    const result = await agent.execute('Retrieve');

    // 5. Assert result - The model should have received the memory in the prompt
    expect(result.output).toContain('The secret is 12345');

    // Check if new interaction was added to memory
    // Accessing internal state for test verification (only available in ShortTermMemory internally,
    // but we can query retrieve again to see if it grew)
    const recent = await memory.retrieve('Retrieve');
    // At least the user query and the last response should be retrievable
    expect(recent.length).toBeGreaterThan(0);
  });

  test('should inject Tool definitions into prompt', async () => {
    // 1. Define Tool using correct Builder API
    const weatherTool = ToolBuilder.create()
      .withName('get_weather')
      .withDescription('Get weather for a city')
      .withParameters({
        type: 'object',
        properties: {
          city: { type: 'string' },
        },
        required: ['city'],
      })
      .withExecutor(async () => 'sunny')
      .build();

    // 2. Setup Agent
    const society = Society.create()
      .addAgent((a) =>
        a
          .withId('tool-agent')
          .withModel(mockModel)
          .withRole({ id: 'r', name: 'r', systemPrompt: 'Use tools.' })
          .withTools([weatherTool])
      )
      .addTask((s) => s.withId('run-tool').withAgents(['tool-agent']).sequential());

    // 3. Verify Prompt Injection via MockModel history
    await society.execute('Check Paris weather');

    const lastCall = mockModel.callHistory[mockModel.callHistory.length - 1];
    expect(lastCall).toContain('get_weather');
    expect(lastCall).toContain('Get weather for a city');
  });

  test('should validate output schema and fail if invalid', async () => {
    // 1. Schema
    const schema: JSONSchema = {
      type: 'object',
      properties: {
        score: { type: 'number' },
      },
      required: ['score'],
    };

    // 2. Mock Agent to return INVALID JSON
    mockModel.withDefaultResponse(' दिस इज नॉट जेसन '); // Plain text, not JSON

    // 3. Society
    const society = Society.create()
      .addAgent((a) =>
        a
          .withId('validator')
          .withModel(mockModel)
          .withRole({ id: 'v', name: 'v', systemPrompt: 's' })
      )
      .addTask((s) => s.withId('score-step').withAgents(['validator']).withOutputSchema(schema));

    // 4. Expect failure or error in result
    const result = await society.execute('Score it');

    // Since we throw validation error, the workflow should fail or capture error
    expect(result.success).toBe(false);
    expect(String(result.errors?.[0])).toContain('Validation failed');
  });

  test('should automatically execute tools and loop back', async () => {
    let callCount = 0;

    // Create a reactive model that simulates tool usage
    const reactiveModel = {
      name: () => 'reactive-model',
      process: jest.fn(async (prompt: string, _signal?: AbortSignal) => {
        callCount++;
        // Second call: After receiving tool output
        if (prompt.includes('Tool "get_weather" returned')) {
          return 'The weather in Paris is Sunny and 20C.';
        }
        // First call: Request tool
        return 'Checking weather...\n<tool_code>\n{\n  "name": "get_weather",\n  "arguments": { "city": "Paris" } \n}\n</tool_code>';
      }),
      supportsPromptType: (_t: string) => true,
    };

    const weatherTool = ToolBuilder.create()
      .withName('get_weather')
      .withDescription('Get weather')
      .withParameters({ type: 'object', properties: { city: { type: 'string' } } })
      .withExecutor(async (_args) => {
        return { condition: 'Sunny', temp: 20 };
      })
      .build();

    const society = Society.create()
      .addAgent((a) =>
        a
          .withId('tool-user-agent')
          .withModel(reactiveModel as any)
          .withRole({
            id: 'weather-bot',
            name: 'Weather Bot',
            systemPrompt: 'Use tools to answer.',
          })
          .withTools([weatherTool])
      )
      .addTask((s) => s.withId('weather-step').withAgents(['tool-user-agent']).sequential());

    await society.execute('What makes Paris Paris?');

    expect(callCount).toBe(2);

    const secondCallPrompt = reactiveModel.process.mock.calls[1][0] as string;
    expect(secondCallPrompt).toContain('Tool "get_weather" returned');
    expect(secondCallPrompt).toContain('Sunny');
  });
});
