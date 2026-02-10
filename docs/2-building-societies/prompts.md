# Prompt Template System Guide

This guide explains how to customize agent prompts using the template system in
SocietyAI.

---

## 📝 Overview

Every agent in SocietyAI uses a **prompt template** to format the input before
sending it to the AI model. The template system supports **placeholders** that
are replaced with contextual data at runtime.

---

## 🎯 Quick Start

### Default Template

If you don't specify a custom template, SocietyAI uses this default:

```typescript
const DEFAULT_TEMPLATE = `
System: {system}

{instructions}

Context: {context}
Memory: {memory}
Tools: {tools}

Previous Results:
{history}

Messages:
{messages}

User Input:
{input}
`.trim();
```

### Custom Template

Override the default by setting `promptTemplate` in your role:

```typescript
const role = createRole('analyst').withSystemPrompt('You are a data analyst')
  .withPromptTemplate(`
System Instructions: {system}

Task: {instructions}

Analyze this data:
{input}
`);
```

---

## 🔑 Available Placeholders

| Placeholder      | Description                            | Example Value                                |
| ---------------- | -------------------------------------- | -------------------------------------------- |
| `{system}`       | System prompt from `Role.systemPrompt` | `"You are a helpful assistant"`              |
| `{input}`        | Current input being processed          | `"Analyze this trend"`                       |
| `{context}`      | Shared data between steps (JSON)       | `{"user": "Alice", "lang": "fr"}`            |
| `{sharedData}`   | Alias for `{context}`                  | Same as `{context}`                          |
| `{history}`      | Previous step results                  | `"Step 1: Analysis complete\nStep 2: ..."`   |
| `{memory}`       | Agent's memory context                 | `"User asked about X before..."`             |
| `{tools}`        | Available tools (JSON format)          | `[{"name": "search", "description": "..."}]` |
| `{instructions}` | Step-specific instructions             | `"Focus on security aspects"`                |
| `{messages}`     | Message history (collaborative nodes)  | `"[agent1 → agent2]: Review this\n..."`      |

---

## 📖 Detailed Examples

### Example 1: Minimal Template

```typescript
const role = createRole('writer')
  .withSystemPrompt('You are a technical writer')
  .withPromptTemplate('{system}\n\n{input}');
```

**Rendered Prompt**:

```
You are a technical writer

Write a blog post about AI
```

---

### Example 2: Context-Aware Template

```typescript
const role = createRole('translator').withSystemPrompt('You are a translator')
  .withPromptTemplate(`
{system}

Target Language: {context.targetLang}
Style: {context.style}

Translate:
{input}
`);

// In your workflow
Society.create()
  .addAgent((a) => a.withRole(role).withModel(model))
  .withGlobalContext({
    targetLang: 'French',
    style: 'formal',
  })
  .execute('Hello world');
```

**Rendered Prompt**:

```
You are a translator

Target Language: French
Style: formal

Translate:
Hello world
```

---

### Example 3: Memory-Enhanced Template

```typescript
import { MemoryBuilder } from 'societyai';

const memory = MemoryBuilder.create()
  .withShortTermMemory(10)
  .withLongTermMemory()
  .build();

const role = createRole('assistant').withSystemPrompt(
  'You are a helpful assistant'
).withPromptTemplate(`
{system}

Conversation History:
{memory}

Current Request:
{input}
`);

const agent = createAgent('assistant', role, model).withMemory(memory);
```

**Rendered Prompt** (after a few interactions):

```
You are a helpful assistant

Conversation History:
[Previous] User: What's the weather?
[Previous] Assistant: It's sunny today.

Current Request:
What should I wear?
```

---

### Example 4: Tool-Enabled Template

```typescript
import { ToolBuilder } from 'societyai';

const searchTool = ToolBuilder.create('web_search')
  .withDescription('Search the web for information')
  .withParameters({
    query: { type: 'string', description: 'Search query' },
  })
  .withExecutor(async ({ query }) => {
    // ... search implementation
  })
  .build();

const role = createRole('researcher').withSystemPrompt(
  'You are a research assistant'
).withPromptTemplate(`
{system}

Available Tools:
{tools}

To use a tool, output:
<tool_code>
{"name": "tool_name", "arguments": {"param": "value"}}
</tool_code>

Task: {input}
`);

const agent = createAgent('researcher', role, model).withTools([searchTool]);
```

**Rendered Prompt**:

```
You are a research assistant

Available Tools:
[
  {
    "name": "web_search",
    "description": "Search the web for information",
    "parameters": {
      "query": {
        "type": "string",
        "description": "Search query"
      }
    }
  }
]

To use a tool, output:
<tool_code>
{"name": "tool_name", "arguments": {"param": "value"}}
</tool_code>

Task: Find information about quantum computing
```

---

### Example 5: Collaborative Template

```typescript
const role = createRole('debater').withSystemPrompt(
  'You are participating in a debate'
).withPromptTemplate(`
{system}

Debate Topic: {input}

Previous Arguments:
{messages}

Your turn. Provide your argument:
`);

Society.create()
  .addAgent((a) => a.withId('pro').withRole(role).withModel(model))
  .addAgent((a) => a.withId('con').withRole(role).withModel(model))
  .addTask(
    (s) => s.withId('debate').withAgents(['pro', 'con']).collaborative(3) // 3 rounds
  )
  .execute('Should AI be regulated?');
```

**Rendered Prompt (Round 2 for 'con' agent)**:

```
You are participating in a debate

Debate Topic: Should AI be regulated?

Previous Arguments:
[pro → broadcast]: Yes, AI regulation is essential because...
[con → broadcast]: No, AI regulation would stifle innovation...
[pro → broadcast]: But without safeguards...

Your turn. Provide your argument:
```

---

## 🎨 Advanced Techniques

### Conditional Placeholders

Use JavaScript template literals for conditional content:

```typescript
const role = createRole('assistant').withSystemPrompt('You are an assistant')
  .withPromptTemplate(`
{system}

${agent.memory ? 'Previous Context:\n{memory}\n' : ''}
${step.instructions ? 'Instructions: {instructions}\n' : ''}

{input}
`);
```

### Nested Context Access

Access nested properties in context:

```typescript
// ⚠️ Note: This syntax is NOT currently supported
// Coming in v0.2.0
.withPromptTemplate(`
User: {context.user.name}
Preferences: {context.user.prefs.lang}
`);

// Current workaround:
.withPromptTemplate(`
{context}
`);
// Outputs: {"user": {"name": "Alice", "prefs": {"lang": "fr"}}}
```

### Custom Formatters

For complex formatting, use `resultTransformer`:

```typescript
.addTask(s => s
  .withId('analyze')
  .withAgents(['analyst'])
  .sequential()
  .transformResults((results) => {
    const formatted = results.map(r =>
      `### ${r.agentId}\n${r.output}`
    ).join('\n\n');
    return formatted;
  })
);
```

---

## 🔧 Placeholder Resolution Order

When a prompt is rendered, placeholders are resolved in this order:

1. **Agent-specific data**: `{system}`, `{memory}`, `{tools}`
2. **Step-specific data**: `{instructions}`
3. **Context data**: `{context}`, `{sharedData}`
4. **Execution data**: `{history}`, `{messages}`
5. **Current input**: `{input}`

If a placeholder is empty or undefined, it's replaced with an empty string.

---

## ⚠️ Common Pitfalls

### 1. Forgetting to Add Context

```typescript
// ❌ Bad: context is undefined
const role = createRole('assistant').withPromptTemplate(
  'Lang: {context.lang}\n{input}'
);

// No context provided → {context.lang} becomes empty

// ✅ Good: Provide context
Society.create().withGlobalContext({ lang: 'en' });
// ...
```

### 2. Overloading the Prompt

```typescript
// ❌ Bad: Too much information
.withPromptTemplate(`
{system}
{memory}
{history}
{messages}
{context}
{tools}
{input}
`);

// The model might get confused with too much data

// ✅ Good: Include only what's needed
.withPromptTemplate(`
{system}
{memory}
{input}
`);
```

### 3. Not Escaping JSON

```typescript
// ⚠️ Warning: {context} outputs raw JSON
// This might break your prompt if context contains special chars

// Better: Format it explicitly
const role = createRole('assistant').withPromptTemplate(`
Context (JSON):
\`\`\`json
{context}
\`\`\`

{input}
`);
```

---

## 📊 Performance Tips

### 1. Minimize Template Complexity

Simple templates = faster rendering:

```typescript
// ✅ Fast
.withPromptTemplate('{system}\n{input}');

// ⚠️ Slower (but still fast)
.withPromptTemplate(`
{system}
{context}
{memory}
{history}
{messages}
{tools}
{input}
`);
```

### 2. Cache Role Templates

If you reuse the same role across multiple agents:

```typescript
// ✅ Good: Define once
const analystRole = createRole('analyst')
  .withPromptTemplate('...');

// Reuse
.addAgent(a => a.withRole(analystRole)...)
.addAgent(a => a.withRole(analystRole)...)
```

---

## 🧪 Testing Your Templates

### Preview Rendered Prompts

Use the observer to inspect prompts:

```typescript
Society.create()
  .withObserver({
    onAgentStart: (agentId, modelName, prompt) => {
      console.log(`[${agentId}] Prompt:\n${prompt}\n---`);
    },
    // ... other hooks
  })
  .execute(input);
```

### Unit Test Templates

For testing your custom templates, you can create test agents and verify the
final prompts through the execution flow:

```typescript
import { Society, createRole } from 'societyai';
import { MockModel } from './test-utils';

test('should use custom template correctly', () => {
  const customRole = createRole('test')
    .withSystemPrompt('You are a test assistant')
    .withPromptTemplate('{system}\n\nInput: {input}');

  const model = new MockModel((prompt) => {
    // Verify the prompt structure
    expect(prompt).toContain('You are a test assistant');
    expect(prompt).toContain('Input: Test data');
    return 'Response';
  });

  await Society.create()
    .addAgent((a) => a.withId('test').withRole(customRole).withModel(model))
    .addTask((t) => t.withId('task').withAgents(['test']).sequential())
    .execute('Test data');
});
```

---

## 📚 Next Steps

- **Learn more about roles**: [Agents & Roles Guide](./agents-roles.md)
- **Add memory to agents**: [Memory System Guide](../3-capabilities/memory.md)
- **Enable tool calling**: [Tools Guide](../3-capabilities/tools-functions.md)
- **Builders Reference**: [Society Builder](./society-builder.md)

---

## 🆘 Need Help?

- **Issue Tracker**:
  [GitHub Issues](https://github.com/benoitpetit/societyai/issues)
- **Discussions**:
  [GitHub Discussions](https://github.com/benoitpetit/societyai/discussions)
- **Examples**: [src/**tests**/examples/](../src/__tests__/examples/)
