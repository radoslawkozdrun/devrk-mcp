import type { ServerMetadata } from '../types/index.js';

/**
 * Server Registry
 *
 * Central registry for all available tool servers.
 * Each server is a collection of related tools organized in its own directory.
 */

/**
 * Registry of all available servers
 */
export const serverRegistry: ServerMetadata[] = [
  {
    name: 'youtube',
    description: 'YouTube integration via Google API - latest videos with AI summaries and transcripts',
    version: '2.0.0',
    tools: ['getLatestVideos']
  },
  {
    name: 'qdrant-rag',
    description: 'Qdrant RAG - semantic search and knowledge base operations',
    version: '1.0.0',
    tools: ['search', 'listCollections']
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
