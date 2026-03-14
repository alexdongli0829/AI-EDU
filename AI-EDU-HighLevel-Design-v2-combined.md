## 4. Multi-Turn Conversation Architecture (NEW)

The v1 design treated each AI response as stateless — assemble context, call Claude, return. This section defines a full conversation memory system that enables natural, multi-turn dialogue across sessions, manages the finite context window efficiently, handles topic switching gracefully, and delivers responses via streaming for a responsive UX.

### Design Principles

1. **Memory is tiered** — Not all conversation data has equal value or cost. Recent turns are kept verbatim; older turns are compressed to summaries; key insights are promoted to the student profile permanently.
2. **Context is budgeted** — Every token in the context window competes for space. System prompts, profile data, and conversation history each have explicit budgets.
3. **Sessions are persistent** — Closing a browser tab does not destroy a conversation. Parents can resume days later.
4. **Streaming is mandatory** — Every AI response is delivered token-by-token via SSE. No blank screens.

---

### 4.1 Conversation Memory Layer

Conversation memory operates across three tiers, each with distinct storage, lifespan, and retrieval characteristics.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Tier Architecture                     │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │   SHORT-TERM    │   │   MEDIUM-TERM    │   │  LONG-TERM   │ │
│  │                 │   │                  │   │              │ │
│  │ Full message    │   │ Conversation     │   │ Extracted    │ │
│  │ history for     │   │ summaries in     │   │ insights in  │ │
│  │ current session │   │ PostgreSQL       │   │ Learning DNA │ │
│  │                 │   │                  │   │              │ │
│  │ Storage:        │   │ Storage:         │   │ Storage:     │ │
│  │  In-memory +    │   │  conversation_   │   │  student_    │ │
│  │  DB messages    │   │  memory table    │   │  profile     │ │
│  │  table          │   │                  │   │  (JSONB)     │ │
│  │                 │   │                  │   │              │ │
│  │ Lifespan:       │   │ Lifespan:        │   │ Lifespan:    │ │
│  │  Current        │   │  90 days         │   │  Permanent   │ │
│  │  session        │   │  (configurable)  │   │              │ │
│  │                 │   │                  │   │              │ │
│  │ Token cost:     │   │ Token cost:      │   │ Token cost:  │ │
│  │  ~200-500/turn  │   │  ~100-200/       │   │  0 (already  │ │
│  │  (full text)    │   │  conversation    │   │  in profile) │ │
│  └────────┬────────┘   └────────┬─────────┘   └──────┬───────┘ │
│           │                     │                     │         │
│           ▼                     ▼                     ▼         │
│    Context window        Injected as           Already part     │
│    (last N turns)        "Previous sessions"   of profile       │
│                          preamble              data block       │
└─────────────────────────────────────────────────────────────────┘
```

#### Tier 1: Short-Term Memory (Current Session)

Every message in the active conversation is stored verbatim in the `chat_messages` table and loaded into the context window.

**Schema: `chat_messages`**

```sql
CREATE TABLE chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES chat_sessions(id),
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content       TEXT NOT NULL,
  token_count   INTEGER NOT NULL,       -- pre-calculated for budget tracking
  metadata      JSONB DEFAULT '{}',     -- grounding_refs, suggested_questions, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

**Schema: `chat_sessions`**

```sql
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  agent_type      TEXT NOT NULL CHECK (agent_type IN ('student_explanation', 'parent_insight')),
  parent_id       UUID REFERENCES users(id),       -- NULL for student sessions
  question_id     UUID REFERENCES questions(id),    -- NULL for parent sessions
  test_session_id UUID REFERENCES test_sessions(id),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'summarized', 'archived')),
  topic_summary   TEXT,                             -- one-line summary, updated on close
  total_tokens    INTEGER NOT NULL DEFAULT 0,       -- running token count
  turn_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ                       -- NULL while active
);

CREATE INDEX idx_chat_sessions_student ON chat_sessions(student_id, created_at DESC);
CREATE INDEX idx_chat_sessions_active ON chat_sessions(status) WHERE status = 'active';
```

**Message Storage Flow:**

```typescript
// services/conversation/message-store.ts

import { encode } from 'gpt-tokenizer'; // or tiktoken for accurate Claude token counting

interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export async function appendMessage(
  db: PrismaClient,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<StoredMessage> {
  const tokenCount = encode(content).length;

  const [message] = await db.$transaction([
    db.chatMessage.create({
      data: { sessionId, role, content, tokenCount, metadata },
    }),
    db.chatSession.update({
      where: { id: sessionId },
      data: {
        totalTokens: { increment: tokenCount },
        turnCount: { increment: 1 },
        updatedAt: new Date(),
      },
    }),
  ]);

  return message;
}

export async function getSessionMessages(
  db: PrismaClient,
  sessionId: string
): Promise<StoredMessage[]> {
  return db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}
```

#### Tier 2: Medium-Term Memory (Conversation Summaries)

When a session ends or exceeds token thresholds, it is summarized and stored in `conversation_memory`. These summaries are injected into future sessions as cross-session context.

**Schema: `conversation_memory`**

```sql
CREATE TABLE conversation_memory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id),
  session_id          UUID NOT NULL REFERENCES chat_sessions(id),
  agent_type          TEXT NOT NULL,
  summary             TEXT NOT NULL,              -- 2-4 sentence summary of what was discussed
  key_topics          TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['time_management', 'number_patterns']
  insights_extracted  JSONB NOT NULL DEFAULT '[]', -- structured insights for profile
  parent_questions    TEXT[] DEFAULT '{}',          -- what the parent asked about (for recall)
  satisfaction_signal TEXT CHECK (satisfaction_signal IN ('positive', 'neutral', 'negative', NULL)),
  turn_count          INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_memory_student ON conversation_memory(student_id, created_at DESC);
CREATE INDEX idx_conv_memory_topics ON conversation_memory USING GIN(key_topics);
```

**Summarization Pipeline:**

```typescript
// services/conversation/summarizer.ts

import Anthropic from '@anthropic-ai/sdk';

const SUMMARIZATION_PROMPT = `You are summarizing a conversation between a parent and an AI academic advisor about their child's learning.

Produce a JSON object with these fields:
- summary: 2-4 sentences capturing the key discussion points and conclusions
- key_topics: array of topic slugs from this list: [time_management, error_patterns, skill_gaps, study_strategies, test_performance, reading, math, thinking_skills, confidence, progress_trends, rushing, careless_errors]
- insights: array of objects with {type, content, actionable} — insights that should update the student profile
- parent_questions: array of the main questions the parent asked (paraphrased)
- satisfaction: "positive" | "neutral" | "negative" based on parent's tone

CONVERSATION:
{messages}

Respond with valid JSON only.`;

export async function summarizeSession(
  client: Anthropic,
  messages: StoredMessage[]
): Promise<ConversationSummary> {
  const formatted = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-20250414', // Haiku for cost-efficient summarization
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: SUMMARIZATION_PROMPT.replace('{messages}', formatted),
      },
    ],
  });

  return JSON.parse(response.content[0].text) as ConversationSummary;
}
```

**Summarization triggers:**

| Trigger | Condition | Action |
|---|---|---|
| Session close | Parent navigates away or explicitly ends chat | Summarize, store in `conversation_memory` |
| Inactivity timeout | No message for 30 minutes | Auto-close session, summarize |
| Token threshold | Session exceeds 6,000 tokens | Summarize older turns in-place (sliding window, see §4.2) |

#### Tier 3: Long-Term Memory (Profile Integration)

The most durable insights from conversations are promoted into the student's Learning DNA. These survive indefinitely and are automatically included in future context via the profile data block.

**Profile Extension for Conversation Insights:**

```json
{
  "student_id": "uuid",
  "learning_dna": {
    "...existing fields...",
    "conversation_insights": {
      "parent_concerns": [
        {
          "topic": "rushing",
          "first_raised": "2026-02-15",
          "last_discussed": "2026-03-01",
          "times_discussed": 3,
          "resolution_status": "ongoing",
          "latest_context": "Parent noted improvement after timer awareness exercises"
        }
      ],
      "student_confusion_patterns": [
        {
          "pattern": "Confuses 'not' in question stems — confirmed via chat",
          "source_sessions": ["session_id_1", "session_id_2"],
          "first_observed": "2026-02-10",
          "frequency": 4
        }
      ],
      "error_reclassifications": [
        {
          "question_id": "uuid",
          "original_type": "concept_gap",
          "reclassified_to": "misread_question",
          "evidence": "Student demonstrated understanding in chat review",
          "session_id": "uuid"
        }
      ]
    }
  }
}
```

**Promotion Pipeline:**

```
Session ends
    │
    ▼
Summarize (Tier 2)
    │
    ▼
Extract insights ──► Are any insights profile-worthy?
    │                       │
    │ no                    │ yes
    │                       ▼
    ▼                 Update Learning DNA
  Store in            (async job via
  conversation_memory  profile_events table)
  only
```

Profile-worthy insights include:
- Error reclassifications (student proved they understand a concept)
- Recurring parent concerns (asked about the same topic 2+ times)
- New confusion patterns discovered through student chat
- Student self-reported difficulty areas

---

### 4.2 Context Window Management

Claude's context window is finite. EduLens must allocate tokens carefully across competing needs: system prompts, student profile data, conversation history, and grounding references.

#### Token Budget Allocation

The system uses a fixed total budget and allocates tokens by priority tier.

```
┌──────────────────────────────────────────────────────────┐
│              Context Window Budget (200K max)             │
│         MVP target: stay within 30K per request          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ TIER 0: System Prompt (fixed)          ~1,500 tok  │  │
│  │ Agent instructions, constraints, tone, format      │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ TIER 1: Grounding Data (variable)    ~2,000-5,000  │  │
│  │ Profile snapshot, relevant test data, question     │  │
│  │ data (for student agent)                           │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ TIER 2: Cross-Session Recall         ~500-1,500    │  │
│  │ Summaries of relevant past conversations           │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ TIER 3: Conversation History (elastic) ~remainder  │  │
│  │ Recent turns verbatim; older turns summarized      │  │
│  ├────────────────────────────────────────────────────┤  │
│  │ RESERVE: Response headroom             ~4,000 tok  │  │
│  │ Space for Claude's response generation             │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Budget Configuration:**

```typescript
// config/token-budget.ts

export const TOKEN_BUDGET = {
  // Model limit — use well under max to control cost and latency
  maxRequestTokens: 30_000,

  // Fixed allocations
  systemPrompt: 1_500,
  responseReserve: 4_000,

  // Variable allocations (max)
  groundingData: 5_000,     // profile + test/question data
  crossSessionRecall: 1_500, // past conversation summaries

  // Remainder goes to conversation history
  get conversationHistory() {
    return (
      this.maxRequestTokens -
      this.systemPrompt -
      this.responseReserve -
      this.groundingData -
      this.crossSessionRecall
    );
    // ≈ 18,000 tokens for history
  },
} as const;
```

#### Sliding Window with Summarization

When conversation history exceeds its budget, older turns are summarized and replaced with a compressed preamble. This preserves conversational continuity without exceeding token limits.

```
Turn 1-4:  [summarized into ~200 tokens]
Turn 5-8:  [summarized into ~200 tokens]
Turn 9-12: [full verbatim text, ~2,400 tokens]
Turn 13:   [current user message]
```

**Implementation:**

```typescript
// services/conversation/context-builder.ts

interface ContextWindow {
  systemPrompt: string;
  groundingData: string;
  crossSessionRecall: string;
  conversationMessages: Array<{ role: string; content: string }>;
}

export async function buildContextWindow(
  db: PrismaClient,
  client: Anthropic,
  session: ChatSession,
  newUserMessage: string
): Promise<ContextWindow> {
  // 1. Fixed: system prompt (pre-built per agent type)
  const systemPrompt = getSystemPrompt(session.agentType);

  // 2. Grounding data: profile + relevant test/question data
  const groundingData = await assembleGroundingData(db, session);
  const groundingTokens = countTokens(groundingData);

  // 3. Cross-session recall: relevant past conversation summaries
  const recall = await getCrossSessionRecall(db, session.studentId, newUserMessage);
  const recallTokens = countTokens(recall);

  // 4. Conversation history: fill remaining budget
  const historyBudget =
    TOKEN_BUDGET.maxRequestTokens -
    TOKEN_BUDGET.systemPrompt -
    TOKEN_BUDGET.responseReserve -
    groundingTokens -
    recallTokens;

  const messages = await getSessionMessages(db, session.id);
  const conversationMessages = await fitMessagesToBudget(
    client,
    messages,
    newUserMessage,
    historyBudget
  );

  return { systemPrompt, groundingData, crossSessionRecall: recall, conversationMessages };
}

async function fitMessagesToBudget(
  client: Anthropic,
  messages: StoredMessage[],
  newUserMessage: string,
  budgetTokens: number
): Promise<Array<{ role: string; content: string }>> {
  // Always include the new user message
  const newMsgTokens = countTokens(newUserMessage);
  let remaining = budgetTokens - newMsgTokens;

  // Work backwards from most recent, adding verbatim turns
  const verbatimMessages: StoredMessage[] = [];
  const olderMessages: StoredMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    if (remaining >= messages[i].tokenCount) {
      verbatimMessages.unshift(messages[i]);
      remaining -= messages[i].tokenCount;
    } else {
      // Everything older gets summarized
      olderMessages.push(...messages.slice(0, i + 1));
      break;
    }
  }

  const result: Array<{ role: string; content: string }> = [];

  // Summarize older messages if any exist
  if (olderMessages.length > 0) {
    const summary = await summarizeMessagesForContext(client, olderMessages);
    result.push({
      role: 'user',
      content: `[Earlier in this conversation: ${summary}]`,
    });
  }

  // Add verbatim recent messages
  for (const msg of verbatimMessages) {
    result.push({ role: msg.role, content: msg.content });
  }

  // Add the new message
  result.push({ role: 'user', content: newUserMessage });

  return result;
}
```

#### Prompt Caching for Cost Reduction

The system prompt and profile data are largely stable across turns within a session. Anthropic's prompt caching avoids re-processing these tokens on every request.

```typescript
// services/conversation/cached-request.ts

export async function sendCachedRequest(
  client: Anthropic,
  context: ContextWindow
): Promise<Anthropic.Message> {
  return client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: TOKEN_BUDGET.responseReserve,
    system: [
      {
        type: 'text',
        text: context.systemPrompt,
        cache_control: { type: 'ephemeral' }, // cached across turns
      },
      {
        type: 'text',
        text: context.groundingData,
        cache_control: { type: 'ephemeral' }, // profile data stable within session
      },
    ],
    messages: context.conversationMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });
}
```

**Cache hit economics:**

| Component | Tokens | Without cache | With cache (hit) | Savings |
|---|---|---|---|---|
| System prompt | 1,500 | $0.0045 | $0.00045 | 90% |
| Profile data | 3,000 | $0.009 | $0.0009 | 90% |
| Conversation history | 10,000 | $0.03 | $0.03 (not cached) | 0% |
| **Per-turn input cost** | 14,500 | **$0.0435** | **$0.031** | ~29% |

Over a 10-turn parent conversation, caching saves approximately $0.12 per session. At 1,000 sessions/month, that's $120/month in direct savings.

---

### 4.3 Session Persistence & Cross-Session Memory

#### Session Persistence (Browser Close Recovery)

Sessions are server-authoritative. All messages are stored in PostgreSQL as they arrive. The client can disconnect and reconnect without data loss.

**Lifecycle:**

```
Parent opens chat → POST /api/chat/parent/sessions
                    Returns: session_id + any existing messages

Parent sends message → POST /api/chat/parent/sessions/:id/messages
                       Message stored in DB before Claude call

Parent closes tab → (nothing happens server-side)
                    Session remains status='active'

Parent returns → GET /api/chat/parent/sessions?status=active
                 Returns active session with full message history
                 Client renders existing messages, ready for next turn

30 min inactivity → Background job: summarize, set status='summarized'
```

**API for Session Recovery:**

```typescript
// app/api/chat/parent/sessions/route.ts

export async function GET(req: NextRequest) {
  const { studentId } = await authenticateParent(req);

  // Return active session if one exists (resume)
  const activeSession = await db.chatSession.findFirst({
    where: {
      studentId,
      agentType: 'parent_insight',
      status: 'active',
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (activeSession) {
    return NextResponse.json({
      session: activeSession,
      messages: activeSession.messages,
      resuming: true,
    });
  }

  // No active session — return recent session list for context
  const recentSessions = await db.conversationMemory.findMany({
    where: { studentId, agentType: 'parent_insight' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      summary: true,
      keyTopics: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    session: null,
    recentSessions,
    resuming: false,
  });
}
```

**Client-Side Reconnection:**

```typescript
// hooks/useChatSession.ts

export function useChatSession(studentId: string) {
  const { data, mutate } = useSWR(
    `/api/chat/parent/sessions?studentId=${studentId}`,
    fetcher
  );

  const startOrResume = useCallback(async () => {
    if (data?.resuming) {
      // Existing session — just load messages into state
      return { sessionId: data.session.id, messages: data.messages };
    }
    // Create new session
    const res = await fetch('/api/chat/parent/sessions', {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
    const newSession = await res.json();
    mutate();
    return { sessionId: newSession.id, messages: [] };
  }, [data, studentId, mutate]);

  return { ...data, startOrResume };
}
```

#### Cross-Session Memory (Recall Across Conversations)

When a parent starts a new session, the context builder retrieves relevant summaries from past conversations and injects them as a preamble. This enables the AI to reference prior discussions naturally.

**Retrieval Strategy:**

```typescript
// services/conversation/cross-session-recall.ts

export async function getCrossSessionRecall(
  db: PrismaClient,
  studentId: string,
  currentMessage: string
): Promise<string> {
  // Strategy 1: Always include the most recent conversation summary
  const lastSession = await db.conversationMemory.findFirst({
    where: { studentId, agentType: 'parent_insight' },
    orderBy: { createdAt: 'desc' },
  });

  // Strategy 2: Find topically relevant past conversations
  // Extract likely topics from the current message using keyword matching
  const topics = extractTopics(currentMessage);
  const relevantSessions = await db.conversationMemory.findMany({
    where: {
      studentId,
      agentType: 'parent_insight',
      keyTopics: { hasSome: topics },
      id: { not: lastSession?.id }, // don't duplicate
    },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });

  // Format for injection into context
  const parts: string[] = [];

  if (lastSession) {
    const daysAgo = daysSince(lastSession.createdAt);
    parts.push(
      `[Last conversation (${daysAgo} days ago): ${lastSession.summary}]`
    );
  }

  for (const session of relevantSessions) {
    const daysAgo = daysSince(session.createdAt);
    parts.push(
      `[Related past conversation (${daysAgo} days ago, topics: ${session.keyTopics.join(', ')}): ${session.summary}]`
    );
  }

  return parts.join('\n');
}

function extractTopics(message: string): string[] {
  // Lightweight keyword extraction — no LLM call needed
  const topicKeywords: Record<string, string[]> = {
    time_management: ['rushing', 'time', 'slow', 'fast', 'speed', 'timer', 'ran out'],
    error_patterns: ['mistakes', 'errors', 'wrong', 'careless', 'silly'],
    skill_gaps: ['weak', 'struggling', 'difficult', 'hard', 'improve', 'gap'],
    reading: ['reading', 'comprehension', 'inference', 'vocabulary', 'passage'],
    math: ['math', 'number', 'calculation', 'arithmetic', 'fractions', 'patterns'],
    thinking_skills: ['thinking', 'analogies', 'logic', 'spatial', 'reasoning'],
    progress_trends: ['improving', 'better', 'worse', 'progress', 'trend', 'change'],
    rushing: ['rushing', 'rush', 'hurry', 'too fast', 'speed'],
  };

  const lower = message.toLowerCase();
  return Object.entries(topicKeywords)
    .filter(([, keywords]) => keywords.some((kw) => lower.includes(kw)))
    .map(([topic]) => topic);
}
```

**Cross-session recall in action — parent message flow:**

```
Parent (new session): "Is she still rushing through the last questions?"
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Extract topics:        │
                        │   ["rushing",            │
                        │    "time_management"]    │
                        └────────────┬────────────┘
                                     │
              ┌──────────────────────┤
              ▼                      ▼
   ┌──────────────────┐   ┌────────────────────────┐
   │ Last session      │   │ Topic-matched session   │
   │ summary (3 days   │   │ from 2 weeks ago:       │
   │ ago): "Discussed  │   │ "Parent raised concern  │
   │ reading progress  │   │ about rushing. Data      │
   │ and math trends"  │   │ showed accuracy drop     │
   │                   │   │ after Q25. Suggested     │
   │                   │   │ timer awareness drills." │
   └──────────────────┘   └────────────────────────┘
              │                      │
              └──────────┬───────────┘
                         ▼
              Injected into context:
              "[Last conversation (3 days ago): Discussed reading
               progress and math trends.]
               [Related past conversation (14 days ago, topics:
               rushing, time_management): Parent raised concern
               about rushing. Data showed accuracy drop after Q25.
               Suggested timer awareness drills.]"
                         │
                         ▼
              Claude response:
              "Last time we discussed this, the data showed Mia's
               accuracy dropped significantly after question 25.
               Looking at her most recent test from Tuesday, there's
               actually been some improvement — the drop-off point
               has moved to question 28, and her accuracy in the
               final section went from 50% to 62%. The timer
               awareness exercises seem to be helping. Would you
               like to see the specific numbers?"
```

---

### 4.4 Conversation Branching & Topic Switching

Parents naturally jump between topics: "How's math going?" → "What about reading?" → "Actually, back to math — is she rushing on the hard ones?" The system must detect topic shifts and adjust the grounding data accordingly without losing conversational thread.

#### Topic Segmentation

Each message is classified into a topic segment. When the topic changes, the context builder refreshes the relevant grounding data.

```typescript
// services/conversation/topic-tracker.ts

export interface TopicSegment {
  topic: string;         // e.g., 'math.number_patterns', 'time_management', 'general_progress'
  startTurn: number;
  endTurn: number | null; // null = current segment
  groundingKeys: string[]; // which profile sections are relevant
}

// Topic detection — lightweight, runs on every user message
export function detectTopic(
  message: string,
  currentTopic: string | null
): { topic: string; isSwitch: boolean; groundingKeys: string[] } {
  const topicRules: Array<{
    topic: string;
    patterns: RegExp[];
    groundingKeys: string[];
  }> = [
    {
      topic: 'reading',
      patterns: [/reading/i, /comprehension/i, /inference/i, /vocabulary/i, /passage/i],
      groundingKeys: ['skill_graph.reading', 'error_profile', 'recent_tests'],
    },
    {
      topic: 'math',
      patterns: [/math/i, /number/i, /arithmetic/i, /fraction/i, /calculation/i, /pattern/i],
      groundingKeys: ['skill_graph.math', 'error_profile', 'recent_tests'],
    },
    {
      topic: 'thinking_skills',
      patterns: [/thinking/i, /analog/i, /logic/i, /spatial/i, /reasoning/i],
      groundingKeys: ['skill_graph.thinking', 'error_profile', 'recent_tests'],
    },
    {
      topic: 'time_management',
      patterns: [/rush/i, /time/i, /slow/i, /fast/i, /stamina/i, /fatigue/i],
      groundingKeys: ['time_behavior', 'stamina_curve', 'recent_tests'],
    },
    {
      topic: 'error_patterns',
      patterns: [/mistake/i, /error/i, /wrong/i, /careless/i, /misread/i],
      groundingKeys: ['error_profile', 'recent_tests'],
    },
    {
      topic: 'progress',
      patterns: [/improv/i, /better/i, /worse/i, /progress/i, /trend/i, /change/i],
      groundingKeys: ['skill_graph', 'profile_history', 'recent_tests'],
    },
  ];

  for (const rule of topicRules) {
    if (rule.patterns.some((p) => p.test(message))) {
      return {
        topic: rule.topic,
        isSwitch: currentTopic !== null && currentTopic !== rule.topic,
        groundingKeys: rule.groundingKeys,
      };
    }
  }

  // No clear topic detected — continue with current topic
  return {
    topic: currentTopic ?? 'general',
    isSwitch: false,
    groundingKeys: ['skill_graph', 'error_profile', 'recent_tests'],
  };
}
```

#### Context Rebuilding on Topic Pivot

When a topic switch is detected, the context builder selectively refreshes the grounding data section while preserving conversation history. This ensures Claude has the right data for the new topic without discarding the conversational thread.

```
Parent: "How's reading going?"        ← Topic: reading
AI: "Reading comprehension has..."    ← Grounding: skill_graph.reading + tests

Parent: "What about math?"            ← Topic switch detected → math
                                         Grounding refreshed: skill_graph.math + tests
                                         Conversation history preserved (both turns)
AI: "For math, the picture is..."

Parent: "Is she rushing on the        ← Topic switch → time_management
         hard math questions?"           Grounding refreshed: time_behavior + tests
                                         History preserved (all 4 prior turns)
                                         BUT: math context retained because
                                         message references math explicitly
AI: "Looking at her timing on math questions specifically..."
```

**Grounding Data Assembly with Topic Awareness:**

```typescript
// services/conversation/grounding.ts

export async function assembleGroundingData(
  db: PrismaClient,
  session: ChatSession,
  topicSegment: TopicSegment
): Promise<string> {
  const profile = await db.studentProfile.findUnique({
    where: { studentId: session.studentId },
  });

  const learningDna = profile.learningDna as LearningDNA;
  const sections: string[] = [];

  // Always include: student name, overview stats
  sections.push(formatStudentOverview(profile));

  // Topic-specific grounding
  for (const key of topicSegment.groundingKeys) {
    switch (key) {
      case 'skill_graph.reading':
        sections.push(formatSkillCategory(learningDna.skillGraph, 'Reading'));
        break;
      case 'skill_graph.math':
        sections.push(formatSkillCategory(learningDna.skillGraph, 'Mathematical Reasoning'));
        break;
      case 'skill_graph.thinking':
        sections.push(formatSkillCategory(learningDna.skillGraph, 'Thinking Skills'));
        break;
      case 'skill_graph':
        sections.push(formatFullSkillGraph(learningDna.skillGraph));
        break;
      case 'error_profile':
        sections.push(formatErrorProfile(learningDna.errorProfile));
        break;
      case 'time_behavior':
        sections.push(formatTimeBehavior(learningDna.timeBehavior));
        break;
      case 'recent_tests':
        const tests = await getRecentTestSummaries(db, session.studentId, 3);
        sections.push(formatTestSummaries(tests));
        break;
      case 'profile_history':
        const snapshots = await getProfileSnapshots(db, session.studentId, 4);
        sections.push(formatTrendData(snapshots));
        break;
    }
  }

  // Include conversation insights from long-term memory
  if (learningDna.conversationInsights?.parentConcerns?.length > 0) {
    sections.push(formatParentConcerns(learningDna.conversationInsights.parentConcerns));
  }

  return sections.join('\n\n');
}
```

#### Multi-Topic Thread Tracking

The system maintains a stack of topic segments for the session, enabling the AI to reference earlier topics when the parent returns to them.

```typescript
// services/conversation/topic-stack.ts

export class TopicStack {
  private segments: TopicSegment[] = [];

  push(topic: string, turnNumber: number, groundingKeys: string[]): void {
    // Close the current segment
    const current = this.segments[this.segments.length - 1];
    if (current) {
      current.endTurn = turnNumber - 1;
    }
    this.segments.push({ topic, startTurn: turnNumber, endTurn: null, groundingKeys });
  }

  current(): TopicSegment | null {
    return this.segments[this.segments.length - 1] ?? null;
  }

  // Returns the turn range where a topic was previously discussed
  previousOccurrence(topic: string): TopicSegment | null {
    for (let i = this.segments.length - 2; i >= 0; i--) {
      if (this.segments[i].topic === topic) {
        return this.segments[i];
      }
    }
    return null;
  }

  // Context hint injected when returning to a previously discussed topic
  getReturnHint(topic: string): string | null {
    const prev = this.previousOccurrence(topic);
    if (!prev) return null;
    return `[Note: The parent discussed ${topic} earlier in turns ${prev.startTurn}-${prev.endTurn}. Reference what was already covered to avoid repetition.]`;
  }
}
```

---

### 4.5 Streaming Architecture

All AI responses are delivered via Server-Sent Events (SSE). This provides immediate visual feedback (tokens appear as they're generated), typing indicators, and graceful handling of disconnects.

#### Why SSE Over WebSockets

| Consideration | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client (sufficient for streaming responses) | Bidirectional |
| Infrastructure | Works over standard HTTP; Vercel/CloudFront compatible | Requires sticky sessions or dedicated WS infrastructure |
| Reconnection | Built-in auto-reconnect with `Last-Event-ID` | Manual reconnection logic required |
| Complexity | Minimal — native `EventSource` API | Requires connection management, heartbeats |
| Chat use case fit | Client sends via POST, receives stream via SSE | Overkill — chat is request-response, not bidirectional |

SSE is used for AI response streaming. The existing WebSocket connection for test timer sync (§3) remains unchanged.

#### Server-Side Streaming Endpoint

```typescript
// app/api/chat/parent/sessions/[id]/messages/route.ts

import Anthropic from '@anthropic-ai/sdk';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await validateSession(params.id, req);
  const { content } = await req.json();

  // Store user message immediately (before streaming begins)
  await appendMessage(db, session.id, 'user', content);

  // Build context
  const topicResult = detectTopic(content, session.currentTopic);
  if (topicResult.isSwitch) {
    await updateSessionTopic(db, session.id, topicResult.topic);
  }
  const context = await buildContextWindow(db, anthropic, session, content);

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const assistantChunks: string[] = [];

      try {
        // Send typing indicator
        controller.enqueue(
          encoder.encode(`event: typing\ndata: {"status": "started"}\n\n`)
        );

        // Stream from Claude
        const messageStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: TOKEN_BUDGET.responseReserve,
          system: [
            {
              type: 'text',
              text: context.systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: context.groundingData,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: context.conversationMessages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        });

        messageStream.on('text', (text) => {
          assistantChunks.push(text);
          controller.enqueue(
            encoder.encode(
              `event: delta\ndata: ${JSON.stringify({ text })}\n\n`
            )
          );
        });

        const finalMessage = await messageStream.finalMessage();

        // Assemble full response
        const fullResponse = assistantChunks.join('');

        // Extract suggested questions and grounding refs from response
        const metadata = await extractResponseMetadata(fullResponse, context);

        // Store assistant message
        await appendMessage(db, session.id, 'assistant', fullResponse, metadata);

        // Send completion event with metadata
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              messageId: metadata.messageId,
              suggestedQuestions: metadata.suggestedQuestions,
              groundingRefs: metadata.groundingRefs,
              usage: {
                inputTokens: finalMessage.usage.input_tokens,
                outputTokens: finalMessage.usage.output_tokens,
                cacheRead: finalMessage.usage.cache_read_input_tokens ?? 0,
              },
            })}\n\n`
          )
        );
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              message: 'Something went wrong. Please try again.',
              retryable: true,
            })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

#### Client-Side Stream Consumer

```typescript
// hooks/useStreamingChat.ts

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming: boolean;
  suggestedQuestions?: string[];
  groundingRefs?: GroundingRef[];
}

export function useStreamingChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      // Optimistically add user message
      setMessages((prev) => [
        ...prev,
        { role: 'user', content, isStreaming: false },
      ]);

      // Add placeholder for assistant response
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', isStreaming: true },
      ]);

      setIsTyping(true);
      abortRef.current = new AbortController();

      try {
        const response = await fetch(
          `/api/chat/parent/sessions/${sessionId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
            signal: abortRef.current.signal,
          }
        );

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const block of lines) {
            const eventMatch = block.match(/^event: (.+)$/m);
            const dataMatch = block.match(/^data: (.+)$/m);
            if (!eventMatch || !dataMatch) continue;

            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            switch (event) {
              case 'typing':
                setIsTyping(true);
                break;

              case 'delta':
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + data.text,
                  };
                  return updated;
                });
                break;

              case 'done':
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    id: data.messageId,
                    isStreaming: false,
                    suggestedQuestions: data.suggestedQuestions,
                    groundingRefs: data.groundingRefs,
                  };
                  return updated;
                });
                setIsTyping(false);
                break;

              case 'error':
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: data.message,
                    isStreaming: false,
                  };
                  return updated;
                });
                setIsTyping(false);
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: 'assistant',
              content: 'Connection lost. Please try again.',
              isStreaming: false,
            };
            return updated;
          });
          setIsTyping(false);
        }
      }
    },
    [sessionId]
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsTyping(false);
  }, []);

  return { messages, isTyping, sendMessage, cancelStream };
}
```

#### SSE Event Protocol

| Event | Payload | Description |
|---|---|---|
| `typing` | `{ status: "started" }` | AI is generating — show typing indicator |
| `delta` | `{ text: "..." }` | Incremental token(s) — append to message |
| `done` | `{ messageId, suggestedQuestions, groundingRefs, usage }` | Generation complete — finalize message, render metadata |
| `error` | `{ message, retryable }` | Error occurred — show error state, optionally retry |

#### Reconnection & Resilience

If the SSE connection drops mid-stream (network blip, mobile sleep), the client recovers gracefully:

```
Connection drops during streaming
    │
    ▼
Client detects ReadableStream error
    │
    ▼
Fetch stored messages: GET /api/chat/parent/sessions/:id/messages
    │
    ▼
Server returns all messages including the complete assistant response
(which was stored on completion, even if the client disconnected)
    │
    ▼
Client reconciles: if the last assistant message is already stored
server-side, render it fully. If not (stream was interrupted before
Claude finished), show "Response was interrupted. Send your message
again to continue."
```

```typescript
// hooks/useStreamingChat.ts — reconnection logic

async function reconcileAfterDisconnect(
  sessionId: string,
  localMessages: ChatMessage[]
): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat/parent/sessions/${sessionId}/messages`);
  const serverMessages: StoredMessage[] = await res.json();

  // Server is source of truth — replace local state
  return serverMessages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    isStreaming: false,
    suggestedQuestions: m.metadata?.suggestedQuestions,
    groundingRefs: m.metadata?.groundingRefs,
  }));
}
```

#### End-to-End Message Flow

```
┌──────────┐    POST /messages     ┌──────────────┐
│  Client   │─────────────────────▶│  Next.js API  │
│  (React)  │                      │  Route Handler│
│           │                      │               │
│           │  SSE: typing         │  1. Store user│
│           │◀─────────────────────│     message   │
│           │                      │               │
│           │                      │  2. Build     │
│           │                      │     context   │
│           │                      │     window    │
│           │                      │               │
│           │                      │  3. Call      │
│           │  SSE: delta (×N)     │     Claude    │
│           │◀─────────────────────│     streaming │
│           │  (token by token)    │               │
│           │                      │  4. Collect   │
│           │                      │     full      │
│           │  SSE: done           │     response  │
│           │◀─────────────────────│               │
│           │  (metadata)          │  5. Store     │
│           │                      │     assistant │
│           │                      │     message   │
│           │                      │               │
│           │                      │  6. Async:    │
│           │                      │     extract   │
│           │                      │     signals   │
│           │                      │     for       │
│           │                      │     profile   │
└──────────┘                      └──────────────┘
                                          │
                                          │ streaming API call
                                          ▼
                                  ┌──────────────┐
                                  │  Claude API   │
                                  │  (Anthropic/  │
                                  │   Bedrock)    │
                                  └──────────────┘
```

#### Typing Indicator UX

The typing indicator appears immediately when the user sends a message and transitions smoothly to streaming text:

```
State 1: User sends message
         → POST fires
         → Typing indicator appears (3 animated dots)

State 2: First SSE delta arrives (~300-800ms later)
         → Typing indicator fades out
         → Text begins appearing character by character

State 3: SSE done event arrives
         → Streaming flag cleared
         → Suggested questions animate in below the message
         → Grounding reference badges render inline
         → Thumbs up/down feedback buttons appear
```

This architecture ensures parents never see a blank screen waiting for the AI. From the moment they press send, there is continuous visual feedback.
## 5. AI Agent Design (Expanded)

The v1 design established agent purposes, system prompts, and behavior examples. This expanded section adds the operational machinery required to run those agents in production: a formal state machine governing agent lifecycle, model routing that balances quality against cost, a prompt caching strategy that eliminates redundant token processing, and a concrete cost model that forecasts per-student monthly spend.

All v1 agent prompts and behavior examples are preserved below and remain canonical.

### Design Principles

1. **Grounded generation** — Every AI response must be traceable to structured data. No hallucinated insights.
2. **Constrained scope** — Each agent has a defined boundary. The Student Agent talks about questions. The Parent Agent talks about the profile. Neither becomes a general chatbot.
3. **Tone calibration** — Student-facing: encouraging, Socratic, age-appropriate. Parent-facing: warm, professional, teacher-in-a-conference tone.
4. **Signal extraction** — Conversations are not just output; they are input. Every interaction feeds data back to the Profile Engine.
5. **Cost-aware routing** — Use the cheapest model that meets quality requirements for each task. Reserve expensive models for tasks where quality directly impacts the user experience. (NEW)
6. **Stateful lifecycle** — Agents follow a deterministic state machine so the system always knows what an agent is doing, what it's waiting for, and how to recover from failures. (NEW)

---

### 5.1 Agent State Machine

Every agent instance (student or parent) follows a four-state lifecycle. The state machine governs UI indicators, timeout handling, error recovery, and billing metering.

```
                    ┌──────────────────────────────────────────┐
                    │           Agent State Machine              │
                    │                                           │
  session created   │   ┌─────────┐   user sends    ┌────────────────┐
  ─────────────────►│   │  IDLE   │──── message ────▶│  PROCESSING    │
                    │   │         │                  │                │
                    │   │ • UI:   │                  │ • UI: spinner  │
                    │   │   input │                  │ • Build context│
                    │   │   ready │                  │ • Classify     │
                    │   │ • No    │                  │   intent       │
                    │   │   API   │                  │ • Select model │
                    │   │   calls │                  │ • Call Claude   │
                    │   └────▲────┘                  └───────┬────────┘
                    │        │                               │
                    │        │                     first token arrives
                    │        │                               │
                    │        │                               ▼
                    │   ┌────┴──────────────┐      ┌─────────────────┐
                    │   │ WAITING_FEEDBACK  │      │  RESPONDING     │
                    │   │                  │      │                 │
                    │   │ • UI: suggested  │◀─────│ • UI: streaming │
                    │   │   questions +    │ done │   text          │
                    │   │   input ready    │ event│ • SSE delta     │
                    │   │ • Idle timeout:  │      │   events        │
                    │   │   30 min         │      │ • Tokens billed │
                    │   │ • Signal         │      └─────────────────┘
                    │   │   extraction     │
                    │   │   runs async     │
                    │   └──────────────────┘
                    │        │
                    │   user sends message ──► back to PROCESSING
                    │   timeout (30 min)   ──► session summarized & closed
                    └──────────────────────────────────────────┘
```

**State Definitions:**

| State | Entry Condition | Active Work | Exit Condition | Timeout |
|---|---|---|---|---|
| `idle` | Session created or previous response complete with no follow-up | None — waiting for user input | User sends a message → `processing` | 30 min → session close |
| `processing` | User message received | Context assembly, intent classification, model selection, Claude API call initiated | First SSE token arrives → `responding` | 30 sec → error + retry |
| `responding` | First token from Claude arrives | SSE streaming to client, token accumulation | `done` SSE event → `waiting_feedback` | 120 sec → partial response stored, error state |
| `waiting_feedback` | Full response delivered | Signal extraction (async), suggested questions displayed | User sends message → `processing`; timeout → session close | 30 min → session close |

**State Transition Implementation:**

```typescript
// services/agents/state-machine.ts

export type AgentState = 'idle' | 'processing' | 'responding' | 'waiting_feedback';

export interface AgentStateContext {
  sessionId: string;
  state: AgentState;
  enteredAt: Date;
  metadata: {
    currentModel?: string;          // which model is handling this turn
    inputTokens?: number;           // accumulated for billing
    outputTokens?: number;
    cacheReadTokens?: number;
    processingStartedAt?: Date;     // for latency tracking
    firstTokenAt?: Date;            // time-to-first-token metric
    errorCount: number;             // consecutive errors in this session
  };
}

export function transition(
  current: AgentStateContext,
  event: AgentEvent
): AgentStateContext {
  const now = new Date();

  switch (current.state) {
    case 'idle':
      if (event.type === 'user_message') {
        return {
          ...current,
          state: 'processing',
          enteredAt: now,
          metadata: {
            ...current.metadata,
            processingStartedAt: now,
          },
        };
      }
      if (event.type === 'timeout') {
        return { ...current, state: 'idle' }; // triggers session close externally
      }
      break;

    case 'processing':
      if (event.type === 'first_token') {
        return {
          ...current,
          state: 'responding',
          enteredAt: now,
          metadata: {
            ...current.metadata,
            currentModel: event.model,
            firstTokenAt: now,
          },
        };
      }
      if (event.type === 'error') {
        if (current.metadata.errorCount < 2) {
          // Retry: stay in processing
          return {
            ...current,
            metadata: {
              ...current.metadata,
              errorCount: current.metadata.errorCount + 1,
            },
          };
        }
        // Max retries exceeded: return to idle with error
        return { ...current, state: 'idle', enteredAt: now };
      }
      break;

    case 'responding':
      if (event.type === 'stream_complete') {
        return {
          ...current,
          state: 'waiting_feedback',
          enteredAt: now,
          metadata: {
            ...current.metadata,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            cacheReadTokens: event.usage.cacheReadTokens,
          },
        };
      }
      if (event.type === 'error') {
        // Store partial response, return to waiting_feedback
        return { ...current, state: 'waiting_feedback', enteredAt: now };
      }
      break;

    case 'waiting_feedback':
      if (event.type === 'user_message') {
        return {
          ...current,
          state: 'processing',
          enteredAt: now,
          metadata: {
            ...current.metadata,
            processingStartedAt: now,
            errorCount: 0,
          },
        };
      }
      if (event.type === 'timeout') {
        return { ...current, state: 'idle' }; // triggers session close
      }
      break;
  }

  // Invalid transition — log and stay in current state
  console.warn(
    `Invalid transition: state=${current.state} event=${event.type}`
  );
  return current;
}

type AgentEvent =
  | { type: 'user_message'; content: string }
  | { type: 'first_token'; model: string }
  | { type: 'stream_complete'; usage: TokenUsage }
  | { type: 'error'; message: string }
  | { type: 'timeout' };
```

**State Persistence:**

Agent state is stored in Redis for fast reads (UI polling) and durably in PostgreSQL for recovery after restarts.

```typescript
// services/agents/state-store.ts

export async function persistState(
  redis: Redis,
  db: PrismaClient,
  ctx: AgentStateContext
): Promise<void> {
  // Redis: fast reads for UI polling (TTL = 35 min, slightly over idle timeout)
  await redis.set(
    `agent:state:${ctx.sessionId}`,
    JSON.stringify(ctx),
    'EX',
    2100
  );

  // PostgreSQL: durable record for recovery and analytics
  await db.chatSession.update({
    where: { id: ctx.sessionId },
    data: {
      agentState: ctx.state,
      agentStateEnteredAt: ctx.enteredAt,
      agentMetadata: ctx.metadata as any,
      updatedAt: new Date(),
    },
  });
}
```

**Client-Side State Consumption:**

The frontend reads the agent state to display appropriate UI indicators.

```typescript
// hooks/useAgentState.ts

export function useAgentState(sessionId: string) {
  const { data } = useSWR<AgentStateContext>(
    sessionId ? `/api/chat/sessions/${sessionId}/state` : null,
    fetcher,
    { refreshInterval: 1000 } // poll every second while active
  );

  return {
    state: data?.state ?? 'idle',
    isThinking: data?.state === 'processing',
    isStreaming: data?.state === 'responding',
    isReady: data?.state === 'idle' || data?.state === 'waiting_feedback',
    model: data?.metadata?.currentModel,
  };
}
```

---

### 5.2 Model Routing

Not every AI task requires the same model. EduLens routes each task to the cheapest model that meets its quality requirements. This reduces cost by 40-60% compared to routing everything through a single high-end model.

#### Routing Matrix

```
┌──────────────────────────────────────────────────────────────┐
│                     Model Routing Layer                        │
│                                                               │
│  Incoming Task                                                │
│      │                                                        │
│      ▼                                                        │
│  ┌──────────────┐                                             │
│  │   Router     │                                             │
│  │              │                                             │
│  │  Classify    │───► Classification / Extraction tasks       │
│  │  task type   │     ───────────────────────────────────     │
│  │              │     Model: Claude Haiku                     │
│  │              │     Cost: ~$0.25/M input, $1.25/M output    │
│  │              │     Latency: ~200-400ms TTFT                │
│  │              │                                             │
│  │              │───► Conversational / Generation tasks        │
│  │              │     ───────────────────────────────────     │
│  │              │     Model: Claude Sonnet                    │
│  │              │     Cost: ~$3/M input, $15/M output         │
│  │              │     Latency: ~400-800ms TTFT                │
│  │              │                                             │
│  │              │───► Summarization / Background tasks         │
│  │              │     ───────────────────────────────────     │
│  │              │     Model: Claude Haiku                     │
│  │              │     Cost: ~$0.25/M input, $1.25/M output    │
│  │              │     Latency: N/A (async)                    │
│  └──────────────┘                                             │
└──────────────────────────────────────────────────────────────┘
```

#### Task-to-Model Mapping

| Task | Model | Rationale |
|---|---|---|
| **Student chat** (Socratic explanation) | Sonnet | Requires nuanced pedagogy, age-appropriate language, Socratic questioning — quality directly impacts learning |
| **Parent chat** (insight conversation) | Sonnet | This is the product's core value delivery — must feel like talking to an expert teacher |
| **Intent classification** (guardrail check) | Haiku | Binary or categorical decision: is this message in-scope? Fast, cheap, reliable for simple classification |
| **Error type classification** | Haiku | Structured classification with clear categories. Heuristics handle 80%; Haiku handles edge cases |
| **Signal extraction** (post-turn) | Haiku | Structured JSON extraction from conversation text. Well-suited to fast, cheap model |
| **Conversation summarization** | Haiku | Compression task with clear instructions. Haiku produces summaries comparable to Sonnet at 1/12th the cost |
| **Topic detection** | Rule-based | No LLM needed — regex pattern matching is sufficient (see §4.4) |
| **Suggested question generation** | Haiku | Short creative task constrained by profile data. Haiku quality is sufficient |

#### Router Implementation

```typescript
// services/agents/model-router.ts

export type TaskType =
  | 'student_chat'
  | 'parent_chat'
  | 'intent_classification'
  | 'error_classification'
  | 'signal_extraction'
  | 'summarization'
  | 'suggested_questions';

interface ModelConfig {
  modelId: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

const MODEL_ROUTING: Record<TaskType, ModelConfig> = {
  // Sonnet: quality-critical conversational tasks
  student_chat: {
    modelId: 'claude-sonnet-4-20250514',
    maxTokens: 1_000,    // short, focused Socratic responses
    temperature: 0.7,    // slight creativity for natural conversation
    description: 'Student explanation — Socratic method, age-appropriate',
  },
  parent_chat: {
    modelId: 'claude-sonnet-4-20250514',
    maxTokens: 2_000,    // longer, data-rich parent responses
    temperature: 0.5,    // more precise — citing specific numbers
    description: 'Parent insight — grounded, professional, data-driven',
  },

  // Haiku: structured extraction and classification tasks
  intent_classification: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 100,      // just a label + confidence
    temperature: 0.0,    // deterministic classification
    description: 'Guardrail — is this message in-scope?',
  },
  error_classification: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 200,      // error type + brief reasoning
    temperature: 0.0,
    description: 'Classify wrong answer into error type',
  },
  signal_extraction: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 300,      // structured JSON output
    temperature: 0.0,
    description: 'Extract learning signals from conversation turn',
  },
  summarization: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 500,      // concise conversation summary
    temperature: 0.0,
    description: 'Summarize session for cross-session memory',
  },
  suggested_questions: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 200,      // 2 short questions
    temperature: 0.8,    // higher creativity for natural question phrasing
    description: 'Generate suggested follow-up questions',
  },
};

export function getModelConfig(taskType: TaskType): ModelConfig {
  return MODEL_ROUTING[taskType];
}

export async function routedModelCall(
  client: Anthropic,
  taskType: TaskType,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: { cacheSystem?: boolean; stream?: boolean }
): Promise<Anthropic.Message> {
  const config = getModelConfig(taskType);

  const systemBlock: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: systemPrompt,
      ...(options?.cacheSystem ? { cache_control: { type: 'ephemeral' as const } } : {}),
    },
  ];

  return client.messages.create({
    model: config.modelId,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemBlock,
    messages,
  });
}
```

#### Guardrail Pipeline with Model Routing

The guardrail layer (intent classification) runs as a fast Haiku call *before* the main Sonnet call. This ensures off-topic or unsafe messages are rejected without consuming expensive Sonnet tokens.

```
User message arrives
    │
    ▼
┌──────────────────────────┐
│  Intent Classification   │
│  Model: Haiku            │
│  Latency: ~200ms         │
│  Cost: ~$0.00005         │
│                          │
│  Output:                 │
│    intent: in_scope |    │
│            off_topic |   │
│            unsafe        │
│    confidence: 0.0-1.0   │
└────────────┬─────────────┘
             │
     ┌───────┴───────┐
     │               │
  in_scope       off_topic / unsafe
     │               │
     ▼               ▼
┌─────────────┐  ┌──────────────────┐
│ Main Agent  │  │ Canned rejection │
│ Model:      │  │ response (no     │
│ Sonnet      │  │ model call)      │
│ (streaming) │  │                  │
└─────────────┘  └──────────────────┘
```

**Intent Classification Prompt (Haiku):**

```
Classify the following user message in an educational chat context.
The chat is about a child's academic test performance for NSW OC/Selective School exams.

ALLOWED topics:
- Questions about the child's test performance, scores, skills
- Questions about study strategies, what to focus on
- Questions about specific test questions the child got wrong
- Questions about progress over time

NOT ALLOWED:
- Medical, psychological, or behavioral advice
- Comparison to other students
- Exam predictions or school admission likelihood
- Completely unrelated topics (weather, sports, recipes, etc.)
- Requests for personal information about other users

Message: "{user_message}"

Respond with JSON only:
{"intent": "in_scope" | "off_topic" | "unsafe", "confidence": 0.0-1.0, "reason": "brief explanation"}
```

#### Cost Impact of Model Routing

| Scenario | Without routing (all Sonnet) | With routing | Savings |
|---|---|---|---|
| 10-turn parent chat session | $0.44 | $0.36 | 18% |
| Error classification (35 questions) | $0.42 | $0.035 | 92% |
| Session summarization | $0.05 | $0.004 | 92% |
| Signal extraction (10 turns) | $0.15 | $0.013 | 91% |
| **Total per test+chat cycle** | **$1.06** | **$0.41** | **61%** |

---

### 5.3 Agent 1: Student Explanation Agent

**Purpose:** Help students understand why they got a question wrong, using the Socratic method.

**Context Window Contents:**

```
[SYSTEM PROMPT]
[QUESTION DATA: stem, options, correct answer, student's answer, distractor explanations]
[STUDENT CONTEXT: grade level, current mastery of relevant skill]
[CONVERSATION HISTORY: this question's chat only]
```

**System Prompt:**

```
You are a patient, encouraging tutor helping a primary school student
understand a question they got wrong on a practice test.

CONSTRAINTS:
- You may ONLY discuss the specific question provided in context.
- Do NOT answer unrelated questions or engage in general tutoring.
- Do NOT reveal the correct answer immediately. Guide the student toward it.
- Use the Socratic method: ask guiding questions, provide hints.
- If the student asks for the answer directly after 2-3 exchanges, provide
  it with a clear explanation.
- Use simple language appropriate for a Year 3-6 student.
- Be encouraging but honest. Acknowledge difficulty without false praise.

QUESTION CONTEXT:
{question_data}

STUDENT'S ANSWER: {student_answer}
CORRECT ANSWER: {correct_answer}
SKILL: {skill_label}
ERROR TYPE: {error_classification}

Respond in 2-3 short sentences. Use one guiding question per turn.
If the error type is "misread_question", gently point out what the
question is actually asking before diving into content.
If the error type is "careless_error", acknowledge they likely know this
and ask them to re-read carefully.
```

**Behavior Examples:**

| Scenario | Agent Response |
|---|---|
| Concept gap in fractions | "Let's think about this step by step. If you have 3/4 of a pizza and eat 1/2 of what you have, how much of the whole pizza have you eaten? What operation would you use?" |
| Misread question | "I notice the question asks for which option is NOT correct. Let's read the question one more time — what exactly is it asking us to find?" |
| Careless arithmetic | "You're close! I think you know how to do this. Can you try the calculation one more time, maybe writing out each step?" |

**Signal Extraction:**

After each conversation turn, the system extracts:
- `understanding_demonstrated`: boolean — did the student show they now understand?
- `confusion_topic`: string — what specific concept remains confusing?
- `engagement_level`: low | medium | high — based on response length and follow-up questions
- `error_reclassification`: optional — should the error type be updated?

**Student Agent Request Flow with State Machine:**

```
Student taps "Why did I get this wrong?"
    │
    ▼
State: IDLE → PROCESSING
    │
    ├── 1. Intent classification (Haiku, ~200ms)
    │      Is this an in-scope question about the test question?
    │      → yes: continue
    │      → no: canned response, State → WAITING_FEEDBACK
    │
    ├── 2. Context assembly
    │      Question data + student mastery + conversation history
    │
    ├── 3. Claude call (Sonnet, streaming)
    │
    ▼
State: PROCESSING → RESPONDING (first token)
    │
    ├── 4. Stream tokens to client via SSE
    │
    ▼
State: RESPONDING → WAITING_FEEDBACK (done event)
    │
    ├── 5. Async: signal extraction (Haiku)
    │      Extract understanding_demonstrated, confusion_topic, etc.
    │      Feed signals to Profile Engine
    │
    ▼
Waiting for student's next message or timeout
```

---

### 5.4 Agent 2: Parent Insight Agent

**Purpose:** Answer parent questions about their child's learning, grounded entirely in profile data.

**Context Window Contents:**

```
[SYSTEM PROMPT]
[STUDENT PROFILE: full Learning DNA snapshot]
[RECENT TEST RESULTS: last 3 test summaries]
[CONVERSATION HISTORY: parent's chat session]
```

**System Prompt:**

```
You are an experienced, caring academic advisor speaking with a parent
about their child's learning progress. You have access to detailed
performance data from structured assessments.

VOICE & TONE:
- Speak like a trusted teacher at a parent-teacher conference.
- Be warm but direct. Parents want clarity, not vagueness.
- Use "your child" or the student's first name, never "the student".
- Acknowledge effort and progress before discussing weaknesses.
- Frame weaknesses as opportunities, not deficits.

CONSTRAINTS:
- ONLY reference data present in the student profile. Never invent data.
- When citing numbers, be specific: "scored 7/10 on inference questions
  across the last 3 tests" not "did well on inference".
- If asked about something the data doesn't cover, say so explicitly:
  "I don't have data on that yet. After a few more tests, I'll be able
  to give you a clearer picture."
- Do NOT make predictions about exam outcomes or school admissions.
- Do NOT provide medical, psychological, or behavioral advice.
- Do NOT compare the child to other students.
- Provide actionable recommendations when appropriate: specific skills
  to practice, types of questions to focus on, time management tips.

SUGGESTED FOLLOW-UP QUESTIONS:
After each response, suggest 1-2 natural follow-up questions the parent
might want to ask, based on the data.

STUDENT PROFILE:
{learning_dna_json}

RECENT TESTS:
{recent_test_summaries}
```

**Behavior Examples:**

| Parent Question | Data Referenced | Response Approach |
|---|---|---|
| "Why is thinking skills weak?" | `skill_graph.nodes` where category = "Thinking Skills" | Cite specific sub-skills with mastery < 0.5, explain what they mean in plain language, suggest focus areas |
| "Is he rushing?" | `time_behavior.rush_threshold`, `stamina_curve` | Show the data: "In the last test, answers after question 25 were submitted in under 20 seconds each, and accuracy dropped from 80% to 50%. This suggests time pressure in the final third." |
| "What should we focus on?" | Lowest mastery sub-skills + error profile | Prioritize by impact: "The biggest opportunity is number patterns — it appears in ~20% of test questions and current accuracy is 45%. Practicing pattern recognition exercises for 15 minutes daily would likely show improvement." |
| "Is she getting better?" | `skill_graph.nodes[].trend`, profile snapshots | Compare snapshots: "Over the last 4 tests, reading comprehension has improved from 60% to 75%. Mathematical reasoning has been stable at around 65%." |

**Suggested Questions Feature:**

The agent appends 2 suggested follow-up questions to each response:

```
---
You might also want to ask:
• "What types of mistakes is she making most often?"
• "How does her time management compare to earlier tests?"
```

These are generated dynamically based on which areas of the profile haven't been discussed yet in the conversation.

**Suggested Question Generation (Haiku):**

```typescript
// services/agents/suggested-questions.ts

const SUGGESTION_PROMPT = `Based on this student profile and the conversation so far, suggest 2 natural follow-up questions the parent might want to ask. Focus on areas of the profile that haven't been discussed yet.

STUDENT PROFILE:
{profile_summary}

TOPICS ALREADY DISCUSSED:
{discussed_topics}

Return a JSON array of exactly 2 strings. Each should be a natural question a parent would ask. Keep them under 15 words each.`;

export async function generateSuggestedQuestions(
  client: Anthropic,
  profileSummary: string,
  discussedTopics: string[]
): Promise<string[]> {
  const config = getModelConfig('suggested_questions');
  const response = await client.messages.create({
    model: config.modelId,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    messages: [
      {
        role: 'user',
        content: SUGGESTION_PROMPT
          .replace('{profile_summary}', profileSummary)
          .replace('{discussed_topics}', discussedTopics.join(', ')),
      },
    ],
  });

  return JSON.parse(response.content[0].text) as string[];
}
```

---

### 5.5 Future: Adaptive Tutor Agent (Phase 2+)

**Purpose:** Proactively guide students through targeted practice based on their Learning DNA.

This agent would:
- Select practice questions targeting the student's weakest sub-skills
- Adjust difficulty dynamically based on performance
- Provide scaffolded hints that adapt to the student's error patterns
- Generate mini-assessments to confirm skill improvement

**Not in MVP scope.** Documented here as the natural evolution path to inform architecture decisions.

---

### 5.6 Prompt Caching Strategy

Prompt caching is critical to EduLens economics. Within a chat session, the system prompt (~1,500 tokens) and student profile data (~2,000-4,000 tokens) remain stable across turns. Without caching, these tokens are re-processed on every request. With caching, they are processed once and read from cache for subsequent turns at 10% of the original cost.

#### What Gets Cached

```
┌──────────────────────────────────────────────────────────────┐
│                  Context Window Layout                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  SYSTEM BLOCK 1: Agent Instructions         ~1,500 tok │  │
│  │  cache_control: { type: "ephemeral" }                   │  │
│  │                                                         │  │
│  │  Stable across ALL turns in a session.                  │  │
│  │  Cache hit rate: ~100% after turn 1.                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  SYSTEM BLOCK 2: Student Profile + Test Data  ~3,000 tok│  │
│  │  cache_control: { type: "ephemeral" }                   │  │
│  │                                                         │  │
│  │  Stable within a session. Profile only changes when     │  │
│  │  a new test is completed (not during chat).             │  │
│  │  Cache hit rate: ~100% within session.                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  SYSTEM BLOCK 3: Cross-Session Recall           ~800 tok│  │
│  │  cache_control: { type: "ephemeral" }                   │  │
│  │                                                         │  │
│  │  Stable within a session (past summaries don't change). │  │
│  │  Cache hit rate: ~100% within session.                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  MESSAGES: Conversation history              variable   │  │
│  │  NOT cached (changes every turn)                        │  │
│  │                                                         │  │
│  │  Turn 1: 200 tokens                                     │  │
│  │  Turn 5: 2,500 tokens                                   │  │
│  │  Turn 10: 5,000 tokens (older turns summarized)         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### Caching Rules

| Content | Cached? | Reason | Breakpoint Size |
|---|---|---|---|
| System prompt (agent instructions) | Yes | Identical across all turns in a session | 1,024+ tokens (meets Anthropic minimum) |
| Student profile data | Yes | Only changes between sessions, not within | 1,024+ tokens |
| Cross-session recall summaries | Yes | Fixed at session start | Only if ≥1,024 tokens; otherwise merged with profile block |
| Conversation history | No | Changes every turn | N/A |
| User's current message | No | Unique per turn | N/A |

**Implementation (extends §4.2 cached-request pattern):**

```typescript
// services/agents/cached-agent-call.ts

import Anthropic from '@anthropic-ai/sdk';

interface CacheableContext {
  agentPrompt: string;         // ~1,500 tokens — CACHE
  profileData: string;         // ~3,000 tokens — CACHE
  crossSessionRecall: string;  // ~800 tokens  — CACHE (if large enough)
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function cachedAgentCall(
  client: Anthropic,
  taskType: TaskType,
  context: CacheableContext
): Promise<Anthropic.MessageStream> {
  const config = getModelConfig(taskType);

  // Build system blocks with cache control
  // Anthropic requires cached blocks to be contiguous and at the start
  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: 'text',
      text: context.agentPrompt,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `STUDENT PROFILE:\n${context.profileData}`,
      cache_control: { type: 'ephemeral' },
    },
  ];

  // Only add recall as cached block if it's substantial enough
  if (context.crossSessionRecall.length > 500) {
    systemBlocks.push({
      type: 'text',
      text: `PREVIOUS CONVERSATIONS:\n${context.crossSessionRecall}`,
      cache_control: { type: 'ephemeral' },
    });
  } else if (context.crossSessionRecall) {
    // Append to profile block if too small to cache independently
    systemBlocks[1] = {
      ...systemBlocks[1],
      text: `${systemBlocks[1].text}\n\nPREVIOUS CONVERSATIONS:\n${context.crossSessionRecall}`,
    };
  }

  return client.messages.stream({
    model: config.modelId,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: systemBlocks,
    messages: context.conversationMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });
}
```

#### Cache Economics Per Turn

For a parent chat session using Sonnet, measuring a single turn at turn 5 of a 10-turn conversation:

| Component | Tokens | Without cache | With cache (hit) | Savings |
|---|---|---|---|---|
| System prompt | 1,500 | $0.0045 | $0.000450 | 90% |
| Profile data | 3,000 | $0.0090 | $0.000900 | 90% |
| Cross-session recall | 800 | $0.0024 | $0.000240 | 90% |
| Conversation history (not cached) | 3,500 | $0.0105 | $0.010500 | 0% |
| **Total input cost (turn 5)** | **8,800** | **$0.0264** | **$0.012090** | **54%** |
| Output (~400 tokens) | 400 | $0.006 | $0.006 | 0% |
| **Total turn cost** | | **$0.0324** | **$0.01809** | **44%** |

Cache write cost (turn 1 only): 25% premium on cached tokens = $0.004125 additional on first turn. Amortized across 10 turns, this is negligible.

#### Cache Invalidation

Caches are ephemeral (Anthropic manages TTL, typically 5 minutes). For EduLens, this is ideal:
- Within a chat session, turns happen within minutes — cache stays warm
- Between sessions, cache expires naturally — no stale data risk
- Profile updates (from new tests) happen between sessions — cache is cold when profile changes

No manual invalidation logic is required.

---

### 5.7 Cost Model Per Student Per Month

This section provides a bottom-up cost estimate for AI API spend per active student per month, based on expected usage patterns in the NSW OC/Selective exam prep context.

#### Usage Assumptions

| Parameter | Value | Basis |
|---|---|---|
| Tests per month | 4 | Weekly practice test cadence |
| Questions per test | 35 | Standard OC mock test length |
| Wrong answers per test | ~10 | Assumes ~70% accuracy (typical for prep students) |
| Student chats per test | 4 | Student reviews ~40% of wrong answers via chat |
| Turns per student chat | 3 | Short Socratic exchange (student + AI + student + AI + final) |
| Parent chat sessions per month | 6 | ~1.5 per test (some tests prompt 2 sessions) |
| Turns per parent chat | 8 | Deeper exploratory conversation |
| Background tasks per test | 1 | Error classification, summarization, signal extraction |

#### Per-Task Token Consumption

| Task | Model | Input tokens | Output tokens | Calls/month |
|---|---|---|---|---|
| Student chat turn | Sonnet | 4,000 | 300 | 48 (4 tests × 4 chats × 3 turns) |
| Parent chat turn | Sonnet | 8,000 | 500 | 48 (6 sessions × 8 turns) |
| Intent classification | Haiku | 500 | 50 | 96 (every user message) |
| Error classification | Haiku | 800 | 100 | 40 (10 wrong × 4 tests) |
| Signal extraction | Haiku | 1,200 | 200 | 48 (after each student chat turn) |
| Session summarization | Haiku | 3,000 | 300 | 22 (16 student + 6 parent sessions) |
| Suggested questions | Haiku | 1,000 | 100 | 48 (after each parent turn) |

#### Monthly Cost Calculation

**Sonnet tasks (student + parent chat):**

```
Student chat:
  Input:  48 turns × 4,000 tokens = 192,000 tokens
  Cache hits (~54% saving on cached portion):
    Cached portion: 48 × 5,300 = 254,400 → billed at 10% = 25,440 effective
    Uncached portion: 48 × (4,000 - 5,300)...

  Simplified (with caching):
    Effective input tokens: 48 × 2,200 = 105,600 tokens
    Output tokens: 48 × 300 = 14,400 tokens
    Cost: (105,600 × $3/M) + (14,400 × $15/M) = $0.317 + $0.216 = $0.533

Parent chat:
  Effective input tokens (with caching): 48 × 4,500 = 216,000 tokens
  Output tokens: 48 × 500 = 24,000 tokens
  Cost: (216,000 × $3/M) + (24,000 × $15/M) = $0.648 + $0.360 = $1.008

Total Sonnet: $1.541
```

**Haiku tasks (classification, extraction, summarization):**

```
Intent classification:
  96 × (500 + 50) tokens = 52,800 tokens
  Cost: (48,000 × $0.25/M) + (4,800 × $1.25/M) = $0.012 + $0.006 = $0.018

Error classification:
  40 × (800 + 100) tokens = 36,000 tokens
  Cost: (32,000 × $0.25/M) + (4,000 × $1.25/M) = $0.008 + $0.005 = $0.013

Signal extraction:
  48 × (1,200 + 200) tokens = 67,200 tokens
  Cost: (57,600 × $0.25/M) + (9,600 × $1.25/M) = $0.014 + $0.012 = $0.026

Session summarization:
  22 × (3,000 + 300) tokens = 72,600 tokens
  Cost: (66,000 × $0.25/M) + (6,600 × $1.25/M) = $0.017 + $0.008 = $0.025

Suggested questions:
  48 × (1,000 + 100) tokens = 52,800 tokens
  Cost: (48,000 × $0.25/M) + (4,800 × $1.25/M) = $0.012 + $0.006 = $0.018

Total Haiku: $0.100
```

#### Monthly Cost Summary Per Student

```
┌──────────────────────────────────────────────────────────┐
│           AI API Cost Per Student Per Month                │
│                                                           │
│  ┌─────────────────────────────────┬──────────┐          │
│  │ Sonnet (chat conversations)     │  $1.54   │  94%     │
│  ├─────────────────────────────────┼──────────┤          │
│  │ Haiku (classification/extract)  │  $0.10   │   6%     │
│  ├─────────────────────────────────┼──────────┤          │
│  │ TOTAL AI API COST               │  $1.64   │          │
│  └─────────────────────────────────┴──────────┘          │
│                                                           │
│  Without prompt caching:             $2.85                │
│  Without model routing:              $4.20                │
│  Combined savings:                   61%                  │
│                                                           │
│  At $39/mo subscription:                                  │
│    AI API = 4.2% of revenue                               │
│    Gross margin headroom: 95.8%                           │
│                                                           │
│  At $59/mo subscription:                                  │
│    AI API = 2.8% of revenue                               │
│    Gross margin headroom: 97.2%                           │
└──────────────────────────────────────────────────────────┘
```

#### Scaling Projections

| Students | Monthly AI cost | Annual AI cost | Notes |
|---|---|---|---|
| 50 (beta) | $82 | $984 | Well within free-tier exploration |
| 200 (launch) | $328 | $3,936 | Manageable at any price point |
| 1,000 (growth) | $1,640 | $19,680 | At $39/mo = $468K revenue → 4.2% AI cost |
| 5,000 (scale) | $8,200 | $98,400 | Potential volume discount with Anthropic |

#### Cost Guardrails

To prevent runaway costs from heavy users or abuse:

```typescript
// services/billing/usage-limits.ts

export const USAGE_LIMITS = {
  // Per-student daily limits
  maxChatSessionsPerDay: 5,        // prevent chat abuse
  maxTurnsPerSession: 20,          // cap very long conversations
  maxTestsPerDay: 3,               // prevent excessive test-taking

  // Per-student monthly limits (soft — warn, don't block)
  softMonthlyTokenLimit: 500_000,  // ~$1.50 in Sonnet tokens
  hardMonthlyTokenLimit: 1_000_000, // ~$3.00 — block AI features, suggest upgrade

  // System-wide circuit breaker
  maxDailySpend: 50,               // $50/day — alert + throttle if exceeded
  maxMonthlySpend: 500,            // $500/month — hard stop, page on-call
};

export async function checkUsageLimits(
  db: PrismaClient,
  studentId: string
): Promise<{ allowed: boolean; reason?: string; warning?: string }> {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());

  const [dailySessions, monthlyTokens] = await Promise.all([
    db.chatSession.count({
      where: { studentId, createdAt: { gte: today } },
    }),
    db.chatSession.aggregate({
      where: { studentId, createdAt: { gte: monthStart } },
      _sum: { totalTokens: true },
    }),
  ]);

  if (dailySessions >= USAGE_LIMITS.maxChatSessionsPerDay) {
    return {
      allowed: false,
      reason: "You've had a busy day! Chat will be available again tomorrow.",
    };
  }

  const tokens = monthlyTokens._sum.totalTokens ?? 0;

  if (tokens >= USAGE_LIMITS.hardMonthlyTokenLimit) {
    return {
      allowed: false,
      reason: 'Monthly usage limit reached. Please contact support.',
    };
  }

  if (tokens >= USAGE_LIMITS.softMonthlyTokenLimit) {
    return {
      allowed: true,
      warning: 'You are approaching your monthly usage limit.',
    };
  }

  return { allowed: true };
}
```

#### Cost Monitoring Dashboard (Internal)

Key metrics to track:

| Metric | Source | Alert Threshold |
|---|---|---|
| Cost per student per day | Token usage × model pricing | > $0.15 (3× average) |
| Cache hit rate | Anthropic API usage response | < 80% (something broke) |
| Haiku:Sonnet call ratio | Request logs | < 1.5:1 (routing not working) |
| Average tokens per parent turn | Message metadata | > 12,000 (context bloat) |
| P95 time-to-first-token | Agent state timestamps | > 2 seconds |
| Daily total API spend | Aggregated billing | > $50 |
## 9. Tech Stack (v2 — Simplified)

v1 included FastAPI as a separate Python backend, Redis for caching, and AWS ECS for hosting. v2 simplifies to a single-runtime architecture: **Next.js handles everything** — pages, API routes, and AI orchestration. This reduces operational overhead, removes cross-service communication, and makes the MVP deployable as a single Vercel project.

### Changes from v1

| v1 | v2 | Rationale |
|---|---|---|
| Next.js API Routes + FastAPI/Python | **Next.js Route Handlers only** | Claude SDKs (Anthropic + AWS Bedrock) have first-class TypeScript support; no Python ecosystem advantage remains for prompt orchestration |
| PostgreSQL + Redis | **PostgreSQL only** | Timer state, session cache, and rate limiting are low-frequency operations for MVP scale; PostgreSQL handles them without a second data store |
| AWS ECS / Lambda | **Vercel** | Zero-config deployment, built-in edge functions, native Next.js support, generous free tier for MVP |
| Claude API (Anthropic only) | **Claude API via Anthropic OR Amazon Bedrock** | Bedrock provides a single-vendor AWS billing path, VPC-private endpoints, and avoids a separate Anthropic API key for teams already on AWS |

### Frontend

| Layer | Technology | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | SSR for landing/SEO, client components for interactive test UI, Route Handlers for API |
| Styling | **Tailwind CSS** | Rapid iteration, consistent design system, small bundle |
| State | **React Context + SWR** | Lightweight; no Redux overhead for MVP |
| Charts | **Recharts** | Lightweight, React-native charting for skill radar, trends |
| Real-time | **Server-Sent Events (SSE)** | AI response streaming; simpler than WebSocket for unidirectional server→client flow (see §4.5) |

### Backend (All Next.js Route Handlers)

| Layer | Technology | Rationale |
|---|---|---|
| API | **Next.js Route Handlers** (`app/api/`) | Single runtime for all endpoints — test engine, profile, conversation, admin CRUD |
| AI — Option A | **Anthropic SDK** (`@anthropic-ai/sdk`) | Direct API access, prompt caching support, streaming, lowest-latency path to Claude |
| AI — Option B | **AWS Bedrock Runtime SDK** (`@aws-sdk/client-bedrock-runtime`) | Claude models via Bedrock; single AWS bill, IAM-based auth, VPC endpoint support |
| Auth | **NextAuth.js** | Simple JWT-based auth with email/password + potential Google OAuth |
| Validation | **Zod** | Runtime type safety for all request/response schemas |

#### Model Routing: Anthropic vs Bedrock

The system abstracts the Claude API behind a thin routing layer so the deployment can target either Anthropic's API or Amazon Bedrock without changing application code.

```typescript
// lib/ai/model-router.ts

import Anthropic from '@anthropic-ai/sdk';
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

export type AIProvider = 'anthropic' | 'bedrock';

const PROVIDER: AIProvider = (process.env.AI_PROVIDER as AIProvider) ?? 'anthropic';

// Bedrock model IDs map to Anthropic model names
const BEDROCK_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-20250514': 'anthropic.claude-sonnet-4-20250514-v1:0',
  'claude-haiku-4-20250414': 'anthropic.claude-haiku-4-20250414-v1:0',
};

export function getAnthropicClient(): Anthropic {
  if (PROVIDER === 'bedrock') {
    // Anthropic SDK supports Bedrock natively via the bedrock connector
    return new Anthropic({
      // When using Bedrock, auth comes from AWS credentials (env or IAM role)
    });
  }
  return new Anthropic(); // uses ANTHROPIC_API_KEY from env
}

export function getModelId(modelName: string): string {
  if (PROVIDER === 'bedrock') {
    return BEDROCK_MODEL_MAP[modelName] ?? modelName;
  }
  return modelName;
}
```

**Environment configuration:**

```bash
# .env.local — Option A: Anthropic direct
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# .env.local — Option B: Amazon Bedrock
AI_PROVIDER=bedrock
AWS_REGION=ap-southeast-2
# AWS credentials via IAM role (on Vercel) or local profile
```

### Data

| Layer | Technology | Rationale |
|---|---|---|
| Primary DB | **PostgreSQL** | JSONB for flexible profile storage, strong relational integrity for questions/tests |
| ORM | **Prisma** | Type-safe database access, good migration tooling, works with Vercel |
| Event Store | **PostgreSQL** (append-only table) | Simple event sourcing without dedicated infrastructure for MVP |
| Session/Timer State | **PostgreSQL** (with short-lived rows) | Timer state and active sessions stored in a dedicated table with TTL cleanup; avoids Redis dependency at MVP scale |

#### Timer State Without Redis

v1 used Redis for sub-second timer reads. At MVP scale (hundreds, not thousands, of concurrent test sessions), PostgreSQL handles this workload. The timer remains server-authoritative; the client polls or syncs on key events rather than on every tick.

```sql
CREATE TABLE active_timers (
  session_id    UUID PRIMARY KEY REFERENCES test_sessions(id),
  started_at    TIMESTAMPTZ NOT NULL,
  duration_sec  INTEGER NOT NULL,
  paused_at     TIMESTAMPTZ,        -- NULL if running
  elapsed_sec   INTEGER DEFAULT 0,  -- updated on pause/resume
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cleanup: delete rows for completed/expired sessions via scheduled job
CREATE INDEX idx_active_timers_expiry ON active_timers (started_at);
```

The client calculates the countdown locally from `started_at` and `duration_sec`. On submit, the server validates elapsed time server-side. No sub-second server polling is required.

**Scaling note:** If concurrent test sessions exceed ~500 and timer polling creates database pressure, introduce Redis as a targeted cache layer for `active_timers` only. This is a localized change, not an architectural shift.

### Infrastructure

| Layer | Technology | Rationale |
|---|---|---|
| Hosting | **Vercel** | Zero-config Next.js deployment, automatic preview deployments, edge functions for low-latency API routes |
| Database | **Vercel Postgres** (managed Neon) or **Supabase** or **AWS RDS** | Managed PostgreSQL; Vercel Postgres is simplest for zero-config; RDS for teams already on AWS |
| Storage | **Vercel Blob** or **S3** | Question images, exported reports |
| Monitoring | **Vercel Analytics + Sentry** | Error tracking, performance monitoring, Web Vitals |
| CI/CD | **GitHub Actions + Vercel** | Push-to-deploy on main; preview deploys on PRs |

### Why This Stack (v2)

- **Single runtime** — One Next.js project, one language (TypeScript), one deployment target. No cross-service HTTP calls, no Python/Node bridge, no separate deployments for AI services.
- **Vercel over ECS** — ECS requires container management, load balancer config, VPC networking, and CloudFormation/CDK. Vercel handles all of this implicitly. For an MVP targeting hundreds of users, Vercel's serverless model is both simpler and cheaper.
- **PostgreSQL over PostgreSQL + Redis** — Every additional data store doubles operational complexity: connection management, failover, monitoring, cost. At MVP scale, PostgreSQL handles session state, timer state, and chat context without measurable latency issues. Redis can be introduced later as a targeted optimization if needed.
- **Bedrock as an option** — Teams already on AWS benefit from single-bill pricing, IAM-based auth (no separate API key management), and VPC-private endpoints for compliance. The Anthropic direct API remains the default for simplicity and lower latency.
- **Claude API** — The product's differentiation depends on high-quality, grounded AI responses. Claude's instruction-following and context window handle the complex system prompts required by our agents. Both the Anthropic SDK and Bedrock SDK support streaming, prompt caching, and all model features needed by the Conversation Engine.

---

## 10. MVP Phasing

### Phase 1: Foundation (MVP)

**Goal:** Validate that parents value interactive insight over static reports, students engage with AI explanation, and profile-driven conversation feels meaningful.

**Scope:**

| Feature | Details | Priority |
|---|---|---|
| OC Timed Test | 30-35 MCQ, 30-min timer, per-question timing | Must have |
| Auto-Scoring | Immediate results with skill breakdown | Must have |
| Student Explanation Chat | AI explains wrong answers, Socratic method | Must have |
| Basic Student Profile | Skill graph (flat), error type classification | Must have |
| Parent AI Chat | Profile-grounded conversation | Must have |
| Parent Dashboard | Skill radar, basic trend chart | Must have |
| Admin: Question CRUD | Create/edit/tag questions | Must have |
| Landing Page | Value proposition, signup flow | Must have |
| Auth | Email/password login, parent-student linking | Must have |
| Mobile Responsive | All screens work on mobile | Must have |

**Explicit Cut Lines (NOT in Phase 1):**

- No adaptive question selection
- No cohort comparison / percentile rankings
- No multiple exam types (Selective, HSC)
- No AI-generated questions
- No open-ended tutoring chat
- No long-term study plans
- No subscription/payment system
- No native mobile app
- No confidence estimator (collect data silently, don't expose)
- No multi-language support

**Success Metrics:**

| Metric | Target |
|---|---|
| Students completing tests | 100 in first month |
| Parents initiating AI chat | 60% of parents with test results |
| Parent return rate | 20% take a second test within 2 weeks |
| Student chat engagement | 40% of students chat about at least 1 wrong answer |

### Phase 2: Depth

- Full Learning DNA with confidence estimator
- Multi-test trend analysis with visual timeline
- Richer error classification (LLM-assisted)
- Adaptive Tutor Agent (targeted practice)
- Question bank expansion (Selective School format)
- Export: PDF summary reports (for parents who want printable)

### Phase 3: Scale

- Cohort benchmarking (anonymous, opt-in)
- Subscription system with free trial
- Parent mobile app (React Native)
- Teacher/tutor accounts (view student profiles)
- API for integration with tutoring centers
- Multi-region support (VIC, QLD exam formats)

---

## 11. Competitive Moat Analysis

### Landscape

| Competitor | Strengths | Weaknesses |
|---|---|---|
| **MockStar** | Large question bank, established brand, percentile rankings | Static PDF reports, no AI insight, no conversation, scores-only |
| **TestPapers.com** | Cheap, large volume | Zero personalization, just downloadable PDFs |
| **Private tutors** | Deep personalization, relationship trust | $60-100/hr, limited availability, no data persistence |
| **Kumon/Mathnasium** | Structured curriculum, physical presence | One-size-fits-all, no AI, expensive |
| **Generic AI tutors** (e.g., Khanmigo) | Broad coverage, good AI | Not focused on AU exam prep, no structured profile, no parent interface |

### EduLens Moat

**1. The Living Profile (Learning DNA)**

Every other platform treats each test as an isolated event. EduLens builds a **cumulative, evolving model** of how a student learns. After 5 tests, EduLens knows more about a student's learning patterns than most human tutors.

*Defensibility:* Data compounds over time. The more tests a student takes, the more valuable the profile becomes. Switching to a competitor means losing this accumulated intelligence.

**2. Conversation as Interface**

Parents don't want to interpret radar charts. They want to ask "Is she getting better?" and get a grounded, specific answer. The conversational interface is radically more accessible than any dashboard.

*Defensibility:* Building a high-quality, profile-grounded conversational AI requires deep integration between the profile engine and the conversation engine. This is not a chatbot bolt-on — it's architecturally fundamental.

**3. Dual-Loop Signal Collection**

```
Test Performance ──► Profile ──► Parent AI Response
       │                              │
       ▼                              ▼
Student Chat ──────► Profile    Parent questions reveal
(adds confusion       update    what parents actually
 pattern signals)               care about
```

The student chat during error review adds signal that no test-only platform can capture. When a student says "I thought it was asking about X" during chat, the system learns something a score never reveals.

*Defensibility:* This dual signal loop creates a data advantage that grows with every interaction. Competitors would need to replicate the entire architecture, not just add a chatbot.

**4. Parent-First Value Delivery**

In the NSW market, **parents are the buyer**. Every competitor sells to students and reports to parents as an afterthought. EduLens makes the parent experience the primary product surface. The parent AI chat is not a feature — it's the reason parents pay.

*Defensibility:* Market positioning is hard to copy. Competitors who add a parent feature are still fundamentally student-first platforms.

**5. AU Exam Specificity**

The question bank, skill taxonomy, and error patterns are tuned to NSW OC and Selective School exams. This is not a generic "math tutor" — it understands the specific types of thinking skills, reading comprehension, and mathematical reasoning that appear in these tests.

*Defensibility:* Niche focus creates depth that generalist platforms can't match without significant investment in a small (but high-value) market.

### Why This Beats the Alternatives

| Parent Need | Tutor | MockStar | EduLens |
|---|---|---|---|
| "Why is my child struggling in thinking skills?" | Verbal opinion after 3+ sessions | Not available | Specific data-driven answer in 10 seconds |
| "Is she rushing through questions?" | Maybe noticed, maybe not | Not tracked | Quantified with per-question timing analysis |
| "What should we focus on this week?" | Generic curriculum suggestions | Not available | Targeted recommendation based on error patterns and skill gaps |
| "Is she actually improving?" | Subjective impression | Score trend only | Multi-dimensional trend across skills, error types, and time behavior |
| Cost per month | $500-1000 | $30-50 | $30-60 (competitive with platforms, fraction of tutoring) |
| Available | 1-2 hours/week | Anytime | Anytime, instant responses |

---

## Appendix A: OC/Selective Exam Skill Taxonomy

### Reading

| Sub-skill | OC Weight | Description |
|---|---|---|
| Main Idea | Medium | Identify central theme or argument |
| Inference & Deduction | High | Draw conclusions not explicitly stated |
| Vocabulary in Context | Medium | Determine word meaning from surrounding text |
| Author's Purpose | Low | Understand why the author wrote the text |
| Text Structure | Low | Identify organizational patterns |

### Mathematical Reasoning

| Sub-skill | OC Weight | Description |
|---|---|---|
| Number Patterns | High | Identify and extend numerical sequences |
| Arithmetic Operations | Medium | Multi-step calculations, order of operations |
| Fractions & Decimals | Medium | Operations, conversions, comparisons |
| Geometry & Spatial | Medium | Shapes, area, perimeter, spatial reasoning |
| Word Problems | High | Translate language into mathematical operations |
| Data Interpretation | Low | Read charts, tables, graphs |

### Thinking Skills

| Sub-skill | OC Weight | Description |
|---|---|---|
| Analogies | High | Identify relationships between concept pairs |
| Pattern Recognition | High | Visual and abstract pattern completion |
| Logical Deduction | Medium | Syllogisms, if-then reasoning |
| Spatial Reasoning | Medium | Rotation, reflection, folding |
| Classification | Low | Group items by shared properties |

### Writing (Selective Only — Phase 2+)

| Sub-skill | Weight | Description |
|---|---|---|
| Persuasive Writing | High | Structured argument with evidence |
| Narrative Writing | Medium | Story structure, character, setting |
| Grammar & Mechanics | Medium | Sentence structure, punctuation, spelling |

---

## Appendix B: Glossary

| Term | Definition |
|---|---|
| **Bounded Context** | A self-contained domain within the system with clear boundaries and interfaces (e.g., Test Engine, Profile Engine, Conversation Engine) |
| **Confidence Estimator** | Inference of how certain a student is in their answers, based on behavioral signals like answer changes and time-on-question ratios |
| **Conversation Memory** | The tiered system (short-term, medium-term, long-term) that preserves conversational context across turns and sessions; enables the AI to recall past discussions and avoid repetition (see §4.1) |
| **Error Pattern Profile** | Classification of why a student gets answers wrong — concept gap, careless error, time pressure, misread question, or elimination failure |
| **Event Sourcing** | Architecture pattern where all profile changes are stored as immutable events, enabling full history replay and trend analysis |
| **Grounded Generation** | AI responses that are traceable to specific structured data (test scores, skill levels, timing data), not hallucinated or invented |
| **Guardrail Layer** | Pre- and post-processing checks on AI requests and responses that enforce scope constraints (no off-topic, no hallucinated data, no medical/psychological advice) and validate that outputs remain within the agent's defined boundary (see §3, Context 3) |
| **Learning DNA** | The graph-based, evolving student intelligence model at the heart of EduLens — encompasses skill graph, error patterns, time behavior, and confidence estimates |
| **Model Routing** | The abstraction layer that directs Claude API calls to either Anthropic's direct API or Amazon Bedrock, configured via environment variable, so the application code is provider-agnostic (see §9) |
| **Prompt Caching** | An Anthropic API feature that avoids re-processing stable context (system prompt, profile data) on repeated requests within a session, reducing per-turn input costs by ~29% (see §4.2) |
| **Signal Extraction** | The process of deriving structured data from unstructured interactions — e.g., extracting confusion patterns, engagement level, or error reclassifications from chat messages |
| **Skill Graph** | Hierarchical map of subject areas to sub-skills, each with mastery level, confidence score, trend direction, and sample size |
| **SSE (Server-Sent Events)** | A unidirectional HTTP-based protocol where the server pushes events to the client over a long-lived connection; used in EduLens for streaming AI responses token-by-token so parents see immediate visual feedback (see §4.5) |
| **Time Behavior Model** | Analysis of how a student allocates time across a test — average time per question, rush threshold, stamina curve, and completion rate |

---

*This document continues from [AI-EDU-HighLevel-Design-v2-section4.md](./AI-EDU-HighLevel-Design-v2-section4.md) and is the architectural companion to [AI-EDU-UI-Mockup.html](./AI-EDU-UI-Mockup.html).*
