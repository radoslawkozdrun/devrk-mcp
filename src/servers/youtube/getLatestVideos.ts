import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config.js';
import { getSubscriptions } from './getSubscriptions.js';
import { getPlaylistItems } from './getPlaylistItems.js';
import { channelIdToUploadsPlaylistId } from './utils.js';

/**
 * Input schema for getLatestVideos tool
 */
const GetLatestVideosInputSchema = z.object({
  videosPerChannel: z.number().min(1).max(50).optional()
    .default(config.youtube.defaultVideosPerChannel)
    .describe('Number of latest videos to fetch per channel'),
  maxChannels: z.number().min(1).optional()
    .default(config.youtube.defaultMaxChannels)
    .describe('Maximum number of channels to process'),
  hoursBack: z.number().min(1).optional()
    .describe('Only include videos published within last N hours')
});

/**
 * Video schema
 */
const VideoSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),
  channelId: z.string(),
  channelTitle: z.string(),
  thumbnail: z.string(),
  url: z.string()
});

/**
 * Channel with videos schema
 */
const ChannelVideosSchema = z.object({
  channel: z.object({
    id: z.string(),
    title: z.string(),
    thumbnail: z.string()
  }),
  videos: z.array(VideoSchema),
  error: z.string().optional().describe('Error message if fetching failed for this channel')
});

/**
 * Output schema for getLatestVideos tool
 */
const GetLatestVideosOutputSchema = z.object({
  channels: z.array(ChannelVideosSchema),
  totalVideos: z.number().describe('Total number of videos across all channels'),
  totalChannels: z.number().describe('Number of channels with at least one video'),
  summary: z.string().describe('Human-readable summary'),
  emailSent: z.boolean().describe('Whether email notification was sent')
});

/**
 * Get latest videos from all subscribed YouTube channels
 *
 * This is the main orchestrator tool that:
 * 1. Fetches all subscribed channels
 * 2. Converts channel IDs to uploads playlist IDs
 * 3. Fetches recent videos from each channel
 * 4. Optionally filters by publication date
 * 5. Optionally sends email digest if RECIPIENT_EMAIL configured
 *
 * @example
 * ```typescript
 * // Get latest 5 videos from 10 channels
 * const result = await getLatestVideos.call({
 *   videosPerChannel: 5,
 *   maxChannels: 10
 * });
 *
 * console.log(result.summary);
 * // "Found 45 videos from 9 channels"
 *
 * for (const channelData of result.channels) {
 *   console.log(`\n${channelData.channel.title}:`);
 *   for (const video of channelData.videos) {
 *     console.log(`  - ${video.title}`);
 *     console.log(`    ${video.url}`);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Get videos from last 24 hours only
 * const result = await getLatestVideos.call({
 *   videosPerChannel: 10,
 *   hoursBack: 24
 * });
 * ```
 */
export const getLatestVideos = createTool({
  name: 'youtube__get_latest_videos',
  input: GetLatestVideosInputSchema,
  output: GetLatestVideosOutputSchema,
  execute: async (input) => {
    logger.info({
      videosPerChannel: input.videosPerChannel,
      maxChannels: input.maxChannels,
      hoursBack: input.hoursBack
    }, 'Starting YouTube latest videos fetch');

    const results: z.infer<typeof ChannelVideosSchema>[] = [];

    // 1. Fetch all subscriptions
    logger.debug('Fetching YouTube subscriptions');
    const subsResult = await getSubscriptions.execute({ maxResults: 50 });

    logger.info({
      subscriptionCount: subsResult.count
    }, 'Fetched YouTube subscriptions');

    // 2. Limit channels to process
    const channelsToProcess = input.maxChannels
      ? subsResult.subscriptions.slice(0, input.maxChannels)
      : subsResult.subscriptions;

    logger.info({
      channelsToProcess: channelsToProcess.length
    }, 'Processing channels');

    // 3. Calculate cutoff date if hoursBack provided
    const cutoffDate = input.hoursBack
      ? new Date(Date.now() - input.hoursBack * 60 * 60 * 1000)
      : null;

    if (cutoffDate) {
      logger.debug({ cutoffDate: cutoffDate.toISOString() }, 'Filtering videos by date');
    }

    // 4. Fetch videos for each channel
    let processedCount = 0;
    for (const subscription of channelsToProcess) {
      processedCount++;
      const channelId = subscription.snippet.resourceId.channelId;
      const channelTitle = subscription.snippet.title;
      const channelThumbnail = subscription.snippet.thumbnails.default.url;

      logger.debug({
        channelTitle,
        channelId,
        progress: `${processedCount}/${channelsToProcess.length}`
      }, 'Processing channel');

      try {
        // Convert channel ID to uploads playlist ID
        const uploadsPlaylistId = channelIdToUploadsPlaylistId(channelId);

        // Fetch videos from uploads playlist
        const playlistResult = await getPlaylistItems.execute({
          playlistId: uploadsPlaylistId,
          maxResults: input.videosPerChannel
        });

        // Process and filter videos
        const videos: z.infer<typeof VideoSchema>[] = [];

        for (const item of playlistResult.items) {
          const publishedAt = item.contentDetails.videoPublishedAt;

          // Filter by date if needed
          if (cutoffDate && new Date(publishedAt) < cutoffDate) {
            continue; // Skip old videos
          }

          videos.push({
            videoId: item.contentDetails.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            publishedAt,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            thumbnail:
              item.snippet.thumbnails?.high?.url ||
              item.snippet.thumbnails?.default?.url ||
              '',
            url: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`
          });
        }

        // Add to results only if there are videos
        if (videos.length > 0) {
          results.push({
            channel: {
              id: channelId,
              title: channelTitle,
              thumbnail: channelThumbnail
            },
            videos
          });

          logger.debug({
            channelTitle,
            videoCount: videos.length
          }, 'Fetched videos for channel');
        }

      } catch (error: any) {
        logger.error({
          channelTitle,
          channelId,
          error: error.message
        }, 'Error fetching videos for channel');

        // Add channel with error
        results.push({
          channel: {
            id: channelId,
            title: channelTitle,
            thumbnail: channelThumbnail
          },
          videos: [],
          error: error.message
        });
      }
    }

    // 5. Calculate summary stats
    const totalVideos = results.reduce((sum, ch) => sum + ch.videos.length, 0);
    const totalChannels = results.filter(ch => ch.videos.length > 0).length;
    const summary = `Found ${totalVideos} video${totalVideos !== 1 ? 's' : ''} from ${totalChannels} channel${totalChannels !== 1 ? 's' : ''}`;

    logger.info({
      totalVideos,
      totalChannels,
      channelsWithErrors: results.filter(ch => ch.error).length
    }, 'Completed YouTube latest videos fetch');

    // 6. Send email if configured
    let emailSent = false;
    if (config.gmail.recipientEmail && results.length > 0) {
      try {
        const { formatVideoDigestEmail } = await import('../../utils/email-formatter.js');
        const { sendEmail } = await import('../gmail/sendEmail.js');

        const { subject, htmlBody } = formatVideoDigestEmail(results);

        await sendEmail.execute({
          recipientEmail: config.gmail.recipientEmail,
          subject,
          body: htmlBody,
          isHtml: true
        });

        emailSent = true;
        logger.info('Email digest sent successfully');
      } catch (error: any) {
        logger.warn({ error: error.message }, 'Failed to send email digest (non-fatal)');
        // Don't throw - email is optional
      }
    }

    return {
      channels: results,
      totalVideos,
      totalChannels,
      summary,
      emailSent
    };
  }
});
