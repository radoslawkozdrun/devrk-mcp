import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config.js';
import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Generate embedding vector for query text using configured AI provider
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(config.qdrant.embeddingEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.ai.apiKey}`
    },
    body: JSON.stringify({
      model: config.qdrant.embeddingModel,
      input: text
    }),
    signal: AbortSignal.timeout(config.timeout.default)
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  return data.data?.[0]?.embedding || [];
}

const SearchInputSchema = z.object({
  query: z.string().min(1).describe('Search query text'),
  collection: z.string().optional()
    .default(config.qdrant.collection)
    .describe('Qdrant collection name'),
  limit: z.number().min(1).max(50).optional().default(5)
    .describe('Maximum number of results'),
  scoreThreshold: z.number().min(0).max(1).optional().default(0.7)
    .describe('Minimum similarity score (0-1)')
});

const SearchResultSchema = z.object({
  id: z.union([z.string(), z.number()]),
  score: z.number(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional()
});

const SearchOutputSchema = z.object({
  results: z.array(SearchResultSchema),
  query: z.string(),
  collection: z.string(),
  totalFound: z.number()
});

/**
 * Semantic search in Qdrant vector database
 *
 * Generates an embedding for the query text and searches for similar
 * vectors in the specified Qdrant collection.
 *
 * @example
 * ```typescript
 * const result = await search.call({
 *   query: 'How to implement authentication?',
 *   collection: 'knowledge-base',
 *   limit: 5
 * });
 * ```
 */
export const search = createTool({
  name: 'qdrant_rag__search',
  input: SearchInputSchema,
  output: SearchOutputSchema,
  execute: async (input) => {
    logger.info({
      query: input.query.substring(0, 100),
      collection: input.collection,
      limit: input.limit
    }, 'Starting Qdrant semantic search');

    // Generate embedding for query
    const queryVector = await generateEmbedding(input.query);

    if (queryVector.length === 0) {
      throw new Error('Failed to generate embedding for query');
    }

    logger.debug({ vectorDim: queryVector.length }, 'Generated query embedding');

    // Search in Qdrant
    const client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey || undefined,
      timeout: config.timeout.default
    });

    const searchResult = await client.query(input.collection, {
      query: queryVector,
      limit: input.limit,
      score_threshold: input.scoreThreshold,
      with_payload: true
    });

    const results = searchResult.points.map(point => {
      const payload = point.payload || {};
      const content = (payload.content as string) || (payload.text as string) || JSON.stringify(payload);

      // Separate content from other metadata
      const metadata = { ...payload };
      delete metadata.content;
      delete metadata.text;

      return {
        id: point.id,
        score: point.score ?? 0,
        content,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      };
    });

    logger.info({
      totalFound: results.length,
      collection: input.collection
    }, 'Qdrant search completed');

    return {
      results,
      query: input.query,
      collection: input.collection,
      totalFound: results.length
    };
  }
});
