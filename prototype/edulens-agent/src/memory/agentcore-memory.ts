// AgentCore Memory wrapper — in-memory mock that simulates
// CreateEvent, ListEvents, and RetrieveMemoryRecords.
// Replace internals with real @aws-sdk/client-bedrock-agentcore calls when ready.

export interface MemoryEvent {
  eventId: string;
  sessionId: string;
  actorId: string;
  actorType: "user" | "agent";
  content: string;
  timestamp: string;
  metadata?: Record<string, string> | undefined;
}

export interface MemoryRecord {
  recordId: string;
  content: string;
  score: number; // relevance score 0-1
  namespace: string;
  createdAt: string;
  metadata?: Record<string, string> | undefined;
}

export interface CreateEventInput {
  sessionId: string;
  actorId: string;
  actorType: "user" | "agent";
  content: string;
  metadata?: Record<string, string> | undefined;
}

export interface ListEventsInput {
  sessionId: string;
  limit?: number | undefined;
}

export interface RetrieveMemoryInput {
  query: string;
  namespace?: string | undefined;
  maxResults?: number | undefined;
}

let nextEventId = 1;
let nextRecordId = 1;

export class AgentCoreMemory {
  private events: MemoryEvent[] = [];
  private records: MemoryRecord[] = [];
  private memoryStoreId: string;

  constructor(memoryStoreId = "mock-memory-store") {
    this.memoryStoreId = memoryStoreId;
    this.seedMockRecords();
  }

  getMemoryStoreId(): string {
    return this.memoryStoreId;
  }

  // -------------------------------------------------------------------------
  // CreateEvent — short-term session memory
  // -------------------------------------------------------------------------
  async createEvent(input: CreateEventInput): Promise<MemoryEvent> {
    const event: MemoryEvent = {
      eventId: `evt-${String(nextEventId++).padStart(4, "0")}`,
      sessionId: input.sessionId,
      actorId: input.actorId,
      actorType: input.actorType,
      content: input.content,
      timestamp: new Date().toISOString(),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    };
    this.events.push(event);
    return event;
  }

  // -------------------------------------------------------------------------
  // ListEvents — retrieve session events
  // -------------------------------------------------------------------------
  async listEvents(input: ListEventsInput): Promise<MemoryEvent[]> {
    const sessionEvents = this.events.filter(
      (e) => e.sessionId === input.sessionId,
    );
    const limit = input.limit ?? 50;
    return sessionEvents.slice(-limit);
  }

  // -------------------------------------------------------------------------
  // RetrieveMemoryRecords — semantic search over long-term memory
  // -------------------------------------------------------------------------
  async retrieveMemoryRecords(
    input: RetrieveMemoryInput,
  ): Promise<MemoryRecord[]> {
    const maxResults = input.maxResults ?? 5;
    const query = input.query.toLowerCase();

    // Simple keyword-matching relevance simulation
    const scored = this.records
      .filter((r) => !input.namespace || r.namespace === input.namespace)
      .map((r) => {
        const words = query.split(/\s+/);
        const contentLower = r.content.toLowerCase();
        const matchCount = words.filter((w) => contentLower.includes(w)).length;
        const score = words.length > 0 ? matchCount / words.length : 0;
        return { ...r, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored;
  }

  // -------------------------------------------------------------------------
  // Add a long-term memory record (admin / background job would do this)
  // -------------------------------------------------------------------------
  async addRecord(
    content: string,
    namespace: string,
    metadata?: Record<string, string> | undefined,
  ): Promise<MemoryRecord> {
    const record: MemoryRecord = {
      recordId: `rec-${String(nextRecordId++).padStart(4, "0")}`,
      content,
      score: 1.0,
      namespace,
      createdAt: new Date().toISOString(),
      ...(metadata !== undefined ? { metadata } : {}),
    };
    this.records.push(record);
    return record;
  }

  // -------------------------------------------------------------------------
  // Seed with realistic mock long-term memories for Mia
  // -------------------------------------------------------------------------
  private seedMockRecords(): void {
    const seeds: Array<{
      content: string;
      namespace: string;
      metadata: Record<string, string>;
    }> = [
      {
        content:
          "Mia's parent asked about math performance on 2026-02-15. " +
          "Advisor noted number patterns were weakest area at 42% mastery. " +
          "Recommended daily 10-minute pattern drills.",
        namespace: "parent-conversations",
        metadata: { studentId: "mock-student-001", subject: "math" },
      },
      {
        content:
          "Mia struggled with multiplication-based patterns during tutoring " +
          "on 2026-02-20. She initially confused ×2 with ×3 patterns but " +
          "self-corrected after guided questioning.",
        namespace: "tutoring-sessions",
        metadata: { studentId: "mock-student-001", skill: "number_patterns" },
      },
      {
        content:
          "Mia showed strong reading comprehension during test 3, scoring " +
          "9/10 on inference questions. Her vocabulary skills are above " +
          "grade level.",
        namespace: "parent-conversations",
        metadata: { studentId: "mock-student-001", subject: "reading" },
      },
      {
        content:
          "Time management concern raised by parent on 2026-03-01. Mia " +
          "tends to rush through early questions and slow down at the end. " +
          "Advisor suggested pacing strategy: 1 minute per question.",
        namespace: "parent-conversations",
        metadata: { studentId: "mock-student-001", topic: "time_management" },
      },
      {
        content:
          "During spatial reasoning tutoring, Mia had difficulty rotating " +
          "shapes mentally. She benefited from drawing the rotations step " +
          "by step on paper.",
        namespace: "tutoring-sessions",
        metadata: { studentId: "mock-student-001", skill: "spatial" },
      },
    ];

    for (const s of seeds) {
      this.records.push({
        recordId: `rec-${String(nextRecordId++).padStart(4, "0")}`,
        content: s.content,
        score: 1.0,
        namespace: s.namespace,
        createdAt: new Date().toISOString(),
        metadata: s.metadata,
      });
    }
  }
}
