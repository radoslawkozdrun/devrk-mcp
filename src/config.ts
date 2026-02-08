import { config as loadEnv } from 'dotenv';

// Load environment variables from .env file
loadEnv();

/**
 * Helper function to get environment variable with default value
 */
function env(key: string, defaultValue: string): string;
function env(key: string, defaultValue: number): number;
function env(key: string, defaultValue: boolean): boolean;
function env(key: string, defaultValue: string | number | boolean): string | number | boolean {
  const value = process.env[key];

  if (value === undefined) {
    return defaultValue;
  }

  if (typeof defaultValue === 'number') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  if (typeof defaultValue === 'boolean') {
    return value.toLowerCase() === 'true';
  }

  return value;
}

/**
 * Application configuration
 * All configuration should be read from environment variables
 */
export const config = {
  server: {
    port: env('MCP_PORT', 3000),
    host: env('MCP_HOST', '0.0.0.0'),
    logLevel: env('LOG_LEVEL', 'info'),
    apiKey: env('MCP_API_KEY', '')
  },
  rateLimit: {
    maxConcurrent: env('RATE_LIMIT_CONCURRENT', 5),
    minTime: env('RATE_LIMIT_MIN_TIME', 100)
  },
  timeout: {
    default: env('TIMEOUT_DEFAULT', 30000),
    long: env('TIMEOUT_LONG', 120000)
  },
  google: {
    clientId: env('GOOGLE_CLIENT_ID', ''),
    clientSecret: env('GOOGLE_CLIENT_SECRET', ''),
    refreshToken: env('GOOGLE_REFRESH_TOKEN', '')
  },
  ai: {
    provider: env('AI_PROVIDER', 'openai'),
    apiKey: env('AI_API_KEY', ''),
    model: env('AI_MODEL', 'gpt-4o-mini')
  },
  qdrant: {
    url: env('QDRANT_URL', 'http://localhost:6333'),
    apiKey: env('QDRANT_API_KEY', ''),
    collection: env('QDRANT_COLLECTION', 'default'),
    embeddingModel: env('EMBEDDING_MODEL', 'text-embedding-3-small'),
    embeddingEndpoint: env('EMBEDDING_ENDPOINT', 'https://api.openai.com/v1/embeddings')
  },
  youtube: {
    defaultVideosPerChannel: env('YOUTUBE_DEFAULT_VIDEOS_PER_CHANNEL', 5),
    defaultMaxChannels: env('YOUTUBE_DEFAULT_MAX_CHANNELS', 50)
  },
  gmail: {
    enabled: env('GMAIL_ENABLED', true),
    recipientEmail: env('RECIPIENT_EMAIL', '')
  }
};
