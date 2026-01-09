import { logger } from './utils/logger.js';
import type { ServerMetadata } from './types/index.js';

/**
 * Main MCP Client
 *
 * This client manages tool discovery and execution following the
 * "tools as code" approach. Instead of loading all tool definitions
 * upfront, tools are discovered and imported dynamically as needed.
 */
export class MCPClient {
  private serverRegistry: Map<string, ServerMetadata> = new Map();

  constructor() {
    logger.info('MCP Client initialized');
  }

  /**
   * Register a server with its metadata
   * This allows the model to discover available tool modules
   */
  registerServer(metadata: ServerMetadata): void {
    this.serverRegistry.set(metadata.name, metadata);
    logger.info({ server: metadata.name, tools: metadata.tools.length }, 'Server registered');
  }

  /**
   * Get list of all registered servers
   * Used for tool discovery
   */
  listServers(): ServerMetadata[] {
    return Array.from(this.serverRegistry.values());
  }

  /**
   * Get metadata for a specific server
   */
  getServer(name: string): ServerMetadata | undefined {
    return this.serverRegistry.get(name);
  }

  /**
   * Dynamically import a tool from a server
   *
   * @example
   * ```typescript
   * const tool = await client.importTool('google-drive', 'searchDocuments');
   * const result = await tool.call({ query: 'meeting notes' });
   * ```
   */
  async importTool(serverName: string, toolName: string): Promise<any> {
    const server = this.serverRegistry.get(serverName);

    if (!server) {
      throw new Error(`Server '${serverName}' not found`);
    }

    if (!server.tools.includes(toolName)) {
      throw new Error(`Tool '${toolName}' not found in server '${serverName}'`);
    }

    try {
      logger.debug({ server: serverName, tool: toolName }, 'Importing tool');
      const module = await import(`./servers/${serverName}/${toolName}.js`);
      return module[toolName];
    } catch (error) {
      logger.error({ server: serverName, tool: toolName, error }, 'Failed to import tool');
      throw new Error(`Failed to import tool '${toolName}' from server '${serverName}': ${error}`);
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; servers: number }> {
    return {
      status: 'healthy',
      servers: this.serverRegistry.size
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('MCP Client shutting down');
    // Add cleanup logic here if needed
  }
}
