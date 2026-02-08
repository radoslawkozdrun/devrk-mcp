import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config.js';
import { getYouTubeClient } from '../../utils/google-auth.js';
import { channelIdToUploadsPlaylistId } from './utils.js';
import { summarize } from '../../utils/ai-summarizer.js';

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
    .describe('Only include videos published within last N hours'),
  sendEmail: z.boolean().optional().default(false)
    .describe('Send email digest to configured RECIPIENT_EMAIL')
});

/**
 * Video schema with AI summary
 */
const VideoSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),
  channelId: z.string(),
  channelTitle: z.string(),
  thumbnail: z.string(),
  url: z.string(),
  summary: z.string().describe('AI-generated 2-sentence summary'),
  summarySource: z.enum(['transcript', 'description', 'fallback'])
    .describe('Source used for generating the summary')
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
 * Fetch all subscriptions with pagination
 */
async function fetchAllSubscriptions(youtube: ReturnType<typeof getYouTubeClient>) {
  const subscriptions: any[] = [];
  let pageToken: string | undefined;

  do {
    const response = await youtube.subscriptions.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
      pageToken
    });

    if (response.data.items) {
      subscriptions.push(...response.data.items);
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return subscriptions;
}

/**
 * Fetch transcript for a video
 */
async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const entries = await YoutubeTranscript.fetchTranscript(videoId);
    if (entries && entries.length > 0) {
      return entries.map((e: any) => e.text).join(' ');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Process a single channel: fetch videos, transcripts, and AI summaries
 */
async function processChannel(
  youtube: ReturnType<typeof getYouTubeClient>,
  channelId: string,
  channelTitle: string,
  channelThumbnail: string,
  videosPerChannel: number,
  cutoffDate: Date | null
): Promise<z.infer<typeof ChannelVideosSchema>> {
  const uploadsPlaylistId = channelIdToUploadsPlaylistId(channelId);

  const playlistResponse = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults: videosPerChannel
  });

  const items = playlistResponse.data.items || [];
  const videos: z.infer<typeof VideoSchema>[] = [];

  for (const item of items) {
    const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || '';

    if (cutoffDate && new Date(publishedAt) < cutoffDate) {
      continue;
    }

    const videoId = item.contentDetails?.videoId || '';
    const description = item.snippet?.description || '';

    // Try transcript first, fallback to description
    let summaryText = '';
    let summarySource: 'transcript' | 'description' | 'fallback' = 'fallback';

    const transcript = await fetchTranscript(videoId);
    if (transcript) {
      summaryText = await summarize(transcript);
      summarySource = 'transcript';
    } else if (description.length > 20) {
      summaryText = await summarize(description);
      summarySource = 'description';
    }

    if (!summaryText) {
      summaryText = description.substring(0, 200).trim() || 'No summary available.';
      summarySource = 'fallback';
    }

    videos.push({
      videoId,
      title: item.snippet?.title || '',
      description,
      publishedAt,
      channelId: item.snippet?.channelId || channelId,
      channelTitle: item.snippet?.channelTitle || channelTitle,
      thumbnail:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      summary: summaryText,
      summarySource
    });
  }

  return {
    channel: {
      id: channelId,
      title: channelTitle,
      thumbnail: channelThumbnail
    },
    videos
  };
}

/**
 * Get latest videos from all subscribed YouTube channels
 *
 * Uses Google YouTube Data API directly (no Composio).
 * For each video, fetches transcript and generates AI summary.
 *
 * Flow:
 * 1. OAuth2 -> youtube.subscriptions.list(mine=true, paginated)
 * 2. For each channel: fetch uploads, filter by date
 * 3. For each video: fetch transcript -> AI summarize (2 sentences)
 * 4. Optional: send email digest via Gmail API
 *
 * @example
 * ```typescript
 * const result = await getLatestVideos.call({
 *   videosPerChannel: 3,
 *   maxChannels: 10,
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

    const youtube = getYouTubeClient();
    const results: z.infer<typeof ChannelVideosSchema>[] = [];

    // 1. Fetch all subscriptions
    const subscriptions = await fetchAllSubscriptions(youtube);
    logger.info({ subscriptionCount: subscriptions.length }, 'Fetched YouTube subscriptions');

    // 2. Limit channels
    const channelsToProcess = subscriptions.slice(0, input.maxChannels);

    // 3. Calculate cutoff date
    const cutoffDate = input.hoursBack
      ? new Date(Date.now() - input.hoursBack * 60 * 60 * 1000)
      : null;

    // 4. Process each channel
    let processedCount = 0;
    for (const sub of channelsToProcess) {
      processedCount++;
      const channelId = sub.snippet?.resourceId?.channelId || '';
      const channelTitle = sub.snippet?.title || '';
      const channelThumbnail = sub.snippet?.thumbnails?.default?.url || '';

      logger.debug({
        channelTitle,
        progress: `${processedCount}/${channelsToProcess.length}`
      }, 'Processing channel');

      try {
        const channelResult = await processChannel(
          youtube,
          channelId,
          channelTitle,
          channelThumbnail,
          input.videosPerChannel,
          cutoffDate
        );

        if (channelResult.videos.length > 0) {
          results.push(channelResult);
        }
      } catch (error: any) {
        logger.error({ channelTitle, channelId, error: error.message }, 'Error processing channel');
        results.push({
          channel: { id: channelId, title: channelTitle, thumbnail: channelThumbnail },
          videos: [],
          error: error.message
        });
      }
    }

    // 5. Summary stats
    const totalVideos = results.reduce((sum, ch) => sum + ch.videos.length, 0);
    const totalChannels = results.filter(ch => ch.videos.length > 0).length;
    const summary = `Found ${totalVideos} video${totalVideos !== 1 ? 's' : ''} from ${totalChannels} channel${totalChannels !== 1 ? 's' : ''}`;

    logger.info({ totalVideos, totalChannels }, 'Completed YouTube latest videos fetch');

    // 6. Send email if requested
    let emailSent = false;
    if (input.sendEmail && config.gmail.recipientEmail && results.length > 0) {
      try {
        const { formatVideoDigestEmail } = await import('../../utils/email-formatter.js');
        const { sendGmail } = await import('../../utils/gmail-sender.js');

        const { subject, htmlBody } = formatVideoDigestEmail(results);
        await sendGmail(config.gmail.recipientEmail, subject, htmlBody);

        emailSent = true;
        logger.info('Email digest sent successfully');
      } catch (error: any) {
        logger.warn({ error: error.message }, 'Failed to send email digest (non-fatal)');
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
