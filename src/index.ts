import { startMcpServer, stopMcpServer } from './mcp-server.js';
import { logger } from './utils/logger.js';
import { config } from './config.js';

/**
 * Main entry point for the MCP Server (HTTP only)
 *
 * This server implements the "code execution with MCP" approach with official MCP SDK:
 * - Uses official MCP TypeScript SDK for protocol compliance
 * - Tools are exposed as TypeScript files, not loaded into context
 * - Lazy loading: model imports only what it needs, when it needs it
 * - Drastically reduces token usage (75-87% reduction)
 * - Progressive disclosure through filesystem-based tool discovery
 * - Bearer token authentication on all /mcp endpoints
 */

async function main() {
  logger.info('Starting MCP Server with Anthropic guidelines + MCP SDK');

  // Fail-fast: MCP_API_KEY is required for Bearer token auth
  if (!config.server.apiKey) {
    logger.fatal('MCP_API_KEY is not set. Server requires a Bearer token for authentication. Set MCP_API_KEY in your environment or .env file.');
    process.exit(1);
  }

  // Validate required configuration
  if (!config.google.clientId || !config.google.clientSecret) {
    logger.warn('Google OAuth2 credentials not configured - YouTube/Gmail tools will not work');
  }

  if (!config.ai.apiKey) {
    logger.warn('AI_API_KEY not set - video summaries will use fallback (truncation)');
  }

  try {
    await startMcpServer();

    logger.info('MCP Server successfully started and ready');

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
