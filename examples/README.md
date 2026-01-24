# SocietyAI Examples

This directory contains examples demonstrating all the capabilities of the SocietyAI package.

## 📁 Structure

```
examples/
├── 01-basic/                    # Basic usage examples
│   ├── simple-society.ts        # Simplest usage with legacy API
│   ├── multi-model.ts           # Using multiple AI models
│   └── with-observer.ts         # Monitoring with observer pattern
│
├── 02-roles-and-agents/         # Custom roles and agents
│   ├── custom-roles.ts          # Creating custom agent roles
│   ├── agent-capabilities.ts    # Defining agent capabilities
│   └── agent-communication.ts   # Inter-agent communication
│
├── 03-workflows/                # Workflow configurations
│   ├── sequential-workflow.ts   # Step-by-step execution
│   ├── parallel-workflow.ts     # Parallel agent execution
│   ├── collaborative-workflow.ts # Agents discussing together
│   └── conditional-workflow.ts  # Conditional step execution
│
├── 04-domains/                  # Domain-specific examples
│   ├── software-team.ts         # Software development team
│   ├── research-team.ts         # Research and analysis
│   ├── creative-team.ts         # Creative writing/brainstorming
│   └── business-team.ts         # Business analysis
│
├── 05-integrations/             # AI provider integrations
│   ├── openai-integration.ts    # OpenAI GPT models
│   ├── anthropic-integration.ts # Anthropic Claude
│   └── custom-api.ts            # Custom API integration
│
└── 06-advanced/                 # Advanced patterns
    ├── error-handling.ts        # Error handling and retry
    ├── timeout-cancellation.ts  # Timeouts and cancellation
    ├── result-transformers.ts   # Custom result processing
    └── lifecycle-hooks.ts       # Workflow lifecycle hooks
```

## 🚀 Running Examples

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run a specific example
npx ts-node examples/01-basic/simple-society.ts
```

## 📖 Example Categories

### 1. Basic Usage

Start here to understand the fundamental concepts.

### 2. Roles and Agents

Learn how to define custom behaviors for your agents.

### 3. Workflows

Understand different execution patterns and flow control.

### 4. Domain Examples

See how SocietyAI can be applied to different fields.

### 5. Integrations

Connect SocietyAI with real AI providers.

### 6. Advanced Patterns

Master advanced features for production use.
