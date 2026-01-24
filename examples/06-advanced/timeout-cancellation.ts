/**
 * Example: Timeout and Cancellation
 * 
 * Handle timeouts and cancel long-running operations.
 */

import {
  StandardModelBase,
  society,
  SocietyObserver,
  setGlobalLogLevel,
  LogLevel,
} from '../../src';

setGlobalLogLevel(LogLevel.INFO);

/**
 * Model with configurable delay
 */
class DelayedModel extends StandardModelBase {
  constructor(name: string, private delay: number) {
    super(
      { name, timeout: delay + 5000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return `[${name}] After ${delay}ms: ${String(prompt).substring(0, 50)}...`;
      }
    );
  }
}

/**
 * Model that respects cancellation
 */
class CancellableModel extends StandardModelBase {
  private abortController: AbortController | null = null;

  constructor(name: string, private delay: number) {
    super(
      { name, timeout: 60000 },
      async (prompt: unknown) => {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
          // Simulate work that can be cancelled
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, delay);
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Operation cancelled'));
            });
          });

          return `[${name}] Completed: ${String(prompt).substring(0, 50)}...`;
        } finally {
          this.abortController = null;
        }
      }
    );
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

/**
 * Example 1: Basic Timeout Handling
 */
async function basicTimeoutHandling(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Timeout Handling');
  console.log('='.repeat(60) + '\n');

  // Model with short timeout
  class TimeoutModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'TimeoutModel', timeout: 500 }, // 500ms timeout
        async (prompt: unknown) => {
          // Takes longer than timeout
          await new Promise(resolve => setTimeout(resolve, 2000));
          return `Result: ${prompt}`;
        }
      );
    }
  }

  const model = new TimeoutModel();

  console.log('Model timeout: 500ms');
  console.log('Operation duration: 2000ms');
  console.log('Expected: Timeout error\n');

  try {
    await model.process('Test prompt');
    console.log('Completed (unexpected)');
  } catch (error) {
    console.log('Error:', (error as Error).message);
  }
}

/**
 * Example 2: Per-Agent Timeouts
 */
async function perAgentTimeouts(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Per-Agent Timeouts');
  console.log('='.repeat(60) + '\n');

  const models = [
    new DelayedModel('Fast', 100),
    new DelayedModel('Medium', 300),
    new DelayedModel('Slow', 800),
  ];

  const timeoutTracker: Map<number, number> = new Map();
  const startTimes: Map<number, number> = new Map();

  const observer: SocietyObserver = {
    onSocietyStart(_prompt: string, _agentCount: number): void {},

    onAgentStart(agentId: number, _modelName: string, _prompt: unknown): void {
      startTimes.set(agentId, Date.now());
    },

    onAgentComplete(agentId: number, modelName: string, _result: string): void {
      const start = startTimes.get(agentId) || Date.now();
      const duration = Date.now() - start;
      timeoutTracker.set(agentId, duration);
      console.log(`  Agent ${agentId} (${modelName}): ${duration}ms`);
    },

    onAgentError(agentId: number, modelName: string, error: Error): void {
      console.log(`  Agent ${agentId} (${modelName}) error: ${error.message}`);
    },

    onPhaseStart(_phase: string): void {},
    onPhaseComplete(_phase: string): void {},
    onSocietyComplete(_finalResult: string): void {},
  };

  console.log('Agent response times:\n');

  await society(
    'Test with different speeds',
    3,
    models,
    true,
    observer
  );

  console.log('\nAll agents completed within their timeouts.');
}

/**
 * Example 3: Global Timeout for Entire Operation
 */
async function globalOperationTimeout(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Global Operation Timeout');
  console.log('='.repeat(60) + '\n');

  // Wrapper function with global timeout
  async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message = 'Operation timed out'
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  const model = new DelayedModel('SlowModel', 2000);

  console.log('Global timeout: 1000ms');
  console.log('Model delay: 2000ms\n');

  try {
    await withTimeout(
      society('Test global timeout', 3, [model], false),
      1000,
      'Society operation timed out'
    );
  } catch (error) {
    console.log('Caught:', (error as Error).message);
  }
}

/**
 * Example 4: Cancellation Pattern
 */
async function cancellationPattern(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Cancellation Pattern');
  console.log('='.repeat(60) + '\n');

  const model = new CancellableModel('CancellableModel', 5000);

  console.log('Starting operation...');
  console.log('Will cancel after 500ms\n');

  const operationPromise = model.process('Long running task');

  // Cancel after 500ms
  setTimeout(() => {
    console.log('Cancelling operation...');
    model.cancel();
  }, 500);

  try {
    await operationPromise;
    console.log('Completed (unexpected)');
  } catch (error) {
    console.log('Result:', (error as Error).message);
  }
}

/**
 * Example 5: Timeout with Fallback Value
 */
async function timeoutWithFallback(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Timeout with Fallback Value');
  console.log('='.repeat(60) + '\n');

  async function withTimeoutFallback<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        console.log('  Timeout reached, using fallback');
        resolve(fallback);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch {
      clearTimeout(timeoutId!);
      return fallback;
    }
  }

  const slowModel = new DelayedModel('SlowModel', 3000);

  const result = await withTimeoutFallback(
    slowModel.process('Test'),
    500,
    'Fallback response due to timeout'
  );

  console.log('Result:', result);
}

/**
 * Example 6: Progressive Timeout
 */
async function progressiveTimeout(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 6: Progressive Timeout');
  console.log('='.repeat(60) + '\n');

  // Each retry gets longer timeout
  async function withProgressiveTimeout<T>(
    fn: () => Promise<T>,
    timeouts: number[]
  ): Promise<T> {
    for (let i = 0; i < timeouts.length; i++) {
      const timeout = timeouts[i];
      console.log(`  Attempt ${i + 1} with ${timeout}ms timeout`);

      try {
        return await new Promise<T>((resolve, reject) => {
          const timeoutId = setTimeout(
            () => reject(new Error('Timeout')),
            timeout
          );

          fn()
            .then((result) => {
              clearTimeout(timeoutId);
              resolve(result);
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        });
      } catch (error) {
        if (i === timeouts.length - 1) {
          throw error;
        }
        console.log(`  Attempt ${i + 1} timed out, retrying...`);
      }
    }

    throw new Error('All attempts failed');
  }

  let callCount = 0;
  const variableModel = new StandardModelBase(
    { name: 'VariableModel', timeout: 30000 },
    async (prompt: unknown) => {
      callCount++;
      // First call takes 600ms, second takes 300ms
      const delay = callCount === 1 ? 600 : 300;
      await new Promise(resolve => setTimeout(resolve, delay));
      return `Success on attempt ${callCount}`;
    }
  );

  console.log('Progressive timeouts: [200ms, 500ms, 1000ms]\n');

  try {
    const result = await withProgressiveTimeout(
      () => variableModel.process('test'),
      [200, 500, 1000]
    );
    console.log('\nResult:', result);
  } catch (error) {
    console.log('Failed:', (error as Error).message);
  }
}

/**
 * Example 7: Deadline-Based Execution
 */
async function deadlineBasedExecution(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 7: Deadline-Based Execution');
  console.log('='.repeat(60) + '\n');

  class DeadlineExecutor {
    private deadline: number;

    constructor(deadlineMs: number) {
      this.deadline = Date.now() + deadlineMs;
    }

    getRemainingTime(): number {
      return Math.max(0, this.deadline - Date.now());
    }

    isExpired(): boolean {
      return Date.now() >= this.deadline;
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      const remaining = this.getRemainingTime();
      
      if (remaining === 0) {
        throw new Error('Deadline already expired');
      }

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(
          () => reject(new Error('Deadline exceeded')),
          remaining
        );

        fn()
          .then((result) => {
            clearTimeout(timeoutId);
            resolve(result);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });
    }
  }

  const executor = new DeadlineExecutor(1000); // 1 second deadline

  console.log('Deadline: 1000ms from now\n');

  // First operation: 200ms
  console.log(`Remaining time: ${executor.getRemainingTime()}ms`);
  await executor.execute(() => 
    new DelayedModel('Op1', 200).process('First')
  );
  console.log('First operation completed');

  // Second operation: 300ms
  console.log(`Remaining time: ${executor.getRemainingTime()}ms`);
  await executor.execute(() =>
    new DelayedModel('Op2', 300).process('Second')
  );
  console.log('Second operation completed');

  // Third operation: would exceed deadline
  console.log(`Remaining time: ${executor.getRemainingTime()}ms`);
  try {
    await executor.execute(() =>
      new DelayedModel('Op3', 600).process('Third')
    );
  } catch (error) {
    console.log('Third operation:', (error as Error).message);
  }
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicTimeoutHandling();
    await perAgentTimeouts();
    await globalOperationTimeout();
    await cancellationPattern();
    await timeoutWithFallback();
    await progressiveTimeout();
    await deadlineBasedExecution();

    console.log('\n✨ All timeout examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DelayedModel, CancellableModel };
