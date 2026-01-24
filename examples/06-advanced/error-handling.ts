/**
 * Example: Error Handling and Retry
 * 
 * Robust error handling strategies for production systems.
 */

import {
  StandardModelBase,
  society,
  SocietyObserver,
  setGlobalLogLevel,
  LogLevel,
} from '../../src';
import { SocietyError } from '../../src/errors';

setGlobalLogLevel(LogLevel.INFO);

/**
 * Custom error class for model errors
 */
class ModelError extends Error {
  constructor(message: string, public code: string, public retryable: boolean) {
    super(message);
    this.name = 'ModelError';
  }
}

/**
 * Model that randomly fails
 */
class UnreliableModel extends StandardModelBase {
  private failureRate: number;
  private callCount = 0;

  constructor(name: string, failureRate = 0.5) {
    super(
      { name, timeout: 10000 },
      async (prompt: unknown) => {
        this.callCount++;
        await new Promise(resolve => setTimeout(resolve, 200));

        if (Math.random() < failureRate) {
          throw new Error(`Random failure on call ${this.callCount}`);
        }

        return `[${name}] Success on call ${this.callCount}: ${String(prompt).substring(0, 50)}...`;
      }
    );

    this.failureRate = failureRate;
  }
}

/**
 * Model with specific error types
 */
class SpecificErrorModel extends StandardModelBase {
  constructor(private errorType: 'timeout' | 'rate-limit' | 'auth' | 'server' | 'none') {
    super(
      { name: `ErrorModel-${errorType}`, timeout: 5000 },
      async (prompt: unknown) => {
        await new Promise(resolve => setTimeout(resolve, 100));

        switch (errorType) {
          case 'timeout':
            await new Promise(resolve => setTimeout(resolve, 10000));
            throw new Error('Timeout exceeded');
          case 'rate-limit':
            throw new ModelError('Rate limit exceeded', 'RateLimitError', true);
          case 'auth':
            throw new ModelError('Invalid API key', 'AuthenticationError', false);
          case 'server':
            throw new ModelError('Internal server error', 'ServerError', true);
          default:
            return `Success: ${String(prompt).substring(0, 50)}...`;
        }
      }
    );
  }
}

/**
 * Example 1: Basic Error Handling
 */
async function basicErrorHandling(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 1: Basic Error Handling');
  console.log('='.repeat(60) + '\n');

  const unreliableModel = new UnreliableModel('Unreliable', 0.3);

  try {
    const result = await society(
      'Test with unreliable model',
      3,
      [unreliableModel],
      false
    );
    console.log('Result:', result.substring(0, 200));
  } catch (error) {
    if (error instanceof SocietyError) {
      console.log('Society Error:', error.message);
      console.log('Error Type:', error.name);
    } else if (error instanceof ModelError) {
      console.log('Model Error:', error.message);
      console.log('Retryable:', error.retryable);
    } else {
      console.log('Unknown Error:', error);
    }
  }
}

/**
 * Example 2: Custom Retry Configuration
 */
async function customRetryConfig(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Custom Retry Configuration');
  console.log('='.repeat(60) + '\n');

  // Custom retry configuration
  interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors?: string[];
  }

  const retryConfig: RetryConfig = {
    maxRetries: 5,
    initialDelay: 100,
    maxDelay: 2000,
    backoffMultiplier: 2,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'RateLimitError', 'ServerError'],
  };

  console.log('Retry Configuration:');
  console.log(`  Max Retries: ${retryConfig.maxRetries}`);
  console.log(`  Initial Delay: ${retryConfig.initialDelay}ms`);
  console.log(`  Max Delay: ${retryConfig.maxDelay}ms`);
  console.log(`  Backoff: ${retryConfig.backoffMultiplier}x`);
  console.log(`  Retryable Errors: ${retryConfig.retryableErrors?.join(', ')}`);
  console.log('');

  // Model with built-in retry
  class RetryingModel extends StandardModelBase {
    private attempts = 0;

    constructor() {
      super(
        { name: 'RetryingModel', timeout: 30000 },
        async (prompt: unknown) => {
          this.attempts++;
          
          // Fail first 2 attempts, succeed on 3rd
          if (this.attempts < 3) {
            console.log(`  Attempt ${this.attempts}: Failed (will retry)`);
            throw new ModelError('Temporary failure', 'ServerError', true);
          }

          console.log(`  Attempt ${this.attempts}: Success!`);
          return `Success after ${this.attempts} attempts`;
        }
      );
    }
  }

  const model = new RetryingModel();
  
  try {
    const result = await society('Test retry', 1, [model], false);
    console.log('\nResult:', result);
  } catch (error) {
    console.log('Failed after retries:', error);
  }
}

/**
 * Example 3: Error Observer Pattern
 */
async function errorObserverPattern(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Error Observer Pattern');
  console.log('='.repeat(60) + '\n');

  const errors: Array<{ agentId: number; error: Error; timestamp: Date }> = [];

  const errorTrackingObserver: SocietyObserver = {
    onSocietyStart(_prompt: string, _agentCount: number): void {},
    onAgentStart(_agentId: number, _modelName: string, _prompt: unknown): void {},
    onAgentComplete(_agentId: number, _modelName: string, _result: string): void {},

    onAgentError(agentId: number, modelName: string, error: Error): void {
      console.log(`  ❌ Agent ${agentId} (${modelName}) error: ${error.message}`);
      errors.push({ agentId, error, timestamp: new Date() });
    },

    onPhaseStart(_phase: string): void {},
    onPhaseComplete(_phase: string): void {},

    onSocietyComplete(_finalResult: string): void {
      if (errors.length > 0) {
        console.log(`\n⚠ ${errors.length} errors occurred during execution`);
      }
    },
  };

  const unreliableModel = new UnreliableModel('Flaky', 0.4);

  try {
    await society(
      'Test with error tracking',
      5,
      [unreliableModel],
      false,
      errorTrackingObserver
    );
  } catch {
    // Expected
  }

  console.log('\nError Summary:');
  errors.forEach((e, i) => {
    console.log(`  ${i + 1}. Agent ${e.agentId}: ${e.error.message}`);
  });
}

/**
 * Example 4: Fallback Strategy
 */
async function fallbackStrategy(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Fallback Strategy');
  console.log('='.repeat(60) + '\n');

  // Primary model (might fail)
  class PrimaryModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'Primary', timeout: 5000 },
        async (_prompt: unknown) => {
          throw new Error('Primary model unavailable');
        }
      );
    }
  }

  // Fallback model (always works)
  class FallbackModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'Fallback', timeout: 5000 },
        async (prompt: unknown) => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return `[Fallback] ${String(prompt).substring(0, 50)}...`;
        }
      );
    }
  }

  // Wrapper with fallback
  class ModelWithFallback extends StandardModelBase {
    constructor(
      private primary: StandardModelBase,
      private fallback: StandardModelBase
    ) {
      super(
        { name: 'ModelWithFallback', timeout: 30000 },
        async (prompt: unknown) => {
          try {
            console.log('  Trying primary model...');
            return await primary.process(prompt);
          } catch (error) {
            console.log('  Primary failed, using fallback...');
            return await fallback.process(prompt);
          }
        }
      );
    }
  }

  const model = new ModelWithFallback(
    new PrimaryModel(),
    new FallbackModel()
  );

  const result = await society('Test fallback', 2, [model], false);
  console.log('\nResult:', result.substring(0, 200));
}

/**
 * Example 5: Circuit Breaker Pattern
 */
async function circuitBreakerPattern(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Circuit Breaker Pattern');
  console.log('='.repeat(60) + '\n');

  class CircuitBreaker {
    private failures = 0;
    private lastFailureTime = 0;
    private state: 'closed' | 'open' | 'half-open' = 'closed';

    constructor(
      private threshold: number = 3,
      private resetTimeout: number = 10000
    ) {}

    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (this.state === 'open') {
        if (Date.now() - this.lastFailureTime > this.resetTimeout) {
          this.state = 'half-open';
          console.log('  Circuit: half-open (testing)');
        } else {
          throw new Error('Circuit breaker is open');
        }
      }

      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }

    private onSuccess(): void {
      this.failures = 0;
      if (this.state === 'half-open') {
        this.state = 'closed';
        console.log('  Circuit: closed (recovered)');
      }
    }

    private onFailure(): void {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.state = 'open';
        console.log(`  Circuit: open (${this.failures} failures)`);
      }
    }

    getState(): string {
      return this.state;
    }
  }

  // Model with circuit breaker
  const circuitBreaker = new CircuitBreaker(3, 5000);
  let callCount = 0;

  class ProtectedModel extends StandardModelBase {
    constructor() {
      super(
        { name: 'Protected', timeout: 10000 },
        async (prompt: unknown) => {
          return circuitBreaker.execute(async () => {
            callCount++;
            await new Promise(resolve => setTimeout(resolve, 100));

            // Fail first 5 calls
            if (callCount <= 5) {
              throw new Error(`Call ${callCount} failed`);
            }

            return `Success on call ${callCount}`;
          });
        }
      );
    }
  }

  const model = new ProtectedModel();

  console.log('Simulating failures with circuit breaker...\n');

  for (let i = 0; i < 7; i++) {
    try {
      const result = await model.process('test');
      console.log(`Call ${i + 1}: ${result}`);
    } catch (error) {
      console.log(`Call ${i + 1}: ${(error as Error).message}`);
    }
    console.log(`  State: ${circuitBreaker.getState()}`);
  }
}

/**
 * Example 6: Graceful Degradation
 */
async function gracefulDegradation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 6: Graceful Degradation');
  console.log('='.repeat(60) + '\n');

  // Different quality levels
  class QualityLevelModel extends StandardModelBase {
    constructor(
      private level: 'premium' | 'standard' | 'basic',
      private shouldFail: boolean = false
    ) {
      super(
        { name: `${level}-model`, timeout: 10000 },
        async (prompt: unknown) => {
          if (shouldFail) {
            throw new Error(`${level} model unavailable`);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          return `[${level.toUpperCase()}] ${String(prompt).substring(0, 50)}...`;
        }
      );
    }
  }

  // Try premium, fall back to standard, then basic
  const models = [
    new QualityLevelModel('premium', true),   // Fails
    new QualityLevelModel('standard', true),  // Fails
    new QualityLevelModel('basic', false),    // Works
  ];

  class DegradingModel extends StandardModelBase {
    constructor(private modelChain: StandardModelBase[]) {
      super(
        { name: 'DegradingModel', timeout: 30000 },
        async (prompt: unknown) => {
          for (const model of modelChain) {
            try {
              console.log(`  Trying ${model.name}...`);
              return await model.process(prompt);
            } catch {
              console.log(`  ${model.name} failed, trying next...`);
            }
          }
          throw new Error('All models failed');
        }
      );
    }
  }

  const model = new DegradingModel(models);
  const result = await model.process('Test degradation');
  console.log('\nResult:', result);
}

// Run all examples
async function main(): Promise<void> {
  try {
    await basicErrorHandling();
    await customRetryConfig();
    await errorObserverPattern();
    await fallbackStrategy();
    await circuitBreakerPattern();
    await gracefulDegradation();

    console.log('\n✨ All error handling examples completed!\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { UnreliableModel, SpecificErrorModel };
