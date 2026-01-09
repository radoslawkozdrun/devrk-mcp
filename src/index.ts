import { startMcpServer, stopMcpServer } from './mcp-server.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

/**
 * Main entry point for the MCP Server
 *
 * This server implements the "code execution with MCP" approach with official MCP SDK:
 * - Uses official MCP TypeScript SDK for protocol compliance
 * - Tools are exposed as TypeScript files, not loaded into context
 * - Lazy loading: model imports only what it needs, when it needs it
 * - Drastically reduces token usage (75-87% reduction)
 * - Progressive disclosure through filesystem-based tool discovery
 */

async function main() {
  logger.info('Starting MCP Server with Anthropic guidelines + MCP SDK');

  // Validate required configuration
  if (config.composio.apiKey && !config.composio.userId) {
    logger.warn('COMPOSIO_API_KEY is set but COMPOSIO_USER_ID is missing');
  }

  try {
    // Start MCP server with stdio transport
    await startMcpServer();

    logger.info('MCP Server successfully started and ready');

    // The server is now listening on stdio
    // It will handle requests from Claude Desktop or other MCP clients

  } catch (error) {
    logger.fatal({ error }, 'Failed to start MCP Server');
    await stopMcpServer();
    process.exit(1);
  }
}

// Start the server
main().catch(async (error) => {
  logger.fatal({ error }, 'Unhandled error in main');
  await stopMcpServer();
  process.exit(1);
});

// Export for programmatic use
export { createTool } from './utils/tool-factory.js';
export { logger } from './utils/logger.js';
export { config } from './config.js';
export * from './types/index.js';
