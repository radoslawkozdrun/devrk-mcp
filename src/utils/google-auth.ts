/**
 * Google OAuth2 Client
 *
 * Shared authentication for YouTube Data API and Gmail API.
 * Uses OAuth2 with refresh token flow.
 */

import { google } from 'googleapis';
import { config } from '../config.js';
import { logger } from './logger.js';

let oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null;

/**
 * Get or create a shared OAuth2 client
 *
 * Uses GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN
 * from environment variables.
 *
 * @returns Configured OAuth2 client with credentials set
 * @throws Error if required Google credentials are missing
 */
export function getOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
  if (oauth2Client) {
    return oauth2Client;
  }

  if (!config.google.clientId || !config.google.clientSecret || !config.google.refreshToken) {
    throw new Error(
      'Missing Google OAuth2 credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.'
    );
  }

  oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: config.google.refreshToken
  });

  logger.debug('Google OAuth2 client initialized');

  return oauth2Client;
}

/**
 * Get authenticated YouTube Data API client
 *
 * @returns youtube v3 API client
 */
export function getYouTubeClient() {
  const auth = getOAuth2Client();
  return google.youtube({ version: 'v3', auth });
}

/**
 * Get authenticated Gmail API client
 *
 * @returns gmail v1 API client
 */
export function getGmailClient() {
  const auth = getOAuth2Client();
  return google.gmail({ version: 'v1', auth });
}
