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

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
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

    // Set up error handling
    this.process.on('error', (error) => {
      throw new Error(`MCP server error: ${error.message}`);
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`MCP server exited with code ${code}`);
      }
      this.connected = false;
    });

    // Send initialization request
    await this.initialize();

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
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'societyai',
          version: '0.1.0',
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
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const response = await this.sendRequest(listToolsRequest);

    if (response.result && response.result.tools) {
      this.tools = response.result.tools;
    }
  }

  /**
   * Send a request to the MCP server
   */
  private async sendRequest(request: unknown): Promise<MCPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin || !this.process.stdout) {
        return reject(new Error('MCP server not connected'));
      }

      let responseData = '';

      const dataHandler = (data: Buffer): void => {
        responseData += data.toString();

        // Try to parse JSON response
        try {
          const response = JSON.parse(responseData);
          this.process!.stdout!.off('data', dataHandler);
          resolve(response);
        } catch (e) {
          // Not complete JSON yet, wait for more data
        }
      };

      this.process.stdout.on('data', dataHandler);

      // Send request
      const requestStr = JSON.stringify(request) + '\n';
      this.process.stdin.write(requestStr);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.process!.stdout!.off('data', dataHandler);
        reject(new Error('MCP request timeout'));
      }, 30000);
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
      id: Date.now(),
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
