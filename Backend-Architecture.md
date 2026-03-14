# EduLens Backend Architecture

> **Version:** 1.0 | **Status:** Design Phase
> **Platform:** AWS Serverless | **Languages:** Node.js (TypeScript) + Python

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Service Boundaries](#2-service-boundaries)
3. [Project Structure](#3-project-structure)
4. [API Design](#4-api-design)
5. [Data Layer](#5-data-layer)
6. [Integration Patterns](#6-integration-patterns)
7. [Deployment Overview](#7-deployment-overview)
8. [Development Workflow](#8-development-workflow)

---

## 1. Architecture Overview

### High-Level Backend Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY LAYER                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  API Gateway     │  │  API Gateway     │  │  Application     │  │
│  │  REST API        │  │  WebSocket API   │  │  Load Balancer   │  │
│  │  (CRUD)          │  │  (Timer Sync)    │  │  (SSE Streaming) │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼──────────────────────┼──────────────────────┼───────────┘
            │                      │                      │
┌───────────▼──────────────────────▼──────────────────────▼───────────┐
│                       LAMBDA APPLICATION LAYER                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Test Engine Service                       │   │
│  │  Languages: Node.js (TypeScript)                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ Session API  │  │ Timer WS     │  │ Scoring      │      │   │
│  │  │ Handler      │  │ Handler      │  │ Engine       │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Profile Engine Service                     │   │
│  │  Languages: Python                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ Skill Graph  │  │ Error        │  │ Time         │      │   │
│  │  │ Calculator   │  │ Classifier   │  │ Analyzer     │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 Conversation Engine Service                  │   │
│  │  Languages: Node.js (TypeScript)                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ Chat API     │  │ Context      │  │ Guardrails   │      │   │
│  │  │ (SSE)        │  │ Builder      │  │ Layer        │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                Background Jobs (SQS Triggered)               │   │
│  │  Languages: Python                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ Conversation │  │ Insight      │  │ Signal       │      │   │
│  │  │ Summarizer   │  │ Promoter     │  │ Extractor    │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Admin Service                            │   │
│  │  Languages: Node.js (TypeScript)                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ Question     │  │ Bulk Import  │  │ Analytics    │      │   │
│  │  │ CRUD         │  │ Handler      │  │ Generator    │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
┌──────────────────────────────────▼───────────────────────────────────┐
│                           DATA LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ RDS Aurora   │  │ ElastiCache  │  │ DynamoDB     │              │
│  │ PostgreSQL   │  │ Redis        │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ S3           │  │ SQS          │  │ EventBridge  │              │
│  │              │  │              │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

### Technology Choices

| Layer | Technology | Rationale |
|---|---|---|
| **API Runtime** | Node.js 20 (TypeScript) | Fast execution, excellent AWS SDK support, type safety |
| **ML/Data Processing** | Python 3.12 | Superior libraries for Bayesian calculations, data analysis |
| **API Framework** | Express.js (for local dev) | Standard, well-understood, easy testing |
| **Lambda Framework** | AWS Lambda Web Adapter / Native handlers | Native performance, minimal cold start |
| **ORM** | Prisma (Node.js), SQLAlchemy (Python) | Type-safe, migrations, cross-language consistency |
| **Validation** | Zod (TypeScript), Pydantic (Python) | Runtime validation, type generation |
| **Testing** | Jest (TS), Pytest (Python) | Industry standard, excellent tooling |
| **IaC** | AWS CDK (TypeScript) | Type-safe infrastructure, reusable constructs |

---

## 2. Service Boundaries

### Service Breakdown

Each service is independently deployable with clear ownership and boundaries.

#### Service 1: Test Engine Service

**Responsibility:** Manage test sessions, timer state, scoring

**Language:** Node.js (TypeScript)

**Owned Resources:**
- Lambda: `test-engine-api-*` (REST handlers)
- Lambda: `test-engine-ws-*` (WebSocket handlers)
- Lambda: `test-engine-scoring` (Auto-scoring)
- DynamoDB: `timer-connections` (WebSocket connection tracking)

**Exposed APIs:**
- `POST /api/tests/sessions` - Create test session
- `GET /api/tests/sessions/:id` - Get session state
- `PATCH /api/tests/sessions/:id/answers` - Submit answer
- `POST /api/tests/sessions/:id/submit` - Submit test
- `GET /api/tests/sessions/:id/results` - Get results
- WebSocket: `wss://api/timer/:sessionId` - Timer sync

**Data Dependencies:**
- Reads: `questions`, `tests`
- Writes: `test_sessions`, `session_responses`
- Publishes Events: `test_completed`, `question_answered`

**External Dependencies:**
- Profile Engine (via Event Bus - async)

---

#### Service 2: Profile Engine Service

**Responsibility:** Calculate Learning DNA, classify errors, analyze behavior

**Language:** Python 3.12

**Owned Resources:**
- Lambda: `profile-engine-calculator` (Profile updates)
- Lambda: `profile-engine-classifier` (Error classification)
- Lambda: `profile-engine-analyzer` (Time behavior analysis)

**Exposed APIs:**
- `GET /api/students/:id/profile` - Get current profile
- `GET /api/students/:id/profile/history` - Get profile snapshots
- `GET /api/students/:id/profile/trends` - Get trend analysis
- Internal: `POST /internal/profile/calculate` - Trigger recalculation

**Data Dependencies:**
- Reads: `events`, `test_sessions`, `session_responses`, `students`
- Writes: `student_profiles`, `profile_snapshots`, `events`

**External Dependencies:**
- None (pure calculation from events)

---

#### Service 3: Conversation Engine Service

**Responsibility:** AI conversations, context building, streaming

**Language:** Node.js (TypeScript)

**Owned Resources:**
- Lambda: `conversation-engine-api` (Chat API - REST)
- Lambda: `conversation-engine-stream` (SSE streaming)
- Lambda: `conversation-engine-state` (State machine manager)

**Exposed APIs:**
- `POST /api/chat/student/sessions` - Start student chat
- `POST /api/chat/student/sessions/:id/messages` - Send student message
- `GET /api/chat/student/sessions/:id/messages` - Get history
- `POST /api/chat/parent/sessions` - Start parent chat
- `POST /api/chat/parent/sessions/:id/messages` - Send parent message (SSE)
- `GET /api/chat/sessions/:id/state` - Get agent state

**Data Dependencies:**
- Reads: `chat_sessions`, `chat_messages`, `student_profiles`, `questions`, `test_sessions`, `conversation_memory`
- Writes: `chat_sessions`, `chat_messages`
- Publishes Events: `chat_message_sent`, `chat_understanding_confirmed`

**External Dependencies:**
- Claude API (Anthropic or Bedrock)
- Profile Engine (read profile data)
- Background Jobs (via SQS - signal extraction)

---

#### Service 4: Background Jobs Service

**Responsibility:** Async processing, summarization, insight extraction

**Language:** Python 3.12

**Owned Resources:**
- Lambda: `job-conversation-summarizer` (SQS trigger)
- Lambda: `job-insight-promoter` (SQS trigger)
- Lambda: `job-signal-extractor` (SQS trigger)
- Lambda: `job-profile-snapshotter` (EventBridge schedule)
- SQS Queues: `conversation-jobs`, `insight-jobs`, `signal-jobs`

**No Public APIs** (SQS triggered only)

**Data Dependencies:**
- Reads: `chat_sessions`, `chat_messages`, `student_profiles`
- Writes: `conversation_memory`, `student_profiles`, `events`

**External Dependencies:**
- Claude API (for summarization - Haiku model)

---

#### Service 5: Admin Service

**Responsibility:** Question management, bulk operations, analytics

**Language:** Node.js (TypeScript)

**Owned Resources:**
- Lambda: `admin-api-*` (CRUD handlers)
- Lambda: `admin-bulk-import` (S3 trigger)
- Lambda: `admin-analytics` (Analytics generation)

**Exposed APIs:**
- `GET /api/admin/questions` - List questions
- `POST /api/admin/questions` - Create question
- `PUT /api/admin/questions/:id` - Update question
- `DELETE /api/admin/questions/:id` - Delete question
- `POST /api/admin/questions/import` - Bulk import
- `GET /api/admin/questions/:id/stats` - Question stats
- `GET /api/admin/analytics/dashboard` - System analytics

**Data Dependencies:**
- Reads: `questions`, `test_sessions`, `session_responses`
- Writes: `questions`

**External Dependencies:**
- S3 (bulk import files)

---

## 3. Project Structure

### Repository Layout

```
edulens-backend/
├── README.md
├── package.json                    # Root workspace config (npm workspaces)
├── tsconfig.base.json              # Shared TypeScript config
├── .eslintrc.js                    # Shared linting config
├── .prettierrc                     # Code formatting
├── jest.config.base.js             # Shared test config
│
├── packages/
│   ├── shared/                     # Shared utilities and types
│   │   ├── common/                 # Common utilities (Node.js + Python)
│   │   │   ├── src/
│   │   │   │   ├── types/          # Shared TypeScript types
│   │   │   │   ├── constants/      # Constants, enums
│   │   │   │   ├── errors/         # Custom error classes
│   │   │   │   └── utils/          # Utility functions
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── database/               # Database layer (Prisma)
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma   # Database schema
│   │   │   │   ├── migrations/     # Migration history
│   │   │   │   └── seed.ts         # Seed data
│   │   │   ├── src/
│   │   │   │   ├── client.ts       # Prisma client singleton
│   │   │   │   ├── redis.ts        # Redis client singleton
│   │   │   │   └── repositories/   # Data access patterns
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   └── python-common/          # Python shared utilities
│   │       ├── src/
│   │       │   ├── models/         # SQLAlchemy models
│   │       │   ├── types/          # Pydantic models
│   │       │   ├── errors/         # Exception classes
│   │       │   └── utils/          # Utility functions
│   │       ├── setup.py
│   │       └── requirements.txt
│   │
│   └── aws-infra/                  # AWS CDK infrastructure
│       ├── bin/
│       │   └── app.ts              # CDK app entry point
│       ├── lib/
│       │   ├── stacks/
│       │   │   ├── networking-stack.ts     # VPC, subnets, security groups
│       │   │   ├── data-stack.ts           # RDS, ElastiCache, DynamoDB
│       │   │   ├── api-stack.ts            # API Gateway, ALB
│       │   │   ├── lambda-stack.ts         # Lambda functions
│       │   │   ├── jobs-stack.ts           # SQS, EventBridge
│       │   │   └── monitoring-stack.ts     # CloudWatch, alarms
│       │   ├── constructs/
│       │   │   ├── lambda-function.ts      # Reusable Lambda construct
│       │   │   ├── api-endpoint.ts         # API Gateway endpoint construct
│       │   │   └── job-queue.ts            # SQS queue construct
│       │   └── config/
│       │       ├── dev.ts                  # Dev environment config
│       │       ├── staging.ts              # Staging config
│       │       └── prod.ts                 # Production config
│       ├── package.json
│       ├── tsconfig.json
│       └── cdk.json
│
├── services/
│   ├── test-engine/                # Test Engine Service
│   │   ├── src/
│   │   │   ├── handlers/           # Lambda handlers
│   │   │   │   ├── sessions/
│   │   │   │   │   ├── create.ts
│   │   │   │   │   ├── get.ts
│   │   │   │   │   ├── submit-answer.ts
│   │   │   │   │   ├── submit-test.ts
│   │   │   │   │   └── get-results.ts
│   │   │   │   ├── websocket/
│   │   │   │   │   ├── connect.ts
│   │   │   │   │   ├── disconnect.ts
│   │   │   │   │   ├── timer-sync.ts
│   │   │   │   │   └── heartbeat.ts
│   │   │   │   └── scoring/
│   │   │   │       └── auto-score.ts
│   │   │   ├── services/
│   │   │   │   ├── session-manager.ts
│   │   │   │   ├── timer-service.ts
│   │   │   │   ├── scoring-service.ts
│   │   │   │   └── signal-extractor.ts
│   │   │   ├── models/
│   │   │   │   ├── session.ts
│   │   │   │   ├── timer-state.ts
│   │   │   │   └── response.ts
│   │   │   └── validators/
│   │   │       ├── session-validators.ts
│   │   │       └── answer-validators.ts
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── fixtures/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── jest.config.js
│   │
│   ├── profile-engine/              # Profile Engine Service (Python)
│   │   ├── src/
│   │   │   ├── handlers/            # Lambda handlers
│   │   │   │   ├── calculate_profile.py
│   │   │   │   ├── get_profile.py
│   │   │   │   ├── get_history.py
│   │   │   │   └── get_trends.py
│   │   │   ├── services/
│   │   │   │   ├── skill_graph_calculator.py
│   │   │   │   ├── error_classifier.py
│   │   │   │   ├── time_analyzer.py
│   │   │   │   ├── confidence_estimator.py
│   │   │   │   └── event_processor.py
│   │   │   ├── models/
│   │   │   │   ├── learning_dna.py
│   │   │   │   ├── skill_node.py
│   │   │   │   └── error_pattern.py
│   │   │   └── algorithms/
│   │   │       ├── bayesian_mastery.py
│   │   │       └── irt_estimation.py
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── fixtures/
│   │   ├── requirements.txt
│   │   ├── requirements-dev.txt
│   │   └── pytest.ini
│   │
│   ├── conversation-engine/         # Conversation Engine Service
│   │   ├── src/
│   │   │   ├── handlers/
│   │   │   │   ├── student-chat/
│   │   │   │   │   ├── create-session.ts
│   │   │   │   │   ├── send-message.ts
│   │   │   │   │   └── get-history.ts
│   │   │   │   ├── parent-chat/
│   │   │   │   │   ├── create-session.ts
│   │   │   │   │   ├── send-message-stream.ts    # SSE streaming
│   │   │   │   │   ├── get-history.ts
│   │   │   │   │   └── resume-session.ts
│   │   │   │   └── state/
│   │   │   │       ├── get-state.ts
│   │   │   │       └── update-state.ts
│   │   │   ├── services/
│   │   │   │   ├── agents/
│   │   │   │   │   ├── student-agent.ts
│   │   │   │   │   ├── parent-agent.ts
│   │   │   │   │   └── agent-factory.ts
│   │   │   │   ├── context/
│   │   │   │   │   ├── context-builder.ts
│   │   │   │   │   ├── token-budget-manager.ts
│   │   │   │   │   ├── memory-manager.ts
│   │   │   │   │   └── topic-detector.ts
│   │   │   │   ├── guardrails/
│   │   │   │   │   ├── guardrail-layer.ts
│   │   │   │   │   ├── intent-classifier.ts
│   │   │   │   │   └── hallucination-detector.ts
│   │   │   │   ├── streaming/
│   │   │   │   │   ├── sse-stream.ts
│   │   │   │   │   └── event-formatter.ts
│   │   │   │   ├── state-machine/
│   │   │   │   │   ├── agent-state-machine.ts
│   │   │   │   │   └── state-store.ts
│   │   │   │   └── ai-client/
│   │   │   │       ├── anthropic-client.ts
│   │   │   │       ├── bedrock-client.ts
│   │   │   │       ├── model-router.ts
│   │   │   │       └── prompt-cache.ts
│   │   │   ├── models/
│   │   │   │   ├── conversation.ts
│   │   │   │   ├── message.ts
│   │   │   │   ├── agent-state.ts
│   │   │   │   └── context-window.ts
│   │   │   └── prompts/
│   │   │       ├── student-agent-prompt.ts
│   │   │       └── parent-agent-prompt.ts
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   ├── golden-dataset/          # AI agent golden tests
│   │   │   └── fixtures/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── jest.config.js
│   │
│   ├── background-jobs/             # Background Jobs Service (Python)
│   │   ├── src/
│   │   │   ├── handlers/
│   │   │   │   ├── conversation_summarizer.py
│   │   │   │   ├── insight_promoter.py
│   │   │   │   ├── signal_extractor.py
│   │   │   │   └── profile_snapshotter.py
│   │   │   ├── services/
│   │   │   │   ├── summarization_service.py
│   │   │   │   ├── insight_service.py
│   │   │   │   └── signal_service.py
│   │   │   └── models/
│   │   │       ├── conversation_summary.py
│   │   │       ├── insight.py
│   │   │       └── signal.py
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── pytest.ini
│   │
│   └── admin-service/               # Admin Service
│       ├── src/
│       │   ├── handlers/
│       │   │   ├── questions/
│       │   │   │   ├── list.ts
│       │   │   │   ├── create.ts
│       │   │   │   ├── update.ts
│       │   │   │   ├── delete.ts
│       │   │   │   └── get-stats.ts
│       │   │   ├── bulk/
│       │   │   │   ├── import-questions.ts
│       │   │   │   └── validate-import.ts
│       │   │   └── analytics/
│       │   │       ├── dashboard.ts
│       │   │       └── question-performance.ts
│       │   ├── services/
│       │   │   ├── question-service.ts
│       │   │   ├── import-service.ts
│       │   │   ├── analytics-service.ts
│       │   │   └── validation-service.ts
│       │   └── validators/
│       │       ├── question-validators.ts
│       │       └── import-validators.ts
│       ├── tests/
│       ├── package.json
│       ├── tsconfig.json
│       └── jest.config.js
│
├── scripts/
│   ├── setup-dev-env.sh            # Setup local development
│   ├── seed-database.ts            # Seed test data
│   ├── run-migrations.sh           # Run Prisma migrations
│   └── generate-types.sh           # Generate Prisma client + types
│
├── docs/
│   ├── api/                        # API documentation
│   │   ├── rest-api.md
│   │   ├── websocket-api.md
│   │   └── sse-streaming.md
│   ├── services/                   # Service documentation
│   │   ├── test-engine.md
│   │   ├── profile-engine.md
│   │   ├── conversation-engine.md
│   │   └── background-jobs.md
│   └── deployment/                 # Deployment guides
│       ├── local-development.md
│       ├── ci-cd.md
│       └── production-deployment.md
│
└── .github/
    └── workflows/
        ├── test-engine-ci.yml
        ├── profile-engine-ci.yml
        ├── conversation-engine-ci.yml
        ├── background-jobs-ci.yml
        ├── admin-service-ci.yml
        └── deploy-to-aws.yml
```

---

## 4. API Design

### API Contract Definitions

#### 4.1 REST API (Test Engine)

**Base URL:** `https://api.edulens.com.au/api`

**Authentication:** JWT Bearer token in `Authorization` header

##### Create Test Session

```typescript
// Request
POST /tests/sessions
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "test_id": "uuid",
  "student_id": "uuid"
}

// Response: 201 Created
{
  "session_id": "uuid",
  "test_id": "uuid",
  "student_id": "uuid",
  "status": "active",
  "started_at": "2026-03-13T10:00:00Z",
  "duration_seconds": 1800,
  "questions": [
    {
      "question_id": "uuid",
      "question_number": 1,
      "stem": "What is...",
      "options": ["A", "B", "C", "D"],
      "subject": "math",
      "difficulty": "medium"
    }
  ],
  "timer": {
    "started_at": "2026-03-13T10:00:00Z",
    "expires_at": "2026-03-13T10:30:00Z",
    "remaining_seconds": 1800
  }
}
```

##### Submit Answer

```typescript
// Request
PATCH /tests/sessions/:sessionId/answers
Content-Type: application/json

{
  "question_id": "uuid",
  "selected_option": "B",
  "timestamp": "2026-03-13T10:05:30Z",
  "time_spent_ms": 45000
}

// Response: 200 OK
{
  "success": true,
  "question_id": "uuid",
  "recorded_at": "2026-03-13T10:05:30Z"
}
```

##### Submit Test

```typescript
// Request
POST /tests/sessions/:sessionId/submit

// Response: 200 OK
{
  "session_id": "uuid",
  "completed_at": "2026-03-13T10:28:15Z",
  "total_score": 24,
  "total_questions": 35,
  "duration_seconds": 1695,
  "skill_breakdown": [
    {
      "category": "Reading",
      "correct": 8,
      "total": 10,
      "sub_skills": [
        {
          "skill": "Inference",
          "correct": 3,
          "total": 4,
          "mastery_delta": 0.02
        }
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

#### 4.2 WebSocket API (Timer Sync)

**Connection URL:** `wss://api.edulens.com.au/timer`

**Authentication:** Query parameter `?token={jwt_token}`

##### Connection Protocol

```typescript
// Client → Server: Connect
{
  "action": "connect",
  "session_id": "uuid"
}

// Server → Client: Connected
{
  "type": "connected",
  "session_id": "uuid",
  "connection_id": "uuid",
  "timer_state": {
    "started_at": "2026-03-13T10:00:00Z",
    "expires_at": "2026-03-13T10:30:00Z",
    "remaining_seconds": 1234,
    "status": "active"
  }
}

// Server → Client: Timer Tick (every 30s)
{
  "type": "timer_tick",
  "remaining_seconds": 1204,
  "status": "active"
}

// Client → Server: Heartbeat (every 30s)
{
  "action": "heartbeat",
  "session_id": "uuid"
}

// Server → Client: Timer Expired
{
  "type": "timer_expired",
  "session_id": "uuid",
  "message": "Time's up! Submitting test automatically."
}

// Client → Server: Disconnect
{
  "action": "disconnect"
}
```

#### 4.3 SSE API (AI Chat Streaming)

**Endpoint:** `POST /chat/parent/sessions/:sessionId/messages`

**Response Type:** `text/event-stream`

##### Streaming Protocol

```typescript
// Request
POST /chat/parent/sessions/:sessionId/messages
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "content": "Why is math low?"
}

// Response: 200 OK (streaming)
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: typing
data: {"status":"started"}

event: delta
data: {"text":"Looking"}

event: delta
data: {"text":" at"}

event: delta
data: {"text":" the"}

event: delta
data: {"text":" last"}

event: delta
data: {"text":" 3"}

event: delta
data: {"text":" tests"}

event: delta
data: {"text":","}

event: delta
data: {"text":" Mia"}

event: delta
data: {"text":" scored"}

event: delta
data: {"text":" 7"}

event: delta
data: {"text":"/"}

event: delta
data: {"text":"10"}

event: delta
data: {"text":" on"}

event: delta
data: {"text":" number"}

event: delta
data: {"text":" patterns"}

event: delta
data: {"text":"..."}

event: usage
data: {"input_tokens":5234,"output_tokens":187,"cache_read_tokens":4200,"cache_creation_tokens":0}

event: done
data: {"status":"complete","message_id":"uuid"}
```

#### 4.4 Internal APIs (Service-to-Service)

**Note:** These are not exposed publicly, only callable within VPC.

##### Profile Engine Internal API

```typescript
// Trigger profile recalculation
POST /internal/profile/calculate
X-Internal-Auth: {internal_token}

{
  "student_id": "uuid",
  "trigger": "test_completed",
  "event_ids": ["uuid1", "uuid2"]
}

// Response: 202 Accepted
{
  "job_id": "uuid",
  "status": "processing"
}
```

---

## 5. Data Layer

### 5.1 Database Schema (Prisma)

**File:** `packages/shared/database/prisma/schema.prisma`

```prisma
// Core entities
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      String   // "student" | "parent" | "admin"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  students  Student[]
  parentLinks ParentLink[]
}

model Student {
  id          String   @id @default(uuid())
  userId      String
  gradeLevel  Int
  learningDna Json     // Learning DNA JSONB
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user         User           @relation(fields: [userId], references: [id])
  testSessions TestSession[]
  chatSessions ChatSession[]
  events       Event[]

  @@index([userId])
}

// Test engine tables
model Test {
  id           String   @id @default(uuid())
  title        String
  subject      String
  durationSec  Int
  questionIds  String[] // Array of question IDs
  createdAt    DateTime @default(now())

  sessions TestSession[]
}

model Question {
  id               String   @id @default(uuid())
  stem             String
  options          String[] // ["A", "B", "C", "D"]
  correctAnswer    String
  explanation      String
  skillTags        String[] // ["reading.inference", "math.patterns"]
  difficulty       String   // "easy" | "medium" | "hard"
  distractorNotes  Json?
  createdAt        DateTime @default(now())

  @@index([difficulty])
  @@index([skillTags], type: Gin)
}

model TestSession {
  id          String    @id @default(uuid())
  studentId   String
  testId      String
  status      String    // "active" | "completed" | "expired"
  startedAt   DateTime
  completedAt DateTime?
  totalScore  Int?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  student    Student           @relation(fields: [studentId], references: [id])
  test       Test              @relation(fields: [testId], references: [id])
  responses  SessionResponse[]

  @@index([studentId, completedAt])
  @@index([status])
}

model SessionResponse {
  id             String    @id @default(uuid())
  sessionId      String
  questionId     String
  selectedAnswer String
  isCorrect      Boolean
  timeSpentMs    Int
  answerChanges  Json[]    // History of answer changes
  errorType      String?   // "concept_gap" | "careless_error" | etc.
  createdAt      DateTime  @default(now())

  session TestSession @relation(fields: [sessionId], references: [id])

  @@index([sessionId])
  @@index([questionId])
  @@index([errorType])
}

// Conversation tables
model ChatSession {
  id              String    @id @default(uuid())
  studentId       String
  agentType       String    // "student_explanation" | "parent_insight"
  parentId        String?
  questionId      String?
  testSessionId   String?
  status          String    @default("active") // "active" | "summarized" | "archived"
  topicSummary    String?
  currentTopic    String?
  totalTokens     Int       @default(0)
  turnCount       Int       @default(0)
  agentState      String    @default("idle")
  agentStateEnteredAt DateTime?
  agentMetadata   Json      @default("{}")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  closedAt        DateTime?

  student  Student       @relation(fields: [studentId], references: [id])
  messages ChatMessage[]

  @@index([studentId, createdAt])
  @@index([status])
  @@index([agentState])
}

model ChatMessage {
  id         String   @id @default(uuid())
  sessionId  String
  role       String   // "user" | "assistant" | "system"
  content    String
  tokenCount Int
  metadata   Json     @default("{}")
  createdAt  DateTime @default(now())

  session ChatSession @relation(fields: [sessionId], references: [id])

  @@index([sessionId, createdAt])
}

model ConversationMemory {
  id                 String   @id @default(uuid())
  studentId          String
  sessionId          String
  agentType          String
  summary            String
  keyTopics          String[]
  insightsExtracted  Json     @default("[]")
  parentQuestions    String[]
  satisfactionSignal String?
  turnCount          Int
  createdAt          DateTime @default(now())

  @@index([studentId, createdAt])
  @@index([keyTopics], type: Gin)
}

// Event sourcing
model Event {
  id        String   @id @default(uuid())
  studentId String
  eventType String
  timestamp DateTime @default(now())
  payload   Json

  student Student @relation(fields: [studentId], references: [id])

  @@index([studentId, timestamp])
  @@index([eventType])
}

// Profile snapshots
model ProfileSnapshot {
  id        String   @id @default(uuid())
  studentId String
  snapshot  Json     // Full Learning DNA snapshot
  createdAt DateTime @default(now())

  @@index([studentId, createdAt])
}
```

### 5.2 Redis Data Structures

**Key Patterns:**

```typescript
// Session state (test timer)
Key: `session:${sessionId}:timer`
Type: Hash
TTL: 2 hours
Fields:
  - started_at: ISO timestamp
  - duration_sec: number
  - paused_at: ISO timestamp | null
  - elapsed_sec: number

// Agent state (conversation)
Key: `agent:state:${sessionId}`
Type: String (JSON)
TTL: 35 minutes
Value: AgentStateContext

// Conversation messages cache (last 10 turns)
Key: `session:${sessionId}:messages`
Type: String (JSON array)
TTL: 1 hour
Value: Message[]

// Response cache (AI responses)
Key: `response_cache:${query_hash}:${profile_hash}`
Type: String
TTL: 24 hours
Value: Response text

// Rate limiting
Key: `rate_limit:${user_id}:${date}`
Type: Hash
TTL: 2 days
Fields:
  - messages: count
  - tokens: count
```

### 5.3 DynamoDB Schema

**Table:** `timer-connections`

```typescript
{
  "TableName": "timer-connections",
  "KeySchema": [
    { "AttributeName": "connectionId", "KeyType": "HASH" }
  ],
  "AttributeDefinitions": [
    { "AttributeName": "connectionId", "AttributeType": "S" },
    { "AttributeName": "sessionId", "AttributeType": "S" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "sessionId-index",
      "KeySchema": [
        { "AttributeName": "sessionId", "KeyType": "HASH" }
      ]
    }
  ],
  "TimeToLiveSpecification": {
    "AttributeName": "ttl",
    "Enabled": true
  },
  "BillingMode": "PAY_PER_REQUEST"
}

// Item structure:
{
  "connectionId": "abc123",  // WebSocket connection ID
  "sessionId": "uuid",       // Test session ID
  "userId": "uuid",
  "connectedAt": 1234567890,
  "lastPingAt": 1234567890,
  "ttl": 1234569690          // Auto-delete after 2 hours
}
```

---

## 6. Integration Patterns

### 6.1 Service Communication

#### Pattern 1: Synchronous (HTTP)

**Use when:** Response needed immediately (< 1 second acceptable)

**Example:** Frontend → Test Engine → Get session state

```typescript
// conversation-engine → profile-engine (via internal API)
const profile = await fetch('http://profile-engine.internal/profiles/{studentId}', {
  headers: { 'X-Internal-Auth': internalToken }
});
```

#### Pattern 2: Asynchronous (Event Bus)

**Use when:** Fire-and-forget, multiple consumers, order doesn't matter

**Example:** Test completed → Profile Engine recalculates

```typescript
// Test Engine publishes event
await eventBridge.putEvents({
  Entries: [{
    Source: 'edulens.test-engine',
    DetailType: 'TestCompleted',
    Detail: JSON.stringify({
      studentId: 'uuid',
      sessionId: 'uuid',
      score: 24,
      totalQuestions: 35,
      eventIds: ['uuid1', 'uuid2']
    })
  }]
});

// Profile Engine subscribes to event
// (EventBridge rule triggers Lambda)
export const handler = async (event: EventBridgeEvent) => {
  const { studentId, eventIds } = event.detail;
  await recalculateProfile(studentId, eventIds);
};
```

#### Pattern 3: Job Queue (SQS)

**Use when:** Async processing, retry logic needed, order matters (FIFO)

**Example:** Conversation ends → Summarize → Extract insights

```typescript
// Conversation Engine publishes to SQS
await sqs.sendMessage({
  QueueUrl: process.env.CONVERSATION_JOBS_QUEUE_URL,
  MessageBody: JSON.stringify({
    jobType: 'summarize_session',
    sessionId: 'uuid',
    studentId: 'uuid'
  }),
  MessageGroupId: studentId, // FIFO ordering per student
  MessageDeduplicationId: `${sessionId}-${Date.now()}`
});

// Background Jobs service consumes from SQS
export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const job = JSON.parse(record.body);
    await summarizeSession(job.sessionId);
  }
};
```

### 6.2 Data Access Patterns

#### Pattern 1: Repository Pattern

**All database access goes through repositories**

```typescript
// packages/shared/database/src/repositories/session-repository.ts
export class SessionRepository {
  constructor(private prisma: PrismaClient, private redis: Redis) {}

  async getSession(sessionId: string): Promise<TestSession | null> {
    // Try cache first
    const cached = await this.redis.get(`session:${sessionId}`);
    if (cached) return JSON.parse(cached);

    // Cache miss: load from DB
    const session = await this.prisma.testSession.findUnique({
      where: { id: sessionId },
      include: { responses: true }
    });

    if (session) {
      await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));
    }

    return session;
  }

  async createSession(data: CreateSessionInput): Promise<TestSession> {
    const session = await this.prisma.testSession.create({ data });
    // No cache on create (will be cached on first read)
    return session;
  }
}
```

#### Pattern 2: Transaction Pattern

**Use Prisma transactions for multi-table writes**

```typescript
async submitTest(sessionId: string): Promise<TestResults> {
  return await prisma.$transaction(async (tx) => {
    // 1. Mark session complete
    const session = await tx.testSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    // 2. Create events
    await tx.event.create({
      data: {
        studentId: session.studentId,
        eventType: 'test_completed',
        timestamp: new Date(),
        payload: { sessionId, score: calculateScore(session) }
      }
    });

    // 3. Return results
    return calculateResults(session);
  });
}
```

### 6.3 Error Handling

**Standard error response format:**

```typescript
// packages/shared/common/src/errors/api-error.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

// Lambda error handler middleware
export function errorHandler(error: Error): APIGatewayProxyResult {
  if (error instanceof APIError) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      })
    };
  }

  // Unknown error
  console.error('Unhandled error:', error);
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    })
  };
}
```

---

## 7. Deployment Overview

> **Note:** For complete infrastructure details, CDK implementation, CI/CD pipelines, monitoring, and operational procedures, see [Deployment-Architecture.md](./Deployment-Architecture.md).

### 7.1 Lambda Function Naming Convention

```
{service}-{component}-{function}

Examples:
- test-engine-api-create-session
- test-engine-ws-connect
- profile-engine-calculator
- conversation-engine-stream
- job-conversation-summarizer
```

### 7.2 Environment Variables

**Core environment variables per Lambda:**

```yaml
# Common across all Lambdas
DATABASE_URL: ${ssm:/edulens/{stage}/database-url}
REDIS_HOST: ${ssm:/edulens/{stage}/redis-host}
JWT_SECRET: ${secretsmanager:edulens/{stage}/jwt-secret}
STAGE: dev | staging | prod
LOG_LEVEL: debug | info | warn | error
AWS_REGION: us-east-1

# Conversation Engine specific
ANTHROPIC_API_KEY: ${secretsmanager:edulens/{stage}/anthropic-api-key}
AI_PROVIDER: anthropic  # or "bedrock"

# Event-driven services
EVENT_BUS_NAME: edulens-event-bus-{stage}
```

### 7.3 Infrastructure Organization

The infrastructure is organized into logical AWS CDK stacks:

- **Network Stack**: VPC, subnets, security groups, VPC endpoints
- **Database Stack**: RDS Aurora, ElastiCache Redis, DynamoDB tables
- **API Stack**: API Gateway (REST), Lambda functions
- **WebSocket Stack**: WebSocket API Gateway, Lambda handlers
- **SSE Stack**: Application Load Balancer, Lambda functions
- **Jobs Stack**: SQS queues, EventBridge rules, Lambda processors
- **Monitoring Stack**: CloudWatch dashboards, alarms, X-Ray

**Multi-Environment Support:**
- `dev`: Cost-optimized, auto-pause enabled, single AZ
- `staging`: Production-like, multi-AZ, full monitoring
- `prod`: Full scale, multi-AZ, disaster recovery enabled

See [Deployment-Architecture.md](./Deployment-Architecture.md) for:
- Complete CDK stack implementations
- VPC and security group configurations
- IAM policies and roles
- Multi-environment deployment strategy
- CI/CD pipeline setup
- Monitoring and observability
- Cost optimization strategies

---

## 8. Development Workflow

### 8.1 Local Development Setup

```bash
# 1. Clone repository
git clone git@github.com:edulens/backend.git
cd backend

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your local config

# 4. Start local services (Docker Compose)
docker-compose up -d  # Starts PostgreSQL, Redis locally

# 5. Run database migrations
npm run db:migrate

# 6. Seed test data
npm run db:seed

# 7. Generate Prisma client
npm run generate:types

# 8. Start local API server (using SAM Local)
npm run dev:test-engine
npm run dev:conversation-engine
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: edulens_dev
      POSTGRES_USER: edulens
      POSTGRES_PASSWORD: devpassword
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  localstack:
    image: localstack/localstack:latest
    environment:
      SERVICES: s3,sqs,dynamodb,secretsmanager,ssm
      DEFAULT_REGION: ap-southeast-2
    ports:
      - '4566:4566'
    volumes:
      - localstack_data:/var/lib/localstack

volumes:
  postgres_data:
  redis_data:
  localstack_data:
```

### 8.2 Testing Strategy

**Test pyramid:**
- **70% Unit tests** - Pure functions, business logic
- **20% Integration tests** - API endpoints, database operations
- **10% E2E tests** - Full user flows

```bash
# Run all tests
npm test

# Run specific service tests
npm run test:test-engine
npm run test:profile-engine
npm run test:conversation-engine

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

**Example test structure:**

```typescript
// services/test-engine/tests/unit/scoring-service.test.ts
import { ScoringService } from '../../src/services/scoring-service';

describe('ScoringService', () => {
  describe('calculateScore', () => {
    it('should calculate correct score for all correct answers', () => {
      const responses = [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true }
      ];

      const score = ScoringService.calculateScore(responses);

      expect(score.correct).toBe(3);
      expect(score.total).toBe(3);
      expect(score.percentage).toBe(100);
    });

    it('should calculate skill breakdown correctly', () => {
      const responses = [
        { isCorrect: true, skillTags: ['reading.inference'] },
        { isCorrect: false, skillTags: ['reading.inference'] },
        { isCorrect: true, skillTags: ['math.patterns'] }
      ];

      const breakdown = ScoringService.calculateSkillBreakdown(responses);

      expect(breakdown['reading.inference']).toEqual({
        correct: 1,
        total: 2,
        percentage: 50
      });
      expect(breakdown['math.patterns']).toEqual({
        correct: 1,
        total: 1,
        percentage: 100
      });
    });
  });
});
```

### 8.3 CI/CD Overview

> **Note:** For complete CI/CD pipeline implementation, GitHub Actions workflows, deployment strategies, and rollback procedures, see [Deployment-Architecture.md](./Deployment-Architecture.md) Section 6.

**Pipeline stages:**

1. **PR Checks** (on pull_request)
   - Lint code
   - Type check
   - Run unit + integration tests
   - Security scan

2. **Deploy to Dev** (on push to develop)
   - Run all checks
   - Deploy infrastructure + application
   - Run smoke tests

3. **Deploy to Staging** (on push to main)
   - Run all checks + E2E tests
   - Deploy with blue-green strategy
   - Run load tests

4. **Deploy to Production** (manual approval)
   - Manual approval gate
   - Blue-green deployment with gradual rollout
   - Automatic rollback on errors

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # OIDC
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsRole
          aws-region: ap-southeast-2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build:test-engine

      - name: Deploy with CDK
        run: |
          cd packages/aws-infra
          npm run cdk deploy EduLens-prod-TestEngineStack -- --require-approval never
        env:
          STAGE: prod
```

### 8.4 Deployment Commands

> **Note:** For complete deployment process, infrastructure deployment, rollback procedures, and operational runbooks, see [Deployment-Architecture.md](./Deployment-Architecture.md) Section 13.

**Quick reference:**

```bash
# Build all services
npm run build

# Deploy to development
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (requires approval)
./scripts/deploy.sh production

# Rollback production
./scripts/rollback.sh production <version>
```

**Deployment strategy:**
- **Development**: Direct deployment, no approval needed
- **Staging**: Automated with full test suite
- **Production**: Blue-green deployment with gradual rollout (10% → 50% → 100%)
- **Rollback**: Automatic on errors, manual via scripts

---

## Summary

This backend architecture provides:

✅ **Clear service boundaries** - 5 independent services with defined responsibilities
✅ **Type-safe development** - TypeScript + Prisma + Zod for end-to-end type safety
✅ **Scalable infrastructure** - AWS Lambda auto-scales from 0 to thousands of requests
✅ **Cost-optimized** - Serverless pricing, efficient caching, model routing
✅ **Developer-friendly** - Local development with Docker, comprehensive testing
✅ **Production-ready** - Modular design, comprehensive API contracts, event-driven architecture

**Related Documentation:**
- **[Frontend-Architecture.md](./Frontend-Architecture.md)** - Next.js 14 frontend with SSE/WebSocket integration
- **[Deployment-Architecture.md](./Deployment-Architecture.md)** - AWS CDK infrastructure, CI/CD, monitoring, operations

**Implementation Order:**
1. **Phase 1**: Set up repository structure and shared packages
2. **Phase 2**: Test Engine Service (foundational, simplest)
3. **Phase 3**: Profile Engine Service (Python, data processing)
4. **Phase 4**: Conversation Engine Service (complex, AI integration)
5. **Phase 5**: Background Jobs Service (async processing)
6. **Phase 6**: Admin Service (internal tooling)

Each service can be developed and deployed independently, enabling parallel team work and incremental delivery.

---

**Document Version:** 1.0
**Last Updated:** March 2026
