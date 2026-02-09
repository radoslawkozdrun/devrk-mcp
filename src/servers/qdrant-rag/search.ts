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
    .describe('Minimum similarity score (0-1)'),
  vectorName: z.string().optional()
    .describe('Named vector to search on (auto-detected if not provided)')
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

    // Auto-detect named vector if not provided
    let vectorName = input.vectorName;
    if (!vectorName) {
      try {
        const collectionInfo = await client.getCollection(input.collection);
        const vectorsConfig = collectionInfo.config?.params?.vectors;

        // If vectors config is an object with named keys (not a direct size/distance config),
        // it means the collection uses named vectors
        if (vectorsConfig && typeof vectorsConfig === 'object' && !('size' in vectorsConfig)) {
          const vectorNames = Object.keys(vectorsConfig);
          if (vectorNames.length > 0) {
            vectorName = vectorNames[0];
            logger.info({ vectorName, allVectors: vectorNames }, 'Auto-detected named vector');
          }
        }
      } catch (err: any) {
        logger.warn({ error: err.message, collection: input.collection }, 'Failed to detect vector config, proceeding without named vector');
      }
    }

    // Build query parameters
    const queryParams: any = {
      query: queryVector,
      limit: input.limit,
      score_threshold: input.scoreThreshold,
      with_payload: true
    };

    if (vectorName) {
      queryParams.using = vectorName;
    }

    logger.debug({ vectorName: vectorName || '(default)', queryDim: queryVector.length }, 'Executing Qdrant query');

    let searchResult;
    try {
      searchResult = await client.query(input.collection, queryParams);
    } catch (err: any) {
      // Try to extract detailed error from Qdrant response
      const detail = err.data?.status?.error || err.message;
      logger.error({ detail, collection: input.collection, vectorName }, 'Qdrant query failed');
      throw new Error(`Qdrant query failed: ${detail}`);
    }

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
      collection: input.collection,
      vectorName: vectorName || '(default)'
    }, 'Qdrant search completed');

    return {
      results,
      query: input.query,
      collection: input.collection,
      totalFound: results.length
    };
  }
});
