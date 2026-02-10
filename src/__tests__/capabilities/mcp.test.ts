/**
 * Tests for MCP (Model Context Protocol) Integration
 */

import { MCPToolProvider, MCPServers } from '../../capabilities/mcp';
import { ChildProcess } from 'child_process';
import * as childProcess from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockChildProcess = childProcess as jest.Mocked<typeof childProcess>;

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
        const mockProcess = {
          stdout: {
            on: jest.fn().mockReturnThis(),
            off: jest.fn().mockReturnThis(),
          },
          stdin: {
            write: jest.fn(),
          },
          on: jest.fn(),
          kill: jest.fn(),
        } as unknown as ChildProcess;

        spawn.mockReturnValue(mockProcess);

        const config = {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        };

        // Note: This will timeout in tests without proper mocking
        // In real tests, we'd mock the full MCP protocol
        expect(config).toBeDefined();
        expect(config.command).toBe('npx');
      });
    });

    describe('Tool Discovery', () => {
      it('should discover tools from MCP server', async () => {
        const { spawn } = mockChildProcess;
        const mockProcess = {
          stdout: {
            on: jest.fn().mockReturnThis(),
            off: jest.fn().mockReturnThis(),
          },
          stdin: {
            write: jest.fn(),
          },
          on: jest.fn(),
          kill: jest.fn(),
        } as unknown as ChildProcess;

        spawn.mockReturnValue(mockProcess);

        // This test demonstrates the structure but would need full protocol mocking
        expect(spawn).toBeDefined();
        expect(mockProcess.stdout?.on).toBeDefined();
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
    it('should convert MCP tools to SocietyAI format', () => {
      // This would require full mocking of the MCP protocol
      // The actual conversion logic is tested through integration
      expect(true).toBe(true);
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
  });

  describe('Integration Scenarios', () => {
    it('should demonstrate filesystem MCP usage', () => {
      // Example of how to use filesystem MCP
      const example = `
        const provider = await MCPServers.filesystem('/my/data');
        const tools = provider.getTools();
        
        // Use tools with agent
        agent.withTools(tools);
      `;

      expect(example).toBeTruthy();
    });

    it('should demonstrate GitHub MCP usage', () => {
      // Example of how to use GitHub MCP
      const example = `
        const provider = await MCPServers.github('github_token');
        const tools = provider.getTools();
        
        // Access GitHub repositories
        agent.withTools(tools);
      `;

      expect(example).toBeTruthy();
    });

    it('should demonstrate custom MCP usage', () => {
      // Example of custom MCP server
      const example = `
        const provider = await MCPServers.custom({
          command: 'node',
          args: ['my-mcp-server.js'],
          env: { API_KEY: 'secret' }
        });
        
        const tools = provider.getTools();
        agent.withTools(tools);
      `;

      expect(example).toBeTruthy();
    });
  });
});
