# AGENTS.md — Runtime Rules & Memory Management

> **Loaded at:** Agent initialization
> **Scope:** Operational rules governing agent behaviour, memory access, model routing, session lifecycle, security, and multi-child family support

---

## 1. Agent Types

EduLens runs two distinct agent types, each with its own identity, access scope, and behaviour rules.

### Student Agent

| Property | Value |
|----------|-------|
| **Actor ID** | `student_{student_id}` |
| **Persona** | Warm, Socratic tutor (see [SOUL.md](./SOUL.md)) |
| **Target users** | Year 4 (OC Prep) and Year 6 (Selective Prep) students |
| **Memory namespace** | `/students/{student_id}/learning/` |
| **Access scope** | Own data ONLY — hard isolation |
| **Model default** | Sonnet |

### Parent Agent

| Property | Value |
|----------|-------|
| **Actor ID** | `family_{family_id}` |
| **Persona** | Professional, data-driven advisor (see [SOUL.md](./SOUL.md)) |
| **Target users** | Parents/guardians |
| **Memory namespaces** | `/families/{family_id}/insights/` + `/students/{student_id}/learning/` (for each child) |
| **Access scope** | Family-wide — all children within the family |
| **Model default** | Sonnet |

---

## 2. Memory Management (AgentCore-based)

### Namespace Design

```
/students/{student_id}/learning/     ← All Learning DNA + learning records
/families/{family_id}/insights/      ← Parent-side insights + preferences
```

**Stage differentiation** is handled via metadata, NOT separate namespaces:

```json
{
  "namespace": "/students/stu_abc123/learning/",
  "metadata": {
    "stage": "oc_prep",
    "subject": "math",
    "skill": "spatial_reasoning",
    "error_type": "concept_gap",
    "cognitive_depth": 3,
    "session_id": "sess_xyz789",
    "timestamp": "2026-04-06T10:30:00Z"
  }
}
```

### Metadata Schema

| Field | Type | Values | Purpose |
|-------|------|--------|---------|
| `stage` | string | `"oc_prep"` \| `"selective_prep"` | Which test the student is preparing for |
| `subject` | string | `"reading"` \| `"math"` \| `"thinking"` \| `"writing"` | Test section |
| `skill` | string | Specific sub-skill name (e.g., `"inference"`, `"spatial_reasoning"`) | Skill-level granularity |
| `error_type` | string | `"concept_gap"` \| `"careless"` \| `"time_pressure"` \| `"misread"` \| `"elimination_failure"` | Error classification |
| `cognitive_depth` | integer | `1` \| `2` \| `3` \| `4` | Webb's Depth of Knowledge level |
| `session_id` | string | Session identifier | Links memory to source session |
| `timestamp` | ISO 8601 | Datetime | When the memory was created |
| `confidence` | float | `0.0 - 1.0` | Agent's confidence in this classification |

### Memory Types

**Short-Term Memory (STM):**
- All conversation turns within a session
- Automatically managed by AgentCore
- Retained for the duration of the session
- Used for in-conversation context

**Long-Term Memory (LTM):**
- Extracted insights written at session end (background job)
- Persisted across sessions indefinitely
- Queried at session start for context assembly
- Tagged with full metadata for filtered retrieval

**Learning DNA:**
- Composite profile derived from LTM entries
- Updated asynchronously after each test session
- Stored in the student's learning namespace
- See [MEMORY-DESIGN.md](./MEMORY-DESIGN.md) for full schema

---

## 3. Multi-Child Family Support

### Data Model

```
Family (1) ──→ (N) Students
  │                   │
  │                   ├── Student A (stage: oc_prep)
  │                   ├── Student B (stage: selective_prep)
  │                   └── Student C (stage: oc_prep)
  │
  └── Family Insights (preferences, communication history)
```

### Child Resolution Rules

When a parent sends a message, the system must determine which child is being discussed.

**Rule 1 — Single child family:**
- Auto-select the only child. No clarification needed.
- Never ask "Which child are you asking about?" when there is only one.

**Rule 2 — Multiple children, name mentioned:**
- Parent says "How is Ethan doing in math?" → Match "Ethan" to `student_id` via family roster.
- Name matching is case-insensitive and supports:
  - Full name: "Ethan Li"
  - First name only: "Ethan"
  - Chinese name: "小明"
  - Nickname (if stored in profile): "E"

**Rule 3 — Multiple children, no name mentioned:**
- Parent says "How are the latest test results?" → ambiguous.
- Response: "I can see results for both Ethan and Emily. Which child would you like me to focus on, or would you like a summary for both?"

**Rule 4 — Context carryover:**
- If the current conversation has already established context for a specific child, continue with that child unless the parent switches.
- Parent: "How's Ethan's reading?" → [response about Ethan] → "What about math?" → Still about Ethan.
- Parent: "Now tell me about Emily" → Switch context to Emily.

### Privacy: Student ID Exposure

**NEVER expose `student_id` values to parents or students.**

- Internal: `student_id = "stu_abc123"`
- External (parent-facing): "Ethan" or "your child"
- External (student-facing): "you" or the student's first name
- Logs: `student_id` may appear in system logs but NEVER in agent responses

---

## 4. Context Assembly

### Parent Agent — Session Start

```
1. LOAD    family context
           ├── Family ID, parent name, language preference
           ├── Children roster: [{student_id, name, chinese_name, nickname, stage, grade}]
           └── SOURCE: Application DB (students table JOIN users),
               NOT AgentCore Memory. Loaded by Lambda and injected
               as session initialization parameter into Agent prompt.
               This ensures name→student_id mapping is always fresh.

2. NLU     Identify which child is being discussed (Rules 1-4 above)

3. RETRIEVE Student LTM
           ├── Namespace: /students/{student_id}/learning/
           ├── Filter: stage={relevant_stage}, subject={if_specified}
           └── Limit: Most recent 20 entries + key Learning DNA summary

4. RETRIEVE Family insights
           ├── Namespace: /families/{family_id}/insights/
           └── Content: Previous recommendations, parent preferences, communication history

5. ASSEMBLE System prompt with:
           ├── Agent identity (SOUL.md + IDENTITY.md)
           ├── Family context
           ├── Relevant child's Learning DNA summary
           ├── Recent LTM entries
           └── Active skill pack (based on conversation intent)
```

### Student Agent — Session Start

```
1. LOAD    student profile
           ├── Student ID, name, grade, active stage
           └── Current study plan (if exists)

2. RETRIEVE Student LTM (OWN DATA ONLY)
           ├── Namespace: /students/{student_id}/learning/
           ├── Filter: stage={active_stage}
           └── Limit: Most recent 15 entries + Learning DNA summary

3. HARD ISOLATION CHECKS:
           ├── ❌ Cannot access /students/{other_student_id}/ namespaces
           ├── ❌ Cannot access /families/ namespace
           └── ❌ Cannot see parent conversation history

4. ASSEMBLE System prompt with:
           ├── Agent identity (SOUL.md + IDENTITY.md, student variant)
           ├── Student profile
           ├── Learning DNA summary
           ├── Recent LTM entries
           └── Active skill pack
```

---

## 5. Model Routing

### Routing Table

| Task | Model | Rationale |
|------|-------|-----------|
| Error classification (per question) | Haiku | High volume, simple classification, low latency needed |
| Input routing / intent detection | Haiku | Fast, low-cost, pattern matching |
| Simple FAQ responses | Haiku | "When is the OC test?" doesn't need deep reasoning |
| Daily conversation (student chat) | Sonnet | Balanced quality and speed for interactive tutoring |
| Learning suggestions | Sonnet | Needs context awareness but not deep analysis |
| Parent communication | Sonnet | Professional quality with reasonable latency |
| Study plan generation | Sonnet | Structured output from clear inputs |
| Deep diagnostic reports | Opus | Complex multi-dimensional analysis requiring deep reasoning |
| Writing detailed feedback | Opus | Nuanced assessment of creative writing across 6 criteria |
| Cross-session trend analysis | Opus | Synthesising patterns across multiple test sessions |
| Learning DNA major update | Opus | Integrating new data into the composite student profile |

### Routing Decision Flow

```
User message received
  │
  ├── Is this a simple factual question? ──→ Haiku
  │
  ├── Is this a classification task? ──→ Haiku
  │
  ├── Is this a diagnostic/analytical task? ──→ Opus
  │     (test analysis, Writing feedback, trend report)
  │
  └── Everything else ──→ Sonnet
        (conversation, suggestions, study plans, parent chat)
```

### Cost Optimization Rules

1. **Haiku first** for any task that can be framed as classification or routing
2. **Sonnet as default** for conversational interactions
3. **Opus only when reasoning depth is critical** — never for simple responses
4. **Batch Haiku calls** for per-question error classification (process all questions in one call, not individually)
5. **Cache Learning DNA** in session context — don't re-retrieve from LTM for every turn

---

## 6. Session Lifecycle

### Phase 1: Session Start

```
1. User authenticates → agent type determined (student or parent)
2. Load identity context (SOUL.md + IDENTITY.md)
3. Retrieve relevant LTM (see Context Assembly above)
4. Initialize STM (empty conversation buffer)
5. Load active skill pack (based on user's current stage/intent)
6. Greet user with context-aware opening
```

### Phase 2: During Conversation

```
For each turn:
1. User message received
2. Route to appropriate model (see Model Routing)
3. Retrieve additional LTM if conversation topic shifts
4. Generate response using assembled context
5. Write turn to STM
6. Tag significant insights inline:
   - New error pattern identified
   - Skill mastery evidence
   - Behavioural observation (e.g., student expressed frustration)
   - Parent preference noted
```

### Phase 3: Session End

```
1. Conversation ends (user closes or timeout)
2. Background job triggered:
   a. Scan STM for tagged insights
   b. Extract structured memories with metadata
   c. Write extracted memories to LTM (student and/or family namespace)
   d. If test results were discussed → queue Learning DNA update job
3. STM cleared
```

### Phase 4: Asynchronous Processing

```
Learning DNA update (triggered after test session analysis):
1. Retrieve all LTM entries for student + stage
2. Recalculate mastery scores per sub-skill
3. Update error pattern distribution
4. Compute trends (improving / stable / declining)
5. Write updated Learning DNA to LTM
6. Flag significant changes for next session context
```

---

## 7. Security & Privacy

### Namespace Isolation

| Principle | Implementation |
|-----------|---------------|
| **Student A cannot see Student B's data** | Retrieval config only includes `/students/{own_student_id}/learning/` |
| **Students cannot see parent conversations** | Student agent has no access to `/families/` namespace |
| **Parent can see their children's data** | Parent agent retrieval config includes namespaces for all children in family |
| **Cross-family isolation** | No agent can access `/families/{other_family_id}/` or `/students/{other_family_student_id}/` |

### Enforcement Layers

```
Layer 1: Application-level
  └── Retrieval config assembled at session start
      includes ONLY authorized namespaces

Layer 2: Agent prompt-level
  └── System prompt explicitly declares access boundaries:
      "You have access ONLY to data for student {name}.
       You MUST NOT reference or access data for any other student."

Layer 3: AgentCore Policy (Cedar) — defence in depth
  └── Policy rules that block cross-student/cross-family retrieve operations
      even if application-level config is misconfigured
```

### Cedar Policy Example

```cedar
// Students can only access their own learning namespace
permit (
  principal == AgentCore::Agent::"student_agent",
  action == AgentCore::Action::"Retrieve",
  resource
)
when {
  resource.namespace == "/students/" + context.actor_id.student_id + "/learning/"
};

// Parents can access their family's insights
permit (
  principal == AgentCore::Agent::"parent_agent",
  action == AgentCore::Action::"Retrieve",
  resource
)
when {
  resource.namespace == "/families/" + context.actor_id.family_id + "/insights/"
};

// Parents can access their children's learning data
permit (
  principal == AgentCore::Agent::"parent_agent",
  action == AgentCore::Action::"Retrieve",
  resource
)
when {
  resource.namespace.startsWith("/students/") &&
  context.family_roster.contains(resource.namespace.extractStudentId())
};

// Deny everything not explicitly permitted
forbid (principal, action, resource);
```

### Data Protection Compliance

| Requirement | Implementation |
|-------------|---------------|
| **Australian Privacy Act** | PII minimisation, data access logging, user consent for data collection |
| **Education data standards** | Age-appropriate data handling, parental consent for minors |
| **No PII in logs** | Student names, family details, and conversation content stripped from operational logs |
| **Data retention** | LTM retained for active subscription period + 30 days post-cancellation |
| **Right to deletion** | Parent can request full data deletion via account settings |
| **Encryption** | All data encrypted at rest (AES-256) and in transit (TLS 1.3) |

---

## 8. Error Handling

### Agent-Level Error Recovery

| Scenario | Response |
|----------|----------|
| **LTM retrieval fails** | Proceed with conversation using STM only; inform user that "I'm working with limited history right now" |
| **Model routing fails** | Fall back to Sonnet for all tasks |
| **Learning DNA not found** | Treat as new student; ask diagnostic questions to bootstrap profile |
| **Child resolution ambiguous** | Ask parent to clarify (Rule 3) |
| **Test data missing fields** | Analyse what's available; note limitations: "I don't have time-per-question data for this session, so I can't assess time pressure" |
| **Session extraction fails** | Log error; retry in background; do not affect user experience |

### Rate Limiting

| Operation | Limit | Rationale |
|-----------|-------|-----------|
| Student messages per session | 200 | Prevent infinite loops |
| Parent messages per session | 100 | Reasonable conversation length |
| LTM writes per session | 20 | Prevent memory flooding |
| Learning DNA updates per day | 5 per student | Prevent thrashing |
| Opus calls per session | 10 | Cost control |

---

## 9. Skill Pack Loading

Skill packs are loaded dynamically based on conversation context:

```
Intent detected          → Skill pack loaded
─────────────────────────────────────────────
Student practising OC    → skills/oc-prep/SKILL.md
Student practising Sel.  → skills/selective-prep/SKILL.md
Test results discussed   → skills/diagnostic/SKILL.md
Parent asking questions  → skills/parent-advisor/SKILL.md
Study plan requested     → skills/study-planner/SKILL.md
```

Multiple skill packs can be active simultaneously. For example, a parent asking "Can you analyse Ethan's last test and suggest a study plan?" would activate both `diagnostic` and `study-planner`.

### Skill Pack Priority (if context window is constrained)

1. **diagnostic** — Always load when test data is being discussed
2. **parent-advisor** — Always load for parent conversations
3. **oc-prep / selective-prep** — Load for student practice sessions
4. **study-planner** — Load on explicit request

---

## 10. Observability

### Metrics to Track

| Metric | Purpose |
|--------|---------|
| `session_duration` | Engagement measurement |
| `turns_per_session` | Conversation depth |
| `model_usage_by_tier` | Cost tracking (Haiku/Sonnet/Opus split) |
| `ltm_write_count` | Memory growth rate |
| `ltm_retrieval_latency` | Context assembly performance |
| `child_resolution_ambiguity_rate` | Multi-child UX quality |
| `error_classification_distribution` | Learning pattern health check |
| `skill_pack_load_frequency` | Feature usage |
| `language_distribution` | Bilingual usage patterns |

### Logging Rules

- ✅ Log: session IDs, model calls, latency, error codes, feature flags
- ❌ Never log: student names, parent messages, conversation content, PII
- ⚠️ Redact before logging: any field that could contain user-generated content

---

## 11. Existing Code Compatibility Notes

These changes are needed in the existing `feat/ai-chatbot-redesign` branch:

| File | Change Required |
|------|----------------|
| `edulens-backend/services/conversation-engine/src/lib/agentcore.ts` | Add `stage` field to `invokeAgent` payload so agent knows current OC vs Selective context |
| `edulens-backend/agents/shared/agentcore-memory-client.ts` | Extend `retrieveMemoryRecords` return parsing to include `metadata` fields for client-side filtering |
| `prototype/edulens-agent/src/memory/agentcore-memory.ts` | Update mock data with multi-child family scenarios and stage-aware namespace patterns |
| `edulens-infrastructure/lib/stacks/agentcore-stack.ts` | Update Memory namespace config if hierarchical namespace support is available |
| Cedar Policy | New — create policy for cross-student retrieve blocking (not yet in branch) |

---

## 12. Environment Variables

All configurable values must be sourced from environment variables to support multi-environment deployments (dev, staging, production). Hardcoded defaults are provided for local development only.

### Memory Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `EDULENS_MEMORY_STORE_ID` | `edulens-memory-store` | AgentCore Memory store identifier |
| `MEMORY_ID` | *(required)* | Memory instance ID for the active environment |

### Model Routing

| Variable | Default | Description |
|----------|---------|-------------|
| `EDULENS_MODEL_CLASSIFICATION` | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | Model for error classification, intent detection, FAQ routing |
| `EDULENS_MODEL_CONVERSATION` | `global.anthropic.claude-sonnet-4-6` | Model for daily conversation, study plans, parent communication |
| `EDULENS_MODEL_DEEP_ANALYSIS` | `global.anthropic.claude-opus-4-6-v1` | Model for deep diagnostic reports, Writing feedback, trend analysis |

### AgentCore Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `PARENT_ADVISOR_RUNTIME_ARN` | *(required)* | ARN of the parent-advisor AgentCore Runtime |
| `STUDENT_TUTOR_RUNTIME_ARN` | *(required)* | ARN of the student-tutor AgentCore Runtime |
| `AGENTCORE_REGION` | `us-west-2` | AWS region for AgentCore API calls |

### Validation at Startup

Agents **must** validate that all required env vars (those without defaults) are present during initialization. If a required variable is missing, the agent should:
1. Log a clear error identifying the missing variable
2. Fail fast — do not start the agent with incomplete configuration
3. Return a non-zero exit code for container health check detection

Optional variables with defaults should log a warning at INFO level when falling back to the default value, so operators can verify intentional usage.

---

## 13. Error Handling & Graceful Degradation

Every failure mode must be anticipated and handled without exposing raw errors to users. The agent must remain conversational and helpful even when backend dependencies are degraded.

### AgentCore Memory Unavailable (timeout / 503)

```
Trigger: Memory retrieval times out (>5s) or returns 503/5xx
Behaviour:
  1. Log: { event: "memory_unavailable", latency_ms, error_code, session_id }
  2. Respond WITHOUT historical context — use only current session STM
  3. Inform user naturally:
     Parent: "I can't access previous session history right now, but I can help with your current question."
     Student: "I'm having trouble loading our past sessions, but let's keep working!"
  4. Set session flag: memory_degraded = true
  5. Retry memory access on next turn (with exponential backoff: 1s, 2s, 4s, max 3 retries)
  6. If memory recovers mid-session, silently resume using LTM context
```

### LTM Extraction Lambda Fails

```
Trigger: Post-session extraction job throws error or times out
Behaviour:
  1. Log: { event: "extraction_failed", session_id, error, attempt }
  2. Push failed message to Dead Letter Queue (DLQ) for retry
  3. Retry policy: 3 attempts with exponential backoff (30s, 120s, 300s)
  4. NEVER block the active conversation — extraction is fully async
  5. If all retries exhausted: flag session for manual review
  6. Alert: CloudWatch alarm if DLQ depth > 10
```

### Parent References Unknown Child

```
Trigger: NLU resolves a child name that doesn't match any student in the family roster
Behaviour:
  1. Respond: "I don't see a child with that name in your account. Your children are: [list names]."
  2. If fuzzy match exists (edit distance ≤ 2 or partial match):
     "Did you mean [closest match]?"
  3. Log: { event: "unknown_child_reference", input_name, family_id, roster_names }
  4. Do NOT hallucinate data for the unrecognised name
```

### Invalid or Corrupt Learning DNA

```
Trigger: Learning DNA retrieved from LTM fails schema validation
         (missing required fields, invalid types, version mismatch)
Behaviour:
  1. Log: { event: "invalid_learning_dna", student_id, validation_errors, version }
  2. Fall back to generic advice (no skill-specific data):
     "I have limited diagnostic data available right now. Let me give you
      general guidance, and we can review detailed insights next session."
  3. Flag record for investigation (write to admin alerts namespace)
  4. Do NOT use partially valid DNA — either full schema or generic fallback
  5. If schema_version mismatch: attempt migration; if migration fails, treat as corrupt
```

### AgentCore Runtime Unavailable

```
Trigger: InvokeAgentRuntimeCommand fails (timeout, 503, connection refused)
Behaviour:
  1. Log: { event: "runtime_unavailable", agent_type, error_code, latency_ms }
  2. Fall back to direct Bedrock Converse API (legacy path)
     — This path already exists in send-message.ts (the `else` branch when
       PARENT_ADVISOR_RUNTIME_ARN is not set)
  3. Use the same buildSystemPrompt() to construct a grounded prompt
  4. Inform user only if latency is noticeable (>10s):
     "Sorry for the slight delay — I'm working on your question."
  5. Metric: increment runtime_fallback_count counter
```

### Token Budget Exceeded

```
Trigger: Context window approaches model limit during long conversations
Behaviour:
  1. When STM token count exceeds 80% of maxTokens (128,000):
     a. Summarise oldest turns into a compressed summary paragraph
     b. Keep the most recent 10 turns verbatim
     c. Preserve all [INSIGHT] tagged entries regardless of age
  2. When assembled prompt (system + LTM + STM) exceeds model input limit:
     a. Reduce LTM entries from 20 → 10 → 5 (most recent/relevant)
     b. Truncate Learning DNA to summary fields only (drop sub_skills detail)
     c. If still over: drop family insights, keep only student learning data
  3. Log: { event: "token_budget_exceeded", session_id, strategy_applied, tokens_before, tokens_after }
  4. Never silently drop context — always log what was truncated
```

### General Error Response Rules

| Principle | Implementation |
|-----------|---------------|
| **Never expose stack traces** | Catch all errors; return user-friendly messages |
| **Never hallucinate on failure** | If data is unavailable, say so — don't fabricate |
| **Log everything server-side** | Every error includes session_id, timestamp, error details |
| **Reset agent state on error** | On unhandled error, transition agent_state back to `idle` |
| **Fail open for reads, fail closed for writes** | Missing data = proceed cautiously; write failure = retry + DLQ |
