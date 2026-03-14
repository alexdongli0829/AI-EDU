# EduLens Architecture Summary

## 🎯 One-Page Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                     EDULENS PLATFORM ARCHITECTURE                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌───────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                              │
├───────────────────────────────────────────────────────────────────┤
│  Next.js Frontend (React)                                         │
│  • Student Dashboard  • Parent Dashboard  • Test Interface        │
│  • AI Tutor Chat     • Progress Tracking                          │
└─────┬─────────────────────────┬──────────────────────┬───────────┘
      │                         │                      │
      │ REST API               │ WebSocket           │ SSE Stream
      │                         │                      │
┌─────▼─────────────────────────▼──────────────────────▼───────────┐
│                      GATEWAY LAYER                                │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │  API Gateway    │  │  API Gateway    │  │  Application     │  │
│  │  (REST)         │  │  (WebSocket)    │  │  Load Balancer   │  │
│  ├─────────────────┤  ├─────────────────┤  ├──────────────────┤  │
│  │ • Routing       │  │ • $connect      │  │ • SSE Streaming  │  │
│  │ • Auth          │  │ • $disconnect   │  │ • Health checks  │  │
│  │ • Throttling    │  │ • Broadcasting  │  │ • Sticky session │  │
│  │ • API Keys      │  │ • Connection DB │  │                  │  │
│  └─────────────────┘  └─────────────────┘  └──────────────────┘  │
└─────┬─────────────────────────┬──────────────────────┬───────────┘
      │                         │                      │
      │                         │                      │
┌─────▼─────────────────────────▼──────────────────────▼───────────┐
│                     COMPUTE LAYER (VPC)                           │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              24 AWS Lambda Functions                      │   │
│  │                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐               │   │
│  │  │ Test Engine     │  │ Conversation    │               │   │
│  │  │ (TypeScript)    │  │ Engine (TS)     │               │   │
│  │  ├─────────────────┤  ├─────────────────┤               │   │
│  │  │ • Create test   │  │ • Chat sessions │               │   │
│  │  │ • Start session │  │ • AI streaming  │               │   │
│  │  │ • Submit answer │  │ • WebSocket mgmt│               │   │
│  │  │ • IRT algorithm │  │ • Timer sync    │               │   │
│  │  │ • End session   │  │ • End session   │               │   │
│  │  └─────────────────┘  └─────────────────┘               │   │
│  │                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐               │   │
│  │  │ Profile Engine  │  │ Background Jobs │               │   │
│  │  │ (Python)        │  │ (Python)        │               │   │
│  │  ├─────────────────┤  ├─────────────────┤               │   │
│  │  │ • ML models     │  │ • Summarization │               │   │
│  │  │ • IRT params    │  │ • Insights gen  │               │   │
│  │  │ • Skill calc    │  │ • Daily batch   │               │   │
│  │  │ • Profile update│  │ • AWS Bedrock   │               │   │
│  │  └─────────────────┘  └─────────────────┘               │   │
│  │                                                           │   │
│  │  ┌─────────────────┐                                     │   │
│  │  │ Admin Service   │                                     │   │
│  │  │ (TypeScript)    │                                     │   │
│  │  ├─────────────────┤                                     │   │
│  │  │ • Question CRUD │                                     │   │
│  │  │ • Bulk ops      │                                     │   │
│  │  │ • Analytics     │                                     │   │
│  │  │ • System metrics│                                     │   │
│  │  └─────────────────┘                                     │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────┬─────────────────────────┬──────────────────────┬───────────┘
      │                         │                      │
      │                         │                      │
┌─────▼─────────────────────────▼──────────────────────▼───────────┐
│                        DATA LAYER                                 │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Aurora Postgres  │  │ Redis Cache      │  │ DynamoDB       │ │
│  │ (Serverless v2)  │  │ (ElastiCache)    │  │                │ │
│  ├──────────────────┤  ├──────────────────┤  ├────────────────┤ │
│  │ • users          │  │ • Sessions       │  │ • WebSocket    │ │
│  │ • tests          │  │ • Profiles       │  │   connections  │ │
│  │ • questions      │  │ • Question pools │  │ • TTL enabled  │ │
│  │ • test_sessions  │  │ • Chat history   │  │                │ │
│  │ • responses      │  │ • Hot data       │  │                │ │
│  │ • results        │  │ • 20s TTL        │  │                │ │
│  │ • chat_messages  │  └──────────────────┘  └────────────────┘ │
│  │ • profiles       │                                            │
│  │ • summaries      │                                            │
│  │ • insights       │                                            │
│  └──────────────────┘                                            │
│                                                                   │
│  ┌──────────────────┐                                            │
│  │ Secrets Manager  │                                            │
│  ├──────────────────┤                                            │
│  │ • DB credentials │                                            │
│  │ • Auto-rotation  │                                            │
│  └──────────────────┘                                            │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                      ASYNC PROCESSING                             │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌────────────────────────────┐ │
│  │   EventBridge        │         │        SQS Queues          │ │
│  ├──────────────────────┤         ├────────────────────────────┤ │
│  │ Rules:               │         │ • Summarization Queue      │ │
│  │ • test.completed     │────────▶│ • Insights Queue           │ │
│  │ • chat_session.ended │         │ • Dead Letter Queues       │ │
│  │ • Hourly batch       │         │ • Visibility timeout       │ │
│  │ • Daily insights     │         │ • Max receive count        │ │
│  │ • Timer sync (1 min) │         └────────────────────────────┘ │
│  └──────────────────────┘                                        │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                       AI SERVICES                                 │
├───────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                      AWS Bedrock                             │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │  Claude 3.5 Sonnet (Streaming)                               │ │
│  │  • AI Tutor conversations                                    │ │
│  │  • Conversation summarization                                │ │
│  │  • Learning insights generation                              │ │
│  │                                                              │ │
│  │  Claude 3.5 Haiku (Fast)                                     │ │
│  │  • Quick responses                                           │ │
│  │  • Simple queries                                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                    MONITORING & LOGGING                           │
├───────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ CloudWatch   │  │   X-Ray      │  │  CloudWatch Alarms   │   │
│  │ Logs         │  │   Tracing    │  │                      │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤   │
│  │ • Lambda logs│  │ • Request    │  │ • DLQ messages       │   │
│  │ • API logs   │  │   traces     │  │ • Queue depth        │   │
│  │ • Query logs │  │ • Performance│  │ • Lambda errors      │   │
│  │ • Retention  │  │ • Latency    │  │ • API 5xx errors     │   │
│  │   (7-90 days)│  │   analysis   │  │ • RDS CPU/connections│   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  CloudWatch Dashboard                    │    │
│  │  • API Gateway metrics  • Lambda performance             │    │
│  │  • Database health      • Queue metrics                  │    │
│  │  • Custom metrics       • Cost tracking                  │    │
│  └──────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

## 📊 Service Interaction Map

```
Student Takes Test:
──────────────────
    Student
       │
       ├─► API Gateway (REST)
       │      └─► Lambda: Test Engine
       │             ├─► Aurora (test data)
       │             ├─► Redis (session state)
       │             └─► EventBridge (test.completed)
       │                    └─► Lambda: Profile Engine
       │                           └─► Aurora (update profile)
       │
       └─► Response: Next question (adaptive)


Student Uses AI Tutor:
──────────────────────
    Student
       │
       ├─► API Gateway (create session)
       │      └─► Lambda: Chat Create
       │             └─► Aurora (new session)
       │
       ├─► ALB (streaming)
       │      └─► Lambda: Chat Stream
       │             ├─► Aurora (load history)
       │             ├─► Aurora (load profile)
       │             ├─► AWS Bedrock Claude (streaming)
       │             └─► SSE Response (real-time)
       │
       └─► API Gateway (end session)
              └─► Lambda: Chat End
                     └─► EventBridge (session.ended)
                            └─► SQS (summarization queue)
                                   └─► Lambda: Summarization Worker
                                          ├─► AWS Bedrock (summarize)
                                          └─► Aurora (save summary)


Background Processing:
─────────────────────
    EventBridge (Cron)
       │
       ├─► Every Hour: Batch Processing
       │      └─► Lambda: Batch Processor
       │             └─► SQS (queue unsummarized sessions)
       │
       └─► Daily 2 AM: Insights Generation
              └─► Lambda: Daily Insights
                     └─► SQS (insights queue)
                            └─► Lambda: Insights Worker
                                   ├─► Aurora (aggregate data)
                                   ├─► AWS Bedrock (generate insights)
                                   └─► Aurora (save insights)


Admin Operations:
────────────────
    Admin
       │
       └─► API Gateway (with API Key)
              └─► Lambda: Admin Service
                     ├─► Aurora (questions CRUD)
                     ├─► Redis (cache invalidation)
                     └─► Response: Success/Analytics
```

## 🔢 Key Metrics

```
┌────────────────────────────────────────────────────────┐
│              SYSTEM CAPACITY                           │
├────────────────────────────────────────────────────────┤
│ Concurrent Users:        1,000 - 100,000+             │
│ API Requests/sec:        100 - 10,000+                │
│ Lambda Concurrency:      Auto-scale (1-1000 per func) │
│ Database Connections:    2000+ (Aurora Serverless)     │
│ Cache Hit Rate:          >80% (Redis)                  │
│ WebSocket Connections:   10,000+ simultaneous          │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│              PERFORMANCE TARGETS                       │
├────────────────────────────────────────────────────────┤
│ API Response (REST):     < 200ms (p95)                │
│ AI Response (First byte): < 1s                         │
│ Test Question Load:      < 100ms                       │
│ Profile Calculation:     < 5s                          │
│ Conversation Summary:    < 30s (async)                │
│ Daily Insights:          < 5 min (batch)              │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│              RELIABILITY TARGETS                       │
├────────────────────────────────────────────────────────┤
│ Availability:            99.9% (3-nines)               │
│ Error Rate:              < 0.1%                        │
│ Data Durability:         99.999999999% (11-nines)     │
│ Backup Retention:        30 days (automated)           │
│ Recovery Time (RTO):     < 1 hour                      │
│ Recovery Point (RPO):    < 5 minutes                   │
└────────────────────────────────────────────────────────┘
```

## 💰 Cost Breakdown (Estimated Monthly)

```
Development Environment:
───────────────────────
├─ VPC (NAT Gateway)           ~$32
├─ Aurora Serverless (10h/day) ~$15
├─ Redis (t4g.micro)           ~$12
├─ Lambda (100K invocations)   ~$5
├─ API Gateway (1M requests)   ~$3.50
├─ DynamoDB (on-demand)        Free tier
├─ CloudWatch Logs             ~$5
└─ Data Transfer               ~$5
                        TOTAL: ~$75/month

Production Environment:
──────────────────────
├─ VPC (3 NAT Gateways)        ~$96
├─ Aurora Serverless (24/7)    ~$250
├─ Redis (r7g.large + replica) ~$200
├─ Lambda (10M invocations)    ~$50
├─ API Gateway (10M requests)  ~$35
├─ DynamoDB (on-demand)        ~$25
├─ CloudWatch Logs & Metrics   ~$50
├─ AWS Bedrock (1M tokens)     ~$30
├─ Data Transfer               ~$30
├─ Backups & Snapshots         ~$20
└─ X-Ray Tracing               ~$10
                        TOTAL: ~$800/month

(Scales with usage - could be $500-$2000/mo)
```

## 🎯 Design Principles

1. **Serverless First**: No servers to manage, auto-scaling
2. **Event-Driven**: Decoupled services via EventBridge/SQS
3. **Microservices**: 6 independent services, can deploy separately
4. **Real-time Capable**: WebSocket + SSE streaming
5. **Cost-Optimized**: Pay-per-use, auto-pause in dev
6. **Secure by Default**: VPC, encryption, IAM least privilege
7. **Observable**: CloudWatch, X-Ray, structured logging
8. **Resilient**: Multi-AZ, retries, DLQ, circuit breakers

## 🚀 Deployment Strategy

```
┌─────────────────────────────────────────────────────┐
│           Environment Progression                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Dev → Staging → Production                         │
│                                                     │
│  ✓ Deploy CDK stacks                                │
│  ✓ Run integration tests                            │
│  ✓ Performance testing                              │
│  ✓ Blue/Green deployment                            │
│  ✓ Canary releases (production)                     │
└─────────────────────────────────────────────────────┘
```

---

**For detailed service documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md)**
