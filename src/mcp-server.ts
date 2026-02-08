/**
 * MCP Server - HTTP only with Bearer token authentication
 *
 * Streamable HTTP transport for production (Docker, remote access).
 * All /mcp endpoints require Authorization: Bearer <MCP_API_KEY> header.
 * /health endpoint is unauthenticated (for Docker healthcheck).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getAllServers } from './servers/index.js';
import { config } from './config.js';
import { logger } from './utils/logger.js';

import type { Request, Response, NextFunction } from 'express';

/**
 * Tool registry entry - metadata only, implementation lazy-loaded
 */
interface ToolRegistryEntry {
  serverName: string;
  toolName: string;
  metadata: Tool;
}

/**
 * Dynamic tool registry following Anthropic guidelines
 * Loaded once at startup, shared across all requests
 */
const toolRegistry = new Map<string, ToolRegistryEntry>();

/**
 * Convert camelCase to snake_case for MCP tool names
 * Example: getLatestVideos → get_latest_videos
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Normalize server name for MCP tool name prefix
 * Converts kebab-case to snake_case: qdrant-rag → qdrant_rag
 */
function normalizeServerName(name: string): string {
  return name.replace(/-/g, '_');
}

/**
 * Initialize tool registry with metadata (NOT implementations)
 */
async function initializeToolRegistry() {
  const servers = getAllServers();

  logger.info({ serverCount: servers.length }, 'Initializing tool registry');

  for (const serverMeta of servers) {
    for (const toolName of serverMeta.tools) {
      const mcpToolName = `${normalizeServerName(serverMeta.name)}__${camelToSnake(toolName)}`;

      try {
        const metadata = await loadToolMetadata(serverMeta.name, toolName);

        toolRegistry.set(mcpToolName, {
          serverName: serverMeta.name,
          toolName: toolName,
          metadata
        });

        logger.debug({
          tool: mcpToolName,
          hasInputSchema: !!metadata.inputSchema,
          hasDescription: !!metadata.description
        }, 'Registered tool metadata');

      } catch (error: any) {
        logger.error({
          server: serverMeta.name,
          tool: toolName,
          error: error.message
        }, 'Failed to load tool metadata');
      }
    }
  }

  logger.info({ toolCount: toolRegistry.size }, 'Tool registry initialized');
}

/**
 * Load tool metadata (schema + description) WITHOUT loading implementation
 */
async function loadToolMetadata(serverName: string, toolName: string): Promise<Tool> {
  const modulePath = `./servers/${serverName}/${toolName}.js`;
  const module = await import(modulePath);

  const tool = module[toolName] || module.default;

  if (!tool) {
    throw new Error(`Tool ${toolName} not found in ${modulePath}`);
  }

  let jsonSchema: any = { type: 'object', properties: {} };

  if (tool.inputSchema) {
    const fullSchema: any = zodToJsonSchema(tool.inputSchema, {
      name: `${normalizeServerName(serverName)}__${camelToSnake(toolName)}_input`,
      $refStrategy: 'none'
    });

    if (fullSchema.definitions && fullSchema.$ref) {
      const refKey = fullSchema.$ref.replace('#/definitions/', '');
      jsonSchema = fullSchema.definitions[refKey] || fullSchema;
      delete jsonSchema.$schema;
    } else {
      jsonSchema = fullSchema;
    }
  }

  const description = extractToolDescription(tool, serverName, toolName);

  return {
    name: `${normalizeServerName(serverName)}__${camelToSnake(toolName)}`,
    description,
    inputSchema: jsonSchema as any
  };
}

/**
 * Extract tool description from tool metadata
 */
function extractToolDescription(tool: any, serverName: string, toolName: string): string {
  if (tool.description) return tool.description;
  if (tool.name) return `${tool.name} tool`;
  return `${serverName} ${toolName} tool`;
}

/**
 * Create a new MCP Server instance with handlers configured.
 * Called per-request in stateless HTTP mode.
 */
function createMcpServer(): Server {
  const mcpServer = new Server(
    { name: 'devrk-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = Array.from(toolRegistry.values()).map(entry => entry.metadata);
    logger.debug({ count: tools.length }, 'Listed tools');
    return { tools };
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params;

    logger.info({ tool: toolName, argsKeys: Object.keys(args || {}) }, 'Tool call received');

    const toolEntry = toolRegistry.get(toolName);

    if (!toolEntry) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      const modulePath = `./servers/${toolEntry.serverName}/${toolEntry.toolName}.js`;
      logger.debug({ tool: toolName, module: modulePath }, 'Lazy loading tool implementation');

      const module = await import(modulePath);
      const tool = module[toolEntry.toolName] || module.default;

      if (!tool || typeof tool.execute !== 'function') {
        throw new Error(`Tool ${toolName} does not have an execute function`);
      }

      const startTime = Date.now();
      const result = await tool.execute(args || {});
      const duration = Date.now() - startTime;

      logger.info({
        tool: toolName,
        duration,
        resultKeys: Object.keys(result)
      }, 'Tool execution completed');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error: any) {
      logger.error({
        tool: toolName,
        error: error.message,
        stack: error.stack
      }, 'Tool execution failed');

      return {
        content: [{
          type: 'text' as const,
          text: `Error executing ${toolName}: ${error.message}`
        }],
        isError: true
      };
    }
  });

  return mcpServer;
}

/**
 * Bearer token authentication middleware for /mcp routes.
 * Validates Authorization: Bearer <token> against MCP_API_KEY.
 */
function bearerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Missing or invalid Authorization header. Expected: Bearer <token>' },
      id: null
    });
    return;
  }

  const token = authHeader.slice(7);

  if (token !== config.server.apiKey) {
    res.status(403).json({
      jsonrpc: '2.0',
      error: { code: -32002, message: 'Invalid API key' },
      id: null
    });
    return;
  }

  next();
}

/**
 * Start MCP server on HTTP with Bearer token auth
 */
export async function startMcpServer() {
  logger.info('Starting MCP server (HTTP)...');

  await initializeToolRegistry();

  const { default: express } = await import('express');

  const app = express();
  app.use(express.json());

  // Health check endpoint - NO auth (Docker healthcheck needs it)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', tools: toolRegistry.size });
  });

  // Bearer token auth for all /mcp routes
  app.use('/mcp', bearerAuth);

  // MCP Streamable HTTP endpoint (stateless)
  app.post('/mcp', async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined // Stateless mode
      });

      const mcpServer = createMcpServer();
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);

      res.on('close', () => {
        transport.close();
        mcpServer.close();
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'HTTP request failed');
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  // GET /mcp - SSE stream (not used in stateless mode, return 405)
  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'SSE not supported in stateless mode' },
      id: null
    });
  });

  // DELETE /mcp - session termination (not used in stateless mode, return 405)
  app.delete('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Session termination not supported in stateless mode' },
      id: null
    });
  });

  const port = config.server.port;
  const host = config.server.host;

  app.listen(port, host, () => {
    logger.info({ port, host }, 'MCP server ready on HTTP');
  });
}

/**
 * Graceful shutdown
 */
export async function stopMcpServer() {
  logger.info('MCP server stopped');
}

// Handle process signals
process.on('SIGINT', async () => {
  await stopMcpServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopMcpServer();
  process.exit(0);
});
