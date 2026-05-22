import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Facebook Server', () => {
  describe('fetchPostsWithComments tool schema validation', () => {
    it('should have correct tool name', async () => {
      const { fetchPostsWithComments } = await import('../../src/servers/facebook/fetchPostsWithComments.js');
      assert.equal(fetchPostsWithComments.name, 'facebook__fetch_posts_with_comments');
    });

    it('should apply default values', async () => {
      const { fetchPostsWithComments } = await import('../../src/servers/facebook/fetchPostsWithComments.js');
      const parsed = fetchPostsWithComments.inputSchema.parse({});
      assert.equal(parsed.daysBack, 7);
      assert.equal(parsed.maxPosts, 50);
      assert.equal(parsed.includeReplies, true);
      assert.equal(parsed.maxCommentsPerPost, 100);
      assert.equal(parsed.maxRepliesPerComment, 25);
    });

    it('should accept valid input', async () => {
      const { fetchPostsWithComments } = await import('../../src/servers/facebook/fetchPostsWithComments.js');
      const parsed = fetchPostsWithComments.inputSchema.parse({
        daysBack: 14,
        maxPosts: 30,
        includeReplies: false
      });
      assert.equal(parsed.daysBack, 14);
      assert.equal(parsed.maxPosts, 30);
      assert.equal(parsed.includeReplies, false);
    });

    it('should reject daysBack out of range', async () => {
      const { fetchPostsWithComments } = await import('../../src/servers/facebook/fetchPostsWithComments.js');
      assert.throws(() => fetchPostsWithComments.inputSchema.parse({ daysBack: 0 }));
      assert.throws(() => fetchPostsWithComments.inputSchema.parse({ daysBack: 366 }));
    });

    it('should reject non-integer maxPosts', async () => {
      const { fetchPostsWithComments } = await import('../../src/servers/facebook/fetchPostsWithComments.js');
      assert.throws(() => fetchPostsWithComments.inputSchema.parse({ maxPosts: 10.5 }));
    });

    it('should reject maxPosts above limit', async () => {
      const { fetchPostsWithComments } = await import('../../src/servers/facebook/fetchPostsWithComments.js');
      assert.throws(() => fetchPostsWithComments.inputSchema.parse({ maxPosts: 201 }));
    });

    it('should produce a valid output shape', async () => {
      const { fetchPostsWithComments } = await import('../../src/servers/facebook/fetchPostsWithComments.js');
      const parsed = fetchPostsWithComments.outputSchema.parse({
        posts: [],
        totalPosts: 0,
        totalComments: 0,
        periodDays: 7,
        summary: 'Fetched 0 posts from the last 7 days with 0 top-level comments total.'
      });
      assert.equal(parsed.totalPosts, 0);
      assert.deepEqual(parsed.posts, []);
    });
  });

  describe('graphGet client error handling', () => {
    it('should throw ToolError when access token is missing', async () => {
      const { config } = await import('../../src/config.js');
      const original = config.facebook.accessToken;
      config.facebook.accessToken = '';
      try {
        const { graphGet } = await import('../../src/servers/facebook/client.js');
        const { ToolError } = await import('../../src/types/index.js');
        await assert.rejects(
          () => graphGet('/me/posts', {}),
          (err: unknown) => err instanceof ToolError && !err.retryable
        );
      } finally {
        config.facebook.accessToken = original;
      }
    });
  });
});
