/**
 * Gmail Sender Utility
 *
 * Internal utility for sending emails via Gmail API.
 * Uses shared Google OAuth2 client from google-auth.ts.
 */

import { getGmailClient } from './google-auth.js';
import { logger } from './logger.js';

/**
 * Send an email via Gmail API
 *
 * Builds an RFC 2822 MIME message and sends it through
 * the authenticated Gmail account.
 *
 * @param to - Recipient email address
 * @param subject - Email subject
 * @param htmlBody - HTML email body
 * @returns Message ID from Gmail API
 */
export async function sendGmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<string> {
  const gmail = getGmailClient();

  // Build RFC 2822 MIME message
  const messageParts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64')
  ];

  const rawMessage = messageParts.join('\r\n');

  // Base64url encode the full message
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  logger.debug({ to, subject }, 'Sending email via Gmail API');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  });

  const messageId = response.data.id || 'unknown';
  logger.info({ messageId, to }, 'Email sent successfully');

  return messageId;
}
