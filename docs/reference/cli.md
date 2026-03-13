# CLI Reference

The SocietyAI CLI provides powerful tools for developing, validating, visualizing,
and running your multi-agent workflows.

---

## 📋 Table of Contents

- [Installation](#installation)
- [Commands Overview](#commands-overview)
- [validate](#validate)
- [visualize](#visualize)
- [run](#run)
- [init](#init)
- [inspect](#inspect)
- [diff](#diff)
- [benchmark](#benchmark)
- [Global Options](#global-options)
- [Environment Variables](#environment-variables)

---

## Installation

The CLI is included with the `societyai` package:

```bash
npm install societyai
```

Or use directly with `npx`:

```bash
npx societyai <command>
```

---

## Commands Overview

```
societyai <command> [options]

Commands:
  validate <file>              Validate a Society configuration file
  visualize <file> [options]   Generate graph visualizations
  run <file> [options]         Execute a Society with monitoring
  init [template] [options]    Create a new project from template
  inspect <file>               Inspect execution state file
  diff <file1> <file2>         Compare two Society configurations
  benchmark [options]          Run performance benchmarks
  version                      Show version
  help                         Show help
```

---

## validate

Validate a Society configuration file for errors.

```bash
societyai validate <file>
```

### Example

```bash
npx societyai validate ./my-society.ts
```

### Output

```
🔍 Validating Society configuration...
  Compiling TypeScript...
  Loading module...
✅ Validation passed!
  File: ./my-society.ts
  Size: 2.45 KB
  Modified: 3/13/2026, 10:30:00 AM
```

### Validation Checks

- TypeScript compilation
- Module exports (default or `society`)
- Agent references
- Task dependencies
- Graph structure

### Exit Codes

- `0` — Validation passed
- `1` — Validation failed

---

## visualize

Generate visualizations of your Society graph.

```bash
societyai visualize <file> [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--format` | `-f` | Output format | `mermaid` |
| `--output` | `-o` | Output file | stdout |
| `--direction` | `-d` | Graph direction | `TD` |
| `--theme` | | Mermaid theme | `default` |
| `--highlight` | | Highlight path | - |

### Supported Formats

- `mermaid` — Mermaid diagram syntax
- `dot` — GraphViz DOT format
- `json` — JSON structure
- `html` — Self-contained HTML
- `ascii` — ASCII art
- `plantuml` — PlantUML format

### Examples

```bash
# Generate Mermaid diagram
npx societyai visualize ./my-society.ts

# Save to file
npx societyai visualize ./my-society.ts -o graph.md

# Generate HTML
npx societyai visualize ./my-society.ts -f html -o graph.html

# Left-to-right direction
npx societyai visualize ./my-society.ts -d LR

# Dark theme
npx societyai visualize ./my-society.ts -f html --theme dark

# Highlight specific path
npx societyai visualize ./my-society.ts --highlight start,agent1,end
```

### Output Example

```bash
$ npx societyai visualize ./society.ts -f mermaid

📊 Generating visualization...

graph TD
    n_start("start\nStart")
    n_agent1["agent1\nAgent: writer"]
    n_end("end\nEnd")
    n_start --> n_agent1
    n_agent1 --> n_end
    classDef startNode fill:#c8e6c9,stroke:#81c784;
    classDef agent fill:#ffecb3,stroke:#ffb74d;
    class n_start startNode;
    class n_agent1 agent;
```

---

## run

Execute a Society with optional monitoring and metrics.

```bash
societyai run <file> [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--input` | `-i` | Input to pass | `Hello` |
| `--verbose` | `-v` | Verbose logging | false |
| `--metrics` | `-m` | Show metrics | false |
| `--timeout` | | Timeout (ms) | 60000 |
| `--save-state` | | Save state file | - |

### Examples

```bash
# Basic execution
npx societyai run ./my-society.ts

# With custom input
npx societyai run ./my-society.ts -i "Analyze this data"

# Verbose mode with metrics
npx societyai run ./my-society.ts -v -m

# With timeout
npx societyai run ./my-society.ts --timeout 30000

# Save execution state
npx societyai run ./my-society.ts --save-state state.json
```

### Output Example

```bash
$ npx societyai run ./society.ts -i "Hello" -v -m

🚀 Executing Society...
  ▶️  Node start (start) starting...
  ✅ Node start completed in 0ms
    🤖 Agent writer (gpt-4) processing...
    ✅ Agent writer completed
  ▶️  Node agent1 (agent) starting...
  ✅ Node agent1 completed in 1245ms

✅ Execution completed!

📤 Output:
Hello! How can I help you today?

📊 Metrics:
  Duration: 1247ms
  Success: Yes
  Nodes executed: 3
  Total results: 3
```

---

## init

Create a new SocietyAI project from a template.

```bash
societyai init [template] [options]
```

### Templates

- `basic` — Simple sequential workflow
- `advanced` — Complex workflow with dependencies and middleware

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--template` | `-t` | Template name | `basic` |
| `--output` | `-o` | Output directory | `.` |
| `--name` | | Project name | `my-society` |

### Examples

```bash
# Create basic project
npx societyai init

# Create advanced project
npx societyai init --template advanced

# Specify output directory
npx societyai init -t advanced -o ./projects/

# Specify project name
npx societyai init --name my-awesome-society
```

### Output

```bash
$ npx societyai init --template advanced --name my-project

🏗️  Creating new Society project: my-project
  Template: advanced
  Output: .
  ✓ Created society.ts
  ✓ Created package.json
  ✓ Created README.md

✅ Project created at: /path/to/my-project

Next steps:
  cd my-project
  npm install
  npm start
```

### Generated Files

**Basic template:**
- `society.ts` — Main society configuration
- `package.json` — NPM configuration
- `README.md` — Project documentation

**Advanced template:**
- All basic files
- Pre-configured with multiple agents
- Dependency chains
- Middleware examples

---

## inspect

Inspect an execution state file (from paused or completed runs).

```bash
societyai inspect <file>
```

### Example

```bash
npx societyai inspect ./state.json
```

### Output

```
🔍 SocietyAI Execution State Inspector

🆔 Execution ID: exec-550e8400-e29b-41d4-a716-446655440000
📅 Timestamp: 3/13/2026, 10:30:00 AM
🚦 Status: Completed
🛣️  Path Length: 5 steps
    Start:       start
    Current:     end

📋 Queue (Next Nodes):
    (Empty)

🧠 Memory/Results Captured: 5 nodes
```

---

## diff

Compare two Society configurations.

```bash
societyai diff <file1> <file2>
```

### Example

```bash
npx societyai diff ./society-v1.ts ./society-v2.ts
```

### Output

```
🔍 Comparing Society configurations...

📊 Comparison Results:

Agents:
  File 1: 3 agents
  File 2: 4 agents
  + Added: analyzer

Tasks:
  File 1: 5 tasks
  File 2: 5 tasks
  No changes
```

---

## benchmark

Run performance benchmarks.

```bash
societyai benchmark [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--filter` | | Filter pattern | all |
| `--runs` | `-r` | Number of runs | 100 |
| `--output` | `-o` | Output file | - |

### Examples

```bash
# Run all benchmarks
npx societyai benchmark

# Filter benchmarks
npx societyai benchmark --filter "parallel"

# Specify runs
npx societyai benchmark --runs 50

# Save results
npx societyai benchmark -o results.json
```

### Output

```bash
$ npx societyai benchmark --filter "sequential" --runs 50

⏱️  Running benchmarks...
  Filter: sequential
  Runs: 50

🚀 Starting benchmarks...

ExecutionEngine - Sequential Execution
✓ 2 agents sequential   245.67 ops/s  ±1.23%  (50 runs sampled)
✓ 5 agents sequential   198.34 ops/s  ±1.56%  (50 runs sampled)
✓ 10 agents sequential  156.78 ops/s  ±2.34%  (50 runs sampled)

✅ Benchmarks completed!
```

---

## Global Options

These options work with any command:

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help |
| `-v, --version` | Show version |
| `--debug` | Enable debug mode (verbose errors) |

### Debug Mode

Enable detailed error output:

```bash
DEBUG=1 npx societyai validate ./society.ts
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEBUG` | Enable debug output |
| `OPENAI_API_KEY` | OpenAI API key (for adapters) |
| `ANTHROPIC_API_KEY` | Anthropic API key |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Validation error |
| `3` | Execution error |
| `130` | Interrupted (Ctrl+C) |

---

## 📚 Related Documentation

- [Getting Started](../1-basics/getting-started.md) — First steps
- [Visualization](../4-advanced/visualization.md) — Graph visualization
- [Benchmarks](../4-advanced/benchmarks.md) — Performance testing
- [Core Concepts](../1-basics/core-concepts.md) — Understanding SocietyAI
