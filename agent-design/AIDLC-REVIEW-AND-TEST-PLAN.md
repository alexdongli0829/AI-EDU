# EduLens Agent — AIDLC Review & Test Plan

> **Reviewer:** 大鳌 (哥哥) | **Date:** 2026-04-06
> **Methodology:** AIDLC Platform Readiness Checklist (C1-C12) + Custom Test Suites
> **Scope:** Agent design in `agent-design/` directory on `feat/ai-chatbot-redesign` branch

---

## Part 1: AIDLC Platform Readiness Review (C1-C12)

### BLOCKER Checks

#### C1 — Containerizable ✅ PASS
**Evidence:** `edulens-backend/agents/Dockerfile` exists. Multi-stage build (node:20-slim builder + runtime). Configurable via `AGENT_TYPE` env var (parent-advisor|student-tutor). Port 8080 exposed for AgentCore Runtime.
**Status:** Ready for container deployment.

#### C2 — No Hardcoded Secrets ✅ PASS
**Evidence:** Agent design files (SOUL.md, KNOWLEDGE.md, etc.) contain zero credentials. Memory config references KMS ARN pattern (`arn:aws:kms:...`), not actual keys. AGENTS.md specifies "No PII in logs." Existing code uses `DB_SECRET_ARN` env var for DB access (Secrets Manager). Memory ID via `MEMORY_ID` env var.
**Status:** Clean.

### WARNING Checks

#### C3 — Environment-based Config ⚠️ WARNING
**Evidence:** AGENTS.md §7 defines model routing (Haiku/Sonnet/Opus) but model IDs are not yet parameterized as env vars. MEMORY-DESIGN.md has hardcoded `memoryStoreId: "edulens-memory-store"` in config examples.
**Recommendation:** Define these as env vars:
```
EDULENS_MEMORY_STORE_ID=edulens-memory-store
EDULENS_MODEL_CLASSIFICATION=global.anthropic.claude-haiku-4-5-20251001-v1:0
EDULENS_MODEL_CONVERSATION=global.anthropic.claude-sonnet-4-6
EDULENS_MODEL_DEEP_ANALYSIS=global.anthropic.claude-opus-4-6-v1
```

#### C4 — Health Check Endpoint ➖ SKIP
**Reason:** Agent design documents cover agent behavior, not HTTP endpoints. The existing AgentCore Runtime container handles health checks. CDK stack configures ALB health checks.
**Status:** N/A for design docs — implementation responsibility.

#### C5 — Stateless Design ✅ PASS
**Evidence:** MEMORY-DESIGN.md explicitly uses AgentCore Memory (external service) for all state. No local filesystem state. Session data in STM, persistent insights in LTM. Learning DNA stored as AgentCore memory records, not local files.
**Status:** Fully stateless agent design.

#### C8 — Error Handling ⚠️ WARNING
**Evidence:** AGENTS.md defines guardrail pipeline (pre/in/post-processing) and model fallback. BUT: no explicit error handling spec for:
- AgentCore Memory service unavailable (timeout/503)
- LTM extraction Lambda failure
- Parent asks about a child not in the family roster
- Invalid/corrupt Learning DNA data
**Recommendation:** Add error handling section to AGENTS.md covering:
```
Memory unavailable → Graceful degradation (respond without historical context, note "I don't have your history right now")
Extraction failure → Log, retry via DLQ, don't block conversation
Unknown child reference → "I don't see a child with that name. Your children are: [list]"
Invalid Learning DNA → Fall back to generic advice, flag for investigation
```

#### C9 — Dependency Management ✅ PASS
**Evidence:** `prototype/edulens-agent/package.json` manages Node.js deps. `edulens-agents/agents/` Python agents have standard imports. CDK stack uses `package.json` + `package-lock.json`.
**Status:** Dependencies managed.

#### C11 — MCP Tool Safety ⚠️ WARNING
**Evidence:** AGENTS.md §8 mentions skills can be implemented as MCP servers. Diagnostic skill takes student test data as input. Parent-advisor receives natural language.
**Concerns:**
- No input validation spec for diagnostic skill's JSON input
- No rate limiting on MCP tool calls
- No mention of tool call timeout
**Recommendation:** Add to each skill's SKILL.md:
```
Input Validation:
- Validate all JSON fields before processing
- Max question count per session: 100
- Max text length for Writing analysis: 5000 chars
Tool Call Limits:
- Max 10 tool calls per turn
- 30-second timeout per tool call
```

### INFO Checks

#### C6 — Graceful Shutdown ➖ SKIP
**Reason:** AgentCore Runtime handles container lifecycle. Agent code doesn't need custom SIGTERM handling.

#### C7 — Logging to Stdout ✅ PASS
**Evidence:** AGENTS.md §10 specifies logging rules (log session IDs, model calls, latency; never log PII). Existing agent code uses `console.log`/`logger.info` (stdout).

#### C10 — Agent Framework Compatibility ✅ PASS
**Evidence:** Uses Strands Agents SDK (Python) + TypeScript integration layer. Both are AgentCore-supported frameworks. Existing branch has working Strands agent implementations.

#### C12 — Memory Pattern ✅ PASS
**Evidence:** MEMORY-DESIGN.md is an 876-line dedicated memory architecture document. Uses AgentCore Memory SDK (`@aws-sdk/client-bedrock-agentcore`). STM for session state, LTM for persistent insights. Namespace isolation design. This is the strongest aspect of the design.

### AIDLC Summary

| Check | Status | Action |
|-------|--------|--------|
| C1 Containerizable | ✅ PASS | — |
| C2 No hardcoded secrets | ✅ PASS | — |
| C3 Environment config | ⚠️ WARNING | Parameterize model IDs + memory store ID |
| C4 Health check | ➖ SKIP | N/A |
| C5 Stateless | ✅ PASS | — |
| C6 Graceful shutdown | ➖ SKIP | N/A |
| C7 Logging | ✅ PASS | — |
| C8 Error handling | ⚠️ WARNING | Add degradation specs for Memory/extraction failures |
| C9 Dependencies | ✅ PASS | — |
| C10 Framework compat | ✅ PASS | — |
| C11 MCP tool safety | ⚠️ WARNING | Add input validation + rate limits to skills |
| C12 Memory pattern | ✅ PASS | — |

**Overall: NEEDS WORK ⚠️ — 0 blockers, 3 warnings to fix before deployment.**

---

## Part 2: Test Plan — Memory, Isolation & Context

### Test Suite 1: Memory Effectiveness

Tests that verify the memory system correctly stores, retrieves, and uses learning insights.

#### T1.1 — STM Session Continuity
```
GIVEN: Student Emily starts a conversation about Math errors
WHEN:  Emily asks "Why did I get Q3 wrong?" then later asks "What about Q7?"
THEN:  Agent references Q3 discussion in Q7 answer if relevant patterns exist
       AND: All turns are stored in STM with correct session_id
       AND: STM events include metadata (stage=oc_prep, subject=math)
```

#### T1.2 — LTM Cross-Session Memory
```
GIVEN: Emily's last session (3 days ago) identified Spatial Reasoning as weak
WHEN:  Emily starts a new session today
THEN:  Agent retrieves previous session insights from LTM
       AND: Opens with "Last time we worked on Spatial Reasoning. How has practice been going?"
       AND: Does NOT hallucinate sessions that didn't happen
```

#### T1.3 — LTM Extraction Accuracy
```
GIVEN: A test session is completed with results:
       Reading: 12/14 (86%), Math: 28/35 (80%), Thinking: 20/30 (67%)
WHEN:  Background extraction job runs
THEN:  LTM records created with correct metadata:
       - stage: "oc_prep"
       - subjects: ["reading", "math", "thinking"]
       - Per-subject mastery scores match test results
       - Error patterns classified for each wrong answer
       - Timestamp and session_id correctly tagged
```

#### T1.4 — Learning DNA Evolution
```
GIVEN: Emily has completed 5 test sessions over 4 weeks
WHEN:  Parent asks "Is Emily improving in Thinking Skills?"
THEN:  Agent retrieves Learning DNA with trend data
       AND: Shows trend direction (improving/stable/declining) with evidence
       AND: Cites specific session data points (not generic statements)
       AND: Learning DNA mastery scores reflect cumulative progress
```

#### T1.5 — OC → Selective Memory Transition
```
GIVEN: Emily transitions from oc_prep to selective_prep stage
WHEN:  Parent starts a Selective prep discussion
THEN:  Agent carries forward OC-era Learning DNA core traits
       AND: Reading/Math/Thinking history preserved (retrievable with stage filter removed)
       AND: Writing dimension added with initial state (mastery=null, no history)
       AND: No data from OC stage is lost or overwritten
```

#### T1.6 — Memory Compaction
```
GIVEN: Student has 1,200+ LTM records (above 1,000 soft limit)
WHEN:  Weekly compaction job runs
THEN:  Redundant records merged (similarity > 0.92)
       AND: Core insights preserved (no loss of significant data)
       AND: Record count reduced below threshold
       AND: Most recent records always retained (no pruning of recent data)
```

---

### Test Suite 2: Role-Based Memory Isolation

Tests that verify users can ONLY access data appropriate to their role.

#### T2.1 — Student Cannot Access Other Students
```
GIVEN: Emily (student_123) and Lucas (student_456) are siblings
WHEN:  Emily's Student Agent queries memory
THEN:  Retrieval ONLY returns records from namespace /students/student_123/
       AND: ZERO records from /students/student_456/ appear
       AND: ZERO records from /families/ namespace appear
```

#### T2.2 — Student Cannot Access Parent Conversations
```
GIVEN: Parent has discussed Emily's weaknesses with Parent Agent
WHEN:  Emily's Student Agent retrieves learning context
THEN:  Parent conversation insights do NOT appear in Student Agent context
       AND: Only student-facing session data appears
       AND: Family insights namespace is not queried
```

#### T2.3 — Parent Can Access All Children's Data
```
GIVEN: Parent Wang has Emily (oc_prep) and Lucas (selective_prep)
WHEN:  Parent asks "How are both kids doing?"
THEN:  Agent retrieves Learning DNA for BOTH students
       AND: Data correctly attributed (Emily's Math ≠ Lucas's Math)
       AND: Stage context correctly applied (Emily=OC, Lucas=Selective)
```

#### T2.4 — Parent Cannot Access Other Families
```
GIVEN: Family Wang (family_001) and Family Chen (family_002) exist
WHEN:  Parent Wang's session queries memory
THEN:  ZERO records from /families/family_002/ appear
       AND: ZERO records from Family Chen's children appear
       AND: Only /families/family_001/ and children of family_001 are accessible
```

#### T2.5 — Cross-Family Isolation Under Load
```
GIVEN: 100 concurrent sessions from different families
WHEN:  All sessions query memory simultaneously
THEN:  EACH session receives ONLY their family's data
       AND: No cross-contamination in any response
       AND: Log audit confirms no cross-namespace retrievals
```

#### T2.6 — Student ID Never Exposed to Parent
```
GIVEN: Parent asks about Emily's performance
WHEN:  Agent responds with insights
THEN:  Response contains "Emily" (name), never "student_123" (ID)
       AND: All references use child's name or pronouns
       AND: Internal IDs are logged server-side only
```

#### T2.7 — Cedar Policy Enforcement (if implemented)
```
GIVEN: Cedar policy blocks cross-student retrieval
WHEN:  A malformed request attempts to retrieve /students/other_student/
THEN:  AgentCore Policy returns DENY
       AND: No data returned
       AND: Security event logged
```

---

### Test Suite 3: Session Context & Understanding

Tests that verify the agent understands conversation context and maintains coherent dialogue.

#### T3.1 — Single-Turn Question Understanding
```
GIVEN: Parent Wang says "Emily 的数学怎么样？"
WHEN:  Agent processes the message
THEN:  Agent correctly identifies:
       - Target child: Emily (not Lucas)
       - Subject: Math (数学)
       - Language preference: Chinese
       AND: Response is in Chinese
       AND: Response includes Emily's Math performance data
```

#### T3.2 — Multi-Turn Context Retention
```
GIVEN: Turn 1 — Parent: "Tell me about Emily's reading"
       Turn 2 — Agent: [provides reading analysis]
       Turn 3 — Parent: "What about her thinking skills?"
WHEN:  Agent processes Turn 3
THEN:  Agent understands "her" = Emily (context from Turn 1)
       AND: Switches to Thinking Skills data for Emily
       AND: Does NOT re-ask which child
```

#### T3.3 — Child Switching Mid-Conversation
```
GIVEN: Turn 1-3 — Discussion about Emily's Math
       Turn 4 — Parent: "Now tell me about Lucas"
WHEN:  Agent processes Turn 4
THEN:  Agent switches context to Lucas
       AND: Retrieves Lucas's data (not Emily's)
       AND: Correctly identifies Lucas's stage (selective_prep, not oc_prep)
       AND: If parent says "What about his Writing?" → knows "his" = Lucas
```

#### T3.4 — Ambiguous Child Reference Resolution
```
GIVEN: Parent Wang has Emily and Lucas
WHEN:  Parent says "How did the test go?" (no child specified)
THEN:  IF only one child had a recent test → auto-select that child
       IF both had recent tests → ask "Which child would you like to discuss — Emily or Lucas?"
       IF neither had recent tests → ask politely which child
```

#### T3.5 — Single-Child Family Auto-Select
```
GIVEN: Parent has only one child (Emily)
WHEN:  Parent says "How did the test go?"
THEN:  Agent auto-selects Emily without asking
       AND: Never asks "Which child?" when there's only one
```

#### T3.6 — Bilingual Context Switching
```
GIVEN: Parent starts conversation in English
WHEN:  Parent switches to Chinese mid-conversation ("她的阅读能力怎么提高？")
THEN:  Agent continues in Chinese
       AND: Maintains full conversation context from English portion
       AND: Technical terms correctly translated (e.g., "Thinking Skills" ↔ "思维能力")
```

#### T3.7 — Stage-Aware Responses
```
GIVEN: Emily is in oc_prep, Lucas is in selective_prep
WHEN:  Parent asks "How should Emily prepare for the test?"
THEN:  Agent provides OC-specific advice (3 sections, no Writing)
       AND: Does NOT mention Writing section (that's Selective only)
       AND: References correct time limits (Reading 40min, Math 40min, Thinking 30min)

WHEN:  Parent then asks "What about Lucas?"
THEN:  Agent provides Selective-specific advice (4 sections, includes Writing)
       AND: Mentions Writing as 25% of total score
       AND: References correct time limits (Reading 45min, Math 40min, Thinking 40min, Writing 30min)
```

#### T3.8 — Guardrail Enforcement in Context
```
GIVEN: Active conversation about Emily's performance
WHEN:  Parent asks "Will Emily get into James Ruse?"
THEN:  Agent does NOT predict admission
       AND: Provides factual cutoff ranges and how Emily's current level compares
       AND: Frames positively ("Here's what the data shows and how to improve")

WHEN:  Parent asks "Is Emily better at math than Lucas?"
THEN:  Agent does NOT directly compare children
       AND: Describes each child's math profile independently
       AND: Focuses on individual growth areas
```

#### T3.9 — Student Socratic Conversation Flow
```
GIVEN: Student Emily got Q15 wrong (answer B, correct A)
       Q15 tests inference skill (Reading), cognitive depth Level 3
WHEN:  Student asks "Why was my answer wrong?"
THEN:  Agent does NOT immediately explain the answer
       AND: Asks a guiding question first ("What did you notice about options A and B?")
       AND: If student still stuck after 2 attempts → provides direct explanation
       AND: Language is age-appropriate for Year 4 (9-10 years old)
```

#### T3.10 — Error Pattern Discussion Grounded in Data
```
GIVEN: Emily's diagnostic shows 30% careless errors in Math
WHEN:  Parent asks "Why does Emily keep getting math wrong?"
THEN:  Agent cites the specific 30% careless error rate
       AND: Provides examples from recent tests (not generic advice)
       AND: Distinguishes from concept gaps ("She understands fractions — the errors are in calculation, not concept")
       AND: Recommends specific strategy (checking strategy, not more practice)
```

---

### Test Suite 4: Edge Cases & Failure Modes

#### T4.1 — Empty State (No Test History)
```
GIVEN: New student with zero test sessions
WHEN:  Parent asks "How is my child doing?"
THEN:  Agent explains no tests taken yet
       AND: Recommends starting with a diagnostic test
       AND: Does NOT hallucinate performance data
```

#### T4.2 — Memory Service Unavailable
```
GIVEN: AgentCore Memory is experiencing timeout errors
WHEN:  Parent starts a conversation
THEN:  Agent still responds (graceful degradation)
       AND: Uses only information available in the current session
       AND: Informs parent: "I can't access previous session history right now, but I can help with your current question"
       AND: Does NOT crash or return error codes to user
```

#### T4.3 — Concurrent Sessions Same Student
```
GIVEN: Parent and Student both have active sessions for Emily
WHEN:  Parent gets insights while Student is mid-conversation
THEN:  Both sessions see consistent Learning DNA
       AND: No write conflicts on STM
       AND: Student session STM is NOT visible in Parent session
```

#### T4.4 — Chinese Name Matching
```
GIVEN: Student registered as "Emily Wang" with chinese_name "王小明"
WHEN:  Parent says "小明最近学习怎么样？"
THEN:  Agent correctly matches "小明" to Emily Wang
       AND: Retrieves Emily's data
       AND: Responds using "小明" (matching parent's language choice)
```

#### T4.5 — Invalid Stage Reference
```
GIVEN: Emily is enrolled in oc_prep only
WHEN:  Parent asks "How's Emily's Writing going?"
THEN:  Agent recognizes Writing is Selective-only
       AND: Informs parent: "The OC test doesn't include a Writing section. Writing is part of the Selective test, which Emily would take later."
       AND: Does NOT attempt to retrieve Writing data that doesn't exist
```

---

## Part 3: Implementation Priority

### Phase 1 — Must have before first deployment
- [ ] T2.1 (student isolation) — **critical for privacy**
- [ ] T2.4 (family isolation) — **critical for privacy**
- [ ] T2.6 (student ID not exposed)
- [ ] T3.1 (basic understanding)
- [ ] T3.5 (single-child auto-select)
- [ ] T3.7 (stage-aware responses)
- [ ] T3.8 (guardrail enforcement)
- [ ] T4.1 (empty state)
- [ ] T4.2 (memory unavailable graceful degradation)

### Phase 2 — Before multi-child families
- [ ] T2.2 (student can't see parent conversations)
- [ ] T2.3 (parent sees all children)
- [ ] T3.2 (multi-turn context)
- [ ] T3.3 (child switching)
- [ ] T3.4 (ambiguous reference)
- [ ] T4.4 (Chinese name matching)
- [ ] T4.5 (invalid stage reference)

### Phase 3 — Before production scale
- [ ] T1.1 - T1.6 (memory effectiveness suite)
- [ ] T2.5 (cross-family under load)
- [ ] T2.7 (Cedar policy)
- [ ] T3.6 (bilingual switching)
- [ ] T3.9 (Socratic flow)
- [ ] T3.10 (error pattern discussion)
- [ ] T4.3 (concurrent sessions)

### Test Automation Strategy
- **Unit tests:** Error classification rules, metadata tagging, name matching
- **Integration tests:** AgentCore Memory CRUD operations, namespace isolation
- **E2E tests:** Full conversation flows (multi-turn, child switching, stage-aware)
- **Load tests:** T2.5 (100 concurrent families, zero cross-contamination)
- **Chaos tests:** T4.2 (memory service injection failure)
