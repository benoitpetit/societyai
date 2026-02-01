# Structured Output Validation

The Structured Output Validation system ensures AI-generated outputs conform to expected JSON schemas with automatic validation, retry logic, and error feedback.

## Overview

The Structured Output Validation provides:

- **JSON Schema Validation**: Industry-standard schema validation
- **Automatic Retry**: Re-prompt agent with error feedback
- **Error Extraction**: Detailed validation error messages
- **Complex Schemas**: Support for nested objects, arrays, patterns, enums
- **Markdown Extraction**: Extract JSON from markdown code blocks
- **Type Constraints**: Validate types, ranges, lengths, patterns
- **Helper Functions**: Quick schema creation and validation

## Core Components

### StructuredOutputValidator

Main validation class:

```typescript
import { StructuredOutputValidator } from 'societyai';

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0, maximum: 150 },
    email: { type: 'string', format: 'email' },
  },
  required: ['name', 'age'],
};

const validator = new StructuredOutputValidator(schema);

// Validate JSON string
const result = validator.validate('{"name": "Alice", "age": 30}');

if (result.valid) {
  console.log('Valid data:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}
```

### ValidationResult

Result of validation:

```typescript
interface ValidationResult {
  valid: boolean; // Is valid?
  data?: unknown; // Parsed data if valid
  errors?: ValidationError[]; // Errors if invalid
  errorMessage?: string; // Formatted error message
}

interface ValidationError {
  path: string; // JSON path to error
  message: string; // Error description
  expected?: string; // Expected value/type
  actual?: unknown; // Actual value
}
```

## JSON Schema Support

### Basic Types

```typescript
const schema = {
  type: 'object',
  properties: {
    // String
    name: { type: 'string' },

    // Number
    age: { type: 'number' },

    // Integer
    count: { type: 'integer' },

    // Boolean
    active: { type: 'boolean' },

    // Null
    deleted: { type: 'null' },
  },
};
```

### Required Fields

```typescript
const schema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    email: { type: 'string' },
  },
  required: ['username', 'email'], // Both required
};

// This will fail
validator.validate('{"username": "alice"}');
// Error: Missing required property 'email'
```

### String Constraints

```typescript
const schema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 20,
      pattern: '^[a-zA-Z0-9_]+$', // Alphanumeric + underscore
    },
    email: {
      type: 'string',
      format: 'email',
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive', 'pending'],
    },
  },
};
```

### Number Constraints

```typescript
const schema = {
  type: 'object',
  properties: {
    age: {
      type: 'number',
      minimum: 0,
      maximum: 150,
    },
    rating: {
      type: 'number',
      minimum: 1,
      maximum: 5,
      multipleOf: 0.5, // 1, 1.5, 2, 2.5, ...
    },
    price: {
      type: 'number',
      exclusiveMinimum: 0, // Greater than 0, not equal
    },
  },
};
```

### Arrays

```typescript
const schema = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 10,
      uniqueItems: true,
    },
    coordinates: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2, // Exactly 2 items
    },
  },
};

// Valid
validator.validate('{"tags": ["ai", "ml"], "coordinates": [10.5, 20.3]}');
```

### Nested Objects

```typescript
const schema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
            zip: { type: 'string', pattern: '^\\d{5}$' },
          },
          required: ['city'],
        },
      },
      required: ['name'],
    },
  },
};
```

### Enums

```typescript
const schema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['draft', 'published', 'archived'],
    },
    priority: {
      type: 'number',
      enum: [1, 2, 3],
    },
  },
};
```

## Automatic Retry with Error Feedback

The `validateAndRetry` method automatically re-prompts the agent when validation fails:

```typescript
import { StructuredOutputValidator, StandardModelBase } from 'societyai';

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
};

const validator = new StructuredOutputValidator(schema);

class JSONGeneratorModel extends StandardModelBase {
  constructor() {
    super({ name: 'json-gen' }, async (prompt: unknown) => {
      // AI generates JSON (might be invalid initially)
      return '{"name": "Alice", "age": "30"}'; // age is string, should be number
    });
  }
}

const model = new JSONGeneratorModel();

// Validates and retries up to 3 times
const result = await validator.validateAndRetry(
  async (previousError?: string) => {
    const prompt = previousError
      ? `Previous attempt had errors: ${previousError}\n\nPlease fix and try again.`
      : 'Generate user JSON';

    return await model.process(prompt);
  },
  3 // Max attempts
);

if (result.valid) {
  console.log('Valid data:', result.data);
} else {
  console.error('Failed after 3 attempts:', result.errorMessage);
}
```

## Markdown Code Block Extraction

Automatically extract JSON from markdown:

```typescript
const validator = new StructuredOutputValidator(schema);

const markdown = `
Here's the user data:

\`\`\`json
{
  "name": "Alice",
  "age": 30
}
\`\`\`
`;

const result = validator.validate(markdown);
// Automatically extracts JSON from code block
console.log(result.data); // { name: "Alice", age: 30 }
```

## Helper Functions

### createSchema

Quick schema creation:

```typescript
import { createSchema } from 'societyai';

const schema = createSchema({
  type: 'object',
  properties: {
    title: { type: 'string' },
    count: { type: 'number' },
  },
  required: ['title'],
});
```

### validateJSON

Direct validation without creating a validator:

```typescript
import { validateJSON } from 'societyai';

const result = validateJSON('{"name": "Alice"}', {
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
});
```

## Complete Example

```typescript
import {
  StructuredOutputValidator,
  StructuredOutputBuilder,
  StandardModelBase,
} from 'societyai';

// Define user schema
const userSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      minLength: 3,
      maxLength: 20,
      pattern: '^[a-zA-Z0-9_]+$',
    },
    email: {
      type: 'string',
      format: 'email',
    },
    age: {
      type: 'number',
      minimum: 13,
      maximum: 120,
    },
    interests: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 10,
    },
  },
  required: ['username', 'email'],
};

// Create validator with builder
const validator = StructuredOutputBuilder.create()
  .withSchema(userSchema)
  .withMaxRetries(3)
  .withStrictMode(true)
  .build();

// AI model
class UserGenerator extends StandardModelBase {
  private attempts = 0;

  constructor() {
    super({ name: 'user-gen' }, async (prompt: unknown) => {
      this.attempts++;

      if (this.attempts === 1) {
        // First attempt: invalid (age is string)
        return '{"username": "alice_123", "email": "alice@example.com", "age": "25"}';
      } else {
        // Second attempt: valid (after feedback)
        return '{"username": "alice_123", "email": "alice@example.com", "age": 25, "interests": ["AI", "coding"]}';
      }
    });
  }
}

const model = new UserGenerator();

// Validate with automatic retry
const result = await validator.validateAndRetry(async (previousError?: string) => {
  const prompt = previousError
    ? `Previous JSON was invalid:\n${previousError}\n\nPlease fix it.`
    : 'Generate a user JSON object';

  return await model.process(prompt);
}, 3);

if (result.valid) {
  console.log('Valid user:', result.data);
  // { username: "alice_123", email: "alice@example.com", age: 25, interests: ["AI", "coding"] }
} else {
  console.error('Validation failed:', result.errorMessage);
}
```

## Error Messages

Detailed error messages help debug validation failures:

```typescript
const result = validator.validate('{"name": "A", "age": -5}');

if (!result.valid) {
  result.errors?.forEach((error) => {
    console.log(`Path: ${error.path}`);
    console.log(`Message: ${error.message}`);
    console.log(`Expected: ${error.expected}`);
    console.log(`Actual: ${error.actual}`);
  });
}

// Output:
// Path: /name
// Message: String is too short (minimum length: 3)
// Expected: minLength: 3
// Actual: "A"
//
// Path: /age
// Message: Number is below minimum
// Expected: minimum: 0
// Actual: -5
```

## Integration with Agents

Create agents that always return valid JSON:

```typescript
class ValidatedAgent extends StandardModelBase {
  constructor(
    private validator: StructuredOutputValidator,
    name: string
  ) {
    super({ name }, async (prompt: unknown) => {
      // AI generates JSON
      return this.generateJSON(prompt);
    });
  }

  async process(prompt: unknown): Promise<string> {
    // Validate and retry
    const result = await this.validator.validateAndRetry(async (previousError?: string) => {
      const enhancedPrompt = previousError
        ? `${prompt}\n\nPrevious attempt had errors: ${previousError}`
        : prompt;

      return await super.process(enhancedPrompt);
    }, 3);

    if (!result.valid) {
      throw new Error(`Failed to generate valid JSON: ${result.errorMessage}`);
    }

    return JSON.stringify(result.data);
  }

  private generateJSON(prompt: unknown): string {
    // Implementation
    return '{}';
  }
}
```

## Best Practices

1. **Clear Schemas**: Define precise schemas with all constraints
2. **Required Fields**: Always specify which fields are required
3. **Provide Examples**: Include example outputs in prompts
4. **Limit Retries**: Set reasonable max retries (2-3)
5. **Detailed Errors**: Use error feedback to help AI self-correct
6. **Test Schemas**: Validate your schemas with known good/bad data
7. **Version Schemas**: Track schema changes for compatibility
8. **Document Formats**: Provide format examples for complex types

## Common Patterns

### API Response Validation

```typescript
const apiResponseSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['success', 'error'],
    },
    data: {
      type: 'object',
    },
    message: {
      type: 'string',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['status'],
};
```

### Form Validation

```typescript
const formSchema = {
  type: 'object',
  properties: {
    firstName: {
      type: 'string',
      minLength: 1,
    },
    lastName: {
      type: 'string',
      minLength: 1,
    },
    email: {
      type: 'string',
      format: 'email',
    },
    phone: {
      type: 'string',
      pattern: '^\\+?[0-9]{10,15}$',
    },
    acceptTerms: {
      type: 'boolean',
      const: true,
    },
  },
  required: ['firstName', 'lastName', 'email', 'acceptTerms'],
};
```

### Analysis Results

```typescript
const analysisSchema = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      minLength: 50,
    },
    sentiment: {
      type: 'string',
      enum: ['positive', 'negative', 'neutral'],
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
  },
  required: ['summary', 'sentiment', 'confidence'],
};
```

## Integration with Graph

Use validated outputs in workflows:

```typescript
const validator = new StructuredOutputValidator(schema);

const agent = AgentBuilder.create()
  .withId('json-agent')
  .withRole(role)
  .withModel(new ValidatedModel(validator))
  .build();

const graph = GraphBuilder.create()
  .addNode('start', NodeType.START)
  .addNode('generate', NodeType.AGENT, { agentId: 'json-agent' })
  .addNode('end', NodeType.END)
  .addEdge('start', 'generate')
  .addEdge('generate', 'end')
  .build();
```

## Next Steps

- See [Memory System](./memory-system.md) for context management
- See [Tool Calling](./tool-calling.md) for external interactions
- See [Metrics](./metrics-observability.md) for tracking performance
- See [Examples](./examples.md) for complete implementations
