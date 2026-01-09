/**
 * Email Formatter
 *
 * Utilities for formatting video digest emails
 */

import { videoDigestTemplate } from './email-templates.js';

/**
 * Video interface matching getLatestVideos output
 */
export interface Video {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  url: string;
}

/**
 * Channel with videos interface matching getLatestVideos output
 */
export interface ChannelVideos {
  channel: {
    id: string;
    title: string;
    thumbnail: string;
  };
  videos: Video[];
  error?: string;
}

/**
 * Format video digest email from channel videos data
 *
 * Generates HTML email with video summaries organized by channel.
 * Uses the videoDigestTemplate and replaces placeholders with actual data.
 *
 * @param channels - Array of channels with their videos
 * @returns Object with subject line and HTML body
 *
 * @example
 * ```typescript
 * const channels = await getLatestVideos.execute({ maxChannels: 10 });
 * const { subject, htmlBody } = formatVideoDigestEmail(channels.channels);
 *
 * await sendEmail.execute({
 *   recipientEmail: 'user@example.com',
 *   subject,
 *   body: htmlBody,
 *   isHtml: true
 * });
 * ```
 */
export function formatVideoDigestEmail(
  channels: ChannelVideos[]
): { subject: string; htmlBody: string } {
  const totalVideos = channels.reduce((sum, ch) => sum + ch.videos.length, 0);
  const totalChannels = channels.filter(ch => ch.videos.length > 0).length;

  // Generate channels HTML content
  const channelsContent = generateChannelsHtml(channels);

  // Format current date
  const dateStr = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Replace placeholders in template
  const htmlBody = videoDigestTemplate
    .replace('{{TOTAL_VIDEOS}}', totalVideos.toString())
    .replace('{{TOTAL_CHANNELS}}', totalChannels.toString())
    .replace('{{DATE}}', dateStr)
    .replace('{{CHANNELS_CONTENT}}', channelsContent);

  // Generate subject line
  const subject = `📺 ${totalVideos} nowych filmów YouTube - ${new Date().toLocaleDateString('pl-PL')}`;

  return { subject, htmlBody };
}

/**
 * Generate HTML for channels and their videos
 *
 * @param channels - Array of channels with videos
 * @returns HTML string for channels section
 */
function generateChannelsHtml(channels: ChannelVideos[]): string {
  let html = '';

  for (const channelData of channels) {
    // Skip channels with no videos and no error
    if (channelData.videos.length === 0 && !channelData.error) {
      continue;
    }

    html += `        <div class="channel">
            <div class="channel-name">${escapeHtml(channelData.channel.title)}</div>
`;

    // Show error if present
    if (channelData.error) {
      html += `            <p style="color: #cc0000;">❌ Błąd: ${escapeHtml(channelData.error)}</p>
`;
    } else {
      // Generate video items
      for (const video of channelData.videos) {
        const date = new Date(video.publishedAt);
        const dateStr = date.toLocaleDateString('pl-PL', {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        });

        html += `            <div class="video">
                <a href="${escapeHtml(video.url)}" class="video-title">${escapeHtml(video.title)}</a><br>
                <span class="video-date">📅 ${dateStr}</span>
            </div>
`;
      }
    }

    html += `        </div>
`;
  }

  return html;
}

/**
 * Escape HTML special characters
 *
 * Prevents XSS attacks by escaping user-provided content in HTML.
 *
 * @param text - Text to escape
 * @returns Escaped text safe for HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
