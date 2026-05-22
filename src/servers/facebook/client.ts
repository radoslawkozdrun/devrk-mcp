import Bottleneck from 'bottleneck';
import { ToolError } from '../../types/index.js';
import { config } from '../../config.js';

const GRAPH_BASE = `https://graph.facebook.com/${config.facebook.apiVersion}`;

/**
 * Rate limiter: Facebook Graph API allows ~200 calls/hour per user token.
 * We stay conservative at max 2 concurrent, 500ms apart.
 */
const limiter = new Bottleneck({ maxConcurrent: 2, minTime: 500 });

export interface GraphApiResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

export interface GraphApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

/**
 * Execute a Graph API GET request with rate limiting.
 * Throws ToolError on HTTP/API errors.
 */
export async function graphGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const accessToken = config.facebook.accessToken;
  if (!accessToken) {
    throw new ToolError(
      'facebook__fetch_posts_with_comments',
      'FACEBOOK_ACCESS_TOKEN is not configured',
      undefined,
      false
    );
  }

  return limiter.schedule(async () => {
    const url = new URL(`${GRAPH_BASE}${path}`);
    url.searchParams.set('access_token', accessToken);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(config.timeout.default)
    });

    const body = await response.json() as T | GraphApiError;

    if (!response.ok || (body as GraphApiError).error) {
      const err = (body as GraphApiError).error;
      const retryable = response.status === 429 || response.status >= 500;
      throw new ToolError(
        'facebook__fetch_posts_with_comments',
        err?.message ?? `Graph API returned HTTP ${response.status}`,
        undefined,
        retryable
      );
    }

    return body as T;
  });
}
