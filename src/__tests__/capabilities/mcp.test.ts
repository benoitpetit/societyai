/**
 * Tests for MCP (Model Context Protocol) Integration
 */

import { MCPToolProvider, MCPServers, MCPServerConnection } from '../../capabilities/mcp';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as childProcess from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockChildProcess = childProcess as jest.Mocked<typeof childProcess>;

// ---------------------------------------------------------------------------
// Helper: build a fake ChildProcess whose stdout emits lines on demand
// ---------------------------------------------------------------------------
function makeMockProcess(options: { nullStdout?: boolean; nullStdin?: boolean } = {}) {
  const stdoutEmitter = new EventEmitter();
  const processEmitter = new EventEmitter();

  const mockProcess = {
    stdout: options.nullStdout ? null : stdoutEmitter,
    stdin: options.nullStdin
      ? null
      : {
          write: jest.fn(),
        },
    on: processEmitter.on.bind(processEmitter),
    emit: processEmitter.emit.bind(processEmitter),
    kill: jest.fn(),
  } as unknown as ChildProcess & { emit: (event: string, ...args: unknown[]) => boolean };

  // Helper to push a NDJSON line to stdout
  const pushLine = (obj: unknown) => {
    if (!options.nullStdout) {
      (stdoutEmitter as EventEmitter).emit('data', Buffer.from(JSON.stringify(obj) + '\n'));
    }
  };

  return { mockProcess, pushLine };
}

// ---------------------------------------------------------------------------
// Helpers: build minimal valid MCP protocol responses
// ---------------------------------------------------------------------------
function initResponse(id: number) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {},
    },
  };
}

function toolsListResponse(id: number, tools: unknown[] = []) {
  return { jsonrpc: '2.0', id, result: { tools } };
}

describe('MCP Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MCPToolProvider', () => {
    describe('Connection', () => {
      it('should create a tool provider', () => {
        expect(MCPToolProvider).toBeDefined();
      });

      it('should accept server configuration', async () => {
        const { spawn } = mockChildProcess;
        const { mockProcess, pushLine } = makeMockProcess();
        spawn.mockReturnValue(mockProcess);

        const connectPromise = MCPToolProvider.connect({
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        });

        // Respond to initialize (id=1) then tools/list (id=2)
        setImmediate(() => {
          pushLine(initResponse(1));
          setImmediate(() => pushLine(toolsListResponse(2, [])));
        });

        const provider = await connectPromise;
        expect(provider).toBeDefined();
        expect(provider.getTools()).toEqual([]);
      });
    });

    describe('Tool Discovery', () => {
      it('should discover tools from MCP server', async () => {
        const { spawn } = mockChildProcess;
        const { mockProcess, pushLine } = makeMockProcess();
        spawn.mockReturnValue(mockProcess);

        const mcpTools = [
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: {
              type: 'object' as const,
              properties: { path: { type: 'string' } },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write a file',
            inputSchema: {
              type: 'object' as const,
              properties: { path: { type: 'string' }, content: { type: 'string' } },
              required: ['path', 'content'],
            },
          },
        ];

        const connectPromise = MCPToolProvider.connect({
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        });

        setImmediate(() => {
          pushLine(initResponse(1));
          setImmediate(() => pushLine(toolsListResponse(2, mcpTools)));
        });

        const provider = await connectPromise;
        const tools = provider.getTools();

        expect(tools).toHaveLength(2);
        expect(tools[0].name).toBe('read_file');
        expect(tools[1].name).toBe('write_file');
      });

      it('should expose a getTool() method for named lookup', async () => {
        const { spawn } = mockChildProcess;
        const { mockProcess, pushLine } = makeMockProcess();
        spawn.mockReturnValue(mockProcess);

        const mcpTools = [
          {
            name: 'search',
            description: 'Search the web',
            inputSchema: { type: 'object' as const, properties: {}, required: [] },
          },
        ];

        const connectPromise = MCPToolProvider.connect({ command: 'search-server', args: [] });

        setImmediate(() => {
          pushLine(initResponse(1));
          setImmediate(() => pushLine(toolsListResponse(2, mcpTools)));
        });

        const provider = await connectPromise;
        expect(provider.getTool('search')).toBeDefined();
        expect(provider.getTool('nonexistent')).toBeUndefined();
      });
    });
  });

  describe('MCPServers Helpers', () => {
    it('should provide filesystem helper', () => {
      expect(MCPServers.filesystem).toBeDefined();
      expect(typeof MCPServers.filesystem).toBe('function');
    });

    it('should provide GitHub helper', () => {
      expect(MCPServers.github).toBeDefined();
      expect(typeof MCPServers.github).toBe('function');
    });

    it('should provide Brave Search helper', () => {
      expect(MCPServers.braveSearch).toBeDefined();
      expect(typeof MCPServers.braveSearch).toBe('function');
    });

    it('should provide custom helper', () => {
      expect(MCPServers.custom).toBeDefined();
      expect(typeof MCPServers.custom).toBe('function');
    });
  });

  describe('Tool Conversion', () => {
    it('should convert MCP tools to SocietyAI Tool format with executor', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const mcpTools = [
        {
          name: 'list_dir',
          description: 'List directory contents',
          inputSchema: {
            type: 'object' as const,
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
      ];

      const connectPromise = MCPToolProvider.connect({ command: 'fs-server', args: [] });

      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, mcpTools)));
      });

      const provider = await connectPromise;
      const tool = provider.getTools()[0];

      // Tool must be a valid SocietyAI Tool object
      expect(tool.name).toBe('list_dir');
      expect(tool.description).toBe('List directory contents');
      expect(typeof tool.execute).toBe('function');
      expect(tool.parameters).toBeDefined();
    });

    it('should use MCP tool name as fallback description when none provided', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const mcpTools = [
        {
          name: 'no_desc_tool',
          // no description field
          inputSchema: { type: 'object' as const, properties: {}, required: [] },
        },
      ];

      const connectPromise = MCPToolProvider.connect({ command: 'test-server', args: [] });

      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, mcpTools)));
      });

      const provider = await connectPromise;
      const tool = provider.getTools()[0];

      expect(tool.description).toBe('MCP tool: no_desc_tool');
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const { spawn } = mockChildProcess;
      const mockProcess = {
        stdout: null,
        stdin: null,
        on: jest.fn(),
        kill: jest.fn(),
      } as unknown as ChildProcess;

      spawn.mockReturnValue(mockProcess);

      // Should throw error when stdout/stdin are missing
      await expect(
        MCPToolProvider.connect({
          command: 'invalid-command',
          args: [],
        })
      ).rejects.toThrow('Failed to spawn MCP server process');
    });

    it('should reject tool calls when not connected', async () => {
      const connection = new MCPServerConnection({ command: 'test', args: [] });
      // callTool without connecting should throw
      await expect(connection.callTool('some_tool', {})).rejects.toThrow(
        'MCP server not connected'
      );
    });

    it('should propagate MCP tool errors to the caller', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connectPromise = MCPToolProvider.connect({ command: 'err-server', args: [] });

      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });

      const provider = await connectPromise;

      // Directly exercise the connection's callTool via a tool whose execute wraps it
      // We test via MCPServerConnection directly
      const { mockProcess: mp2, pushLine: push2 } = makeMockProcess();
      spawn.mockReturnValue(mp2);

      const connection = new MCPServerConnection({ command: 'err-server', args: [] });

      const connectConn = connection.connect();
      setImmediate(() => {
        push2(initResponse(1));
        setImmediate(() => push2(toolsListResponse(2, [])));
      });
      await connectConn;

      // Queue a callTool then respond with an error
      const callPromise = connection.callTool('bad_tool', {});
      setImmediate(() => {
        push2({
          jsonrpc: '2.0',
          id: 3,
          error: { code: -32601, message: 'Method not found' },
        });
      });

      await expect(callPromise).rejects.toThrow('MCP tool error: Method not found');

      // cleanup
      expect(provider).toBeDefined();
    });

    it('should throw NotImplementedError for SSE transport', async () => {
      const { spawn } = mockChildProcess;
      spawn.mockReturnValue(makeMockProcess().mockProcess);

      await expect(MCPToolProvider.connect({ command: 'test', transport: 'sse' })).rejects.toThrow(
        'SSE transport is not yet implemented'
      );
    });

    it('should reject pending requests on process error event', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connection = new MCPServerConnection({ command: 'test', args: [] });
      const connectPromise = connection.connect();
      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });
      await connectPromise;

      // Start a tool call (id=3) that will never get a response
      const callPromise = connection.callTool('tool', {});
      // Emit process error
      mockProcess.emit('error', new Error('SIGKILL'));
      await expect(callPromise).rejects.toThrow('MCP server error');
    });

    it('should log and reject on non-zero exit code', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connection = new MCPServerConnection({ command: 'test', args: [] });
      const connectPromise = connection.connect();
      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });
      await connectPromise;

      const callPromise = connection.callTool('tool', {});
      mockProcess.emit('exit', 1);
      await expect(callPromise).rejects.toThrow('MCP server exited with code 1');
    });

    it('should not reject when process exits with code 0', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connection = new MCPServerConnection({ command: 'test', args: [] });
      const connectPromise = connection.connect();
      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });
      await connectPromise;

      // Exit with 0 — should not throw for pending requests
      // No pending request means this is a no-op on pending map
      mockProcess.emit('exit', 0);
      // No error thrown
    });

    it('should return early when already connected', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connection = new MCPServerConnection({ command: 'test', args: [] });
      const p1 = connection.connect();
      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });
      await p1;

      // Second connect — spawn should NOT be called again
      const spawnCallsBefore = (spawn as jest.Mock).mock.calls.length;
      await connection.connect();
      expect((spawn as jest.Mock).mock.calls.length).toBe(spawnCallsBefore);
    });

    it('should ignore malformed JSON lines in stdout', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connection = new MCPServerConnection({ command: 'test', args: [] });
      const connectPromise = connection.connect();

      setImmediate(() => {
        // Push valid init response but also interleave garbage
        pushLine(initResponse(1));
        // Push garbage line manually
        (mockProcess.stdout as EventEmitter).emit('data', Buffer.from('NOT JSON\n'));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });

      // Should not throw
      await expect(connectPromise).resolves.toBeUndefined();
    });

    it('disconnect() kills the process and rejects pending', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connection = new MCPServerConnection({ command: 'test', args: [] });
      const connectPromise = connection.connect();
      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });
      await connectPromise;

      const callPromise = connection.callTool('tool', {});
      await connection.disconnect();

      await expect(callPromise).rejects.toThrow('MCP server disconnected');
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('disconnect() on MCPToolProvider disconnects the connection', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connectPromise = MCPToolProvider.connect({ command: 'test', args: [] });
      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });
      const provider = await connectPromise;

      await provider.disconnect();
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('callTool rejects with "not connected" after process error disconnects', async () => {
      const { spawn } = mockChildProcess;
      const { mockProcess, pushLine } = makeMockProcess();
      spawn.mockReturnValue(mockProcess);

      const connection = new MCPServerConnection({ command: 'test', args: [] });
      const connectPromise = connection.connect();
      setImmediate(() => {
        pushLine(initResponse(1));
        setImmediate(() => pushLine(toolsListResponse(2, [])));
      });
      await connectPromise;

      // Emitting process error sets processError and clears connected flag
      mockProcess.emit('error', new Error('crash'));

      // callTool checks this.connected first → throws "not connected"
      await expect(connection.callTool('tool', {})).rejects.toThrow('MCP server not connected');
    });
  });
});
