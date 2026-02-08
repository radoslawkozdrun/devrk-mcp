/**
 * AI Summarizer
 *
 * Multi-provider AI summarization using native fetch.
 * Supports: openai (default), anthropic, deepseek.
 * DeepSeek uses OpenAI-compatible API format.
 */

import { config } from '../config.js';
import { logger } from './logger.js';

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages'
};

const SYSTEM_PROMPT = 'You are a concise video summarizer. Summarize the following content in exactly 2 sentences in the same language as the content. Focus on the key topic and main takeaway.';

/**
 * Summarize text using configured AI provider
 *
 * @param text - Text to summarize (transcript or description)
 * @param maxInputChars - Max characters of input to send (default 4000)
 * @returns Summary string (2 sentences)
 */
export async function summarize(text: string, maxInputChars = 4000): Promise<string> {
  if (!text || text.trim().length === 0) {
    return '';
  }

  if (!config.ai.apiKey) {
    logger.debug('AI_API_KEY not set, returning truncated text as fallback');
    return truncateFallback(text);
  }

  const truncatedText = text.length > maxInputChars ? text.substring(0, maxInputChars) + '...' : text;

  try {
    const provider = config.ai.provider.toLowerCase();

    if (provider === 'anthropic') {
      return await callAnthropic(truncatedText);
    }

    // openai and deepseek use the same format
    return await callOpenAICompatible(truncatedText, provider);
  } catch (error: any) {
    logger.warn({ error: error.message, provider: config.ai.provider }, 'AI summarization failed, using fallback');
    return truncateFallback(text);
  }
}

/**
 * Call OpenAI-compatible API (OpenAI, DeepSeek)
 */
async function callOpenAICompatible(text: string, provider: string): Promise<string> {
  const endpoint = PROVIDER_ENDPOINTS[provider] || PROVIDER_ENDPOINTS.openai;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.ai.apiKey}`
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      max_tokens: 200,
      temperature: 0.3
    }),
    signal: AbortSignal.timeout(config.timeout.default)
  });

  if (!response.ok) {
    throw new Error(`${provider} API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Call Anthropic Messages API
 */
async function callAnthropic(text: string): Promise<string> {
  const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.ai.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.ai.model,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: text }
      ]
    }),
    signal: AbortSignal.timeout(config.timeout.default)
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.content?.[0]?.text?.trim() || '';
}

/**
 * Fallback: truncate text to ~2 sentences
 */
function truncateFallback(text: string): string {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length >= 2) {
    return sentences.slice(0, 2).map(s => s.trim()).join('. ') + '.';
  }
  return text.substring(0, 200).trim() + (text.length > 200 ? '...' : '');
}
