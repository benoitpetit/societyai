#!/usr/bin/env node

/**
 * SocietyAI CLI - Execution State Inspector
 * Wrapper that delegates to the compiled dist entry point.
 * Usage: npx society-inspect <path-to-state.json>
 */

require('../dist/bin/inspect.js');
