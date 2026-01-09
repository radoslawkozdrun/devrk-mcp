/**
 * YouTube Server Utilities
 */

/**
 * Convert YouTube Channel ID to Uploads Playlist ID
 *
 * YouTube channels have an "uploads" playlist containing all videos.
 * The playlist ID is derived from the channel ID by changing the prefix:
 * UC... → UU...
 *
 * @param channelId - YouTube channel ID (starts with UC)
 * @returns Uploads playlist ID (starts with UU)
 * @throws Error if channel ID format is invalid
 *
 * @example
 * ```typescript
 * const playlistId = channelIdToUploadsPlaylistId('UCxxxxxxxxxxxxxx');
 * // Returns: 'UUxxxxxxxxxxxxxx'
 * ```
 */
export function channelIdToUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith('UC')) {
    return 'UU' + channelId.substring(2);
  }
  throw new Error(`Invalid channel ID format: ${channelId}. Expected format: UC...`);
}
