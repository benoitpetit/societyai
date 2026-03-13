#!/usr/bin/env node

/**
 * SocietyAI CLI - Command Line Interface
 *
 * Commands:
 *   societyai validate <file>     - Validate a Society configuration
 *   societyai visualize <file>   - Generate visualizations (Mermaid, DOT, HTML)
 *   societyai run <file>         - Execute a Society with monitoring
 *   societyai init [template]    - Generate a new project from template
 *   societyai inspect <file>     - Inspect execution state
 *   societyai diff <file1> <file2> - Compare two Society configurations
 *   societyai benchmark          - Run performance benchmarks
 *   societyai version            - Show version
 *
 * @example
 * ```bash
 * # Validate configuration
 * npx societyai validate ./my-society.ts
 *
 * # Generate Mermaid diagram
 * npx societyai visualize ./my-society.ts --format mermaid --output graph.md
 *
 * # Run with monitoring
 * npx societyai run ./my-society.ts --input "Hello" --verbose --metrics
 *
 * # Create new project
 * npx societyai init --template advanced --output ./my-project/
 * ```
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHelp() {
  console.log(`
${colorize('bright', 'SocietyAI CLI')} v${require('../package.json').version}

${colorize('cyan', 'Usage:')} societyai <command> [options]

${colorize('cyan', 'Commands:')}
  ${colorize('green', 'validate')} <file>              Validate a Society configuration file
  ${colorize('green', 'visualize')} <file> [options]  Generate graph visualizations
  ${colorize('green', 'run')} <file> [options]        Execute a Society with monitoring
  ${colorize('green', 'init')} [template] [options]   Create a new project from template
  ${colorize('green', 'inspect')} <file>              Inspect execution state file
  ${colorize('green', 'diff')} <file1> <file2>        Compare two Society configurations
  ${colorize('green', 'benchmark')} [options]         Run performance benchmarks
  ${colorize('green', 'version')}                     Show version
  ${colorize('green', 'help')}                        Show this help

${colorize('cyan', 'Options for visualize:')}
  --format, -f <format>         Output format: mermaid, dot, json, html, ascii (default: mermaid)
  --output, -o <file>           Output file (default: stdout)
  --direction, -d <dir>         Graph direction: TD, LR, RL, BT (default: TD)
  --theme <theme>               Mermaid theme: default, dark, forest, neutral
  --highlight <path>            Highlight execution path (comma-separated node IDs)

${colorize('cyan', 'Options for run:')}
  --input, -i <input>           Input to pass to the Society
  --verbose, -v                 Enable verbose logging
  --metrics, -m                 Show execution metrics
  --timeout <ms>                Execution timeout in milliseconds
  --save-state <file>           Save execution state to file

${colorize('cyan', 'Options for init:')}
  --template, -t <template>     Template to use: basic, advanced, mcp, multi-tenant (default: basic)
  --output, -o <dir>            Output directory (default: current directory)
  --name <name>                 Project name

${colorize('cyan', 'Options for benchmark:')}
  --filter <pattern>            Filter benchmarks by pattern
  --runs <n>                    Number of runs per benchmark (default: 100)
  --output, -o <file>           Save results to file

${colorize('cyan', 'Examples:')}
  societyai validate ./my-society.ts
  societyai visualize ./my-society.ts --format html --output graph.html
  societyai run ./my-society.ts --input "Hello World" --verbose --metrics
  societyai init --template advanced --output ./my-project --name my-society
  societyai inspect ./state.json
  societyai benchmark --filter "parallel" --runs 50
`);
}

function printVersion() {
  console.log(`SocietyAI v${require('../package.json').version}`);
}

// Parse command line arguments
function parseArgs(args) {
  const options = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0], args: positional.slice(1), options };
}

// Validate command
async function validateCommand(filePath) {
  console.log(colorize('cyan', '🔍 Validating Society configuration...'));

  if (!filePath) {
    console.error(colorize('red', '❌ Error: No file specified'));
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(colorize('red', `❌ Error: File not found: ${filePath}`));
    process.exit(1);
  }

  try {
    // Use ts-node to validate TypeScript files
    const ext = path.extname(fullPath);
    if (ext === '.ts') {
      console.log(colorize('dim', '  Compiling TypeScript...'));
      execSync(`npx tsc --noEmit "${fullPath}"`, { stdio: 'pipe' });
    }

    // Try to load and validate the module
    console.log(colorize('dim', '  Loading module...'));

    // Clear require cache
    delete require.cache[require.resolve(fullPath)];

    // For TypeScript, we need to use ts-node/register
    if (ext === '.ts') {
      require('ts-node/register');
    }

    const module = require(fullPath);

    // Check for Society export
    if (!module.default && !module.society) {
      console.warn(colorize('yellow', '⚠️  Warning: No default export or "society" export found'));
    }

    // Validate structure
    const society = module.default || module.society;
    if (society) {
      if (typeof society.execute !== 'function') {
        console.warn(colorize('yellow', '⚠️  Warning: Society does not have an execute method'));
      }

      if (!society.agents || society.agents.length === 0) {
        console.warn(colorize('yellow', '⚠️  Warning: Society has no agents'));
      }
    }

    console.log(colorize('green', '✅ Validation passed!'));

    // Show stats
    const stats = fs.statSync(fullPath);
    console.log(colorize('dim', `  File: ${filePath}`));
    console.log(colorize('dim', `  Size: ${(stats.size / 1024).toFixed(2)} KB`));
    console.log(colorize('dim', `  Modified: ${stats.mtime.toLocaleString()}`));

  } catch (error) {
    console.error(colorize('red', `❌ Validation failed: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Visualize command
async function visualizeCommand(filePath, options) {
  console.log(colorize('cyan', '📊 Generating visualization...'));

  if (!filePath) {
    console.error(colorize('red', '❌ Error: No file specified'));
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(colorize('red', `❌ Error: File not found: ${filePath}`));
    process.exit(1);
  }

  const format = options.format || options.f || 'mermaid';
  const output = options.output || options.o;
  const direction = options.direction || options.d || 'TD';
  const theme = options.theme || 'default';
  const highlight = options.highlight ? options.highlight.split(',') : [];

  try {
    // Load the module
    const ext = path.extname(fullPath);
    if (ext === '.ts') {
      require('ts-node/register');
    }

    const module = require(fullPath);
    const society = module.default || module.society;

    if (!society || !society.engine) {
      console.error(colorize('red', '❌ Error: Could not find Society engine in file'));
      process.exit(1);
    }

    let result = '';

    switch (format.toLowerCase()) {
      case 'mermaid':
        const { GraphVisualizer } = require('../dist/execution/graph-visualizer');
        result = GraphVisualizer.toMermaid(society.engine, {
          direction,
          theme,
          highlightPath: highlight,
        });
        break;

      case 'dot':
      case 'graphviz':
        const { GraphVisualizer: GV2 } = require('../dist/execution/graph-visualizer');
        result = GV2.toDOT(society.engine, { rankdir: direction });
        break;

      case 'json':
        const { GraphVisualizer: GV3 } = require('../dist/execution/graph-visualizer');
        result = JSON.stringify(GV3.toJSON(society.engine), null, 2);
        break;

      case 'html':
        const { GraphVisualizer: GV4 } = require('../dist/execution/graph-visualizer');
        result = GV4.toHTML(society.engine, { direction, theme, highlightPath: highlight });
        break;

      case 'ascii':
        const { GraphVisualizer: GV5 } = require('../dist/execution/graph-visualizer');
        result = GV5.toASCII(society.engine);
        break;

      case 'plantuml':
        const { GraphVisualizer: GV6 } = require('../dist/execution/graph-visualizer');
        result = GV6.toPlantUML(society.engine, direction);
        break;

      default:
        console.error(colorize('red', `❌ Unknown format: ${format}`));
        console.error(colorize('dim', 'Supported formats: mermaid, dot, json, html, ascii, plantuml'));
        process.exit(1);
    }

    if (output) {
      fs.writeFileSync(path.resolve(output), result);
      console.log(colorize('green', `✅ Visualization saved to: ${output}`));
    } else {
      console.log('\n' + result);
    }

  } catch (error) {
    console.error(colorize('red', `❌ Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run command
async function runCommand(filePath, options) {
  console.log(colorize('cyan', '🚀 Executing Society...'));

  if (!filePath) {
    console.error(colorize('red', '❌ Error: No file specified'));
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.error(colorize('red', `❌ Error: File not found: ${filePath}`));
    process.exit(1);
  }

  const input = options.input || options.i || 'Hello';
  const verbose = options.verbose || options.v;
  const showMetrics = options.metrics || options.m;
  const timeout = parseInt(options.timeout) || 60000;
  const saveState = options['save-state'];

  const startTime = Date.now();

  try {
    // Load the module
    const ext = path.extname(fullPath);
    if (ext === '.ts') {
      require('ts-node/register');
    }

    const module = require(fullPath);
    const society = module.default || module.society;

    if (!society || typeof society.execute !== 'function') {
      console.error(colorize('red', '❌ Error: Could not find executable Society in file'));
      process.exit(1);
    }

    // Setup observer for verbose mode
    const observer = verbose ? {
      onNodeStart: (nodeId, type, input) => {
        console.log(colorize('dim', `  ▶️  Node ${nodeId} (${type}) starting...`));
      },
      onNodeEnd: (nodeId, output, duration) => {
        console.log(colorize('dim', `  ✅ Node ${nodeId} completed in ${duration}ms`));
      },
      onAgentStart: (agentId, modelName, input) => {
        console.log(colorize('blue', `    🤖 Agent ${agentId} (${modelName}) processing...`));
      },
      onAgentComplete: (agentId, modelName, output) => {
        console.log(colorize('green', `    ✅ Agent ${agentId} completed`));
      },
      onAgentError: (agentId, modelName, error) => {
        console.log(colorize('red', `    ❌ Agent ${agentId} error: ${error.message}`));
      },
    } : undefined;

    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timed out after ${timeout}ms`)), timeout);
    });

    const result = await Promise.race([
      society.execute({ input, observer }),
      timeoutPromise,
    ]);

    const duration = Date.now() - startTime;

    console.log(colorize('green', '\n✅ Execution completed!'));
    console.log(colorize('cyan', '\n📤 Output:'));
    console.log(result.output || result);

    if (showMetrics) {
      console.log(colorize('cyan', '\n📊 Metrics:'));
      console.log(colorize('dim', `  Duration: ${duration}ms`));
      console.log(colorize('dim', `  Success: ${result.success !== false ? 'Yes' : 'No'}`));

      if (result.executionPath) {
        console.log(colorize('dim', `  Nodes executed: ${result.executionPath.length}`));
      }

      if (result.nodeResults) {
        console.log(colorize('dim', `  Total results: ${result.nodeResults.size}`));
      }
    }

    if (saveState) {
      const stateData = {
        executionId: result.executionId,
        timestamp: Date.now(),
        status: result.status || 'completed',
        output: result.output,
        executionPath: result.executionPath,
        duration,
      };
      fs.writeFileSync(path.resolve(saveState), JSON.stringify(stateData, null, 2));
      console.log(colorize('green', `\n💾 State saved to: ${saveState}`));
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(colorize('red', `\n❌ Execution failed after ${duration}ms: ${error.message}`));
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Init command
async function initCommand(template, options) {
  const templateName = template || options.template || options.t || 'basic';
  const outputDir = options.output || options.o || '.';
  const projectName = options.name || 'my-society';

  console.log(colorize('cyan', `🏗️  Creating new Society project: ${projectName}`));
  console.log(colorize('dim', `  Template: ${templateName}`));
  console.log(colorize('dim', `  Output: ${outputDir}`));

  const templates = {
    basic: {
      'society.ts': `import { Society } from 'societyai';
import { MockModel } from 'societyai/adapters';

const model = new MockModel();

export const society = Society.create()
  .withName('${projectName}')
  .addAgent(agent => agent
    .withId('agent1')
    .withRole(role => role.withSystemPrompt('You are a helpful assistant'))
    .withModel(model)
  )
  .addTask(task => task
    .withId('main')
    .withAgents(['agent1'])
    .withInstructions('Process the input')
    .sequential()
  );

// Execute
if (require.main === module) {
  society.execute({ input: 'Hello World' })
    .then(result => console.log(result.output))
    .catch(console.error);
}
`,
      'package.json': JSON.stringify({
        name: projectName,
        version: '1.0.0',
        description: `A SocietyAI project`,
        main: 'society.ts',
        scripts: {
          start: 'ts-node society.ts',
          validate: 'societyai validate society.ts',
          visualize: 'societyai visualize society.ts --format html --output graph.html',
        },
        dependencies: {
          'societyai': '^0.1.0',
        },
        devDependencies: {
          'ts-node': '^10.9.0',
          'typescript': '^5.7.0',
        },
      }, null, 2),
      'README.md': `# ${projectName}

A SocietyAI multi-agent system.

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`

## Commands

- \`npm start\` - Run the society
- \`npm run validate\` - Validate configuration
- \`npm run visualize\` - Generate visualization

## Structure

- \`society.ts\` - Main society configuration
`,
    },

    advanced: {
      'society.ts': `import { Society } from 'societyai';
import { MockModel } from 'societyai/adapters';

const model = new MockModel();

export const society = Society.create()
  .withName('${projectName}')
  .addAgent(agent => agent
    .withId('analyzer')
    .withRole(role => role.withSystemPrompt('Analyze the input and extract key insights'))
    .withModel(model)
    .withExecutionMode('isolated')
  )
  .addAgent(agent => agent
    .withId('validator')
    .withRole(role => role.withSystemPrompt('Validate the analysis for accuracy'))
    .withModel(model)
  )
  .addAgent(agent => agent
    .withId('formatter')
    .withRole(role => role.withSystemPrompt('Format the final output'))
    .withModel(model)
  )
  .addTask(task => task
    .withId('process')
    .withAgents(['analyzer', 'validator', 'formatter'])
    .withInstructions('Process input through analysis, validation, and formatting')
    .withDependencies({
      validator: ['analyzer'],
      formatter: ['validator'],
    })
    .sequential()
  )
  .withMiddleware(chain => chain
    .use(Middlewares.logging())
    .use(Middlewares.timing())
  );

// Execute
if (require.main === module) {
  society.execute({ input: 'Hello World' })
    .then(result => console.log(result.output))
    .catch(console.error);
}
`,
      'package.json': JSON.stringify({
        name: projectName,
        version: '1.0.0',
        description: `An advanced SocietyAI project`,
        main: 'society.ts',
        scripts: {
          start: 'ts-node society.ts',
          validate: 'societyai validate society.ts',
          visualize: 'societyai visualize society.ts --format html --output graph.html',
          run: 'societyai run society.ts --input "Test input" --verbose --metrics',
        },
        dependencies: {
          'societyai': '^0.1.0',
        },
        devDependencies: {
          'ts-node': '^10.9.0',
          'typescript': '^5.7.0',
        },
      }, null, 2),
      'README.md': `# ${projectName}

An advanced SocietyAI multi-agent system with dependencies and middleware.

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`

## Commands

- \`npm start\` - Run the society
- \`npm run validate\` - Validate configuration
- \`npm run visualize\` - Generate visualization
- \`npm run run\` - Run with monitoring

## Structure

- \`society.ts\` - Main society configuration
- Agents: analyzer, validator, formatter
- Pipeline: analyzer → validator → formatter
`,
    },
  };

  const selectedTemplate = templates[templateName];

  if (!selectedTemplate) {
    console.error(colorize('red', `❌ Unknown template: ${templateName}`));
    console.error(colorize('dim', 'Available templates: basic, advanced'));
    process.exit(1);
  }

  // Create output directory
  const fullOutputDir = path.resolve(outputDir, projectName);
  if (!fs.existsSync(fullOutputDir)) {
    fs.mkdirSync(fullOutputDir, { recursive: true });
  }

  // Write template files
  for (const [fileName, content] of Object.entries(selectedTemplate)) {
    const filePath = path.join(fullOutputDir, fileName);
    fs.writeFileSync(filePath, content);
    console.log(colorize('green', `  ✓ Created ${fileName}`));
  }

  console.log(colorize('green', `\n✅ Project created at: ${fullOutputDir}`));
  console.log(colorize('cyan', '\nNext steps:'));
  console.log(colorize('dim', `  cd ${projectName}`));
  console.log(colorize('dim', '  npm install'));
  console.log(colorize('dim', '  npm start'));
}

// Diff command
async function diffCommand(file1, file2) {
  console.log(colorize('cyan', '🔍 Comparing Society configurations...'));

  if (!file1 || !file2) {
    console.error(colorize('red', '❌ Error: Two files required'));
    process.exit(1);
  }

  const path1 = path.resolve(file1);
  const path2 = path.resolve(file2);

  if (!fs.existsSync(path1)) {
    console.error(colorize('red', `❌ Error: File not found: ${file1}`));
    process.exit(1);
  }

  if (!fs.existsSync(path2)) {
    console.error(colorize('red', `❌ Error: File not found: ${file2}`));
    process.exit(1);
  }

  try {
    // Load both modules
    const ext1 = path.extname(path1);
    const ext2 = path.extname(path2);

    if (ext1 === '.ts' || ext2 === '.ts') {
      require('ts-node/register');
    }

    const module1 = require(path1);
    const module2 = require(path2);

    const society1 = module1.default || module1.society;
    const society2 = module2.default || module2.society;

    if (!society1 || !society2) {
      console.error(colorize('red', '❌ Error: Could not find Society in one or both files'));
      process.exit(1);
    }

    console.log(colorize('cyan', '\n📊 Comparison Results:'));

    // Compare agents
    const agents1 = society1.agents || [];
    const agents2 = society2.agents || [];

    console.log(colorize('blue', '\nAgents:'));
    console.log(colorize('dim', `  File 1: ${agents1.length} agents`));
    console.log(colorize('dim', `  File 2: ${agents2.length} agents`));

    const agentIds1 = new Set(agents1.map(a => a.id));
    const agentIds2 = new Set(agents2.map(a => a.id));

    const added = [...agentIds2].filter(id => !agentIds1.has(id));
    const removed = [...agentIds1].filter(id => !agentIds2.has(id));

    if (added.length > 0) {
      console.log(colorize('green', `  + Added: ${added.join(', ')}`));
    }

    if (removed.length > 0) {
      console.log(colorize('red', `  - Removed: ${removed.join(', ')}`));
    }

    if (added.length === 0 && removed.length === 0) {
      console.log(colorize('dim', '  No changes'));
    }

    // Compare tasks
    const tasks1 = society1.tasks || [];
    const tasks2 = society2.tasks || [];

    console.log(colorize('blue', '\nTasks:'));
    console.log(colorize('dim', `  File 1: ${tasks1.length} tasks`));
    console.log(colorize('dim', `  File 2: ${tasks2.length} tasks`));

    const taskIds1 = new Set(tasks1.map(t => t.id));
    const taskIds2 = new Set(tasks2.map(t => t.id));

    const tasksAdded = [...taskIds2].filter(id => !taskIds1.has(id));
    const tasksRemoved = [...taskIds1].filter(id => !taskIds2.has(id));

    if (tasksAdded.length > 0) {
      console.log(colorize('green', `  + Added: ${tasksAdded.join(', ')}`));
    }

    if (tasksRemoved.length > 0) {
      console.log(colorize('red', `  - Removed: ${tasksRemoved.join(', ')}`));
    }

    if (tasksAdded.length === 0 && tasksRemoved.length === 0) {
      console.log(colorize('dim', '  No changes'));
    }

  } catch (error) {
    console.error(colorize('red', `❌ Error: ${error.message}`));
    process.exit(1);
  }
}

// Benchmark command
async function benchmarkCommand(options) {
  console.log(colorize('cyan', '⏱️  Running benchmarks...'));

  const filter = options.filter;
  const runs = parseInt(options.runs) || 100;
  const output = options.output || options.o;

  console.log(colorize('dim', `  Filter: ${filter || 'none'}`));
  console.log(colorize('dim', `  Runs: ${runs}`));

  try {
    // Check if vitest is available
    const vitestPath = path.resolve(__dirname, '../node_modules/.bin/vitest');

    if (!fs.existsSync(vitestPath)) {
      console.log(colorize('yellow', '\n⚠️  Vitest not found. Installing...'));
      execSync('npm install --save-dev vitest', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    }

    // Run benchmarks
    const args = ['bench', '--run'];

    if (filter) {
      args.push('-t', filter);
    }

    console.log(colorize('cyan', '\n🚀 Starting benchmarks...\n'));

    execSync(`${vitestPath} ${args.join(' ')}`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
    });

    console.log(colorize('green', '\n✅ Benchmarks completed!'));

  } catch (error) {
    console.error(colorize('red', `\n❌ Benchmark failed: ${error.message}`));
    process.exit(1);
  }
}

// Main CLI
async function main() {
  const { command, args, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'validate':
      await validateCommand(args[0]);
      break;

    case 'visualize':
      await visualizeCommand(args[0], options);
      break;

    case 'run':
      await runCommand(args[0], options);
      break;

    case 'init':
      await initCommand(args[0], options);
      break;

    case 'inspect':
      // Delegate to inspect.js
      require('./inspect');
      break;

    case 'diff':
      await diffCommand(args[0], args[1]);
      break;

    case 'benchmark':
      await benchmarkCommand(options);
      break;

    case 'version':
    case '-v':
    case '--version':
      printVersion();
      break;

    case 'help':
    case '-h':
    case '--help':
    default:
      printHelp();
      break;
  }
}

main().catch(error => {
  console.error(colorize('red', `❌ Unexpected error: ${error.message}`));
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});
