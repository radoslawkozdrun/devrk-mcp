/**
 * MCP Server with Anthropic Guidelines Integration
 *
 * This file demonstrates how to combine:
 * 1. Official MCP TypeScript SDK (protocol & transport)
 * 2. Anthropic "tools as code" approach (progressive disclosure, lazy loading)
 *
 * Benefits:
 * - Standard MCP protocol compliance
 * - Reduced token usage (tools discovered on-demand)
 * - Modular architecture (one tool = one file)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getAllServers } from './servers/index.js';
import { logger } from './utils/logger.js';

/**
 * Create MCP Server instance
 */
const server = new Server(
  {
    name: 'devrk-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

/**
 * Dynamic tool registry following Anthropic guidelines
 *
 * Key principle: Register tool METADATA only, not implementation
 * Implementation is lazy-loaded when tool is called
 */
const toolRegistry = new Map<string, {
  serverName: string;
  toolName: string;
  metadata: Tool;
}>();

/**
 * Convert camelCase to snake_case for MCP tool names
 * Example: getSubscriptions → get_subscriptions
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Initialize tool registry with metadata (NOT implementations)
 * This keeps context small - only names and schemas are exposed
 */
async function initializeToolRegistry() {
  const servers = getAllServers();

  logger.info({ serverCount: servers.length }, 'Initializing tool registry');

  for (const serverMeta of servers) {
    for (const toolName of serverMeta.tools) {
      // MCP tool name: snake_case (e.g., youtube__get_subscriptions)
      const mcpToolName = `${serverMeta.name}__${camelToSnake(toolName)}`;

      try {
        // Load ONLY metadata (schemas), not the full implementation
        // toolName is in camelCase to match file names
        const metadata = await loadToolMetadata(serverMeta.name, toolName);

        toolRegistry.set(mcpToolName, {
          serverName: serverMeta.name,
          toolName: toolName, // Keep camelCase for file loading
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

  logger.info({
    toolCount: toolRegistry.size
  }, 'Tool registry initialized');
}

/**
 * Load tool metadata (schema + description) WITHOUT loading implementation
 *
 * This is the key to Anthropic's approach:
 * - Model sees only the schema (what tool needs/returns)
 * - Model does NOT see implementation code
 * - Implementation loaded only when tool is actually called
 */
async function loadToolMetadata(serverName: string, toolName: string): Promise<Tool> {
  // Import the module to get schemas
  const modulePath = `./servers/${serverName}/${toolName}.js`;
  const module = await import(modulePath);

  // Extract the tool instance
  const tool = module[toolName] || module.default;

  if (!tool) {
    throw new Error(`Tool ${toolName} not found in ${modulePath}`);
  }

  // Extract Zod schemas and convert to JSON Schema for MCP
  // Use flat schema without $ref for better Claude Desktop compatibility
  let jsonSchema: any = { type: 'object', properties: {} };

  if (tool.inputSchema) {
    const fullSchema: any = zodToJsonSchema(tool.inputSchema, {
      name: `${serverName}__${camelToSnake(toolName)}_input`,
      $refStrategy: 'none'
    });

    // If schema has definitions and $ref, flatten it
    if (fullSchema.definitions && fullSchema.$ref) {
      const refKey = fullSchema.$ref.replace('#/definitions/', '');
      jsonSchema = fullSchema.definitions[refKey] || fullSchema;
      delete jsonSchema.$schema;
    } else {
      jsonSchema = fullSchema;
    }
  }

  // Extract description
  const description = extractToolDescription(tool, serverName, toolName);

  return {
    name: `${serverName}__${camelToSnake(toolName)}`, // MCP tool name in snake_case
    description,
    inputSchema: jsonSchema as any // Cast to any to satisfy MCP SDK's Tool type
  };
}

/**
 * Extract tool description from tool metadata
 */
function extractToolDescription(tool: any, serverName: string, toolName: string): string {
  // Try to extract from tool definition or use a default
  if (tool.description) return tool.description;
  if (tool.name) return `${tool.name} tool`;
  return `${serverName} ${toolName} tool`;
}

/**
 * Handle tools/list request
 * Returns ONLY metadata (names + schemas), not implementations
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Array.from(toolRegistry.values()).map(entry => entry.metadata);

  logger.debug({ count: tools.length }, 'Listed tools');

  return {
    tools
  };
});

/**
 * Handle tools/call request
 *
 * THIS IS WHERE LAZY LOADING HAPPENS (Anthropic guideline)
 * - Tool implementation imported ONLY when called
 * - Not loaded upfront, not kept in memory
 * - Reduces token usage dramatically
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: toolName, arguments: args } = request.params;

  logger.info({ tool: toolName, argsKeys: Object.keys(args || {}) }, 'Tool call received');

  const toolEntry = toolRegistry.get(toolName);

  if (!toolEntry) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  try {
    // LAZY LOAD: Import tool implementation only now
    const modulePath = `./servers/${toolEntry.serverName}/${toolEntry.toolName}.js`;

    logger.debug({ tool: toolName, module: modulePath }, 'Lazy loading tool implementation');

    const module = await import(modulePath);
    const tool = module[toolEntry.toolName] || module.default;

    if (!tool || typeof tool.execute !== 'function') {
      throw new Error(`Tool ${toolName} does not have an execute function`);
    }

    // Execute the tool
    const startTime = Date.now();
    const result = await tool.execute(args || {});
    const duration = Date.now() - startTime;

    logger.info({
      tool: toolName,
      duration,
      resultKeys: Object.keys(result)
    }, 'Tool execution completed');

    // Return result in MCP format
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error: any) {
    logger.error({
      tool: toolName,
      error: error.message,
      stack: error.stack
    }, 'Tool execution failed');

    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${toolName}: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

/**
 * Start MCP server with stdio transport
 * Stdio is used for local integrations (Claude Desktop, CLI)
 */
export async function startMcpServer() {
  logger.info('Starting MCP server with Anthropic guidelines...');

  // Initialize tool registry (metadata only)
  await initializeToolRegistry();

  // Setup stdio transport
  const transport = new StdioServerTransport();

  logger.info('Connecting to stdio transport...');

  await server.connect(transport);

  logger.info('MCP server ready and listening on stdio');
}

/**
 * Graceful shutdown
 */
export async function stopMcpServer() {
  logger.info('Stopping MCP server...');
  await server.close();
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
