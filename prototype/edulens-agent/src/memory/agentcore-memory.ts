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
  // Seed with realistic mock long-term memories
  // Includes: Mia (legacy), Family Wang (Emily + Lucas), Family Chen (Sophie)
  // -------------------------------------------------------------------------
  private seedMockRecords(): void {
    const seeds: Array<{
      content: string;
      namespace: string;
      metadata: Record<string, string>;
    }> = [
      // --- Mia (legacy single-student) ---
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

      // --- Family Wang: Emily (oc_prep, Grade 4) ---
      {
        content:
          "Emily scored 72% on OC Reading Test 1 (10/14 correct). " +
          "Inference questions were weakest — 3/6 correct. " +
          "Vocabulary and literal comprehension strong.",
        namespace: "/students/stu_emily/learning/",
        metadata: {
          studentId: "stu_emily",
          stage: "oc_prep",
          subject: "reading",
          skill: "inference",
        },
      },
      {
        content:
          "Emily scored 65% on OC Math Test 1 (23/35 correct). " +
          "Careless errors in 40% of wrong answers — rushing through early items. " +
          "Number patterns weakest area at 50% accuracy.",
        namespace: "/students/stu_emily/learning/",
        metadata: {
          studentId: "stu_emily",
          stage: "oc_prep",
          subject: "math",
          skill: "number_patterns",
          error_type: "careless",
        },
      },
      {
        content:
          "Emily scored 58% on OC Thinking Skills Test 1 (17/30 correct). " +
          "Spatial reasoning strongest sub-skill (7/8). " +
          "Abstract patterns and sequences need work.",
        namespace: "/students/stu_emily/learning/",
        metadata: {
          studentId: "stu_emily",
          stage: "oc_prep",
          subject: "thinking_skills",
          skill: "abstract_patterns",
        },
      },
      {
        content:
          "Emily's reading improved to 78% on OC Reading Test 2 (11/14). " +
          "Inference improved from 3/6 to 5/6 after targeted practice.",
        namespace: "/students/stu_emily/learning/",
        metadata: {
          studentId: "stu_emily",
          stage: "oc_prep",
          subject: "reading",
          skill: "inference",
        },
      },
      {
        content:
          "Parent Wang discussed Emily's careless errors in math on 2026-04-01. " +
          "40% error rate from rushing. Advisor suggested pacing strategy.",
        namespace: "/families/fam_wang/insights/",
        metadata: {
          studentId: "stu_emily",
          stage: "oc_prep",
          subject: "math",
          error_type: "careless",
        },
      },

      // --- Family Wang: Lucas (selective_prep, Grade 6) ---
      {
        content:
          "Lucas scored 82% on Selective Reading Test (including Writing component). " +
          "Strong analytical reading; persuasive writing needs more structured arguments.",
        namespace: "/students/stu_lucas/learning/",
        metadata: {
          studentId: "stu_lucas",
          stage: "selective_prep",
          subject: "reading",
          skill: "analytical_reading",
        },
      },
      {
        content:
          "Lucas scored 75% on Selective Math Test. " +
          "Algebra and problem-solving strong. " +
          "Geometry proofs need more practice — missed 4/6 proof questions.",
        namespace: "/students/stu_lucas/learning/",
        metadata: {
          studentId: "stu_lucas",
          stage: "selective_prep",
          subject: "math",
          skill: "geometry_proofs",
        },
      },
      {
        content:
          "Parent Wang asked about both children's overall progress. " +
          "Emily improving in reading, math careless errors persist. " +
          "Lucas performing well but needs geometry focus.",
        namespace: "/families/fam_wang/insights/",
        metadata: { stage: "mixed" },
      },

      // --- Family Chen: Sophie (oc_prep, Grade 4) ---
      {
        content:
          "Sophie scored 88% on OC Reading Test — top of her cohort. " +
          "Strong across all sub-skills. Vocabulary exceptionally advanced.",
        namespace: "/students/stu_sophie/learning/",
        metadata: {
          studentId: "stu_sophie",
          stage: "oc_prep",
          subject: "reading",
        },
      },
      {
        content:
          "Sophie's OC Math performance at 70%. " +
          "Conceptual understanding good but speed needs improvement. " +
          "Time management is main area for growth.",
        namespace: "/students/stu_sophie/learning/",
        metadata: {
          studentId: "stu_sophie",
          stage: "oc_prep",
          subject: "math",
          error_type: "slow_pace",
        },
      },
      {
        content:
          "Parent Chen discussed Sophie's preparation timeline. " +
          "OC test in 6 weeks. Focus on math speed and thinking skills.",
        namespace: "/families/fam_chen/insights/",
        metadata: {
          studentId: "stu_sophie",
          stage: "oc_prep",
        },
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
