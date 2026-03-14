# EduLens Backend Architecture

## 📊 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            INTERNET                                  │
└────────────┬──────────────────────┬──────────────────┬──────────────┘
             │                      │                  │
             │                      │                  │
    ┌────────▼────────┐   ┌────────▼────────┐   ┌────▼─────┐
    │  API Gateway    │   │      ALB        │   │CloudFront│
    │  (REST + WS)    │   │  (SSE Stream)   │   │(Frontend)│
    └────────┬────────┘   └────────┬────────┘   └──────────┘
             │                      │
             └──────────┬───────────┘
                        │
        ┌───────────────┴───────────────┐
        │            VPC                │
        │  ┌─────────────────────────┐  │
        │  │  Lambda Functions       │  │
        │  │  (24 functions)         │  │
        │  │                         │  │
        │  │  ┌──────────────────┐   │  │
        │  │  │ Test Engine      │   │  │
        │  │  │ Conversation Eng │   │  │
        │  │  │ Profile Engine   │   │  │
        │  │  │ Background Jobs  │   │  │
        │  │  │ Admin Service    │   │  │
        │  │  └──────────────────┘   │  │
        │  └────────┬────────────────┘  │
        │           │                    │
        │  ┌────────┴────────────────┐  │
        │  │   Data Layer            │  │
        │  │  ┌─────────────────┐    │  │
        │  │  │ Aurora Postgres │    │  │
        │  │  │ (Serverless v2) │    │  │
        │  │  └─────────────────┘    │  │
        │  │  ┌─────────────────┐    │  │
        │  │  │ Redis Cache     │    │  │
        │  │  │ (ElastiCache)   │    │  │
        │  │  └─────────────────┘    │  │
        │  │  ┌─────────────────┐    │  │
        │  │  │ DynamoDB        │    │  │
        │  │  │ (Connections)   │    │  │
        │  │  └─────────────────┘    │  │
        │  └─────────────────────────┘  │
        └───────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
   ┌────▼──────┐              ┌────────▼─────┐
   │EventBridge│              │      SQS     │
   │  (Rules)  │              │   (Queues)   │
   └───────────┘              └──────────────┘
        │                              │
        └──────────┬───────────────────┘
                   │
           ┌───────▼────────┐
           │  AWS Bedrock   │
           │ (Claude Models)│
           └────────────────┘
```

## 🏗️ Detailed Service Architecture

### 1. Test Engine Service (TypeScript/Node.js)

**Purpose**: Adaptive testing with IRT (Item Response Theory)

```
┌─────────────────────────────────────────────────────┐
│              Test Engine Service                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────────┐        ┌──────────────────┐   │
│  │  API Handlers  │        │  Core Logic      │   │
│  ├────────────────┤        ├──────────────────┤   │
│  │ • Create Test  │───────▶│ • IRT Algorithm  │   │
│  │ • Get Test     │        │ • Question Select│   │
│  │ • Start Session│        │ • Difficulty Calc│   │
│  │ • Submit Answer│        │ • Scoring        │   │
│  │ • End Session  │        └─────────┬────────┘   │
│  └────────┬───────┘                  │            │
│           │                          │            │
│           └──────────┬───────────────┘            │
│                      │                            │
│           ┌──────────▼──────────┐                 │
│           │  Aurora PostgreSQL  │                 │
│           ├─────────────────────┤                 │
│           │ • tests             │                 │
│           │ • questions         │                 │
│           │ • test_sessions     │                 │
│           │ • responses         │                 │
│           │ • results           │                 │
│           └─────────────────────┘                 │
│                      │                            │
│           ┌──────────▼──────────┐                 │
│           │   Redis Cache       │                 │
│           ├─────────────────────┤                 │
│           │ • Active sessions   │                 │
│           │ • Question pool     │                 │
│           │ • User state        │                 │
│           └─────────────────────┘                 │
│                                                   │
│  On Test Complete:                                │
│  ──────────────────                               │
│           │                                       │
│           ▼                                       │
│  ┌─────────────────┐                             │
│  │  EventBridge    │                             │
│  │  Publish Event  │                             │
│  │  "test.completed"│                            │
│  └─────────────────┘                             │
│           │                                       │
│           ▼                                       │
│  ┌─────────────────┐                             │
│  │ Profile Engine  │                             │
│  │ (Triggered)     │                             │
│  └─────────────────┘                             │
└─────────────────────────────────────────────────┘

**Lambda Functions:**
1. create-test - Create new adaptive test
2. get-test - Retrieve test details
3. start-test-session - Initialize testing session
4. submit-answer - Process student answer, update IRT
5. end-test-session - Finalize results, publish event
```

### 2. Conversation Engine Service (TypeScript/Node.js)

**Purpose**: AI-powered tutoring with streaming responses

```
┌──────────────────────────────────────────────────────────┐
│           Conversation Engine Service                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │         Chat Flow (Parent & Student)         │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  REST API (Non-Streaming)                               │
│  ───────────────────────                                │
│  ┌────────────┐     ┌──────────┐    ┌──────────┐       │
│  │Create Chat │────▶│ Save to  │───▶│ Return   │       │
│  │ Session    │     │ Database │    │SessionID │       │
│  └────────────┘     └──────────┘    └──────────┘       │
│                                                          │
│  ┌────────────┐     ┌──────────┐    ┌──────────┐       │
│  │Get Messages│────▶│Query DB  │───▶│ Return   │       │
│  │            │     │& Redis   │    │ History  │       │
│  └────────────┘     └──────────┘    └──────────┘       │
│                                                          │
│  ALB + SSE (Streaming)                                  │
│  ──────────────────                                     │
│  ┌────────────────────────────────────────────┐         │
│  │  Send Message (Streaming)                 │         │
│  │  ┌──────────┐                             │         │
│  │  │1. Receive│                             │         │
│  │  │  Message │                             │         │
│  │  └────┬─────┘                             │         │
│  │       │                                   │         │
│  │  ┌────▼─────────────┐                     │         │
│  │  │2. Load Context   │                     │         │
│  │  │   • Chat History │                     │         │
│  │  │   • Student Prof │                     │         │
│  │  │   • Learning Obj │                     │         │
│  │  └────┬─────────────┘                     │         │
│  │       │                                   │         │
│  │  ┌────▼─────────────┐                     │         │
│  │  │3. AWS Bedrock    │                     │         │
│  │  │   Claude 3.5     │                     │         │
│  │  │   (Streaming)    │                     │         │
│  │  └────┬─────────────┘                     │         │
│  │       │                                   │         │
│  │  ┌────▼─────────────┐                     │         │
│  │  │4. SSE Stream     │                     │         │
│  │  │   • content_block │                    │         │
│  │  │   • delta        │                     │         │
│  │  │   • complete     │                     │         │
│  │  └────┬─────────────┘                     │         │
│  │       │                                   │         │
│  │  ┌────▼─────────────┐                     │         │
│  │  │5. Save Complete  │                     │         │
│  │  │   Response       │                     │         │
│  │  └──────────────────┘                     │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  WebSocket (Real-time Timer Sync)                       │
│  ──────────────────────────────                         │
│  ┌────────────┐     ┌──────────┐    ┌──────────┐       │
│  │ $connect   │────▶│Save conn │───▶│ DynamoDB │       │
│  │            │     │to table  │    │          │       │
│  └────────────┘     └──────────┘    └──────────┘       │
│                                                          │
│  ┌────────────┐     ┌──────────┐    ┌──────────┐       │
│  │$disconnect │────▶│Remove    │───▶│ DynamoDB │       │
│  │            │     │from table│    │          │       │
│  └────────────┘     └──────────┘    └──────────┘       │
│                                                          │
│  ┌────────────┐     ┌──────────┐    ┌──────────┐       │
│  │Timer Sync  │────▶│Query     │───▶│Broadcast │       │
│  │(EventBridge│     │Active    │    │to clients│       │
│  │ 1 min)     │     │Sessions  │    │          │       │
│  └────────────┘     └──────────┘    └──────────┘       │
│                                                          │
│  On Session End:                                        │
│  ───────────────                                        │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐                                   │
│  │  EventBridge    │                                   │
│  │  Publish Event  │                                   │
│  │"chat_session.   │                                   │
│  │    ended"       │                                   │
│  └─────────────────┘                                   │
│           │                                             │
│           ▼                                             │
│  ┌─────────────────┐                                   │
│  │ Summarization   │                                   │
│  │  Queue (SQS)    │                                   │
│  └─────────────────┘                                   │
└──────────────────────────────────────────────────────────┘

**Lambda Functions:**
1. parent-chat-create - Create parent chat session
2. parent-chat-send-stream - Stream AI responses (ALB)
3. parent-chat-get-messages - Get chat history
4. parent-chat-end-session - End session, trigger summarization
5. student-chat-create - Create student chat session
6. student-chat-send-stream - Stream AI responses (ALB)
7. student-chat-get-messages - Get chat history
8. student-chat-end-session - End session, trigger summarization
9. websocket-connect - Handle WebSocket connections
10. websocket-disconnect - Handle WebSocket disconnections
11. timer-sync - Broadcast timer updates (EventBridge)
```

### 3. Profile Engine Service (Python)

**Purpose**: Calculate student learning profiles using ML

```
┌─────────────────────────────────────────────────────┐
│              Profile Engine Service                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Trigger: EventBridge "test.completed"             │
│  ────────────────────────────────                  │
│                                                     │
│  ┌────────────────────────────────────────┐        │
│  │  Profile Calculation Pipeline          │        │
│  │                                        │        │
│  │  1. Receive Event                      │        │
│  │     ├─ student_id                      │        │
│  │     ├─ test_session_id                 │        │
│  │     └─ test_results                    │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  2. Fetch Historical Data              │        │
│  │     ├─ Previous test results           │        │
│  │     ├─ Chat interactions               │        │
│  │     ├─ Response patterns               │        │
│  │     └─ Time spent per topic            │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  3. ML Model Inference                 │        │
│  │     ├─ Calculate IRT parameters        │        │
│  │     │  • Ability (θ)                   │        │
│  │     │  • Difficulty (b)                │        │
│  │     │  • Discrimination (a)            │        │
│  │     ├─ Knowledge state modeling        │        │
│  │     ├─ Skill gap analysis              │        │
│  │     └─ Learning trajectory             │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  4. Generate Profile                   │        │
│  │     ├─ Strength areas                  │        │
│  │     ├─ Weak areas                      │        │
│  │     ├─ Recommended focus topics        │        │
│  │     ├─ Estimated mastery levels        │        │
│  │     └─ Next test difficulty            │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  5. Save to Database                   │        │
│  │     └─ student_profiles table          │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  6. Cache in Redis                     │        │
│  │     └─ profile:{student_id}            │        │
│  └────────────────────────────────────────┘        │
│                                                     │
│  ┌─────────────────────────────────┐               │
│  │      Data Sources               │               │
│  ├─────────────────────────────────┤               │
│  │ • test_results                  │               │
│  │ • responses (IRT data)          │               │
│  │ • chat_messages                 │               │
│  │ • time_on_task                  │               │
│  │ • interaction_patterns          │               │
│  └─────────────────────────────────┘               │
│                                                     │
│  ┌─────────────────────────────────┐               │
│  │      ML Components              │               │
│  ├─────────────────────────────────┤               │
│  │ • IRT Model (3PL)               │               │
│  │ • Knowledge Tracing             │               │
│  │ • Skill Graph Analysis          │               │
│  │ • Bayesian Knowledge Tracing    │               │
│  └─────────────────────────────────┘               │
└─────────────────────────────────────────────────────┘

**Lambda Function:**
1. calculate-profile - ML-based profile calculation
```

### 4. Background Jobs Service (Python)

**Purpose**: Async processing of conversations and insights

```
┌─────────────────────────────────────────────────────┐
│           Background Jobs Service                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Job 1: Conversation Summarization                 │
│  ──────────────────────────────────                │
│                                                     │
│  Trigger: SQS Queue (from chat_session.ended)     │
│                                                     │
│  ┌────────────────────────────────────────┐        │
│  │  Summarization Pipeline                │        │
│  │                                        │        │
│  │  1. Receive Message from Queue         │        │
│  │     └─ session_id                      │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  2. Fetch Conversation                 │        │
│  │     ├─ All messages                    │        │
│  │     ├─ Timestamps                      │        │
│  │     ├─ User/AI roles                   │        │
│  │     └─ Context                         │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  3. AWS Bedrock - Summarization        │        │
│  │     Prompt: "Summarize this tutoring   │        │
│  │              session focusing on:      │        │
│  │              - Key topics discussed    │        │
│  │              - Student understanding   │        │
│  │              - Areas needing help      │        │
│  │              - Action items"           │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  4. Parse Summary                      │        │
│  │     ├─ Key topics                      │        │
│  │     ├─ Understanding level             │        │
│  │     ├─ Misconceptions                  │        │
│  │     └─ Recommendations                 │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  5. Save Summary                       │        │
│  │     └─ conversation_summaries table    │        │
│  └────────────────────────────────────────┘        │
│                                                     │
│  Job 2: Daily Insights Generation                  │
│  ─────────────────────────────────                 │
│                                                     │
│  Trigger: EventBridge (Daily at 2 AM UTC)          │
│                                                     │
│  ┌────────────────────────────────────────┐        │
│  │  Insights Pipeline                     │        │
│  │                                        │        │
│  │  1. Aggregate Daily Data               │        │
│  │     ├─ All test results (last 24h)     │        │
│  │     ├─ All conversations               │        │
│  │     ├─ Student progress                │        │
│  │     └─ Usage patterns                  │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  2. Generate Insights per Student      │        │
│  │     ├─ Learning velocity               │        │
│  │     ├─ Engagement level                │        │
│  │     ├─ Skill progression               │        │
│  │     └─ At-risk indicators              │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  3. AWS Bedrock - Insight Generation   │        │
│  │     Prompt: "Based on student data:    │        │
│  │              - Identify trends         │        │
│  │              - Suggest interventions   │        │
│  │              - Predict outcomes"       │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  4. Save Insights                      │        │
│  │     └─ student_insights table          │        │
│  │           │                            │        │
│  │           ▼                            │        │
│  │  5. Send to Insights Queue             │        │
│  │     └─ For parent notifications        │        │
│  └────────────────────────────────────────┘        │
│                                                     │
│  Error Handling:                                   │
│  ───────────────                                   │
│  • maxReceiveCount: 3 (summarization)              │
│  • maxReceiveCount: 2 (insights)                   │
│  • Failed messages → DLQ                           │
│  • CloudWatch Alarms on DLQ depth                  │
└─────────────────────────────────────────────────────┘

**Lambda Functions:**
1. summarization-worker - Summarize conversations (SQS)
2. insights-worker - Generate learning insights (SQS)
```

### 5. Admin Service (TypeScript/Node.js)

**Purpose**: Question bank management and analytics

```
┌─────────────────────────────────────────────────────┐
│              Admin Service                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  All endpoints require API Key authentication      │
│  ──────────────────────────────────────────        │
│                                                     │
│  ┌────────────────────────────────────────┐        │
│  │  Question Management                   │        │
│  │                                        │        │
│  │  POST   /api/admin/questions           │        │
│  │  GET    /api/admin/questions           │        │
│  │  PUT    /api/admin/questions/{id}      │        │
│  │  DELETE /api/admin/questions/{id}      │        │
│  │                                        │        │
│  │  Features:                             │        │
│  │  • CRUD operations                     │        │
│  │  • IRT parameter validation            │        │
│  │  • Question versioning                 │        │
│  │  • Taxonomy tagging                    │        │
│  └────────────────────────────────────────┘        │
│                                                     │
│  ┌────────────────────────────────────────┐        │
│  │  Bulk Operations                       │        │
│  │                                        │        │
│  │  POST /api/admin/bulk/import           │        │
│  │  • CSV/JSON upload                     │        │
│  │  • Batch validation                    │        │
│  │  • Rollback on error                   │        │
│  │                                        │        │
│  │  GET  /api/admin/bulk/export           │        │
│  │  • Export to CSV/JSON                  │        │
│  │  • Include IRT params                  │        │
│  │  • Filter by criteria                  │        │
│  └────────────────────────────────────────┘        │
│                                                     │
│  ┌────────────────────────────────────────┐        │
│  │  Analytics & Metrics                   │        │
│  │                                        │        │
│  │  GET /api/admin/analytics/metrics      │        │
│  │  • System health                       │        │
│  │  • Usage statistics                    │        │
│  │  • Performance metrics                 │        │
│  │                                        │        │
│  │  GET /api/admin/analytics/students/{id}│        │
│  │  • Student performance                 │        │
│  │  • Learning curves                     │        │
│  │  • Engagement metrics                  │        │
│  └────────────────────────────────────────┘        │
│                                                     │
│  ┌─────────────────────────────────┐               │
│  │      Data Operations            │               │
│  ├─────────────────────────────────┤               │
│  │ • Transactional writes          │               │
│  │ • Batch processing              │               │
│  │ • Audit logging                 │               │
│  │ • Cache invalidation            │               │
│  └─────────────────────────────────┘               │
└─────────────────────────────────────────────────────┘

**Lambda Functions:**
1. admin-create-question - Add new question
2. admin-update-question - Update question
3. admin-delete-question - Delete question
4. admin-list-questions - List/search questions
5. admin-import-questions - Bulk import
6. admin-export-questions - Bulk export
7. admin-system-metrics - System analytics
8. admin-student-analytics - Student metrics
```

## 📊 Data Flow Diagrams

### Student Takes Test Flow

```
┌─────────┐
│ Student │
└────┬────┘
     │
     │ 1. POST /api/tests/{testId}/sessions
     ▼
┌─────────────────┐
│  API Gateway    │
└────┬────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  Lambda: start-test-session                │
│  ┌──────────────────────────────────────┐  │
│  │ 1. Fetch test configuration          │  │
│  │ 2. Load student profile from cache   │  │
│  │ 3. Select first question (IRT)       │  │
│  │ 4. Create session in DB              │  │
│  │ 5. Cache session state in Redis      │  │
│  └──────────────────────────────────────┘  │
└────┬───────────────────────────────────────┘
     │
     │ Return: { sessionId, firstQuestion }
     ▼
┌─────────┐
│ Student │ (Answers question)
└────┬────┘
     │
     │ 2. POST /api/sessions/{id}/answers
     ▼
┌─────────────────┐
│  API Gateway    │
└────┬────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  Lambda: submit-answer                     │
│  ┌──────────────────────────────────────┐  │
│  │ 1. Validate answer                   │  │
│  │ 2. Calculate if correct              │  │
│  │ 3. Update IRT ability estimate (θ)   │  │
│  │ 4. Select next question adaptively   │  │
│  │ 5. Save response to DB               │  │
│  │ 6. Update Redis session state        │  │
│  └──────────────────────────────────────┘  │
└────┬───────────────────────────────────────┘
     │
     │ Return: { correct, nextQuestion }
     │ (Repeat until test complete)
     ▼
┌─────────┐
│ Student │
└────┬────┘
     │
     │ 3. POST /api/sessions/{id}/end
     ▼
┌─────────────────┐
│  API Gateway    │
└────┬────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  Lambda: end-test-session                  │
│  ┌──────────────────────────────────────┐  │
│  │ 1. Calculate final score             │  │
│  │ 2. Generate result report            │  │
│  │ 3. Save to database                  │  │
│  │ 4. Clear Redis session               │  │
│  │ 5. Publish "test.completed" event    │  │
│  └──────────────────────────────────────┘  │
└────┬───────────────────────────────────────┘
     │
     │ Publish Event
     ▼
┌─────────────────┐
│  EventBridge    │
└────┬────────────┘
     │
     │ Route to: test.completed rule
     ▼
┌────────────────────────────────────────────┐
│  Lambda: calculate-profile                 │
│  ┌──────────────────────────────────────┐  │
│  │ ML model processes test results      │  │
│  │ Updates student profile               │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

### AI Tutor Chat Flow (with Streaming)

```
┌─────────┐
│ Student │
└────┬────┘
     │
     │ 1. POST /api/chat/student/sessions
     ▼
┌─────────────────┐
│  API Gateway    │
└────┬────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  Lambda: student-chat-create               │
│  • Create chat session                     │
│  • Initialize context                      │
└────┬───────────────────────────────────────┘
     │
     │ Return: { sessionId }
     ▼
┌─────────┐
│ Student │ (Sends message)
└────┬────┘
     │
     │ 2. POST /student-chat/{id}/send
     │    (via ALB for streaming)
     ▼
┌─────────────────┐
│      ALB        │
└────┬────────────┘
     │
     ▼
┌────────────────────────────────────────────────┐
│  Lambda: student-chat-send-stream              │
│  ┌──────────────────────────────────────────┐  │
│  │ 1. Load chat history                     │  │
│  │ 2. Load student profile                  │  │
│  │ 3. Build context for AI                  │  │
│  │                                          │  │
│  │ 4. Call AWS Bedrock (Streaming)         │  │
│  │    ┌───────────────────────┐            │  │
│  │    │ AWS Bedrock           │            │  │
│  │    │ Claude 3.5 Sonnet     │            │  │
│  │    │                       │            │  │
│  │    │ System Prompt:        │            │  │
│  │    │ "You are a patient    │            │  │
│  │    │  tutor helping with   │            │  │
│  │    │  [subject]. Student   │            │  │
│  │    │  profile: [data]"     │            │  │
│  │    └───────────────────────┘            │  │
│  │              │                          │  │
│  │              ▼                          │  │
│  │ 5. Stream response via SSE              │  │
│  │    ┌──────────────────┐                 │  │
│  │    │ event: content   │                 │  │
│  │    │ data: "Let me"   │                 │  │
│  │    │ ──────────────   │                 │  │
│  │    │ event: content   │                 │  │
│  │    │ data: " help"    │                 │  │
│  │    │ ──────────────   │                 │  │
│  │    │ event: content   │                 │  │
│  │    │ data: " you..."  │                 │  │
│  │    │ ──────────────   │                 │  │
│  │    │ event: done      │                 │  │
│  │    └──────────────────┘                 │  │
│  │              │                          │  │
│  │              ▼                          │  │
│  │ 6. Save complete message to DB          │  │
│  │ 7. Update Redis cache                   │  │
│  └──────────────────────────────────────────┘  │
└────┬───────────────────────────────────────────┘
     │
     │ SSE Stream
     ▼
┌─────────┐
│ Student │ (Sees response in real-time)
└────┬────┘
     │
     │ 3. POST /api/chat/student/sessions/{id}/end
     ▼
┌─────────────────┐
│  API Gateway    │
└────┬────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  Lambda: student-chat-end-session          │
│  ┌──────────────────────────────────────┐  │
│  │ 1. Mark session as ended             │  │
│  │ 2. Publish "chat_session.ended"      │  │
│  └──────────────────────────────────────┘  │
└────┬───────────────────────────────────────┘
     │
     ▼
┌─────────────────┐
│  EventBridge    │
└────┬────────────┘
     │
     │ Route to: chat_session.ended rule
     ▼
┌─────────────────┐
│  SQS Queue      │
│ (Summarization) │
└────┬────────────┘
     │
     ▼
┌────────────────────────────────────────────┐
│  Lambda: summarization-worker              │
│  • Generate conversation summary           │
│  • Extract key learning points             │
└────────────────────────────────────────────┘
```

### Background Processing Flow

```
┌─────────────────┐
│  EventBridge    │
│  (Hourly Cron)  │
└────┬────────────┘
     │
     │ Every hour
     ▼
┌────────────────────────────────────────────┐
│  Lambda: batch-processing                  │
│  ┌──────────────────────────────────────┐  │
│  │ 1. Query unsummarized sessions       │  │
│  │ 2. For each session:                 │  │
│  │    └─ Send to summarization queue    │  │
│  └──────────────────────────────────────┘  │
└────┬───────────────────────────────────────┘
     │
     ▼
┌─────────────────┐     ┌──────────────────────────┐
│  SQS Queue      │────▶│ Lambda: summarization-   │
│ (Summarization) │     │        worker            │
└─────────────────┘     │ • Process conversation   │
                        │ • Generate summary       │
                        │ • Save to database       │
                        └──────────────────────────┘

┌─────────────────┐
│  EventBridge    │
│ (Daily 2AM UTC) │
└────┬────────────┘
     │
     │ Daily
     ▼
┌────────────────────────────────────────────┐
│  Lambda: daily-insights                    │
│  ┌──────────────────────────────────────┐  │
│  │ 1. Aggregate all student data        │  │
│  │ 2. For each student:                 │  │
│  │    └─ Send to insights queue         │  │
│  └──────────────────────────────────────┘  │
└────┬───────────────────────────────────────┘
     │
     ▼
┌─────────────────┐     ┌──────────────────────────┐
│  SQS Queue      │────▶│ Lambda: insights-worker  │
│   (Insights)    │     │ • Run ML models          │
└─────────────────┘     │ • Generate insights      │
                        │ • Save recommendations   │
                        └──────────────────────────┘
```

## 🗄️ Database Schema (Simplified)

### Aurora PostgreSQL Tables

```sql
-- Users
users (
  id, email, name, role,
  created_at, updated_at
)

-- Tests
tests (
  id, title, subject,
  difficulty_range,
  question_count,
  created_at
)

-- Questions
questions (
  id, test_id, content,
  correct_answer, options,
  difficulty, discrimination, guessing,  -- IRT parameters
  taxonomy_tags,
  created_at, updated_at
)

-- Test Sessions
test_sessions (
  id, test_id, student_id,
  started_at, ended_at,
  status, final_score
)

-- Responses
responses (
  id, session_id, question_id,
  student_answer, is_correct,
  time_spent, theta_estimate,  -- IRT ability
  created_at
)

-- Results
test_results (
  id, session_id, student_id,
  score, theta_final,
  strengths, weaknesses,
  created_at
)

-- Chat Sessions
chat_sessions (
  id, student_id, parent_id,
  session_type, status,
  started_at, ended_at
)

-- Chat Messages
chat_messages (
  id, session_id, role,
  content, tokens,
  created_at
)

-- Conversation Summaries
conversation_summaries (
  id, session_id,
  summary, key_topics,
  understanding_level,
  created_at
)

-- Student Profiles
student_profiles (
  id, student_id,
  ability_estimate, confidence_interval,
  skill_levels, learning_velocity,
  strengths, weaknesses,
  updated_at
)

-- Student Insights
student_insights (
  id, student_id,
  insight_date, insight_type,
  content, recommendations,
  created_at
)
```

### Redis Cache Keys

```
session:{session_id}          # Active test session state
profile:{student_id}           # Student profile cache
questions:pool:{test_id}       # Question pool for test
chat:history:{session_id}      # Recent chat messages
```

### DynamoDB Tables

```
websocket_connections (
  connectionId (PK),
  sessionId (GSI),
  userId,
  connectedAt,
  ttl
)
```

## 🔄 Event-Driven Architecture

### EventBridge Event Patterns

```typescript
// Test Completed Event
{
  source: "edulens.test-engine",
  detailType: "test.completed",
  detail: {
    sessionId: "uuid",
    studentId: "uuid",
    testId: "uuid",
    score: 85,
    thetaEstimate: 0.75,
    completedAt: "2024-03-13T10:30:00Z"
  }
}

// Chat Session Ended Event
{
  source: "edulens.conversation-engine",
  detailType: "chat_session.ended",
  detail: {
    sessionId: "uuid",
    studentId: "uuid",
    messageCount: 12,
    duration: 1800,
    endedAt: "2024-03-13T10:30:00Z"
  }
}
```

### SQS Message Formats

```typescript
// Summarization Queue Message
{
  sessionId: "uuid",
  studentId: "uuid",
  messageCount: 12,
  priority: "normal"
}

// Insights Queue Message
{
  studentId: "uuid",
  dataDate: "2024-03-13",
  insightType: "daily"
}
```

## 🔐 Security Architecture

```
┌────────────────────────────────────────┐
│         Security Layers                │
├────────────────────────────────────────┤
│                                        │
│  1. Network Layer                      │
│     • VPC with private subnets         │
│     • Security Groups (least privilege)│
│     • NAT Gateway for outbound         │
│                                        │
│  2. API Layer                          │
│     • API Gateway throttling           │
│     • WAF rules (production)           │
│     • API Key for admin endpoints      │
│     • JWT authentication               │
│                                        │
│  3. Application Layer                  │
│     • Lambda IAM roles                 │
│     • Secrets Manager for DB creds     │
│     • No hardcoded secrets             │
│                                        │
│  4. Data Layer                         │
│     • Encryption at rest (Aurora, DDB) │
│     • Encryption in transit (TLS)      │
│     • Secrets Manager rotation         │
│     • VPC endpoints for AWS services   │
└────────────────────────────────────────┘
```

## 📈 Scalability & Performance

### Auto-scaling Components

```
┌────────────────────────────────────────┐
│     Component          Scaling         │
├────────────────────────────────────────┤
│ Lambda Functions    → Auto (1-1000)    │
│ Aurora Serverless   → Auto (0.5-16 ACU)│
│ Redis               → Fixed (can resize)│
│ DynamoDB            → On-demand scaling │
│ API Gateway         → Unlimited         │
│ SQS                 → Unlimited         │
└────────────────────────────────────────┘
```

### Performance Optimization

```
1. Caching Strategy
   ├─ Redis: Hot data (sessions, profiles)
   ├─ API Gateway: Response caching
   └─ CloudFront: Static assets

2. Database Optimization
   ├─ Aurora: Read replicas (production)
   ├─ Indexes on foreign keys
   └─ Query optimization

3. Lambda Optimization
   ├─ Provisioned concurrency (critical paths)
   ├─ VPC ENI caching
   └─ Function warming

4. Async Processing
   ├─ EventBridge for decoupling
   ├─ SQS for buffering
   └─ Batch processing for efficiency
```

---

This architecture provides:
- ✅ **Scalability**: Auto-scales from 0 to millions of users
- ✅ **Reliability**: Multi-AZ, auto-retry, DLQ
- ✅ **Performance**: Caching, async processing, streaming
- ✅ **Cost-efficiency**: Serverless, pay-per-use
- ✅ **Maintainability**: Microservices, IaC, monitoring
