import type { ServerMetadata } from '../types/index.js';

/**
 * Server Registry
 *
 * This file acts as a central registry for all available tool servers.
 * Each server is a collection of related tools organized in its own directory.
 *
 * To add a new server:
 * 1. Create a directory under src/servers/{server-name}/
 * 2. Implement tools as separate files
 * 3. Export them through the server's index.ts
 * 4. Register the server metadata here
 *
 * Example server structure:
 * src/servers/
 * ├── example-server/
 * │   ├── toolA.ts
 * │   ├── toolB.ts
 * │   └── index.ts (exports * from './toolA'; exports * from './toolB';)
 */

/**
 * Registry of all available servers
 * Add new server metadata here as you create new tool modules
 */
export const serverRegistry: ServerMetadata[] = [
  {
    name: 'example',
    description: 'Example tool server demonstrating the MCP architecture',
    version: '1.0.0',
    tools: ['greet']
  },
  {
    name: 'youtube',
    description: 'YouTube integration via Composio - subscriptions, playlists, latest videos',
    version: '1.0.0',
    tools: ['getSubscriptions', 'getPlaylistItems', 'getLatestVideos']
  },
  {
    name: 'gmail',
    description: 'Gmail integration via Composio - send emails',
    version: '1.0.0',
    tools: ['sendEmail']
  }
];

/**
 * Get metadata for all registered servers
 */
export function getAllServers(): ServerMetadata[] {
  return serverRegistry;
}

/**
 * Get metadata for a specific server by name
 */
export function getServer(name: string): ServerMetadata | undefined {
  return serverRegistry.find(server => server.name === name);
}
