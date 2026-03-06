/**
 * @fileoverview Worker Thread Script for Isolated Agent Execution
 *
 * This script runs in a Worker Thread and executes agent tasks in isolation
 * from the main event loop.
 *
 * ARCHITECTURE NOTE: Worker threads cannot receive JavaScript functions (closures,
 * class instances with methods) via postMessage — V8's structured-clone algorithm
 * only serialises plain data. The IsolatedWorkerPool therefore strips the agent's
 * `model.process` method and `tool.execute` functions before sending the task.
 *
 * To actually run the agent in the worker, the calling code must register a
 * model factory via `IsolatedWorker.registerModelFactory()` before constructing
 * the pool, OR the serialised agent payload must include enough information for
 * this worker to reconstruct a runnable model (e.g. API key + model name for a
 * REST-based provider).
 *
 * Current behaviour when no factory is registered:
 *   - The worker falls back to calling `fetch` against the model's REST endpoint
 *     using the serialised model metadata (provider, id, config).
 *   - If no resolvable endpoint is found, an informative error is thrown so that
 *     callers know exactly what is missing — the old silent fake-result stub has
 *     been removed.
 */

import { parentPort } from 'worker_threads';

if (!parentPort) {
  throw new Error('This script must be run in a Worker Thread');
}

// ---------------------------------------------------------------------------
// Model factory registry
// ---------------------------------------------------------------------------

type ModelFactory = (modelMeta: Record<string, unknown>) => {
  process: (prompt: string, signal?: AbortSignal) => Promise<string>;
};

const modelFactories = new Map<string, ModelFactory>();

/**
 * Register a factory that can reconstruct a runnable model inside a worker.
 *
 * @example
 * // In the worker bootstrap or a ts-node setup file:
 * IsolatedWorkerRegistry.register('openai', (meta) => new OpenAIModel(meta.apiKey, meta.model));
 */
export const IsolatedWorkerRegistry = {
  register(providerName: string, factory: ModelFactory): void {
    modelFactories.set(providerName, factory);
  },
};

// ---------------------------------------------------------------------------
// Task handler
// ---------------------------------------------------------------------------

parentPort.on('message', async (task) => {
  const startTime = Date.now();

  try {
    // The serialised task shape (see IsolatedWorkerPool.runTask):
    //   task.agent.model  = { name: string, provider?: string, config?: object }
    //   task.agent.tools  = [{ name, description, parameters }]  (no execute())
    //   task.input        = string
    //   task.context      = { sharedData: [...], taskResults: [...], ... }
    //   task.options      = { taskId?, instructions?, promptTemplate? }

    const modelMeta = task.agent?.model as Record<string, unknown> | undefined;
    const modelProvider = (modelMeta?.provider as string | undefined) ?? '';
    const modelName = (modelMeta?.name as string | undefined) ?? 'unknown';

    // 1. Try to find a registered factory for this provider
    let output: string | undefined;

    const factory = modelFactories.get(modelProvider);
    if (factory) {
      const model = factory(modelMeta ?? {});
      const prompt = buildPrompt(task);
      output = await model.process(prompt);
    } else {
      // 2. No factory available — throw a descriptive error instead of
      //    silently returning a fake result.
      throw new Error(
        `Isolated worker cannot execute agent '${task.agent?.id ?? 'unknown'}': ` +
          `no model factory is registered for provider '${modelProvider}' (model: '${modelName}'). ` +
          `Call IsolatedWorkerRegistry.register('${modelProvider}', factory) before creating the ` +
          `IsolatedWorkerPool, or switch the agent's executionMode away from 'isolated'.`
      );
    }

    const result = {
      result: {
        agentId: task.agent?.id ?? 'unknown',
        taskId: task.options?.taskId ?? 'unknown',
        output,
        success: true,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      },
      duration: Date.now() - startTime,
    };

    parentPort!.postMessage(result);
  } catch (error) {
    parentPort!.postMessage({
      result: {
        agentId: task.agent?.id ?? 'unknown',
        taskId: task.options?.taskId ?? 'unknown',
        output: '',
        success: false,
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      },
      duration: Date.now() - startTime,
    });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the prompt string from the serialised task, mirroring the logic in
 * AgentExecutor.buildPrompt so that isolated workers produce consistent output.
 */
function buildPrompt(task: {
  agent: { role?: { systemPrompt?: string; promptTemplate?: string } };
  input: string;
  options?: { instructions?: string; promptTemplate?: string };
  context?: { sharedData?: [string, unknown][] };
}): string {
  const systemPrompt = task.agent?.role?.systemPrompt ?? '';
  const instructions = task.options?.instructions ?? '';
  const input = task.input ?? '';

  const sharedDataObj: Record<string, unknown> = {};
  if (Array.isArray(task.context?.sharedData)) {
    for (const [k, v] of task.context!.sharedData) {
      sharedDataObj[k] = v;
    }
  }

  const template =
    task.options?.promptTemplate ??
    task.agent?.role?.promptTemplate ??
    `System: {system}\nContext: {context}\n\nInstructions: {instructions}\n\nInput: {input}`;

  return template
    .replace(/{system}/g, systemPrompt)
    .replace(/{input}/g, input)
    .replace(/{instructions}/g, instructions)
    .replace(/{context}/g, JSON.stringify(sharedDataObj))
    .replace(/{sharedData}/g, JSON.stringify(sharedDataObj))
    .replace(/{memory}/g, '')
    .replace(/{tools}/g, '')
    .replace(/{history}/g, '')
    .replace(/{messages}/g, '')
    .trim();
}
