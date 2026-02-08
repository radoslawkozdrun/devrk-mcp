import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('AI Summarizer', () => {
  describe('summarize() without API key (fallback mode)', () => {
    it('should return empty string for empty input', async () => {
      const { summarize } = await import('../../src/utils/ai-summarizer.js');
      const result = await summarize('');
      assert.equal(result, '');
    });

    it('should return empty string for whitespace-only input', async () => {
      const { summarize } = await import('../../src/utils/ai-summarizer.js');
      const result = await summarize('   ');
      assert.equal(result, '');
    });

    it('should return truncated text when no API key is set', async () => {
      // AI_API_KEY is not set in test environment, so fallback is used
      const { summarize } = await import('../../src/utils/ai-summarizer.js');
      const longText = 'This is the first sentence about AI. This is the second sentence about machine learning. This is the third sentence about deep learning.';
      const result = await summarize(longText);
      assert.ok(result.length > 0, 'Should return non-empty result');
      // Fallback extracts first 2 sentences
      assert.ok(result.includes('AI'), 'Should contain content from input');
    });

    it('should handle very long text by truncating', async () => {
      const { summarize } = await import('../../src/utils/ai-summarizer.js');
      const longText = 'A'.repeat(500);
      const result = await summarize(longText);
      assert.ok(result.length > 0);
      assert.ok(result.length <= 210, 'Should be truncated to ~200 chars');
    });
  });
});
