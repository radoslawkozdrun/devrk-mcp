import * as exampleServer from '../../servers/example/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Options for the example workflow skill
 */
export interface ExampleWorkflowOptions {
  names: string[];
  language: 'en' | 'pl' | 'es';
}

/**
 * Result from the example workflow
 */
export interface ExampleWorkflowResult {
  greetings: string[];
  count: number;
  timestamp: string;
}

/**
 * Example Workflow Skill
 *
 * Demonstrates how to compose multiple tools into a higher-level workflow.
 * This skill uses the greet tool from the example server to generate
 * multiple greetings.
 *
 * See SKILL.md for detailed documentation.
 *
 * @example
 * ```typescript
 * const result = await exampleWorkflow({
 *   names: ['Alice', 'Bob'],
 *   language: 'en'
 * });
 * ```
 */
export async function exampleWorkflow(
  options: ExampleWorkflowOptions
): Promise<ExampleWorkflowResult> {
  logger.info({ names: options.names.length, language: options.language }, 'Starting example workflow');

  const greetings: string[] = [];

  // Generate greeting for each name
  for (const name of options.names) {
    const result = await exampleServer.greet.call({
      name,
      language: options.language
    });

    greetings.push(result.greeting);
  }

  const result = {
    greetings,
    count: greetings.length,
    timestamp: new Date().toISOString()
  };

  logger.info({ count: result.count }, 'Example workflow completed');

  return result;
}
