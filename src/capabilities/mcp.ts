/**
 * @fileoverview Model Context Protocol (MCP) Integration for SocietyAI
 *
 * MCP (Model Context Protocol) is a standardized protocol for connecting LLMs
 * to various data sources and tools. This module provides integration with MCP servers,
 * allowing SocietyAI agents to access a vast ecosystem of tools and resources.
 *
 * To use MCP, install the MCP SDK as a peer dependency:
 * ```bash
 * npm install @modelcontextprotocol/sdk
 * ```
 *
 * Features:
 * - Connect to any MCP server
 * - Automatic tool discovery and registration
 * - Seamless integration with existing Tool system
 * - Support for stdio and SSE transports
 *
 * @example
 * ```typescript
 * import { MCPToolProvider } from 'societyai/capabilities';
 *
 * // Connect to filesystem MCP server
 * const mcpTools = await MCPToolProvider.connect({
 *   command: 'npx',
 *   args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/data']
 * });
 *
 * // Use in agent
 * agent.withTools(mcpTools);
 * ```
 */

import { Tool, ToolBuilder } from './tools';
import { JSONSchema } from './validation';
import { NotImplementedError } from '../core/errors';
import { ChildProcess, spawn } from 'child_process';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** Command to start the MCP server */
  command: string;

  /** Arguments to pass to the command */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Working directory */
  cwd?: string;

  /** Transport type */
  transport?: 'stdio' | 'sse';
}

/**
 * MCP Tool definition (from MCP protocol)
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP JSON-RPC Response
 */
interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: {
    protocolVersion?: string;
    tools?: MCPTool[];
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * MCP Server connection
 */
export class MCPServerConnection {
  private process?: ChildProcess;
  private config: MCPServerConfig;
  private tools: MCPTool[] = [];
  private connected = false;

  // Multiplexing state: maps JSON-RPC id → {resolve, reject}
  private pendingRequests = new Map<
    number,
    { resolve: (r: MCPResponse) => void; reject: (e: Error) => void }
  >();
  // Monotonically increasing request ID counter
  private requestIdCounter = 0;
  // Buffer for incomplete NDJSON lines from stdout
  private stdoutBuffer = '';
  // Process-level error stored for propagation to pending requests
  private processError?: Error;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /** Generate the next unique request ID */
  private nextId(): number {
    return ++this.requestIdCounter;
  }

  /** Reject all in-flight requests with the given error */
  private rejectAllPending(error: Error): void {
    for (const { reject } of this.pendingRequests.values()) {
      reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.config.transport === 'sse') {
      throw new NotImplementedError(
        'SSE transport is not yet implemented. Use stdio transport instead.'
      );
    }

    // Spawn the MCP server process
    this.process = spawn(this.config.command, this.config.args || [], {
      env: { ...process.env, ...this.config.env },
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!this.process.stdout || !this.process.stdin) {
      throw new Error('Failed to spawn MCP server process');
    }

    // Handle process-level errors: store and propagate to pending requests
    this.process.on('error', (error) => {
      this.processError = new Error(`MCP server error: ${error.message}`);
      this.rejectAllPending(this.processError);
      this.connected = false;
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`MCP server exited with code ${code}`);
        const exitError = new Error(`MCP server exited with code ${code}`);
        this.rejectAllPending(exitError);
      }
      this.connected = false;
    });

    // Single persistent NDJSON data handler — dispatches responses by ID
    this.process.stdout.on('data', (data: Buffer) => {
      this.stdoutBuffer += data.toString();
      const lines = this.stdoutBuffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      this.stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed) as MCPResponse;
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            pending.resolve(response);
          }
        } catch {
          // Ignore malformed lines (e.g. server log output)
        }
      }
    });

    // Send initialization request
    await this.initialize();

    // Send the 'initialized' notification to complete the MCP handshake
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    };
    const notifStr = JSON.stringify(initializedNotification) + '\n';
    this.process.stdin.write(notifStr);

    // Discover available tools
    await this.discoverTools();

    this.connected = true;
  }

  /**
   * Initialize the MCP connection
   */
  private async initialize(): Promise<void> {
    const initRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'societyai',
          version: '0.1.1',
        },
      },
    };

    await this.sendRequest(initRequest);
  }

  /**
   * Discover available tools from the MCP server
   */
  private async discoverTools(): Promise<void> {
    const listToolsRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/list',
      params: {},
    };

    const response = await this.sendRequest(listToolsRequest);

    if (response.result && response.result.tools) {
      this.tools = response.result.tools;
    }
  }

  /**
   * Send a request to the MCP server and await its response by ID.
   * Uses the multiplexed pending-requests map so concurrent calls are safe.
   */
  private async sendRequest(request: { id: number; [key: string]: unknown }): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin || !this.process.stdout) {
        return reject(new Error('MCP server not connected'));
      }

      if (this.processError) {
        return reject(this.processError);
      }

      this.pendingRequests.set(request.id, { resolve, reject });

      // Send request as a newline-delimited JSON message
      const requestStr = JSON.stringify(request) + '\n';
      this.process.stdin.write(requestStr);

      // Timeout after 30 seconds; unref so it doesn't block process exit
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000);
      (timeoutId as NodeJS.Timeout).unref();
    });
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('MCP server not connected');
    }

    const callToolRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name,
        arguments: params,
      },
    };

    const response = await this.sendRequest(callToolRequest);

    if (response.error) {
      throw new Error(`MCP tool error: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Get discovered tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.rejectAllPending(new Error('MCP server disconnected'));
      this.process.kill();
      this.process = undefined;
    }
    this.connected = false;
  }
}

/**
 * MCP Tool Provider
 *
 * Connects to an MCP server and provides tools that can be used by SocietyAI agents
 */
export class MCPToolProvider {
  private connection: MCPServerConnection;
  private tools: Tool[] = [];

  private constructor(connection: MCPServerConnection) {
    this.connection = connection;
  }

  /**
   * Connect to an MCP server and create a tool provider
   *
   * @example
   * ```typescript
   * // Connect to filesystem MCP server
   * const provider = await MCPToolProvider.connect({
   *   command: 'npx',
   *   args: ['-y', '@modelcontextprotocol/server-filesystem', './data']
   * });
   *
   * // Get tools
   * const tools = provider.getTools();
   *
   * // Use with agent
   * agent.withTools(tools);
   * ```
   */
  static async connect(config: MCPServerConfig): Promise<MCPToolProvider> {
    const connection = new MCPServerConnection(config);
    await connection.connect();

    const provider = new MCPToolProvider(connection);
    provider.convertMCPToolsToSocietyAITools();

    return provider;
  }

  /**
   * Convert MCP tools to SocietyAI Tool format
   */
  private convertMCPToolsToSocietyAITools(): void {
    const mcpTools = this.connection.getTools();

    this.tools = mcpTools.map((mcpTool) => {
      return ToolBuilder.create()
        .withName(mcpTool.name)
        .withDescription(mcpTool.description || `MCP tool: ${mcpTool.name}`)
        .withParameters(mcpTool.inputSchema as JSONSchema)
        .withExecutor(async (params: Record<string, unknown>) => {
          const result = await this.connection.callTool(mcpTool.name, params);
          return { result };
        })
        .build();
    });
  }

  /**
   * Get all tools from the MCP server
   */
  getTools(): Tool[] {
    return this.tools;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.find((t) => t.name === name);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    await this.connection.disconnect();
  }
}

/**
 * Helper function to quickly connect to common MCP servers
 */
export const MCPServers = {
  /**
   * Connect to the filesystem MCP server
   * Provides access to local files and directories
   */
  filesystem: async (rootPath: string): Promise<MCPToolProvider> => {
    return MCPToolProvider.connect({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', rootPath],
    });
  },

  /**
   * Connect to the GitHub MCP server
   * Provides access to GitHub repositories
   */
  github: async (token?: string): Promise<MCPToolProvider> => {
    const env = token ? { GITHUB_TOKEN: token } : undefined;
    return MCPToolProvider.connect({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env,
    });
  },

  /**
   * Connect to the Brave Search MCP server
   * Provides web search capabilities
   */
  braveSearch: async (apiKey: string): Promise<MCPToolProvider> => {
    return MCPToolProvider.connect({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: apiKey },
    });
  },

  /**
   * Connect to a custom MCP server
   */
  custom: async (config: MCPServerConfig): Promise<MCPToolProvider> => {
    return MCPToolProvider.connect(config);
  },
};
