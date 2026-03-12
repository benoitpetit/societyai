import { Agent, TaskResult, ExecutionContext, LoopConfig } from '../core/types';
import { getLogger } from '../observability/logger';
import { extractJsonFromText } from '../utils/json';
import { LoopController } from '../utils/loop-controller';
import { StructuredOutputValidator, JSONSchema } from '../capabilities/validation';
import { MiddlewareChain, MiddlewareContext, MiddlewareResult } from '../core/middleware';

/**
 * AgentExecutor - Orchestrates the execution of a single agent.
 * Handles: Middleware -> Prompting -> Tool Execution -> Schema Validation -> Loop Check.
 */
export class AgentExecutor {
  private logger = getLogger();

  constructor(private agent: Agent) {}

  /**
   * Executes the agent for a given input.
   */
  async execute(
    input: string,
    context: ExecutionContext,
    options: {
      taskId: string;
      instructions?: string;
      promptTemplate?: string;
      outputSchema?: JSONSchema;
      loopConfig?: LoopConfig;
      signal?: AbortSignal;
      middlewareChain?: MiddlewareChain;
      /** Maximum number of ReAct tool-execution steps per agent call (default: 5) */
      maxToolSteps?: number;
    }
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const loop = new LoopController(options.loopConfig || { maxIterations: 1 });
    let currentInput = input;
    const originalInput = input;
    let lastOutput = '';
    let success = true;
    let error: Error | undefined;

    this.logger.debug(`Agent ${this.agent.id} starting execution for task ${options.taskId}`);

    while (loop.next()) {
      // Reset per-iteration state so a prior failure doesn't bleed into a
      // successful retry iteration (#12)
      success = true;
      error = undefined;

      try {
        // 1. Prepare Middleware Context
        const mwContext: MiddlewareContext = {
          input: currentInput,
          processedInput: currentInput,
          metadata: new Map(),
          agentId: this.agent.id,
          stepId: options.taskId,
          signal: options.signal,
          startTime: Date.now(),
        };

        // 2. Orchestrate Execution via Middleware
        const execution = async (ctx: MiddlewareContext): Promise<MiddlewareResult> => {
          // A. Memory Retrieval (if available)
          let memoryContext = '';
          if (this.agent.memory) {
            const memories = await this.agent.memory.retrieve(String(ctx.processedInput));
            memoryContext = Array.isArray(memories) ? memories.join('\n') : memories;
          }

          // B. Tool Definitions Injection
          let toolsContext = '';
          if (this.agent.tools && this.agent.tools.length > 0) {
            toolsContext = JSON.stringify(
              this.agent.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
              null,
              2
            );
            toolsContext +=
              '\n\nTo use a tool, output a JSON block wrapped in <tool_code> tags, like this:\n<tool_code>\n{"name": "tool_name", "arguments": {"param1": "value"}}\n</tool_code>';
          }

          // C. Build Prompt
          const prompt = this.buildPrompt({
            system: this.agent.role.systemPrompt,
            input: String(ctx.processedInput),
            memory: memoryContext,
            tools: toolsContext,
            instructions: options.instructions,
            template: options.promptTemplate || this.agent.role.promptTemplate,
            context: context,
          });

          // D. Model Processing
          let output = await this.agent.model.process(prompt, ctx.signal);

          // E. ReAct Loop (Tool Execution)
          output = await this.runToolLoop(output, ctx, options.maxToolSteps);

          // F. Schema Validation
          if (options.outputSchema) {
            const validator = new StructuredOutputValidator(options.outputSchema);
            const validationResult = validator.validate(output);
            if (!validationResult.valid) {
              const feedback = `Validation failed: ${validationResult.errors?.map((e) => e.message).join(', ')}. Please correct your output.`;
              this.logger.info(`Validation failed for ${this.agent.id}: ${feedback}`);
              // In a loop, we could feed this back, but for now we throw to trigger retry or loop next
              throw new Error(feedback);
            }
          }

          return { output, continue: true };
        };

        const result = options.middlewareChain
          ? await options.middlewareChain.execute(mwContext, execution)
          : await execution(mwContext);

        lastOutput = result.output;

        // Store successful result in memory (M-01)
        if (this.agent.memory && lastOutput) {
          await this.agent.memory.add(lastOutput, {
            type: 'fact',
            metadata: { taskId: options.taskId, agentId: this.agent.id, timestamp: Date.now() },
          });
        }

        // G. Loop Exit Condition
        if (
          options.loopConfig?.exitCondition &&
          options.loopConfig.exitCondition(lastOutput, context)
        ) {
          break;
        }

        // If no more tools or iterations needed
        if (!options.loopConfig || options.loopConfig.maxIterations <= 1) {
          break;
        }
      } catch (e) {
        this.logger.error(`Error during agent ${this.agent.id} execution: ${(e as Error).message}`);
        error = e as Error;
        success = false;

        // If we have more iterations, feed back the error with original context preserved
        if (loop.iteration < (options.loopConfig?.maxIterations || 1)) {
          currentInput = `${originalInput}\n\n[Previous attempt failed: ${(e as Error).message}. Please try again with a corrected approach.]`;
          continue;
        }
        break;
      }
    }

    return {
      agentId: this.agent.id,
      taskId: options.taskId,
      output: lastOutput,
      success,
      error,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      iteration: loop.iteration,
    };
  }

  /**
   * Runs the internal ReAct loop for tool execution.
   */
  private async runToolLoop(
    initialOutput: string,
    ctx: MiddlewareContext,
    maxToolSteps = 5
  ): Promise<string> {
    if (!this.agent.tools || this.agent.tools.length === 0) return initialOutput;

    let currentOutput = initialOutput;

    for (let i = 0; i < maxToolSteps; i++) {
      const toolMatch = currentOutput.match(/<tool_code>([\s\S]*?)<\/tool_code>/);
      if (!toolMatch) break;

      const toolCall = extractJsonFromText<{ name: string; arguments: Record<string, unknown> }>(
        toolMatch[1]
      );
      if (!toolCall || !toolCall.name) break;

      const tool = this.agent.tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        const feedback = `Observation: Tool "${toolCall.name}" not found.`;
        currentOutput = await this.agent.model.process(`${currentOutput}\n${feedback}`, ctx.signal);
        continue;
      }

      this.logger.info(`Agent ${this.agent.id} executing tool ${tool.name}`);
      try {
        const result = await tool.execute(toolCall.arguments || {}, {
          agentId: this.agent.id,
          signal: ctx.signal,
        });
        const observation = `Observation: Tool "${tool.name}" returned: ${JSON.stringify(result)}`;
        currentOutput = await this.agent.model.process(
          `${currentOutput}\n${observation}`,
          ctx.signal
        );
      } catch (e) {
        const errorMsg = `Observation: Error executing tool ${tool.name}: ${(e as Error).message}`;
        currentOutput = await this.agent.model.process(`${currentOutput}\n${errorMsg}`, ctx.signal);
      }
    }

    return currentOutput;
  }

  /**
   * Builds the final prompt from various components.
   * Sections with no content (Memory, Tools, Instructions) are omitted entirely
   * to avoid cluttering the prompt with empty headings.
   */
  private buildPrompt(parts: {
    system: string;
    input: string;
    memory: string;
    tools: string;
    instructions?: string;
    template?: string;
    context: ExecutionContext;
  }): string {
    // If a custom template is provided, use it verbatim (with substitutions)
    if (parts.template) {
      return parts.template
        .replace(/{system}/g, parts.system)
        .replace(/{input}/g, parts.input)
        .replace(/{memory}/g, parts.memory)
        .replace(/{tools}/g, parts.tools)
        .replace(/{instructions}/g, parts.instructions || '')
        .replace(/{context}/g, JSON.stringify(Object.fromEntries(parts.context.sharedData)))
        .replace(/{sharedData}/g, JSON.stringify(Object.fromEntries(parts.context.sharedData)))
        .replace(/{history}/g, this.formatHistory(parts.context))
        .replace(/{messages}/g, this.formatMessages(parts.context))
        .trim();
    }

    // Build sections conditionally — omit empty ones
    const lines: string[] = [];

    lines.push(`System: ${parts.system}`);
    lines.push(`Context: ${JSON.stringify(Object.fromEntries(parts.context.sharedData))}`);

    if (parts.memory) {
      lines.push(`Memory: ${parts.memory}`);
    }

    if (parts.tools) {
      lines.push(`Tools: ${parts.tools}`);
    }

    if (parts.instructions) {
      lines.push('');
      lines.push(`Instructions: ${parts.instructions}`);
    }

    lines.push('');
    lines.push(`Input: ${parts.input}`);

    return lines.join('\n').trim();
  }

  /**
   * Formats the execution history from taskResults for prompt injection.
   */
  private formatHistory(context: ExecutionContext): string {
    if (context.taskResults.size === 0) return '';
    const entries: string[] = [];
    for (const [taskId, results] of context.taskResults) {
      for (const r of results) {
        entries.push(`[${taskId}/${r.agentId}]: ${r.output}`);
      }
    }
    return entries.join('\n');
  }

  /**
   * Formats the message history for collaborative prompt injection.
   */
  private formatMessages(context: ExecutionContext): string {
    if (context.messageHistory.length === 0) return '';
    return context.messageHistory.map((m) => `[${m.from} → ${m.to}]: ${m.content}`).join('\n');
  }
}
