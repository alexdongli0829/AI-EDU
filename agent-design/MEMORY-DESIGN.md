# MEMORY-DESIGN.md — Complete Memory Architecture

> **Loaded at:** System initialization (infrastructure reference)
> **Scope:** Full technical specification for EduLens memory system — data model, AgentCore configuration, Learning DNA schema, retrieval strategies, cross-session continuity, privacy isolation
> **Depends on:** [AGENTS.md](./AGENTS.md) for runtime rules, [KNOWLEDGE.md](./KNOWLEDGE.md) for domain taxonomy

---

## 1. Data Model

### Entity Relationship Diagram

```
┌──────────────┐
│   Family     │
│──────────────│
│ family_id    │───────┐
│ parent_name  │       │
│ language     │       │
│ created_at   │       │
└──────────────┘       │
                       │  1:N
                       ▼
                ┌──────────────┐
                │   Student    │
                │──────────────│
                │ student_id   │──────────────────┐
                │ family_id    │                   │
                │ name         │                   │
                │ chinese_name │                   │
                │ nickname     │                   │
                │ grade        │                   │
                │ active_stage │                   │
                │ created_at   │                   │
                └──────────────┘                   │
                       │                           │
            ┌──────────┼──────────┐                │
            │          │          │                 │
          1:N        1:N        1:1                │
            ▼          ▼          ▼                 │
     ┌──────────┐ ┌─────────┐ ┌──────────────┐    │
     │  Stage   │ │  Test   │ │ Learning DNA │    │
     │──────────│ │ Session │ │──────────────│    │
     │ stage_id │ │─────────│ │ (composite   │    │
     │ type:    │ │ sess_id │ │  profile —   │    │
     │ oc_prep  │ │ stud_id │ │  see §4)     │    │
     │ sel_prep │ │ stage   │ └──────────────┘    │
     │ enrolled │ │ test_id │                      │
     │ at       │ │ score   │                      │
     └──────────┘ │ status  │                      │
                  │ started │                      │
                  │ ended   │                      │
                  └─────────┘                      │
                       │                           │
                     1:N                           │
                       ▼                           │
                ┌──────────────┐                   │
                │  Response    │                   │
                │──────────────│                   │
                │ response_id  │                   │
                │ session_id   │                   │
                │ question_id  │                   │
                │ answer       │                   │
                │ is_correct   │                   │
                │ time_spent   │                   │
                │ error_type   │◄──────────────────┘
                │ skill        │   (classified by
                │ cog_depth    │    diagnostic skill)
                └──────────────┘
```

### Cardinality Summary

| Relationship | Cardinality | Notes |
|---|---|---|
| Family → Students | 1:N | Multi-child families are common |
| Student → Stages | 1:N | Typically 1-2 (oc_prep, selective_prep) |
| Student → TestSessions | 1:N | Accumulates over months of practice |
| TestSession → Responses | 1:N | 14-40 responses per session (depends on test type) |
| Student → LearningDNA | 1:1 | Composite profile, evolves over time |

### Stage Lifecycle

```
Student created
  │
  ├── enrolled: oc_prep
  │     ├── Test sessions accumulate
  │     ├── Learning DNA builds for Reading, Math, Thinking
  │     └── OC test taken (May, Year 4)
  │
  ├── (optional) enrolled: selective_prep
  │     ├── Learning DNA CARRIED FORWARD from oc_prep
  │     ├── Writing dimension ADDED to Learning DNA
  │     ├── Test sessions accumulate (new stage metadata)
  │     └── Selective test taken (May, Year 6)
  │
  └── archived (post-test, data retained per retention policy)
```

---

## 2. AgentCore Memory Configuration

### Memory Store Setup

```json
{
  "memoryStoreId": "edulens-memory-store",
  "description": "EduLens student learning and family insights memory",
  "storageConfig": {
    "type": "AGENT_CORE_MANAGED",
    "encryptionConfig": {
      "kmsKeyArn": "arn:aws:kms:us-west-2:ACCOUNT:key/edulens-memory-key"
    }
  },
  "namespaceConfig": {
    "hierarchical": true,
    "separator": "/",
    "rootNamespaces": [
      "/students/",
      "/families/"
    ]
  }
}
```

### Namespace Conventions

```
/students/{student_id}/learning/     ← Student learning data (all stages)
/families/{family_id}/insights/      ← Parent-side insights & preferences
```

**Stage differentiation** is handled via metadata, NOT separate namespaces:

```json
{
  "namespace": "/students/stu_abc123/learning/",
  "content": "Student demonstrated strong inference skills but struggled with author's purpose questions...",
  "metadata": {
    "stage": "oc_prep",
    "subject": "reading",
    "skill": "authors_purpose",
    "error_type": "concept_gap",
    "cognitive_depth": 3,
    "session_id": "sess_xyz789",
    "timestamp": "2026-04-06T10:30:00Z",
    "confidence": 0.85,
    "source": "session_extraction"
  }
}
```

### Why Metadata Over Sub-Namespaces

Using `/students/{id}/learning/oc_prep/reading/` would create deep, fragmented namespaces that:
- Complicate retrieval when querying across stages (e.g., "show me all reading data")
- Require namespace enumeration for cross-stage trend analysis
- Make the OC → Selective transition harder (data lives in different trees)

With flat namespaces + rich metadata:
- Single retrieval call returns all student data; application-layer metadata filter narrows to specific stage/subject
- Cross-stage queries are trivial: omit the metadata filter entirely
- OC → Selective transition requires zero data migration

> **⚠️ Implementation Note:** AgentCore's `RetrieveMemoryRecordsCommand` `filter` parameter currently **only supports namespace prefix filtering**, NOT native key-value metadata filtering. Metadata-based filtering (e.g., `stage=oc_prep`, `subject=reading`) must be implemented as **client-side post-retrieval filtering** in the application layer. Retrieve by namespace prefix → filter results in code by metadata fields.
>
> ```typescript
> // Retrieve all learning records for student, then filter in application
> const allRecords = await retrieveMemoryRecords({
>   query: parentQuestion,
>   namespace: `/students/${studentId}/learning/`,
>   maxResults: 20,  // over-fetch to allow for post-filter reduction
> });
> // Application-layer metadata filter
> const filtered = allRecords.filter(r =>
>   r.metadata?.stage === activeStage &&
>   r.metadata?.subject === targetSubject
> );
> ```

### Namespace Contents

#### `/students/{student_id}/learning/`

Contains all learning-related memories for a single student:

| Memory Category | Example Content | Metadata Tags |
|---|---|---|
| **Skill mastery updates** | "Reading inference accuracy improved from 58% to 67% over last 3 tests" | `stage`, `subject`, `skill`, `timestamp` |
| **Error pattern observations** | "Consistent misread_question errors on Math word problems with multiple conditions" | `stage`, `subject`, `error_type`, `session_id` |
| **Behavioural observations** | "Student expressed frustration during Spatial Reasoning — reduced engagement" | `stage`, `subject`, `skill`, `timestamp` |
| **Strategy effectiveness** | "Elimination strategy training reduced elimination_failure from 20% to 12%" | `stage`, `subject`, `skill` |
| **Learning DNA snapshots** | Full JSON profile (see §4) | `stage`, `snapshot_type: "learning_dna"` |
| **Session summaries** | "Session focused on Level 3 Math problems. 7/10 correct. Weak on multi-step." | `stage`, `subject`, `session_id` |

#### `/families/{family_id}/insights/`

Contains parent-facing context and preferences:

| Memory Category | Example Content | Metadata Tags |
|---|---|---|
| **Communication preferences** | "Parent prefers Chinese. Uses WeChat-style short messages." | `type: "preference"` |
| **Previous recommendations** | "Recommended focusing on Reading inference for next 2 weeks (April)" | `child_student_id`, `timestamp` |
| **Questions asked** | "Parent asked about James Ruse cut-off scores" | `topic`, `timestamp` |
| **Study plan history** | "Generated 4-week plan targeting Spatial Reasoning (March 2026)" | `child_student_id`, `timestamp` |
| **School preferences** | "Family interested in North Sydney Boys and Hornsby Girls" | `child_student_id` |

### Metadata Schema

| Field | Type | Values | Purpose |
|---|---|---|---|
| `stage` | string | `"oc_prep"` \| `"selective_prep"` | Which test the student is preparing for |
| `subject` | string | `"reading"` \| `"math"` \| `"thinking"` \| `"writing"` | Test section |
| `skill` | string | Sub-skill name (e.g., `"inference"`, `"spatial_reasoning"`) | Skill-level granularity |
| `error_type` | string | `"concept_gap"` \| `"careless"` \| `"time_pressure"` \| `"misread"` \| `"elimination_failure"` | Error classification |
| `cognitive_depth` | integer | `1` \| `2` \| `3` \| `4` | Webb's Depth of Knowledge level |
| `session_id` | string | Session identifier | Links memory to source session |
| `timestamp` | ISO 8601 | Datetime | When the memory was created |
| `confidence` | float | `0.0 - 1.0` | Agent's confidence in this classification |
| `source` | string | `"session_extraction"` \| `"test_analysis"` \| `"manual"` | How the memory was created |

---

## 3. LTM Strategy Configuration

### Design Decision: Custom Extraction vs Built-in LTM Strategies

> **Decision:** EduLens uses a **custom extraction pipeline** (SQS → Lambda) rather than AgentCore's built-in LTM strategies (`summaryMemoryStrategy`, `semanticMemoryStrategy`).
>
> **Rationale:**
> 1. **Structured metadata auto-tagging** — We need every LTM record tagged with `stage`, `subject`, `skill`, `error_type`, and `cognitive_depth`. Built-in strategies do not support custom metadata injection during extraction.
> 2. **Deduplication control** — We require semantic similarity deduplication (threshold 0.92) to prevent redundant Learning DNA entries. Built-in strategies do not expose dedup configuration.
> 3. **Learning DNA integration** — LTM extraction must trigger Learning DNA updates (skill mastery recalculation, error pattern redistribution). This requires application-level coordination that built-in strategies cannot provide.
> 4. **Multi-source extraction** — We extract from both conversation sessions AND test result analysis, each with different extraction prompts. Built-in strategies assume a single extraction pattern.
>
> **Trade-off:** Higher implementation cost, but essential for EduLens's core differentiator (structured diagnostic intelligence). Revisit if AgentCore adds custom metadata support to built-in strategies.

### Extraction Rules

When a conversation session ends, a background job scans the STM (session transcript) and extracts structured memories to LTM.

```json
{
  "extractionConfig": {
    "strategy": "EVENT_DRIVEN",
    "triggers": [
      {
        "event": "SESSION_END",
        "action": "EXTRACT_AND_STORE",
        "extractionModel": "Haiku",
        "extractionPrompt": "Extract key learning insights from this conversation. For each insight, identify: (1) the subject area, (2) the specific skill, (3) the error pattern if applicable, (4) the cognitive depth level, (5) whether this represents progress or a new gap. Output as structured JSON."
      },
      {
        "event": "TEST_RESULTS_ANALYZED",
        "action": "EXTRACT_AND_STORE",
        "extractionModel": "Haiku",
        "extractionPrompt": "Extract per-question error classifications and skill-level performance summaries from this test analysis conversation. Tag each with subject, skill, error type, and cognitive depth."
      },
      {
        "event": "PARENT_PREFERENCE_STATED",
        "action": "EXTRACT_AND_STORE",
        "extractionModel": "Haiku",
        "extractionPrompt": "Extract parent preferences, goals, constraints, and school preferences from this conversation. Tag with relevant child_student_id and topic."
      }
    ],
    "namespaceTemplate": {
      "studentAgent": "/students/${actor_id.student_id}/learning/",
      "parentAgent": "/families/${actor_id.family_id}/insights/"
    },
    "metadataExtraction": {
      "autoTag": ["stage", "subject", "skill", "error_type", "cognitive_depth"],
      "timestampField": "timestamp",
      "sessionIdField": "session_id"
    },
    "deduplication": {
      "strategy": "SEMANTIC_SIMILARITY",
      "threshold": 0.92,
      "action": "MERGE_KEEP_LATEST"
    }
  }
}
```

### Extraction Pipeline

```
Session Ends
  │
  ▼
SQS Message: { sessionId, agentType, actorId }
  │
  ▼
Lambda: edulens-memory-extractor
  │
  ├── 1. Retrieve full session transcript from STM
  │
  ├── 2. Call extraction model (Haiku for speed/cost):
  │      "Extract learning insights from this session..."
  │
  ├── 3. Parse structured output into memory entries
  │
  ├── 4. Tag each entry with metadata
  │
  ├── 5. Deduplicate against existing LTM entries
  │      (semantic similarity > 0.92 → merge)
  │      NOTE: AgentCore does NOT have built-in dedup.
  │      Implementation: Retrieve existing entries for same namespace →
  │      compute embedding similarity (Titan Embeddings v2) →
  │      if similarity > 0.92 → merge metadata, keep latest content.
  │      Requires: additional Lambda + Bedrock Titan Embeddings calls.
  │
  ├── 6. Write new/merged entries to LTM via AgentCore API
  │
  └── 7. If test results were analysed:
         Queue Learning DNA update job
```

### Write Rate Limits

| Operation | Limit | Rationale |
|---|---|---|
| LTM writes per session | 20 max | Prevent memory flooding from verbose sessions |
| Learning DNA updates per day | 5 per student | Prevent profile thrashing from multiple test reviews |
| LTM entries per student (total) | 1,000 soft limit | Trigger compaction at threshold |

---

## 4. STM Session Management

### Configuration

```json
{
  "stmConfig": {
    "maxTurns": 200,
    "maxTokens": 128000,
    "truncationStrategy": "SLIDING_WINDOW",
    "slidingWindowSize": 50,
    "persistOnEnd": true,
    "ttl": "24h"
  }
}
```

### STM Lifecycle

```
Session Start
  │
  ├── Initialize empty STM buffer
  ├── Load agent identity (SOUL.md + IDENTITY.md)
  ├── Retrieve relevant LTM (see §5 Retrieval Config)
  ├── Load Learning DNA summary into context
  │
  ▼
During Session
  │
  ├── Each user message → append to STM
  ├── Each agent response → append to STM
  ├── Inline tagging of significant moments:
  │     ├── [INSIGHT] New error pattern detected
  │     ├── [MASTERY] Evidence of skill improvement
  │     ├── [EMOTION] Student frustration/engagement signal
  │     └── [PREFERENCE] Parent stated preference
  │
  ▼
Sliding Window Active
  │
  ├── When token count approaches maxTokens
  ├── Oldest turns summarised and compressed
  ├── Summary retained; raw turns dropped
  │
  ▼
Session End
  │
  ├── Full transcript available for extraction
  ├── Background extraction job triggered
  └── STM cleared after extraction completes (or after TTL)
```

### Inline Insight Tagging

During the conversation, the agent tags significant observations:

```json
{
  "turn": 14,
  "tag": "INSIGHT",
  "content": "Student consistently misreads 'most likely' as 'definitely' in inference questions",
  "metadata": {
    "subject": "reading",
    "skill": "inference",
    "error_type": "misread_question",
    "priority": "high"
  }
}
```

These tagged insights are prioritised during the extraction phase.

---

## 5. Retrieval Configuration

### Parent Agent Retrieval

```json
{
  "retrievalConfig": {
    "agentType": "parent_agent",
    "actorId": "family_{family_id}",
    "namespaces": [
      "/families/${family_id}/insights/",
      "/students/${child_1_id}/learning/",
      "/students/${child_2_id}/learning/"
    ],
    "defaultFilters": {
      "recency": "last_90_days",
      "limit": 20
    },
    "contextualFilters": {
      "whenChildIdentified": {
        "primaryNamespace": "/students/${identified_child_id}/learning/",
        "filterBy": ["stage", "subject"],
        "limit": 15,
        "includeLearningDNA": true
      },
      "whenNoChildIdentified": {
        "summaryMode": true,
        "fetch": "learning_dna_only",
        "forEachChild": true
      },
      "whenSubjectDiscussed": {
        "metadata.subject": "${identified_subject}"
      }
    },
    "ranking": {
      "strategy": "RECENCY_WEIGHTED",
      "recencyWeight": 0.4,
      "relevanceWeight": 0.6
    },
    "alwaysInclude": [
      "learning_dna_snapshot (most recent per child)",
      "last_3_recommendations (from family insights)"
    ]
  }
}
```

### Student Agent Retrieval

```json
{
  "retrievalConfig": {
    "agentType": "student_agent",
    "actorId": "student_{student_id}",
    "namespaces": [
      "/students/${student_id}/learning/"
    ],
    "hardIsolation": {
      "blockedPatterns": [
        "/students/{ANY_OTHER_student_id}/*",
        "/families/*"
      ],
      "enforcement": "application + cedar_policy"
    },
    "defaultFilters": {
      "metadata.stage": "${active_stage}",
      "recency": "last_60_days",
      "limit": 15
    },
    "ranking": {
      "strategy": "RECENCY_WEIGHTED",
      "recencyWeight": 0.3,
      "relevanceWeight": 0.7
    },
    "alwaysInclude": [
      "learning_dna_snapshot (most recent)",
      "last_session_summary"
    ]
  }
}
```

### Retrieval Flow Diagram

```
                    ┌─────────────────────────┐
                    │   Session Start          │
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │   Determine agent type   │
                    └────────┬────────────────┘
                             │
               ┌─────────────┼─────────────┐
               ▼                            ▼
    ┌──────────────────┐         ┌──────────────────┐
    │  Parent Agent     │         │  Student Agent    │
    │──────────────────│         │──────────────────│
    │ 1. Load family    │         │ 1. Load student   │
    │    roster         │         │    profile        │
    │ 2. Fetch DNA for  │         │ 2. Fetch own DNA  │
    │    each child     │         │ 3. Fetch recent   │
    │ 3. Fetch family   │         │    LTM entries    │
    │    insights       │         │ 4. ISOLATION CHECK│
    │ 4. Wait for child │         │    ├─ No /family/ │
    │    identification  │         │    ├─ No other    │
    │ 5. Deep-fetch for │         │    │   students   │
    │    identified child│         │    └─ PASS/FAIL   │
    └──────────────────┘         └──────────────────┘
```

### Example Retrieval: Parent Asks About a Child's Reading

```
Query: "How is Ethan doing in reading?"
  │
  ▼
NLU: child="Ethan" → student_id="stu_abc123", subject="reading"
  │
  ▼
Retrieval Request:
  namespace: /students/stu_abc123/learning/
  filter: { metadata.subject: "reading" }
  include: Learning DNA summary
  limit: 20
  ranking: recency(0.4) + relevance(0.6)
  │
  ▼
AgentCore returns:
  ├── Learning DNA (reading section)
  ├── 20 most recent+relevant reading insights
  └── Error pattern distribution for reading
  │
  ▼
Context assembled → Model generates grounded response
```

---

## 6. Learning DNA Schema

The Learning DNA is the composite student profile — a living document that evolves with every test session and significant conversation insight. It is the single most important data structure in the system.

### Complete Schema

```json
{
  "student_id": "stu_abc123",
  "student_name": "Ethan",
  "last_updated": "2026-04-06T12:00:00Z",
  "version": 14,
  "schema_version": "1.0",
  "active_stage": "oc_prep",

  "core_traits": {
    "learning_speed": {
      "value": 0.72,
      "trend": "improving",
      "description": "Rate at which the student acquires new concepts"
    },
    "attention_to_detail": {
      "value": 0.58,
      "trend": "stable",
      "description": "Inversely correlates with careless error rate"
    },
    "time_management": {
      "value": 0.65,
      "trend": "improving",
      "description": "Ability to pace through timed sections effectively"
    },
    "resilience": {
      "value": 0.80,
      "trend": "stable",
      "description": "Ability to maintain performance after getting questions wrong"
    }
  },

  "stages": {
    "oc_prep": {
      "reading": {
        "mastery": 0.72,
        "trend": "improving",
        "sessions_analysed": 8,
        "last_session_score": 0.78,
        "sub_skills": {
          "literal_comprehension": { "mastery": 0.88, "trend": "stable", "depth_ceiling": 3 },
          "inference": { "mastery": 0.65, "trend": "improving", "depth_ceiling": 3 },
          "vocabulary_in_context": { "mastery": 0.75, "trend": "stable", "depth_ceiling": 2 },
          "authors_purpose": { "mastery": 0.55, "trend": "declining", "depth_ceiling": 2 },
          "text_structure": { "mastery": 0.70, "trend": "improving", "depth_ceiling": 3 },
          "critical_evaluation": { "mastery": 0.60, "trend": "stable", "depth_ceiling": 2 },
          "synthesis": { "mastery": 0.50, "trend": "stable", "depth_ceiling": 2 }
        }
      },
      "math": {
        "mastery": 0.65,
        "trend": "stable",
        "sessions_analysed": 8,
        "last_session_score": 0.63,
        "sub_skills": {
          "number_algebra": { "mastery": 0.78, "trend": "stable", "depth_ceiling": 3 },
          "measurement_geometry": { "mastery": 0.62, "trend": "improving", "depth_ceiling": 2 },
          "statistics_probability": { "mastery": 0.70, "trend": "stable", "depth_ceiling": 3 },
          "patterns_relationships": { "mastery": 0.68, "trend": "improving", "depth_ceiling": 3 },
          "problem_solving_strategies": { "mastery": 0.55, "trend": "stable", "depth_ceiling": 2 },
          "multi_step_reasoning": { "mastery": 0.50, "trend": "declining", "depth_ceiling": 2 },
          "word_problem_comprehension": { "mastery": 0.58, "trend": "stable", "depth_ceiling": 2 }
        }
      },
      "thinking": {
        "mastery": 0.58,
        "trend": "declining",
        "sessions_analysed": 8,
        "last_session_score": 0.53,
        "sub_skills": {
          "critical_thinking": { "mastery": 0.65, "trend": "stable", "depth_ceiling": 3 },
          "problem_solving": { "mastery": 0.60, "trend": "stable", "depth_ceiling": 2 },
          "spatial_reasoning": { "mastery": 0.38, "trend": "declining", "depth_ceiling": 2 },
          "pattern_recognition": { "mastery": 0.68, "trend": "improving", "depth_ceiling": 3 },
          "logical_reasoning": { "mastery": 0.62, "trend": "stable", "depth_ceiling": 3 },
          "data_extraction": { "mastery": 0.55, "trend": "stable", "depth_ceiling": 2 }
        }
      }
    },
    "selective_prep": null
  },

  "error_patterns": {
    "overall": {
      "concept_gap": 0.15,
      "careless_error": 0.30,
      "time_pressure": 0.25,
      "misread_question": 0.10,
      "elimination_failure": 0.20
    },
    "by_subject": {
      "reading": {
        "concept_gap": 0.20,
        "careless_error": 0.10,
        "time_pressure": 0.15,
        "misread_question": 0.25,
        "elimination_failure": 0.30
      },
      "math": {
        "concept_gap": 0.15,
        "careless_error": 0.40,
        "time_pressure": 0.20,
        "misread_question": 0.15,
        "elimination_failure": 0.10
      },
      "thinking": {
        "concept_gap": 0.10,
        "careless_error": 0.20,
        "time_pressure": 0.35,
        "misread_question": 0.05,
        "elimination_failure": 0.30
      }
    },
    "trend_summary": "careless_error declining (positive), time_pressure stable, elimination_failure improving"
  },

  "behavior": {
    "avg_time_per_question": {
      "reading": 2.5,
      "math": 1.2,
      "thinking": 1.0
    },
    "skip_rate": 0.05,
    "change_answer_rate": 0.12,
    "time_distribution": "front_loaded",
    "completion_rate": {
      "reading": 0.95,
      "math": 0.88,
      "thinking": 0.83
    },
    "stamina": {
      "accuracy_first_half": 0.75,
      "accuracy_second_half": 0.60,
      "pattern": "declining — fatigue or rush at end"
    }
  },

  "milestones": [
    {
      "date": "2026-02-15",
      "type": "baseline",
      "description": "First diagnostic test completed",
      "snapshot": { "reading": 0.55, "math": 0.50, "thinking": 0.45 }
    },
    {
      "date": "2026-03-01",
      "type": "skill_breakthrough",
      "description": "Inference mastery crossed 60% threshold after targeted practice",
      "subject": "reading",
      "skill": "inference"
    },
    {
      "date": "2026-03-20",
      "type": "error_pattern_shift",
      "description": "Careless errors in math dropped from 45% to 30% after checking strategy introduced",
      "subject": "math"
    },
    {
      "date": "2026-03-28",
      "type": "concern_flag",
      "description": "Spatial reasoning declining for 3 consecutive sessions — needs intervention",
      "subject": "thinking",
      "skill": "spatial_reasoning"
    }
  ],

  "recommendations": {
    "priority_focus": [
      {
        "area": "thinking.spatial_reasoning",
        "reason": "Declining trend, lowest mastery (0.38), high time_pressure error rate",
        "strategy": "Targeted spatial transformation exercises, 10 min/day",
        "zpd_level": "Level 1-2 (rebuild from foundations)"
      },
      {
        "area": "reading.authors_purpose",
        "reason": "Declining trend, below subject average",
        "strategy": "Practice identifying purpose across different text types",
        "zpd_level": "Level 2-3"
      }
    ],
    "maintain": [
      "reading.literal_comprehension",
      "math.number_algebra",
      "thinking.pattern_recognition"
    ]
  }
}
```

### Core Traits — Calculation Methods

| Trait | Derived From | Calculation |
|---|---|---|
| `learning_speed` | Rate of mastery improvement across sessions | Slope of mastery trend line over last 5 sessions, normalised to 0-1 |
| `attention_to_detail` | Inverse of careless_error rate | `1.0 - error_patterns.overall.careless_error` (smoothed over 3 sessions) |
| `time_management` | Ratio of actual vs ideal time allocation per section | How closely the student's time per question matches target pacing |
| `resilience` | Performance consistency on hard questions | Accuracy on Level 3-4 questions relative to Level 1-2 accuracy |

### Trend Calculation Rules

```
Given: mastery scores from last 6+ sessions for a skill

recent_avg = mean(mastery of sessions [-3, -2, -1])
prior_avg  = mean(mastery of sessions [-6, -5, -4])
delta      = recent_avg - prior_avg

IF delta > 0.05:  trend = "improving"
IF delta < -0.05: trend = "declining"
ELSE:             trend = "stable"

Special cases:
  - Fewer than 6 sessions: compare last 2 vs prior 2
  - Fewer than 4 sessions: trend = "insufficient_data"
  - Single session only: trend = "insufficient_data"
```

### Schema Field Reference

| Field | Type | Description |
|---|---|---|
| `mastery` | float (0.0-1.0) | Current skill proficiency estimate |
| `trend` | enum | `"improving"` / `"stable"` / `"declining"` / `"insufficient_data"` |
| `depth_ceiling` | integer (1-4) | Highest Webb's DOK level the student can consistently handle |
| `sessions_analysed` | integer | Number of test sessions contributing to this assessment |
| `last_session_score` | float (0.0-1.0) | Most recent session performance for this area |
| `version` | integer | Incremented on each Learning DNA update for conflict detection |
| `schema_version` | string | Schema version for forward compatibility |

---

## 7. Cross-Session Continuity

### How the Agent "Remembers"

The agent does not have persistent memory between sessions by default. Continuity is achieved through the LTM retrieval pattern:

```
Session N:
  Student struggles with inference questions → tagged [INSIGHT]
  Session ends → background job extracts:
    Memory: "Student consistently misidentifies author's implied meaning.
             Inference accuracy: 58%. Error type: concept_gap.
             Needs explicit instruction on 'reading between the lines' strategies."
    Metadata: { stage: "oc_prep", subject: "reading", skill: "inference",
                error_type: "concept_gap", confidence: 0.85 }
  → Written to /students/{id}/learning/

Session N+1:
  Session starts → retrieve LTM → this memory surfaces
  Agent opens with: "Last time we worked on inference questions in Reading.
                     You were getting about 6 out of 10 right. Want to try
                     some more today, or work on something different?"
```

### Continuity Mechanisms

| Mechanism | What It Provides | How |
|---|---|---|
| **Learning DNA** | Global student profile | Retrieved at every session start; summarises all historical data |
| **Recent LTM entries** | Specific recent observations | Last 15-20 entries retrieved; provides conversational continuity |
| **Session summaries** | What happened last time | One-paragraph summary of each past session; enables "last time we..." references |
| **Milestone entries** | Notable progress events | Stored separately; enables "remember when you first got 8/10 on inference?" moments |

### Continuity Signals in Agent Responses

| Signal | Agent Response |
|---|---|
| Student returns after working on a specific skill | "Welcome back! You were focusing on inference questions last time. Want to continue with that, or try something new?" |
| Parent asks about progress | "Since we last spoke 2 weeks ago, Ethan has completed 3 more test sessions. His reading inference has improved from 58% to 65%." |
| Recurring error pattern detected | "I've noticed this same pattern across your last 4 sessions — you tend to rush through the last 5 thinking skills questions. Let's work on a pacing strategy." |

### What Gets Remembered vs. What Gets Forgotten

| Remembered (LTM) | Forgotten (STM only) |
|---|---|
| Skill mastery changes | Exact conversation wording |
| Error pattern classifications | Intermediate Socratic reasoning steps |
| Key insights about learning style | Off-topic chat |
| Milestones and breakthroughs | Correctly answered routine questions |
| Parent preferences and communication style | Greetings and session mechanics |
| Study plan adjustments | Model routing decisions |

### Continuity Anti-Patterns

| Anti-Pattern | Why It's Bad | What To Do Instead |
|---|---|---|
| Store entire conversation transcripts in LTM | Bloats memory, slow retrieval, costly | Extract key insights only |
| Update Learning DNA in real-time during conversation | Profile thrashing, inconsistent state | Update asynchronously post-session |
| Rely on STM across sessions | STM is cleared at session end | Always use LTM for cross-session data |
| Overwrite Learning DNA on every update | Loses historical evolution | Append milestones, snapshot previous version |

---

## 8. OC → Selective Transition (Data Preservation)

When a student transitions from OC Prep to Selective Prep, the Learning DNA must be extended, not replaced.

### Transition Process

```
PRE-TRANSITION (student.active_stage = "oc_prep")
  │
  │  Learning DNA contains:
  │    stages.oc_prep.reading  = { mastery: 0.72, sub_skills: {...} }
  │    stages.oc_prep.math     = { mastery: 0.65, sub_skills: {...} }
  │    stages.oc_prep.thinking = { mastery: 0.58, sub_skills: {...} }
  │    error_patterns = { concept_gap: 0.15, careless: 0.30, ... }
  │    behavior = { avg_time: {...}, skip_rate: 0.05, ... }
  │
  ▼
TRANSITION EVENT
  │
  ├── 1. Snapshot current Learning DNA as milestone:
  │      { date: "2026-06-01", type: "stage_transition",
  │        description: "OC → Selective transition",
  │        oc_final_profile: { reading: 0.72, math: 0.65, thinking: 0.58 } }
  │
  ├── 2. Set student.active_stage = "selective_prep"
  │
  ├── 3. Initialize stages.selective_prep:
  │      ├── reading:  Bootstrapped from oc_prep (× 0.85 confidence discount)
  │      ├── math:     Bootstrapped from oc_prep (× 0.85 confidence discount)
  │      ├── thinking: Bootstrapped from oc_prep (× 0.80 discount — harder)
  │      └── writing:  { mastery: null, trend: "insufficient_data",
  │                      sub_skills: all null — awaiting first Writing session }
  │
  ├── 4. Preserve core_traits (carry over — student-level, not stage-level)
  │
  ├── 5. Preserve error_patterns (carry over as starting distribution)
  │
  └── 6. Preserve behavior data (carry over)
```

### Bootstrap Logic

```python
def bootstrap_selective_from_oc(learning_dna: dict) -> dict:
    """Initialize selective_prep stage from existing oc_prep data."""
    oc = learning_dna["stages"]["oc_prep"]

    selective = {
        "reading": {
            **oc["reading"],
            "mastery": oc["reading"]["mastery"] * 0.85,  # Selective harder
            "trend": "insufficient_data",
            "sessions_analysed": 0,
        },
        "math": {
            **oc["math"],
            "mastery": oc["math"]["mastery"] * 0.85,
            "trend": "insufficient_data",
            "sessions_analysed": 0,
        },
        "thinking": {
            **oc["thinking"],
            "mastery": oc["thinking"]["mastery"] * 0.80,  # 10 more Q, harder
            "trend": "insufficient_data",
            "sessions_analysed": 0,
        },
        "writing": {
            "mastery": None,
            "trend": "insufficient_data",
            "sessions_analysed": 0,
            "last_session_score": None,
            "sub_skills": {
                "ideas_content": {"mastery": None, "trend": "insufficient_data"},
                "structure": {"mastery": None, "trend": "insufficient_data"},
                "language": {"mastery": None, "trend": "insufficient_data"},
                "conventions": {"mastery": None, "trend": "insufficient_data"},
                "audience_purpose": {"mastery": None, "trend": "insufficient_data"},
                "engagement": {"mastery": None, "trend": "insufficient_data"},
            },
        },
    }

    # Add milestone
    learning_dna["milestones"].append({
        "date": datetime.utcnow().isoformat(),
        "type": "stage_transition",
        "description": "OC → Selective transition",
        "oc_final_profile": {
            subj: oc[subj]["mastery"] for subj in ["reading", "math", "thinking"]
        },
    })

    learning_dna["stages"]["selective_prep"] = selective
    learning_dna["active_stage"] = "selective_prep"
    learning_dna["version"] += 1
    return learning_dna
```

### What Carries Over vs What Resets

| Data | Carries Over? | Notes |
|---|---|---|
| `core_traits` | Yes | Student-level, not stage-level |
| `error_patterns` | Yes | Starting distribution; evolves with new data |
| `behavior` | Yes | Time management patterns persist |
| `stages.oc_prep` | Preserved (read-only) | Historical reference; no longer updated |
| `stages.selective_prep.reading/math/thinking` | Initialised from OC baseline | Mastery scores discounted (harder test) |
| `stages.selective_prep.writing` | New (null) | No prior data; awaits first Writing session |
| `milestones` | Yes | OC milestones preserved + transition milestone added |
| LTM entries | Yes (all retained) | Metadata-filtered; default retrieval scoped to active stage |

---

## 9. Privacy & Isolation

### Three-Layer Defence Model

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Cedar Policy (AgentCore)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Layer 2: System Prompt Declaration               │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  Layer 1: Application-Level Retrieval Config│  │  │
│  │  │                                             │  │  │
│  │  │  Retrieval config assembled at session      │  │  │
│  │  │  start. Only authorized namespaces          │  │  │
│  │  │  included in the config object.             │  │  │
│  │  │                                             │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                   │  │
│  │  System prompt explicitly declares:               │  │
│  │  "You have access ONLY to data for student        │  │
│  │   {name}. You MUST NOT reference or access        │  │
│  │   data for any other student."                    │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Cedar policies block cross-student/cross-family        │
│  retrieve operations even if Layers 1-2 misconfigured.  │
│  This is the last line of defence.                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Layer 1 — Application-Level Retrieval Scoping

At session start, the backend service constructs the retrieval config containing ONLY authorized namespaces:

```typescript
function buildRetrievalConfig(agentType: string, actor: Actor): RetrievalConfig {
  if (agentType === 'student_agent') {
    return {
      namespaces: [`/students/${actor.studentId}/learning/`],
      hardIsolation: true,
      crossNamespaceAccess: false,
    };
  }

  if (agentType === 'parent_agent') {
    const childNamespaces = actor.children.map(
      (child) => `/students/${child.studentId}/learning/`
    );
    return {
      namespaces: [
        `/families/${actor.familyId}/insights/`,
        ...childNamespaces,
      ],
      hardIsolation: true,
      crossNamespaceAccess: false,
    };
  }
}
```

### Layer 2 — System Prompt Declaration

**Student Agent system prompt (injected):**
```
PRIVACY BOUNDARY: You have access ONLY to learning data for ${student_name}
(ID: ${student_id}). You MUST NOT reference, access, or discuss data for
any other student. You MUST NOT access the /families/ namespace. If asked
about another student, respond: "I can only help with your own learning."
```

**Parent Agent system prompt (injected):**
```
PRIVACY BOUNDARY: You have access to learning data for your children:
${children_names}. You MUST NOT access data for students outside this family.
You MUST NOT display student_id values — always use the child's name.
```

### Layer 3 — Cedar Policy (Defence in Depth)

See [AGENTS.md](./AGENTS.md) §7 for complete Cedar policy rules. Summary:

| Policy | Effect |
|---|---|
| Student can only retrieve own namespace | `resource.namespace` must match `/students/{own_id}/learning/` |
| Parent can retrieve family insights | `resource.namespace` must match `/families/{own_family_id}/insights/` |
| Parent can retrieve children's data | `resource.namespace` must be in family roster |
| Default deny | All operations not explicitly permitted are blocked |

### Cross-Family Isolation

```
Family A (Li family)                Family B (Chen family)
┌─────────────────────┐            ┌─────────────────────┐
│ /families/fam_001/  │            │ /families/fam_002/  │
│ /students/stu_001/  │    ╳      │ /students/stu_003/  │
│ /students/stu_002/  │  (no      │ /students/stu_004/  │
│                     │  access)  │                     │
└─────────────────────┘            └─────────────────────┘
```

### Isolation Verification Test Cases

| Test Case | Expected Outcome |
|---|---|
| Student A agent retrieves from `/students/stu_B/learning/` | **BLOCKED** at all 3 layers |
| Student agent retrieves from `/families/fam_123/insights/` | **BLOCKED** at all 3 layers |
| Parent agent retrieves from `/students/unrelated_child/learning/` | **BLOCKED** (child not in roster) |
| Parent agent retrieves from `/families/other_family/insights/` | **BLOCKED** at all 3 layers |
| Parent agent retrieves from `/students/own_child/learning/` | **ALLOWED** |
| Student agent retrieves from `/students/own_id/learning/` | **ALLOWED** |

### Student ID Exposure Prevention

| Context | Internal | External Representation |
|---|---|---|
| Parent conversation | `stu_abc123` | "Ethan" or "your child" |
| Student conversation | `stu_abc123` | "you" |
| Error messages | `stu_abc123` | Redacted — "Unable to load profile" |
| System logs | `stu_abc123` | Allowed (not user-facing) |

### Data Retention & Deletion

| Event | Action |
|---|---|
| Active subscription | All data retained and accessible |
| Subscription cancelled | Data retained for 30 days (grace period) |
| 30 days post-cancellation | Data marked for permanent deletion |
| Deletion request (parent) | All family data queued for deletion within 30 days |
| Deletion execution | All LTM entries, DNA snapshots, session data permanently removed |

### Audit Trail

All data access operations are logged (without PII):

```json
{
  "timestamp": "2026-04-06T10:30:00Z",
  "agent_type": "parent_agent",
  "actor_id": "family_fam_001",
  "operation": "retrieve",
  "namespace": "/students/stu_001/learning/",
  "entries_returned": 15,
  "filters_applied": { "stage": "oc_prep", "subject": "math" },
  "authorization": "permitted"
}
```

---

## 10. Data Flow Diagrams

### Test Session Analysis Flow

```
Student completes test
  │
  ▼
Test Engine writes results to DB:
  test_sessions + session_responses tables
  │
  ▼
EventBridge triggers analysis:
  event: "test.session.completed"
  payload: { student_id, session_id, stage }
  │
  ▼
Lambda: edulens-test-analyzer
  │
  ├── 1. Load session responses from DB
  ├── 2. For each question:
  │      ├── Classify error type (Haiku batch call)
  │      ├── Tag with skill + cognitive depth
  │      └── Record time-per-question
  ├── 3. Aggregate per-subject and per-skill scores
  ├── 4. Compare against Learning DNA baseline
  ├── 5. Identify significant changes (improvements/declines)
  │
  ▼
Write to AgentCore LTM:
  namespace: /students/{student_id}/learning/
  entries: [per-skill insights, error pattern summary, session overview]
  │
  ▼
Queue Learning DNA Update:
  SQS → edulens-dna-updater Lambda
  │
  ▼
Lambda: edulens-dna-updater
  ├── Retrieve all recent LTM entries for student
  ├── Recalculate mastery scores per sub-skill
  ├── Update trends
  ├── Compute new recommendations
  └── Write updated Learning DNA to LTM
```

### Multi-Child Parent Query Flow

```
Parent: "How are both kids doing?"
  │
  ▼
NLU: intent=progress_overview, children=ALL
  │
  ▼
For each child in family.children:
  │
  ├── child_1 (Ethan, oc_prep):
  │   ├── Retrieve LTM: /students/stu_ethan/learning/
  │   └── Load Learning DNA summary
  │
  └── child_2 (Emily, selective_prep):
      ├── Retrieve LTM: /students/stu_emily/learning/
      └── Load Learning DNA summary
  │
  ▼
Assemble per-child summary (side-by-side, NOT ranking)
  │
  ▼
Generate response:
  "Here's a summary for each child:

   **Ethan (OC Prep):** Reading 72% ↑, Math 65% →, Thinking 58% ↓
   Focus area: Spatial Reasoning

   **Emily (Selective Prep):** Reading 80% →, Math 75% ↑, Thinking 70% →, Writing 65% ↑
   Focus area: Math multi-step reasoning

   Would you like me to go deeper on either child?"
```

---

## 11. Memory Compaction

When a student's LTM entry count approaches the 1,000 soft limit:

### Compaction Process

```
1. GROUP    entries by (subject, skill) combination
2. RANK     each cluster by recency
3. PRESERVE most recent 3 entries per cluster verbatim
4. SUMMARISE remaining entries into consolidated memories (Sonnet)
5. ARCHIVE  original entries (retained for audit, excluded from retrieval)
6. WRITE    consolidated summaries as new LTM entries
7. UPDATE   entry count metadata
```

### Compaction Triggers

| Trigger | Threshold | Action |
|---|---|---|
| Entry count approaching limit | 800+ entries | Queue compaction job |
| Scheduled maintenance | Weekly (Sunday 03:00 UTC) | Compact any student > 500 entries |
| Manual request | Admin API | Compact specific student |

---

## 12. Capacity & Scaling

### Memory Growth Estimates

| Metric | Estimate |
|---|---|
| LTM entries per student per month | 15-30 |
| LTM entry average size | ~500 tokens |
| Learning DNA size | ~2,000 tokens |
| Family insights per family per month | 5-10 entries |
| Active students (Year 1 target) | 500-2,000 |
| Total LTM entries after 12 months | ~200,000-500,000 |

### Performance Targets

| Operation | Target Latency |
|---|---|
| LTM retrieval (filtered, top-20) | < 200ms |
| Learning DNA load | < 100ms |
| Session context assembly | < 500ms total |
| LTM write (single entry) | < 150ms |
| Extraction pipeline (session end) | < 30s (async) |
| Learning DNA update | < 60s (async) |

### Cost Optimization

1. **Cache Learning DNA** in session context — retrieve once at session start, not every turn
2. **Batch error classification** — classify all questions in one Haiku call, not individually
3. **Deduplication** — semantic similarity check prevents memory bloat
4. **TTL on STM** — auto-cleanup after 24h prevents storage growth
5. **Metadata-filtered retrieval** — narrow queries reduce scan volume and cost
6. **Compaction** — keep active entry count manageable (target < 500 per student)

---

## 13. Implementation Checklist

- [ ] Define AgentCore memory store with two top-level namespaces
- [ ] Implement namespace construction from `student_id` and `family_id`
- [ ] Build retrieval config factory for Parent Agent and Student Agent
- [ ] Implement LTM extraction background worker (SQS-triggered)
- [ ] Define extraction prompt for Haiku (structured output with metadata)
- [ ] Implement Learning DNA calculation job
- [ ] Build OC → Selective transition handler
- [ ] Write Cedar policy rules and test isolation
- [ ] Implement memory compaction job (triggered at 1,000 entry threshold)
- [ ] Add audit logging for all retrieve/write operations
- [ ] Implement data deletion workflow (parent-initiated)
- [ ] Load test: verify retrieval latency < 500ms for typical session start
- [ ] Integration test: verify cross-student isolation (negative test)
- [ ] Integration test: verify parent multi-child access (positive test)
