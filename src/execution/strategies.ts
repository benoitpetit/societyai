/**
 * @fileoverview Result Aggregation Strategies for SocietyAI
 *
 * This module provides pluggable strategies for aggregating results from
 * multiple agents. Strategies are composable and can be customized for
 * different use cases.
 *
 * Design principles:
 * - Composable: Strategies can be combined and chained
 * - Type-safe: Full TypeScript support
 * - Model-agnostic: Works with any result format
 * - Extensible: Easy to create custom strategies
 *
 * @example
 * ```typescript
 * // Use built-in strategy
 * const merged = Strategies.merge().aggregate(results);
 *
 * // Compose strategies
 * const composite = Strategies.compose(
 *   Strategies.filter(r => r.success),
 *   Strategies.weightedVote(weights),
 *   Strategies.format('markdown')
 * );
 *
 * // Use in Society builder
 * Society.create()
 *   .addAgents([...])
 *   .scatterGather(Strategies.consensus(0.7).aggregate)
 *   .execute(input);
 * ```
 */

import { StepResult } from '../core/types';

// ============================================================================
// STRATEGY TYPES
// ============================================================================

/**
 * Result from strategy aggregation
 */
export interface AggregationResult {
  /** The aggregated output */
  output: string;
  /** Metadata about the aggregation */
  metadata: {
    /** Number of successful results used */
    successCount: number;
    /** Number of failed results */
    failedCount: number;
    /** Strategy name used */
    strategy: string;
    /** Additional strategy-specific metadata */
    [key: string]: unknown;
  };
  /** Individual agent contributions */
  contributions?: {
    agentId: string;
    weight?: number;
    included: boolean;
  }[];
}

/**
 * Strategy interface for result aggregation
 */
export interface AggregationStrategy {
  /** Unique name of this strategy */
  name: string;
  /** Description of what this strategy does */
  description?: string;
  /** Aggregate function */
  aggregate: (results: StepResult[]) => string;
  /** Aggregate with full metadata */
  aggregateFull: (results: StepResult[]) => AggregationResult;
}

/**
 * Factory function for creating strategies
 */
export type StrategyFactory<T = void> = T extends void
  ? () => AggregationStrategy
  : (options: T) => AggregationStrategy;

// ============================================================================
// BASE STRATEGY BUILDER
// ============================================================================

/**
 * Builder for creating custom aggregation strategies
 */
export class StrategyBuilder {
  private _name: string = 'custom';
  private _description?: string;
  private _aggregateFn?: (results: StepResult[]) => string;

  static create(): StrategyBuilder {
    return new StrategyBuilder();
  }

  withName(name: string): this {
    this._name = name;
    return this;
  }

  withDescription(description: string): this {
    this._description = description;
    return this;
  }

  withAggregator(fn: (results: StepResult[]) => string): this {
    this._aggregateFn = fn;
    return this;
  }

  build(): AggregationStrategy {
    if (!this._aggregateFn) {
      throw new Error('Aggregator function is required');
    }

    const aggregateFn = this._aggregateFn;
    const name = this._name;

    return {
      name: this._name,
      description: this._description,
      aggregate: aggregateFn,
      aggregateFull: (results): AggregationResult => {
        const successful = results.filter((r) => r.success);
        return {
          output: aggregateFn(results),
          metadata: {
            successCount: successful.length,
            failedCount: results.length - successful.length,
            strategy: name,
          },
        };
      },
    };
  }
}

// ============================================================================
// BUILT-IN STRATEGIES
// ============================================================================

/**
 * Collection of built-in aggregation strategies
 */
export const Strategies = {
  // ========================================================================
  // BASIC STRATEGIES
  // ========================================================================

  /**
   * Concatenate all successful results
   */
  concat: (separator: string = '\n\n'): AggregationStrategy => ({
    name: 'concat',
    description: `Concatenates all successful results with "${separator}"`,
    aggregate: (results) =>
      results
        .filter((r) => r.success)
        .map((r) => r.content)
        .join(separator),
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      return {
        output: successful.map((r) => r.content).join(separator),
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: 'concat',
          separator,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r.success,
        })),
      };
    },
  }),

  /**
   * Take only the first successful result
   */
  first: (): AggregationStrategy => ({
    name: 'first',
    description: 'Returns only the first successful result',
    aggregate: (results): string => {
      const first = results.find((r) => r.success);
      return first?.content ?? '';
    },
    aggregateFull: (results): AggregationResult => {
      const first = results.find((r) => r.success);
      return {
        output: first?.content ?? '',
        metadata: {
          successCount: first ? 1 : 0,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'first',
          selectedAgent: first?.agentId,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r === first,
        })),
      };
    },
  }),

  /**
   * Take only the last successful result
   */
  last: (): AggregationStrategy => ({
    name: 'last',
    description: 'Returns only the last successful result',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      return successful[successful.length - 1]?.content ?? '';
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const last = successful[successful.length - 1];
      return {
        output: last?.content ?? '',
        metadata: {
          successCount: last ? 1 : 0,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'last',
          selectedAgent: last?.agentId,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r === last,
        })),
      };
    },
  }),

  /**
   * Select the longest result
   */
  longest: (): AggregationStrategy => ({
    name: 'longest',
    description: 'Returns the longest successful result',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      if (successful.length === 0) return '';
      return successful.reduce((a, b) => (a.content.length > b.content.length ? a : b)).content;
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const longest =
        successful.length > 0
          ? successful.reduce((a, b) => (a.content.length > b.content.length ? a : b))
          : null;
      return {
        output: longest?.content ?? '',
        metadata: {
          successCount: longest ? 1 : 0,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'longest',
          selectedAgent: longest?.agentId,
          contentLength: longest?.content.length ?? 0,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r === longest,
        })),
      };
    },
  }),

  /**
   * Select the shortest result
   */
  shortest: (): AggregationStrategy => ({
    name: 'shortest',
    description: 'Returns the shortest successful result',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      if (successful.length === 0) return '';
      return successful.reduce((a, b) => (a.content.length < b.content.length ? a : b)).content;
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const shortest =
        successful.length > 0
          ? successful.reduce((a, b) => (a.content.length < b.content.length ? a : b))
          : null;
      return {
        output: shortest?.content ?? '',
        metadata: {
          successCount: shortest ? 1 : 0,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'shortest',
          selectedAgent: shortest?.agentId,
          contentLength: shortest?.content.length ?? 0,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r === shortest,
        })),
      };
    },
  }),

  // ========================================================================
  // SELECTION STRATEGIES
  // ========================================================================

  /**
   * Select best result based on a scoring function
   */
  best: (scorer: (result: StepResult) => number): AggregationStrategy => ({
    name: 'best',
    description: 'Selects the best result based on a scoring function',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      if (successful.length === 0) return '';
      const scored = successful.map((r) => ({ result: r, score: scorer(r) }));
      scored.sort((a, b) => b.score - a.score);
      return scored[0].result.content;
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const scored = successful.map((r) => ({ result: r, score: scorer(r) }));
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      return {
        output: best?.result.content ?? '',
        metadata: {
          successCount: best ? 1 : 0,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'best',
          selectedAgent: best?.result.agentId,
          score: best?.score ?? 0,
          scores: Object.fromEntries(scored.map((s) => [s.result.agentId, s.score])),
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          weight: scorer(r),
          included: r === best?.result,
        })),
      };
    },
  }),

  /**
   * Random selection from successful results
   */
  random: (): AggregationStrategy => ({
    name: 'random',
    description: 'Randomly selects one successful result',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      if (successful.length === 0) return '';
      const randomIndex = Math.floor(Math.random() * successful.length);
      return successful[randomIndex].content;
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const randomIndex =
        successful.length > 0 ? Math.floor(Math.random() * successful.length) : -1;
      const selected = successful[randomIndex];
      return {
        output: selected?.content ?? '',
        metadata: {
          successCount: selected ? 1 : 0,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'random',
          selectedAgent: selected?.agentId,
          selectedIndex: randomIndex,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r === selected,
        })),
      };
    },
  }),

  // ========================================================================
  // WEIGHTED STRATEGIES
  // ========================================================================

  /**
   * Weighted concatenation based on agent weights
   */
  weighted: (weights: Record<string, number>): AggregationStrategy => ({
    name: 'weighted',
    description: 'Concatenates results weighted by agent importance',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      const sorted = successful.sort(
        (a, b) => (weights[b.agentId] ?? 1) - (weights[a.agentId] ?? 1)
      );
      return sorted.map((r) => r.content).join('\n\n');
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const sorted = successful.sort(
        (a, b) => (weights[b.agentId] ?? 1) - (weights[a.agentId] ?? 1)
      );
      return {
        output: sorted.map((r) => r.content).join('\n\n'),
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: 'weighted',
          weights,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          weight: weights[r.agentId] ?? 1,
          included: r.success,
        })),
      };
    },
  }),

  /**
   * Weighted voting - combines results based on weights
   */
  weightedVote: (weights: Record<string, number>): AggregationStrategy => ({
    name: 'weightedVote',
    description: 'Selects the result with highest weighted vote',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      if (successful.length === 0) return '';

      // Group similar responses and calculate weighted scores
      const votes = new Map<string, { content: string; weight: number; agents: string[] }>();

      for (const result of successful) {
        const weight = weights[result.agentId] ?? 1;
        // Simple content-based grouping (could be made more sophisticated)
        const key = result.content.trim().toLowerCase().substring(0, 100);
        const existing = votes.get(key);

        if (existing) {
          existing.weight += weight;
          existing.agents.push(result.agentId);
        } else {
          votes.set(key, { content: result.content, weight, agents: [result.agentId] });
        }
      }

      // Find highest weighted group
      let best = { content: '', weight: 0, agents: [] as string[] };
      for (const vote of votes.values()) {
        if (vote.weight > best.weight) {
          best = vote;
        }
      }

      return best.content;
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const votes = new Map<string, { content: string; weight: number; agents: string[] }>();

      for (const result of successful) {
        const weight = weights[result.agentId] ?? 1;
        const key = result.content.trim().toLowerCase().substring(0, 100);
        const existing = votes.get(key);

        if (existing) {
          existing.weight += weight;
          existing.agents.push(result.agentId);
        } else {
          votes.set(key, { content: result.content, weight, agents: [result.agentId] });
        }
      }

      let best = { content: '', weight: 0, agents: [] as string[] };
      for (const vote of votes.values()) {
        if (vote.weight > best.weight) {
          best = vote;
        }
      }

      return {
        output: best.content,
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: 'weightedVote',
          winningWeight: best.weight,
          winningAgents: best.agents,
          totalGroups: votes.size,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          weight: weights[r.agentId] ?? 1,
          included: best.agents.includes(r.agentId),
        })),
      };
    },
  }),

  // ========================================================================
  // CONSENSUS STRATEGIES
  // ========================================================================

  /**
   * Majority vote - selects the most common response
   */
  majority: (): AggregationStrategy => ({
    name: 'majority',
    description: 'Selects the most common response (simple majority)',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      if (successful.length === 0) return '';

      const votes = new Map<string, number>();
      for (const result of successful) {
        const key = result.content.trim().toLowerCase().substring(0, 200);
        votes.set(key, (votes.get(key) ?? 0) + 1);
      }

      let maxVotes = 0;
      let winner = '';
      for (const [content, count] of votes) {
        if (count > maxVotes) {
          maxVotes = count;
          winner = content;
        }
      }

      // Return the original (non-lowercased) content
      return (
        successful.find((r) => r.content.trim().toLowerCase().substring(0, 200) === winner)
          ?.content ?? ''
      );
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const votes = new Map<string, { count: number; original: string; agents: string[] }>();

      for (const result of successful) {
        const key = result.content.trim().toLowerCase().substring(0, 200);
        const existing = votes.get(key);
        if (existing) {
          existing.count++;
          existing.agents.push(result.agentId);
        } else {
          votes.set(key, { count: 1, original: result.content, agents: [result.agentId] });
        }
      }

      let maxVotes = 0;
      let winner = { count: 0, original: '', agents: [] as string[] };
      for (const vote of votes.values()) {
        if (vote.count > maxVotes) {
          maxVotes = vote.count;
          winner = vote;
        }
      }

      return {
        output: winner.original,
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: 'majority',
          winningVotes: winner.count,
          totalVotes: successful.length,
          uniqueResponses: votes.size,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: winner.agents.includes(r.agentId),
        })),
      };
    },
  }),

  /**
   * Consensus - requires a minimum agreement threshold
   */
  consensus: (threshold: number = 0.5): AggregationStrategy => ({
    name: 'consensus',
    description: `Requires ${threshold * 100}% agreement for consensus`,
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      if (successful.length === 0) return '';

      const votes = new Map<string, number>();
      for (const result of successful) {
        const key = result.content.trim().toLowerCase().substring(0, 200);
        votes.set(key, (votes.get(key) ?? 0) + 1);
      }

      for (const [content, count] of votes) {
        if (count / successful.length >= threshold) {
          return (
            successful.find((r) => r.content.trim().toLowerCase().substring(0, 200) === content)
              ?.content ?? ''
          );
        }
      }

      // No consensus reached - return empty or all results
      return '';
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const votes = new Map<string, { count: number; original: string; agents: string[] }>();

      for (const result of successful) {
        const key = result.content.trim().toLowerCase().substring(0, 200);
        const existing = votes.get(key);
        if (existing) {
          existing.count++;
          existing.agents.push(result.agentId);
        } else {
          votes.set(key, { count: 1, original: result.content, agents: [result.agentId] });
        }
      }

      let consensus = { count: 0, original: '', agents: [] as string[], achieved: false };
      for (const vote of votes.values()) {
        if (vote.count / successful.length >= threshold && vote.count > consensus.count) {
          consensus = { ...vote, achieved: true };
        }
      }

      return {
        output: consensus.original,
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: 'consensus',
          threshold,
          consensusAchieved: consensus.achieved,
          agreementLevel: successful.length > 0 ? consensus.count / successful.length : 0,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: consensus.agents.includes(r.agentId),
        })),
      };
    },
  }),

  // ========================================================================
  // FORMATTING STRATEGIES
  // ========================================================================

  /**
   * Format results as structured output
   */
  format: (
    style: 'json' | 'markdown' | 'list' | 'numbered' | 'table' = 'markdown'
  ): AggregationStrategy => ({
    name: `format-${style}`,
    description: `Formats results as ${style}`,
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);

      switch (style) {
        case 'json':
          return JSON.stringify(
            successful.map((r) => ({ agent: r.agentId, content: r.content })),
            null,
            2
          );
        case 'list':
          return successful.map((r) => `- ${r.content}`).join('\n');
        case 'numbered':
          return successful.map((r, i) => `${i + 1}. ${r.content}`).join('\n');
        case 'table': {
          const header = '| Agent | Response |\n|-------|----------|';
          const rows = successful.map(
            (r) => `| ${r.agentId} | ${r.content.replace(/\n/g, ' ').substring(0, 100)} |`
          );
          return [header, ...rows].join('\n');
        }
        case 'markdown':
        default:
          return successful.map((r) => `## ${r.agentId}\n\n${r.content}`).join('\n\n---\n\n');
      }
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      return {
        output: Strategies.format(style).aggregate(results),
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: `format-${style}`,
          style,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r.success,
        })),
      };
    },
  }),

  // ========================================================================
  // REDUCTION STRATEGIES
  // ========================================================================

  /**
   * Custom reducer for aggregating results
   */
  reduce: <T>(
    reducer: (acc: T, result: StepResult, index: number) => T,
    initial: T,
    finalize: (acc: T) => string
  ): AggregationStrategy => ({
    name: 'reduce',
    description: 'Custom reduction of results',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      const accumulated = successful.reduce(reducer, initial);
      return finalize(accumulated);
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const accumulated = successful.reduce(reducer, initial);
      return {
        output: finalize(accumulated),
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: 'reduce',
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r.success,
        })),
      };
    },
  }),

  /**
   * Map-reduce pattern
   */
  mapReduce: <T, R>(
    mapper: (result: StepResult) => T,
    reducer: (acc: R, mapped: T) => R,
    initial: R,
    finalize: (acc: R) => string
  ): AggregationStrategy => ({
    name: 'mapReduce',
    description: 'Map-reduce pattern for result aggregation',
    aggregate: (results): string => {
      const successful = results.filter((r) => r.success);
      const mapped = successful.map(mapper);
      const reduced = mapped.reduce(reducer, initial);
      return finalize(reduced);
    },
    aggregateFull: (results): AggregationResult => {
      const successful = results.filter((r) => r.success);
      const mapped = successful.map(mapper);
      const reduced = mapped.reduce(reducer, initial);
      return {
        output: finalize(reduced),
        metadata: {
          successCount: successful.length,
          failedCount: results.length - successful.length,
          strategy: 'mapReduce',
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: r.success,
        })),
      };
    },
  }),

  // ========================================================================
  // COMPOSITION
  // ========================================================================

  /**
   * Filter results before aggregation
   */
  filter: (predicate: (result: StepResult) => boolean): AggregationStrategy => ({
    name: 'filter',
    description: 'Filters results before aggregation',
    aggregate: (results): string => {
      return results
        .filter(predicate)
        .map((r) => r.content)
        .join('\n\n');
    },
    aggregateFull: (results): AggregationResult => {
      const filtered = results.filter(predicate);
      return {
        output: filtered.map((r) => r.content).join('\n\n'),
        metadata: {
          successCount: filtered.length,
          failedCount: results.length - filtered.length,
          strategy: 'filter',
          originalCount: results.length,
          filteredCount: filtered.length,
        },
        contributions: results.map((r) => ({
          agentId: r.agentId,
          included: predicate(r),
        })),
      };
    },
  }),

  /**
   * Compose multiple strategies
   */
  compose: (...strategies: AggregationStrategy[]): AggregationStrategy => ({
    name: 'composed',
    description: `Composed strategy: ${strategies.map((s) => s.name).join(' → ')}`,
    aggregate: (results): string => {
      // Apply each strategy in sequence, using the output as input for the next
      const currentResults = results;
      let finalOutput = '';

      for (const strategy of strategies) {
        finalOutput = strategy.aggregate(currentResults);
        // For chaining, we'd need to convert back to StepResult format
        // This is a simplified version that just returns the last output
      }

      return finalOutput;
    },
    aggregateFull: (results): AggregationResult => {
      let finalOutput = '';
      const allMetadata: Record<string, unknown>[] = [];

      for (const strategy of strategies) {
        const result = strategy.aggregateFull(results);
        finalOutput = result.output;
        allMetadata.push(result.metadata);
      }

      return {
        output: finalOutput,
        metadata: {
          successCount: results.filter((r) => r.success).length,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'composed',
          composedStrategies: strategies.map((s) => s.name),
          stepMetadata: allMetadata,
        },
      };
    },
  }),

  /**
   * Fallback strategy - uses backup if primary fails
   */
  fallback: (primary: AggregationStrategy, backup: AggregationStrategy): AggregationStrategy => ({
    name: 'fallback',
    description: `${primary.name} with fallback to ${backup.name}`,
    aggregate: (results): string => {
      const primaryResult = primary.aggregate(results);
      if (primaryResult && primaryResult.trim() !== '') {
        return primaryResult;
      }
      return backup.aggregate(results);
    },
    aggregateFull: (results): AggregationResult => {
      const primaryResult = primary.aggregateFull(results);
      if (primaryResult.output && primaryResult.output.trim() !== '') {
        return {
          ...primaryResult,
          metadata: {
            ...primaryResult.metadata,
            usedFallback: false,
          },
        };
      }
      const backupResult = backup.aggregateFull(results);
      return {
        ...backupResult,
        metadata: {
          ...backupResult.metadata,
          usedFallback: true,
          primaryStrategy: primary.name,
          backupStrategy: backup.name,
        },
      };
    },
  }),
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a custom strategy from a simple aggregator function
 */
export function createStrategy(
  name: string,
  aggregator: (results: StepResult[]) => string,
  description?: string
): AggregationStrategy {
  return StrategyBuilder.create()
    .withName(name)
    .withDescription(description ?? name)
    .withAggregator(aggregator)
    .build();
}

/**
 * Chain multiple strategies, passing results through each
 */
export function chainStrategies(
  ...strategies: AggregationStrategy[]
): (results: StepResult[]) => string {
  return (results) => {
    return Strategies.compose(...strategies).aggregate(results);
  };
}

/**
 * Create a strategy that processes results in parallel and merges
 */
export function parallelStrategies(
  strategies: AggregationStrategy[],
  merger: (outputs: string[]) => string = (outputs): string => outputs.join('\n\n')
): AggregationStrategy {
  return {
    name: 'parallel',
    description: `Parallel execution of: ${strategies.map((s) => s.name).join(', ')}`,
    aggregate: (results): string => {
      const outputs = strategies.map((s) => s.aggregate(results));
      return merger(outputs);
    },
    aggregateFull: (results): AggregationResult => {
      const outputs = strategies.map((s) => s.aggregateFull(results));
      return {
        output: merger(outputs.map((o) => o.output)),
        metadata: {
          successCount: results.filter((r) => r.success).length,
          failedCount: results.filter((r) => !r.success).length,
          strategy: 'parallel',
          parallelStrategies: strategies.map((s) => s.name),
          parallelResults: outputs.map((o) => o.metadata),
        },
      };
    },
  };
}
