/**
 * Example: Structured Output with Validation
 * 
 * This example demonstrates automatic JSON validation with retry logic
 * to ensure AI outputs match expected schemas.
 */

import {
  StructuredOutputBuilder,
  StructuredOutputValidator,
  createSchema,
  validateJSON,
  JSONSchema,
  StandardModelBase,
} from '../src';

// Mock AI Model that generates JSON
class JSONGeneratingModel extends StandardModelBase {
  private attemptCount = 0;

  constructor() {
    super({ name: 'json-generator' }, async (_prompt: unknown) => {
      this.attemptCount++;
      
      // First attempt: Invalid JSON
      if (this.attemptCount === 1) {
        return `Here's the user data:
{
  "name": "John Doe",
  "age": "thirty",
  "email": "invalid-email"
}`;
      }
      
      // Second attempt: Valid JSON
      return `{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "isActive": true
}`;
    });
  }

  resetAttempts(): void {
    this.attemptCount = 0;
  }
}

async function runValidationExample(): Promise<void> {
  console.log('=== Structured Output Validation Example ===\n');

  // Define JSON schema
  const userSchema: JSONSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      age: { type: 'number', minimum: 0, maximum: 150 },
      email: { type: 'string', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
      isActive: { type: 'boolean' },
    },
    required: ['name', 'age', 'email'],
  };

  console.log('Expected Schema:');
  console.log(JSON.stringify(userSchema, null, 2));
  console.log();

  // Create validator
  const validator = StructuredOutputBuilder.create()
    .withSchema(userSchema)
    .withMaxRetries(3)
    .build();

  // Test 1: Invalid output
  console.log('--- Test 1: Validating Invalid Output ---');
  
  const invalidOutput = `{
  "name": "John",
  "age": "thirty",
  "email": "not-an-email"
}`;

  const result1 = validator.validate(invalidOutput);
  console.log('Valid:', result1.valid);
  
  if (!result1.valid && result1.errors) {
    console.log('Errors found:');
    result1.errors.forEach(err => {
      console.log(`  - ${err.path}: ${err.message}`);
      if (err.expected) console.log(`    Expected: ${err.expected}`);
      if (err.actual) console.log(`    Actual: ${JSON.stringify(err.actual)}`);
    });
  }

  // Test 2: Valid output
  console.log('\n--- Test 2: Validating Valid Output ---');
  
  const validOutput = `{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com",
  "isActive": true
}`;

  const result2 = validator.validate(validOutput);
  console.log('Valid:', result2.valid);
  
  if (result2.valid && result2.data) {
    console.log('Parsed data:', result2.data);
  }

  // Test 3: Automatic retry with AI model
  console.log('\n--- Test 3: Automatic Retry with Error Feedback ---');
  
  const model = new JSONGeneratingModel();
  
  const agentOutput = await model.process('Generate user data');
  console.log('Initial AI output:');
  console.log(agentOutput);
  console.log();

  const result3 = await validator.validateAndRetry(
    agentOutput,
    async (errorFeedback) => {
      console.log('Retry triggered with feedback:');
      console.log(errorFeedback);
      console.log();
      
      // Agent retries with error feedback
      return await model.process(`Previous attempt had errors:\n${errorFeedback}\n\nPlease correct and generate valid JSON.`);
    }
  );

  console.log('Final validation result:');
  console.log('Valid:', result3.valid);
  
  if (result3.valid && result3.data) {
    console.log('Successfully parsed data:', result3.data);
  }

  // Test 4: Quick validation helper
  console.log('\n--- Test 4: Quick Validation Helper ---');
  
  const quickResult = validateJSON(validOutput, userSchema);
  console.log('Quick validate:', quickResult.valid);

  // Test 5: Create schema from object
  console.log('\n--- Test 5: Create Schema from Properties ---');
  
  const dynamicSchema = createSchema({
    title: { type: 'string', required: true, description: 'Article title' },
    content: { type: 'string', required: true, description: 'Article content' },
    views: { type: 'number', required: false, description: 'View count' },
    published: { type: 'boolean', required: false, description: 'Publication status' },
  });

  console.log('Generated schema:');
  console.log(JSON.stringify(dynamicSchema, null, 2));

  const articleValidator = new StructuredOutputValidator(dynamicSchema);
  const articleOutput = `{
  "title": "Understanding TypeScript",
  "content": "TypeScript is a powerful language...",
  "views": 1250,
  "published": true
}`;

  const articleResult = articleValidator.validate(articleOutput);
  console.log('\nValidation result:', articleResult.valid);
  
  if (articleResult.valid) {
    console.log('Article data:', articleResult.data);
  }

  // Test 6: Complex nested schema
  console.log('\n--- Test 6: Complex Nested Schema ---');
  
  const complexSchema: JSONSchema = {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          profile: {
            type: 'object',
            properties: {
              bio: { type: 'string' },
              location: { type: 'string' },
            },
            required: ['bio'],
          },
        },
        required: ['id', 'profile'],
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
      },
    },
    required: ['user', 'tags'],
  };

  const complexOutput = `{
  "user": {
    "id": 123,
    "profile": {
      "bio": "Software developer",
      "location": "San Francisco"
    }
  },
  "tags": ["typescript", "javascript", "react"]
}`;

  const complexValidator = new StructuredOutputValidator(complexSchema);
  const complexResult = complexValidator.validate(complexOutput);
  
  console.log('Complex validation:', complexResult.valid);
  if (complexResult.valid) {
    console.log('Complex data:', JSON.stringify(complexResult.data, null, 2));
  }
}

// Run the example
if (require.main === module) {
  runValidationExample().catch(console.error);
}

export { runValidationExample };
