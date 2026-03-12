/**
 * @fileoverview Tests for StandardModelBase, TextModelAdapter, OpenAIAdapter, GeminiAdapter
 */

import {
  StandardModelBase,
  TextModelAdapter,
  OpenAIAdapter,
  GeminiAdapter,
} from '../../core/models';

/** No-retry options — keeps tests fast */
const noRetry = {
  maxRetries: 0,
  initialBackoff: 0,
  maxBackoff: 0,
  backoffFactor: 1,
  jitter: false,
};

// ---------------------------------------------------------------------------
// TextModelAdapter
// ---------------------------------------------------------------------------

describe('TextModelAdapter', () => {
  const adapter = new TextModelAdapter();

  it('convertPrompt passes strings through as-is', async () => {
    expect(await adapter.convertPrompt('hello')).toBe('hello');
  });

  it('convertPrompt stringifies non-strings', async () => {
    expect(await adapter.convertPrompt(42)).toBe('42');
    expect(await adapter.convertPrompt({ a: 1 })).toBe('[object Object]');
  });

  it('convertResponse returns string as-is', async () => {
    expect(await adapter.convertResponse('ok')).toBe('ok');
  });

  it('convertResponse converts Buffer to string', async () => {
    const buf = Buffer.from('buffered');
    expect(await adapter.convertResponse(buf)).toBe('buffered');
  });

  it('convertResponse throws for unsupported types', async () => {
    await expect(adapter.convertResponse(42)).rejects.toThrow(/Unsupported response format/);
  });

  it('getSupportedPromptTypes returns text and string', () => {
    expect(adapter.getSupportedPromptTypes()).toContain('text');
    expect(adapter.getSupportedPromptTypes()).toContain('string');
  });
});

// ---------------------------------------------------------------------------
// OpenAIAdapter
// ---------------------------------------------------------------------------

describe('OpenAIAdapter', () => {
  const adapter = new OpenAIAdapter();

  it('convertPrompt wraps plain string in messages array', async () => {
    const result = (await adapter.convertPrompt('hello')) as {
      messages: { role: string; content: string }[];
    };
    expect(result.messages).toBeDefined();
    expect(result.messages[1].content).toBe('hello');
  });

  it('convertPrompt passes through object with messages key', async () => {
    const structured = { messages: [{ role: 'user', content: 'hi' }] };
    expect(await adapter.convertPrompt(structured)).toBe(structured);
  });

  it('convertResponse handles choices array format', async () => {
    const response = { choices: [{ message: { content: 'response text' } }] };
    expect(await adapter.convertResponse(response)).toBe('response text');
  });

  it('convertResponse handles content property directly', async () => {
    expect(await adapter.convertResponse({ content: 'direct' })).toBe('direct');
  });

  it('convertResponse returns string as-is', async () => {
    expect(await adapter.convertResponse('raw')).toBe('raw');
  });

  it('convertResponse throws for unsupported format', async () => {
    await expect(adapter.convertResponse({ unknown: true })).rejects.toThrow(/Unsupported OpenAI/);
  });
});

// ---------------------------------------------------------------------------
// GeminiAdapter
// ---------------------------------------------------------------------------

describe('GeminiAdapter', () => {
  const adapter = new GeminiAdapter();

  it('convertPrompt wraps plain string in Gemini contents format', async () => {
    const result = (await adapter.convertPrompt('hello')) as { contents: unknown[] };
    expect(result.contents).toBeDefined();
    expect(result.contents).toHaveLength(1);
  });

  it('convertPrompt passes through object with contents key', async () => {
    const structured = { contents: [] };
    expect(await adapter.convertPrompt(structured)).toBe(structured);
  });

  it('convertResponse handles candidates array format', async () => {
    const response = {
      candidates: [{ content: { parts: [{ text: 'gemini answer' }] } }],
    };
    expect(await adapter.convertResponse(response)).toBe('gemini answer');
  });

  it('convertResponse handles simplified text property', async () => {
    expect(await adapter.convertResponse({ text: 'simplified' })).toBe('simplified');
  });

  it('convertResponse returns string as-is', async () => {
    expect(await adapter.convertResponse('raw')).toBe('raw');
  });

  it('convertResponse throws for unsupported format', async () => {
    await expect(adapter.convertResponse({ unknown: true })).rejects.toThrow(/Unsupported Gemini/);
  });
});

// ---------------------------------------------------------------------------
// StandardModelBase
// ---------------------------------------------------------------------------

describe('StandardModelBase', () => {
  it('name() returns the configured name', () => {
    const model = new StandardModelBase({ name: 'MyModel' });
    expect(model.name()).toBe('MyModel');
  });

  it('withName() updates the model name', () => {
    const model = new StandardModelBase({ name: 'OldName' });
    model.withName('NewName');
    expect(model.name()).toBe('NewName');
  });

  it('throws ProcessingFailedError when no processFunc provided', async () => {
    const model = new StandardModelBase({ name: 'Empty' });
    await expect(model.process('hello')).rejects.toThrow(/Processing function not defined/);
  });

  it('calls processFunc and returns string result', async () => {
    const model = new StandardModelBase(
      {
        name: 'Test',
        retryOptions: noRetry,
      },
      async () => 'hello world'
    );
    const result = await model.process('prompt');
    expect(result).toBe('hello world');
  });

  it('uses adapter to convert prompt and response', async () => {
    const mockAdapter = {
      convertPrompt: jest.fn().mockResolvedValue('converted prompt'),
      convertResponse: jest.fn().mockResolvedValue('converted response'),
      getSupportedPromptTypes: (): string[] => ['text'],
    };
    const model = new StandardModelBase(
      {
        name: 'AdaptedModel',
        adapter: mockAdapter,
        retryOptions: noRetry,
      },
      async (prompt) => `raw:${prompt}`
    );

    const result = await model.process('original');
    expect(mockAdapter.convertPrompt).toHaveBeenCalledWith('original');
    expect(mockAdapter.convertResponse).toHaveBeenCalledWith('raw:converted prompt');
    expect(result).toBe('converted response');
  });

  it('respects external AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    const model = new StandardModelBase(
      {
        name: 'AbortTest',
        retryOptions: noRetry,
      },
      async (): Promise<string> => {
        await new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 50));
        return 'never';
      }
    );

    await expect(model.process('x', controller.signal)).rejects.toThrow();
  });

  it('supportsPromptType returns true for configured types', () => {
    const model = new StandardModelBase({ name: 'M' });
    model.withSupportedPromptTypes(['text', 'structured']);
    expect(model.supportsPromptType('text')).toBe(true);
    expect(model.supportsPromptType('structured')).toBe(true);
    expect(model.supportsPromptType('unknown')).toBe(false);
  });

  it('withAdapter() sets a custom adapter', async () => {
    const mockAdapter = {
      convertPrompt: jest.fn().mockResolvedValue('p'),
      convertResponse: jest.fn().mockResolvedValue('r'),
      getSupportedPromptTypes: (): string[] => ['text'],
    };
    const model = new StandardModelBase(
      {
        name: 'M',
        retryOptions: noRetry,
      },
      async () => 'raw'
    );
    model.withAdapter(mockAdapter);
    await model.process('in');
    expect(mockAdapter.convertPrompt).toHaveBeenCalledWith('in');
  });

  it('wraps non-string response error clearly', async () => {
    const model = new StandardModelBase(
      {
        name: 'M',
        adapter: undefined,
        retryOptions: noRetry,
      },
      async (): Promise<string> => 42 as unknown as string
    );
    // Need to force no adapter to hit the non-string branch
    (model as unknown as { options: { adapter: undefined } }).options.adapter = undefined;
    await expect(model.process('x')).rejects.toThrow(/non-string/);
  });
});
