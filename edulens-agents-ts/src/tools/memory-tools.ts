/**
 * Shared tool: memory retrieval (mock version).
 * In production, replace with real AgentCore Memory SDK calls.
 *
 * Namespace conventions:
 *   /students/{studentId}/learning/   — student learning data + Learning DNA
 *   /families/{familyId}/insights/    — parent-side insights + preferences
 */

import { tool } from '@strands-agents/sdk';
import { MOCK_MEMORY_RECORDS } from './mock-data.js';
import type { MemoryMetadata, MemoryRecord } from '../shared/types.js';

/** Build the canonical student learning namespace. */
export function studentNamespace(studentId: string): string {
  return `/students/${studentId}/learning/`;
}

/** Build the canonical family insights namespace. */
export function familyNamespace(familyId: string): string {
  return `/families/${familyId}/insights/`;
}

/**
 * Filter memory records by metadata fields.
 * Only non-undefined filter values are matched.
 */
export function filterByMetadata(
  records: MemoryRecord[],
  filters: Partial<MemoryMetadata>,
): MemoryRecord[] {
  return records.filter(record => {
    const meta = record.metadata;
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && meta[key] !== value) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Search past conversation memories for relevant context.
 * Returns long-term memory records matching the query.
 * Supports namespace filtering (/students/{id}/learning/, /families/{id}/insights/)
 * and optional metadata filtering (stage, subject, skill, etc.).
 */
export function retrieveMemories(
  query: string,
  namespace = '',
  maxResults = 5,
  metadataFilters?: Partial<MemoryMetadata>,
): string {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);

  let candidates = MOCK_MEMORY_RECORDS as MemoryRecord[];

  // Namespace filter
  if (namespace) {
    candidates = candidates.filter(r => r.namespace === namespace);
  }

  // Metadata filter
  if (metadataFilters) {
    candidates = filterByMetadata(candidates, metadataFilters);
  }

  const scored = [];

  for (const record of candidates) {
    const contentLower = record.content.toLowerCase();
    const matchCount = words.filter(w => contentLower.includes(w)).length;
    const score = words.length > 0 ? matchCount / words.length : 0;

    if (score > 0) {
      scored.push({
        content: record.content,
        relevance: score.toFixed(2),
        namespace: record.namespace,
        metadata: record.metadata,
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
  description: 'Search past conversation memories for relevant context. Returns long-term memory records matching the query. Supports namespace and metadata filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for memory retrieval.',
      },
      namespace: {
        type: 'string',
        description: 'Namespace filter. Use /students/{studentId}/learning/ for student data or /families/{familyId}/insights/ for family data.',
        default: '',
      },
      maxResults: {
        type: 'number',
        description: 'Max results to return (default 5).',
        default: 5,
      },
      stage: {
        type: 'string',
        description: 'Filter by stage: "oc_prep" or "selective_prep".',
        enum: ['oc_prep', 'selective_prep'],
      },
      subject: {
        type: 'string',
        description: 'Filter by subject: "reading", "math", "thinking", or "writing".',
        enum: ['reading', 'math', 'thinking', 'writing'],
      },
      skill: {
        type: 'string',
        description: 'Filter by specific sub-skill (e.g. "inference", "spatial_reasoning").',
      },
    },
    required: ['query'],
  },
  callback: (input: any) => {
    const metadataFilters: Partial<MemoryMetadata> = {};
    if (input.stage) metadataFilters.stage = input.stage;
    if (input.subject) metadataFilters.subject = input.subject;
    if (input.skill) metadataFilters.skill = input.skill;
    const hasFilters = Object.keys(metadataFilters).length > 0;
    return retrieveMemories(
      input.query,
      input.namespace,
      input.maxResults,
      hasFilters ? metadataFilters : undefined,
    );
  },
});