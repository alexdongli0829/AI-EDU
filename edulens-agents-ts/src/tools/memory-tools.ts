/**
 * Shared tool: memory retrieval (mock version).
 * In production, replace with real AgentCore Memory SDK calls.
 */

import { tool } from '@strands-agents/sdk';
import { MOCK_MEMORY_RECORDS } from './mock-data.js';

/**
 * Search past conversation memories for relevant context.
 * Returns long-term memory records matching the query.
 */
export function retrieveMemories(query: string, namespace = '', maxResults = 5): string {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);

  const scored = [];

  for (const record of MOCK_MEMORY_RECORDS) {
    if (namespace && record.namespace !== namespace) {
      continue;
    }

    const contentLower = record.content.toLowerCase();
    const matchCount = words.filter(w => contentLower.includes(w)).length;
    const score = words.length > 0 ? matchCount / words.length : 0;

    if (score > 0) {
      scored.push({
        content: record.content,
        relevance: score.toFixed(2),
        namespace: record.namespace,
      });
    }
  }

  scored.sort((a, b) => parseFloat(b.relevance) - parseFloat(a.relevance));

  return JSON.stringify({
    query,
    resultCount: Math.min(scored.length, maxResults),
    records: scored.slice(0, maxResults),
  }, null, 2);
}

// Tool definition using Strands SDK tool() factory
export const retrieveMemoriesTool = tool({
  name: 'retrieve_memories',
  description: 'Search past conversation memories for relevant context. Returns long-term memory records matching the query.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for memory retrieval.',
      },
      namespace: {
        type: 'string',
        description: 'Optional namespace filter (e.g. "parent-conversations", "tutoring-sessions").',
        default: '',
      },
      maxResults: {
        type: 'number',
        description: 'Max results to return (default 5).',
        default: 5,
      },
    },
    required: ['query'],
  },
  callback: (input: any) => retrieveMemories(input.query, input.namespace, input.maxResults),
});