import { StructuredOutputBuilder, JSONSchema } from '../src';

async function run(): Promise<void> {
  const schema: JSONSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name', 'age'],
  };

  const validator = StructuredOutputBuilder.create().withSchema(schema).withMaxRetries(3).build();

  const validJson = '{"name": "Alice", "age": 30}';
  // Note: validator methods might be validate() or validateAndRetry()
  // Checking StructuredOutputValidator class in validation.ts (assumed from export)
  const result = await validator.validate(validJson);

  console.log('Validation Result:', result.valid);
  console.log('Data:', result.data);
}

run().catch(console.error);
