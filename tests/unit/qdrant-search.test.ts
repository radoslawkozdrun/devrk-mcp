import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

describe('Qdrant RAG Server', () => {
  describe('search tool schema validation', () => {
    it('should validate valid search input', async () => {
      const { search } = await import('../../src/servers/qdrant-rag/search.js');
      assert.ok(search.inputSchema);
      assert.ok(search.name === 'qdrant_rag__search');

      const parsed = search.inputSchema.parse({
        query: 'test query',
        limit: 5
      });
      assert.equal(parsed.query, 'test query');
      assert.equal(parsed.limit, 5);
    });

    it('should reject empty query', async () => {
      const { search } = await import('../../src/servers/qdrant-rag/search.js');
      assert.throws(() => {
        search.inputSchema.parse({ query: '' });
      });
    });

    it('should apply default values', async () => {
      const { search } = await import('../../src/servers/qdrant-rag/search.js');
      const parsed = search.inputSchema.parse({ query: 'test' });
      assert.equal(parsed.limit, 5);
      assert.equal(parsed.scoreThreshold, 0.7);
    });
  });

  describe('listCollections tool schema validation', () => {
    it('should have correct tool name', async () => {
      const { listCollections } = await import('../../src/servers/qdrant-rag/listCollections.js');
      assert.ok(listCollections.name === 'qdrant_rag__list_collections');
    });

    it('should accept empty input', async () => {
      const { listCollections } = await import('../../src/servers/qdrant-rag/listCollections.js');
      const parsed = listCollections.inputSchema.parse({});
      assert.ok(parsed !== null);
    });
  });
});
