import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { callComposioTool, extractComposioItems, extractNextPageToken } from '../../utils/composio-client.js';
import { logger } from '../../utils/logger.js';

/**
 * Input schema for getSubscriptions tool
 */
const GetSubscriptionsInputSchema = z.object({
  maxResults: z.number().min(1).max(50).optional().default(50)
    .describe('Maximum subscriptions to fetch per page (pagination handled automatically)')
});

/**
 * YouTube thumbnail schema
 */
const ThumbnailSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional()
});

/**
 * Subscription schema matching YouTube API structure
 */
const SubscriptionSchema = z.object({
  snippet: z.object({
    title: z.string(),
    description: z.string().optional(),
    resourceId: z.object({
      channelId: z.string()
    }),
    thumbnails: z.object({
      default: ThumbnailSchema,
      medium: ThumbnailSchema.optional(),
      high: ThumbnailSchema.optional()
    })
  })
});

/**
 * Output schema for getSubscriptions tool
 */
const GetSubscriptionsOutputSchema = z.object({
  subscriptions: z.array(SubscriptionSchema),
  count: z.number().describe('Total number of subscriptions fetched')
});

/**
 * Get all YouTube subscriptions for authenticated user
 *
 * Fetches all channels the user is subscribed to. Handles pagination
 * automatically to retrieve all subscriptions regardless of count.
 *
 * @example
 * ```typescript
 * const result = await getSubscriptions.call({ maxResults: 50 });
 * console.log(`Found ${result.count} subscriptions`);
 *
 * for (const sub of result.subscriptions) {
 *   const channelId = sub.snippet.resourceId.channelId;
 *   const channelName = sub.snippet.title;
 *   console.log(`${channelName}: ${channelId}`);
 * }
 * ```
 */
export const getSubscriptions = createTool({
  name: 'youtube__get_subscriptions',
  input: GetSubscriptionsInputSchema,
  output: GetSubscriptionsOutputSchema,
  execute: async (input) => {
    const subscriptions: any[] = [];
    let pageToken: string | null = null;
    let pageCount = 0;

    do {
      const params: any = {
        part: 'snippet,contentDetails',
        maxResults: input.maxResults
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      logger.debug({
        tool: 'youtube__get_subscriptions',
        page: pageCount + 1,
        hasPageToken: !!pageToken
      }, 'Fetching subscriptions page');

      const response = await callComposioTool('YOUTUBE_LIST_USER_SUBSCRIPTIONS', params);

      if (!response.successful) {
        throw new Error(response.error || 'Failed to fetch subscriptions');
      }

      // Extract items using helper (handles multiple possible locations)
      const items = extractComposioItems(response);
      const nextToken = extractNextPageToken(response);

      if (items && items.length > 0) {
        subscriptions.push(...items);
        pageCount++;

        logger.debug({
          tool: 'youtube__get_subscriptions',
          page: pageCount,
          fetchedCount: items.length,
          totalCount: subscriptions.length
        }, 'Fetched subscriptions page');
      }

      pageToken = nextToken;

    } while (pageToken);

    logger.info({
      tool: 'youtube__get_subscriptions',
      totalSubscriptions: subscriptions.length,
      pagesProcessed: pageCount
    }, 'Completed fetching all subscriptions');

    return {
      subscriptions,
      count: subscriptions.length
    };
  }
});
