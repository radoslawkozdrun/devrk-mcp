import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { callComposioTool, extractComposioItems } from '../../utils/composio-client.js';
import { ToolError } from '../../types/index.js';

/**
 * Input schema for getPlaylistItems tool
 */
const GetPlaylistItemsInputSchema = z.object({
  playlistId: z.string().min(1)
    .describe('YouTube playlist ID (e.g., UU... for uploads playlist)'),
  maxResults: z.number().min(1).max(50).optional().default(5)
    .describe('Maximum number of videos to fetch from playlist')
});

/**
 * Thumbnail schema
 */
const ThumbnailSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional()
});

/**
 * Playlist item schema matching YouTube API structure
 */
const PlaylistItemSchema = z.object({
  snippet: z.object({
    title: z.string(),
    description: z.string(),
    channelId: z.string(),
    channelTitle: z.string(),
    thumbnails: z.object({
      default: ThumbnailSchema.optional(),
      medium: ThumbnailSchema.optional(),
      high: ThumbnailSchema.optional()
    }).optional()
  }),
  contentDetails: z.object({
    videoId: z.string(),
    videoPublishedAt: z.string()
  })
});

/**
 * Output schema for getPlaylistItems tool
 */
const GetPlaylistItemsOutputSchema = z.object({
  items: z.array(PlaylistItemSchema),
  playlistId: z.string(),
  count: z.number().describe('Number of items fetched')
});

/**
 * Get videos from a YouTube playlist
 *
 * Fetches video metadata from any public or user-accessible playlist.
 * Commonly used to get a channel's latest uploads by using the uploads
 * playlist ID (convert channel ID with channelIdToUploadsPlaylistId).
 *
 * @example
 * ```typescript
 * // Get latest 10 videos from a playlist
 * const result = await getPlaylistItems.call({
 *   playlistId: 'UUxxxxxxxxxxxxxx',
 *   maxResults: 10
 * });
 *
 * console.log(`Found ${result.count} videos`);
 *
 * for (const item of result.items) {
 *   const video = item.contentDetails;
 *   console.log(`${item.snippet.title} - ${video.videoId}`);
 * }
 * ```
 */
export const getPlaylistItems = createTool({
  name: 'youtube__get_playlist_items',
  input: GetPlaylistItemsInputSchema,
  output: GetPlaylistItemsOutputSchema,
  execute: async (input) => {
    const response = await callComposioTool('YOUTUBE_LIST_PLAYLIST_ITEMS', {
      playlistId: input.playlistId,
      part: 'snippet,contentDetails',
      maxResults: input.maxResults
    });

    if (!response.successful) {
      throw new ToolError(
        'youtube__get_playlist_items',
        response.error || 'Failed to get playlist items',
        undefined,
        true // retryable - could be temporary API issue
      );
    }

    // Extract items from response (data.items for playlist items)
    const items = extractComposioItems(response);

    if (!items || items.length === 0) {
      // Empty playlist is not an error, just return empty array
      return {
        items: [],
        playlistId: input.playlistId,
        count: 0
      };
    }

    return {
      items,
      playlistId: input.playlistId,
      count: items.length
    };
  }
});
