/**
 * @fileoverview Tests for EngineAsModel / wrapEngineAsModel
 */

import { EngineAsModel, wrapEngineAsModel } from '../../execution/engine-as-model';
import { GraphBuilder, NodeType } from '../../execution/engine/execution-engine';
import { MockModel } from '../utils/mock-model';
import { Agent, Role } from '../../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgent(id: string, response: string): Agent {
  return {
    id,
    name: id,
    role: {
      id: `role-${id}`,
      name: 'Role',
      systemPrompt: 'You are a test assistant',
    } as Role,
    model: new MockModel(id).withDefaultResponse(response),
    priority: 0,
  };
}

function makeGraph(agentId: string) {
  return GraphBuilder.create()
    .addNode('start', NodeType.START)
    .addNode('step', NodeType.AGENT, { agentId })
    .addNode('end', NodeType.END)
    .addEdge('start', 'step')
    .addEdge('step', 'end')
    .build();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EngineAsModel', () => {
  describe('process()', () => {
    it('executes the inner society and returns output', async () => {
      const agent = makeAgent('worker', 'inner result');
      const engine = makeGraph('worker');

      const model = new EngineAsModel({ engine, agents: [agent] });
      const result = await model.process('hello');
      expect(result).toBe('inner result');
    });

    it('converts non-string prompt to JSON string', async () => {
      const agent = makeAgent('worker', 'done');
      const engine = makeGraph('worker');

      const model = new EngineAsModel({ engine, agents: [agent] });
      // Pass an object — should not throw
      const result = await model.process({ task: 'do something' });
      expect(typeof result).toBe('string');
    });

    it('throws on inner society failure when onError="throw" (default)', async () => {
      // Build a graph with no matching agent to trigger failure
      const engine = makeGraph('missing-agent');

      const model = new EngineAsModel({ engine, agents: [] });
      await expect(model.process('hello')).rejects.toThrow();
    });

    it('returns error message string when onError="return-error-message"', async () => {
      const engine = makeGraph('missing-agent');

      const model = new EngineAsModel({ engine, agents: [], onError: 'return-error-message' });
      const result = await model.process('hello');
      expect(result).toContain('[ERROR]');
    });

    it('respects AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      const agent = makeAgent('worker', 'done');
      const engine = makeGraph('worker');

      const model = new EngineAsModel({ engine, agents: [agent] });
      await expect(model.process('hello', controller.signal)).rejects.toThrow();
    });
  });

  describe('stream()', () => {
    it('yields the full output as a single chunk', async () => {
      const agent = makeAgent('worker', 'streamed output');
      const engine = makeGraph('worker');

      const model = new EngineAsModel({ engine, agents: [agent] });
      const chunks: string[] = [];
      for await (const chunk of model.stream('hello')) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('streamed output');
    });
  });

  describe('metadata methods', () => {
    it('name() returns configured name', () => {
      const engine = makeGraph('w');
      const model = new EngineAsModel({ engine, agents: [], name: 'my-team' });
      expect(model.name()).toBe('my-team');
    });

    it('name() defaults to "engine-as-model"', () => {
      const engine = makeGraph('w');
      const model = new EngineAsModel({ engine, agents: [] });
      expect(model.name()).toBe('engine-as-model');
    });

    it('supportsPromptType() always returns true', () => {
      const engine = makeGraph('w');
      const model = new EngineAsModel({ engine, agents: [] });
      expect(model.supportsPromptType('text')).toBe(true);
      expect(model.supportsPromptType('anything')).toBe(true);
    });

    it('supportsStreaming() returns true', () => {
      const engine = makeGraph('w');
      const model = new EngineAsModel({ engine, agents: [] });
      expect(model.supportsStreaming()).toBe(true);
    });

    it('provider is "societyai-hierarchical"', () => {
      const engine = makeGraph('w');
      const model = new EngineAsModel({ engine, agents: [] });
      expect(model.provider).toBe('societyai-hierarchical');
    });

    it('getEngine() returns the inner engine', () => {
      const engine = makeGraph('w');
      const model = new EngineAsModel({ engine, agents: [] });
      expect(model.getEngine()).toBe(engine);
    });

    it('getAgents() returns the agents array', () => {
      const agents = [makeAgent('a', 'x')];
      const engine = makeGraph('a');
      const model = new EngineAsModel({ engine, agents });
      expect(model.getAgents()).toBe(agents);
    });
  });
});

describe('wrapEngineAsModel()', () => {
  it('creates an EngineAsModel instance', () => {
    const engine = makeGraph('w');
    const model = wrapEngineAsModel(engine, [], { name: 'wrapped' });
    expect(model).toBeInstanceOf(EngineAsModel);
    expect(model.name()).toBe('wrapped');
  });
});
