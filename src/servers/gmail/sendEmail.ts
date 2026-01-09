import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';
import { callComposioTool } from '../../utils/composio-client.js';
import { logger } from '../../utils/logger.js';
import { ToolError } from '../../types/index.js';

/**
 * Input schema for sendEmail tool
 */
const SendEmailInputSchema = z.object({
  recipientEmail: z.string().email()
    .describe('Recipient email address'),
  subject: z.string().min(1)
    .describe('Email subject line'),
  body: z.string().min(1)
    .describe('Email body content (can be plain text or HTML)'),
  isHtml: z.boolean().optional().default(false)
    .describe('Whether body content is HTML'),
  cc: z.array(z.string().email()).optional()
    .describe('CC recipients (optional)'),
  bcc: z.array(z.string().email()).optional()
    .describe('BCC recipients (optional)')
});

/**
 * Output schema for sendEmail tool
 */
const SendEmailOutputSchema = z.object({
  successful: z.boolean(),
  messageId: z.string().optional()
    .describe('Gmail message ID if successful'),
  message: z.string()
});

/**
 * Send email via Gmail
 *
 * Sends email through authenticated Gmail account using Composio API.
 * Supports both plain text and HTML content, with optional CC/BCC.
 *
 * @example
 * ```typescript
 * // Send plain text email
 * const result = await sendEmail.call({
 *   recipientEmail: 'user@example.com',
 *   subject: 'Test Email',
 *   body: 'Hello from MCP Server!'
 * });
 *
 * if (result.successful) {
 *   console.log('Email sent:', result.messageId);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Send HTML email
 * const result = await sendEmail.call({
 *   recipientEmail: 'user@example.com',
 *   subject: 'Newsletter',
 *   body: '<h1>Welcome!</h1><p>Thanks for subscribing.</p>',
 *   isHtml: true
 * });
 * ```
 */
export const sendEmail = createTool({
  name: 'gmail__send_email',
  input: SendEmailInputSchema,
  output: SendEmailOutputSchema,
  execute: async (input) => {
    // Log email send (redacted by pino config)
    logger.debug({
      tool: 'gmail__send_email',
      recipientDomain: input.recipientEmail.split('@')[1],
      isHtml: input.isHtml,
      hasCC: !!input.cc?.length,
      hasBCC: !!input.bcc?.length
    }, 'Sending email via Gmail');

    try {
      // Convert camelCase input to snake_case for Composio API
      const response = await callComposioTool('GMAIL_SEND_EMAIL', {
        recipient_email: input.recipientEmail,
        subject: input.subject,
        body: input.body,
        is_html: input.isHtml,
        cc: input.cc || [],
        bcc: input.bcc || []
      });

      if (response.successful) {
        logger.info({
          tool: 'gmail__send_email',
          recipientDomain: input.recipientEmail.split('@')[1]
        }, 'Email sent successfully');

        return {
          successful: true,
          messageId: response.data?.messageId || response.data?.id,
          message: 'Email sent successfully'
        };
      } else {
        throw new ToolError(
          'gmail__send_email',
          response.error || 'Failed to send email',
          undefined,
          true // retryable - could be temporary
        );
      }

    } catch (error: any) {
      // If it's already a ToolError, rethrow
      if (error.name === 'ToolError') {
        throw error;
      }

      // Wrap other errors
      logger.error({
        tool: 'gmail__send_email',
        error: error.message
      }, 'Error sending email');

      throw new ToolError(
        'gmail__send_email',
        `Failed to send email: ${error.message}`,
        error,
        true // retryable
      );
    }
  }
});
