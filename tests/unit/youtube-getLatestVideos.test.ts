import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('YouTube getLatestVideos', () => {
  describe('input schema validation', () => {
    it('should have correct tool name', async () => {
      const { getLatestVideos } = await import('../../src/servers/youtube/getLatestVideos.js');
      assert.equal(getLatestVideos.name, 'youtube__get_latest_videos');
    });

    it('should apply default values', async () => {
      const { getLatestVideos } = await import('../../src/servers/youtube/getLatestVideos.js');
      const parsed = getLatestVideos.inputSchema.parse({});
      assert.equal(parsed.videosPerChannel, 5);
      assert.equal(parsed.maxChannels, 50);
      assert.equal(parsed.sendEmail, false);
      assert.equal(parsed.hoursBack, undefined);
    });

    it('should accept valid input with hoursBack', async () => {
      const { getLatestVideos } = await import('../../src/servers/youtube/getLatestVideos.js');
      const parsed = getLatestVideos.inputSchema.parse({
        videosPerChannel: 3,
        maxChannels: 10,
        hoursBack: 24,
        sendEmail: true
      });
      assert.equal(parsed.videosPerChannel, 3);
      assert.equal(parsed.maxChannels, 10);
      assert.equal(parsed.hoursBack, 24);
      assert.equal(parsed.sendEmail, true);
    });

    it('should reject videosPerChannel > 50', async () => {
      const { getLatestVideos } = await import('../../src/servers/youtube/getLatestVideos.js');
      assert.throws(() => {
        getLatestVideos.inputSchema.parse({ videosPerChannel: 100 });
      });
    });

    it('should reject videosPerChannel < 1', async () => {
      const { getLatestVideos } = await import('../../src/servers/youtube/getLatestVideos.js');
      assert.throws(() => {
        getLatestVideos.inputSchema.parse({ videosPerChannel: 0 });
      });
    });
  });

  describe('output schema validation', () => {
    it('should validate correct output shape', async () => {
      const { getLatestVideos } = await import('../../src/servers/youtube/getLatestVideos.js');
      const validOutput = {
        channels: [{
          channel: { id: 'UC123', title: 'Test', thumbnail: 'https://example.com/thumb.jpg' },
          videos: [{
            videoId: 'abc123',
            title: 'Test Video',
            description: 'desc',
            publishedAt: '2025-01-01T00:00:00Z',
            channelId: 'UC123',
            channelTitle: 'Test',
            thumbnail: 'https://example.com/thumb.jpg',
            url: 'https://www.youtube.com/watch?v=abc123',
            summary: 'This is a test summary. It has two sentences.',
            summarySource: 'transcript'
          }]
        }],
        totalVideos: 1,
        totalChannels: 1,
        summary: 'Found 1 video from 1 channel',
        emailSent: false
      };
      const parsed = getLatestVideos.outputSchema.parse(validOutput);
      assert.equal(parsed.totalVideos, 1);
      assert.equal(parsed.channels[0].videos[0].summarySource, 'transcript');
    });
  });
});
