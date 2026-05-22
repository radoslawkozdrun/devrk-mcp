import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { logger } from '../../utils/logger.js';
import { graphGet, type GraphApiResponse } from './client.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const FetchPostsInputSchema = z.object({
  daysBack: z.number().int().min(1).max(365).default(7)
    .describe('Fetch posts from the last N days'),
  maxPosts: z.number().int().min(1).max(200).default(50)
    .describe('Maximum number of posts to return'),
  includeReplies: z.boolean().default(true)
    .describe('Include replies (sub-comments) for each top-level comment'),
  maxCommentsPerPost: z.number().int().min(1).max(500).default(100)
    .describe('Maximum comments to fetch per post'),
  maxRepliesPerComment: z.number().int().min(1).max(100).default(25)
    .describe('Maximum replies to fetch per top-level comment (only when includeReplies=true)')
});

const PersonSchema = z.object({
  id: z.string(),
  name: z.string()
});

const ReplySchema = z.object({
  id: z.string(),
  message: z.string(),
  from: PersonSchema.nullable(),
  createdTime: z.string().describe('ISO 8601 timestamp'),
  likeCount: z.number()
});

const CommentSchema = z.object({
  id: z.string(),
  message: z.string(),
  from: PersonSchema.nullable(),
  createdTime: z.string().describe('ISO 8601 timestamp'),
  likeCount: z.number(),
  replies: z.array(ReplySchema).describe('Direct replies to this comment')
});

const PostSchema = z.object({
  id: z.string(),
  message: z.string().nullable().describe('Text content of the post'),
  story: z.string().nullable().describe('Auto-generated story text (e.g. "X shared a link")'),
  createdTime: z.string().describe('ISO 8601 timestamp'),
  type: z.string().nullable().describe('Post type: status, photo, video, link, etc.'),
  permalinkUrl: z.string().nullable().describe('Direct URL to the post on Facebook'),
  fullPicture: z.string().nullable().describe('URL of the attached image (if any)'),
  comments: z.array(CommentSchema),
  commentCount: z.number().describe('Total number of top-level comments')
});

const FetchPostsOutputSchema = z.object({
  posts: z.array(PostSchema),
  totalPosts: z.number(),
  totalComments: z.number(),
  periodDays: z.number(),
  summary: z.string()
});

// ---------------------------------------------------------------------------
// Graph API raw types
// ---------------------------------------------------------------------------

interface RawFrom { id: string; name: string }

interface RawReply {
  id: string;
  message: string;
  from?: RawFrom;
  created_time: string;
  like_count?: number;
}

interface RawComment {
  id: string;
  message: string;
  from?: RawFrom;
  created_time: string;
  like_count?: number;
  comments?: { data: RawReply[]; summary?: { total_count: number } };
}

interface RawPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  type?: string;
  permalink_url?: string;
  full_picture?: string;
  comments?: { data: RawComment[]; summary?: { total_count: number } };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPostFields(maxComments: number, maxReplies: number, includeReplies: boolean): string {
  const replyFields = includeReplies
    ? `,comments.limit(${maxReplies}){id,message,from{id,name},created_time,like_count}`
    : '';

  const commentFields =
    `comments.limit(${maxComments}){id,message,from{id,name},created_time,like_count${replyFields},summary(true)}`;

  return [
    'id',
    'message',
    'story',
    'created_time',
    'type',
    'permalink_url',
    'full_picture',
    commentFields
  ].join(',');
}

function mapReply(r: RawReply): z.infer<typeof ReplySchema> {
  return {
    id: r.id,
    message: r.message ?? '',
    from: r.from ? { id: r.from.id, name: r.from.name } : null,
    createdTime: r.created_time,
    likeCount: r.like_count ?? 0
  };
}

function mapComment(c: RawComment): z.infer<typeof CommentSchema> {
  return {
    id: c.id,
    message: c.message ?? '',
    from: c.from ? { id: c.from.id, name: c.from.name } : null,
    createdTime: c.created_time,
    likeCount: c.like_count ?? 0,
    replies: (c.comments?.data ?? []).map(mapReply)
  };
}

function mapPost(p: RawPost): z.infer<typeof PostSchema> {
  const comments = (p.comments?.data ?? []).map(mapComment);
  const commentCount = p.comments?.summary?.total_count ?? comments.length;
  return {
    id: p.id,
    message: p.message ?? null,
    story: p.story ?? null,
    createdTime: p.created_time,
    type: p.type ?? null,
    permalinkUrl: p.permalink_url ?? null,
    fullPicture: p.full_picture ?? null,
    comments,
    commentCount
  };
}

async function fetchAllPosts(
  since: number,
  maxPosts: number,
  fields: string
): Promise<RawPost[]> {
  const collected: RawPost[] = [];
  let after: string | undefined;

  do {
    const params: Record<string, string> = {
      fields,
      since: String(since),
      limit: String(Math.min(100, maxPosts - collected.length))
    };
    if (after) params['after'] = after;

    const page = await graphGet<GraphApiResponse<RawPost>>('/me/posts', params);
    collected.push(...(page.data ?? []));

    after = page.paging?.cursors?.after;

    if (!page.paging?.next) break;
  } while (collected.length < maxPosts);

  return collected.slice(0, maxPosts);
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

/**
 * Fetch posts published by the authenticated user within the last N days,
 * including all comments and (optionally) replies under each post.
 *
 * Requires a Facebook User Access Token with the `user_posts` permission
 * configured via FACEBOOK_ACCESS_TOKEN environment variable.
 *
 * Flow:
 * 1. Calculate `since` unix timestamp from daysBack
 * 2. GET /me/posts with nested comments/replies fields (paginated)
 * 3. Map raw Graph API shapes to typed output
 *
 * @example
 * ```typescript
 * const result = await fetchPostsWithComments.call({
 *   daysBack: 14,
 *   maxPosts: 30,
 *   includeReplies: true
 * });
 * ```
 */
export const fetchPostsWithComments = createTool({
  name: 'facebook__fetch_posts_with_comments',
  input: FetchPostsInputSchema,
  output: FetchPostsOutputSchema,
  execute: async (input) => {
    const sinceTs = Math.floor((Date.now() - input.daysBack * 24 * 60 * 60 * 1000) / 1000);

    logger.info({
      daysBack: input.daysBack,
      maxPosts: input.maxPosts,
      since: new Date(sinceTs * 1000).toISOString(),
      includeReplies: input.includeReplies
    }, 'Fetching Facebook posts with comments');

    const fields = buildPostFields(
      input.maxCommentsPerPost,
      input.maxRepliesPerComment,
      input.includeReplies
    );

    const rawPosts = await fetchAllPosts(sinceTs, input.maxPosts, fields);

    logger.info({ count: rawPosts.length }, 'Raw posts fetched from Graph API');

    const posts = rawPosts.map(mapPost);
    const totalComments = posts.reduce((sum, p) => sum + p.comments.length, 0);

    logger.info({ totalPosts: posts.length, totalComments }, 'Facebook posts mapping complete');

    const summary =
      `Fetched ${posts.length} post${posts.length !== 1 ? 's' : ''} ` +
      `from the last ${input.daysBack} day${input.daysBack !== 1 ? 's' : ''} ` +
      `with ${totalComments} top-level comment${totalComments !== 1 ? 's' : ''} total.`;

    return {
      posts,
      totalPosts: posts.length,
      totalComments,
      periodDays: input.daysBack,
      summary
    };
  }
});
