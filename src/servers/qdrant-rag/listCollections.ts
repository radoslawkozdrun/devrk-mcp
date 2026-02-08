import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config.js';
import { QdrantClient } from '@qdrant/js-client-rest';

const ListCollectionsInputSchema = z.object({});

const CollectionInfoSchema = z.object({
  name: z.string(),
  vectorsCount: z.number(),
  pointsCount: z.number(),
  status: z.string()
});

const ListCollectionsOutputSchema = z.object({
  collections: z.array(CollectionInfoSchema),
  totalCollections: z.number()
});

/**
 * List all collections in Qdrant vector database
 *
 * Returns collection names with basic statistics.
 *
 * @example
 * ```typescript
 * const result = await listCollections.call({});
 * console.log(result.collections);
 * ```
 */
export const listCollections = createTool({
  name: 'qdrant_rag__list_collections',
  input: ListCollectionsInputSchema,
  output: ListCollectionsOutputSchema,
  execute: async () => {
    logger.info('Listing Qdrant collections');

    const client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey || undefined,
      timeout: config.timeout.default
    });

    const response = await client.getCollections();

    const collections = await Promise.all(
      response.collections.map(async (col) => {
        try {
          const info = await client.getCollection(col.name);
          return {
            name: col.name,
            vectorsCount: (info as any).vectors_count ?? info.indexed_vectors_count ?? 0,
            pointsCount: info.points_count ?? 0,
            status: info.status
          };
        } catch {
          return {
            name: col.name,
            vectorsCount: 0,
            pointsCount: 0,
            status: 'unknown'
          };
        }
      })
    );

    logger.info({ totalCollections: collections.length }, 'Listed Qdrant collections');

    return {
      collections,
      totalCollections: collections.length
    };
  }
});
