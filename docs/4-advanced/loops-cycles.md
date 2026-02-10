# Loops & Cycles (Self-Correction)

One of the most powerful features of SocietyAI is the ability to create **feedback loops**. This allows agents to critique their own work, fix errors, or iterate until a quality threshold is met.

## The Problem with Linear Chains

In a standard chain (`A -> B -> C`), if `A` makes a mistake, `B` and `C` consume garbage data.
In a **Loop** (`A -> Check -> (if bad) A`), the system can self-heal.

## Anatomy of a Loop

A loop in SocietyAI requires three things:
1.  **The Work Node**: The agent doing the task (e.g., "Write Code").
2.  **The Evaluation Node**: A step that checks the quality (e.g., "Run Tests" or "Review").
3.  **The Control Logic**: A condition that decides whether to proceed or loop back.

## Example: Code Generation & Fix Loop

```typescript
const society = Society.create()
  // 1. Define Agents
  .addAgent(coder)
  .addAgent(tester)

  // 2. Define Tasks & Loop Logic
  .addTask(t => t
    .withId('write_code')
    .withAgents(['coder'])
    .withInstructions('Write a function to calculate Fibonacci numbers.')
    .withLoop(5, (results) => {
      // Access the last result
      const lastResult = results[results.length - 1];
      // Exit loop if it passed (contains "PASS")
      return lastResult.output.includes('PASS');
    })
  )
  
  .execute('Start coding');
```

## The `LoopController`

Under the hood, SocietyAI uses a `LoopController` to manage state.

- **Max Iterations**: Prevents infinite loops (default is usually 5 or 10).
- **History Aggregation**: Decides how memory is handled. Does the agent see *all* previous attempts, or just the last one? By default, agents see the history of the current loop to understand *why* they failed previously.

## Use Cases

1.  **Code Generation**: Write -> Compile/Test -> Fix.
2.  **Content Creation**: Draft -> Critique -> Revise.
3.  **Data Extraction**: Extract JSON -> Validate Schema -> Retry if Invalid.
4.  **Research**: Search -> Is info sufficient? -> Search more.

## Best Practices

1.  **Always set `maxIterations`**: Even the best prompts can get stuck. Always have a hard limit.
2.  **Clear Exit Criteria**: Ensure the evaluation step produces a clear signal (Boolean or specific keyword) that the condition can check.
3.  **Provide Feedback**: When looping back, ensure the "Fix" step receives the *error message* or *critique* from the evaluation step.
