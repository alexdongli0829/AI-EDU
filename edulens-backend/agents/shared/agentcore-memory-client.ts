/**
 * AgentCore Memory Client — Production implementation using AWS SDK
 *
 * Wraps @aws-sdk/client-bedrock-agentcore for:
 *   - CreateEvent (short-term session memory)
 *   - ListEvents (session replay)
 *   - RetrieveMemoryRecords (semantic search long-term memory)
 */

import {
  BedrockAgentCoreClient,
  CreateEventCommand,
  ListEventsCommand,
  RetrieveMemoryRecordsCommand,
} from '@aws-sdk/client-bedrock-agentcore';

const client = new BedrockAgentCoreClient({
  region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-west-2',
});

const MEMORY_ID = process.env.MEMORY_ID;

if (!MEMORY_ID) {
  console.warn('WARNING: MEMORY_ID environment variable not set. Memory operations will fail.');
}

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface MemoryEvent {
  eventId: string;
  sessionId: string;
  actorId: string;
  actorType: 'user' | 'agent';
  content: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface MemoryRecord {
  recordId: string;
  content: string;
  score: number;
  namespace: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

// -------------------------------------------------------------------------
// CreateEvent — write a conversation turn to short-term memory
// -------------------------------------------------------------------------

export async function createEvent(input: {
  sessionId: string;
  actorId: string;
  actorType: 'user' | 'agent';
  content: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  if (!MEMORY_ID) throw new Error('MEMORY_ID not configured');

  await client.send(new CreateEventCommand({
    memoryId: MEMORY_ID,
    sessionId: input.sessionId,
    actorId: input.actorId,
    actorType: input.actorType,
    content: { text: input.content },
    ...(input.metadata && {
      eventAttributes: Object.entries(input.metadata).map(([key, value]) => ({
        key,
        value,
      })),
    }),
  }));
}

// -------------------------------------------------------------------------
// ListEvents — retrieve session events
// -------------------------------------------------------------------------

export async function listEvents(input: {
  sessionId: string;
  limit?: number;
}): Promise<MemoryEvent[]> {
  if (!MEMORY_ID) throw new Error('MEMORY_ID not configured');

  const response = await client.send(new ListEventsCommand({
    memoryId: MEMORY_ID,
    sessionId: input.sessionId,
    maxResults: input.limit ?? 50,
  }));

  return (response.events ?? []).map((e) => ({
    eventId: e.eventId ?? '',
    sessionId: input.sessionId,
    actorId: e.actorId ?? '',
    actorType: (e.actorType as 'user' | 'agent') ?? 'user',
    content: e.content?.text ?? '',
    timestamp: e.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

// -------------------------------------------------------------------------
// RetrieveMemoryRecords — semantic search long-term memory
// -------------------------------------------------------------------------

export async function retrieveMemoryRecords(input: {
  query: string;
  namespace?: string;
  maxResults?: number;
}): Promise<MemoryRecord[]> {
  if (!MEMORY_ID) throw new Error('MEMORY_ID not configured');

  const response = await client.send(new RetrieveMemoryRecordsCommand({
    memoryId: MEMORY_ID,
    query: { text: input.query },
    maxResults: input.maxResults ?? 5,
    ...(input.namespace && {
      filter: {
        namespace: input.namespace,
      },
    }),
  }));

  return (response.memoryRecords ?? []).map((r) => ({
    recordId: r.memoryRecordId ?? '',
    content: r.content?.text ?? '',
    score: r.score ?? 0,
    namespace: r.namespace ?? '',
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}
