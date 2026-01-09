/**
 * Custom error class for tool execution errors
 */
export class ToolError extends Error {
  constructor(
    public tool: string,
    message: string,
    public cause?: Error,
    public retryable: boolean = false
  ) {
    super(`[${tool}] ${message}`);
    this.name = 'ToolError';
    Error.captureStackTrace(this, ToolError);
  }
}

/**
 * Configuration for environment variables
 */
export interface EnvConfig {
  [key: string]: string | number | boolean;
}

/**
 * Server metadata for tool discovery
 */
export interface ServerMetadata {
  name: string;
  description: string;
  version: string;
  tools: string[];
}

/**
 * Skill metadata for high-level workflows
 */
export interface SkillMetadata {
  name: string;
  description: string;
  requiredServers: string[];
  examples: string[];
}
