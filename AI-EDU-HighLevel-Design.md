# EduLens (学习透镜) — High-Level Architecture & Product Design

> **Version:** 2.1 | **Status:** Design Phase | **Companion:** [AI-EDU-UI-Mockup.html](./AI-EDU-UI-Mockup.html)
>
> **Platform:** AWS | **Last Updated:** 2026-03-13
>
> **What's New in v2.1:**
> - Comprehensive multi-turn conversation architecture with 3-tier memory system
> - Agent state machine for production-ready operations
> - Token budget management with explicit allocation strategy
> - Prompt caching implementation (29% cost savings)
> - Cross-session memory & topic-aware conversation branching
> - SSE streaming for AI responses alongside WebSocket for timer
> - Model routing matrix for cost optimization (Sonnet vs Haiku)
> - Complete conversation → profile signal extraction pipeline

---

## Architecture Philosophy

This design combines the **best of two approaches**:

**From AWS-Native Architecture (v1):**
- Enterprise-grade infrastructure (Lambda, RDS Aurora, ElastiCache)
- Comprehensive privacy & compliance framework (Australian Privacy Act)
- Detailed question bank strategy with quality assurance
- Production monitoring & observability (CloudWatch, X-Ray)
- Robust testing strategy (unit, integration, E2E, load)

**From Conversation-First Architecture (v2):**
- Multi-turn conversation memory (3-tier: short/medium/long-term)
- Agent state machine (4 states: idle/processing/responding/waiting)
- Token budget management with sliding window summarization
- Prompt caching for 29% cost reduction
- Cross-session recall (parents can reference past conversations)
- Topic-aware context switching
- SSE streaming for responsive UX
- Model routing (Sonnet for quality, Haiku for cost)

**Result:** A production-ready AWS architecture with sophisticated conversation capabilities that scale from MVP (100 users) to enterprise (10,000+ users).

---

## Table of Contents

1. [Product Vision & Positioning](#1-product-vision--positioning)
2. [Core Concept: Learning DNA](#2-core-concept-learning-dna-学习dna)
3. [System Architecture](#3-system-architecture)
4. [Data Model](#4-data-model)
5. [AI Agent Design](#5-ai-agent-design)
6. [API Design](#6-api-design)
7. [Tech Stack (AWS)](#7-tech-stack-aws)
8. [AI Cost Management](#8-ai-cost-management)
9. [Data Privacy & Compliance](#9-data-privacy--compliance)
10. [Question Bank Strategy](#10-question-bank-strategy)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Testing Strategy](#12-testing-strategy)
13. [MVP Phasing](#13-mvp-phasing)
14. [Competitive Moat Analysis](#14-competitive-moat-analysis)

---

## 1. Product Vision & Positioning

### Brand

**EduLens** (学习透镜) — *See how your child really learns.*

The name captures the product's core promise: a lens that brings the opaque process of learning into focus. Not a score. Not a report. A living, evolving picture of how a child thinks.

### The Problem We Solve

In the NSW OC/Selective School exam prep market, parents spend $5,000–$15,000/year on tutoring. They receive:

| What they get today | What's missing |
|---|---|
| Raw test scores | *Why* their child got questions wrong |
| Percentile rankings | Whether errors are conceptual gaps or careless mistakes |
| PDF progress reports | Whether their child is rushing, guessing, or genuinely confused |
| Generic study advice | Actionable, personalized next steps |

**EduLens replaces the static report with a conversation.** Parents don't read dashboards — they talk to a knowledgeable teacher who has studied every answer, every hesitation, every pattern in their child's work.

### Positioning Statement

> For parents preparing children for NSW OC and Selective School exams, EduLens is an AI academic assistant that transforms structured test data into a living student profile and delivers personalized guidance through conversation — so understanding your child's learning is as natural as talking to their best teacher.

### Differentiator Frame

```
Traditional Tutoring     →  Expert but expensive, unscalable
MockStar / Online Tests  →  Scalable but shallow (scores, not insight)
EduLens                  →  Expert-depth insight at platform scale
```

The key insight: **the test is not the product — the understanding is.** Tests are the data collection mechanism. The product is the intelligence that emerges from that data and the conversational interface that makes it accessible.

### Core Flow

```
Test (anchor) → Chat (interface) → Profile (intelligence) → Parent AI (value delivery)
```

Each step feeds the next:
- **Test** generates structured performance data
- **Student Chat** adds signal (confusion patterns, reasoning gaps) while providing immediate value
- **Profile Engine** synthesizes all signals into a graph-based student model
- **Parent AI** translates the profile into natural, actionable conversation

---

## 2. Core Concept: Learning DNA (学习DNA)

### Why Not Just Scores?

A score of 72% tells a parent nothing actionable. Two students can both score 72% with completely different learning profiles:

- **Student A:** Strong in reading comprehension, weak in mathematical reasoning, rushes through easy questions, runs out of time on hard ones
- **Student B:** Solid across all areas but makes careless errors consistently — misreads questions, selects wrong options despite knowing the concept

EduLens builds a **Learning DNA** — a graph-based, multi-dimensional model of how a student learns, not just what they score.

### Learning DNA Structure

```
Learning DNA
├── Skill Graph (what they know)
│   ├── Category Nodes (Reading, Math, Thinking Skills, Writing)
│   │   ├── Sub-skill Nodes (e.g., Inference, Vocabulary, Number Patterns)
│   │   │   ├── mastery_level: 0.0 – 1.0
│   │   │   ├── confidence: 0.0 – 1.0
│   │   │   ├── trend: improving | stable | declining
│   │   │   └── sample_size: number of questions attempted
│   │   └── Edges (prerequisite relationships between sub-skills)
│   └── Cross-category connections (e.g., reading comprehension ↔ math word problems)
│
├── Error Pattern Profile (how they fail)
│   ├── concept_gap: doesn't understand the underlying concept
│   ├── careless_error: knows the concept but makes execution mistakes
│   ├── time_pressure: correct reasoning but ran out of time
│   ├── misread_question: comprehension failure on question stem
│   └── elimination_failure: can't narrow down to correct option
│
├── Time Behavior Model (how they work)
│   ├── avg_time_per_question by difficulty
│   ├── time_allocation_pattern: front-loaded | even | back-loaded
│   ├── rush_threshold: point at which speed increases and accuracy drops
│   └── stamina_curve: accuracy change over test duration
│
└── Confidence Estimator (how sure they are)
    ├── answer_change_rate: frequency of changing answers
    ├── time_on_correct vs time_on_incorrect
    └── certainty_pattern: overconfident | well-calibrated | underconfident
```

### How Learning DNA Evolves

The profile is **event-sourced** — every test, every chat interaction, every behavior signal is an immutable event that updates the model. The profile never overwrites; it accumulates and recalculates.

```
Event Stream:
  [test_completed] → updates skill graph mastery levels
  [question_answered] → updates error patterns, time behavior
  [chat_interaction] → updates confusion patterns, refines error classification
  [answer_changed] → updates confidence estimator
  [time_threshold_crossed] → updates stamina curve
```

This means:
- Parents can see how their child's profile has changed over time
- The system can detect trends ("improving in inference but declining in vocabulary")
- AI agents always have the latest, most complete picture

---

## 3. System Architecture

### Bounded Contexts

The system is organized into four bounded contexts, each with clear responsibilities and interfaces.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Landing  │  │ Test         │  │ Student   │  │ Parent       │  │
│  │ Page     │  │ Interface    │  │ Chat UI   │  │ Dashboard +  │  │
│  │          │  │              │  │           │  │ AI Chat      │  │
│  └──────────┘  └──────┬───────┘  └─────┬─────┘  └──────┬───────┘  │
└─────────────────────────┼──────────────┼───────────────┼───────────┘
                          │              │               │
┌─────────────────────────┼──────────────┼───────────────┼───────────┐
│                    API Gateway (Next.js API Routes)                 │
└─────────────────────────┼──────────────┼───────────────┼───────────┘
                          │              │               │
          ┌───────────────┤              │               │
          │               │              │               │
          ▼               ▼              ▼               ▼
  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐ ┌────────────┐
  │ Test Engine  │ │ Profile     │ │ Conversation │ │ Admin      │
  │              │ │ Engine      │ │ Engine       │ │ System     │
  │ • Question   │ │ • Skill     │ │ • Student    │ │ • Question │
  │   Bank       │ │   Graph     │ │   Explanation│ │   CRUD     │
  │ • Session    │ │ • Error     │ │   Agent      │ │ • Tagging  │
  │   Manager    │ │   Classifier│ │ • Parent     │ │ • QA       │
  │ • Timer      │ │ • Time      │ │   Insight    │ │ • Import   │
  │ • Scoring    │ │   Analyzer  │ │   Agent      │ │            │
  │ • Signal     │ │ • Confidence│ │ • Context    │ │            │
  │   Extraction │ │   Estimator │ │   Builder    │ │            │
  └──────┬───────┘ └──────┬──────┘ └──────┬───────┘ └─────┬──────┘
         │                │               │               │
         └────────────────┼───────────────┘               │
                          ▼                               │
                 ┌──────────────┐                         │
                 │  Data Layer  │◄────────────────────────┘
                 │              │
                 │ PostgreSQL   │
                 │ Redis Cache  │
                 │ Event Store  │
                 └──────────────┘
                          │
                          ▼
                 ┌──────────────┐
                 │  Claude API  │
                 │  (Anthropic) │
                 └──────────────┘
```

### Context 1: Test Engine

**Responsibility:** Deliver timed, structured tests and extract raw performance signals.

**Components:**

| Component | Role |
|---|---|
| Question Bank | Stores questions with metadata (subject, skill tags, difficulty, answer key, distractors with explanations) |
| Session Manager | Creates test sessions, tracks progress, handles resume/submit |
| Timer | Server-authoritative countdown with client sync; records per-question time |
| Auto-Scorer | Scores immediately on submit, calculates per-skill breakdowns |
| Signal Extractor | Produces structured events from raw test data (time anomalies, answer changes, skip patterns) |

**Key Design Decisions:**
- Timer is server-authoritative — client displays countdown but server validates elapsed time
- Per-question timing is captured via `question_viewed_at` and `answer_submitted_at` timestamps
- Answer changes are tracked (not just final answer) to feed the confidence estimator
- Questions support multiple formats: multiple choice (MVP), with future support for drag-and-drop and cloze

**Timer State Machine:**

Robust timer handling requires careful state management for edge cases:

```
States:
  ACTIVE:        Test running, timer counting down
  PAUSED:        Manual pause (max 2 pauses, 5 minutes total)
  DISCONNECTED:  Client lost connection (keep server time, warn on reconnect)
  EXPIRED:       Time's up (auto-submit, make responses read-only)
  ABANDONED:     Inactive for 24+ hours (mark incomplete, allow restart)

Transitions:
  ACTIVE → PAUSED:        User clicks pause (if pauses remaining)
  PAUSED → ACTIVE:        User resumes
  ACTIVE → DISCONNECTED:  Client heartbeat timeout (30s)
  DISCONNECTED → ACTIVE:  Client reconnects, syncs time
  ACTIVE → EXPIRED:       time_remaining = 0
  ANY → ABANDONED:        last_heartbeat > 24 hours ago

Storage: ElastiCache (Redis) with TTL
Client Heartbeat: Every 30 seconds
Resume Logic: time_remaining = duration - (now - started_at - total_pause_time)
```

**Edge Case Handling:**
- Browser refresh: Session persists in Redis, client fetches current state
- Network drop: Client shows "reconnecting", server keeps timer running
- Browser tab sleep (mobile): Heartbeat resumes on wake, time calculation server-side
- Time zone changes: All timestamps in UTC, server calculates elapsed time

### Context 2: Profile Engine

**Responsibility:** Synthesize all signals into the Learning DNA model.

**Components:**

| Component | Role |
|---|---|
| Skill Graph Manager | Maintains the hierarchical skill graph; updates mastery levels using Bayesian estimation |
| Error Pattern Classifier | Classifies each wrong answer into error types using heuristics + LLM analysis |
| Time Behavior Analyzer | Detects rushing, fatigue, time management patterns from per-question timing data |
| Confidence Estimator | Infers student certainty from answer changes, time patterns, and chat interactions |
| Profile Snapshotter | Creates periodic snapshots of the full Learning DNA for trend analysis |

**Error Classification Logic:**

Initial classification uses student-specific baselines (not global averages):

```python
def classify_error(
    question: Question,
    student: Student,
    response: Response,
    student_baseline: StudentBaseline
) -> Tuple[ErrorType, float]:
    """
    Returns (error_type, confidence_score)
    Requires minimum 20 questions for reliable student baseline
    """
    time_spent = response.time_spent_ms
    confidence = 1.0 if student_baseline.sample_size >= 50 else (student_baseline.sample_size / 50)

    # Use student-specific baseline (not global average)
    student_avg_time = student_baseline.avg_time_by_difficulty[question.difficulty]

    if time_spent < student_avg_time * 0.3:
        return ("time_pressure", confidence * 0.8)

    if response.selected_answer == question.common_misread_answer:
        return ("misread_question", confidence * 0.9)

    # Check if student usually knows this skill
    skill_mastery = student.skill_graph.get_mastery(question.skill_tags[0])
    if question.difficulty == "easy" and skill_mastery > 0.7:
        return ("careless_error", confidence * 0.7)

    # For first 20 questions, flag low confidence
    if student_baseline.sample_size < 20:
        return ("concept_gap", confidence * 0.5)

    return ("concept_gap", confidence)
```

**Classification Refinement:**

The Conversation Engine refines classifications based on chat interactions:

```python
# If student demonstrates understanding in chat, upgrade classification
if chat_analyzer.demonstrates_understanding(conversation):
    error.reclassify("concept_gap" → "careless_error")
    error.confidence = 0.9

# If student confused after explanation, downgrade confidence
if chat_analyzer.shows_persistent_confusion(conversation):
    error.confidence *= 0.5
```

**Schema Evolution Strategy:**

Event sourcing requires versioned schema handling:

```python
# All events include schema version
event = {
    "event_id": "uuid",
    "schema_version": 2,  # Current version
    "event_type": "test_completed",
    # ... payload
}

# Upcasting for profile rebuild
def upcast_event(event: dict) -> dict:
    """Transform old events to current schema when replaying"""
    if event["schema_version"] == 1:
        # V1 had single "mastery" field
        # V2 split into "short_term_mastery" and "long_term_mastery"
        event["payload"]["short_term_mastery"] = event["payload"]["mastery"]
        event["payload"]["long_term_mastery"] = event["payload"]["mastery"] * 0.9
        event["schema_version"] = 2
    return event

# Profile snapshots also versioned
profile_snapshot = {
    "profile_version": 3,
    "snapshot_at": "timestamp",
    # ... data
}
```

### Context 3: Conversation Engine

**Responsibility:** Power all AI-driven conversations, grounded in structured data.

**Components:**

| Component | Role |
|---|---|
| Student Explanation Agent | Explains wrong answers using Socratic method; constrained to question context |
| Parent Insight Agent | Answers parent questions about their child's learning; grounded in profile data |
| Context Builder | Assembles the relevant profile data, question data, and history for each conversation turn |
| Guardrail Layer | Enforces constraints: no off-topic, no hallucinated data, no medical/psychological advice |

**Data Flow:**

```
User Message
    │
    ▼
Context Builder ──► Retrieves relevant profile data, question data, chat history
    │
    ▼
Guardrail Layer ──► Validates request is in-scope
    │
    ▼
Agent (Student or Parent) ──► Generates response with Claude API
    │
    ▼
Guardrail Layer ──► Validates response doesn't hallucinate or go off-topic
    │
    ▼
Response + Signal Extraction ──► Returns response; feeds signals back to Profile Engine
```

### Context 4: Admin System

**Responsibility:** Manage the question bank and system configuration.

**Components:**

| Component | Role |
|---|---|
| Question CRUD | Create, update, delete questions with full metadata |
| Tagging System | Hierarchical skill tagging with validation |
| QA Review | Review queue for new questions, quality scoring |
| Bulk Import | Import questions from structured formats (CSV, JSON) |
| Analytics | Question difficulty statistics, discrimination index |

### Background Job System

**Responsibility:** Handle long-running, asynchronous tasks outside the request-response cycle.

**Components:**

| Component | Role |
|---|---|
| Job Queue (SQS) | FIFO queues for task ordering and reliability |
| Job Workers (Lambda) | Process jobs asynchronously with auto-scaling |
| Job Scheduler (EventBridge) | Trigger periodic tasks (profile snapshots, analytics aggregation) |
| Dead Letter Queue | Handle failed jobs, alert on persistent failures |

**Job Types:**

```yaml
Profile Snapshot Generation:
  Trigger: Every test completion + daily scheduled
  Duration: 2-5 seconds
  Priority: Medium
  Queue: profile-jobs.fifo

Email Notifications:
  Trigger: Test completion, parent signup
  Duration: 1-2 seconds
  Priority: High
  Queue: notification-jobs.fifo

Report PDF Generation:
  Trigger: Parent requests export
  Duration: 10-30 seconds
  Priority: Low
  Queue: export-jobs.fifo

Bulk Question Import:
  Trigger: Admin uploads CSV
  Duration: 30-300 seconds
  Priority: Low
  Queue: import-jobs.fifo

Analytics Aggregation:
  Trigger: Scheduled (hourly)
  Duration: 10-60 seconds
  Priority: Low
  Queue: analytics-jobs.fifo

LLM Error Reclassification:
  Trigger: Chat conversation ends
  Duration: 3-8 seconds
  Priority: Medium
  Queue: ai-jobs.fifo
```

**Implementation (AWS SQS + Lambda):**

```python
# Job producer (from API)
import boto3
sqs = boto3.client('sqs')

def enqueue_profile_snapshot(student_id: str, trigger: str):
    sqs.send_message(
        QueueUrl=os.environ['PROFILE_JOBS_QUEUE_URL'],
        MessageBody=json.dumps({
            "job_type": "profile_snapshot",
            "student_id": student_id,
            "trigger": trigger,
            "timestamp": datetime.now(UTC).isoformat()
        }),
        MessageGroupId=student_id,  # FIFO ordering per student
        MessageDeduplicationId=f"{student_id}-{int(time.time())}"
    )

# Job consumer (Lambda function)
def handle_profile_snapshot_job(event):
    for record in event['Records']:
        body = json.loads(record['body'])
        student_id = body['student_id']

        # Generate snapshot
        profile_engine.create_snapshot(student_id)

        # Delete message from queue (automatic with Lambda SQS trigger)
```

**Monitoring:**
- CloudWatch metrics: Queue depth, processing time, failure rate
- Alarms: Queue depth > 100, DLQ receives messages
- X-Ray tracing: Track job execution across services

---

## 4. Data Model

### Entity Relationship Overview

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐
│  User    │────▶│  Student     │────▶│  TestSession   │
│          │     │  Profile     │     │                │
│ id       │     │              │     │ id             │
│ email    │     │ learning_dna │     │ student_id     │
│ role     │     │ created_at   │     │ test_id        │
│ name     │     │ updated_at   │     │ started_at     │
└──────────┘     └──────────────┘     │ completed_at   │
     │                                │ total_score    │
     │ (parent)                       └───────┬────────┘
     │                                        │
     ▼                                        ▼
┌──────────────┐                    ┌──────────────────┐
│ ParentLink   │                    │ SessionResponse  │
│              │                    │                  │
│ parent_id    │                    │ session_id       │
│ student_id   │                    │ question_id      │
│ relationship │                    │ selected_answer  │
└──────────────┘                    │ is_correct       │
                                    │ time_spent_ms    │
                                    │ answer_changes[] │
┌──────────────┐                    │ error_type       │
│    Test      │                    └──────────────────┘
│              │
│ id           │     ┌──────────────────┐
│ title        │     │    Question      │
│ subject      │     │                  │
│ duration_sec │     │ id               │
│ question_ids │     │ stem             │
│ created_at   │     │ options[]        │
└──────────────┘     │ correct_answer   │
                     │ explanation      │
                     │ skill_tags[]     │
                     │ difficulty       │
                     │ distractor_notes │
                     └──────────────────┘
```

### Student Profile Schema (Learning DNA)

```json
{
  "student_id": "uuid",
  "version": 14,
  "snapshot_at": "2026-03-04T10:00:00Z",
  "skill_graph": {
    "nodes": [
      {
        "skill_id": "reading.inference",
        "category": "Reading",
        "label": "Inference & Deduction",
        "mastery": 0.72,
        "confidence": 0.65,
        "trend": "improving",
        "sample_size": 23,
        "last_updated": "2026-03-01T14:30:00Z"
      },
      {
        "skill_id": "math.number_patterns",
        "category": "Mathematical Reasoning",
        "label": "Number Patterns",
        "mastery": 0.45,
        "confidence": 0.80,
        "trend": "stable",
        "sample_size": 18,
        "last_updated": "2026-03-01T14:30:00Z"
      }
    ],
    "edges": [
      {
        "from": "reading.comprehension",
        "to": "math.word_problems",
        "relationship": "prerequisite",
        "strength": 0.6
      }
    ]
  },
  "error_profile": {
    "distribution": {
      "concept_gap": 0.40,
      "careless_error": 0.25,
      "time_pressure": 0.20,
      "misread_question": 0.10,
      "elimination_failure": 0.05
    },
    "recent_trend": "careless_errors_increasing",
    "notable_patterns": [
      {
        "pattern": "Misreads 'not' in question stems",
        "frequency": 4,
        "last_seen": "2026-03-01"
      }
    ]
  },
  "time_behavior": {
    "avg_time_per_question_ms": 48000,
    "time_by_difficulty": {
      "easy": 28000,
      "medium": 45000,
      "hard": 72000
    },
    "allocation_pattern": "front_loaded",
    "rush_threshold_question": 25,
    "stamina_curve": [1.0, 0.95, 0.90, 0.82, 0.70],
    "completion_rate": 0.88
  },
  "confidence_estimate": {
    "answer_change_rate": 0.15,
    "correct_after_change_rate": 0.40,
    "calibration": "slightly_overconfident",
    "time_ratio_correct_vs_incorrect": 1.2
  }
}
```

### Event Sourcing

All profile mutations are stored as immutable events:

```json
{
  "event_id": "uuid",
  "student_id": "uuid",
  "event_type": "test_completed",
  "timestamp": "2026-03-01T14:30:00Z",
  "payload": {
    "session_id": "uuid",
    "test_id": "uuid",
    "score": 24,
    "total": 35,
    "skill_deltas": [
      {"skill_id": "reading.inference", "delta": +0.03},
      {"skill_id": "math.number_patterns", "delta": -0.02}
    ],
    "error_events": [
      {"question_id": "uuid", "error_type": "concept_gap", "skill_id": "math.number_patterns"}
    ],
    "time_events": [
      {"question_id": "uuid", "time_ms": 3200, "flagged": "rushed"}
    ]
  }
}
```

**Event Types:**

| Event | Trigger | Profile Impact |
|---|---|---|
| `test_completed` | Student submits test | Updates skill mastery, error profile, time behavior |
| `question_answered` | Each question response | Granular skill + time data |
| `answer_changed` | Student changes answer during test | Updates confidence estimator |
| `chat_message_sent` | Student asks about a question | May reclassify error type; updates confusion patterns |
| `chat_understanding_confirmed` | Student demonstrates understanding in chat | Upgrades error from `concept_gap` to `careless_error` |

### Database Indexing Strategy

**Critical for Performance:**

```sql
-- User & Authentication
CREATE INDEX idx_user_email ON users(email);
CREATE UNIQUE INDEX idx_user_email_unique ON users(LOWER(email));

-- Student Profile lookups
CREATE INDEX idx_student_user_id ON students(user_id);
CREATE INDEX idx_student_created_at ON students(created_at);

-- Parent-Student relationships
CREATE INDEX idx_parent_link_parent ON parent_links(parent_id);
CREATE INDEX idx_parent_link_student ON parent_links(student_id);
CREATE UNIQUE INDEX idx_parent_student_unique ON parent_links(parent_id, student_id);

-- Test Sessions (frequent queries)
CREATE INDEX idx_session_student_id ON test_sessions(student_id);
CREATE INDEX idx_session_completed_at ON test_sessions(completed_at);
CREATE INDEX idx_session_student_completed ON test_sessions(student_id, completed_at DESC);
CREATE INDEX idx_session_status ON test_sessions(status) WHERE status != 'completed';

-- Session Responses (analytics)
CREATE INDEX idx_response_session_id ON session_responses(session_id);
CREATE INDEX idx_response_question_id ON session_responses(question_id);
CREATE INDEX idx_response_error_type ON session_responses(error_type) WHERE error_type IS NOT NULL;
CREATE INDEX idx_response_correct ON session_responses(is_correct);

-- Questions (filtering by skill tags - JSONB)
CREATE INDEX idx_question_skill_tags ON questions USING GIN(skill_tags);
CREATE INDEX idx_question_difficulty ON questions(difficulty);
CREATE INDEX idx_question_subject ON questions(subject);
CREATE INDEX idx_question_status ON questions(status) WHERE status = 'active';

-- Events (profile rebuild, time-series)
CREATE INDEX idx_events_student_timestamp ON events(student_id, timestamp DESC);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp) WHERE timestamp > NOW() - INTERVAL '90 days';

-- Chat Messages (Tier 1: Short-term memory)
CREATE INDEX idx_chat_session_id ON chat_messages(session_id, created_at);
CREATE INDEX idx_chat_role ON chat_messages(role);
CREATE INDEX idx_chat_token_count ON chat_messages(session_id, token_count); -- For budget tracking

-- Chat Sessions (with state machine)
CREATE INDEX idx_chat_sessions_student ON chat_sessions(student_id, created_at DESC);
CREATE INDEX idx_chat_sessions_active ON chat_sessions(status) WHERE status = 'active';
CREATE INDEX idx_chat_sessions_agent_state ON chat_sessions(agent_state);
ALTER TABLE chat_sessions ADD COLUMN agent_state TEXT DEFAULT 'idle';
ALTER TABLE chat_sessions ADD COLUMN agent_state_entered_at TIMESTAMPTZ;
ALTER TABLE chat_sessions ADD COLUMN agent_metadata JSONB DEFAULT '{}';

-- Conversation Memory (Tier 2: Medium-term memory)
CREATE INDEX idx_conv_memory_student ON conversation_memory(student_id, created_at DESC);
CREATE INDEX idx_conv_memory_topics ON conversation_memory USING GIN(key_topics);
CREATE INDEX idx_conv_memory_session ON conversation_memory(session_id);
CREATE INDEX idx_conv_memory_agent_type ON conversation_memory(agent_type, created_at DESC);

-- Profile Snapshots (trend analysis)
CREATE INDEX idx_snapshot_student_created ON profile_snapshots(student_id, created_at DESC);
```

**PostgreSQL-Specific Optimizations:**

```sql
-- Partial indexes for common queries
CREATE INDEX idx_active_sessions ON test_sessions(student_id, started_at)
  WHERE completed_at IS NULL;

-- Covering index for dashboard query
CREATE INDEX idx_session_dashboard ON test_sessions(student_id, completed_at, total_score, test_id)
  WHERE completed_at IS NOT NULL;

-- JSONB GIN index for Learning DNA queries
CREATE INDEX idx_student_profile_skills ON students USING GIN(learning_dna jsonb_path_ops);

-- Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Privacy & Consent Fields

**User Table Extensions:**

```sql
ALTER TABLE users ADD COLUMN consent_data_collection BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN consent_ai_processing BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN consent_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN consent_ip_address INET;
ALTER TABLE users ADD COLUMN data_deletion_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN data_deleted_at TIMESTAMP WITH TIME ZONE;

-- Audit logging
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);
```

---

## 5. AI Agent Design

### Principles

1. **Grounded generation** — Every AI response must be traceable to structured data. No hallucinated insights.
2. **Constrained scope** — Each agent has a defined boundary. The Student Agent talks about questions. The Parent Agent talks about the profile. Neither becomes a general chatbot.
3. **Tone calibration** — Student-facing: encouraging, Socratic, age-appropriate. Parent-facing: warm, professional, teacher-in-a-conference tone.
4. **Signal extraction** — Conversations are not just output; they are input. Every interaction feeds data back to the Profile Engine.

### Agent 1: Student Explanation Agent

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

### Agent 2: Parent Insight Agent

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

### Guardrails Implementation

**Pre-LLM Validation:**

```python
class GuardrailLayer:
    def __init__(self):
        self.inappropriate_keywords = load_keyword_list()
        self.medical_keywords = ["ADHD", "autism", "dyslexia", "anxiety", "depression"]

    def validate_request(self, message: str, context: dict) -> GuardrailResult:
        """Validate user input before sending to LLM"""

        # Check 1: On-topic detection (simple keyword matching for MVP)
        educational_keywords = ["test", "question", "skill", "learning", "improve", "score"]
        if not any(kw in message.lower() for kw in educational_keywords):
            if len(message.split()) > 5:  # Not just a greeting
                return GuardrailResult(
                    allow=False,
                    fallback="I can only discuss your child's learning progress and test performance. "
                             "How can I help you understand their results?"
                )

        # Check 2: Inappropriate content
        if any(kw in message.lower() for kw in self.inappropriate_keywords):
            return GuardrailResult(
                allow=False,
                fallback="I'm unable to respond to that. Please ask about your child's learning progress.",
                log_severity="high"
            )

        # Check 3: Medical/psychological keywords
        detected_medical = [kw for kw in self.medical_keywords if kw.lower() in message.lower()]
        if detected_medical:
            return GuardrailResult(
                allow=False,
                fallback=f"I notice you mentioned {', '.join(detected_medical)}. I'm not qualified "
                         f"to provide guidance on these topics. Please consult with a healthcare "
                         f"professional or educational psychologist. I can help with academic "
                         f"performance and learning patterns from test results."
            )

        return GuardrailResult(allow=True)

    def validate_response(self, response: str, context: dict) -> GuardrailResult:
        """Validate LLM output before returning to user"""

        # Extract data citations from response
        citations = self._extract_data_references(response)

        # Verify each citation exists in profile
        for citation in citations:
            if citation.type == "skill_mastery":
                if not self._verify_skill_in_profile(citation.skill_id, context['profile']):
                    # LLM hallucinated a skill or mastery score
                    return GuardrailResult(
                        allow=False,
                        fallback="I apologize, I need to reconsider that response. Let me check the data again.",
                        log_error=True,
                        retry_with_constraint=True
                    )
            elif citation.type == "test_score":
                if not self._verify_test_score(citation.session_id, citation.score, context):
                    return GuardrailResult(
                        allow=False,
                        fallback="I apologize, I made an error referencing test scores. Let me correct that.",
                        log_error=True,
                        retry_with_constraint=True
                    )

        # Check for prediction/promise language (not allowed)
        prediction_phrases = [
            "will definitely", "guaranteed to", "will get into", "will pass",
            "definitely improve", "certainly will", "for sure will"
        ]
        if any(phrase in response.lower() for phrase in prediction_phrases):
            return GuardrailResult(
                allow=False,
                fallback="Let me rephrase without making predictions...",
                retry_with_constraint=True
            )

        return GuardrailResult(allow=True)

    def _extract_data_references(self, response: str) -> List[Citation]:
        """Parse response for data citations"""
        citations = []
        # Pattern: "scored X/Y" or "mastery of Z%"
        import re
        score_pattern = r"scored (\d+)/(\d+)"
        mastery_pattern = r"mastery.*?(\d+)%"
        # Extract and structure citations
        # ... implementation
        return citations
```

**Escalation Handling:**

```python
# When AI is uncertain, offer human support
if confidence_score < 0.6 or sensitive_topic_detected:
    response += "\n\n---\n"
    response += "I want to make sure you get the best guidance. Would you like to schedule "
    response += "a call with our education team to discuss this in more detail?"
    offer_human_escalation(parent_id)
```

### Context Window Management

**Problem:** Full Learning DNA + conversation history can exceed token limits.

**Solution: Adaptive Context Loading**

```python
class ContextBuilder:
    MAX_CONTEXT_TOKENS = 8000  # Leave room for response
    PROFILE_SUMMARY_TOKENS = 500  # Compressed profile

    def build_context(self, message: str, profile: LearningDNA, history: List[Message]) -> str:
        """Build optimal context within token budget"""

        # Phase 1: Identify relevant profile sections
        relevant_skills = self._identify_relevant_skills(message, profile)

        # Phase 2: Decide strategy based on query type
        if self._is_simple_query(message):
            # Simple queries: Use profile summary + targeted data
            context = self._build_summary_context(profile, relevant_skills)
            estimated_tokens = self.PROFILE_SUMMARY_TOKENS
        else:
            # Complex queries: Full relevant sections
            context = self._build_detailed_context(profile, relevant_skills)
            estimated_tokens = self._estimate_tokens(context)

        # Phase 3: Add conversation history (with pruning if needed)
        available_tokens = self.MAX_CONTEXT_TOKENS - estimated_tokens
        history_context = self._prune_history(history, available_tokens)

        return {
            "profile": context,
            "history": history_context,
            "tokens_used": estimated_tokens + len(history_context.split()) * 1.3
        }

    def _build_summary_context(self, profile: LearningDNA, relevant_skills: List[str]) -> str:
        """Generate compressed profile summary"""
        summary = {
            "overview": {
                "tests_completed": profile.total_tests,
                "strong_areas": profile.get_top_skills(3),
                "weak_areas": profile.get_bottom_skills(3),
                "primary_error_type": profile.error_profile.primary_type
            },
            "relevant_skills": {
                skill_id: {
                    "mastery": profile.skill_graph[skill_id].mastery,
                    "trend": profile.skill_graph[skill_id].trend,
                    "sample_size": profile.skill_graph[skill_id].sample_size
                }
                for skill_id in relevant_skills
            }
        }
        return json.dumps(summary)

    def _prune_history(self, history: List[Message], token_budget: int) -> List[Message]:
        """Keep most recent messages within budget"""
        if len(history) <= 5:
            return history

        # Always keep first message (context setting) and last 3
        pruned = [history[0]] + history[-3:]

        # Add summary of middle conversation
        middle_summary = self._summarize_conversation(history[1:-3])
        pruned.insert(1, Message(role="system", content=f"[Earlier conversation: {middle_summary}]"))

        return pruned
```

**Response Caching:**

```python
# Cache common responses in ElastiCache (Redis)
class ResponseCache:
    def __init__(self):
        self.redis = boto3.client('elasticache')
        self.cache_ttl = 3600 * 24  # 24 hours

    def get_cached_response(self, query_type: str, profile_hash: str) -> Optional[str]:
        """Check if we have a cached response for similar query"""
        cache_key = f"response:{query_type}:{profile_hash}"
        return self.redis.get(cache_key)

    def cache_response(self, query_type: str, profile_hash: str, response: str):
        """Cache response for common queries"""
        # Only cache for stable profile patterns
        if self._is_cacheable_query(query_type):
            cache_key = f"response:{query_type}:{profile_hash}"
            self.redis.setex(cache_key, self.cache_ttl, response)

    def _is_cacheable_query(self, query_type: str) -> bool:
        """Determine if query type should be cached"""
        cacheable_types = [
            "what_is_thinking_skills",
            "how_scoring_works",
            "what_is_mastery_level",
            "explain_error_types"
        ]
        return query_type in cacheable_types
```

### Cold Start Experience

**Problem:** After 1 test, profile has minimal data. Parents expect insights.

**Solution: Tiered Response Strategy**

```python
def get_parent_response_strategy(student: Student) -> ResponseStrategy:
    """Determine response approach based on data availability"""

    tests_completed = student.profile.total_tests
    total_questions = student.profile.total_questions_answered

    if tests_completed == 0:
        return ResponseStrategy.ONBOARDING

    elif tests_completed == 1 and total_questions < 30:
        return ResponseStrategy.FIRST_TEST_GUIDANCE

    elif tests_completed < 3 or total_questions < 100:
        return ResponseStrategy.EARLY_INSIGHTS

    else:
        return ResponseStrategy.FULL_ANALYSIS


# System prompt adapts based on strategy
FIRST_TEST_GUIDANCE_PROMPT = """
The student has completed only 1 test. Your insights will be preliminary.

IMPORTANT:
- Preface insights with "Based on this first test..." or "Early indication suggests..."
- Explain what you'll be able to tell them after more tests
- Focus on clear strengths and weaknesses from this test
- Do NOT make trend statements ("improving", "declining") - not enough data
- Acknowledge limitations: "After 2-3 more tests, I'll have a clearer picture of..."

Example:
Parent: "Is she strong in math?"
You: "Based on this first test, she scored 7/10 on math questions, which is a good start.
      After 2-3 more tests, I'll be able to tell you if this is a consistent strength or
      if today's test happened to play to her current knowledge. I'll also be able to
      identify specific math sub-skills (patterns, word problems, etc.) where she excels
      or needs support."
"""
```

**Onboarding Questionnaire:**

```python
# Capture baseline information before first test
onboarding_questions = [
    {
        "id": "grade_level",
        "question": "What year is your child currently in?",
        "type": "select",
        "options": ["Year 3", "Year 4", "Year 5", "Year 6"]
    },
    {
        "id": "exam_target",
        "question": "Which exam are you preparing for?",
        "type": "select",
        "options": ["OC (Year 5 entry)", "Selective School (Year 7 entry)", "Both", "General practice"]
    },
    {
        "id": "known_strengths",
        "question": "What subjects does your child enjoy or excel at? (Optional)",
        "type": "multiselect",
        "options": ["Reading", "Math", "Writing", "Thinking/Logic puzzles"]
    },
    {
        "id": "known_challenges",
        "question": "Are there any areas where your child typically finds challenges? (Optional)",
        "type": "multiselect",
        "options": ["Time management", "Reading comprehension", "Math word problems",
                    "Test anxiety", "Concentration", "Other"]
    },
    {
        "id": "goals",
        "question": "What are your main goals? (Optional)",
        "type": "multiselect",
        "options": ["Identify weak areas", "Track improvement", "Build test confidence",
                    "Practice time management", "Understand learning style"]
    }
]

# Store in profile metadata
student.profile.metadata = {
    "onboarding_responses": onboarding_data,
    "onboarding_completed_at": "timestamp"
}

# Use in cold-start responses
if tests_completed == 0:
    response = f"Based on what you've shared, you're preparing for {exam_target}. "
    response += f"Your main goals are {', '.join(goals)}. "
    response += "Once your child completes their first test, I'll be able to provide specific insights..."
```

---

## 5.6 Multi-Turn Conversation Architecture

The v1 agent design treated each AI response as stateless — assemble context, call Claude, return. This section defines a comprehensive conversation memory system that enables natural, multi-turn dialogue across sessions.

### Design Principles

1. **Memory is tiered** — Not all conversation data has equal value or cost. Recent turns are kept verbatim; older turns are compressed to summaries; key insights are promoted to the student profile permanently.
2. **Context is budgeted** — Every token in the context window competes for space. System prompts, profile data, and conversation history each have explicit budgets.
3. **Sessions are persistent** — Closing a browser tab does not destroy a conversation. Parents can resume days later.
4. **Streaming is mandatory** — Every AI response is delivered token-by-token via SSE. No blank screens.

### Three-Tier Memory Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Tier Architecture                     │
│                                                                  │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │   SHORT-TERM    │   │   MEDIUM-TERM    │   │  LONG-TERM   │ │
│  │                 │   │                  │   │              │ │
│  │ Full messages   │   │ Conversation     │   │ Extracted    │ │
│  │ in current      │   │ summaries in     │   │ insights in  │ │
│  │ session         │   │ RDS              │   │ Learning DNA │ │
│  │                 │   │                  │   │              │ │
│  │ Storage:        │   │ Storage:         │   │ Storage:     │ │
│  │  RDS            │   │  conversation_   │   │  student_    │ │
│  │  chat_messages  │   │  memory table    │   │  profile     │ │
│  │  + ElastiCache  │   │                  │   │  (JSONB)     │ │
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

### Tier 1: Short-Term Memory (Current Session)

Every message in the active conversation is stored in RDS and cached in ElastiCache for fast retrieval.

**Schema Extensions:**

```sql
-- Messages table
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

-- Sessions table extensions
ALTER TABLE chat_sessions ADD COLUMN status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'summarized', 'archived'));
ALTER TABLE chat_sessions ADD COLUMN topic_summary TEXT;
ALTER TABLE chat_sessions ADD COLUMN total_tokens INTEGER DEFAULT 0;
ALTER TABLE chat_sessions ADD COLUMN turn_count INTEGER DEFAULT 0;
ALTER TABLE chat_sessions ADD COLUMN closed_at TIMESTAMPTZ;
ALTER TABLE chat_sessions ADD COLUMN current_topic TEXT;

-- ElastiCache key pattern: session:{session_id}:messages
-- Value: JSON array of recent messages (last 10 turns)
-- TTL: 3600 seconds (1 hour of inactivity)
```

**Message Storage with Cache-Aside Pattern:**

```typescript
// services/conversation/message-store.ts
import { encode } from 'gpt-tokenizer';

export async function appendMessage(
  db: PrismaClient,
  redis: Redis,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<StoredMessage> {
  const tokenCount = encode(content).length;

  // Write to RDS
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

  // Update ElastiCache (cache-aside)
  const cacheKey = `session:${sessionId}:messages`;
  const cached = await redis.get(cacheKey);
  const messages = cached ? JSON.parse(cached) : [];
  messages.push(message);

  // Keep only last 10 turns in cache (budget constraint)
  if (messages.length > 10) {
    messages.shift();
  }

  await redis.setex(cacheKey, 3600, JSON.stringify(messages));

  return message;
}

export async function getSessionMessages(
  db: PrismaClient,
  redis: Redis,
  sessionId: string
): Promise<StoredMessage[]> {
  // Try cache first
  const cacheKey = `session:${sessionId}:messages`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss: load from RDS
  const messages = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });

  // Populate cache
  await redis.setex(cacheKey, 3600, JSON.stringify(messages));

  return messages;
}
```

### Tier 2: Medium-Term Memory (Conversation Summaries)

When a session ends or exceeds token thresholds, it is summarized and stored in `conversation_memory`. These summaries enable cross-session recall.

**Schema:**

```sql
CREATE TABLE conversation_memory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id),
  session_id          UUID NOT NULL REFERENCES chat_sessions(id),
  agent_type          TEXT NOT NULL,
  summary             TEXT NOT NULL,              -- 2-4 sentence summary
  key_topics          TEXT[] NOT NULL DEFAULT '{}',
  insights_extracted  JSONB NOT NULL DEFAULT '[]',
  parent_questions    TEXT[] DEFAULT '{}',
  satisfaction_signal TEXT CHECK (satisfaction_signal IN ('positive', 'neutral', 'negative', NULL)),
  turn_count          INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_memory_student ON conversation_memory(student_id, created_at DESC);
CREATE INDEX idx_conv_memory_topics ON conversation_memory USING GIN(key_topics);
```

**Summarization Pipeline (AWS Lambda Background Job):**

```typescript
// lambda/conversation-summarizer/index.ts
import Anthropic from '@anthropic-ai/sdk';

const SUMMARIZATION_PROMPT = `Summarize this parent-advisor conversation about a child's learning.

Produce JSON with:
- summary: 2-4 sentences of key discussion points
- key_topics: array of topics [time_management, error_patterns, skill_gaps, etc.]
- insights: array of {type, content, actionable} for profile updates
- parent_questions: main questions asked (paraphrased)
- satisfaction: "positive" | "neutral" | "negative"

CONVERSATION:
{messages}

Respond with valid JSON only.`;

export const handler = async (event: SQSEvent) => {
  const anthropic = new Anthropic();

  for (const record of event.Records) {
    const { sessionId } = JSON.parse(record.body);

    const messages = await getSessionMessages(db, sessionId);
    const formatted = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250414', // Haiku for cost-efficient summarization
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: SUMMARIZATION_PROMPT.replace('{messages}', formatted),
      }],
    });

    const summary = JSON.parse(response.content[0].text);

    // Store in conversation_memory table
    await db.conversationMemory.create({
      data: {
        studentId: session.studentId,
        sessionId,
        agentType: session.agentType,
        summary: summary.summary,
        keyTopics: summary.key_topics,
        insightsExtracted: summary.insights,
        parentQuestions: summary.parent_questions,
        satisfactionSignal: summary.satisfaction,
        turnCount: session.turnCount,
      },
    });

    // Update session status
    await db.chatSession.update({
      where: { id: sessionId },
      data: { status: 'summarized', closedAt: new Date() },
    });
  }
};
```

**Summarization Triggers (EventBridge Rules):**

```yaml
# CloudFormation/CDK
SummarizationTriggers:
  - Name: SessionInactivityTimeout
    Schedule: rate(5 minutes)
    Lambda: conversation-summarizer
    Query: |
      SELECT id FROM chat_sessions
      WHERE status = 'active'
      AND updated_at < NOW() - INTERVAL '30 minutes'

  - Name: SessionExplicitClose
    EventSource: SQS
    Queue: session-close-queue
    Lambda: conversation-summarizer
```

### Tier 3: Long-Term Memory (Profile Integration)

The most durable insights from conversations are promoted into the student's Learning DNA.

**Profile Schema Extension:**

```json
{
  "learning_dna": {
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
          "pattern": "Confuses 'not' in question stems",
          "source_sessions": ["session_id_1", "session_id_2"],
          "first_observed": "2026-02-10",
          "frequency": 4,
          "evidence": "Confirmed via chat in 3 sessions"
        }
      ],
      "error_reclassifications": [
        {
          "question_id": "uuid",
          "original_type": "concept_gap",
          "reclassified_to": "careless_error",
          "evidence": "Student demonstrated understanding in chat review",
          "session_id": "uuid",
          "reclassified_at": "2026-03-01"
        }
      ]
    }
  }
}
```

**Promotion Pipeline (Async Lambda Job):**

```typescript
// lambda/insight-promoter/index.ts
export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { conversationMemoryId } = JSON.parse(record.body);

    const memory = await db.conversationMemory.findUnique({
      where: { id: conversationMemoryId },
    });

    const profile = await db.studentProfile.findUnique({
      where: { studentId: memory.studentId },
    });

    const learningDna = profile.learningDna as LearningDNA;

    // Promote insights to profile
    for (const insight of memory.insightsExtracted) {
      if (insight.type === 'error_reclassification') {
        learningDna.conversationInsights.errorReclassifications.push({
          questionId: insight.questionId,
          originalType: insight.originalType,
          reclassifiedTo: insight.reclassifiedTo,
          evidence: insight.evidence,
          sessionId: memory.sessionId,
          reclassifiedAt: new Date().toISOString(),
        });
      } else if (insight.type === 'parent_concern') {
        // Check if concern already exists
        const existing = learningDna.conversationInsights.parentConcerns.find(
          c => c.topic === insight.topic
        );
        if (existing) {
          existing.timesDis cussed++;
          existing.lastDiscussed = new Date().toISOString();
          existing.latestContext = insight.content;
        } else {
          learningDna.conversationInsights.parentConcerns.push({
            topic: insight.topic,
            firstRaised: new Date().toISOString(),
            lastDiscussed: new Date().toISOString(),
            timesDiscussed: 1,
            resolutionStatus: 'ongoing',
            latestContext: insight.content,
          });
        }
      }
    }

    // Save updated profile
    await db.studentProfile.update({
      where: { studentId: memory.studentId },
      data: { learningDna },
    });

    // Create profile update event
    await db.event.create({
      data: {
        studentId: memory.studentId,
        eventType: 'conversation_insights_promoted',
        timestamp: new Date(),
        payload: { conversationMemoryId, insightCount: memory.insightsExtracted.length },
      },
    });
  }
};
```

---

## 5.7 Token Budget Management & Context Window

Claude's context window is finite (200K tokens). EduLens must allocate tokens carefully across competing needs.

### Token Budget Allocation

```typescript
// config/token-budget.ts
export const TOKEN_BUDGET = {
  // Model limit — use well under max to control cost and latency
  maxRequestTokens: 30_000,  // Target for MVP

  // Fixed allocations
  systemPrompt: 1_500,
  responseReserve: 4_000,

  // Variable allocations (max)
  groundingData: 5_000,      // profile + test/question data
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

### Sliding Window with Summarization

When conversation history exceeds budget, older turns are summarized:

```typescript
// services/conversation/context-builder.ts
async function fitMessagesToBudget(
  client: Anthropic,
  messages: StoredMessage[],
  newUserMessage: string,
  budgetTokens: number
): Promise<Array<{ role: string; content: string }>> {
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

  // Add verbatim recent messages + new message
  for (const msg of verbatimMessages) {
    result.push({ role: msg.role, content: msg.content });
  }
  result.push({ role: 'user', content: newUserMessage });

  return result;
}
```

### Prompt Caching Strategy (AWS Bedrock + Anthropic)

System prompts and profile data are stable across turns. Both Anthropic and AWS Bedrock support prompt caching.

**Implementation:**

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
        cache_control: { type: 'ephemeral' }, // Cache across turns in session
      },
      {
        type: 'text',
        text: context.groundingData,
        cache_control: { type: 'ephemeral' }, // Profile data stable within session
      },
    ],
    messages: context.conversationMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });
}
```

**Cache Hit Economics (Per Turn):**

| Component | Tokens | Without Cache | With Cache (Hit) | Savings |
|---|---|---|---|---|
| System prompt | 1,500 | $0.0045 | $0.00045 | 90% |
| Profile data | 3,000 | $0.009 | $0.0009 | 90% |
| Conversation history | 10,000 | $0.03 | $0.03 | 0% |
| **Total input cost** | 14,500 | **$0.0435** | **$0.031** | **~29%** |

**Savings at scale:**
- 10-turn parent conversation: ~$0.12 saved per session
- 1,000 sessions/month: **$120/month savings**
- At 10,000 sessions/month: **$1,200/month savings**

**AWS Bedrock Note:** Bedrock supports the same prompt caching mechanism via the `cache_control` parameter. Works identically whether using Anthropic direct or Bedrock.

---

## 5.8 Agent State Machine

Every agent instance follows a four-state lifecycle. This governs UI indicators, timeout handling, error recovery, and billing metering.

### State Machine Diagram

```
                    ┌──────────────────────────────────────────┐
                    │           Agent State Machine              │
                    │                                           │
  session created   │   ┌─────────┐   user sends    ┌────────────────┐
  ─────────────────►│   │  IDLE   │──── message ────▶│  PROCESSING    │
                    │   │         │                  │                │
                    │   │ • UI:   │                  │ • UI: spinner  │
                    │   │   input │                  │ • Build context│
                    │   │   ready │                  │ • Select model │
                    │   │ • No    │                  │ • Call Claude  │
                    │   │   API   │                  │ • Guardrails   │
                    │   │   calls │                  └───────┬────────┘
                    │   └────▲────┘                          │
                    │        │                     first token arrives
                    │        │                               │
                    │        │                               ▼
                    │   ┌────┴──────────────┐      ┌─────────────────┐
                    │   │ WAITING_FEEDBACK  │      │  RESPONDING     │
                    │   │                  │      │                 │
                    │   │ • UI: suggested  │◀─────│ • UI: streaming │
                    │   │   questions +    │ done │   text          │
                    │   │   input ready    │ event│ • SSE deltas    │
                    │   │ • Idle timeout:  │      │ • Tokens billed │
                    │   │   30 min         │      │                 │
                    │   │ • Signal         │      └─────────────────┘
                    │   │   extraction     │
                    │   │   runs async     │
                    │   └──────────────────┘
                    │        │
                    │   user sends message ──► back to PROCESSING
                    │   timeout (30 min)   ──► session summarized & closed
                    └──────────────────────────────────────────┘
```

### State Definitions

| State | Entry Condition | Active Work | Exit Condition | Timeout |
|---|---|---|---|---|
| `idle` | Session created or previous response complete | None — waiting for user input | User sends message → `processing` | 30 min → session close |
| `processing` | User message received | Context assembly, model selection, guardrails, Claude API call | First SSE token arrives → `responding` | 30 sec → error + retry |
| `responding` | First token from Claude arrives | SSE streaming to client, token accumulation | `done` SSE event → `waiting_feedback` | 120 sec → partial response, error |
| `waiting_feedback` | Full response delivered | Signal extraction (async), suggested questions displayed | User sends message → `processing`; timeout → close | 30 min → session close |

### Implementation

**State Persistence (ElastiCache + RDS):**

```typescript
// services/agents/state-store.ts
export interface AgentStateContext {
  sessionId: string;
  state: 'idle' | 'processing' | 'responding' | 'waiting_feedback';
  enteredAt: Date;
  metadata: {
    currentModel?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    processingStartedAt?: Date;
    firstTokenAt?: Date;
    errorCount: number;
  };
}

export async function persistState(
  redis: Redis,
  db: PrismaClient,
  ctx: AgentStateContext
): Promise<void> {
  // ElastiCache: fast reads for UI polling (TTL = 35 min)
  await redis.set(
    `agent:state:${ctx.sessionId}`,
    JSON.stringify(ctx),
    'EX',
    2100
  );

  // RDS: durable record for recovery and analytics
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

export async function getState(
  redis: Redis,
  db: PrismaClient,
  sessionId: string
): Promise<AgentStateContext | null> {
  // Try ElastiCache first
  const cached = await redis.get(`agent:state:${sessionId}`);
  if (cached) {
    return JSON.parse(cached);
  }

  // Cache miss: load from RDS
  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      agentState: true,
      agentStateEnteredAt: true,
      agentMetadata: true,
    },
  });

  if (!session) return null;

  const ctx: AgentStateContext = {
    sessionId: session.id,
    state: session.agentState,
    enteredAt: session.agentStateEnteredAt,
    metadata: session.agentMetadata as any,
  };

  // Populate cache
  await redis.set(
    `agent:state:${sessionId}`,
    JSON.stringify(ctx),
    'EX',
    2100
  );

  return ctx;
}
```

**State Transitions:**

```typescript
// services/agents/state-machine.ts
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
            errorCount: 0,
          },
        };
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
        // Max retries: return to idle
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
            cacheCreationTokens: event.usage.cacheCreationTokens,
          },
        };
      }
      break;

    case 'waiting_feedback':
      if (event.type === 'user_message') {
        return {
          ...current,
          state: 'processing',
          enteredAt: now,
          metadata: { ...current.metadata, processingStartedAt: now, errorCount: 0 },
        };
      }
      break;
  }

  return current; // No valid transition
}

type AgentEvent =
  | { type: 'user_message'; content: string }
  | { type: 'first_token'; model: string }
  | { type: 'stream_complete'; usage: TokenUsage }
  | { type: 'error'; message: string }
  | { type: 'timeout' };
```

**Client-Side State Polling:**

```typescript
// hooks/useAgentState.ts
export function useAgentState(sessionId: string) {
  const { data } = useSWR<AgentStateContext>(
    sessionId ? `/api/chat/sessions/${sessionId}/state` : null,
    fetcher,
    { refreshInterval: 1000 } // Poll every second while active
  );

  return {
    state: data?.state ?? 'idle',
    isThinking: data?.state === 'processing',
    isStreaming: data?.state === 'responding',
    isReady: data?.state === 'idle' || data?.state === 'waiting_feedback',
    model: data?.metadata?.currentModel,
    timeToFirstToken: data?.metadata?.firstTokenAt
      ? data.metadata.firstTokenAt.getTime() - data.metadata.processingStartedAt!.getTime()
      : null,
  };
}
```

---

## 5.9 Cross-Session Memory & Topic Detection

Parents naturally jump between topics. The system must detect topic switches and refresh grounding data accordingly.

### Session Persistence & Recovery

**API for Session Recovery:**

```typescript
// API: GET /api/chat/parent/sessions?studentId=xxx
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

  // No active session — return recent session summaries for context
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

### Cross-Session Recall

When a parent starts a new session, relevant summaries from past conversations are injected as context preamble.

```typescript
// services/conversation/cross-session-recall.ts
export async function getCrossSessionRecall(
  db: PrismaClient,
  studentId: string,
  currentMessage: string
): Promise<string> {
  // Always include most recent conversation summary
  const lastSession = await db.conversationMemory.findFirst({
    where: { studentId, agentType: 'parent_insight' },
    orderBy: { createdAt: 'desc' },
  });

  // Find topically relevant past conversations
  const topics = extractTopics(currentMessage);
  const relevantSessions = await db.conversationMemory.findMany({
    where: {
      studentId,
      agentType: 'parent_insight',
      keyTopics: { hasSome: topics },
      id: { not: lastSession?.id },
    },
    orderBy: { createdAt: 'desc' },
    take: 2,
  });

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
  // Lightweight keyword extraction
  const topicKeywords: Record<string, string[]> = {
    time_management: ['rushing', 'time', 'slow', 'fast', 'timer'],
    error_patterns: ['mistakes', 'errors', 'wrong', 'careless'],
    skill_gaps: ['weak', 'struggling', 'difficult', 'improve'],
    reading: ['reading', 'comprehension', 'inference', 'vocabulary'],
    math: ['math', 'number', 'calculation', 'arithmetic', 'patterns'],
    thinking_skills: ['thinking', 'analogies', 'logic', 'reasoning'],
    progress_trends: ['improving', 'better', 'worse', 'progress', 'trend'],
  };

  const lower = message.toLowerCase();
  return Object.entries(topicKeywords)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([topic]) => topic);
}
```

### Topic-Aware Context Switching

When topic changes, refresh grounding data while preserving conversation history.

```typescript
// services/conversation/topic-tracker.ts
export function detectTopic(
  message: string,
  currentTopic: string | null
): { topic: string; isSwitch: boolean; groundingKeys: string[] } {
  const topicRules = [
    {
      topic: 'reading',
      patterns: [/reading/i, /comprehension/i, /inference/i, /vocabulary/i],
      groundingKeys: ['skill_graph.reading', 'error_profile', 'recent_tests'],
    },
    {
      topic: 'math',
      patterns: [/math/i, /number/i, /arithmetic/i, /fraction/i, /pattern/i],
      groundingKeys: ['skill_graph.math', 'error_profile', 'recent_tests'],
    },
    {
      topic: 'thinking_skills',
      patterns: [/thinking/i, /analog/i, /logic/i, /spatial/i, /reasoning/i],
      groundingKeys: ['skill_graph.thinking', 'error_profile', 'recent_tests'],
    },
    {
      topic: 'time_management',
      patterns: [/rush/i, /time/i, /slow/i, /fast/i, /stamina/i],
      groundingKeys: ['time_behavior', 'stamina_curve', 'recent_tests'],
    },
  ];

  for (const rule of topicRules) {
    if (rule.patterns.some(p => p.test(message))) {
      return {
        topic: rule.topic,
        isSwitch: currentTopic !== null && currentTopic !== rule.topic,
        groundingKeys: rule.groundingKeys,
      };
    }
  }

  // No clear topic — continue with current or default to general
  return {
    topic: currentTopic ?? 'general',
    isSwitch: false,
    groundingKeys: ['skill_graph', 'error_profile', 'recent_tests'],
  };
}

// In context builder: refresh grounding on topic switch
const topicResult = detectTopic(newUserMessage, session.currentTopic);
if (topicResult.isSwitch) {
  await db.chatSession.update({
    where: { id: session.id },
    data: { currentTopic: topicResult.topic },
  });
  // Rebuild grounding data with new topic's relevant sections
  groundingData = await assembleGroundingData(db, session, topicResult);
}
```

---

## 5.10 Server-Sent Events (SSE) for Streaming Responses

All AI responses are delivered via SSE for immediate visual feedback. This provides token-by-token streaming, typing indicators, and graceful disconnect handling.

### Why SSE Over WebSocket for Chat

| Consideration | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client (sufficient) | Bidirectional (overkill) |
| Infrastructure | Standard HTTP, CloudFront/ALB compatible | Requires API Gateway WebSocket + DynamoDB |
| Reconnection | Built-in auto-reconnect | Manual logic required |
| Complexity | Minimal (native EventSource API) | Connection management, heartbeats |
| Use case fit | Request-response streaming | Real-time bidirectional |

**Decision:**
- **SSE for AI chat streaming** (new)
- **WebSocket for test timer** (existing, keep as-is)

### AWS Architecture for SSE

```
Client (EventSource)
    │
    ▼
CloudFront (HTTP/1.1, no buffering)
    │
    ▼
ALB (Target Group: Lambda)
    │
    ▼
Lambda (Streaming Response)
    │
    ▼
Claude API (Streaming)
```

**ALB Configuration for SSE:**
```yaml
# CloudFormation
TargetGroup:
  TargetType: lambda
  HealthCheckEnabled: false  # Lambda handles its own health

LoadBalancer:
  Type: application
  Scheme: internet-facing

Listener:
  Protocol: HTTPS
  Port: 443
  DefaultActions:
    - Type: forward
      TargetGroupArn: !Ref TargetGroup

# CRITICAL: Disable response buffering for SSE
TargetGroupAttributes:
  - Key: deregistration_delay.timeout_seconds
    Value: 30
  - Key: lambda.multi_value_headers.enabled
    Value: true
```

### Lambda Streaming Response Implementation

**API Route:**

```typescript
// lambda/api/chat-stream/index.ts
import Anthropic from '@anthropic-ai/sdk';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Readable } from 'stream';

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEvent, responseStream: NodeJS.WritableStream) => {
    const { sessionId, content } = JSON.parse(event.body!);

    // Validate session, build context
    const session = await validateSession(sessionId);
    const context = await buildContextWindow(db, anthropic, session, content);

    // Store user message
    await appendMessage(db, redis, sessionId, 'user', content);

    // Transition state: idle → processing
    const state = await getState(redis, db, sessionId);
    const newState = transition(state!, { type: 'user_message', content });
    await persistState(redis, db, newState);

    // SSE headers
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    try {
      // Send typing indicator
      responseStream.write(`event: typing\ndata: {"status":"started"}\n\n`);

      const assistantChunks: string[] = [];
      let firstToken = true;

      // Stream from Claude
      const messageStream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
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
        messages: context.conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      for await (const event of messageStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          assistantChunks.push(text);

          // First token: transition to responding
          if (firstToken) {
            const respondingState = transition(newState, {
              type: 'first_token',
              model: 'claude-sonnet-4-20250514',
            });
            await persistState(redis, db, respondingState);
            firstToken = false;
          }

          // Send SSE delta
          responseStream.write(
            `event: delta\ndata: ${JSON.stringify({ text })}\n\n`
          );
        }
      }

      // Stream complete
      const finalMessage = await messageStream.finalMessage();
      const fullResponse = assistantChunks.join('');

      // Store assistant message
      await appendMessage(db, redis, sessionId, 'assistant', fullResponse);

      // Transition to waiting_feedback
      const waitingState = transition(newState, {
        type: 'stream_complete',
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          cacheReadTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: finalMessage.usage.cache_creation_input_tokens ?? 0,
        },
      });
      await persistState(redis, db, waitingState);

      // Send usage data
      responseStream.write(
        `event: usage\ndata: ${JSON.stringify(finalMessage.usage)}\n\n`
      );

      // Send done event
      responseStream.write(`event: done\ndata: {"status":"complete"}\n\n`);

      // Trigger async signal extraction
      await sqs.sendMessage({
        QueueUrl: process.env.SIGNAL_EXTRACTION_QUEUE_URL!,
        MessageBody: JSON.stringify({
          sessionId,
          userMessage: content,
          assistantMessage: fullResponse,
        }),
      });
    } catch (error) {
      console.error('Streaming error:', error);
      responseStream.write(
        `event: error\ndata: ${JSON.stringify({ message: 'AI request failed' })}\n\n`
      );

      const errorState = transition(newState, {
        type: 'error',
        message: error.message,
      });
      await persistState(redis, db, errorState);
    } finally {
      responseStream.end();
    }
  }
);
```

### Client-Side SSE Consumer

```typescript
// hooks/useChatStream.ts
export function useChatStream(sessionId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentChunk, setCurrentChunk] = useState('');

  const sendMessage = useCallback(async (content: string) => {
    // Add user message optimistically
    setMessages(prev => [...prev, { role: 'user', content }]);
    setStreaming(true);
    setCurrentChunk('');

    const eventSource = new EventSource(
      `/api/chat/sessions/${sessionId}/stream?content=${encodeURIComponent(content)}`
    );

    eventSource.addEventListener('typing', () => {
      // Show typing indicator
    });

    eventSource.addEventListener('delta', (e) => {
      const { text } = JSON.parse(e.data);
      setCurrentChunk(prev => prev + text);
    });

    eventSource.addEventListener('done', () => {
      setMessages(prev => [...prev, { role: 'assistant', content: currentChunk }]);
      setCurrentChunk('');
      setStreaming(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      console.error('SSE error:', e);
      setStreaming(false);
      eventSource.close();
    });
  }, [sessionId, currentChunk]);

  return { messages, streaming, currentChunk, sendMessage };
}
```

---

### Student Engagement Mechanics

**Goal:** Increase the 40% chat engagement target.

**Strategy 1: Intrinsic Motivation**

```python
# After test completion, show personalized prompts
def generate_review_prompts(student: Student, wrong_answers: List[Response]) -> List[Prompt]:
    prompts = []

    for response in wrong_answers[:3]:  # Top 3 priorities
        question = get_question(response.question_id)

        if response.error_type == "careless_error":
            prompt = f"Question {response.question_number}: You were close! "
            prompt += "Want to see what small thing you missed? (1 min)"

        elif response.error_type == "concept_gap":
            prompt = f"Question {response.question_number}: Let's figure this out together. "
            prompt += "I can explain the concept step by step. (2-3 min)"

        elif response.error_type == "time_pressure":
            prompt = f"Question {response.question_number}: You seemed rushed here. "
            prompt += "Let's solve it without time pressure. I think you'll get it! (2 min)"

        prompts.append(Prompt(
            question_id=response.question_id,
            message=prompt,
            priority=get_priority(response.error_type, question.skill_tags),
            estimated_time="1-3 min"
        ))

    return prompts
```

**Strategy 2: Progress Visualization**

```python
# Show mastery improvement
def show_skill_improvement(student: Student, session: TestSession):
    """Display skills that improved after chat review"""

    reviewed_questions = get_reviewed_questions(student, session)

    for question_id in reviewed_questions:
        skill = question.primary_skill
        old_mastery = student.profile.get_skill_mastery_before(skill, session)
        new_mastery = student.profile.get_skill_mastery(skill)

        if new_mastery > old_mastery + 0.05:  # Meaningful improvement
            show_badge(f"🎯 {skill} improved: {old_mastery:.0%} → {new_mastery:.0%}")
```

**Strategy 3: Parent Integration**

```python
# Parents can assign specific questions for review
def parent_assign_review(parent_id: str, student_id: str, question_ids: List[str]):
    """Parent marks questions they want student to review"""

    notification = {
        "type": "parent_assigned_review",
        "student_id": student_id,
        "question_ids": question_ids,
        "message": "Your parent would like you to review these questions. "
                   "Show them you understand by working through them!"
    }
    send_student_notification(notification)

    # Track completion
    create_task({
        "type": "review_questions",
        "assigned_by": parent_id,
        "questions": question_ids,
        "status": "pending"
    })
```

**Strategy 4: Micro-Rewards**

```python
# Understanding Points system (no monetary value, just progress tracking)
def award_understanding_points(student: Student, question_id: str):
    """Award points for completing review"""

    points = {
        "reviewed": 10,
        "demonstrated_understanding": 25,
        "helped_improve_mastery": 50
    }

    student.profile.understanding_points += points["reviewed"]

    # Achievement milestones
    milestones = {
        100: "Curious Learner",
        250: "Understanding Seeker",
        500: "Mastery Builder",
        1000: "Learning Champion"
    }

    for threshold, badge in milestones.items():
        if student.profile.understanding_points >= threshold and not has_badge(student, badge):
            award_badge(student, badge)
            show_celebration(badge)
```

---

## 5.11 Model Routing & Cost Optimization

Not every AI task requires the same model. EduLens routes each task to the cheapest model that meets its quality requirements, reducing cost by 40-60% compared to routing everything through Sonnet.

### Routing Matrix

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
│  │  Classify    │───► Classification / Extraction             │
│  │  task type   │     ────────────────────────────            │
│  │              │     Model: Claude Haiku                     │
│  │              │     Cost: ~$0.25/M input, $1.25/M output    │
│  │              │     Latency: ~200-400ms TTFT                │
│  │              │                                             │
│  │              │───► Conversational / Generation             │
│  │              │     ────────────────────────────            │
│  │              │     Model: Claude Sonnet                    │
│  │              │     Cost: ~$3/M input, $15/M output         │
│  │              │     Latency: ~400-800ms TTFT                │
│  │              │                                             │
│  │              │───► Summarization / Background              │
│  │              │     ────────────────────────────            │
│  │              │     Model: Claude Haiku                     │
│  │              │     Cost: ~$0.25/M input, $1.25/M output    │
│  │              │     Latency: N/A (async)                    │
│  └──────────────┘                                             │
└──────────────────────────────────────────────────────────────┘
```

### Task-to-Model Mapping

| Task | Model | Rationale | Avg Tokens | Cost per Call |
|---|---|---|---|---|
| **Student chat** | Sonnet | Requires nuanced pedagogy, Socratic questioning — quality critical | 2,500 in + 800 out | $0.0195 |
| **Parent chat** | Sonnet | Core product value — must feel like expert teacher | 5,000 in + 1,500 out | $0.0375 |
| **Intent classification** | Haiku | Binary decision: is message in-scope? | 500 in + 50 out | $0.00019 |
| **Error classification** | Haiku | Structured categorization with clear types | 800 in + 100 out | $0.00033 |
| **Signal extraction** | Haiku | Extract JSON from conversation text | 1,000 in + 200 out | $0.00050 |
| **Summarization** | Haiku | Compress conversation to 2-4 sentences | 2,000 in + 300 out | $0.00088 |
| **Suggested questions** | Haiku | Generate 2 follow-up questions | 600 in + 150 out | $0.00034 |

**Cost Comparison (1,000 parent chat sessions with 5 turns each):**

| Approach | Cost |
|---|---|
| **All Sonnet** | 5,000 sessions × $0.0375 = $187.50 |
| **Routed (Sonnet chat + Haiku support tasks)** | Chat: $187.50 + Extraction/Summary: $7.10 = **$194.60** |
| **Effective savings** | Minimal on chat itself, but 12x cheaper for background tasks |

**Key insight:** The biggest cost is the conversational responses (product core value). Savings come from **background tasks** (summarization, extraction) which add up at scale.

At 10,000 sessions/month with 5 turns each:
- Summarization alone: 10,000 × $0.00088 = $8.80 (Haiku) vs $105.60 (Sonnet) = **$96.80/month saved**
- Signal extraction: 50,000 extractions × $0.00050 = $25 (Haiku) vs $300 (Sonnet) = **$275/month saved**

### Implementation

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
    maxTokens: 1_000,
    temperature: 0.7,
    description: 'Student explanation — Socratic method, age-appropriate',
  },
  parent_chat: {
    modelId: 'claude-sonnet-4-20250514',
    maxTokens: 2_000,
    temperature: 0.5,
    description: 'Parent insight — grounded, professional, data-driven',
  },

  // Haiku: structured extraction and classification
  intent_classification: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 100,
    temperature: 0.0,
    description: 'Guardrail — is message in-scope?',
  },
  error_classification: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 200,
    temperature: 0.0,
    description: 'Classify wrong answer into error type',
  },
  signal_extraction: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 300,
    temperature: 0.0,
    description: 'Extract learning signals from conversation',
  },
  summarization: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 500,
    temperature: 0.0,
    description: 'Summarize session for cross-session memory',
  },
  suggested_questions: {
    modelId: 'claude-haiku-4-20250414',
    maxTokens: 200,
    temperature: 0.8,
    description: 'Generate follow-up questions',
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
    stream: options?.stream ?? false,
  });
}
```

### Anthropic Direct vs AWS Bedrock

Both deployment paths support all features. Choose based on your team's AWS usage and billing preferences.

```typescript
// lib/ai/client-factory.ts
import Anthropic from '@anthropic-ai/sdk';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

export type AIProvider = 'anthropic' | 'bedrock';

const PROVIDER: AIProvider = (process.env.AI_PROVIDER as AIProvider) ?? 'anthropic';

// Bedrock model IDs
const BEDROCK_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-20250514': 'us.anthropic.claude-sonnet-4-v1:0',
  'claude-haiku-4-20250414': 'us.anthropic.claude-haiku-4-v1:0',
};

export function getAnthropicClient(): Anthropic {
  if (PROVIDER === 'bedrock') {
    return new Anthropic({
      baseURL: `https://bedrock-runtime.${process.env.AWS_REGION}.amazonaws.com`,
      // AWS credentials from environment or IAM role
    });
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export function getModelId(modelName: string): string {
  if (PROVIDER === 'bedrock') {
    return BEDROCK_MODEL_MAP[modelName] ?? modelName;
  }
  return modelName;
}
```

**Configuration:**

```bash
# .env — Option A: Anthropic Direct
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# .env — Option B: AWS Bedrock
AI_PROVIDER=bedrock
AWS_REGION=ap-southeast-2
# AWS credentials via IAM role (Lambda) or AWS_ACCESS_KEY_ID/SECRET
```

**Bedrock Benefits:**
- Single AWS bill (no separate Anthropic invoice)
- IAM-based auth (no API key rotation)
- VPC private endpoints (no internet egress)
- Compliance-friendly for enterprise customers

**Anthropic Direct Benefits:**
- Slightly lower latency (no AWS proxy layer)
- Faster access to new models
- Simpler for teams not deeply invested in AWS

**Recommendation:** Start with Anthropic Direct for MVP simplicity, migrate to Bedrock if/when compliance or single-bill billing becomes important.

---

### Future: Adaptive Tutor Agent (Phase 2+)

**Purpose:** Proactively guide students through targeted practice based on their Learning DNA.

This agent would:
- Select practice questions targeting the student's weakest sub-skills
- Adjust difficulty dynamically based on performance
- Provide scaffolded hints that adapt to the student's error patterns
- Generate mini-assessments to confirm skill improvement

**Not in MVP scope.** Documented here as the natural evolution path to inform architecture decisions.

---

## 6. API Design

### Authentication

JWT-based authentication with role-based access control:
- `student` — access own tests, chat, results
- `parent` — access linked student's profile, parent chat
- `admin` — full access to question bank, all students

### Key Endpoints

#### Test Engine

```
POST   /api/tests/sessions              Create a new test session
GET    /api/tests/sessions/:id           Get session state (questions, timer)
PATCH  /api/tests/sessions/:id/answers   Submit/update answer for a question
POST   /api/tests/sessions/:id/submit    Submit completed test
GET    /api/tests/sessions/:id/results   Get scored results with skill breakdown
```

**Create Session Request:**
```json
POST /api/tests/sessions
{
  "test_id": "uuid",
  "student_id": "uuid"
}
```

**Submit Answer Request:**
```json
PATCH /api/tests/sessions/:id/answers
{
  "question_id": "uuid",
  "selected_option": "B",
  "timestamp": "2026-03-04T10:05:30Z"
}
```

**Results Response:**
```json
{
  "session_id": "uuid",
  "total_score": 24,
  "total_questions": 35,
  "duration_seconds": 1680,
  "skill_breakdown": [
    {
      "category": "Reading",
      "correct": 8,
      "total": 10,
      "sub_skills": [
        {"skill": "Inference", "correct": 3, "total": 4, "mastery_delta": +0.02}
      ]
    }
  ],
  "wrong_answers": [
    {
      "question_id": "uuid",
      "question_number": 7,
      "selected": "B",
      "correct": "D",
      "error_type": "concept_gap",
      "skill": "Number Patterns",
      "can_chat": true
    }
  ]
}
```

#### Conversation Engine

```
POST   /api/chat/student/sessions            Start student chat (question review)
POST   /api/chat/student/sessions/:id/messages  Send student message
GET    /api/chat/student/sessions/:id/messages  Get conversation history

POST   /api/chat/parent/sessions              Start parent chat session
POST   /api/chat/parent/sessions/:id/messages   Send parent message
GET    /api/chat/parent/sessions/:id/messages   Get conversation history
```

**Student Chat — Start Session:**
```json
POST /api/chat/student/sessions
{
  "test_session_id": "uuid",
  "question_id": "uuid"
}
```

**Parent Chat — Send Message:**
```json
POST /api/chat/parent/sessions/:id/messages
{
  "content": "Why is thinking skills low?",
  "student_id": "uuid"
}
```

**Chat Response:**
```json
{
  "message_id": "uuid",
  "role": "assistant",
  "content": "Looking at the last 3 tests, Mia scored an average of 4/10 on Thinking Skills questions...",
  "suggested_questions": [
    "What specific types of thinking skills questions is she struggling with?",
    "How does her performance compare to earlier tests?"
  ],
  "grounding_refs": [
    {"type": "skill_node", "skill_id": "thinking.analogies", "mastery": 0.35},
    {"type": "test_result", "session_id": "uuid", "score": "4/10"}
  ]
}
```

#### Profile Engine

```
GET    /api/students/:id/profile              Get current Learning DNA
GET    /api/students/:id/profile/history       Get profile snapshots over time
GET    /api/students/:id/profile/trends        Get trend analysis
```

#### Admin

```
GET    /api/admin/questions                   List questions (with filters)
POST   /api/admin/questions                   Create question
PUT    /api/admin/questions/:id               Update question
DELETE /api/admin/questions/:id               Delete question
POST   /api/admin/questions/import            Bulk import questions
GET    /api/admin/questions/:id/stats         Question performance statistics
```

### Real-time

WebSocket connection for live test state:
```
ws://api/tests/sessions/:id/live
```

Events: `timer_tick`, `answer_saved`, `session_expired`

---

## 7. Tech Stack (AWS)

### AWS Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                │
│  [Next.js + React on AWS Amplify Hosting / CloudFront + S3]        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│               API Gateway (WebSocket + REST API)                    │
│  • API Gateway REST API (CRUD endpoints)                            │
│  • API Gateway WebSocket API (test timer sync)                      │
│  • Lambda Authorizer (JWT validation)                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    Application Layer (Lambda)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Test Engine  │  │ Profile      │  │ Conversation │             │
│  │ (TS/Node.js) │  │ Engine (Py)  │  │ Engine (Py)  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                        Data Layer                                   │
│  • RDS PostgreSQL (Aurora Serverless v2)                            │
│  • ElastiCache (Redis) - Session state, caching                     │
│  • DynamoDB - WebSocket connections tracking                        │
│  • S3 - Question images, exported PDFs, backups                     │
└─────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    Supporting Services                              │
│  • SQS - Job queues (profile snapshots, emails, reports)            │
│  • EventBridge - Scheduled tasks (daily analytics, cleanups)        │
│  • SES - Email notifications                                        │
│  • Secrets Manager - API keys, DB credentials                       │
│  • Parameter Store - Configuration, feature flags                   │
│  • CloudWatch - Logs, metrics, alarms                               │
│  • X-Ray - Distributed tracing                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Frontend

| Layer | Technology | AWS Service | Rationale |
|---|---|---|---|
| Framework | **Next.js 14+ (App Router)** | AWS Amplify Hosting | SSR/SSG with automatic deployments from Git |
| Styling | **Tailwind CSS** | N/A | Rapid iteration, consistent design system |
| State | **React Context + SWR** | N/A | Lightweight; no Redux overhead for MVP |
| Charts | **Recharts** | N/A | Lightweight charting for skill radar, trends |
| CDN | Static assets | **CloudFront** | Edge caching, HTTPS, custom domain |
| **Streaming Layer** | | | |
| Test Timer Sync | WebSocket client | **API Gateway WebSocket** + **DynamoDB** | Real-time bidirectional timer sync, connection tracking |
| AI Response Streaming | EventSource (SSE) | **ALB** + **Lambda streaming response** | Unidirectional server→client token streaming |

**Why Two Streaming Approaches:**
- **WebSocket for timer:** Bidirectional (client can pause, server can force-expire), persistent connection needed
- **SSE for AI chat:** Unidirectional (server streams tokens), simpler infrastructure, auto-reconnect

**Deployment Architecture:**
```
GitHub → Amplify CI/CD → Build Next.js → Deploy to S3 → Serve via CloudFront
```

### Backend: API Layer

| Component | Technology | AWS Service | Rationale |
|---|---|---|---|
| REST API | Next.js API Routes (TS) | **Lambda** + **API Gateway** | CRUD operations, student/parent endpoints |
| WebSocket API | Custom handlers | **API Gateway WebSocket** | Real-time timer sync, test state updates |
| AI Services | FastAPI/Python | **Lambda** | Claude API integration, profile analysis |
| Authentication | NextAuth.js | **Cognito** (optional) or **Lambda** | JWT-based auth, can integrate Cognito later |
| Authorization | Custom middleware | **Lambda Authorizer** | Role-based access control (student/parent/admin) |
| Validation | Zod (TS) / Pydantic (Python) | N/A | Runtime type safety |

**API Gateway Configuration:**

```yaml
REST API:
  Name: edulens-api
  Endpoint Type: Regional (ap-southeast-2)
  Throttling: 10,000 requests/second burst, 5,000 steady state
  Caching: 300s TTL for GET requests (profile, questions)
  CORS: Enabled for Amplify domain

WebSocket API:
  Name: edulens-websocket
  Routes:
    $connect: connection-handler (Lambda Authorizer)
    $disconnect: disconnection-handler
    timer-sync: timer-sync-handler
    answer-submit: answer-submit-handler
  Connection Store: DynamoDB table (connectionId → userId)
```

### Backend: Compute Layer

**Lambda Functions:**

| Function | Runtime | Memory | Timeout | Trigger | Purpose |
|---|---|---|---|---|---|
| `api-rest-*` | Node.js 20 | 512 MB | 30s | API Gateway | CRUD operations |
| `api-websocket-*` | Node.js 20 | 256 MB | 10s | API Gateway WS | Real-time timer connections |
| `api-chat-stream` | Node.js 20 | 1024 MB | 120s | ALB (SSE) | AI response streaming via SSE |
| `profile-engine` | Python 3.12 | 1024 MB | 60s | Direct invoke | Profile calculations, mastery updates |
| `conversation-agent` | Node.js 20 | 2048 MB | 120s | Direct invoke | Claude API calls, guardrails, context building |
| `conversation-summarizer` | Python 3.12 | 512 MB | 60s | SQS | Session summarization (Haiku) |
| `insight-promoter` | Python 3.12 | 512 MB | 60s | SQS | Promote conversation insights to profile |
| `signal-extractor` | Python 3.12 | 512 MB | 30s | SQS | Extract learning signals from chat |
| `job-worker-*` | Python 3.12 | 512-1024 MB | 300s | SQS | Background jobs (snapshots, emails, reports) |
| `scheduled-tasks` | Python 3.12 | 512 MB | 300s | EventBridge | Daily analytics, cleanup |

**New Conversation Pipeline Functions:**
- **conversation-summarizer**: Runs when session ends or times out; creates Tier 2 memory (conversation_memory table)
- **insight-promoter**: Runs after summarization; promotes key insights to Tier 3 (Learning DNA)
- **signal-extractor**: Runs after each AI response; extracts structured learning signals for profile updates
- **api-chat-stream**: Handles SSE streaming; different from REST API routes due to streaming response requirements

**Why Lambda:**
- Pay per request (cost-effective for MVP traffic patterns)
- Auto-scaling (handle test completion spikes)
- Sydney (ap-southeast-2) region for low latency
- Easy integration with other AWS services
- Provisioned concurrency for latency-sensitive functions

**Alternative: ECS Fargate** (if Lambda limitations hit):
- For long-running profile recalculations (>15 min)
- For WebSocket connections requiring persistent state
- Can migrate specific services to ECS while keeping Lambda for others

### Data Layer

| Layer | AWS Service | Configuration | Rationale |
|---|---|---|---|
| Primary DB | **RDS Aurora PostgreSQL** (Serverless v2) | ACU: 0.5-2 (scales with load) | JSONB for Learning DNA, strong relational integrity, auto-scaling |
| Cache | **ElastiCache** (Redis 7.x) | node: cache.t4g.micro (0.5 GB), Single-AZ for MVP | Session state, timer state, response caching, rate limiting |
| WebSocket State | **DynamoDB** | On-demand billing, Single table design | Connection ID tracking, low-latency reads |
| File Storage | **S3** | Standard tier, Lifecycle policy | Question images, PDF reports, DB backups |
| Secrets | **Secrets Manager** | Automatic rotation enabled | Claude API key, DB credentials, JWT secrets |
| Configuration | **Systems Manager Parameter Store** | Standard tier | Feature flags, app config |
| ORM | **Prisma** | N/A | Type-safe DB access, migrations |
| Event Store | **PostgreSQL** (append-only table) | Partitioned by month | Event sourcing without dedicated service |

**RDS Aurora Serverless v2 Configuration:**

```yaml
Engine: aurora-postgresql
Version: 15.4
Capacity: 0.5 - 2 ACU (scales automatically)
Multi-AZ: No (enable in production)
Backup: 7-day retention
Encryption: AES-256 (at rest)
VPC: Private subnets only
Security Group: Allow Lambda security group only

Estimated Cost (MVP):
  0.5 ACU steady state: ~$43/month
  Scales to 2 ACU during peak: ~$172/month during scale events
  Storage: $0.10/GB-month
  Backups: $0.02/GB-month
```

**ElastiCache Configuration:**

```yaml
Node Type: cache.t4g.micro (start), scale to cache.t4g.small at 1,000+ users
Engine: Redis 7.1
RAM: 0.5 GB (micro), 1.69 GB (small)
Replicas: 0 (single node for MVP)
Multi-AZ: No (enable in production)
Encryption: In-transit and at-rest
VPC: Private subnets

Use Cases:
  - Session state (test sessions, timer state): TTL = 2 hours
  - Response cache (common parent questions): TTL = 24 hours
  - Rate limiting (token bucket): TTL = 1 minute
  - Conversation messages (last 10 turns): TTL = 1 hour
  - Agent state (UI polling): TTL = 35 minutes

Key Patterns:
  session:{session_id}:messages       → JSON array of recent messages
  agent:state:{session_id}            → Agent state machine context
  response_cache:{query_hash}         → Cached AI responses
  rate_limit:{user_id}:{date}         → Token bucket counters

Estimated Cost: ~$12/month (micro), ~$24/month (small)
```

**DynamoDB for WebSocket Connections:**

```yaml
Table: websocket-connections
Partition Key: connectionId (String)
Attributes:
  - userId (String)
  - sessionId (String)
  - connectedAt (Number)
  - lastPingAt (Number)

Billing Mode: On-demand (pay per request)
TTL: Enabled on lastPingAt (auto-delete stale connections after 2 hours)

Estimated Cost (100 concurrent connections): ~$2/month
```

### Job Queue System

| Component | AWS Service | Configuration |
|---|---|---|
| Job Queues | **SQS FIFO** | 4 queues: profile-jobs, notification-jobs, export-jobs, import-jobs |
| Job Workers | **Lambda** | Triggered by SQS, concurrent execution: 10 |
| Scheduler | **EventBridge** | Cron rules for daily/hourly tasks |
| Dead Letter Queue | **SQS Standard** | Failed job storage, alarm on message receipt |

**SQS Configuration:**

```yaml
Queue: profile-jobs.fifo
Message Retention: 14 days
Visibility Timeout: 120 seconds (2x Lambda timeout)
Receive Wait Time: 20 seconds (long polling)
Max Receives: 3 (then move to DLQ)
Encryption: AES-256

Dead Letter Queue: profile-jobs-dlq
Alarm: CloudWatch alarm on ApproximateNumberOfMessagesVisible > 0
```

### Authentication & Authorization

**Option 1: NextAuth.js + Custom (MVP Approach)**

```typescript
// Simpler, faster to implement
// Uses JWT stored in httpOnly cookies
// Custom user table in PostgreSQL
// Lambda Authorizer validates JWT

Pros: Simple, full control, familiar to Next.js developers
Cons: Manual user management, no built-in MFA, federation, etc.
```

**Option 2: AWS Cognito (Production Approach)**

```yaml
User Pool:
  Name: edulens-users
  Attributes: email (required), name, family_name
  Password Policy: Min 8 chars, requires uppercase + lowercase + number
  MFA: Optional (SMS or TOTP)
  Email Verification: Required

Identity Pool: Not needed (using JWT directly)

Client: Next.js app
  OAuth: Enabled (for future Google/Facebook login)
  Token Expiry: Access 1 hour, Refresh 30 days

Integration: NextAuth.js CognitoProvider

Estimated Cost: $0 for <50,000 MAUs (free tier)
```

**Recommendation for MVP:** Start with NextAuth.js + custom, migrate to Cognito in Phase 2 when MFA and social login become requirements.

### Monitoring & Observability

| Component | AWS Service | Configuration |
|---|---|---|
| Logs | **CloudWatch Logs** | Log Groups per Lambda, 7-day retention |
| Metrics | **CloudWatch Metrics** | Custom metrics (API latency, LLM cost, errors) |
| Tracing | **X-Ray** | Enable on API Gateway + Lambda |
| Alarms | **CloudWatch Alarms** | Cost alerts, error rate alerts, latency alerts |
| Dashboards | **CloudWatch Dashboards** | Real-time operational dashboard |
| Error Tracking | **Sentry** (external) | Client-side errors, stack traces |
| Uptime Monitoring | **Route 53 Health Checks** | Ping API endpoints every 30s |

*See Section 11 for detailed monitoring strategy.*

### CI/CD Pipeline

| Stage | Tool | AWS Service |
|---|---|---|
| Source Control | **GitHub** | N/A |
| Frontend CI/CD | **Amplify Console** | Automatic deploys on push to `main` |
| Backend CI/CD | **GitHub Actions** | Builds, tests, deploys Lambda via AWS CDK |
| IaC | **AWS CDK** (TypeScript) | Define all infrastructure as code |
| Secrets | **GitHub Secrets** + **OIDC** | Secure AWS credentials, no long-lived keys |

**GitHub Actions Workflow:**

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths: ['backend/**', 'cdk/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # OIDC
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/GitHubActionsRole
          aws-region: ap-southeast-2

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: CDK Deploy
        run: |
          cd cdk
          npm install
          npx cdk deploy --all --require-approval never
```

### Feature Flags

| Component | AWS Service | Configuration |
|---|---|---|
| Feature Flags | **AppConfig** | Dynamic configuration without redeploy |
| Flag Storage | **Parameter Store** | Structured JSON for flag definitions |

**AppConfig Configuration:**

```yaml
Application: edulens
Environment: production
Configuration Profile: feature-flags

Flags:
  parent_ai_chat_enabled: true
  student_chat_v2_prompt: false  # A/B testing
  confidence_estimator_ui: false  # Collecting data only
  advanced_time_analysis: true
  response_caching: true

Deployment Strategy: Linear (10% every 10 minutes)
Rollback: Automatic on CloudWatch alarm trigger
```

### Security

| Layer | AWS Service | Implementation |
|---|---|---|
| DDoS Protection | **AWS Shield Standard** | Automatic, free |
| WAF | **AWS WAF** (Phase 2) | Rate limiting, SQL injection protection |
| Secrets | **Secrets Manager** | Automatic rotation, encrypted storage |
| Encryption (Transit) | **ACM** (SSL/TLS) | Free certificates via Certificate Manager |
| Encryption (Rest) | **KMS** | RDS, S3, ElastiCache encryption |
| Network | **VPC** | Private subnets for RDS, ElastiCache, Lambda |
| IAM | **IAM Roles** | Least privilege, no long-lived keys |
| Audit | **CloudTrail** | All API calls logged |

### Cost Estimation (MVP - First Month, 100 Active Students)

| Service | Configuration | Monthly Cost (USD) |
|---|---|---|
| **Compute** |  |  |
| Lambda (API + Jobs) | 1.5M requests, 500ms avg, 512-1024MB | $12 |
| Lambda (Streaming) | 100K SSE streams, 2s avg, 1024MB | $4 |
| **Data** |  |  |
| RDS Aurora Serverless v2 | 0.5-1 ACU average, 15 GB (incl. conversations) | $60 |
| ElastiCache | t4g.micro, single node (conversations + cache) | $12 |
| DynamoDB | On-demand, 100K r/w (WebSocket connections) | $2 |
| S3 | 50 GB storage, 100 GB transfer | $6 |
| **API & Networking** |  |  |
| API Gateway | 1M REST, 100K WebSocket | $5 |
| ALB | For SSE streaming, 100K requests | $18 |
| CloudFront | 100 GB data transfer | $8 |
| **AI** (with 3-tier memory + prompt caching) |  |  |
| Claude API | Conversational (Sonnet) + Background (Haiku) | $162 |
| **Other** |  |  |
| Amplify Hosting | Next.js SSR, 100GB bandwidth | $15 |
| SQS | 1.5M requests (conversation jobs) | $0.60 |
| CloudWatch | Logs (15 GB), metrics, alarms | $15 |
| Secrets Manager | 5 secrets | $2 |
| **Total (excluding AI)** |  | **~$159/month** |
| **Total (including AI)** |  | **~$321/month** |

**Key Changes from v1 estimate:**
- Added ALB for SSE streaming ($18/month)
- Increased Lambda costs for conversation pipeline ($16 vs $8)
- Increased RDS storage for conversation tables (15 GB vs 10 GB)
- **AI costs reduced** from $60-300 to $162 via prompt caching + model routing
- More predictable total: **$321/month** vs previous range of $178-418

**Scaling Estimates (1,000 Active Students):**
- Compute: $80 (10x requests)
- RDS: $150 (higher ACU average)
- ElastiCache: $50 (cache.t4g.small)
- API Gateway: $50
- Claude API: $600-3,000
- **Total: $1,100-3,500/month**

### Why This AWS Stack

**Strengths:**
- **Serverless-first:** Pay for actual usage, not idle capacity (critical for MVP)
- **Auto-scaling:** Handle test completion spikes without manual intervention
- **Sydney region:** Low latency for NSW target market (10-30ms vs 150-200ms from US)
- **Integrated:** All services work together (CloudWatch, X-Ray, IAM)
- **Managed:** No server patching, DB maintenance, Redis cluster management
- **Cost-effective:** ~$200/month for MVP vs $500+ for EC2-based architecture

**Trade-offs:**
- **Lambda cold starts:** 200-500ms for first request (mitigate with provisioned concurrency for critical paths)
- **Vendor lock-in:** Heavy AWS usage makes migration harder (acceptable for startup)
- **Learning curve:** CDK, Lambda best practices (team skill investment)

**Alternative Architectures Considered:**

| Architecture | Pros | Cons | Decision |
|---|---|---|---|
| **ECS Fargate + ALB** | No cold starts, easier for traditional apps | Higher baseline cost (~$100/month minimum), slower scaling | ❌ Rejected for MVP (over-engineered) |
| **EC2 + Load Balancer** | Full control, traditional deployment | Manual scaling, server management, $200+ baseline | ❌ Rejected (too much ops overhead) |
| **Serverless (current)** | Low cost, auto-scaling, no ops | Cold starts, 15-min Lambda limit | ✅ Selected for MVP |

**Migration Path:** If Lambda limitations become problematic (e.g., >15min profile recalculations), migrate specific services to ECS Fargate while keeping API layer serverless.

---

## 8. AI Cost Management

### The Problem

Claude API is the product's competitive advantage but also the largest variable cost.

**Cost Breakdown (100 active users, 10 conversations/week avg):**

```
Parent Chat (Conversational):
  100 users × 10 messages/week × 4 weeks = 4,000 messages/month
  With prompt caching (29% reduction):
    First turn: 5,000 tokens input (no cache) + 1,500 output = $0.0375
    Turns 2-5: 5,000 tokens (90% cached) + 10,000 history + 1,500 output
             = ~3,000 new tokens input + 1,500 output = $0.0165/turn
  Avg per 5-turn session: $0.0375 + (4 × $0.0165) = $0.104
  Total: 1,000 sessions/month × $0.104 = $104/month

Parent Chat (Background Tasks - all Haiku):
  Summarization: 1,000 sessions × $0.00088 = $0.88/month
  Signal extraction: 4,000 messages × $0.00050 = $2.00/month
  Suggested questions: 4,000 messages × $0.00034 = $1.36/month
  Total background: $4.24/month

Student Chat (Conversational - Sonnet):
  100 students × 3 tests/month × 3 questions reviewed/test = 900 sessions
  Avg session: 3 turns × $0.0195 = $0.0585
  Total: 900 sessions × $0.0585 = $52.65/month

Student Chat (Background - Haiku):
  Signal extraction: 2,700 messages × $0.00050 = $1.35/month

**Total AI Cost (100 users):** $104 + $4.24 + $52.65 + $1.35 = **$162.24/month**

**At 1,000 users:**
- Parent chat: $1,040/month
- Parent background: $42.40/month
- Student chat: $526.50/month
- Student background: $13.50/month
- **Total: $1,622.40/month**

**With prompt caching vs without:**
- Without caching: ~$2,285/month (1,000 users)
- With caching: ~$1,622/month (1,000 users)
- **Savings: $663/month (~29%)**
```

**At scale, AI costs could exceed infrastructure costs 10:1.**

### Cost Control Strategies

#### Strategy 1: Response Caching (30-50% Savings)

```python
class SmartResponseCache:
    def __init__(self):
        self.redis = get_elasticache_client()

    def get_cache_key(self, query: str, profile_summary: dict) -> str:
        """Generate cache key from query intent + profile pattern"""

        # Classify query intent
        intent = self.classify_query_intent(query)

        # Hash relevant profile features
        if intent == "skill_weakness":
            features = {
                "weak_skills": profile_summary["bottom_3_skills"],
                "error_distribution": profile_summary["error_profile"]["distribution"]
            }
        elif intent == "improvement_trend":
            features = {
                "trend_direction": profile_summary["overall_trend"],
                "test_count": profile_summary["total_tests"]
            }
        # ... more intents

        # Create cache key
        feature_hash = hashlib.md5(json.dumps(features, sort_keys=True).encode()).hexdigest()
        return f"response:{intent}:{feature_hash}"

    def get_cached_response(self, query: str, profile: LearningDNA) -> Optional[str]:
        """Try to retrieve cached response"""
        profile_summary = self.summarize_profile(profile)
        cache_key = self.get_cache_key(query, profile_summary)

        cached = self.redis.get(cache_key)
        if cached:
            # Personalize cached response
            return self.personalize_response(cached, profile.student_name)
        return None

    def classify_query_intent(self, query: str) -> str:
        """Classify query into cacheable intents"""
        intent_patterns = {
            "skill_weakness": ["weak", "struggling", "low score", "poor at", "needs help"],
            "improvement_trend": ["getting better", "improving", "progress", "improved"],
            "time_management": ["rushing", "time pressure", "running out of time"],
            "error_types": ["mistakes", "errors", "why wrong", "what types of errors"],
            "general_explanation": ["what is", "explain", "how does", "what does mean"]
        }

        query_lower = query.lower()
        for intent, patterns in intent_patterns.items():
            if any(pattern in query_lower for pattern in patterns):
                return intent

        return "custom"  # Not cacheable

    def cache_response(self, query: str, profile: LearningDNA, response: str, ttl: int = 86400):
        """Cache response if query is cacheable"""
        intent = self.classify_query_intent(query)
        if intent != "custom":  # Only cache common intents
            profile_summary = self.summarize_profile(profile)
            cache_key = self.get_cache_key(query, profile_summary)

            # Depersonalize before caching
            depersonalized = self.depersonalize_response(response)
            self.redis.setex(cache_key, ttl, depersonalized)
```

**Expected Impact:**
- 40% of parent queries are common intents
- Cache hit rate: 30-50% after 1 week
- Cost reduction: $80-400/month at 1,000 users

#### Strategy 2: Model Tiering (20-30% Savings)

```python
class ModelSelector:
    """Select cheapest adequate model for query complexity"""

    def select_model(self, query: str, context_size: int) -> str:
        """
        Haiku: $0.25/$1.25 per MTok (input/output)
        Sonnet: $3/$15 per MTok
        Opus: $15/$75 per MTok
        """

        # Simple queries → Haiku
        if self.is_simple_query(query) and context_size < 2000:
            return "claude-haiku-4-5"

        # Complex analysis → Sonnet
        if context_size < 10000:
            return "claude-sonnet-4-6"

        # Deep multi-test analysis → Opus
        return "claude-opus-4-6"

    def is_simple_query(self, query: str) -> bool:
        """Determine if query needs complex reasoning"""
        simple_patterns = [
            "what is", "explain", "how many", "show me",
            "list", "when did", "which test"
        ]
        return any(pattern in query.lower() for pattern in simple_patterns)

# Apply model selection
model = model_selector.select_model(query, len(context))
response = anthropic_client.messages.create(
    model=model,
    # ... other params
)
```

**Expected Impact:**
- 30% of queries can use Haiku (12x cheaper than Sonnet)
- 60% use Sonnet
- 10% need Opus
- Average cost reduction: 20-30%

#### Strategy 3: Context Pruning (10-20% Savings)

```python
def build_minimal_context(query: str, profile: LearningDNA) -> dict:
    """Include only relevant profile sections"""

    # Identify relevant skills from query
    relevant_skills = extract_mentioned_skills(query)

    if relevant_skills:
        # Targeted context: only mentioned skills
        skill_data = {
            skill_id: profile.skill_graph[skill_id]
            for skill_id in relevant_skills
        }
    else:
        # General context: top 3 + bottom 3 skills
        skill_data = {
            **profile.get_top_skills(3),
            **profile.get_bottom_skills(3)
        }

    # Always include summary stats
    context = {
        "summary": profile.get_summary(),
        "skills": skill_data,
        "recent_tests": profile.get_recent_test_summaries(3)
    }

    # Estimate tokens
    context_str = json.dumps(context)
    estimated_tokens = len(context_str.split()) * 1.3

    # If still too large, compress further
    if estimated_tokens > 5000:
        context = compress_context(context)

    return context
```

**Expected Impact:**
- Reduce avg context from 3,000 tokens to 1,500 tokens
- 50% reduction in input token cost
- 10-20% total cost reduction (output tokens remain same)

#### Strategy 4: Rate Limiting & Quotas

```python
class RateLimiter:
    """Prevent API cost runaway"""

    LIMITS = {
        "parent": {
            "messages_per_day": 50,
            "messages_per_hour": 10,
            "tokens_per_day": 100_000
        },
        "student": {
            "sessions_per_test": 5,  # Max 5 questions reviewed per test
            "messages_per_session": 10,
            "tokens_per_day": 50_000
        }
    }

    def check_rate_limit(self, user_id: str, user_type: str) -> RateLimitResult:
        """Check if user has exceeded limits"""
        redis_key = f"rate_limit:{user_type}:{user_id}:{date.today()}"

        usage = self.redis.hgetall(redis_key)
        limits = self.LIMITS[user_type]

        if int(usage.get("messages", 0)) >= limits["messages_per_day"]:
            return RateLimitResult(
                allowed=False,
                reason="daily_message_limit",
                reset_at=get_next_day_start()
            )

        if int(usage.get("tokens", 0)) >= limits["tokens_per_day"]:
            return RateLimitResult(
                allowed=False,
                reason="daily_token_limit",
                reset_at=get_next_day_start()
            )

        return RateLimitResult(allowed=True)

    def record_usage(self, user_id: str, user_type: str, tokens: int):
        """Increment usage counters"""
        redis_key = f"rate_limit:{user_type}:{user_id}:{date.today()}"
        self.redis.hincrby(redis_key, "messages", 1)
        self.redis.hincrby(redis_key, "tokens", tokens)
        self.redis.expire(redis_key, 86400 * 2)  # Keep for 2 days
```

**System-wide Cost Quotas:**

```python
# CloudWatch alarm on daily spend
def check_daily_cost_budget():
    """Alert if daily AI cost exceeds threshold"""
    daily_cost = get_claude_api_cost_today()

    if daily_cost > 100:  # $100/day threshold
        send_alert("engineering", "AI cost exceeded $100 today")

    if daily_cost > 500:  # $500/day hard stop
        send_alert("engineering", "CRITICAL: AI cost exceeded $500, enabling emergency rate limiting")
        enable_emergency_rate_limiting()

# EventBridge rule: Run every hour
```

#### Strategy 5: Graceful Degradation

```python
def get_ai_response(query: str, profile: LearningDNA) -> str:
    """Attempt AI response with fallback to templated responses"""

    # Check cost budget
    if is_cost_budget_exceeded():
        return get_templated_response(query, profile)

    try:
        # Attempt AI response
        response = call_claude_api(query, profile)
        return response

    except RateLimitError:
        # API rate limit hit
        logger.warning("Claude API rate limit hit, using fallback")
        return get_templated_response(query, profile)

    except APIError as e:
        # API error
        logger.error(f"Claude API error: {e}")
        return get_templated_response(query, profile)

def get_templated_response(query: str, profile: LearningDNA) -> str:
    """Generate response from templates using profile data"""

    intent = classify_query_intent(query)

    if intent == "skill_weakness":
        weak_skills = profile.get_bottom_skills(3)
        return f"Based on the tests completed, the areas that need most attention are: " + \
               ", ".join([f"{s['label']} ({s['mastery']:.0%} mastery)" for s in weak_skills]) + ". " + \
               "I recommend focusing practice on these areas."

    elif intent == "improvement_trend":
        trend_data = profile.get_overall_trend()
        return f"Over the last {trend_data['test_count']} tests, the overall trend is {trend_data['direction']}. " + \
               f"Skills showing improvement: {', '.join(trend_data['improving'])}. " + \
               f"Skills needing attention: {', '.join(trend_data['declining'])}."

    # ... more templates

    return "I'm having trouble processing that question right now. Could you try rephrasing, or ask about specific skills or test results?"
```

### Cost Monitoring Dashboard

**CloudWatch Custom Metrics:**

```python
# Publish metrics after each AI call
cloudwatch.put_metric_data(
    Namespace='EduLens/AI',
    MetricData=[
        {
            'MetricName': 'TokensUsed',
            'Value': tokens_used,
            'Unit': 'Count',
            'Dimensions': [
                {'Name': 'Model', 'Value': model_name},
                {'Name': 'UserType', 'Value': user_type},
                {'Name': 'CacheHit', 'Value': 'true' if cache_hit else 'false'}
            ]
        },
        {
            'MetricName': 'EstimatedCost',
            'Value': estimated_cost_usd,
            'Unit': 'None',  # USD
            'Dimensions': [
                {'Name': 'Model', 'Value': model_name}
            ]
        },
        {
            'MetricName': 'ResponseLatency',
            'Value': response_time_ms,
            'Unit': 'Milliseconds'
        }
    ]
)
```

**Alarms:**

```yaml
Alarms:
  - Name: DailyAICostHigh
    Metric: EstimatedCost (sum)
    Threshold: $100/day
    Action: Email engineering team

  - Name: DailyAICostCritical
    Metric: EstimatedCost (sum)
    Threshold: $500/day
    Action: PagerDuty alert + enable emergency rate limiting

  - Name: CacheHitRateLow
    Metric: CacheHit (average)
    Threshold: < 20%
    Action: Email engineering (cache not working effectively)

  - Name: ResponseLatencyHigh
    Metric: ResponseLatency (p95)
    Threshold: > 5000ms
    Action: Email engineering
```

### Expected Cost Savings Summary

| Strategy | Implementation Effort | Expected Savings | Priority |
|---|---|---|---|
| Response Caching | Medium | 30-50% | High |
| Model Tiering | Low | 20-30% | High |
| Context Pruning | Low | 10-20% | Medium |
| Rate Limiting | Medium | Prevents runaway | High |
| Graceful Degradation | Medium | Emergency failsafe | Medium |
| **Combined** | - | **50-70% potential savings** | - |

**Projected Costs with Optimizations (1,000 users):**

| Scenario | Unoptimized | Optimized | Savings |
|---|---|---|---|
| Monthly AI Cost | $2,800 | $840-1,400 | $1,400-1,960 |
| Cost per user | $2.80 | $0.84-1.40 | 50-70% |

---

## 9. Data Privacy & Compliance

### Australian Privacy Principles (APP)

EduLens handles personal information of children under 18. Must comply with Privacy Act 1988 (Cth) and APPs.

#### Key Requirements

| APP | Requirement | Implementation |
|---|---|---|
| **APP 1** | Open and transparent management of personal information | Privacy policy on website, clear language |
| **APP 3** | Collection only when necessary, with consent | Explicit consent checkboxes during signup |
| **APP 5** | Notification of collection purpose | Explain why we collect data (learning profile, AI analysis) |
| **APP 6** | Use/disclosure only for primary purpose | Never sell data, never share with third parties |
| **APP 11** | Security safeguards | Encryption at rest and in transit, access controls |
| **APP 12** | Access and correction rights | User dashboard to view/download/delete data |
| **APP 13** | Correction of data | Allow parents to edit student info, delete incorrect test results |

### Consent Flow

**Parent Signup:**

```typescript
// Explicit consent checkboxes (not pre-checked)
interface SignupConsent {
  data_collection: boolean;  // Required: collect test data
  ai_processing: boolean;    // Required: use AI to analyze learning
  email_notifications: boolean;  // Optional: send progress emails
  research_participation: boolean;  // Optional: anonymized data for research
}

// Consent must be:
// 1. Freely given (not forced)
// 2. Specific (clear purpose)
// 3. Informed (explain what data, why, how)
// 4. Current (can be withdrawn)

const consentText = `
We need your consent to:
✓ Store your child's test responses and performance data
✓ Use AI (Claude by Anthropic) to analyze learning patterns
✓ Generate personalized insights about your child's learning

Your data will:
✓ Only be used to provide the EduLens service
✓ Never be sold or shared with third parties
✓ Be stored securely in Australia (AWS Sydney region)
✓ Be deleted within 30 days if you close your account

You can withdraw consent anytime from your account settings.
`;
```

**Storing Consent:**

```sql
-- Consent records
CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    consent_type TEXT NOT NULL,  -- 'data_collection', 'ai_processing', etc.
    granted BOOLEAN NOT NULL,
    version TEXT NOT NULL,  -- Version of consent text shown
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit all consent changes
CREATE INDEX idx_consent_user_type ON consent_records(user_id, consent_type, created_at DESC);
```

### Data Retention & Deletion

**Retention Policy:**

```yaml
Active Accounts:
  Test Data: Retained indefinitely while account active
  Chat Logs: Retained for 90 days
  Event Stream: Retained for 365 days
  Profile Snapshots: Retained for 365 days

Inactive Accounts (no login for 12+ months):
  Notification: Email warning at 12 months, 13 months, 14 months
  Action: Anonymize data at 15 months (keep for aggregate analysis)
  Delete: Full deletion at 24 months

Closed Accounts:
  Grace Period: 30 days (in case of accidental deletion)
  Soft Delete: Mark as deleted, data inaccessible
  Hard Delete: Complete removal after 30 days
```

**Right to be Forgotten Implementation:**

```python
def delete_user_data(user_id: str, deletion_type: str):
    """
    deletion_type: 'soft' (30-day grace) or 'hard' (immediate, permanent)
    """

    if deletion_type == 'soft':
        # Mark account as deleted
        db.execute(
            "UPDATE users SET deleted_at = NOW(), status = 'deleted' WHERE id = %s",
            (user_id,)
        )
        # Schedule hard delete in 30 days
        sqs.send_message(
            QueueUrl=os.environ['DELETION_QUEUE'],
            MessageBody=json.dumps({"user_id": user_id, "hard_delete_after": 30}),
            DelaySeconds=30 * 24 * 3600
        )

    elif deletion_type == 'hard':
        # Delete from all tables
        db.execute("DELETE FROM chat_messages WHERE session_id IN (SELECT id FROM chat_sessions WHERE user_id = %s)", (user_id,))
        db.execute("DELETE FROM chat_sessions WHERE user_id = %s", (user_id,))
        db.execute("DELETE FROM session_responses WHERE session_id IN (SELECT id FROM test_sessions WHERE student_id IN (SELECT id FROM students WHERE user_id = %s))", (user_id,))
        db.execute("DELETE FROM test_sessions WHERE student_id IN (SELECT id FROM students WHERE user_id = %s)", (user_id,))
        db.execute("DELETE FROM profile_snapshots WHERE student_id IN (SELECT id FROM students WHERE user_id = %s)", (user_id,))
        db.execute("DELETE FROM events WHERE student_id IN (SELECT id FROM students WHERE user_id = %s)", (user_id,))
        db.execute("DELETE FROM students WHERE user_id = %s", (user_id,))
        db.execute("DELETE FROM parent_links WHERE parent_id = %s OR student_id IN (SELECT id FROM students WHERE user_id = %s)", (user_id, user_id))
        db.execute("DELETE FROM consent_records WHERE user_id = %s", (user_id,))
        db.execute("DELETE FROM users WHERE id = %s", (user_id,))

        # Delete from S3
        s3.delete_objects(
            Bucket=os.environ['USER_DATA_BUCKET'],
            Delete={'Objects': [{'Key': f'users/{user_id}/'}]}
        )

        # Log deletion (audit trail)
        audit_log.record({
            "action": "user_data_deleted",
            "user_id": user_id,
            "timestamp": datetime.now(UTC),
            "deletion_type": "hard"
        })
```

**Data Export (Right to Access):**

```python
def export_user_data(user_id: str) -> str:
    """Generate complete data export in JSON format"""

    export = {
        "user": get_user_data(user_id),
        "students": get_student_profiles(user_id),
        "tests": get_all_test_sessions(user_id),
        "chat_history": get_all_chat_messages(user_id),
        "consent_history": get_consent_records(user_id),
        "export_generated_at": datetime.now(UTC).isoformat()
    }

    # Upload to S3, generate presigned URL
    s3_key = f"exports/{user_id}/{uuid.uuid4()}.json"
    s3.put_object(
        Bucket=os.environ['EXPORTS_BUCKET'],
        Key=s3_key,
        Body=json.dumps(export, indent=2),
        ServerSideEncryption='AES256'
    )

    download_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': os.environ['EXPORTS_BUCKET'], 'Key': s3_key},
        ExpiresIn=86400 * 7  # 7 days
    )

    # Email user with download link
    send_email(
        to=get_user_email(user_id),
        subject="Your EduLens Data Export is Ready",
        body=f"Download your data here (link expires in 7 days): {download_url}"
    )

    return download_url
```

### Security Safeguards

| Layer | Implementation | Compliance |
|---|---|---|
| **Encryption at Rest** | RDS (AES-256), S3 (AES-256), ElastiCache (AES-256) | APP 11.1 |
| **Encryption in Transit** | TLS 1.3 (CloudFront, API Gateway, RDS) | APP 11.1 |
| **Access Controls** | IAM roles (least privilege), VPC private subnets | APP 11.1 |
| **Authentication** | JWT tokens, httpOnly cookies, short expiry | APP 11.1 |
| **Secrets Management** | AWS Secrets Manager (API keys, DB creds) | APP 11.1 |
| **Audit Logging** | CloudTrail (all API calls), Application audit logs | APP 11.1 |
| **Backup & Recovery** | RDS automated backups (7-day), S3 versioning | APP 11.1 |
| **Data Residency** | AWS ap-southeast-2 (Sydney) only | APP 8 |

### Third-Party Data Sharing

**Claude API (Anthropic):**

```yaml
Data Sent to Anthropic:
  - Question content (necessary for explanation)
  - Student answer (necessary for explanation)
  - Profile summary (necessary for personalization)
  - NO personally identifying information (names, emails, addresses)

Anthropic's Data Handling:
  - Does NOT use EduLens data for model training (per Enterprise agreement)
  - Retains data for 30 days for abuse monitoring, then deletes
  - SOC 2 Type II certified
  - GDPR compliant

Legal Basis: Necessary for service delivery (APP 6.1)
User Notification: Disclosed in privacy policy and consent flow
```

**No Other Third Parties:**
- No analytics services (Google Analytics, Mixpanel) that share data
- No advertising networks
- No social media integrations that share user data
- CloudWatch logs contain no PII

### Breach Notification

**If data breach occurs:**

```python
# Incident response plan
def handle_data_breach(incident: BreachIncident):
    """
    Must notify OAIC (Office of the Australian Information Commissioner)
    if breach is 'eligible data breach' (serious harm likely)
    """

    # Step 1: Contain breach
    if incident.type == "database_leak":
        # Rotate credentials, revoke access
        rotate_all_db_credentials()
        notify_engineering_team()

    # Step 2: Assess severity
    severity = assess_breach_severity(incident)

    if severity == "high":  # PII exposed
        # Must notify OAIC within 30 days (best practice: ASAP)
        notify_oaic(incident)

        # Must notify affected individuals
        affected_users = identify_affected_users(incident)
        for user in affected_users:
            send_breach_notification(user, incident)

    # Step 3: Document
    log_breach_incident(incident)

def send_breach_notification(user: User, incident: BreachIncident):
    """
    Must include:
    - Description of breach
    - Types of information involved
    - Steps taken to mitigate
    - Recommendations for affected individuals
    """
    email_content = f"""
    Dear {user.name},

    We are writing to inform you of a data security incident that may have affected your account.

    What happened: {incident.description}

    What information was involved: {incident.data_types}

    What we've done: {incident.mitigation_steps}

    What you should do: {incident.user_recommendations}

    We sincerely apologize for this incident.

    Contact: privacy@edulens.com.au
    """
    send_email(user.email, "Important Security Notice", email_content)
```

### Privacy Policy Requirements

Must include:
- ✅ What data we collect (test responses, timing data, chat messages)
- ✅ Why we collect it (generate learning profile, personalize insights)
- ✅ How we use AI (Claude API for conversation)
- ✅ Data storage location (AWS Sydney, Australia)
- ✅ Data retention period (see retention policy)
- ✅ User rights (access, correction, deletion, withdrawal of consent)
- ✅ Contact information for privacy officer
- ✅ Complaint process (OAIC escalation)
- ✅ Policy update process (email notification of changes)

---

## 10. Question Bank Strategy

### MVP Target: 300 Questions

**Distribution by Subject:**

| Subject | Question Count | Rationale |
|---|---|---|---|
| Reading Comprehension | 100 | 30-35% of OC exam, high-leverage skill |
| Mathematical Reasoning | 100 | 30-35% of OC exam, diverse sub-skills |
| Thinking Skills | 100 | 30-35% of OC exam, hardest to prepare for |
| **Total** | **300** | **Enough for 8-10 unique 30-35Q tests** |

**Distribution by Difficulty:**

| Difficulty | Percentage | Question Count |
|---|---|---|---|
| Easy | 30% | 90 |
| Medium | 50% | 150 |
| Hard | 20% | 60 |
| **Total** | **100%** | **300** |

### Content Sourcing Strategy

#### Phase 1: Initial Content (Month 1-2)

**Option 1: Licensed Content**
- Approach existing NSW test prep publishers
- License 200-300 questions for initial bank
- **Cost:** $2,000-5,000 upfront + royalties
- **Pros:** Fast, quality-assured, legally safe
- **Cons:** Expensive, not exclusive

**Option 2: Professional Item Writers**
- Hire 2-3 NSW teachers (retired or part-time)
- Rate: $50-100/question (including review)
- **Cost:** $15,000-30,000 for 300 questions
- **Pros:** Original content, tailored to our taxonomy
- **Cons:** Slower (2-3 months), quality variance

**Option 3: Hybrid Approach (Recommended)**
- License 100-150 questions immediately (2-3 week turnaround)
- Commission 150-200 original questions (2-3 month turnaround)
- **Total Cost:** $10,000-20,000
- **Timeline:** Launch MVP with licensed content, add original content monthly

#### Phase 2: Scaling Content (Month 3-12)

**Content Partnership:**
- Approach 3-5 tutoring centers
- Offer:  profit share or white-label version in exchange for content contribution
- Target: 100 questions/month from partners
- **Cost:** Rev share or discounted licensing

**AI-Assisted Generation (with Human Validation):**
```python
# Use Claude to draft questions, humans validate
def generate_question_draft(skill: str, difficulty: str) -> Question:
    """
    Generate initial question using Claude API
    MUST be reviewed by qualified educator before use
    """
    prompt = f"""
    Generate an OC-style {difficulty} question for skill: {skill}

    Requirements:
    - NSW OC exam format (multiple choice, 4 options)
    - Suitable for Year 4-5 students
    - Include distractors that reveal common misconceptions
    - Provide explanation for correct answer and why distractors are wrong

    Output format:
    {{
      "stem": "...",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "B",
      "explanation": "...",
      "distractor_rationale": {{"A": "...", "C": "...", "D": "..."}}
    }}
    """

    draft = anthropic.messages.create(
        model="claude-sonnet-4-6",
        messages=[{"role": "user", "content": prompt}]
    )

    # Queue for human review
    enqueue_for_review(draft, skill, difficulty)

    return draft
```

**Human Review Process:**
1. Educator reviews AI draft
2. Edits for accuracy, clarity, appropriateness
3. Tags with skill metadata
4. Pilot tests with 20+ students
5. Analyzes pilot data (difficulty, discrimination)
6. Approves for live use or revises

**Target:** 50% cost reduction vs pure human writing

### Quality Assurance

**New Question Workflow:**

```
Draft → Peer Review → Pilot Test → Statistical Analysis → Approval → Live
  (1)      (2)          (3)              (4)            (5)      (6)
```

**1. Peer Review:**
- 2 independent educators review each question
- Checklist:
  - [ ] Factually accurate
  - [ ] Age-appropriate language
  - [ ] Clear, unambiguous stem
  - [ ] One clearly correct answer
  - [ ] Plausible distractors
  - [ ] No cultural bias or stereotypes
  - [ ] Aligns with stated skill tag

**2. Pilot Test:**
- Administer to 20-50 students before going live
- Track:
  - % correct (should match target difficulty)
  - Time spent
  - Answer distribution (if all students pick A, too obvious)

**3. Statistical Analysis (Item Response Theory):**

```python
def analyze_question_quality(question_id: str) -> QualityMetrics:
    """
    Difficulty (p-value): % of students who answered correctly
    Discrimination: Correlation between question performance and overall performance
    """
    responses = get_all_responses_to_question(question_id)

    # Difficulty
    p_value = sum(r.is_correct for r in responses) / len(responses)

    # Discrimination (point-biserial correlation)
    # Do high-scoring students get this question right?
    question_scores = [1 if r.is_correct else 0 for r in responses]
    overall_scores = [get_student_overall_score(r.student_id) for r in responses]
    discrimination = calculate_correlation(question_scores, overall_scores)

    return QualityMetrics(
        difficulty=p_value,
        discrimination=discrimination,
        sample_size=len(responses),
        status=determine_status(p_value, discrimination)
    )

def determine_status(p_value: float, discrimination: float) -> str:
    """
    p_value: 0.3-0.4 = hard, 0.5-0.7 = medium, 0.7-0.9 = easy
    discrimination: > 0.3 = good, 0.2-0.3 = acceptable, < 0.2 = poor
    """
    if discrimination < 0.2:
        return "flagged_low_discrimination"  # Review/revise
    if p_value < 0.1 or p_value > 0.95:
        return "flagged_extreme_difficulty"  # Too hard or too easy
    return "approved"
```

**4. Continuous Monitoring:**
- After 100+ responses, re-analyze
- Flag for review if:
  - Difficulty shifts significantly (calibration drift)
  - Discrimination drops < 0.2
  - Many students report unclear wording

### Skill Tagging System

**Hierarchical Taxonomy:**

```json
{
  "reading": {
    "label": "Reading Comprehension",
    "sub_skills": {
      "inference": {"label": "Inference & Deduction", "oc_weight": "high"},
      "main_idea": {"label": "Main Idea", "oc_weight": "medium"},
      "vocabulary": {"label": "Vocabulary in Context", "oc_weight": "medium"}
      // ...
    }
  },
  "math": {
    "label": "Mathematical Reasoning",
    "sub_skills": {
      "number_patterns": {"label": "Number Patterns", "oc_weight": "high"},
      "word_problems": {"label": "Word Problems", "oc_weight": "high"},
      "geometry": {"label": "Geometry & Spatial", "oc_weight": "medium"}
      // ...
    }
  },
  "thinking": {
    "label": "Thinking Skills",
    "sub_skills": {
      "analogies": {"label": "Analogies", "oc_weight": "high"},
      "pattern_recognition": {"label": "Pattern Recognition", "oc_weight": "high"},
      "logical_deduction": {"label": "Logical Deduction", "oc_weight": "medium"}
      // ...
    }
  }
}
```

**Tagging Rules:**
- Each question must have 1-2 skill tags (primary + optional secondary)
- Tags must be from approved taxonomy
- At least 10 questions per sub-skill for reliable mastery estimation
- Validate tag distribution quarterly (ensure coverage)

### Copyright & Legal

**Original Questions:**
- Copyright owned by EduLens
- Work-for-hire agreements with item writers
- Store all drafts and revisions for provenance

**Licensed Questions:**
- License terms: Perpetual use, can modify, can't resell
- Maintain attribution records
- Renew licenses annually or as needed

**Similarity Checking:**
- Before publishing, check against actual OC exam questions (avoid exact duplicates)
- Tool: Text similarity algorithms + manual review
- Goal: Exam-style but not exam-identical (legal and pedagogical)

### Phase 1 (MVP) Question Bank Roadmap

**Month 1:**
- [ ] Define skill taxonomy (30 sub-skills)
- [ ] Create item writer guidelines (15-page manual)
- [ ] Recruit 2-3 educators
- [ ] License 100 questions OR commission first 100

**Month 2:**
- [ ] Peer review process for first 100 questions
- [ ] Build admin interface for question CRUD
- [ ] Implement tagging and metadata system
- [ ] Pilot test 50 questions with beta users

**Month 3:**
- [ ] Analyze pilot test data
- [ ] Revise flagged questions
- [ ] Add 100 more questions
- [ ] Achieve 200+ approved questions (6-7 unique tests)

**Month 4-6:**
- [ ] Expand to 300 questions
- [ ] Establish ongoing content pipeline (50 questions/month)
- [ ] Implement AI-assisted generation + review workflow

---

## 11. Monitoring & Observability

### Metrics Strategy

**Business Metrics:**
```yaml
User Acquisition:
  - New signups per day
  - Signup conversion rate (landing page visitor → signup)
  - Activation rate (signup → first test completed)

Engagement:
  - Tests per student per week
  - Parent AI chat sessions per week
  - Student chat engagement rate (% reviewing wrong answers)
  - Time spent in chat (avg duration)
  - Return rate (% taking 2nd test within 2 weeks)

Retention:
  - Weekly active users (WAU)
  - Monthly active users (MAU)
  - Retention cohorts (Day 1, 7, 30, 90)
  - Churn rate

Learning Outcomes:
  - Avg mastery improvement per test
  - Skills improved after chat review
  - Test score trends over time
```

**Technical Metrics:**
```yaml
API Performance:
  - Request rate (requests/second)
  - Latency (p50, p90, p95, p99)
  - Error rate (4xx, 5xx)
  - Availability (uptime %)

AI Performance:
  - Claude API latency
  - Claude API cost per request
  - Cache hit rate
  - Response quality (thumbs up/down)
  - Guardrail rejection rate

Database:
  - Query latency (p95, p99)
  - Connection pool usage
  - Slow query count
  - Replication lag (if multi-AZ)

Infrastructure:
  - Lambda cold start rate
  - Lambda concurrent executions
  - RDS CPU/memory utilization
  - ElastiCache hit rate
  - S3 request rate
```

### CloudWatch Dashboards

**Operational Dashboard:**

```yaml
Dashboard: edulens-operations
Refresh: Auto (1 minute)

Widgets:
  Row 1 - Traffic:
    - API Gateway requests/minute (line chart, last 1 hour)
    - Active test sessions (number, real-time)
    - Active WebSocket connections (number, real-time)

  Row 2 - Performance:
    - API latency p95 (line chart, last 1 hour)
    - Lambda duration p95 (line chart, last 1 hour)
    - RDS query latency (line chart, last 1 hour)

  Row 3 - Errors:
    - API 5xx error rate (line chart, last 1 hour)
    - Lambda errors (line chart, last 1 hour)
    - DLQ message count (number, alarm if > 0)

  Row 4 - Costs:
    - Estimated daily AI cost (number + trend)
    - Lambda invocations today (number)
    - RDS ACU usage (line chart, last 24 hours)
```

**Business Dashboard:**

```yaml
Dashboard: edulens-business
Refresh: Daily

Widgets:
  Row 1 - Growth:
    - New signups (last 7 days, bar chart)
    - Total active users (number + % change)
    - Tests completed (last 7 days, bar chart)

  Row 2 - Engagement:
    - Parent chat sessions (last 7 days, bar chart)
    - Student chat engagement rate (%, trend)
    - Avg tests per student (number + trend)

  Row 3 - Retention:
    - DAU/MAU ratio (number + trend)
    - Cohort retention (heatmap)
    - Churn rate (%, trend)

  Row 4 - Learning:
    - Avg mastery improvement per test (%, trend)
    - Most improved skills (top 5, bar chart)
    - Skills needing content (bottom 5 by coverage)
```

### CloudWatch Alarms

**Critical Alarms (PagerDuty):**

```yaml
Alarms:
  - Name: APIErrorRateHigh
    Metric: API Gateway 5xx errors
    Threshold: > 5% error rate over 5 minutes
    Action: PagerDuty critical

  - Name: RDSConnectionsExhausted
    Metric: RDS DatabaseConnections
    Threshold: > 80% of max connections
    Action: PagerDuty critical + auto-scale RDS (if possible)

  - Name: DailyCostCritical
    Metric: EstimatedDailyCost
    Threshold: > $500
    Action: PagerDuty critical + enable emergency rate limiting

  - Name: DataLoss
    Metric: RDS automated backup failure
    Threshold: Any failure
    Action: PagerDuty critical
```

**Warning Alarms (Email/Slack):**

```yaml
Alarms:
  - Name: APILatencyHigh
    Metric: API Gateway latency p95
    Threshold: > 2000ms over 10 minutes
    Action: Email engineering

  - Name: LambdaColdStartRateHigh
    Metric: Lambda cold start rate
    Threshold: > 10% of invocations
    Action: Email engineering (consider provisioned concurrency)

  - Name: CacheHitRateLow
    Metric: ElastiCache hit rate
    Threshold: < 70% over 1 hour
    Action: Email engineering

  - Name: QueueDepthHigh
    Metric: SQS ApproximateNumberOfMessages
    Threshold: > 100 messages in any queue
    Action: Slack notification

  - Name: DiskSpaceRunningOut
    Metric: RDS FreeStorageSpace
    Threshold: < 10 GB
    Action: Email engineering + auto-scale storage
```

### AWS X-Ray Tracing

**Enable X-Ray on:**
- API Gateway (all routes)
- Lambda functions (all)
- RDS queries (via X-Ray SDK)
- Claude API calls (custom span)

**Example Trace:**

```
[Request] POST /api/chat/parent/sessions/123/messages
├─ [API Gateway] 5ms
├─ [Lambda] api-parent-chat-handler
│  ├─ [DynamoDB] Get user session: 15ms
│  ├─ [RDS] Get student profile: 45ms
│  ├─ [ElastiCache] Check response cache: 8ms (MISS)
│  ├─ [Lambda] Invoke conversation-agent: 3200ms
│  │  ├─ [Build Context] 50ms
│  │  ├─ [Guardrails Pre-check] 20ms
│  │  ├─ [Claude API] 3000ms ← bottleneck
│  │  ├─ [Guardrails Post-check] 30ms
│  │  └─ [Signal Extraction] 40ms
│  ├─ [RDS] Save chat message: 25ms
│  └─ [ElastiCache] Cache response: 10ms
└─ [Total] 3328ms
```

**Insights from X-Ray:**
- Identify slow dependencies
- Optimize hot paths
- Detect cascading failures
- Track API call patterns

### Logging Strategy

**Log Levels:**

```python
import logging

# Use structured logging (JSON)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Examples:
logger.info("Test session completed", extra={
    "student_id": student_id,
    "test_id": test_id,
    "score": score,
    "duration_seconds": duration
})

logger.warning("Rate limit triggered", extra={
    "user_id": user_id,
    "limit_type": "daily_messages",
    "current_count": count
})

logger.error("Claude API call failed", extra={
    "error": str(e),
    "model": model,
    "retry_count": retry_count
}, exc_info=True)
```

**Log Groups (CloudWatch Logs):**

```yaml
Log Groups:
  /aws/lambda/api-rest-handler:
    Retention: 7 days
    Subscription: Send ERROR logs to Slack

  /aws/lambda/conversation-agent:
    Retention: 14 days (longer for AI debugging)
    Subscription: Index in CloudWatch Logs Insights

  /aws/lambda/profile-engine:
    Retention: 14 days
    Subscription: Send ERROR logs to Slack

  /aws/rds/cluster/edulens-db/error:
    Retention: 30 days
    Subscription: Alert on critical errors
```

**Log Retention Trade-off:**
- 7 days: Sufficient for troubleshooting recent issues, low cost ($0.50/GB/month)
- 14 days: Better for debugging AI behavior, trend analysis
- 30+ days: Only for compliance or deep analysis needs

**Cost Estimate (MVP):**
- 50 GB logs/month at 7-day retention: ~$25/month

### CloudWatch Logs Insights

**Common Queries:**

```sql
-- Find slow API requests (> 2 seconds)
fields @timestamp, @duration, @message
| filter @duration > 2000
| sort @duration desc

-- Parent chat messages by hour
fields @timestamp
| filter eventType = "parent_chat_message"
| stats count() by bin(1h)

-- Guardrail rejections (hallucination detection)
fields @timestamp, reason, query
| filter guardrail_rejected = true
| sort @timestamp desc

-- Expensive Claude API calls (> 10K tokens)
fields @timestamp, tokens_used, estimated_cost
| filter tokens_used > 10000
| stats sum(estimated_cost) as total_cost by bin(1d)
```

### External Monitoring

**Sentry (Error Tracking):**
```typescript
// Frontend
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of transactions
  beforeSend(event) {
    // Strip PII before sending
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
    }
    return event;
  }
});

// Capture errors
try {
  // ... code
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'TestSession' },
    contexts: { test: { test_id: testId } }
  });
  throw error;
}
```

**Uptime Monitoring (Route 53 Health Checks):**
```yaml
Health Check:
  Type: HTTPS
  Endpoint: https://api.edulens.com.au/health
  Interval: 30 seconds
  Failure Threshold: 3 consecutive failures
  Alarm: Email + PagerDuty on failure

Expected Response:
  Status: 200
  Body: {"status": "healthy", "version": "1.0.0"}
```

---

## 12. Testing Strategy

### Test Pyramid

```
           ┌─────────┐
           │   E2E   │  10%  Slow, expensive, high-level flows
           │  Tests  │
           ├─────────┤
          ┌──────────────┐
          │ Integration  │  30%  API endpoints, DB, external services
          │    Tests     │
          ├──────────────┤
       ┌──────────────────────┐
       │    Unit Tests         │  60%  Pure functions, logic, calculations
       │                       │
       └──────────────────────┘
```

### Unit Tests (60%)

**What to test:**
- Profile calculations (mastery updates, error classification)
- Timer state machine transitions
- Event sourcing replay logic
- Utility functions (date formatting, text processing)
- Guardrails logic (detect inappropriate content, hallucinations)

**Example:**

```typescript
// test/profile-engine/mastery-calculation.test.ts
import { updateMastery } from '../src/profile-engine/mastery';

describe('Mastery Calculation', () => {
  it('should increase mastery on correct answer to hard question', () => {
    const prior = 0.5;
    const difficulty = 0.8; // Hard question
    const isCorrect = true;

    const newMastery = updateMastery(prior, difficulty, isCorrect);

    expect(newMastery).toBeGreaterThan(prior);
    expect(newMastery).toBeLessThanOrEqual(1.0);
  });

  it('should decrease mastery on incorrect answer to easy question', () => {
    const prior = 0.7;
    const difficulty = 0.3; // Easy question
    const isCorrect = false;

    const newMastery = updateMastery(prior, difficulty, isCorrect);

    expect(newMastery).toBeLessThan(prior);
    expect(newMastery).toBeGreaterThanOrEqual(0);
  });

  it('should handle edge case: first question (no prior)', () => {
    const prior = 0.5; // Default prior
    const difficulty = 0.5;
    const isCorrect = true;

    const newMastery = updateMastery(prior, difficulty, isCorrect);

    expect(newMastery).toBeGreaterThan(0);
    expect(newMastery).toBeLessThanOrEqual(1.0);
  });
});
```

**Coverage Target:** 80%+ for core business logic

### Integration Tests (30%)

**What to test:**
- Full API endpoint flows (request → DB → response)
- Profile engine with real event stream
- Chat conversation flow with mock LLM
- Background job processing

**Example:**

```typescript
// test/api/test-session.integration.test.ts
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/api/test-session/create';
import { db } from '../src/lib/db';

describe('POST /api/tests/sessions', () => {
  beforeAll(async () => {
    await db.connect(process.env.TEST_DATABASE_URL);
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    // Clear test data
    await db.execute('TRUNCATE test_sessions CASCADE');
  });

  it('should create new test session', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({
        test_id: 'test-oc-1',
        student_id: 'student-123'
      }),
      headers: {
        Authorization: 'Bearer mock-jwt-token'
      },
      // ... other required fields
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('session_id');
    expect(body.status).toBe('active');

    // Verify session in DB
    const session = await db.query(
      'SELECT * FROM test_sessions WHERE id = $1',
      [body.session_id]
    );
    expect(session.rows).toHaveLength(1);
    expect(session.rows[0].student_id).toBe('student-123');
  });

  it('should return 400 if student_id missing', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({ test_id: 'test-oc-1' }),
      // ... other fields
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('student_id');
  });
});
```

**Environment:** Dedicated test RDS instance (small, ephemeral)

### End-to-End Tests (10%)

**What to test:**
- Critical user flows from UI to DB and back
- Real browser automation (Playwright)
- Actual API calls (not mocked)

**Example:**

```typescript
// test/e2e/take-test.e2e.test.ts
import { test, expect } from '@playwright/test';

test.describe('Student takes test', () => {
  test('complete flow: login → start test → answer questions → submit → view results', async ({ page }) => {
    // 1. Login
    await page.goto('https://staging.edulens.com.au/login');
    await page.fill('input[name="email"]', 'test-student@example.com');
    await page.fill('input[name="password"]', 'test-password');
    await page.click('button[type="submit"]');

    // 2. Navigate to tests
    await expect(page).toHaveURL(/\/dashboard/);
    await page.click('text=Start Practice Test');

    // 3. Start test
    await page.click('text=OC Practice Test 1');
    await page.click('button:has-text("Start Test")');

    // 4. Wait for timer to appear
    await expect(page.locator('[data-testid="timer"]')).toBeVisible();

    // 5. Answer first 3 questions
    for (let i = 1; i <= 3; i++) {
      await page.click(`[data-testid="option-${i}-B"]`); // Select option B
      await page.click('button:has-text("Next")');
    }

    // 6. Submit test (skip remaining questions)
    await page.click('button:has-text("Submit Test")');
    await page.click('button:has-text("Confirm Submit")');

    // 7. Verify results page
    await expect(page).toHaveURL(/\/results/);
    await expect(page.locator('text=Test Results')).toBeVisible();
    await expect(page.locator('[data-testid="total-score"]')).toContainText(/\d+\/\d+/);

    // 8. Check skill breakdown
    await expect(page.locator('text=Skill Breakdown')).toBeVisible();
  });

  test('timer expires → auto-submit', async ({ page }) => {
    // Mock system time to fast-forward timer
    await page.addInitScript(() => {
      let fakeNow = Date.now();
      Date.now = () => {
        fakeNow += 60000; // Add 1 minute per call
        return fakeNow;
      };
    });

    // ... start test

    // Wait for timer expiry
    await expect(page.locator('text=Time\'s Up')).toBeVisible({ timeout: 35000 });

    // Verify auto-submit
    await expect(page).toHaveURL(/\/results/);
  });
});
```

**Environment:** Staging environment (copy of production infrastructure)
**Frequency:** Run on every deploy to staging, nightly on production

### AI Agent Testing

**Golden Dataset:**

```yaml
# test/fixtures/ai-golden-dataset.yaml
test_cases:
  - id: parent-query-1
    query: "Why is thinking skills low?"
    profile_summary:
      thinking_skills_mastery: 0.35
      thinking_skills_trend: "stable"
      tests_completed: 3
    expected_contains:
      - "3 tests"
      - "35%"
      - "analogies"  # Specific sub-skill
    expected_not_contains:
      - "definitely improve"  # No predictions
      - "other students"  # No comparisons

  - id: parent-query-2
    query: "Is she getting better?"
    profile_summary:
      overall_trend: "improving"
      reading_mastery: 0.75
      reading_previous_mastery: 0.60
      tests_completed: 5
    expected_contains:
      - "improving"
      - "60%"
      - "75%"
      - "5 tests"
    expected_not_contains:
      - "will definitely"

  - id: student-explanation-1
    question_stem: "What is 1/2 + 1/4?"
    student_answer: "2/6"
    error_type: "concept_gap"
    expected_contains:
      - "common denominator"
      - "4"
    expected_not_contains:
      - "2/6 is wrong"  # Should use Socratic method, not just say wrong

# ... 50 total test cases
```

**Automated Testing:**

```python
# test/ai-agents/golden-dataset.test.py
import pytest
from src.conversation_engine import ParentInsightAgent

def load_golden_dataset():
    with open('test/fixtures/ai-golden-dataset.yaml') as f:
        return yaml.safe_load(f)['test_cases']

@pytest.mark.parametrize("test_case", load_golden_dataset())
def test_parent_agent_golden_dataset(test_case):
    """Test parent agent against golden dataset"""

    agent = ParentInsightAgent()
    response = agent.get_response(
        query=test_case['query'],
        profile_summary=test_case['profile_summary']
    )

    # Check expected content
    for expected in test_case['expected_contains']:
        assert expected.lower() in response.lower(), \
            f"Expected '{expected}' in response, got: {response}"

    # Check prohibited content
    for prohibited in test_case['expected_not_contains']:
        assert prohibited.lower() not in response.lower(), \
            f"Prohibited '{prohibited}' found in response: {response}"

# Regression detection
def test_golden_dataset_batch():
    """Run all golden tests, save results for comparison"""
    results = []
    for test_case in load_golden_dataset():
        response = agent.get_response(...)
        results.append({
            'test_id': test_case['id'],
            'response': response,
            'timestamp': datetime.now().isoformat()
        })

    # Save results
    with open('test/results/golden-dataset-results.json', 'w') as f:
        json.dump(results, f, indent=2)

    # Compare with previous run
    # Alert if responses changed significantly
```

**Hallucination Detection Test:**

```python
def test_parent_agent_no_hallucination():
    """Ensure agent doesn't cite data not in profile"""

    # Profile with limited data
    profile = LearningDNA(
        tests_completed=1,
        skill_graph={
            "reading.inference": {"mastery": 0.6, "sample_size": 5}
        }
    )

    query = "How is she doing in math word problems?"

    response = agent.get_response(query, profile)

    # Should say "no data yet" not make up data
    assert any(phrase in response.lower() for phrase in [
        "don't have data", "haven't tested", "after more tests"
    ]), f"Expected 'no data' response, got: {response}"

    # Should NOT contain specific math scores
    assert not re.search(r'\d+/\d+', response), \
        f"Response contains score when no math data exists: {response}"
```

### Load Testing

**Scenarios:**

```yaml
Scenario 1: Normal Load
  Users: 100 concurrent
  Duration: 10 minutes
  Actions:
    - Login (5 req/min per user)
    - View dashboard (10 req/min)
    - Start test (0.1 req/min)
    - Submit answers (1 req/min during test)

Scenario 2: Test Completion Spike
  Users: 50 concurrent test-takers
  Duration: 5 minutes
  Actions:
    - All submit test within 30-second window (simulates class/tutoring session ending)
    - Trigger profile recalculations, job queue spike

Scenario 3: Parent Chat Burst
  Users: 30 concurrent parents
  Duration: 10 minutes
  Actions:
    - Rapid-fire questions (1 message every 10 seconds)
    - Stress test Claude API rate limits, ElastiCache

Tool: Artillery.io or Locust
```

**Example (Artillery):**

```yaml
# test/load/parent-chat-burst.yaml
config:
  target: 'https://staging-api.edulens.com.au'
  phases:
    - duration: 60
      arrivalRate: 5  # 5 new users per second
      name: Ramp up
    - duration: 300
      arrivalRate: 10  # 10 new users per second
      name: Sustained load
  variables:
    auth_token: "{{ $processEnvironment.TEST_AUTH_TOKEN }}"

scenarios:
  - name: Parent asks multiple questions
    flow:
      - post:
          url: "/api/chat/parent/sessions"
          headers:
            Authorization: "Bearer {{ auth_token }}"
          json:
            student_id: "{{ $randomString() }}"
          capture:
            - json: "$.session_id"
              as: "session_id"
      - loop:
        - post:
            url: "/api/chat/parent/sessions/{{ session_id }}/messages"
            json:
              content: "Why is thinking skills low?"
        count: 10
```

**Success Criteria:**
- p95 latency < 2 seconds (API endpoints)
- p95 latency < 5 seconds (AI chat)
- 0% error rate under normal load
- < 1% error rate under 2x normal load

### CI/CD Test Automation

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run test:unit
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3  # Upload coverage

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          TEST_URL: https://staging.edulens.com.au
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-screenshots
          path: test-results/

  ai-golden-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: pytest test/ai-agents/ --golden
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - uses: actions/upload-artifact@v3
        with:
          name: golden-dataset-results
          path: test/results/golden-dataset-results.json
```

---

## 13. MVP Phasing

### Phase 1: Foundation (MVP)

**Goal:** Validate that parents value interactive insight over static reports, students engage with AI explanation, and profile-driven conversation feels meaningful.

**Timeline:** 16-20 weeks from kickoff to launch

**Note:** Timeline extended from original 12-16 weeks to accommodate comprehensive conversation architecture (3-tier memory, state machine, SSE streaming). The additional sophistication is critical for product differentiation and user experience.

**Scope:**

| Feature | Details | Priority | Estimate (weeks) |
|---|---|---|---|
| **Core Testing** | | | |
| OC Timed Test | 30-35 MCQ, 30-min timer, per-question timing, robust state machine | Must have | 3 |
| Auto-Scoring | Immediate results with skill breakdown | Must have | 1 |
| WebSocket Timer | Real-time timer sync, reconnection handling | Must have | 2 |
| **Student Experience** | | | |
| Student Explanation Chat | AI explains wrong answers, Socratic method, guardrails | Must have | 3 |
| Student Engagement | Progress prompts, understanding points | Should have | 1 |
| **Parent Experience** | | | |
| Basic Student Profile | Skill graph (flat), error type classification | Must have | 2 |
| Parent AI Chat (Core) | Profile-grounded conversation, guardrails, SSE streaming | Must have | 3 |
| Parent AI Chat (Advanced) | 3-tier memory, cross-session recall, topic detection, agent state machine | Must have | 3 |
| Parent Dashboard | Skill radar, basic trend chart, test history | Must have | 2 |
| Cold Start Experience | Onboarding questionnaire, first-test guidance, demo mode | Must have | 2 |
| **Content & Admin** | | | |
| Question Bank | 300 questions (licensed + original), skill-tagged | Must have | 4-8 |
| Admin: Question CRUD | Create/edit/tag questions, bulk import | Must have | 2 |
| **Foundation** | | | |
| Landing Page | Value proposition, signup flow, pricing preview | Must have | 2 |
| Auth & Consent | Email/password, parent-student linking, consent checkboxes | Must have | 2 |
| Privacy Compliance | Consent flow, data export, deletion workflow | Must have | 2 |
| AI Cost Controls | Response caching, rate limiting, model tiering | Must have | 2 |
| **Infrastructure** | | | |
| AWS Setup | RDS, Lambda, API Gateway, ElastiCache, CloudWatch | Must have | 2 |
| CI/CD Pipeline | GitHub Actions, CDK, automated tests | Must have | 2 |
| Monitoring | CloudWatch dashboards, alarms, X-Ray tracing | Must have | 1 |
| **Quality** | | | |
| Accessibility (WCAG 2.1 AA) | Keyboard navigation, screen reader, color contrast | Must have | 2 |
| Mobile Responsive | All screens work on mobile/tablet | Must have | Ongoing |
| Testing | Unit (80%), integration (30%), E2E (critical flows) | Must have | Ongoing |

**Critical Path Dependencies:**

```
Week 1-2:   AWS infrastructure + Auth + Redis setup
Week 3-4:   Question bank (first 100 questions) + Test engine
Week 5-6:   Profile engine + Scoring + Event sourcing
Week 7-9:   AI agents core (Student + Parent) + Guardrails + Model routing
Week 10-11: Conversation architecture (3-tier memory, state machine, SSE)
Week 12:    Parent dashboard + Landing page
Week 13:    Cold start experience + Engagement mechanics
Week 14:    Privacy compliance + Cost controls
Week 15:    Cross-session recall + Topic detection (conversation polish)
Week 16-17: Testing (unit, integration, E2E, load) + Bug fixes
Week 18-19: Beta testing (20 users) + Iterate on feedback
Week 20:    Production deployment + Launch prep
```

**Key Milestone Gates:**

| Week | Milestone | Success Criteria |
|---|---|---|
| 6 | Profile Engine Complete | Can calculate mastery from test events |
| 9 | Core AI Agents Working | Can chat with parent/student, guardrails pass |
| 11 | Conversation Architecture Live | Multi-turn works, sessions persist, state machine operational |
| 15 | Feature Complete | All MVP features implemented |
| 17 | Testing Complete | All test suites passing, load test successful |
| 19 | Beta Complete | 20 users tested, critical bugs fixed |
| 20 | Launch Ready | Monitoring in place, runbook complete, go/no-go decision |

**Explicit Cut Lines (NOT in Phase 1):**

- ❌ Adaptive question selection (Phase 2)
- ❌ Cohort comparison / percentile rankings (Phase 3)
- ❌ Multiple exam types: Selective, HSC (Phase 2)
- ❌ AI-generated questions (Phase 2, with validation)
- ❌ Open-ended tutoring chat (out of scope)
- ❌ Long-term study plans (Phase 2)
- ❌ Subscription/payment system (Phase 1.5, validate first)
- ❌ Native mobile app (Phase 3)
- ❌ Confidence estimator UI (collect data silently, Phase 2 display)
- ❌ Multi-language support (Phase 2, English + Chinese)
- ❌ Prerequisite edges in skill graph (Phase 2, start with flat)
- ❌ LLM-assisted error reclassification (Phase 2, use heuristics)

**Must-Address Before Launch:**

| Item | Why Critical | Implementation |
|---|---|---|
| ✅ **Privacy Compliance** | Legal requirement, builds trust | Consent flow, data retention policy, export/delete functions |
| ✅ **AI Cost Controls** | Prevent runaway costs | Rate limiting, response caching, cost monitoring alarms |
| ✅ **Timer Robustness** | Core product reliability | State machine, edge case handling, reconnection logic |
| ✅ **Question Bank (300)** | Product has no value without content | License 100, commission 200, QA process |
| ✅ **Guardrails** | Safety, prevent hallucinations | Pre/post LLM validation, escalation handling |
| ✅ **Accessibility** | Legal requirement (Disability Discrimination Act) | WCAG 2.1 AA compliance |
| ✅ **Cold Start UX** | First impression critical | Onboarding, demo mode, appropriate disclaimers |
| ✅ **Monitoring** | Can't fix what you can't see | CloudWatch, alarms, dashboards |

**Success Metrics:**

| Metric | Target (Month 1) | Target (Month 3) | Measurement |
|---|---|---|---|
| Students completing tests | 100 | 500 | CloudWatch custom metric |
| Parents initiating AI chat | 60% | 70% | Engagement rate = chat_sessions / test_completions |
| Parent return rate | 20% (2 weeks) | 35% (2 weeks) | Cohort retention analysis |
| Student chat engagement | 40% | 55% | % students reviewing ≥1 wrong answer |
| Parent AI chat NPS | N/A | 60+ | In-app thumbs up/down + follow-up survey |
| Average mastery improvement | N/A | +0.10 per skill per test | Profile analysis |
| Cost per user (monthly) | <$2 | <$1.50 | Total costs / MAU |

### Phase 1.5: Pricing Validation (Month 2-3)

**Before building subscription system, validate willingness to pay:**

**Approach 1: Fake Door Test**
- Show pricing page after user completes 3 tests
- 3 tiers: Free (1 test/month), Starter ($19/month), Premium ($49/month)
- Capture email for "early access pricing"
- Track click-through rate to pricing page
- Survey users who clicked: "Which tier would you choose?"

**Approach 2: Pre-orders**
- "Launch in 6 weeks. Pre-order now for 50% off first 3 months"
- Offer only to engaged users (3+ tests completed)
- Discount code: EARLYBIRD50
- Track conversion rate: engaged users → pre-orders
- Target: 10% conversion = strong signal to build payments

**Approach 3: Pilot Partnerships**
- Approach 3-5 tutoring centers
- White-label version or profit share
- "We'll customize EduLens for your students, you provide 200 questions"
- Revenue: $500-1,000/month per center
- Validates B2B model alongside B2C

**Decision Gate:**
- If >10% of engaged users show purchase intent → Build Stripe integration
- If 5-10% → Refine pricing, run another experiment
- If <5% → Re-evaluate value proposition before monetization

### Phase 2: Depth (Month 4-9)

**Goal:** Deepen product value, increase retention, enable monetization.

| Feature | Value Delivered | Estimate |
|---|---|---|
| Full Learning DNA | Confidence estimator, prerequisite edges, long-term mastery | 3 weeks |
| Multi-test Trend Analysis | Visual timeline, skill improvement tracking, cohort comparison | 4 weeks |
| LLM Error Reclassification | Chat signals refine error classification | 2 weeks |
| Adaptive Practice (light) | System recommends 3-5 questions to practice based on weaknesses | 4 weeks |
| Question Bank Expansion | Add 300 Selective School questions (total 600) | Ongoing |
| PDF Export Reports | Parents can download/print comprehensive progress reports | 2 weeks |
| Subscription System | Stripe integration, tiered plans, free trial | 3 weeks |
| Multi-language (Chinese) | Parent interface in Simplified Chinese | 3 weeks |
| Parent Mobile App | React Native app (iOS/Android) for parent dashboard + chat | 8 weeks |

### Phase 3: Scale (Month 10-18)

**Goal:** Market expansion, B2B channels, advanced features.

| Feature | Value Delivered |
|---|---|
| Cohort Benchmarking | Anonymous percentile rankings, opt-in |
| Teacher/Tutor Accounts | View multiple student profiles, assign homework |
| API for Tutoring Centers | White-label integrations, bulk student management |
| Multi-region Support | VIC, QLD exam formats (NAPLAN, GATE) |
| Advanced Analytics | Predictive modeling, learning style detection |
| Social Features | Parent forums, study groups (moderated) |

---

## 14. Competitive Moat Analysis

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

## 9. Competitive Moat Analysis

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
| **Learning DNA** | The graph-based, evolving student intelligence model at the heart of EduLens |
| **Skill Graph** | Hierarchical map of subject areas → sub-skills with mastery and confidence scores |
| **Error Pattern Profile** | Classification of why a student gets answers wrong (concept gap, careless, time pressure, etc.) |
| **Time Behavior Model** | Analysis of how a student allocates time across a test |
| **Confidence Estimator** | Inference of how certain a student is in their answers based on behavioral signals |
| **Event Sourcing** | Architecture pattern where all profile changes are stored as immutable events |
| **Grounded Generation** | AI responses that are traceable to specific structured data, not hallucinated |
| **Bounded Context** | A self-contained domain within the system with clear boundaries and interfaces |
| **Signal Extraction** | The process of deriving structured data from unstructured interactions (chat messages) |

---

## Appendix C: Architecture Integration Summary

This document represents a synthesis of two design approaches, taking the best elements of each.

### What We Kept from AWS Architecture (Original HLD)

| Component | Why We Kept It | Section |
|---|---|---|
| **AWS Infrastructure** | Production-grade, enterprise-ready, Sydney region for NSW market | §7 |
| **Lambda + API Gateway** | Serverless scaling, cost-effective at MVP and scale | §7 |
| **RDS Aurora Serverless v2** | Auto-scaling ACID database with JSONB flexibility | §7 |
| **ElastiCache (Redis)** | Essential at scale for session state, caching | §7 |
| **Privacy & Compliance** | Australian Privacy Act compliance, GDPR-ready | §9 |
| **Question Bank Strategy** | Sourcing, QA process, skill taxonomy | §10 |
| **Monitoring (CloudWatch, X-Ray)** | Production observability, debugging | §11 |
| **Testing Strategy** | Comprehensive test pyramid with AI golden datasets | §12 |
| **Cost Management** | Rate limiting, quotas, graceful degradation | §8 |
| **WebSocket for Timer** | Existing proven approach for test timer sync | §3 |

### What We Integrated from Conversation Architecture (v2)

| Component | Why We Added It | Implementation | Section |
|---|---|---|---|
| **3-Tier Memory System** | Enables natural multi-turn conversations across sessions | RDS + ElastiCache + Learning DNA | §5.6 |
| **Agent State Machine** | Production-ready lifecycle management, error recovery | 4 states tracked in Redis + RDS | §5.8 |
| **Token Budget Management** | Explicit allocation prevents context overflow | Sliding window with summarization | §5.7 |
| **Prompt Caching** | 29% cost reduction via Anthropic cache_control | Applied to system + grounding data | §5.7 |
| **Cross-Session Recall** | Parents can reference past conversations naturally | conversation_memory table + topic extraction | §5.9 |
| **Topic Detection** | Refresh grounding data on topic switches | Keyword-based classification | §5.9 |
| **SSE Streaming** | Responsive UX for AI responses | ALB + Lambda streaming response | §5.10 |
| **Model Routing** | 40-60% savings on background tasks | Sonnet for chat, Haiku for extraction | §5.11 |
| **Signal Extraction** | Conversation → profile feedback loop | Async SQS jobs after each turn | §5.6 |
| **Session Persistence** | Browser close doesn't lose conversation | Server-authoritative sessions in RDS | §5.9 |

### Key Architectural Decisions

| Decision | Rationale | Trade-off |
|---|---|---|
| **AWS over Vercel** | Enterprise scalability, compliance, team expertise | More infrastructure complexity |
| **Lambda over ECS** | Cost-effective for MVP, auto-scaling | Cold starts (mitigated with provisioned concurrency) |
| **Keep Redis** | Essential for conversation state, not just MVP optimization | Additional operational complexity (acceptable) |
| **SSE + WebSocket** | Right tool for each job (streaming vs bidirectional) | Two patterns to maintain (worth it) |
| **Python + Node.js** | Python for ML/data, Node.js for API/streaming | Two runtimes (necessary for ecosystem strengths) |
| **3-Tier Memory** | Balances cost (summarization) with UX (continuity) | Complexity in context building (managed) |
| **Anthropic or Bedrock** | Flexibility for direct API or AWS-integrated path | Abstraction layer (thin, acceptable) |

### Cost Impact Analysis

**Original AWS Design (100 users):**
- Infrastructure: $118/month
- AI (range): $60-300/month
- **Total: $178-418/month** (high variance)

**Integrated Design (100 users):**
- Infrastructure: $159/month (+$41 for conversation pipeline)
- AI (with caching + routing): $162/month
- **Total: $321/month** (predictable)

**At 1,000 users:**
- Infrastructure: ~$350/month (auto-scaling)
- AI: ~$1,622/month (prompt caching + routing)
- **Total: ~$1,972/month**

**Savings from Integration:**
- Prompt caching: -29% on input tokens = **~$663/month saved at 1,000 users**
- Model routing: Haiku for background tasks = **~$275/month saved at 1,000 users**
- **Combined: ~$938/month saved** vs naive all-Sonnet approach

### Implementation Complexity Comparison

| Aspect | AWS-Only (Original) | With Conversation Architecture | Assessment |
|---|---|---|---|
| Database schema | Moderate (8 tables) | Higher (12 tables) | +4 tables for conversations, manageable |
| Lambda functions | Simple (6 functions) | Higher (10 functions) | +4 for conversation pipeline, necessary |
| Data stores | 2 (RDS + Redis) | 2 (same) | No change |
| API patterns | REST + WebSocket | REST + WebSocket + SSE | +1 pattern, well-justified |
| AI integration | Straightforward | Sophisticated | Context building complex, well-documented |
| State management | Simple | State machine | More robust, worth it |
| Token management | Mentioned | Explicit budgets | Better cost control |
| **Overall** | **Simpler** | **More sophisticated** | **Necessary for product differentiation** |

### Why This Synthesis Works

1. **Product Requirement Driven**: The "conversation as interface" differentiator *requires* the sophisticated memory and state management from v2.

2. **Infrastructure-Appropriate**: AWS handles the conversation complexity well (ElastiCache for state, SQS for async jobs, Lambda for streaming).

3. **Cost-Conscious**: The added complexity pays for itself via prompt caching and model routing.

4. **Maintainable**: Clear bounded contexts, well-documented patterns, existing AWS expertise transferable.

5. **Scalable**: All components scale independently (Lambda auto-scales, RDS scales ACU, ElastiCache can cluster).

6. **MVP-Ready**: Can launch with all features; sophistication is in the architecture, not the deployment process.

---

## Appendix D: Implementation Checklist

### Pre-Development

- [ ] Secure domain: edulens.com.au
- [ ] Set up AWS account (ap-southeast-2 region)
- [ ] Register business: EduLens Pty Ltd
- [ ] Obtain ABN for invoicing
- [ ] Draft privacy policy (legal review)
- [ ] Draft terms of service (legal review)
- [ ] Set up GitHub organization
- [ ] Provision development environments (dev, staging, prod)

### Week 1-2: Foundation

- [ ] Set up AWS infrastructure with CDK
  - [ ] VPC, subnets, security groups
  - [ ] RDS Aurora Serverless v2
  - [ ] ElastiCache Redis
  - [ ] S3 buckets (user data, exports, backups)
  - [ ] Secrets Manager (API keys, DB creds)
- [ ] Set up CI/CD pipeline (GitHub Actions + CDK)
- [ ] Implement authentication (NextAuth.js)
- [ ] Create database schema (Prisma migrations)
- [ ] Set up monitoring (CloudWatch dashboards, alarms)

### Week 3-4: Test Engine

- [ ] Build question bank admin interface
- [ ] Implement question CRUD API
- [ ] Source first 100 questions (licensed or commissioned)
- [ ] Build test session API (create, get, submit answers)
- [ ] Implement timer state machine
- [ ] Build WebSocket handler for real-time timer
- [ ] Implement auto-scoring logic
- [ ] Write unit tests (timer, scoring)

### Week 5-6: Profile Engine

- [ ] Implement event sourcing (events table)
- [ ] Build skill graph data model
- [ ] Implement mastery calculation (Bayesian)
- [ ] Implement error classification (heuristics)
- [ ] Build profile snapshot generator
- [ ] Implement profile API (get current, get history)
- [ ] Write unit tests (mastery calculation, error classification)

### Week 7-9: AI Agents (Core)

- [ ] Set up Claude API integration (Anthropic SDK or Bedrock)
- [ ] Implement guardrails layer (pre/post validation)
- [ ] Build context builder with token budget management
- [ ] Implement prompt caching (cache_control)
- [ ] Build Student Explanation Agent (Sonnet)
- [ ] Build Parent Insight Agent (Sonnet)
- [ ] Create golden dataset (50 test cases)
- [ ] Implement rate limiting (Redis token bucket)
- [ ] Set up cost monitoring (CloudWatch custom metrics)
- [ ] Write AI agent tests (golden dataset, hallucination detection)

### Week 10-11: Conversation Architecture

- [ ] Create conversation memory tables (chat_messages, conversation_memory)
- [ ] Implement 3-tier memory system
  - [ ] Tier 1: Message storage with ElastiCache
  - [ ] Tier 2: Session summarization (Lambda + Haiku)
  - [ ] Tier 3: Insight promotion to Learning DNA
- [ ] Build agent state machine (4 states)
- [ ] Implement state persistence (Redis + RDS)
- [ ] Build cross-session recall system
- [ ] Implement topic detection & context switching
- [ ] Set up SSE streaming (ALB + Lambda streaming response)
- [ ] Build model routing layer (Sonnet vs Haiku)
- [ ] Implement signal extraction pipeline (SQS jobs)
- [ ] Create conversation summarizer Lambda
- [ ] Create insight promoter Lambda
- [ ] Write conversation architecture tests

### Week 10: Parent Dashboard + Landing

- [ ] Build parent dashboard UI (Next.js)
  - [ ] Test history list
  - [ ] Skill radar chart
  - [ ] Basic trend chart
  - [ ] Recent test results
- [ ] Build parent AI chat UI
  - [ ] Chat interface with suggested questions
  - [ ] Grounding references display
- [ ] Build landing page
  - [ ] Hero section (value proposition)
  - [ ] Feature highlights
  - [ ] Pricing preview
  - [ ] Signup form
- [ ] Ensure WCAG 2.1 AA compliance
  - [ ] Keyboard navigation
  - [ ] Screen reader support
  - [ ] Color contrast validation
  - [ ] Alt text for images

### Week 11: Cold Start + Engagement

- [ ] Build onboarding questionnaire
- [ ] Implement first-test guidance (adaptive system prompts)
- [ ] Create demo mode (sample student data)
- [ ] Implement student engagement mechanics
  - [ ] Review prompts after test
  - [ ] Understanding points system
  - [ ] Progress badges
- [ ] Build student chat UI
  - [ ] Question review interface
  - [ ] Socratic conversation display

### Week 12: Privacy + Cost Controls

- [ ] Implement consent flow (checkboxes, storage)
- [ ] Build data export function (JSON format, presigned S3 URL)
- [ ] Build data deletion workflow (soft + hard delete)
- [ ] Implement data retention policy (automated cleanup)
- [ ] Set up audit logging (all profile access)
- [ ] Implement AI cost controls
  - [ ] Response caching (common queries)
  - [ ] Model tiering (Haiku vs Sonnet)
  - [ ] Daily cost quota alarms
- [ ] Create privacy policy page
- [ ] Create terms of service page

### Week 13-14: Testing + Bug Fixes

- [ ] Run full test suite (unit, integration, E2E)
- [ ] Load testing (100 concurrent users)
- [ ] Security audit (OWASP top 10)
- [ ] Accessibility audit (WCAG checklist)
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Bug triage and fixes
- [ ] Performance optimization (query optimization, caching)

### Week 15-16: Beta + Launch Prep

- [ ] Recruit 20 beta users (parents + students)
- [ ] Beta testing period (2 weeks)
- [ ] Collect feedback (surveys, interviews)
- [ ] Iterate on UX issues
- [ ] Finalize question bank (300 questions approved)
- [ ] Set up production monitoring
- [ ] Create runbook (incident response procedures)
- [ ] Launch announcement (email list, social media)
- [ ] **GO LIVE** 🚀

### Post-Launch (Month 1)

- [ ] Monitor metrics daily (CloudWatch dashboards)
- [ ] Weekly user interviews (5-10 users)
- [ ] Daily bug triage
- [ ] A/B test: student engagement prompts (2 variants)
- [ ] Pricing validation experiment (fake door test)
- [ ] Iterate based on feedback
- [ ] Prepare Phase 1.5 roadmap

---

*This document is the architectural companion to [AI-EDU-UI-Mockup.html](./AI-EDU-UI-Mockup.html), which demonstrates the user-facing design.*

---

## Appendix E: Migration & Phasing Strategy

For teams building this system, here's guidance on how to phase implementation to balance speed and sophistication.

### Phased Rollout Approach

#### Phase 1A: Basic Conversation (Weeks 7-9)
**What to build:**
- Single-turn parent chat (no memory)
- Student explanation chat (question-scoped)
- Basic guardrails
- Sonnet for all tasks

**Skip for now:**
- Multi-turn memory
- State machine
- Prompt caching
- Model routing
- Cross-session recall

**Result:** Working AI chat in 3 weeks, validates core UX.

**Limitations:**
- Each message is isolated (no "last time we talked...")
- Higher AI costs (~$300/month at 100 users)
- No session recovery if browser closes
- No topic awareness

#### Phase 1B: Conversation Polish (Weeks 10-11)
**Add:**
- 3-tier memory system
- Agent state machine
- SSE streaming
- Session persistence

**Still skip:**
- Cross-session recall (Tier 2 memory populated but not used)
- Topic detection (general grounding only)
- Model routing (still all-Sonnet)
- Prompt caching (enable later)

**Result:** Multi-turn works, UX is polished, sessions persist.

**Cost:** Still ~$300/month AI at 100 users.

#### Phase 1C: Cost Optimization (Week 12-15)
**Add:**
- Prompt caching (cache_control)
- Model routing (Haiku for background)
- Cross-session recall
- Topic detection

**Result:** Full conversation architecture, optimized costs.

**Cost:** ~$162/month AI at 100 users (46% reduction).

### When to Skip Conversation Architecture Entirely

**Skip if:**
- Building a quick POC (< 4 weeks)
- Validating demand only (will rebuild after validation)
- Budget requires simplest possible MVP

**Minimum viable conversation:**
```typescript
// Single-turn, no memory
async function chat(message: string, studentId: string) {
  const profile = await getProfile(studentId);
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: message }],
    system: buildSystemPrompt(profile),
  });
  return response.content[0].text;
}
```

**Trade-offs:**
- ✅ Ships in 1 week
- ✅ Validates if parents use AI chat at all
- ❌ Every question re-explains context ("As I mentioned before...")
- ❌ Can't reference past conversations
- ❌ 3x higher AI costs
- ❌ Poor UX for multi-turn

**When this is acceptable:** Pre-seed startups validating demand.

### When Conversation Architecture is Essential

**Must have if:**
- Your differentiation is "conversation as interface" (like EduLens)
- Users will have 5+ turn conversations (common in education/support)
- Budget requires AI cost optimization at scale
- Product needs cross-session context ("Last time you asked about...")

**Evidence this is needed for EduLens:**
- Product positioning: "talk to a knowledgeable teacher"
- Expected behavior: Parent asks "Is she improving?" (requires historical context)
- Cost sensitivity: AI will be largest variable cost
- Competitive moat: Conversation quality matters

### Implementation Priority Matrix

| Feature | Complexity | Cost Savings | UX Impact | Priority |
|---|---|---|---|---|
| **Multi-turn (Tier 1 memory)** | Medium | Low | High | **P0** - Core UX |
| **Session persistence** | Low | Low | High | **P0** - Prevents data loss |
| **SSE streaming** | Medium | Low | High | **P0** - Responsive feel |
| **Agent state machine** | Medium | Low | Medium | **P1** - Ops quality |
| **Prompt caching** | Low | High | Low | **P1** - Easy win |
| **Model routing** | Medium | High | Low | **P1** - Cost control |
| **Tier 2 memory (summaries)** | High | Low | Medium | **P2** - Nice to have |
| **Cross-session recall** | High | Low | High | **P2** - Quality boost |
| **Topic detection** | Medium | Medium | Medium | **P3** - Refinement |

**Recommendation:**
- **Week 7-9:** Build P0 features (core conversation)
- **Week 10-11:** Add P1 features (caching, routing, state machine)
- **Week 12-15:** Add P2 features if time allows
- **Post-launch:** Add P3 features based on user feedback

### Code Reuse: Vercel → AWS Migration Path

If you start with the simpler Vercel approach (v2) and later migrate to AWS:

**What transfers directly:**
- All React/Next.js frontend code
- Conversation logic (context building, token budgets)
- AI integration (Anthropic SDK works on AWS Lambda)
- Data models (Prisma schema portable)

**What needs adaptation:**
- Deployment: Vercel → AWS Amplify or Lambda
- SSE: Native Next.js streaming → Lambda streaming response with ALB
- Database: Vercel Postgres → RDS Aurora
- Background jobs: Vercel Cron → EventBridge + Lambda

**Migration effort:** ~2-3 weeks for experienced team.

**When to migrate:** When you hit Vercel limits (>10K users) or need enterprise features (VPC, compliance, custom infra).

---

*Version 2.1 integrates comprehensive conversation architecture (3-tier memory, state machine, SSE streaming, prompt caching, model routing) with production-grade AWS infrastructure. This synthesis balances sophisticated UX requirements with enterprise scalability.*
