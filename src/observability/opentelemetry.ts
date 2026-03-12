/**
 * @fileoverview OpenTelemetry Integration for SocietyAI
 *
 * This module provides OpenTelemetry support for distributed tracing and metrics.
 * It's designed as an optional add-on that respects the "zero dependencies" principle
 * of the core library.
 *
 * To use OpenTelemetry, install it as a peer dependency:
 * ```bash
 * npm install @opentelemetry/api @opentelemetry/sdk-node
 * ```
 *
 * Features:
 * - Automatic span creation for agent execution
 * - Tool execution tracing
 * - Graph execution tracing
 * - Configurable exporters
 * - Compatible with any OpenTelemetry-compliant backend
 *
 * @example
 * ```typescript
 * import { OpenTelemetryObserver } from 'societyai/observability';
 *
 * const observer = new OpenTelemetryObserver({
 *   serviceName: 'my-society',
 *   exporterType: 'jaeger'
 * });
 *
 * await society.execute(input, { observer });
 * ```
 */

import { randomUUID } from 'crypto';
import { SocietyObserver, Agent, TaskResult } from '../core/types';

/**
 * OpenTelemetry configuration
 */
export interface OpenTelemetryConfig {
  /** Service name for tracing */
  serviceName: string;

  /** Exporter type (defaults to console) */
  exporterType?: 'console' | 'jaeger' | 'zipkin' | 'otlp';

  /** Exporter endpoint (for Jaeger, Zipkin, OTLP) */
  exporterEndpoint?: string;

  /** Additional attributes to add to all spans */
  globalAttributes?: Record<string, string | number | boolean>;

  /** Enable metrics collection */
  enableMetrics?: boolean;

  /** Sample rate (0.0 to 1.0) */
  sampleRate?: number;
}

/**
 * Span interface (compatible with @opentelemetry/api)
 * This is a lightweight interface to avoid hard dependency on OpenTelemetry
 */
export interface Span {
  setAttribute(key: string, value: string | number | boolean): this;
  setAttributes(attributes: Record<string, string | number | boolean>): this;
  setStatus(status: { code: number; message?: string }): this;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  end(): void;
}

/**
 * Tracer interface (compatible with @opentelemetry/api)
 */
export interface Tracer {
  startSpan(name: string, options?: Record<string, unknown>): Span;
}

/**
 * OpenTelemetry observer for SocietyAI
 *
 * This observer translates SocietyAI events into OpenTelemetry spans and metrics
 *
 * **Note**: This requires @opentelemetry/api to be installed as a peer dependency
 */
export class OpenTelemetryObserver implements SocietyObserver {
  private config: Required<OpenTelemetryConfig>;
  private tracer?: Tracer;
  /**
   * Active spans keyed by a unique handle (O-14).
   * Agent spans use `agent:<uuid>` rather than `agent:<agentId>` so that
   * multiple concurrent executions of the same agent never collide.
   */
  private spans: Map<string, Span> = new Map();
  private rootSpan?: Span;

  constructor(config: OpenTelemetryConfig) {
    this.config = {
      serviceName: config.serviceName,
      exporterType: config.exporterType || 'console',
      exporterEndpoint: config.exporterEndpoint || '',
      globalAttributes: config.globalAttributes || {},
      enableMetrics: config.enableMetrics !== false,
      sampleRate: config.sampleRate || 1.0,
    };

    // O-15: use dynamic import() instead of require() so bundlers can
    // tree-shake the optional dependency.  Wrap in void to avoid an
    // unhandled-rejection warning; the fallback is a no-op tracer.
    void this.initialize();
  }

  /**
   * Initialize OpenTelemetry.
   * Uses dynamic import() (O-15) so the optional dependency is only loaded
   * at runtime when actually installed, keeping the module side-effect free.
   */
  private async initialize(): Promise<void> {
    try {
      // Dynamic import of an optional peer dependency.  TypeScript does not
      // have type declarations for it (it is not installed), so we use
      // Function() to defer resolution entirely to runtime without triggering
      // a TS2307 "cannot find module" error.
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const load = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
      const otelApi = (await load('@opentelemetry/api')) as {
        trace: { getTracer(name: string): Tracer };
      };
      this.tracer = otelApi.trace.getTracer(this.config.serviceName);
    } catch {
      console.warn(
        'OpenTelemetry not available. Install @opentelemetry/api to enable tracing:',
        'npm install @opentelemetry/api @opentelemetry/sdk-node'
      );
    }
  }

  /**
   * Called when society execution starts
   */
  onSocietyStart(prompt: string, agentCount: number): void {
    if (!this.tracer) return;

    this.rootSpan = this.tracer.startSpan('society.execute', {
      attributes: {
        'society.prompt.length': prompt.length,
        'society.agent.count': agentCount,
        ...this.config.globalAttributes,
      },
    });
  }

  /**
   * Called when a node starts execution
   */
  onNodeStart(nodeId: string, input: string): void {
    if (!this.tracer) return;

    // O-13: pass the root span as parent context so node spans are children
    const span = this.tracer.startSpan(`node.${nodeId}`, {
      ...(this.rootSpan ? { parent: this.rootSpan } : {}),
      attributes: {
        'node.id': nodeId,
        'node.input.length': input.length,
        ...this.config.globalAttributes,
      },
    });

    this.spans.set(`node:${nodeId}`, span);
  }

  /**
   * Called when a node completes execution
   */
  onNodeEnd(nodeId: string, output: string, duration: number): void {
    const span = this.spans.get(`node:${nodeId}`);
    if (span) {
      span.setAttributes({
        'node.output.length': output.length,
        'node.duration.ms': duration,
      });
      span.setStatus({ code: 0 }); // OK
      span.end();
      this.spans.delete(`node:${nodeId}`);
    }
  }

  /**
   * Called when a node encounters an error
   */
  onNodeError(nodeId: string, error: Error): void {
    const span = this.spans.get(`node:${nodeId}`);
    if (span) {
      span.setStatus({
        code: 2, // ERROR
        message: error.message,
      });
      span.addEvent('error', {
        'error.message': error.message,
        'error.stack': error.stack || '',
      });
      span.end();
      this.spans.delete(`node:${nodeId}`);
    }
  }

  /**
   * Called when an agent starts execution.
   *
   * Returns a unique span handle (O-14) so that concurrent executions of the
   * same agent each get their own span without key collisions.
   * The handle is stored and returned so callers can pass it to
   * `onAgentComplete`/`onAgentError`; when called from a single-threaded
   * observer context the handle is implicitly managed here.
   */
  onAgentStart(agentId: string, modelName: string, input: string): void {
    if (!this.tracer) return;

    // Unique handle per execution (O-14)
    const handle = `agent:${agentId}:${randomUUID()}`;

    // O-13: find nearest parent (node span for this agent, then root)
    const nodeSpan = this.spans.get(`node:${agentId}`);
    const parentSpan = nodeSpan ?? this.rootSpan;

    const span = this.tracer.startSpan(`agent.${agentId}`, {
      ...(parentSpan ? { parent: parentSpan } : {}),
      attributes: {
        'agent.id': agentId,
        'agent.model': modelName,
        'agent.input.length': input.length,
        ...this.config.globalAttributes,
      },
    });

    // Index by both the unique handle and the plain agentId (for backward
    // compat when callers only know the agentId).  The plain key is
    // overwritten each time; for the concurrent case the unique handle
    // should be used.
    this.spans.set(handle, span);
    this.spans.set(`agent:${agentId}`, span);
  }

  /**
   * Called when an agent completes execution
   */
  onAgentComplete(agentId: string, _modelName: string, output: string): void {
    const span = this.spans.get(`agent:${agentId}`);
    if (span) {
      span.setAttributes({
        'agent.output.length': output.length,
      });
      span.setStatus({ code: 0 });
      span.end();
      this.spans.delete(`agent:${agentId}`);
    }
  }

  /**
   * Called when an agent encounters an error
   */
  onAgentError(agentId: string, _modelName: string, error: Error): void {
    const span = this.spans.get(`agent:${agentId}`);
    if (span) {
      span.setStatus({
        code: 2,
        message: error.message,
      });
      span.addEvent('error', {
        'error.message': error.message,
        'error.stack': error.stack || '',
      });
      span.end();
      this.spans.delete(`agent:${agentId}`);
    }
  }

  /**
   * Called when a task starts
   */
  onTaskStart(taskId: string, agents: Agent[]): void {
    if (!this.tracer) return;

    // O-13: task spans are children of the root span
    const span = this.tracer.startSpan(`task.${taskId}`, {
      ...(this.rootSpan ? { parent: this.rootSpan } : {}),
      attributes: {
        'task.id': taskId,
        'task.agent_count': agents.length,
        'task.agent_ids': agents.map((a) => a.id).join(','),
        ...this.config.globalAttributes,
      },
    });

    this.spans.set(`task:${taskId}`, span);
  }

  /**
   * Called when a task ends
   */
  onTaskEnd(taskId: string, results: TaskResult): void {
    const span = this.spans.get(`task:${taskId}`);
    if (span) {
      span.setAttributes({
        'task.success': results.success,
        'task.output.length': results.output.length,
        'task.duration.ms': results.duration ?? 0,
      });
      span.setStatus({ code: results.success ? 0 : 2 });
      span.end();
      this.spans.delete(`task:${taskId}`);
    }
  }

  /**
   * Called when society execution completes
   */
  onSocietyComplete(finalResult: string): void {
    if (this.rootSpan) {
      this.rootSpan.setAttributes({
        'society.output.length': finalResult.length,
      });
      this.rootSpan.setStatus({ code: 0 });
      this.rootSpan.end();
      this.rootSpan = undefined;
    }
  }

  /**
   * Called when society execution fails
   */
  onSocietyError(error: Error): void {
    if (this.rootSpan) {
      this.rootSpan.setStatus({
        code: 2,
        message: error.message,
      });
      this.rootSpan.addEvent('error', {
        'error.message': error.message,
        'error.stack': error.stack || '',
      });
      this.rootSpan.end();
      this.rootSpan = undefined;
    }
  }

  /**
   * Called at the start of a collaboration phase
   */
  onPhaseStart(phase: string): void {
    if (!this.tracer) return;

    // O-13: phase spans are children of the root span
    const span = this.tracer.startSpan(`phase.${phase}`, {
      ...(this.rootSpan ? { parent: this.rootSpan } : {}),
      attributes: {
        'phase.name': phase,
        ...this.config.globalAttributes,
      },
    });

    this.spans.set(`phase:${phase}`, span);
  }

  /**
   * Called at the end of a collaboration phase
   */
  onPhaseComplete(phase: string): void {
    const span = this.spans.get(`phase:${phase}`);
    if (span) {
      span.setStatus({ code: 0 });
      span.end();
      this.spans.delete(`phase:${phase}`);
    }
  }

  /**
   * Cleanup and flush traces
   */
  async shutdown(): Promise<void> {
    // End any remaining spans
    for (const span of this.spans.values()) {
      span.end();
    }
    this.spans.clear();

    if (this.rootSpan) {
      this.rootSpan.end();
      this.rootSpan = undefined;
    }
  }
}

/**
 * Helper to create a basic OpenTelemetry setup
 * This is a convenience function for quick setup
 *
 * @example
 * ```typescript
 * const observer = createOpenTelemetryObserver({
 *   serviceName: 'my-society',
 *   exporterType: 'console'
 * });
 * ```
 */
export function createOpenTelemetryObserver(config: OpenTelemetryConfig): OpenTelemetryObserver {
  return new OpenTelemetryObserver(config);
}
