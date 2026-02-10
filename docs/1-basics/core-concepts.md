# Core Concepts

SocietyAI is built on a few fundamental concepts that map your "Mental Model" of a team of people to a technical execution graph.

## 1. The Society

The **Society** is the container for your entire system. It represents a group of agents working together towards a goal.

Think of it as the "Organization" or "Team". It holds:
- **Agents**: The workers.
- **Tasks**: The work to be done.
- **Workflow**: The rules of how work flows between agents.

## 2. Agents & Roles

An **Agent** is an autonomous entity capable of processing information. In SocietyAI, an agent is composed of:

- **Role**: The "Job Description". Defines *who* they are (System Prompt, Name, Description).
- **Model**: The "Brain". The LLM (Large Language Model) backing the agent.
- **Tools**: The "Hands". Functions the agent can call (Calculator, Web Search, Database).
- **Memory**: The "Experience". Context from previous interactions.

```typescript
// A defined Role
const writerRole = {
  name: 'Technical Writer',
  systemPrompt: 'You write clear, concise technical documentation.'
};

// An Agent using that role
const writerAgent = new Agent(writerRole, openAiModel);
```

## 3. Tasks & Workflow

A **Task** is a specific unit of work. It is not just a prompt; it is a step in the process.

Tasks can be:
- **Sequential**: Agent A -> Agent B -> Agent C.
- **Parallel**: Agent A and B work at the same time, then merge results.
- **Collaborative**: Agents A and B "chat" or "debate" until a consensus is reached.
- **Conditional**: If X, do Task A, else do Task B.

## 4. The Execution Graph

This is the "Secret Sauce" of SocietyAI.

When you define a Society using the easy-to-use Fluent API (e.g., `.chain()`, `.dependsOn()`), SocietyAI compiles this into a **Directed Graph**.

- **Nodes**: Represent execution steps (calling an agent, running a tool, checking a condition).
- **Edges**: Represent the flow of data.

Unlike simple chains, this Graph supports **Cycles** (Loops). This allows for patterns like:
1.  **Code** (Agent A writes code)
2.  **Test** (Tool runs tests)
3.  **Fix** (If fail, go back to step 1)

## 5. The Context

**Context** is the glue that holds everything together. It flows through the graph.

- **Shared Data**: Global variables accessible to all agents (e.g., `project_requirements`).
- **Task Results**: The output of previous steps, automatically available to future steps.
- **Message History**: The conversation log in collaborative steps.

## 6. The "ReAct" Loop

Inside every Agent execution, SocietyAI runs a **ReAct (Reasoning + Acting)** loop:

1.  **Thought**: The agent considers the input and decides what to do.
2.  **Action**: The agent may decide to call a Tool (e.g., `read_file`).
3.  **Observation**: The tool executes and returns the result to the agent.
4.  **Repeat**: The agent continues this loop until it has the final answer.

This happens automatically. You just define the tools; the framework handles the loop.
