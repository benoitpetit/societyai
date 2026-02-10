# Structured Validation System

The **Structured Validation System** guarantees that your agents return data in
the exact format you expect. In stochastic AI systems, output format reliability
is the biggest challenge; this system solves it by creating a feedback loop
between the validator and the generator.

## 🎯 Core Concept: Validation & Repair

Unlike a standard validator that just throws an error, SocietyAI's validator is
designed to _fix_ problems.

1.  **Generate**: Agent produces output.
2.  **Validate**: System checks against schema.
3.  **Detect**: If invalid, specific error messages are generated (e.g.,
    "Property 'age' must be a number").
4.  **Feedback**: The errors are sent back to the agent as a new prompt: _"Your
    output was invalid: Property 'age' must be a number. Please correct it."_
5.  **Retry**: The loop continues until valid or max retries reached.

## 🛠️ Defining Schemas

### 1. JSON Schema (Standard)

SocietyAI uses standard JSON Schema definitions.

```typescript
const userSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 3 },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['admin', 'user'] },
    metadata: {
      type: 'object',
      properties: {
        loginCount: { type: 'number' },
      },
    },
  },
  required: ['username', 'email', 'role'],
};
```

### 2. Using Builders

For a more fluent experience, you can use the `StructuredOutputBuilder` (if
available in your module).

```typescript
// Example usage if creating schemas dynamically
const schema = builder
  .object()
  .prop('title', 'string')
  .prop('score', 'number')
  .build();
```

## 🚀 Usage in Workflows

The most powerful way to use validation is directly within your Task definition.

```typescript
import { Society } from 'societyai';

await Society.create()
  .addTask((t) =>
    t
      .withId('extract-data')
      .withAgents(['parser-agent'])

      // 1. Define the Schema
      .withOutputSchema(userSchema)

      // 2. Configure Retry Logic
      .withRetry({
        maxAttempts: 3,
        feedback: true, // Give the agent the error message
      })

      .sequential()
  )
  .execute(inputData);
```

## 🧩 Standalone Usage

You can use the validator component independently of the workflow engine.

```typescript
import { StructuredOutputValidator } from 'societyai';

const validator = new StructuredOutputValidator(userSchema);

const rawOutput = await model.generate('Create a user...');
const result = validator.validate(JSON.parse(rawOutput));

if (result.valid) {
  console.log('Safe data:', result.data);
} else {
  console.error('Errors:', result.errors);
  // result.errors = ["Property 'email' is missing"]
}
```

## 🛡️ Handling Zod Integration

If you prefer Zod for schema definition, you can convert Zod schemas to JSON
Schema using a library like `zod-to-json-schema` before passing them to
SocietyAI.

```typescript
import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';

const ZodUser = z.object({
  username: z.string(),
  age: z.number().min(18),
});

const jsonSchema = zodToJsonSchema(ZodUser);

// Use in SocietyAI
task.withOutputSchema(jsonSchema);
```
