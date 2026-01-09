import axios, { AxiosError } from 'axios';
import { logger } from './logger.js';
import { ToolError } from '../types/index.js';
import { config } from '../config.js';

/**
 * Composio API response structure
 */
export interface ComposioResponse<T = any> {
  successful: boolean;
  data?: T;
  error?: string;
}

/**
 * Call a Composio MCP tool via HTTP API
 *
 * Handles SSE (Server-Sent Events) response parsing and error normalization.
 * Composio API returns data in various nested structures - this function
 * normalizes them for consistent consumption.
 *
 * @param toolName - Composio tool identifier (e.g., 'YOUTUBE_LIST_USER_SUBSCRIPTIONS')
 * @param params - Tool parameters as key-value object
 * @returns Normalized response with success flag and data/error
 *
 * @example
 * ```typescript
 * const response = await callComposioTool('YOUTUBE_LIST_USER_SUBSCRIPTIONS', {
 *   part: 'snippet',
 *   maxResults: 50
 * });
 *
 * if (response.successful) {
 *   const items = extractComposioItems(response);
 *   // Process items...
 * }
 * ```
 */
export async function callComposioTool<T = any>(
  toolName: string,
  params: Record<string, any>
): Promise<ComposioResponse<T>> {
  // Validate config
  if (!config.composio.apiKey || !config.composio.mcpEndpoint || !config.composio.userId) {
    throw new ToolError(
      'composio_client',
      'Composio configuration missing. Check COMPOSIO_API_KEY, COMPOSIO_MCP_ENDPOINT, COMPOSIO_USER_ID in .env',
      undefined,
      false
    );
  }

  const startTime = Date.now();

  logger.debug({
    tool: toolName,
    paramKeys: Object.keys(params)
  }, 'Calling Composio tool');

  try {
    const url = `${config.composio.mcpEndpoint}?user_id=${config.composio.userId}`;

    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      },
      {
        headers: {
          'x-api-key': config.composio.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        timeout: config.timeout.default
      }
    );

    // Parse response - Composio can return SSE format or direct JSON
    let parsedData = response.data;

    // Handle SSE (Server-Sent Events) format
    if (typeof parsedData === 'string') {
      logger.debug('Parsing SSE response from Composio');

      const lines = parsedData.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6); // Remove "data: " prefix
          try {
            const parsed = JSON.parse(jsonStr);

            // Composio MCP wraps result in result.content[0].text
            if (parsed.result?.content?.[0]?.text) {
              parsedData = JSON.parse(parsed.result.content[0].text);
              break;
            }
          } catch (parseError) {
            logger.warn({ parseError, line: line.substring(0, 100) }, 'Failed to parse SSE line');
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info({
      tool: toolName,
      duration,
      successful: parsedData.successful !== false
    }, 'Composio call completed');

    return {
      successful: parsedData.successful !== false,
      data: parsedData.data || parsedData,
      error: parsedData.error
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error({
      tool: toolName,
      error: error.message,
      duration,
      status: error.response?.status
    }, 'Composio call failed');

    // Handle specific HTTP error codes
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Authentication failure
      if (axiosError.response?.status === 401) {
        throw new ToolError(
          'composio_client',
          'Composio authentication failed. Check COMPOSIO_API_KEY.',
          error,
          false // not retryable - fix config
        );
      }

      // Rate limiting
      if (axiosError.response?.status === 429) {
        throw new ToolError(
          'composio_client',
          'Composio rate limit exceeded. Wait before retrying.',
          error,
          true // retryable after delay
        );
      }

      // Timeout
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
        throw new ToolError(
          'composio_client',
          `Composio request timeout (${config.timeout.default}ms)`,
          error,
          true // retryable
        );
      }

      // Network error
      if (!axiosError.response) {
        throw new ToolError(
          'composio_client',
          `Network error: ${axiosError.message}`,
          error,
          true // retryable
        );
      }
    }

    // Return error response for other cases (don't throw)
    return {
      successful: false,
      error: error.response?.data?.error || error.message
    };
  }
}

/**
 * Helper to extract items array from Composio response
 *
 * Composio API is inconsistent about where items are located in the response.
 * This helper checks multiple possible locations and returns the items array.
 *
 * Common patterns:
 * - response.data.response_data.items (subscriptions)
 * - response.data.items (playlist items)
 * - response.items (rare)
 * - response.data (if already array)
 *
 * @param response - Composio API response
 * @returns Array of items, or empty array if not found
 *
 * @example
 * ```typescript
 * const response = await callComposioTool('YOUTUBE_LIST_USER_SUBSCRIPTIONS', params);
 * const subscriptions = extractComposioItems(response);
 * ```
 */
export function extractComposioItems(response: any): any[] {
  // Try different possible locations
  const items =
    response.data?.response_data?.items ||
    response.data?.items ||
    response.items ||
    (Array.isArray(response.data) ? response.data : null);

  if (!items) {
    logger.warn({ responseKeys: Object.keys(response.data || {}) }, 'Could not find items in Composio response');
    return [];
  }

  return items;
}

/**
 * Extract pagination token from Composio response
 *
 * @param response - Composio API response
 * @returns Next page token, or null if no more pages
 */
export function extractNextPageToken(response: any): string | null {
  return (
    response.data?.response_data?.nextPageToken ||
    response.data?.nextPageToken ||
    null
  );
}
