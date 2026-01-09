import { z } from 'zod';
import { logger } from './logger.js';
import { ToolError } from '../types/index.js';

/**
 * Configuration for creating a tool
 */
export interface ToolConfig<TInput extends z.ZodType, TOutput extends z.ZodType> {
  name: string;
  input: TInput;
  output: TOutput;
  execute: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
}

/**
 * Tool interface representing a callable tool with validation
 */
export interface Tool<TInput extends z.ZodType, TOutput extends z.ZodType> {
  name: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute: (input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
  call: (input: unknown) => Promise<z.infer<TOutput>>;
}

/**
 * Creates a tool with automatic input/output validation and error handling
 *
 * @example
 * ```typescript
 * const myTool = createTool({
 *   name: 'server__my_tool',
 *   input: z.object({ value: z.string() }),
 *   output: z.object({ result: z.string() }),
 *   execute: async (input) => {
 *     return { result: input.value.toUpperCase() };
 *   }
 * });
 *
 * const result = await myTool.call({ value: 'hello' });
 * ```
 */
export function createTool<TInput extends z.ZodType, TOutput extends z.ZodType>(
  config: ToolConfig<TInput, TOutput>
): Tool<TInput, TOutput> {
  const { name, input, output, execute } = config;

  const call = async (rawInput: unknown): Promise<z.infer<TOutput>> => {
    const startTime = Date.now();

    try {
      // Validate input
      const validatedInput = input.parse(rawInput);

      logger.debug({ tool: name, input: validatedInput }, 'Tool execution started');

      // Execute the tool
      const result = await execute(validatedInput);

      // Validate output
      const validatedOutput = output.parse(result);

      const duration = Date.now() - startTime;
      logger.info({ tool: name, duration }, 'Tool execution completed');

      return validatedOutput;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof z.ZodError) {
        logger.error({ tool: name, error: error.errors, duration }, 'Tool validation failed');
        throw new ToolError(
          name,
          `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          error,
          false
        );
      }

      if (error instanceof ToolError) {
        logger.error({ tool: name, error: error.message, duration }, 'Tool execution failed');
        throw error;
      }

      logger.error({ tool: name, error, duration }, 'Tool execution failed with unexpected error');
      throw new ToolError(
        name,
        error instanceof Error ? error.message : 'Unknown error occurred',
        error instanceof Error ? error : undefined,
        false
      );
    }
  };

  return {
    name,
    inputSchema: input,
    outputSchema: output,
    execute,
    call
  };
}
