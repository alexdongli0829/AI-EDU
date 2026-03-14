# EduLens (学习透镜) — High-Level Architecture Summary

> **Version:** 2.1 | **Status:** Design Phase
> **Platform:** AWS | **Target:** NSW OC/Selective School Exam Prep Market

---

## Executive Summary

EduLens transforms NSW exam prep from static test reports into **conversational intelligence**. Parents talk to an AI that understands their child's learning patterns; students review mistakes through Socratic dialogue. The product differentiator is **conversation as interface** — replacing dashboards with natural dialogue grounded in structured test data.

**Core Innovation:** Multi-turn AI conversations that remember context across sessions, detect topic switches, and deliver insights naturally — like talking to an expert teacher who has studied every answer, every hesitation, every pattern.

**Platform:** AWS-native serverless architecture optimized for scale (100 → 10,000 users) with predictable costs and enterprise compliance.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Core Concept: Learning DNA](#2-core-concept-learning-dna)
3. [System Architecture](#3-system-architecture)
4. [AI Conversation Architecture](#4-ai-conversation-architecture)
5. [Technology Stack](#5-technology-stack)
6. [Cost & Economics](#6-cost--economics)
7. [Privacy & Compliance](#7-privacy--compliance)
8. [MVP Scope & Timeline](#8-mvp-scope--timeline)

---

## 1. Product Vision

### The Problem

NSW parents spend $5,000–$15,000/year on OC/Selective exam tutoring. They receive:
- Raw test scores (72%)
- Percentile rankings (#45 out of 120)
- PDF progress reports (generic)

**What's missing:** *Why* their child got questions wrong, whether errors are conceptual gaps or careless mistakes, whether they're rushing or genuinely confused.

### The Solution

**EduLens replaces the static report with a conversation.**

```
Traditional:          "Your child scored 72% on Math"
EduLens:              Parent: "Why is math low?"
                      AI: "Looking at the last 3 tests, Mia scored 7/10
                           on number patterns specifically. She's getting
                           the easy ones right, but rushing on the harder
                           ones — answers after Q25 averaged under 20
                           seconds each with 45% accuracy. This suggests
                           time pressure, not a fundamental gap."
```

### Positioning

> **For parents** preparing children for NSW OC and Selective School exams, **EduLens** is an AI academic assistant that transforms structured test data into a living student profile and delivers personalized guidance through conversation — so understanding your child's learning is as natural as talking to their best teacher.

### Value Proposition

| Dimension | Traditional Tutoring | MockStar (Online Tests) | **EduLens** |
|---|---|---|---|
| **Depth** | Expert but expensive | Scores only | Expert-depth insight |
| **Scale** | Limited availability | Unlimited | Platform scale |
| **Cost** | $500-1,000/month | $30-50/month | $30-60/month |
| **Interface** | In-person meetings | PDF reports | **Conversational AI** |
| **Continuity** | Session notes | None | Remembers all conversations |

**Key Insight:** The test is not the product — the understanding is. Tests are the data collection mechanism. The product is the intelligence that emerges from that data.

---

## 2. Core Concept: Learning DNA

### Why Not Just Scores?

Two students can both score 72% with completely different learning profiles:

- **Student A:** Strong in reading, weak in math reasoning, rushes easy questions, runs out of time on hard ones
- **Student B:** Solid across all areas but makes careless errors consistently — misreads questions, selects wrong options despite knowing the concept

EduLens builds a **Learning DNA** — a graph-based, multi-dimensional model of how a student learns, not just what they score.

### Learning DNA Components

```
Learning DNA
├── Skill Graph (what they know)
│   ├── Mastery levels per skill (0.0 - 1.0)
│   ├── Confidence scores
│   ├── Trends (improving | stable | declining)
│   └── Sample size (reliability indicator)
│
├── Error Pattern Profile (how they fail)
│   ├── Concept gaps (doesn't understand)
│   ├── Careless errors (knows it, got it wrong)
│   ├── Time pressure (rushed, guessed)
│   ├── Misread questions
│   └── Elimination failures
│
├── Time Behavior Model (how they work)
│   ├── Average time per question by difficulty
│   ├── Rush threshold (when speed increases, accuracy drops)
│   ├── Stamina curve (accuracy over test duration)
│   └── Completion rate
│
└── Confidence Estimator (how sure they are)
    ├── Answer change rate
    ├── Time on correct vs incorrect
    └── Calibration pattern
```

### How It Evolves

**Event-sourced architecture:** Every test, chat interaction, and behavior signal is an immutable event that updates the model. The profile never overwrites; it accumulates and recalculates.

```
Event Stream:
  [test_completed] → updates skill mastery, error profile, time behavior
  [question_answered] → granular skill + time data
  [chat_interaction] → refines error classification, updates confusion patterns
  [answer_changed] → updates confidence estimator
```

This enables:
- Parents can see how their child's profile has changed over time
- System detects trends ("improving in inference but declining in vocabulary")
- AI agents always have the latest, most complete picture

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                           │
│  Next.js (React) — Landing, Test UI, Chat UI, Dashboard    │
│  Hosted on: AWS Amplify + CloudFront CDN                    │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    API GATEWAY LAYER                         │
│  • API Gateway REST (CRUD operations)                        │
│  • API Gateway WebSocket (test timer sync)                   │
│  • Application Load Balancer (AI response streaming via SSE) │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 APPLICATION LAYER (Lambda)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Test Engine  │  │ Profile      │  │ Conversation │      │
│  │              │  │ Engine       │  │ Engine       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  Background Jobs: Summarization, Insight Extraction,         │
│                   Signal Processing                          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      DATA LAYER                              │
│  • RDS Aurora Serverless v2 (PostgreSQL) - Primary data     │
│  • ElastiCache (Redis) - Session state, agent state, cache  │
│  • S3 - Question images, PDF exports                         │
│  • DynamoDB - WebSocket connection tracking                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  EXTERNAL SERVICES                           │
│  • Claude API (Anthropic or AWS Bedrock)                     │
│  • SES (Email notifications)                                 │
│  • EventBridge (Scheduled jobs)                              │
│  • CloudWatch + X-Ray (Monitoring, tracing)                  │
└─────────────────────────────────────────────────────────────┘
```

### Bounded Contexts

The system is organized into four independent domains:

#### 1. Test Engine
**Purpose:** Deliver timed tests, capture timing data, score immediately

**Key Features:**
- Server-authoritative timer with robust state machine
- Per-question timing capture
- Answer change tracking (feeds confidence estimator)
- WebSocket for real-time timer sync

#### 2. Profile Engine
**Purpose:** Synthesize all signals into the Learning DNA model

**Key Features:**
- Skill graph with Bayesian mastery estimation
- Error pattern classifier (student-specific baselines, not global averages)
- Time behavior analyzer (detects rushing, fatigue)
- Event sourcing with schema versioning

#### 3. Conversation Engine
**Purpose:** Power all AI-driven conversations, grounded in structured data

**Key Features:**
- Student Explanation Agent (Socratic method)
- Parent Insight Agent (profile-grounded conversation)
- 3-tier memory system (short/medium/long-term)
- Context builder with token budget management
- Guardrails (prevent hallucinations, off-topic)

#### 4. Admin System
**Purpose:** Manage question bank and system configuration

**Key Features:**
- Question CRUD with skill tagging
- Quality assurance workflow
- Bulk import from CSV/JSON
- Question performance analytics

### Data Flow Example

```
Student takes test
    │
    ├─► Test Engine: Captures responses, timing, answer changes
    │
    ├─► Profile Engine: Updates Learning DNA
    │       ├─► Skill mastery recalculated (Bayesian)
    │       ├─► Error patterns classified
    │       ├─► Time behavior analyzed
    │       └─► Profile snapshot created (for trends)
    │
    ├─► Student reviews wrong answer in chat
    │       │
    │       └─► Conversation Engine
    │               ├─► Socratic dialogue
    │               ├─► Signal extraction (Did they understand?)
    │               └─► Error reclassification if needed
    │
    └─► Parent opens dashboard
            │
            └─► Conversation Engine: "How is she doing?"
                    ├─► Retrieves Learning DNA
                    ├─► Recalls past conversations (cross-session memory)
                    ├─► Detects topic (math? reading? time management?)
                    ├─► Builds context with token budget
                    └─► Streams response via SSE
```

---

## 4. AI Conversation Architecture

This is the **product differentiator** — sophisticated multi-turn conversations that feel like talking to a teacher who knows the student.

### Design Principles

1. **Grounded generation** — Every AI response traceable to structured data. No hallucinations.
2. **Constrained scope** — Student Agent talks about questions. Parent Agent talks about profile. Neither becomes a general chatbot.
3. **Memory is tiered** — Recent turns verbatim, older turns summarized, key insights promoted to profile.
4. **Context is budgeted** — Explicit token allocation prevents overflow.
5. **Sessions are persistent** — Browser close doesn't lose conversation.

### 3-Tier Memory System

```
┌─────────────────────────────────────────────────────────┐
│  TIER 1: SHORT-TERM (Current Session)                   │
│  Storage: RDS + ElastiCache                             │
│  Lifespan: Active session                               │
│  Content: Full messages verbatim (last 10 turns cached) │
│  Token cost: ~200-500 per turn                          │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼ (session ends or inactive 30 min)
┌─────────────────────────────────────────────────────────┐
│  TIER 2: MEDIUM-TERM (Conversation Summaries)           │
│  Storage: RDS (conversation_memory table)               │
│  Lifespan: 90 days                                      │
│  Content: 2-4 sentence summary, key topics, insights    │
│  Token cost: ~100-200 per conversation                  │
│  Use: Injected as preamble in future sessions           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼ (insights identified)
┌─────────────────────────────────────────────────────────┐
│  TIER 3: LONG-TERM (Learning DNA)                       │
│  Storage: RDS (student_profile JSONB)                   │
│  Lifespan: Permanent                                    │
│  Content: Durable insights (error reclassifications,    │
│           parent concerns, confusion patterns)          │
│  Token cost: 0 (already in profile data)               │
└─────────────────────────────────────────────────────────┘
```

**Example Flow:**

1. **Session 1:** Parent asks "Why is math low?"
   - AI responds with specific data from current test
   - Conversation stored in Tier 1 (messages table)

2. **Session 1 ends:** System summarizes
   - Summary: "Parent concerned about math performance, discussed number patterns weakness"
   - Stored in Tier 2 (conversation_memory table)

3. **Session 2 (2 weeks later):** Parent asks "Is math getting better?"
   - System loads Tier 2 summary: "Previously discussed number patterns"
   - AI response: "Last time we talked about number patterns. Good news — she's improved from 45% to 62%..."

4. **Insight promotion:** After 3 discussions about same topic
   - System promotes to Tier 3: Parent concern tracked in profile
   - Future agents automatically know this is a recurring concern

### Token Budget Management

**Fixed Budget:** 30,000 tokens per request

**Allocation:**
- System Prompt: 1,500 tokens (cached)
- Response Reserve: 4,000 tokens
- Grounding Data: 5,000 tokens (profile + test data, cached)
- Cross-Session Recall: 1,500 tokens (past conversation summaries)
- Conversation History: 18,000 tokens (recent turns verbatim, older turns summarized)

**Sliding Window:** When history exceeds budget, older turns compressed into ~200 token summary. Preserves continuity without overflow.

### Agent State Machine

Every conversation follows a 4-state lifecycle:

```
IDLE ──user message──► PROCESSING ──first token──► RESPONDING ──complete──► WAITING_FEEDBACK
  ▲                                                                              │
  └────────────────────────user message or timeout (30 min)─────────────────────┘
```

**States:**
- **IDLE:** Waiting for user input (UI: input ready)
- **PROCESSING:** Building context, calling Claude (UI: spinner)
- **RESPONDING:** Streaming tokens via SSE (UI: typing animation)
- **WAITING_FEEDBACK:** Response complete, ready for next turn (UI: suggested questions)

**Benefits:**
- UI always knows what to show (spinner, streaming text, input ready)
- Timeout handling at each state
- Error recovery with retry logic
- Monitoring/debugging easier (can see what state agent is in)

### Streaming Architecture

**Two streaming patterns for different needs:**

| Pattern | Use Case | Technology |
|---|---|---|
| **WebSocket** | Test timer sync | API Gateway WebSocket + DynamoDB |
| **SSE (Server-Sent Events)** | AI response streaming | ALB + Lambda streaming response |

**Why SSE for chat:**
- Unidirectional (server → client) sufficient for AI responses
- Native EventSource API with auto-reconnect
- Works over standard HTTP (CloudFront/ALB compatible)
- Simpler than WebSocket for this use case

### Cost Optimization

**Two strategies for 40-60% cost reduction:**

#### 1. Prompt Caching
System prompts and profile data are stable across turns within a session. Anthropic's `cache_control` avoids re-processing these tokens.

**Savings:** ~29% per multi-turn session
- Without caching: $0.0435/turn
- With caching: $0.031/turn
- At 1,000 sessions/month: **$120/month saved**

#### 2. Model Routing
Not every task needs expensive models.

| Task | Model | Rationale |
|---|---|---|
| Parent/Student chat | Sonnet ($3/$15 per MTok) | Quality-critical conversation |
| Summarization | Haiku ($0.25/$1.25 per MTok) | Compression task |
| Signal extraction | Haiku | Structured JSON extraction |
| Error classification | Haiku | Simple categorization |

**Savings:** Background tasks 12x cheaper with Haiku
- At 10,000 sessions/month: **$275/month saved** on background tasks

### Cross-Session Recall

Parents can reference past conversations naturally.

**How it works:**
1. New session starts: "Is she still rushing?"
2. System extracts topic keywords: ["rushing", "time_management"]
3. Queries Tier 2 memory for relevant past conversations
4. Injects as context preamble: "[2 weeks ago: Discussed rushing, suggested timer drills]"
5. AI response: "Last time we discussed this, the data showed..."

**Result:** Feels like talking to a teacher who remembers, not starting from scratch each time.

---

## 5. Technology Stack

### AWS-Native Architecture

**Why AWS:**
- Enterprise-grade scalability (100 → 10,000 users seamless)
- Sydney (ap-southeast-2) region for low-latency to NSW market
- Compliance-friendly (data residency, audit trails)
- Cost-effective serverless (pay for actual usage)

### Stack Overview

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js 14 + React | SSR for SEO, client-side for interactivity |
| **Styling** | Tailwind CSS | Rapid iteration, consistent design |
| **State** | React Context + SWR | Lightweight, no Redux overhead |
| **API** | Lambda + API Gateway | Serverless, auto-scaling, cost-effective |
| **Streaming** | ALB + Lambda (SSE), API Gateway (WebSocket) | Right tool for each use case |
| **Database** | RDS Aurora Serverless v2 (PostgreSQL) | JSONB for profiles, ACID for transactions, auto-scaling |
| **Cache** | ElastiCache (Redis) | Session state, agent state, message cache |
| **AI** | Claude API (Anthropic or AWS Bedrock) | Best-in-class for grounded conversation |
| **Jobs** | SQS + Lambda | Background processing (summarization, insights) |
| **Monitoring** | CloudWatch + X-Ray + Sentry | Logs, metrics, tracing, error tracking |

### AI Provider Options

**Option A: Anthropic Direct**
- Lower latency (no AWS proxy layer)
- Faster access to new models
- Separate billing

**Option B: AWS Bedrock**
- Single AWS bill (finance-friendly)
- IAM-based auth (no API key rotation)
- VPC private endpoints (compliance-friendly)
- Same features, slightly higher latency

**Recommendation:** Start with Anthropic Direct for simplicity, migrate to Bedrock if enterprise compliance becomes important.

### Why This Stack

**Single runtime:** Node.js for API + streaming, Python for ML/data pipeline
**Serverless first:** Pay for actual usage, auto-scaling, no server management
**Managed services:** RDS, ElastiCache, SQS — no operational overhead
**Battle-tested:** All components proven at scale (AWS Lambda handles billions of requests/day)

---

## 6. Cost & Economics

### MVP Cost (100 Active Users)

**Infrastructure:** ~$159/month
- Lambda: $12/month
- RDS Aurora Serverless v2: $60/month (0.5-1 ACU avg)
- ElastiCache: $12/month (t4g.micro)
- ALB: $18/month (SSE streaming)
- API Gateway + CloudFront + S3: $19/month
- Other (SQS, CloudWatch, etc.): $38/month

**AI (with optimization):** ~$162/month
- Parent chat (Sonnet): $104/month (1,000 sessions)
- Student chat (Sonnet): $53/month (900 sessions)
- Background tasks (Haiku): $5/month (summarization, extraction)

**Total:** ~$321/month

### Scale Economics (1,000 Active Users)

**Infrastructure:** ~$350/month (auto-scales)
- RDS ACU increases to 1.5-2 avg: $150/month
- ElastiCache scales to t4g.small: $24/month
- Lambda scales proportionally: $120/month
- Other services: $56/month

**AI (with optimization):** ~$1,622/month
- 10x sessions but per-session cost same due to caching

**Total:** ~$1,972/month

### Cost Optimization Impact

**Without optimization (all Sonnet, no caching):** ~$3,200/month at 1,000 users
**With optimization:** ~$1,972/month at 1,000 users
**Savings:** ~$1,228/month (38%)

**Key drivers:**
- Prompt caching: -29% on input tokens
- Model routing: 12x cheaper for background tasks
- Token budget management: Prevents waste

### Unit Economics

At 1,000 users, ~$2/user/month total cost.

**Pricing strategy:**
- Free: 1 test/month (freemium funnel)
- Starter: $19/month (breakeven at ~200 users)
- Premium: $49/month (target pricing, 25x margin)

---

## 7. Privacy & Compliance

### Australian Privacy Principles (APP) Compliance

**Key Requirements:**
- Explicit consent before data collection
- Clear explanation of AI processing
- Right to access (export data in JSON)
- Right to be forgotten (30-day deletion)
- Data residency (AWS Sydney region)
- Audit logging (all profile access)

**Implementation:**
- Consent checkboxes (not pre-checked) during signup
- Data retention policy (90 days for chats, indefinite for profiles while active)
- Export function (generates JSON, uploads to S3, emails presigned URL)
- Deletion workflow (soft delete with 30-day grace, then hard delete)
- Consent records table (tracks all consent changes with IP, user agent, timestamp)

### Data Handling

**What we collect:**
- Test responses and timing data
- Chat messages (student explanations, parent questions)
- Profile data (Learning DNA)

**What we DON'T collect:**
- No personally identifying information beyond email/name
- No tracking cookies for advertising
- No third-party analytics

**Third-party sharing:**
- Claude API receives: question content, student answers, profile summaries
- Claude API does NOT receive: student names, emails, addresses
- Anthropic's commitment: No model training on customer data (Enterprise agreement)

### Security

**Encryption:**
- At rest: RDS (AES-256), S3 (AES-256), ElastiCache (AES-256)
- In transit: TLS 1.3 (CloudFront, API Gateway, RDS)

**Access control:**
- IAM roles (least privilege)
- VPC private subnets (RDS, ElastiCache not internet-accessible)
- Lambda security groups (only necessary egress)

**Secrets management:**
- AWS Secrets Manager (API keys, DB credentials)
- Automatic rotation enabled

---

## 8. MVP Scope & Timeline

### Timeline: 16-20 Weeks

**Phase breakdown:**
- Weeks 1-6: Foundation (AWS infra, test engine, profile engine)
- Weeks 7-9: AI agents core (basic conversation)
- Weeks 10-11: Conversation architecture (3-tier memory, state machine, streaming)
- Weeks 12-15: Polish (cross-session recall, topic detection, cold start UX)
- Weeks 16-17: Testing (unit, integration, E2E, load)
- Weeks 18-19: Beta (20 users)
- Week 20: Launch

### MVP Features (Must Have)

**Test Experience:**
- OC timed test (30-35 questions, 30 min timer)
- Auto-scoring with skill breakdown
- Per-question timing capture

**Student Experience:**
- AI explanation chat (Socratic method)
- Review wrong answers with guided hints
- Progress indicators (understanding points)

**Parent Experience:**
- Learning DNA dashboard (skill radar, trends)
- AI chat (profile-grounded conversation)
- Multi-turn memory (can reference past conversations)
- Test history

**Admin:**
- Question CRUD (create, edit, tag)
- Bulk import (CSV/JSON)
- Quality assurance workflow

**Foundation:**
- Authentication (email/password, parent-student linking)
- Privacy compliance (consent, export, deletion)
- Mobile responsive
- Accessibility (WCAG 2.1 AA)

### Explicitly Cut from MVP

- ❌ Adaptive question selection
- ❌ Cohort comparison
- ❌ Multiple exam types (only OC)
- ❌ AI-generated questions
- ❌ Payment/subscription system (validate demand first)
- ❌ Native mobile app
- ❌ Multi-language support

### Success Metrics (Month 1)

| Metric | Target | Measurement |
|---|---|---|
| Tests completed | 100 | CloudWatch custom metric |
| Parent chat engagement | 60% initiate chat | Engagement rate = chat_sessions / test_completions |
| Return rate | 20% (2nd test within 2 weeks) | Cohort retention analysis |
| Student chat engagement | 40% review ≥1 wrong answer | % students using explanation chat |

---

## 9. Competitive Moat

### Why EduLens is Defensible

#### 1. The Living Profile (Learning DNA)
Every other platform treats each test as an isolated event. EduLens builds a cumulative, evolving model. After 5 tests, EduLens knows more about a student's learning patterns than most human tutors.

**Defensibility:** Data compounds over time. Switching means losing accumulated intelligence.

#### 2. Conversation as Interface
Parents don't want dashboards. They want to ask "Is she getting better?" and get a grounded, specific answer. The conversational interface is radically more accessible.

**Defensibility:** High-quality, profile-grounded conversation requires deep integration between profile engine and conversation engine. Not a chatbot bolt-on.

#### 3. Dual-Loop Signal Collection
```
Test Performance ──► Profile ──► Parent AI Response
       │                              │
       ▼                              ▼
Student Chat ──────► Profile    Parent questions reveal
(adds confusion       update    what parents actually
 pattern signals)               care about
```

Student chat during error review adds signal no test-only platform can capture. When a student says "I thought it was asking about X," the system learns something a score never reveals.

**Defensibility:** This dual signal loop creates a data advantage that grows with every interaction.

#### 4. Parent-First Value Delivery
In NSW market, parents are the buyer. Every competitor sells to students and reports to parents as afterthought. EduLens makes the parent experience the primary product surface.

**Defensibility:** Market positioning is hard to copy.

#### 5. AU Exam Specificity
Question bank, skill taxonomy, and error patterns tuned to NSW OC and Selective School exams specifically.

**Defensibility:** Niche focus creates depth generalist platforms can't match without significant investment.

### Competitive Landscape

| Competitor | Strengths | Weaknesses | EduLens Advantage |
|---|---|---|---|
| **MockStar** | Large question bank, established brand | Static PDF reports, no AI insight | Conversational intelligence |
| **Private tutors** | Deep personalization, relationship | $60-100/hr, limited availability | Always available, 1/10th cost, data persistence |
| **Generic AI tutors** (Khanmigo) | Good AI, broad coverage | Not AU exam-focused, no parent interface | NSW-specific, parent-first |

---

## 10. Next Steps

### For Product Team
1. Review MVP scope — are these the right features to validate demand?
2. Validate timeline (16-20 weeks) against launch goals
3. Review success metrics — are these measurable and achievable?

### For Engineering Team
1. Review architecture — does this align with team's AWS expertise?
2. Review tech stack — any concerns about chosen technologies?
3. Review cost estimates — do these align with budget expectations?

### For Business Team
1. Review unit economics — is $2/user/month acceptable at scale?
2. Review pricing strategy — does $19-49/month pricing make sense?
3. Review competitive positioning — is the moat defensible?

### For Compliance/Legal
1. Review privacy requirements — is APP compliance plan sufficient?
2. Review data handling — any concerns about Claude API usage?
3. Review consent flows — are these legally sound?

---

## Appendices

### A. Key Design Decisions Summary

| Decision | Rationale | Trade-off |
|---|---|---|
| AWS over Vercel | Enterprise scalability, compliance, data residency | More infrastructure complexity |
| 3-tier memory | Balances cost (summarization) with UX (continuity) | Context building complexity |
| SSE + WebSocket | Right tool for each job | Two patterns to maintain |
| Prompt caching | 29% cost reduction for minimal implementation effort | Cache management complexity |
| Model routing | 40-60% savings on background tasks | Routing logic complexity |
| Event sourcing | Profile evolution tracking, audit trail | Storage overhead, replay complexity |

### B. Technology Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Vercel instead of AWS** | Simpler but lacks enterprise features, compliance controls |
| **MongoDB instead of PostgreSQL** | Relational integrity matters for questions/tests, JSONB gives schema flexibility anyway |
| **ECS instead of Lambda** | Higher baseline cost, slower scaling, more ops overhead |
| **Redis only (no RDS)** | Need ACID transactions, relational queries, durable storage |
| **OpenAI instead of Claude** | Claude better for grounded generation, instruction-following, long-context handling |

### C. Phased Implementation Strategy

**If timeline pressure exists, can phase as follows:**

**Phase 1A (9 weeks):** Basic conversation
- Single-turn chat (no memory)
- Essential features only
- Launch to validate demand

**Phase 1B (4 weeks):** Memory & streaming
- Add 3-tier memory
- Add SSE streaming
- Improve UX significantly

**Phase 1C (3 weeks):** Cost optimization
- Add prompt caching
- Add model routing
- Reduce costs 38%

**Recommendation:** Build full MVP (16-20 weeks) if timeline allows. The conversation sophistication is the product differentiator.

---

**Document Purpose:** This high-level architecture provides strategic overview without implementation details. For detailed schemas, code samples, and implementation checklists, see the full HLD document (AI-EDU-HighLevel-Design.md).

**Revision History:**
- v2.1: Integrated 3-tier conversation memory, agent state machine, prompt caching, cross-session recall
- v2.0: AWS-native architecture, privacy compliance, question bank strategy
- v1.0: Initial product concept and basic architecture
