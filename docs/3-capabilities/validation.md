# Validation & Structured Output

SocietyAI's **Structured Validation System** guarantees that agents return data
in the exact format you expect. In stochastic AI systems, output format
reliability is one of the biggest challenges — this system solves it by creating
a feedback loop between the validator and the generator.

---

## 📋 Table of Contents

- [Core Concept: Validate & Repair](#core-concept-validate--repair)
- [Defining Schemas](#defining-schemas)
- [Usage in Workflows](#usage-in-workflows)
- [Standalone Usage](#standalone-usage)
- [Zod Integration](#zod-integration)
- [Self-Correcting Validator](#self-correcting-validator)
- [Best Practices](#best-practices)
- [Next Steps](#next-steps)

---

## 🎯 Core Concept: Validate & Repair

Unlike a standard validator that simply throws on invalid input, SocietyAI's
validator is designed to *fix* problems automatically:

```
1. Generate  → Agent produces output
2. Validate  → System checks output against schema
3. Detect    → If invalid, specific error messages are generated
               (e.g., "Property 'age' must be a number")
4. Feedback  → Errors are sent back to the agent as a new prompt:
               "Your output was invalid: 'age' must be a number.
                Please correct it and return valid JSON."
5. Retry     → The loop continues until the output is valid or
               max retries are exhausted
```

This approach is far more robust than a single-shot validation because it
leverages the model's own reasoning to self-correct.

---

## 🛠️ Defining Schemas

### JSON Schema (Standard)

SocietyAI uses standard [JSON Schema](https://json-schema.org/) definitions.
Any valid JSON Schema object is accepted.

```typescript
const userSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 3 },
    email:    { type: 'string', format: 'email' },
    role:     { type: 'string', enum: ['admin', 'user', 'guest'] },
    age:      { type: 'number', minimum: 0, maximum: 150 },
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

### Using the `StructuredOutputBuilder`

For a more fluent experience, use `StructuredOutputBuilder` to construct
schemas programmatically:

```typescript
import { StructuredOutputBuilder } from 'societyai';

const schema = StructuredOutputBuilder.object()
  .prop('title',    'string')
  .prop('score',    'number')
  .prop('approved', 'boolean')
  .required(['title', 'score'])
  .build();
```

---

## 🚀 Usage in Workflows

The most powerful pattern is to attach a schema directly to a task with
`.withOutputSchema()`. The engine will automatically validate the agent's output
and retry with error feedback if the schema is not satisfied.

```typescript
import { Society } from 'societyai';

const result = await Society.create()
  .addAgent((a) =>
    a
      .withId('parser')
      .withRole((r) =>
        r.withSystemPrompt(
          'You are a data parser. Always respond with valid JSON matching ' +
          'the requested schema.'
        )
      )
      .withModel(model)
  )
  .addTask((t) =>
    t
      .withId('extract-user')
      .withAgents(['parser'])
      .withInstructions('Extract the user information from the text below.')
      .withOutputSchema(userSchema)   // ← attach schema
      .sequential()
  )
  .execute(rawInputText);

// result.output is guaranteed to be a valid JSON string matching userSchema
const user = JSON.parse(result.output);
```

### Configuring Retry Behaviour

Combine `.withOutputSchema()` with `.withRetry()` to control how many
correction attempts are made:

```typescript
.addTask((t) =>
  t
    .withId('extract-user')
    .withAgents(['parser'])
    .withOutputSchema(userSchema)
    .withRetry({
      maxAttempts: 3,     // up to 3 total attempts (1 initial + 2 corrections)
      feedback: true,     // send error details back to the agent on retry
    })
    .sequential()
)
```

---

## 🧩 Standalone Usage

Use the `StructuredOutputValidator` independently of the workflow engine for
one-off validation or in custom pipelines.

```typescript
import { StructuredOutputValidator } from 'societyai';

const validator = new StructuredOutputValidator(userSchema);

const rawOutput = await model.process('Create a user named Alice, age 30...');

let parsed: unknown;
try {
  parsed = JSON.parse(rawOutput);
} catch {
  throw new Error('Agent did not return valid JSON');
}

const result = validator.validate(parsed);

if (result.valid) {
  console.log('✅ Valid data:', result.data);
} else {
  console.error('❌ Validation errors:');
  result.errors.forEach((err) => console.error(' -', err));
  // e.g. "Property 'email' is missing"
  //      "Property 'age' must be a number"
}
```

### `ValidationResult` Type

```typescript
interface ValidationResult {
  /** Whether the data matches the schema */
  valid: boolean;

  /** The validated (and potentially coerced) data, if valid */
  data?: unknown;

  /** Human-readable error messages, if invalid */
  errors: string[];
}
```

---

## 🛡️ Zod Integration

SocietyAI uses JSON Schema natively. If you prefer defining schemas with
[Zod](https://zod.dev/), convert your Zod schema to JSON Schema using
[`zod-to-json-schema`](https://github.com/StefanTerdell/zod-to-json-schema)
before passing it to SocietyAI.

```bash
npm install zod zod-to-json-schema
```

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Society } from 'societyai';

// 1. Define your schema with Zod
const ZodUser = z.object({
  username: z.string().min(3),
  email:    z.string().email(),
  age:      z.number().min(0).max(150),
  role:     z.enum(['admin', 'user', 'guest']),
});

// 2. Convert to JSON Schema
const jsonSchema = zodToJsonSchema(ZodUser, { name: 'User' });

// 3. Use in SocietyAI
Society.create()
  .addTask((t) =>
    t
      .withId('extract')
      .withAgents(['parser'])
      .withOutputSchema(jsonSchema)
      .sequential()
  )
  .execute(input);
```

This approach gives you the best of both worlds: Zod's ergonomic type
definitions and SocietyAI's built-in validation/retry loop.

---

## 🔁 Self-Correcting Validator

For more advanced correction strategies — where the LLM receives detailed
guidance about *how* to fix its output — use `SelfCorrectingValidator` from the
[Advanced Features](../6-advanced-features/advanced-features.md) module.

```typescript
import { SelfCorrectingValidator } from 'societyai';

const validator = new SelfCorrectingValidator({
  schema: userSchema,
  model: myLLM,
  maxCorrectionAttempts: 3,
  strategy: 'guided',      // 'minimal' | 'guided' | 'aggressive'
  includeExamples: true,
});

try {
  const validData = await validator.validateAndCorrect(agentOutput);
  console.log('✅ Corrected data:', validData);
} catch (error) {
  console.error('❌ Could not correct after max attempts:', error);
}
```

### Correction Strategies

| Strategy | Description | When to Use |
|---|---|---|
| `'minimal'` | Sends the JSON schema and error list only. | Small, simple schemas. |
| `'guided'` *(recommended)* | Schema + detailed errors + correction hints. | Most use cases. |
| `'aggressive'` | Schema + errors + hints + examples + step-by-step instructions. | Complex schemas or when the model struggles to self-correct. |

> See [Advanced Features](../6-advanced-features/advanced-features.md) for the
> complete `SelfCorrectingValidator` API and integration examples.

---

## ✅ Best Practices

### 1. Be Explicit in the System Prompt

Tell the agent it must return JSON and describe the expected shape:

```typescript
.withSystemPrompt(
  'You are a data extractor. Always respond with a single valid JSON object ' +
  'matching the schema provided in the instructions. Do not include any text ' +
  'outside the JSON object.'
)
```

### 2. Use `required` Liberally

Fields that the agent must always return should be in `required`. Optional
fields can be omitted, but required fields will trigger validation errors if
missing.

```typescript
const schema = {
  type: 'object',
  properties: {
    title:   { type: 'string' },
    score:   { type: 'number' },
    notes:   { type: 'string' }, // optional
  },
  required: ['title', 'score'], // ← always enforce these
};
```

### 3. Set a Sensible Retry Cap

More retries = higher cost and latency. Two to three attempts is usually
sufficient for well-prompted agents:

```typescript
.withRetry({ maxAttempts: 3, feedback: true })
```

### 4. Use Enum for Categorical Fields

Enums give the agent clear, unambiguous choices and produce better validation
error messages:

```typescript
status: { type: 'string', enum: ['pending', 'approved', 'rejected'] }
```

### 5. Parse Output Immediately After Validation

```typescript
const rawOutput = result.taskResults.get('extract')?.[0].output ?? '{}';
const data = JSON.parse(rawOutput); // safe — guaranteed valid by schema
```

---

## 📚 Next Steps

- **[Advanced Features](../6-advanced-features/advanced-features.md)** — Full
  `SelfCorrectingValidator` API with correction strategies and integration
  examples.
- **[Tools & Functions](./tools-functions.md)** — Combine validated structured
  output with tool-calling for robust data pipelines.
- **[Loops & Cycles](../4-advanced/loops-cycles.md)** — Build self-correcting
  workflows using feedback loops and validation as the exit condition.
- **[Prompt Templates](../2-building-societies/prompts.md)** — Craft system
  prompts that reliably produce JSON-formatted outputs.
- **[Society Builder](../2-building-societies/society-builder.md)** — Full
  `FluentTaskBuilder` reference including `.withOutputSchema()` and
  `.withRetry()`.