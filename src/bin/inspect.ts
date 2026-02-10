#!/usr/bin/env node

/**
 * CLI Tool to inspect SocietyAI persistence files
 * Usage: npx society-inspect <path-to-state.json>
 */
import * as fs from 'fs';
import * as path from 'path';

interface InspectionState {
  executionId: string;
  timestamp: number;
  status: string;
  executionPath?: string[];
  queue: string[];
  waitingForNodeId?: string;
  deadLetterQueue?: string[];
  results?: unknown[];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: society-inspect <path-to-state.json>');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const state = JSON.parse(content) as InspectionState;

    console.log('\n🔍 SocietyAI Execution State Inspector\n');
    console.log(`🆔 Execution ID: \x1b[36m${state.executionId}\x1b[0m`);
    console.log(`📅 Timestamp:    ${new Date(state.timestamp).toLocaleString()}`);
    console.log(`🚦 Status:       ${formatStatus(state.status)}`);

    if (state.executionPath) {
      console.log(`🛣️  Path Length:  ${state.executionPath.length} steps`);
      console.log(`    Start:       ${state.executionPath[0] || 'N/A'}`);
      console.log(
        `    Current:     ${state.executionPath[state.executionPath.length - 1] || 'N/A'}`
      );
    }

    console.log('\n📋 Queue (Next Nodes):');
    if (!state.queue || state.queue.length === 0) {
      console.log('    (Empty)');
    } else {
      state.queue.forEach((nodeId: string, idx: number) => {
        console.log(`    ${idx + 1}. ${nodeId}`);
      });
    }

    if (state.status === 'paused' && state.waitingForNodeId) {
      console.log(`\n⏸️  Waiting For: \x1b[33m${state.waitingForNodeId}\x1b[0m (Human Input)`);
    }

    if (state.deadLetterQueue && state.deadLetterQueue.length > 0) {
      console.log(`\n💀 Dead Letter Queue: \x1b[31m${state.deadLetterQueue.join(', ')}\x1b[0m`);
    }

    console.log(`\n🧠 Memory/Results Captured: ${state.results ? state.results.length : 0} nodes`);
  } catch (error) {
    console.error('Error reading state file:', (error as Error).message);
    process.exit(1);
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'active':
      return '\x1b[32mActive\x1b[0m';
    case 'completed':
      return '\x1b[34mCompleted\x1b[0m';
    case 'failed':
      return '\x1b[31mFailed\x1b[0m';
    case 'paused':
      return '\x1b[33mPaused\x1b[0m';
    default:
      return status;
  }
}

main().catch(console.error);
