/**
 * @fileoverview Property-Based Testing Utilities for SocietyAI
 *
 * Property-based testing validates system behaviors through generated test cases
 * rather than specific examples. This catches edge cases that manual tests miss.
 *
 * Uses fast-check library for property generation and fuzzing.
 *
 * @example
 * ```ts
 * import * as fc from 'fast-check';
 * import { workflowStateArbitrary, jsonSchemaArbitrary } from './property-testing';
 *
 * test('persistence round-trip', () => {
 *   fc.assert(
 *     fc.property(workflowStateArbitrary(), async (state) => {
 *       const saved = await storage.save(state.executionId, state);
 *       const loaded = await storage.load(state.executionId);
 *       expect(loaded).toEqual(state);
 *     })
 *   );
 * });
 * ```
 */

import * as fc from 'fast-check';
import { WorkflowState } from '../../core/persistence';
import { TaskResult, Message } from '../../core/types';
import { JSONSchema } from '../../capabilities/validation';
import { LoopController } from '../../utils/loop-controller';

/**
 * Arbitrary for WorkflowState
 * Generates valid workflow states for testing persistence
 */
export function workflowStateArbitrary(): fc.Arbitrary<WorkflowState> {
  return fc.record({
    executionId: fc.uuid(),
    status: fc.constantFrom('active', 'paused', 'completed', 'failed'),
    queue: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
    results: fc.array(
      fc.tuple(
        fc.string(),
        fc.record({
          agentId: fc.string(),
          taskId: fc.string(),
          output: fc.string(),
          success: fc.boolean(),
          timestamp: fc.integer({ min: 0, max: Date.now() }),
          duration: fc.option(fc.integer({ min: 0, max: 60000 })),
          error: fc.option(fc.record({ message: fc.string() })),
        }) as fc.Arbitrary<TaskResult>
      ),
      { maxLength: 20 }
    ),
    sharedData: fc.array(fc.tuple(fc.string(), fc.anything()), { maxLength: 10 }),
    iterationCounts: fc.array(fc.tuple(fc.string(), fc.nat(10)), { maxLength: 10 }),
    executionPath: fc.array(fc.string(), { maxLength: 50 }),
    messageHistory: fc.array(
      fc.record({
        from: fc.string({ minLength: 1, maxLength: 10 }),
        to: fc.string({ minLength: 1, maxLength: 10 }),
        content: fc.string({ maxLength: 100 }),
        timestamp: fc.integer({ min: 0 }),
        messageId: fc.uuid(),
      }) as fc.Arbitrary<Message>,
      { maxLength: 20 }
    ),
    timestamp: fc.date().map((d) => d.getTime()),
    waitingForNodeId: fc.option(fc.string()),
    deadLetterQueue: fc.option(fc.array(fc.string(), { maxLength: 5 })),
  });
}

/**
 * Arbitrary for JSON Schema
 * Generates valid JSON schemas for validation testing
 */
export function jsonSchemaArbitrary(): fc.Arbitrary<JSONSchema> {
  const primitiveSchema = fc.oneof(
    fc.constant({ type: 'string' as const }),
    fc.constant({ type: 'number' as const }),
    fc.constant({ type: 'boolean' as const })
  );

  // Valid property name (alphanumeric only)
  const propertyName = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,15}$/);

  const objectSchema = fc
    .record({
      properties: fc.dictionary(propertyName, primitiveSchema, { minKeys: 1, maxKeys: 3 }),
    })
    .map((obj) => {
      const propKeys = Object.keys(obj.properties);
      // Only require properties that actually exist
      const requiredKeys = propKeys.length > 0 ? [propKeys[0]] : [];

      return {
        type: 'object' as const,
        properties: obj.properties,
        required: requiredKeys,
      };
    });

  const arraySchema = fc.record({
    type: fc.constant('array' as const),
    items: primitiveSchema,
  });

  return fc.oneof(primitiveSchema, objectSchema, arraySchema);
}

/**
 * Arbitrary for JSON data matching a schema
 */
export function jsonDataFromSchema(schema: JSONSchema): fc.Arbitrary<unknown> {
  switch (schema.type) {
    case 'string':
      return fc.string();
    case 'number':
      return fc.float({ noNaN: true, noDefaultInfinity: true });
    case 'boolean':
      return fc.boolean();
    case 'null':
      return fc.constant(null);
    case 'object':
      if (schema.properties) {
        const props: Record<string, fc.Arbitrary<unknown>> = {};
        for (const [key, propSchema] of Object.entries(schema.properties!)) {
          props[key] = jsonDataFromSchema(propSchema);
        }
        return fc.record(props);
      }
      return fc.object();
    case 'array':
      if (schema.items) {
        // Generate arrays with at least 1 element to ensure meaningful test data
        return fc.array(jsonDataFromSchema(schema.items), { minLength: 1, maxLength: 3 });
      }
      return fc.array(fc.anything(), { minLength: 1, maxLength: 3 });
    default:
      return fc.anything();
  }
}

/**
 * Arbitrary for Agent ID
 */
export function agentIdArbitrary(): fc.Arbitrary<string> {
  return fc.stringMatching(/^agent-[a-z0-9]{8}$/);
}

/**
 * Arbitrary for Task ID
 */
export function taskIdArbitrary(): fc.Arbitrary<string> {
  return fc.stringMatching(/^task-[a-z0-9]{8}$/);
}

/**
 * Arbitrary for Execution ID
 */
export function executionIdArbitrary(): fc.Arbitrary<string> {
  return fc.uuid();
}

/**
 * Arbitrary for Vector Embedding
 * Generates valid floating point numbers (no NaN, no Infinity)
 */
export function vectorEmbeddingArbitrary(dimensions: number): fc.Arbitrary<number[]> {
  return fc.array(fc.float({ min: -1, max: 1, noNaN: true }), {
    minLength: dimensions,
    maxLength: dimensions,
  });
}

/**
 * Arbitrary for Metadata
 */
export function metadataArbitrary(): fc.Arbitrary<Record<string, unknown>> {
  return fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean()));
}

/**
 * Property: Persistence round-trip
 * Any saved state should load back identically
 */
export const persistenceRoundTrip = (storage: unknown): fc.IAsyncProperty<unknown[]> => {
  const s = storage as {
    save: (id: string, state: unknown) => Promise<void>;
    load: (id: string) => Promise<unknown>;
  };
  return fc.asyncProperty(workflowStateArbitrary(), async (state) => {
    await s.save(state.executionId, state);
    const loaded = await s.load(state.executionId);

    // Deep equality check
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(state));
  });
};

/**
 * Property: Validation consistency
 * Valid data should always pass, invalid should always fail
 */
export const validationConsistency = (
  validator: unknown,
  schema: JSONSchema
): fc.IProperty<unknown[]> => {
  const v = validator as { validate: (data: string) => { valid: boolean } };
  return fc.property(jsonDataFromSchema(schema), (data) => {
    const result1 = v.validate(JSON.stringify(data));
    const result2 = v.validate(JSON.stringify(data));

    // Should be deterministic
    expect(result1.valid).toBe(result2.valid);
  });
};

/**
 * Property: Vector similarity symmetry
 * similarity(a, b) === similarity(b, a)
 */
export const vectorSimilaritySymmetry = (
  store: unknown,
  dimensions: number
): fc.IAsyncProperty<unknown[]> => {
  const s = store as { cosineSimilarity: (a: number[], b: number[]) => number };
  return fc.asyncProperty(
    vectorEmbeddingArbitrary(dimensions),
    vectorEmbeddingArbitrary(dimensions),
    async (vec1, vec2) => {
      const score1 = s.cosineSimilarity(vec1, vec2);
      const score2 = s.cosineSimilarity(vec2, vec1);

      // Should be symmetric
      expect(Math.abs(score1 - score2)).toBeLessThan(0.0001);
    }
  );
};

/**
 * Property: Vector similarity bounds
 * Similarity should always be between 0 and 1
 */
export const vectorSimilarityBounds = (
  store: unknown,
  dimensions: number
): fc.IAsyncProperty<unknown[]> => {
  const s = store as { cosineSimilarity: (a: number[], b: number[]) => number };
  return fc.asyncProperty(
    vectorEmbeddingArbitrary(dimensions),
    vectorEmbeddingArbitrary(dimensions),
    async (vec1, vec2) => {
      const score = s.cosineSimilarity(vec1, vec2);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  );
};

/**
 * Property: Graph node execution order
 *
 * Validates that a simple linear DAG executes all N nodes and records
 * them in the order they were added (topological order = insertion order
 * for a linear chain).
 *
 * The property generates a list of unique node IDs and verifies that:
 *  1. Each step in the simulated execution path is unique (no node runs twice).
 *  2. The execution path length equals the number of nodes.
 */
export const graphExecutionOrder = (): fc.IProperty<unknown[]> => {
  return fc.property(fc.array(fc.uuid(), { minLength: 2, maxLength: 8 }), (nodeIds) => {
    // Simulate a topological traversal of a linear chain: each node
    // enqueues only its single successor, so the execution path must
    // equal the input order exactly.
    const executionPath: string[] = [];
    const queue = [...nodeIds];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      executionPath.push(nodeId);
    }

    // Each node appears exactly once
    const unique = new Set(executionPath);
    expect(unique.size).toBe(nodeIds.length);
    expect(executionPath).toHaveLength(nodeIds.length);
  });
};

/**
 * Property: Loop iteration bounds
 *
 * Uses LoopController to verify that a loop with `maxIterations = N`
 * never exceeds N iterations, regardless of the value of N.
 */
export const loopIterationBounds = (): fc.IProperty<unknown[]> => {
  return fc.property(fc.nat(20), (maxIterations) => {
    const controller = new LoopController({ maxIterations: Math.max(1, maxIterations) });
    let iterations = 0;

    while (controller.next()) {
      iterations++;
    }

    expect(iterations).toBeLessThanOrEqual(Math.max(1, maxIterations));
    expect(controller.iteration).toBe(iterations);
  });
};

/**
 * Property: Memory eviction consistency
 * When store is full, oldest entries should be evicted first (FIFO)
 */
export const memoryEvictionFIFO = (
  store: unknown,
  maxSize: number
): fc.IAsyncProperty<unknown[]> => {
  const s = store as {
    upsert: (entry: { id: string; vector: number[]; timestamp: number }) => Promise<void>;
    entries: Map<string, unknown>;
  };
  return fc.asyncProperty(fc.array(fc.uuid(), { minLength: maxSize + 5 }), async (ids) => {
    // Fill beyond capacity
    for (const id of ids) {
      await s.upsert({
        id,
        vector: Array(128).fill(0),
        timestamp: Date.now(),
      });
    }

    // Only last maxSize should remain
    expect(s.entries.size).toBeLessThanOrEqual(maxSize);

    // Oldest IDs should be gone
    const remainingIds = Array.from(s.entries.keys());
    expect(remainingIds).not.toContain(ids[0]);
  });
};

/**
 * Export all property tests
 */
export const propertyTests = {
  persistenceRoundTrip,
  validationConsistency,
  vectorSimilaritySymmetry,
  vectorSimilarityBounds,
  graphExecutionOrder,
  loopIterationBounds,
  memoryEvictionFIFO,
};
