import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';

/**
 * Input schema for the greet tool
 */
const GreetInputSchema = z.object({
  name: z.string().describe('Name of the person to greet'),
  language: z.enum(['en', 'pl', 'es']).default('en').describe('Language for the greeting')
});

/**
 * Output schema for the greet tool
 */
const GreetOutputSchema = z.object({
  greeting: z.string().describe('The formatted greeting message'),
  timestamp: z.string().describe('ISO timestamp of when the greeting was generated')
});

/**
 * Example tool that generates greetings in different languages
 *
 * @example
 * ```typescript
 * const result = await greet.call({ name: 'John', language: 'en' });
 * // { greeting: 'Hello, John!', timestamp: '2024-01-09T10:00:00.000Z' }
 * ```
 */
export const greet = createTool({
  name: 'example__greet',
  input: GreetInputSchema,
  output: GreetOutputSchema,
  execute: async (input) => {
    const greetings: Record<string, string> = {
      en: `Hello, ${input.name}!`,
      pl: `Cześć, ${input.name}!`,
      es: `¡Hola, ${input.name}!`
    };

    return {
      greeting: greetings[input.language],
      timestamp: new Date().toISOString()
    };
  }
});
