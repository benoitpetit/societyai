# SocietyAI Examples

A simple example to get started with SocietyAI.

## 📚 Available Example

**getting-started.ts** - Complete Introduction

- Single agent
- Sequential workflow (chain)
- Parallel workflow (scatter-gather)
- Mixed workflow (parallel + sequential)
- **4 complete examples**

## 🚀 Running the Example

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run the example
npx tsx examples/getting-started.ts
```

## 💡 Key Concepts

### Multi-Agent Coordination

- Creating agents with roles
- Sequential vs parallel execution
- Combined workflows

### Execution Patterns

- **Chain**: sequential execution (one agent after another)
- **Scatter-Gather**: parallel execution (all at once, results combined)
- **Mixed**: combination of both patterns

## 🛠️ Using Real AI Models

The example uses a mock model. To use OpenAI, Anthropic, etc.:

```typescript
import { Society, AIModel, Message } from 'societyai';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class OpenAIModel implements AIModel {
  async generateText(messages: Message[]): Promise<string> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    return response.choices[0].message.content || '';
  }
}

// Use in a society
const result = await Society.create()
  .withName('My Society')
  .addAgent((agent) =>
    agent
      .withId('assistant')
      .withRole((role) => role.withSystemPrompt('You are helpful'))
      .withModel(new OpenAIModel())
  )
  .addStep((step) => step.withId('main').withAgents(['assistant']).sequential())
  .execute('Hello!');
```

## 📖 Documentation

For more information:

- [Getting Started](../docs/getting-started.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [API Reference](../docs/api-reference.md)

## 📝 License

MIT - See [LICENSE](../LICENSE) for details
