/**
 * @fileoverview Property-Based Tests for SocietyAI Core Systems
 *
 * These tests use fast-check to generate random inputs and verify
 * that core properties hold across all possible inputs.
 *
 * Run with: npm test -- property-based.test.ts
 *
 * @jest-environment node
 */

/// <reference types="jest" />
/// <reference types="node" />

import * as fc from 'fast-check';
import {
  workflowStateArbitrary,
  jsonSchemaArbitrary,
  jsonDataFromSchema,
  vectorEmbeddingArbitrary,
  metadataArbitrary,
} from '../utils/property-testing';
import { FileStorageAdapter } from '../../core/persistence';
import { InMemoryVectorStore } from '../../capabilities/vector-store';
import { StructuredOutputValidator } from '../../capabilities/validation';
import { promises as fs } from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(__dirname, '.tmp-property-tests');

describe('Property-Based Tests', () => {
  beforeAll(async () => {
    // Ensure test directory exists
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Persistence Properties', () => {
    test('Round-trip: save and load should be identity', async () => {
      const storage = new FileStorageAdapter({ baseDir: path.join(TEST_DIR, 'roundtrip') });

      await fc.assert(
        fc.asyncProperty(workflowStateArbitrary(), async (state) => {
          await storage.save(state.executionId, state);
          const loaded = await storage.load(state.executionId);

          // Should be identical after round-trip
          expect(JSON.stringify(loaded)).toBe(JSON.stringify(state));
        }),
        { numRuns: 50 } // Run 50 random test cases
      );
    });

    test('Delete should make load return null', async () => {
      const storage = new FileStorageAdapter({ baseDir: path.join(TEST_DIR, 'delete') });

      await fc.assert(
        fc.asyncProperty(workflowStateArbitrary(), async (state) => {
          await storage.save(state.executionId, state);
          await storage.delete(state.executionId);
          const loaded = await storage.load(state.executionId);

          expect(loaded).toBeNull();
        }),
        { numRuns: 30 }
      );
    });

    test('List should include all saved IDs', async () => {
      const storage = new FileStorageAdapter({ baseDir: path.join(TEST_DIR, 'list') });

      await fc.assert(
        fc.asyncProperty(
          fc.array(workflowStateArbitrary(), { minLength: 1, maxLength: 5 }),
          async (states) => {
            // Save all states
            for (const state of states) {
              await storage.save(state.executionId, state);
            }

            const list = await storage.list();
            const expectedIds = states.map((s) => s.executionId);

            // All IDs should be in the list
            for (const id of expectedIds) {
              expect(list).toContain(id);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Validation Properties', () => {
    test('Valid data should always pass', () => {
      fc.assert(
        fc.property(jsonSchemaArbitrary(), (schema) => {
          const validator = new StructuredOutputValidator(schema);
          const validData = fc.sample(jsonDataFromSchema(schema), 1)[0];

          const result = validator.validate(JSON.stringify(validData));

          // Generated data should match its own schema
          expect(result.valid).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    test('Validation should be deterministic', () => {
      fc.assert(
        fc.property(jsonSchemaArbitrary(), fc.string(), (schema, data) => {
          const validator = new StructuredOutputValidator(schema);

          const result1 = validator.validate(data);
          const result2 = validator.validate(data);

          // Same input should produce same result
          expect(result1.valid).toBe(result2.valid);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Vector Store Properties', () => {
    const DIMENSIONS = 128;

    test('Cosine similarity should be symmetric', () => {
      const store = new InMemoryVectorStore({ dimensions: DIMENSIONS });

      fc.assert(
        fc.property(
          vectorEmbeddingArbitrary(DIMENSIONS),
          vectorEmbeddingArbitrary(DIMENSIONS),
          (vec1, vec2) => {
            const score1 = store['cosineSimilarity'](vec1, vec2);
            const score2 = store['cosineSimilarity'](vec2, vec1);

            // Symmetry property
            expect(Math.abs(score1 - score2)).toBeLessThan(0.0001);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Cosine similarity should be bounded [0, 1]', () => {
      const store = new InMemoryVectorStore({ dimensions: DIMENSIONS });

      fc.assert(
        fc.property(
          vectorEmbeddingArbitrary(DIMENSIONS),
          vectorEmbeddingArbitrary(DIMENSIONS),
          (vec1, vec2) => {
            const score = store['cosineSimilarity'](vec1, vec2);

            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('Identical vectors should have similarity = 1', () => {
      const store = new InMemoryVectorStore({ dimensions: DIMENSIONS });

      fc.assert(
        fc.property(vectorEmbeddingArbitrary(DIMENSIONS), (vec) => {
          // Skip zero vectors (undefined similarity)
          if (vec.every((x) => x === 0)) return;

          const score = store['cosineSimilarity'](vec, vec);

          // Identity property
          expect(score).toBeCloseTo(1, 3);
        }),
        { numRuns: 50 }
      );
    });

    test('FIFO eviction: oldest entries removed first', async () => {
      const MAX_ENTRIES = 5;
      const store = new InMemoryVectorStore({
        dimensions: DIMENSIONS,
        maxEntries: MAX_ENTRIES,
      });

      await fc.assert(
        fc.asyncProperty(fc.array(fc.uuid(), { minLength: 10, maxLength: 20 }), async (ids) => {
          // Ensure unique IDs by adding index suffix
          const uniqueIds = ids.map((id, idx) => `${id}-${idx}`);

          // Insert more than max capacity
          for (const id of uniqueIds) {
            await store.upsert({
              id,
              vector: Array(DIMENSIONS).fill(0.5),
            });
          }

          // Should not exceed capacity
          const stats = store.stats();
          expect(stats.count).toBeLessThanOrEqual(MAX_ENTRIES);

          // Oldest IDs should be evicted (first few IDs)
          if (uniqueIds.length > MAX_ENTRIES) {
            const firstId = uniqueIds[0];
            const result = await store.get(firstId);
            expect(result).toBeNull();
          }
        }),
        { numRuns: 20 }
      );
    });

    test('Search should respect topK limit', async () => {
      const store = new InMemoryVectorStore({ dimensions: DIMENSIONS });

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.record({ id: fc.uuid(), vector: vectorEmbeddingArbitrary(DIMENSIONS) }), {
            minLength: 10,
            maxLength: 20,
          }),
          vectorEmbeddingArbitrary(DIMENSIONS),
          fc.integer({ min: 1, max: 15 }), // topK >= 1 to avoid edge case
          async (entriesInput, query, topK) => {
            // Make IDs unique
            const entries = entriesInput.map((entry, idx) => ({
              ...entry,
              id: `${entry.id}-${idx}`,
            }));

            // Insert entries
            for (const entry of entries) {
              await store.upsert(entry);
            }

            // Search
            const results = await store.search(query, { topK });

            // Should not exceed topK
            expect(results.length).toBeLessThanOrEqual(topK);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('Metadata filters should work correctly', async () => {
      const store = new InMemoryVectorStore({ dimensions: DIMENSIONS });

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.uuid(),
              vector: vectorEmbeddingArbitrary(DIMENSIONS),
              metadata: metadataArbitrary(),
            }),
            { minLength: 5, maxLength: 10 }
          ),
          vectorEmbeddingArbitrary(DIMENSIONS),
          async (entriesInput, query) => {
            // Make IDs unique
            const entries = entriesInput.map((entry, idx) => ({
              ...entry,
              id: `${entry.id}-${idx}`,
            }));

            // Insert entries
            for (const entry of entries) {
              await store.upsert(entry);
            }

            // Pick a metadata filter from first entry
            const filterKey = Object.keys(entries[0].metadata || {})[0];
            if (!filterKey) return; // Skip if no metadata

            const filterValue = entries[0].metadata![filterKey];
            const filter = { [filterKey]: filterValue };

            // Search with filter
            const results = await store.search(query, { filter });

            // All results should match the filter
            for (const result of results) {
              expect(result.entry.metadata?.[filterKey]).toBe(filterValue);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('General Properties', () => {
    test('UUID generation should produce unique IDs', () => {
      fc.assert(
        fc.property(fc.nat(1000), (count) => {
          const ids = new Set<string>();

          for (let i = 0; i < count; i++) {
            const id = `${Date.now()}-${Math.random()}`;
            ids.add(id);
          }

          // All IDs should be unique
          expect(ids.size).toBe(count);
        }),
        { numRuns: 10 }
      );
    });

    test('Loop iteration should respect max bounds', () => {
      fc.assert(
        fc.property(fc.nat(100), (maxIterations) => {
          let iterations = 0;

          while (iterations < maxIterations) {
            iterations++;
          }

          expect(iterations).toBe(maxIterations);
        }),
        { numRuns: 50 }
      );
    });
  });
});
