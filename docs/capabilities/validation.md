# Validation System

## `StructuredOutputValidator`

Validates agent outputs against a JSON Schema.

```typescript
import { StructuredOutputValidator } from 'societyai';

const validator = new StructuredOutputValidator(schema);
const result = validator.validate(output);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## `StructuredOutputBuilder`

```typescript
import { StructuredOutputBuilder } from 'societyai';

const schema = StructuredOutputBuilder.create()
  .withProperty('name', { type: 'string' })
  .withProperty('age', { type: 'number' })
  .require(['name'])
  .build();
```
