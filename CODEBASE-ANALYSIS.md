# CODEBASE-ANALYSIS.md — EduLens Platform

**CONFIDENTIAL** — Full codebase analysis of the EduLens (AI-EDU) educational platform.
Generated: 2026-03-16

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend Services Deep Dive](#2-backend-services-deep-dive)
3. [Frontend Analysis](#3-frontend-analysis)
4. [Infrastructure](#4-infrastructure)
5. [Database Schema](#5-database-schema)
6. [API Surface](#6-api-surface)
7. [AI/ML Integration](#7-aiml-integration)
8. [Current State Assessment](#8-current-state-assessment)
9. [Deployment Pipeline](#9-deployment-pipeline)
10. [Security](#10-security)

---

## 1. Architecture Overview

### High-Level Architecture

EduLens is a serverless educational platform built on AWS, using a microservices architecture with Lambda functions behind API Gateway and ALB.

```
┌─────────────────────────────────────────────────────────┐
│                    edulens-frontend/                      │
│              Next.js 14 (App Router)                     │
│       Zustand · React Query · Recharts · Tailwind        │
└──────────────┬──────────────────────┬────────────────────┘
               │ REST (HTTPS)         │ SSE Streaming
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│   API Gateway (REST) │  │     ALB (Streaming Routes)   │
│   /auth/* /sessions/*│  │  /api/parent-chat/*/stream   │
│   /tests/* /admin/*  │  │  /api/student-chat/*/stream  │
│   /stages/* /contest*│  │                              │
└──────────┬───────────┘  └────────────┬─────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│                  AWS Lambda Functions (58)                │
│                                                          │
│  auth-service    │  test-engine      │  conversation-    │
│  (6 handlers)    │  (18 handlers)    │  engine           │
│                  │                   │  (10 handlers)    │
│  admin-service   │  profile-engine   │  background-jobs  │
│  (9 handlers)    │  (Python, 5 h.)   │  (Python, 5 h.)  │
│                  │                   │                   │
│  stage-registry  │  contest-service  │  db-migration     │
│  (9 handlers)    │  (11 handlers)    │  (1 handler)      │
└──────────┬───────┴──────┬────────────┴─────┬─────────────┘
           │              │                  │
           ▼              ▼                  ▼
┌───────────────┐ ┌─────────────┐ ┌──────────────────────┐
│ Aurora PG v2  │ │ ElastiCache │ │ AWS Bedrock (Claude)  │
│ (PostgreSQL)  │ │ Redis 7     │ │ Sonnet 4 + Haiku 4.5 │
└───────────────┘ └─────────────┘ └──────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  ┌──────────┐  ┌─────────────┐  ┌──────────────┐
  │ DynamoDB  │  │ SQS Queues  │  │ EventBridge  │
  │ (WS conn) │  │ (async jobs)│  │ (events)     │
  └──────────┘  └─────────────┘  └──────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14.1 (App Router), React 18, TypeScript 5.3 |
| State Management | Zustand 4.5, @tanstack/react-query 5.17 |
| UI/Styling | Tailwind CSS 3.4, Lucide React icons, Recharts 2.10 |
| Forms | react-hook-form 7.49, zod 3.22, @hookform/resolvers |
| Backend (Node.js) | TypeScript, esbuild bundling, postgres.js (raw SQL) |
| Backend (Python) | Python 3.x, SQLAlchemy 2.0, psycopg2, pydantic 1.x |
| Database | Aurora PostgreSQL Serverless v2, ElastiCache Redis 7, DynamoDB |
| AI/ML | AWS Bedrock — Claude Sonnet 4, Claude Haiku 4.5 |
| Infrastructure | AWS CDK (TypeScript), 8 stacks |
| Messaging | SQS (async jobs), EventBridge (cross-service events) |
| Real-time | WebSocket API Gateway (timer sync), SSE via ALB (chat streaming) |
| Auth | JWT (jsonwebtoken), bcrypt password hashing |

### Repository Structure

```
AI-EDU/
├── edulens-backend/
│   ├── packages/shared/
│   │   ├── common/          # Types, constants, errors, logger, validators
│   │   └── database/        # postgres.js client, Redis client, Prisma schema (docs only)
│   ├── services/
│   │   ├── auth-service/    # Authentication & user management
│   │   ├── test-engine/     # Adaptive testing, scoring, insights
│   │   ├── conversation-engine/  # AI chat (parent + student)
│   │   ├── profile-engine/  # Python — Bayesian mastery, error patterns
│   │   ├── background-jobs/ # Python — summarization & insight extraction
│   │   ├── admin-service/   # Question management, analytics, bulk ops
│   │   ├── stage-registry/  # Stage lifecycle, skill taxonomy, bridges
│   │   └── contest-service/ # Competitions CRUD, registration, ranking
│   ├── scripts/db-migration/  # SQL migrations + seed data
│   └── docker-compose.yml     # Local dev (PostgreSQL, Redis, LocalStack)
├── edulens-frontend/        # Next.js 14 application
├── edulens-infrastructure/  # AWS CDK stacks
├── local-backend-server.js  # Simple mock backend (port 3001)
├── local-full-backend-server.js  # Full backend proxy (port 3002)
└── CLAUDE.md                # Development instructions
```

---

## 2. Backend Services Deep Dive

### 2.1 Auth Service (`edulens-backend/services/auth-service/`)

**Purpose**: User authentication, registration, and parent-child student management.

**Handlers**:

| Handler | Path | Description |
|---------|------|-------------|
| `login.ts` | `POST /auth/login` | Email/password login, returns JWT |
| `register.ts` | `POST /auth/register` | Parent registration with email, name, password |
| `student-login.ts` | `POST /auth/student-login` | Student login via parent email + student name |
| `create-student.ts` | `POST /auth/students` | Create child student under parent account |
| `delete-student.ts` | `DELETE /auth/students/{studentId}` | Remove student (parent-owned) |
| `list-students.ts` | `GET /auth/students` | List students for authenticated parent |

**Libraries**:
- `lib/jwt.ts` — JWT token generation/verification using `jsonwebtoken`. Tokens include `userId`, `email`, `role`. Default expiry: 24h.
- `lib/password.ts` — bcrypt hashing with 10 salt rounds.
- `lib/database.ts` — postgres.js wrapper using `db.unsafe(sql, params)`.

**Key Design**: Parents register first, then create student profiles linked to their account. Students log in using the parent's email + their own name (no separate password). JWT tokens carry role (`parent` or `student`) and are validated in downstream services.

---

### 2.2 Test Engine (`edulens-backend/services/test-engine/`)

**Purpose**: The core adaptive testing service — manages test definitions, test sessions, question delivery, answer submission, scoring, and AI-powered insights.

**Handlers** (18 total):

| Handler | Path | Description |
|---------|------|-------------|
| `create-test.ts` | `POST /tests` | Create test definition |
| `get-tests.ts` | `GET /tests` | List available tests |
| `get-test.ts` | `GET /tests/{testId}` | Get test details with questions |
| `start-test-session.ts` | `POST /sessions` | Start a new test session |
| `submit-answer.ts` | `POST /sessions/{sessionId}/answers` | Submit answer to current question |
| `complete.ts` | `POST /sessions/{sessionId}/complete` | Complete session, calculate scores |
| `get-results.ts` | `GET /sessions/{sessionId}/results` | Get session results with analysis |
| `get-student-sessions.ts` | `GET /sessions/student/{studentId}` | List all sessions for a student |
| `student-insights.ts` | `GET /sessions/insights/{studentId}` | AI-generated student insights (Bedrock) |
| `get-student-analytics.ts` | `GET /analytics/student/{studentId}` | Historical analytics & trends |
| `analyze-session.ts` | `POST /sessions/{sessionId}/analyze` | Deep session analysis |
| `record-review.ts` | `POST /sessions/{sessionId}/review` | Record error review activity |
| `create.ts` | `POST /tests/create` | Alternative test creation |
| `news.ts` | `GET/POST/PUT/DELETE /news` | News/announcements CRUD |
| `system-config.ts` | `GET/PUT /admin/config` | Runtime system configuration |
| `websocket/connect.ts` | `$connect` | WebSocket connection handler |
| `websocket/disconnect.ts` | `$disconnect` | WebSocket disconnection handler |
| `websocket/timer-sync.ts` | `timer-sync` | Real-time timer synchronization |

**Libraries**:
- `lib/database.ts` — postgres.js query helper.
- `lib/redis.ts` — ioredis client for timer state caching (5s TTL).
- `lib/irt.ts` — Item Response Theory implementation (3PL model). Computes item probability, information function, ability estimation via Newton-Raphson MLE. **Currently unused** — scoring uses simpler percentage-based calculation.
- `lib/system-config.ts` — Runtime feature flags from `system_config` table.
- `lib/errors.ts` — Service-specific error classes.

**Session Types**:
- **Test sessions**: `test_id = <uuid>`, `stage_id = NULL` — tied to a specific test definition
- **Stage sessions**: `test_id = NULL`, `stage_id = 'oc_prep'` — open-ended practice within a stage

**Scoring**: `complete.ts` calculates `scaled_score` as percentage correct × 100, stores `correct_count` and `total_items`. The IRT library exists but is not wired in.

**WebSocket**: DynamoDB stores connection IDs. Timer sync broadcasts remaining time to all connections in a session, using Redis for timer state.

---

### 2.3 Conversation Engine (`edulens-backend/services/conversation-engine/`)

**Purpose**: AI-powered chat for parents and students using AWS Bedrock (Claude).

**Handlers** (10 total, split across two domains):

**Parent Chat** (`handlers/parent-chat/`):

| Handler | Path | Description |
|---------|------|-------------|
| `create-session.ts` | `POST /parent-chat/session` | Create parent chat session |
| `send-message.ts` | `POST /parent-chat/{sessionId}/message` | Send message (non-streaming) |
| `stream-message.ts` | `POST /parent-chat/{sessionId}/stream` | SSE streaming via ALB |
| `get-messages.ts` | `GET /parent-chat/{sessionId}/messages` | Retrieve message history |
| `end-session.ts` | `POST /parent-chat/{sessionId}/end` | End chat session |

**Student Chat** (`handlers/student-chat/`):

| Handler | Path | Description |
|---------|------|-------------|
| `create-session.ts` | `POST /student-chat/session` | Create student chat session |
| `send-message.ts` | `POST /student-chat/{sessionId}/message` | Send message (non-streaming) |
| `stream-message.ts` | `POST /student-chat/{sessionId}/stream` | SSE streaming via ALB |
| `get-messages.ts` | `GET /student-chat/{sessionId}/messages` | Retrieve message history |
| `end-session.ts` | `POST /student-chat/{sessionId}/end` | End chat session |

**Libraries**:
- `lib/bedrock.ts` — AWS Bedrock client. Default model: `us.anthropic.claude-sonnet-4-20250514-v1:0`. Supports streaming via `InvokeModelWithResponseStreamCommand`. Max tokens: 2048.
- `lib/database.ts` — postgres.js wrapper for chat tables.
- `lib/system-config.ts` — Runtime config for AI model selection, token budgets.

**Parent Chat System Prompt Context**: Loads student's test history, skill breakdown, cross-session memory (conversation_memory table), and recent session data. Builds a comprehensive system prompt that contextualizes the AI as an educational advisor.

**Student Chat System Prompt**: Uses Socratic method — the AI guides the student through problems rather than giving direct answers. Loads the student's current skill levels, recent test performance, and active stage information.

**Streaming**: Uses Lambda Response Streaming through ALB (not API Gateway, which doesn't support streaming). SSE format with `text/event-stream` content type.

**Token Budget**: 30K max total, 18K allocated to conversation history. Messages are trimmed from oldest if budget exceeded.

---

### 2.4 Profile Engine (`edulens-backend/services/profile-engine/`) — Python

**Purpose**: Statistical analysis of student learning — Bayesian mastery estimation, error classification, and time pattern analysis.

**Handlers** (5):

| Handler | Description |
|---------|-------------|
| `calculate_profile.py` | Compute student profile from test responses |
| `get_profile.py` | Retrieve current student profile |
| `get_error_patterns_aggregate.py` | Aggregate error patterns by subject/skill |
| `get_error_patterns_trends.py` | Error pattern trends over time |
| `get_skill_detail.py` | Detailed breakdown for a specific skill |

**Core Algorithms**:

- **`algorithms/bayesian_mastery.py`** — Beta-Binomial conjugate prior model for skill mastery estimation:
  - Prior: Beta(α=1, β=1) (uniform/uninformative)
  - Update rule: α += correct, β += incorrect per skill
  - Mastery = E[Beta] = α / (α + β)
  - Confidence = 1 - Var[Beta] (tighter distribution = higher confidence)
  - Supports weighted updates based on question difficulty

- **`services/error_classifier.py`** — Classifies errors into 7 types:
  1. `conceptual` — fundamental misunderstanding
  2. `procedural` — wrong steps/method
  3. `careless` — knew the concept, made a mistake
  4. `time_pressure` — answered too quickly or ran out of time
  5. `guessing` — random answer pattern
  6. `partial_understanding` — close but incomplete
  7. `unknown` — unclassifiable

- **`services/time_analyzer.py`** — Detects time anomalies:
  - Rushing: response time < 25% of estimated time
  - Hesitation: response time > 300% of estimated time
  - Computes time efficiency ratio per question

**Database**: Uses SQLAlchemy 2.0 with `NullPool` (Lambda best practice — no persistent connection pools). Connection via Secrets Manager (`DB_SECRET_ARN`).

**Repositories** (`database/repositories.py`): 6 repository classes — `StudentRepository`, `SessionRepository`, `ResponseRepository`, `QuestionRepository`, `ProfileRepository`, `ErrorPatternRepository`.

**Limitation**: `calculate_profile` requires numpy/scipy for full statistical analysis, which exceeds the 250MB Lambda deployment limit. Needs Lambda Layer or container image deployment.

---

### 2.5 Background Jobs (`edulens-backend/services/background-jobs/`) — Python

**Purpose**: Asynchronous processing for conversation summarization and insight extraction, triggered by SQS.

**Handlers** (5):

| Handler | Trigger | Description |
|---------|---------|-------------|
| `summarize_conversation.py` | SQS | Summarize completed chat sessions |
| `extract_insights.py` | SQS | Extract learning insights from conversations |
| `batch_processor.py` | SQS | Process batches of conversations |
| `insights_worker.py` | SQS | Worker for insight extraction pipeline |
| `summarization_worker.py` | SQS | Worker for summarization pipeline |

**AI Client** (`services/anthropic_client.py`):
- Uses Anthropic Python SDK directly (not Bedrock)
- Model: Claude Haiku (`claude-3-5-haiku-20241022`)
- API key from environment variable `ANTHROPIC_API_KEY`

**Services**:
- `summarizer.py` — Generates structured conversation summaries with key topics, parent concerns, and action items.
- `insight_extractor.py` — Extracts learning patterns, engagement signals, and recommendations from conversation transcripts.

**Note**: A Bedrock client is also present but unused — the service currently uses the Anthropic API directly.

---

### 2.6 Admin Service (`edulens-backend/services/admin-service/`)

**Purpose**: Administrative operations — question bank management, student analytics, system metrics, and bulk import/export.

**Handlers** (9):

| Handler | Path | Description |
|---------|------|-------------|
| `questions/create-question.ts` | `POST /admin/questions` | Create question with Zod validation |
| `questions/update-question.ts` | `PUT /admin/questions/{questionId}` | Update question |
| `questions/delete-question.ts` | `DELETE /admin/questions/{questionId}` | Soft delete question |
| `questions/list-questions.ts` | `GET /admin/questions` | List with filters (subject, difficulty, stage) |
| `questions-crud.ts` | Multiple | Legacy combined CRUD handler |
| `analytics/student-analytics.ts` | `GET /admin/analytics/student/{studentId}` | Per-student analytics |
| `analytics/system-metrics.ts` | `GET /admin/metrics` | Platform-wide metrics |
| `bulk-operations/import-questions.ts` | `POST /admin/questions/import` | Bulk import (CSV/JSON) |
| `bulk-operations/export-questions.ts` | `GET /admin/questions/export` | Bulk export (CSV/JSON) |

**Validation**: Uses Zod schemas for question creation/update. Validates `subject`, `type` (multiple_choice, true_false, short_answer), `difficulty` (1-5), `stage_id`, `skill_id`, answer options, and `correct_answer`.

**Auth**: Admin endpoints require `x-api-key` header (not JWT). Key stored as environment variable.

---

### 2.7 Stage Registry (`edulens-backend/services/stage-registry/`)

**Purpose**: Educational stage lifecycle management and skill taxonomy. EduLens organizes learning into 4 stages with cross-stage skill transfer.

**Stages**:
1. `oc_prep` — Opportunity Class Preparation (primary school gifted program entry)
2. `selective` — Selective High School Preparation
3. `hsc` — Higher School Certificate (Year 11-12)
4. `lifelong` — Lifelong learning / general

**Handlers** (9):

| Handler | Path | Description |
|---------|------|-------------|
| `list-stages.ts` | `GET /stages` | List all stages |
| `get-stage.ts` | `GET /stages/{stageId}` | Get stage details |
| `activate-student-stage.ts` | `POST /stages/student/activate` | Activate a student in a stage |
| `activate-student-stage-with-mapping.ts` | `POST /stages/student/activate-with-mapping` | Activate with skill bridge bootstrapping |
| `deactivate-student-stage.ts` | `POST /stages/student/deactivate` | Deactivate student from stage |
| `list-student-stages.ts` | `GET /stages/student/{studentId}` | List student's active stages |
| `get-skill-taxonomy.ts` | `GET /stages/{stageId}/skills` | Get skill tree for stage |
| `get-skill-bridges.ts` | `GET /stages/bridges` | Get cross-stage skill mappings |
| `get-stage-progression.ts` | `GET /stages/student/{studentId}/progression` | Student's progression across stages |

**Key Component — `lib/stage-mapping-service.ts`** (`StageMappingService` class):
- Manages cross-stage skill bridges (e.g., OC Prep "Number Sense" → Selective "Advanced Algebra")
- On stage activation, bootstraps the new stage's skill mastery from prior stage data via skill bridges
- Bridge types: `prerequisite`, `equivalent`, `advanced`, `foundational`
- Transfer formula applies a weight factor to the source mastery level

**Learning DNA** (Two-Layer Profile):
- `students.core_profile` — Lifetime learning traits (learning style, preferred pace, etc.)
- `student_stages.stage_profile` — Stage-specific skill mastery and performance data

---

### 2.8 Contest Service (`edulens-backend/services/contest-service/`)

**Purpose**: Competition management — series, contests, registration, result submission, and ranking.

**Handlers** (11):

**Admin** (`handlers/admin/`):

| Handler | Path | Description |
|---------|------|-------------|
| `create-contest-series.ts` | `POST /admin/contest-series` | Create a series of contests |
| `list-contest-series.ts` | `GET /admin/contest-series` | List all series |
| `create-contest.ts` | `POST /admin/contests` | Create individual contest in series |
| `update-contest.ts` | `PUT /admin/contests/{contestId}` | Update contest details |
| `update-contest-status.ts` | `PUT /admin/contests/{contestId}/status` | Transition contest state |
| `finalize-contest-results.ts` | `POST /admin/contests/{contestId}/finalize` | Compute rankings, percentiles |

**Public** (`handlers/`):

| Handler | Path | Description |
|---------|------|-------------|
| `list-contests.ts` | `GET /contests` | List available contests |
| `register-contest.ts` | `POST /contests/{contestId}/register` | Register student for contest |
| `submit-contest-result.ts` | `POST /contests/{contestId}/results` | Submit contest result |
| `get-contest-results.ts` | `GET /contests/{contestId}/results` | Get contest results/rankings |
| `get-student-contest-history.ts` | `GET /contests/student/{studentId}/history` | Student's contest history |

**State Machine**: Contests follow a strict state progression:
```
draft → open → active → scoring → finalized
```

**Finalization** (`finalize-contest-results.ts`): Calculates percentile rankings across all participants, updates `contest_results` with `rank` and `percentile` fields.

---

### 2.9 Shared Packages

#### `packages/shared/common/`

**Types** (`src/types/models.ts`): Core domain models including `User`, `Student`, `Question`, `Test`, `TestSession`, `SessionResponse`, `ChatSession`, `ChatMessage`, `SkillNode`, `ErrorPattern`, `StudentProfile`, `DomainEvent`, `ApiResponse`.

**Enums**: `UserRole` (parent, student, admin), `QuestionType` (multiple_choice, true_false, short_answer), `Subject` (math, reading, thinking_skills, writing, general_ability, science), `Difficulty` (1-5), `SessionStatus` (active, completed, expired, abandoned).

**Constants** (`src/constants/index.ts`):
- `AI_MODELS`: Claude Sonnet 4.5 for chat, Haiku 4.5 for summarization
- `TOKEN_BUDGET`: 30K max, 18K conversation history
- `CACHE_TTL`: user sessions 1h, profiles 30m, timer state 5s
- `SKILL_TAXONOMY`: Reading, Math, Science, Writing skill trees
- `FEATURES`: chat enabled, AI scoring disabled (MVP), cross-session memory enabled, prompt caching enabled

**Errors** (`src/errors/index.ts`): `AppError` base class with specialized subclasses — `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `NotFoundError`, `SessionExpiredError`, `AIServiceError`, `DatabaseError`, `RateLimitError`, `ExternalServiceError`.

**Logger** (`src/logger/index.ts`): Structured JSON logger with Lambda request context.

**Validators** (`src/validators/index.ts`): Zod schemas for common request validation.

#### `packages/shared/database/`

**Client** (`src/client.ts`): postgres.js singleton with connection pooling. Uses Secrets Manager for credentials in production, environment variables for local dev.

**Redis** (`src/redis.ts`): ioredis singleton with helper functions — `cacheGet`, `cacheSet`, `cacheDel`, `cacheExists`, `cacheMultiGet`, `cacheDelPattern`, `cacheIncr`, `checkRedisHealth`. Retry strategy with exponential backoff (max 2s).

**Prisma Schema** (`prisma/schema.prisma`): 22 models documenting the v3 schema. **NOT used at runtime** — exists purely as documentation. All runtime DB access uses raw SQL via postgres.js or SQLAlchemy.

---

## 3. Frontend Analysis

### Framework & Architecture

- **Framework**: Next.js 14.1.0 with App Router
- **Language**: TypeScript 5.3
- **State Management**: Zustand 4.5 (client state) + @tanstack/react-query 5.17 (server state)
- **Styling**: Tailwind CSS 3.4 with tailwindcss-animate
- **Charts**: Recharts 2.10
- **Forms**: react-hook-form 7.49 + zod 3.22 validation
- **Icons**: lucide-react 0.312
- **i18n**: Custom provider supporting English (`en.ts`) and Chinese (`zh.ts`)

### App Router Structure

```
src/app/
├── layout.tsx              # Root layout (providers, global styles)
├── page.tsx                # Landing / home page
│
├── login/page.tsx          # Parent login
├── register/page.tsx       # Parent registration
├── student-login/page.tsx  # Student login
├── select-profile/page.tsx # Profile selection
│
├── student/
│   ├── layout.tsx          # Student shell (nav, sidebar)
│   ├── dashboard/page.tsx  # Student home dashboard
│   ├── profile/page.tsx    # Student profile view
│   ├── tutor/page.tsx      # AI tutor chat (student chat)
│   ├── contests/page.tsx   # Contest listing & registration
│   ├── test/page.tsx       # Test listing
│   ├── test/[testId]/page.tsx        # Test details
│   ├── test/take/[testId]/page.tsx   # Active test-taking UI
│   ├── test/results/[sessionId]/page.tsx  # Results view
│   └── error-review/[sessionId]/page.tsx  # Error review after test
│
├── parent/
│   ├── layout.tsx          # Parent shell
│   ├── dashboard/page.tsx  # Parent home (student overview)
│   ├── chat/page.tsx       # AI advisor chat (parent chat)
│   ├── contests/page.tsx   # Contest management for children
│   ├── students/[studentId]/journey/page.tsx        # Learning journey timeline
│   ├── students/[studentId]/error-analysis/page.tsx # Error analysis (renamed to Diagnostic Insights)
│   └── analytics/[studentId]/page.tsx               # Student analytics dashboard
│
├── admin/
│   ├── layout.tsx          # Admin shell
│   ├── page.tsx            # Admin dashboard
│   ├── login/page.tsx      # Admin login (API key based)
│   ├── questions/page.tsx  # Question bank management
│   ├── contests/page.tsx   # Contest administration
│   ├── news/page.tsx       # News/announcement management
│   └── settings/page.tsx   # System settings
│
└── news/
    ├── layout.tsx          # Public news layout
    └── page.tsx            # Public news listing
```

### Key Components

**Navigation**: `components/app-nav.tsx` — Role-based navigation component. Shows different menu items for parent, student, and admin roles.

**Stage Transition**: `components/stage-transition-view.tsx` — UI for transitioning students between educational stages with skill bridge visualization.

**Analytics** (`components/analytics/`):
- `ErrorPatternsOverview.tsx` — Aggregated error pattern display with subject breakdown
- `ActionableInsights.tsx` — AI-generated actionable recommendations
- `ErrorTimelineAnalysis.tsx` — Error trends over time with Recharts
- `SkillErrorCorrelation.tsx` — Correlation between skill mastery and error patterns

**UI Primitives** (`components/ui/`): Card, Badge, Button, Input, Progress — styled with class-variance-authority (CVA) and Tailwind.

**Providers** (`components/providers.tsx`): Wraps app with React Query provider, i18n provider, and Zustand stores.

### API Client

**`src/lib/api-client.ts`**: Axios-based API client with:
- Base URL configurable via `NEXT_PUBLIC_API_URL` env var
- JWT token injection via request interceptor
- 401 response handling (redirect to login)
- Typed request/response methods

**`src/lib/test-api/client.ts`**: Specialized client for test engine endpoints with typed methods for session management, answer submission, and results retrieval.

### Internationalization

Custom i18n system in `src/lib/i18n/`:
- `index.tsx` — React context provider with `useTranslation` hook
- `en.ts` — English translations
- `zh.ts` — Chinese (Simplified) translations
- Covers all UI text: navigation, forms, test-taking, results, error messages

---

## 4. Infrastructure

### CDK Stacks (8 total)

Defined in `edulens-infrastructure/bin/app.ts` with strict dependency ordering:

```
1. NetworkStack
     ↓
2. DatabaseStack ← depends on Network
     ↓
3. JobsStack ← no Lambda deps (SQS + EventBridge only)
     ↓
4. ApiGatewayStack ← skeleton API Gateway
   AlbStack ← skeleton ALB for streaming
     ↓
5. LambdaStack ← depends on Network, Database, Jobs, ApiGateway, ALB
     ↓
6. Routes + target groups wired post-creation
     ↓
7. MonitoringStack ← depends on Lambda
8. WebSocketIntegrationStack
```

#### Stack Details

**NetworkStack** (`lib/stacks/network-stack.ts`):
- VPC with 2 AZs, public + private subnets
- NAT Gateway for Lambda internet access
- VPC endpoints for AWS services (Secrets Manager, SQS, DynamoDB, S3)
- Security groups for Lambda, RDS, ElastiCache

**DatabaseStack** (`lib/stacks/database-stack.ts`):
- Aurora PostgreSQL Serverless v2 (min 0.5 ACU, max 4 ACU)
- Credentials in Secrets Manager
- ElastiCache Redis 7 (single node, `cache.t3.micro`)
- DynamoDB table for WebSocket connections

**JobsStack** (`lib/stacks/jobs-stack.ts`):
- SQS queues: `conversation-summarization`, `insight-extraction`, `batch-processing`
- Dead letter queues for each
- EventBridge rules: `session-completed`, `chat-ended`, `profile-updated`
- **No Lambda dependencies** — queue/rule ARNs passed as constructed strings to avoid cyclic deps

**ApiGatewayStack** (`lib/stacks/api-gateway-stack.ts`):
- REST API Gateway with `/dev` stage
- CORS configuration
- API key for admin endpoints
- Usage plan with throttling

**AlbStack** (`lib/stacks/alb-stack.ts`):
- Application Load Balancer for streaming endpoints
- Target groups for Lambda functions
- Health check configuration

**LambdaStack** (`lib/stacks/lambda-stack.ts`):
- **58 Lambda functions** across all services
- Node.js Lambdas: `NodejsLambda` construct with esbuild bundling
- Python Lambdas: `PythonLambda` construct with pip packaging
- Environment variables: DB credentials ARN, Redis endpoint, SQS queue URLs, API keys
- VPC placement in private subnets
- IAM roles with least-privilege policies

**MonitoringStack** (`lib/stacks/monitoring-stack.ts`):
- CloudWatch dashboards
- Lambda error alarms
- API Gateway 5xx alarms
- SQS dead letter queue alarms

**WebSocketIntegrationStack** (`lib/stacks/websocket-integration-stack.ts`):
- WebSocket API Gateway
- $connect, $disconnect, timer-sync routes
- DynamoDB for connection management

### CDK Constructs

**`lib/constructs/nodejs-lambda.ts`**: Reusable construct for Node.js Lambda functions. Uses esbuild for bundling, externalizes `@aws-sdk/*`, sets Node 20 runtime.

**`lib/constructs/python-lambda.ts`**: Reusable construct for Python Lambda functions. Pip install to staging directory, zips and uploads.

**`lib/constructs/database-migrator.ts`**: Custom CloudFormation resource that runs SQL migrations on deploy using the `edulens-db-migrate-dev` Lambda.

### Environment Configuration

`config/environments.ts` defines three environments:

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| Aurora Min ACU | 0.5 | 1 | 2 |
| Aurora Max ACU | 4 | 8 | 32 |
| Redis Node | cache.t3.micro | cache.t3.small | cache.r7g.large |
| Lambda Memory | 256 MB | 512 MB | 1024 MB |
| API Throttle | 100 rps | 500 rps | 2000 rps |

---

## 5. Database Schema

### Schema Source

Canonical schema: `edulens-backend/scripts/db-migration/migration.sql` (488 lines)

Prisma schema (documentation only): `edulens-backend/packages/shared/database/prisma/schema.prisma`

### Core Tables

#### Users & Students

```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'parent',  -- parent | admin
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

students (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  grade INTEGER,
  date_of_birth DATE,
  core_profile JSONB,           -- Learning DNA: lifetime traits
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

#### Stages & Skills

```sql
stages (
  id VARCHAR(50) PRIMARY KEY,   -- 'oc_prep', 'selective', 'hsc', 'lifelong'
  name VARCHAR(255) NOT NULL,
  description TEXT,
  grade_range VARCHAR(50),
  subjects JSONB,
  status VARCHAR(50) DEFAULT 'active',
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
)

student_stages (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  stage_id VARCHAR(50) REFERENCES stages(id),
  status VARCHAR(50) DEFAULT 'active',
  stage_profile JSONB,          -- Learning DNA: stage-specific skills
  activated_at TIMESTAMP DEFAULT NOW(),
  deactivated_at TIMESTAMP,
  UNIQUE(student_id, stage_id)
)

skill_taxonomy (
  id UUID PRIMARY KEY,
  stage_id VARCHAR(50) REFERENCES stages(id),
  subject VARCHAR(100) NOT NULL,
  skill_name VARCHAR(255) NOT NULL,
  skill_code VARCHAR(100),
  parent_skill_id UUID REFERENCES skill_taxonomy(id),
  difficulty_range JSONB,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)

skill_bridges (
  id UUID PRIMARY KEY,
  source_stage_id VARCHAR(50),
  target_stage_id VARCHAR(50),
  source_skill_id UUID REFERENCES skill_taxonomy(id),
  target_skill_id UUID REFERENCES skill_taxonomy(id),
  bridge_type VARCHAR(50),      -- prerequisite | equivalent | advanced | foundational
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
)
```

#### Tests & Sessions

```sql
tests (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  stage_id VARCHAR(50) REFERENCES stages(id),
  subject VARCHAR(100),
  question_count INTEGER NOT NULL,
  time_limit INTEGER,           -- seconds
  status VARCHAR(50) DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

questions (
  id UUID PRIMARY KEY,
  test_id UUID REFERENCES tests(id),
  stage_id VARCHAR(50),
  subject VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,    -- multiple_choice | true_false | short_answer
  difficulty INTEGER NOT NULL,  -- 1-5
  content TEXT NOT NULL,
  options JSONB,
  correct_answer VARCHAR(500) NOT NULL,
  explanation TEXT,
  skill_id UUID,
  estimated_time INTEGER,       -- seconds
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

test_sessions (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  test_id UUID REFERENCES tests(id),          -- NULL for stage sessions
  stage_id VARCHAR(50) REFERENCES stages(id), -- NULL for test sessions
  status VARCHAR(50) DEFAULT 'active',        -- active | completed | expired | abandoned
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  total_items INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  scaled_score DECIMAL(5,2),
  question_count INTEGER,
  stage_insights_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
)

session_responses (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES test_sessions(id),
  question_id UUID REFERENCES questions(id),
  student_answer VARCHAR(500),
  is_correct BOOLEAN,
  time_spent INTEGER,           -- seconds
  question_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
)
```

#### Chat & Conversations

```sql
chat_sessions (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES users(id),
  student_id UUID REFERENCES students(id),
  session_type VARCHAR(50),     -- 'parent' | 'student'
  status VARCHAR(50) DEFAULT 'active',
  context JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
)

chat_messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES chat_sessions(id),
  role VARCHAR(50) NOT NULL,    -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
)

conversation_memory (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  parent_id UUID REFERENCES users(id),
  memory_type VARCHAR(50),      -- 'summary' | 'insight' | 'preference'
  content TEXT NOT NULL,
  source_session_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
)
```

#### Profiles & Analytics

```sql
student_profiles (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  profile_data JSONB NOT NULL,
  mastery_levels JSONB,
  error_patterns JSONB,
  time_patterns JSONB,
  computed_at TIMESTAMP DEFAULT NOW()
)

profile_snapshots (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  snapshot_data JSONB NOT NULL,
  trigger_event VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
)

events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  source_service VARCHAR(100),
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
)
```

#### Contests

```sql
contest_series (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  stage_id VARCHAR(50),
  subject VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
)

contests (
  id UUID PRIMARY KEY,
  series_id UUID REFERENCES contest_series(id),
  title VARCHAR(255) NOT NULL,
  test_id UUID REFERENCES tests(id),
  status VARCHAR(50) DEFAULT 'draft',  -- draft | open | active | scoring | finalized
  window_start_at TIMESTAMP,
  window_end_at TIMESTAMP,
  max_participants INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)

contest_registrations (
  id UUID PRIMARY KEY,
  contest_id UUID REFERENCES contests(id),
  student_id UUID REFERENCES students(id),
  registered_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contest_id, student_id)
)

contest_results (
  id UUID PRIMARY KEY,
  contest_id UUID REFERENCES contests(id),
  student_id UUID REFERENCES students(id),
  session_id UUID REFERENCES test_sessions(id),
  score DECIMAL(5,2),
  rank INTEGER,
  percentile DECIMAL(5,2),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
)
```

#### System

```sql
system_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
)

news (
  id UUID PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'draft',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

### Entity Relationship Summary

```
users 1──N students
users 1──N chat_sessions (as parent)
students N──1 users (parent)
students 1──N student_stages
students 1──N test_sessions
students 1──N chat_sessions
students 1──N student_profiles
students 1──N conversation_memory
students 1──N contest_registrations
students 1──N contest_results

stages 1──N student_stages
stages 1──N skill_taxonomy
stages 1──N tests
stages 1──N contest_series

skill_taxonomy self-referencing (parent_skill_id)
skill_bridges: skill_taxonomy ←→ skill_taxonomy (cross-stage)

tests 1──N questions
tests 1──N test_sessions
tests 1──N contests

test_sessions 1──N session_responses
test_sessions N──1 students
test_sessions N──1 tests (nullable)
test_sessions N──1 stages (nullable)

contests N──1 contest_series
contests N──1 tests
contests 1──N contest_registrations
contests 1──N contest_results
```

### Seed Data

`scripts/db-migration/seed-questions.js` inserts **176 questions** across 4 stages:
- `oc_prep`: Math, Reading, Thinking Skills, General Ability
- `selective`: Math, Reading, Writing, General Ability
- `hsc`: Math, Science, English
- `lifelong`: General Knowledge

---

## 6. API Surface

### Base URL
- **Production**: `https://npwg8my4w5.execute-api.us-west-2.amazonaws.com/dev`
- **Local Mock**: `http://localhost:3001` (simple mock)
- **Local Full**: `http://localhost:3002` (Lambda proxy)

### Authentication Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `POST` | `/auth/register` | None | `{email, password, name}` | `{success, user, token}` |
| `POST` | `/auth/login` | None | `{email, password}` | `{success, user, token}` |
| `POST` | `/auth/student-login` | None | `{parentEmail, studentName}` | `{success, student, token}` |
| `POST` | `/auth/students` | JWT (parent) | `{name, grade?, dateOfBirth?}` | `{success, student}` |
| `GET` | `/auth/students` | JWT (parent) | — | `{success, students[]}` |
| `DELETE` | `/auth/students/{studentId}` | JWT (parent) | — | `{success}` |

### Test Engine Endpoints

| Method | Path | Auth | Body/Query | Response |
|--------|------|------|------------|----------|
| `POST` | `/tests` | JWT | `{title, description, stageId, subject, questionCount, timeLimit}` | `{success, test}` |
| `GET` | `/tests` | JWT | `?stageId=&subject=` | `{success, tests[]}` |
| `GET` | `/tests/{testId}` | JWT | — | `{success, test, questions[]}` |
| `POST` | `/sessions` | JWT | `{testId?, stageId?, studentId}` | `{success, session, firstQuestion}` |
| `POST` | `/sessions/{sessionId}/answers` | JWT | `{questionId, answer, timeSpent}` | `{success, isCorrect, nextQuestion?}` |
| `POST` | `/sessions/{sessionId}/complete` | JWT | — | `{success, results}` |
| `GET` | `/sessions/{sessionId}/results` | JWT | — | `{success, session, responses[], analysis}` |
| `GET` | `/sessions/student/{studentId}` | JWT | `?limit=&offset=` | `{success, sessions[]}` |
| `GET` | `/sessions/insights/{studentId}` | JWT | — | `{success, insights}` (AI-generated) |
| `GET` | `/analytics/student/{studentId}` | JWT | — | `{success, analytics}` |
| `POST` | `/sessions/{sessionId}/analyze` | JWT | — | `{success, analysis}` |
| `POST` | `/sessions/{sessionId}/review` | JWT | `{questionId, reviewNotes?}` | `{success}` |

### Conversation Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `POST` | `/parent-chat/session` | JWT | `{studentId}` | `{success, session}` |
| `POST` | `/parent-chat/{sessionId}/message` | JWT | `{message}` | `{success, response}` |
| `POST` | `/parent-chat/{sessionId}/stream` | JWT | `{message}` | SSE stream |
| `GET` | `/parent-chat/{sessionId}/messages` | JWT | `?limit=&offset=` | `{success, messages[]}` |
| `POST` | `/parent-chat/{sessionId}/end` | JWT | — | `{success}` |
| `POST` | `/student-chat/session` | JWT | — | `{success, session}` |
| `POST` | `/student-chat/{sessionId}/message` | JWT | `{message}` | `{success, response}` |
| `POST` | `/student-chat/{sessionId}/stream` | JWT | `{message}` | SSE stream |
| `GET` | `/student-chat/{sessionId}/messages` | JWT | `?limit=&offset=` | `{success, messages[]}` |
| `POST` | `/student-chat/{sessionId}/end` | JWT | — | `{success}` |

### Stage Registry Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `GET` | `/stages` | JWT | — | `{success, stages[]}` |
| `GET` | `/stages/{stageId}` | JWT | — | `{success, stage}` |
| `POST` | `/stages/student/activate` | JWT | `{studentId, stageId}` | `{success, studentStage}` |
| `POST` | `/stages/student/activate-with-mapping` | JWT | `{studentId, stageId}` | `{success, studentStage, bridgedSkills}` |
| `POST` | `/stages/student/deactivate` | JWT | `{studentId, stageId}` | `{success}` |
| `GET` | `/stages/student/{studentId}` | JWT | — | `{success, stages[]}` |
| `GET` | `/stages/{stageId}/skills` | JWT | — | `{success, skills[]}` |
| `GET` | `/stages/bridges` | JWT | `?sourceStage=&targetStage=` | `{success, bridges[]}` |
| `GET` | `/stages/student/{studentId}/progression` | JWT | — | `{success, progression}` |

### Contest Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `GET` | `/contests` | JWT | `?stageId=&status=` | `{success, contests[]}` |
| `POST` | `/contests/{contestId}/register` | JWT | `{studentId}` | `{success, registration}` |
| `POST` | `/contests/{contestId}/results` | JWT | `{studentId, sessionId, score}` | `{success, result}` |
| `GET` | `/contests/{contestId}/results` | JWT | — | `{success, results[], rankings[]}` |
| `GET` | `/contests/student/{studentId}/history` | JWT | — | `{success, history[]}` |

### Admin Endpoints (require `x-api-key` header)

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `POST` | `/admin/questions` | API Key | `{subject, type, difficulty, content, options, correctAnswer, stageId, skillId}` | `{success, question}` |
| `GET` | `/admin/questions` | API Key | `?subject=&difficulty=&stageId=&page=&limit=` | `{success, questions[], total}` |
| `PUT` | `/admin/questions/{questionId}` | API Key | Partial question fields | `{success, question}` |
| `DELETE` | `/admin/questions/{questionId}` | API Key | — | `{success}` |
| `POST` | `/admin/questions/import` | API Key | `{format: 'csv'|'json', data}` | `{success, imported, errors[]}` |
| `GET` | `/admin/questions/export` | API Key | `?format=csv|json&stageId=&subject=` | CSV/JSON file |
| `GET` | `/admin/analytics/student/{studentId}` | API Key | — | `{success, analytics}` |
| `GET` | `/admin/metrics` | API Key | — | `{success, metrics}` |
| `POST` | `/admin/contest-series` | API Key | `{title, description, stageId, subject}` | `{success, series}` |
| `GET` | `/admin/contest-series` | API Key | — | `{success, series[]}` |
| `POST` | `/admin/contests` | API Key | `{seriesId, title, testId, windowStartAt, windowEndAt}` | `{success, contest}` |
| `PUT` | `/admin/contests/{contestId}` | API Key | Partial contest fields | `{success, contest}` |
| `PUT` | `/admin/contests/{contestId}/status` | API Key | `{status}` | `{success, contest}` |
| `POST` | `/admin/contests/{contestId}/finalize` | API Key | — | `{success, results[]}` |

### Profile Engine Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `GET` | `/profile/{studentId}` | JWT | — | `{success, profile}` |
| `POST` | `/profile/{studentId}/calculate` | JWT | — | `{success, profile}` |
| `GET` | `/profile/{studentId}/errors/aggregate` | JWT | `?stageId=&subject=` | `{success, patterns[]}` |
| `GET` | `/profile/{studentId}/errors/trends` | JWT | `?period=&stageId=` | `{success, trends[]}` |
| `GET` | `/profile/{studentId}/skills/{skillId}` | JWT | — | `{success, skillDetail}` |

### News Endpoints

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| `GET` | `/news` | None | `?status=published&limit=&offset=` | `{success, articles[]}` |
| `GET` | `/news/{newsId}` | None | — | `{success, article}` |
| `POST` | `/news` | API Key | `{title, content}` | `{success, article}` |
| `PUT` | `/news/{newsId}` | API Key | Partial fields | `{success, article}` |
| `DELETE` | `/news/{newsId}` | API Key | — | `{success}` |

### System Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | None | Health check |
| `GET` | `/admin/config` | API Key | Get system configuration |
| `PUT` | `/admin/config` | API Key | Update system configuration |

---

## 7. AI/ML Integration

### AWS Bedrock — Conversational AI

**Parent Chat** (`conversation-engine/src/handlers/parent-chat/send-message.ts`):
- Model: `us.anthropic.claude-sonnet-4-20250514-v1:0` (Claude Sonnet 4)
- System prompt includes: student's test history, skill breakdown by subject, cross-session memory, recent session performance
- Max tokens: 2048
- Temperature: not explicitly set (uses model default)
- Supports streaming via `stream-message.ts` using Lambda Response Streaming + ALB

**Student Chat** (`conversation-engine/src/handlers/student-chat/send-message.ts`):
- Same model as parent chat
- Socratic method prompt: guides students through problem-solving rather than giving answers
- System prompt includes: current skill levels, active stage, recent test performance
- Streaming support via ALB

**Cross-Session Memory** (`conversation_memory` table):
- Stores summaries, insights, and preferences from previous conversations
- Loaded into system prompt for continuity across chat sessions
- Memory types: `summary`, `insight`, `preference`
- Optional expiration (`expires_at`)

**Token Management**:
- Budget: 30K max total tokens per request
- Conversation history: 18K token budget
- Oldest messages trimmed first when budget exceeded
- Defined in `packages/shared/common/src/constants/index.ts`

### AWS Bedrock — Student Insights

**`test-engine/src/handlers/student-insights.ts`**:
- Generates AI-powered insights from test session data
- Loads all sessions, responses, questions, and computed analytics
- Sends structured data to Claude with instructions to produce actionable insights
- Output: strengths, weaknesses, recommended focus areas, study tips
- Results can be cached in `test_sessions.stage_insights_json`

### Background Job AI (Anthropic API)

**Summarization** (`background-jobs/src/services/summarizer.py`):
- Model: Claude Haiku (`claude-3-5-haiku-20241022`)
- Input: full conversation transcript
- Output: structured summary with key topics, parent concerns, action items
- Triggered by SQS when chat session ends

**Insight Extraction** (`background-jobs/src/services/insight_extractor.py`):
- Model: Claude Haiku
- Input: conversation transcript + student context
- Output: learning patterns, engagement signals, recommendations
- Stores results in `conversation_memory` table

### Bayesian Mastery Calculation (Profile Engine)

**`profile-engine/src/algorithms/bayesian_mastery.py`**:
- Beta-Binomial conjugate prior model
- Prior: Beta(α=1, β=1) — uniform/uninformative
- Per skill: α += correct answers, β += incorrect answers
- Mastery = α / (α + β)
- Confidence = 1 - Var[Beta(α, β)]
- Difficulty weighting: harder questions contribute more to updates
- **Status**: Partially blocked — full calculation needs numpy/scipy (Lambda size limit)

### Error Classification

**`profile-engine/src/services/error_classifier.py`**:
- Rule-based classification (not ML)
- 7 error types: conceptual, procedural, careless, time_pressure, guessing, partial_understanding, unknown
- Uses: response correctness, time spent vs estimated time, answer pattern analysis
- Input: `session_responses` joined with `questions`

### IRT (Item Response Theory)

**`test-engine/src/lib/irt.ts`**:
- Three-Parameter Logistic (3PL) model implemented
- Functions: `itemProbability`, `itemInformation`, `abilityEstimation` (Newton-Raphson MLE)
- **Status**: Fully implemented but **NOT wired into production** — scoring uses simple percentage calculation

### Feature Flags

From `packages/shared/common/src/constants/index.ts`:

| Feature | Status | Description |
|---------|--------|-------------|
| `chatEnabled` | `true` | AI chat enabled |
| `aiScoringEnabled` | `false` | IRT/AI scoring (MVP disabled) |
| `crossSessionMemory` | `true` | Memory across chat sessions |
| `promptCaching` | `true` | Bedrock prompt caching |
| `modelRouting` | `true` | Dynamic model selection |

---

## 8. Current State Assessment

### What Works (Production-Ready)

1. **Authentication flow** — Parent registration, login, student creation, JWT-based auth
2. **Test engine core** — Test creation, session management, question delivery, answer submission, basic scoring
3. **Conversation engine** — Parent and student AI chat with streaming, cross-session memory
4. **Stage management** — Stage CRUD, student activation/deactivation, skill taxonomy
5. **Admin question management** — Full CRUD with Zod validation, bulk import/export
6. **Contest system** — Series, contests, registration, state machine, result submission
7. **Frontend routing** — All role-based routes, test-taking UI, chat interface, analytics views
8. **Infrastructure** — CDK stacks deploy successfully, all 58 Lambdas provisioned
9. **i18n** — English and Chinese translation support
10. **News/announcements** — Full CRUD with publish workflow

### What's Incomplete / Broken

1. **`session-manager.ts` in test-engine** — Still uses Prisma client (which has been removed). This file is not actively imported by handlers but represents dead code that would break if used.

2. **`calculate_profile` Lambda** — Requires numpy/scipy for full Bayesian computation, which exceeds the 250MB Lambda deployment limit. Needs migration to Lambda Layer or container image.

3. **`student_profiles` and `profile_snapshots` tables** — NOT included in `migration.sql`. Created separately and would be missing if the database is re-initialized from the migration script.

4. **IRT scoring** — Fully implemented in `lib/irt.ts` but not used. The `aiScoringEnabled` feature flag is `false`. Scoring falls back to simple percentage calculation.

5. **Background jobs AI client mismatch** — Uses Anthropic Python SDK directly (requires `ANTHROPIC_API_KEY` env var) instead of Bedrock. A Bedrock client exists in the codebase but is unused.

6. **WebSocket timer sync** — DynamoDB connection management and timer sync handlers exist, but the frontend doesn't appear to have a WebSocket client implementation.

7. **System metrics endpoint** — `edulens-admin-system-metrics-dev` may have IAM/Secrets Manager permission issues (noted in CLAUDE.md).

### Technical Debt

1. **Duplicate code**: Each service has its own `lib/database.ts` with nearly identical postgres.js wrapper code. Should use the shared `@edulens/database` package.

2. **Mixed database access patterns**: Node.js services use raw SQL via postgres.js, Python services use SQLAlchemy. The shared Prisma schema exists only for documentation.

3. **No request rate limiting**: Chat endpoints have no rate limiting — a user could flood the Bedrock API with requests.

4. **Missing transactions**: Contest finalization (`finalize-contest-results.ts`) updates multiple rows without wrapping in a transaction. A failure mid-update could leave results in an inconsistent state.

5. **Column name inconsistencies**: Contest handler code references column names that don't match the migration schema (e.g., `scheduled_start`/`scheduled_end` vs `window_start_at`/`window_end_at`, `name` vs `title`).

6. **Legacy handler**: `questions-crud.ts` in admin-service is a monolithic handler that was superseded by the split `questions/` directory handlers. Should be removed.

7. **Hard-coded API key**: Admin API key is in CLAUDE.md in plain text. Should be rotated and only stored in Secrets Manager.

8. **No input sanitization on SQL**: While postgres.js parameterized queries prevent SQL injection, some handlers build query strings dynamically (e.g., `ORDER BY ${sortField}`).

### TODOs Found in Code

- Profile engine numpy/scipy dependency resolution
- Wiring IRT scoring into production
- Lambda Layer or container image for profile-engine
- `student_profiles` / `profile_snapshots` table migration
- WebSocket frontend client implementation
- Rate limiting on chat endpoints
- Transaction wrapping for contest finalization

---

## 9. Deployment Pipeline

### CDK Deployment

```bash
cd edulens-infrastructure
npm install
npx cdk diff --profile <aws-profile>     # Preview changes
npx cdk deploy --all --profile <aws-profile>  # Deploy all stacks
```

**Stack order** (automatic via CDK dependencies):
1. `NetworkStack` → VPC, subnets, security groups
2. `DatabaseStack` → Aurora, ElastiCache, DynamoDB
3. `JobsStack` → SQS queues, EventBridge rules
4. `ApiGatewayStack` → REST API Gateway
5. `AlbStack` → Application Load Balancer
6. `LambdaStack` → All 58 Lambda functions + route wiring
7. `MonitoringStack` → CloudWatch dashboards + alarms
8. `WebSocketIntegrationStack` → WebSocket API Gateway

### Individual Lambda Deployment (Node.js)

For deploying a single handler without full CDK:

```bash
cd edulens-backend/services/<service-name>
npx esbuild src/handlers/<handler>.ts \
  --bundle --platform=node --target=node20 \
  --outfile=/tmp/<handler>.js \
  --external:@aws-sdk/*

cd /tmp
python3 -c "import zipfile; zf=zipfile.ZipFile('<handler>.zip','w',zipfile.ZIP_DEFLATED); zf.write('<handler>.js','index.js'); zf.close()"

aws lambda update-function-code \
  --function-name edulens-<name>-dev \
  --zip-file fileb:///tmp/<handler>.zip \
  --region us-west-2

aws lambda wait function-updated \
  --function-name edulens-<name>-dev \
  --region us-west-2
```

### Python Lambda Deployment (Profile Engine / Background Jobs)

```bash
rm -rf /tmp/profile-light-pkg && mkdir -p /tmp/profile-light-pkg

pip3 install sqlalchemy psycopg2-binary "pydantic>=1.10.0,<2.0.0" boto3 \
  -t /tmp/profile-light-pkg --quiet \
  --platform manylinux2014_x86_64 --only-binary=:all:

cp -r edulens-backend/services/profile-engine/src /tmp/profile-light-pkg/src

cd /tmp/profile-light-pkg
# Zip excluding __pycache__ and .pyc files
python3 -c "
import zipfile, os
with zipfile.ZipFile('/tmp/profile-light.zip','w',zipfile.ZIP_DEFLATED) as zf:
    for root,dirs,files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['__pycache__','.git']]
        for f in files:
            if f.endswith('.pyc'): continue
            fp = os.path.join(root,f); zf.write(fp, os.path.relpath(fp,'.'))
"

aws lambda update-function-code \
  --function-name edulens-error-patterns-aggregate-dev \
  --zip-file fileb:///tmp/profile-light.zip --region us-west-2
```

**Note**: Uses `requirements-light.txt` (excludes numpy/scipy) to stay under 250MB Lambda limit.

### Database Migrations

Via the `edulens-db-migrate-dev` Lambda:

```bash
aws lambda invoke \
  --function-name edulens-db-migrate-dev \
  --region us-west-2 \
  --payload '{"sql":"ALTER TABLE tests ADD COLUMN new_field VARCHAR(100)"}' \
  /tmp/out.json --cli-binary-format raw-in-base64-out

cat /tmp/out.json
```

### Local Development

**Docker Compose** (`edulens-backend/docker-compose.yml`):
```bash
docker-compose up -d  # PostgreSQL 15, Redis 7, LocalStack
```

**Frontend**:
```bash
cd edulens-frontend && npm run dev  # localhost:3000
```

**Mock Backend** (no Lambda deps):
```bash
node local-backend-server.js  # localhost:3001, mock AI responses
```

**Full Backend** (proxies to compiled Lambda handlers):
```bash
node local-full-backend-server.js  # localhost:3002
```

### Build Commands

| Service | Command | Notes |
|---------|---------|-------|
| Frontend | `cd edulens-frontend && npm run build` | Next.js static + server build |
| Frontend (dev) | `cd edulens-frontend && npm run dev` | Hot reload on :3000 |
| Frontend (lint) | `cd edulens-frontend && npm run lint` | ESLint |
| Frontend (types) | `cd edulens-frontend && npm run type-check` | `tsc --noEmit` |
| Node.js service | `cd edulens-backend/services/<svc> && npm run build` | esbuild or tsc |
| CDK | `cd edulens-infrastructure && npx cdk synth` | Synthesize CloudFormation |

---

## 10. Security

### Authentication

**JWT Token Flow**:
1. Parent calls `POST /auth/login` with email + password
2. Server verifies bcrypt hash, generates JWT with `{userId, email, role}`, 24h expiry
3. Client stores token (likely localStorage — no httpOnly cookie)
4. All subsequent requests include `Authorization: Bearer <token>` header
5. Each Lambda handler extracts and verifies JWT from headers

**Student Auth**: Students login via `POST /auth/student-login` with parent email + student name. No separate password — relies on the parent's account association.

**Admin Auth**: Admin endpoints use API key (`x-api-key` header) instead of JWT. Single shared key for all admin operations.

### Password Security

- **Hashing**: bcrypt with 10 salt rounds (`auth-service/src/lib/password.ts`)
- **Storage**: `password_hash` column in `users` table
- **No password requirements enforcement** visible in the registration handler

### CORS

- `cors()` middleware with default settings (allows all origins) in local servers
- API Gateway CORS configured in CDK stack
- ALB CORS headers added in streaming Lambda responses

### IAM (Infrastructure)

- Each Lambda function has a dedicated IAM role
- Policies grant access to: Aurora (via VPC + security groups), Secrets Manager (DB credentials), SQS (queue-specific send/receive), DynamoDB (WebSocket table), Bedrock (invoke model), S3 (if needed)
- VPC placement ensures Lambdas access RDS/Redis via private subnets
- VPC endpoints reduce NAT Gateway traffic for AWS service calls

### Data Protection

- Database credentials stored in AWS Secrets Manager
- Aurora encryption at rest (AWS-managed key)
- Redis in-transit encryption not explicitly configured
- No PII encryption at the application layer
- JWT tokens contain email in plaintext (base64-encoded payload)

### Known Security Concerns

1. **Hard-coded admin API key**: The API key `4ufbnf9yed7pNhTasnVpK64zCVgqACQp6AqMdQkI` is checked into CLAUDE.md. Should be rotated and stored only in Secrets Manager.

2. **No rate limiting**: Chat endpoints can be called without limits, potentially leading to Bedrock cost overruns.

3. **Student auth weakness**: Students authenticate with just parent email + student name — no password. Anyone who knows these two values can access the student account.

4. **JWT in localStorage**: Client-side token storage (if using localStorage) is vulnerable to XSS attacks. httpOnly cookies would be more secure.

5. **No CSRF protection**: No CSRF tokens on state-changing requests.

6. **Dynamic SQL fragments**: Some handlers construct ORDER BY clauses dynamically (e.g., `ORDER BY ${sortField}`), which could allow SQL injection if `sortField` is user-controlled without validation.

7. **No input length limits**: Chat message content has no maximum length validation, which could lead to large Bedrock API requests.

8. **CORS allow-all in local**: Local servers use `cors()` with no restrictions. Production CORS should be more restrictive.

---

## Appendix: File Count by Service

| Service | Handler Files | Lib Files | Total Source |
|---------|--------------|-----------|-------------|
| auth-service | 6 | 3 | 9 |
| test-engine | 18 | 5 | 23 |
| conversation-engine | 10 | 3 | 13 |
| profile-engine (Python) | 5 + 1 init | 2 | ~15 (incl. algorithms, services, database) |
| background-jobs (Python) | 5 | 0 | ~10 (incl. services) |
| admin-service | 9 | 1 | 10 |
| stage-registry | 9 | 2 | 11 |
| contest-service | 11 | 1 | 12 |
| shared/common | — | — | ~10 |
| shared/database | — | — | ~5 |
| **Total** | **~73 handlers** | **~17 libs** | **~120 source files** |

---

*End of analysis.*
