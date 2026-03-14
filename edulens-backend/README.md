# EduLens Backend

**Version:** 1.0.0
**Platform:** AWS Serverless (Lambda + API Gateway)
**Languages:** Node.js (TypeScript) + Python

---

## 🏗️ Architecture Overview

EduLens backend is built as a **serverless microservices architecture** on AWS with:

- **5 Independent Services**: Test Engine, Profile Engine, Conversation Engine, Background Jobs, Admin
- **Event-Driven**: EventBridge + SQS for async processing
- **Type-Safe**: TypeScript + Prisma + Zod for end-to-end type safety
- **Scalable**: Auto-scaling Lambda functions
- **Cost-Optimized**: Serverless pricing, efficient caching, smart AI model routing

---

## 📁 Project Structure

```
edulens-backend/
├── packages/
│   ├── shared/
│   │   ├── common/              ✅ CREATED - Shared utilities, types, constants
│   │   ├── database/            ✅ CREATED - Prisma schema, DB & Redis clients
│   │   ├── python-common/       📝 TODO - Python shared utilities
│   │   └── aws-infra/           📝 TODO - AWS CDK infrastructure
│   │
│   └── services/
│       ├── test-engine/         📝 TODO - Test session management
│       ├── profile-engine/      📝 TODO - Learning DNA calculation
│       ├── conversation-engine/ 📝 TODO - AI chat with Claude
│       ├── background-jobs/     📝 TODO - Async processing
│       └── admin-service/       📝 TODO - Admin operations
│
├── scripts/                     📝 TODO - Deployment scripts
├── package.json                 ✅ CREATED
├── tsconfig.base.json           ✅ CREATED
└── README.md                    ✅ CREATED (this file)
```

---

## ✅ What's Been Created

### 1. **@edulens/common** - Shared Common Package

Located: `packages/shared/common/`

**Created files:**
- `src/types/models.ts` - Complete domain models (User, Student, Test, Question, Session, Chat, Profile, Events)
- `src/constants/index.ts` - Application constants (test config, token budget, AI models, cache TTL, skill taxonomy, error codes)
- `src/errors/index.ts` - Custom error classes (UnauthorizedError, ValidationError, SessionNotFoundError, etc.)
- `src/utils/logger.ts` - Structured JSON logging utility
- `src/utils/validators.ts` - Zod validation schemas
- `src/index.ts` - Package exports
- `package.json` - Package configuration
- `tsconfig.json` - TypeScript configuration

**Key exports:**
```typescript
// Types
import { User, Student, Test, TestSession, ChatSession, StudentProfile } from '@edulens/common';

// Constants
import { TOKEN_BUDGET, AI_MODELS, CACHE_KEYS, SKILL_TAXONOMY } from '@edulens/common';

// Errors
import { ValidationError, SessionNotFoundError, UnauthorizedError } from '@edulens/common';

// Logger
import { logger } from '@edulens/common';

// Validators
import { validate, createTestSessionSchema } from '@edulens/common';
```

---

### 2. **@edulens/database** - Database Layer Package

Located: `packages/shared/database/`

**Created files:**
- `prisma/schema.prisma` - Complete database schema (15 tables, all relationships)
- `src/client.ts` - Prisma Client singleton with health check
- `src/redis.ts` - Redis client with cache utilities
- `src/index.ts` - Package exports
- `package.json` - Package configuration

**Database schema includes:**
- ✅ Users & Students (authentication, roles)
- ✅ Tests & Questions (multiple types, skill tags, rubrics)
- ✅ Test Sessions & Responses (timer state, scoring)
- ✅ Chat Sessions & Messages (AI conversation history)
- ✅ Conversation Memory (cross-session recall)
- ✅ Student Profiles (Learning DNA, skill graph, error patterns)
- ✅ Profile Snapshots (historical tracking)
- ✅ Events (event sourcing for analytics)

**Key exports:**
```typescript
// Prisma Client
import { prisma, transaction } from '@edulens/database';

// Redis Cache
import { cacheGet, cacheSet, cacheDel } from '@edulens/database';

// Types (auto-generated from Prisma)
import { User, Student, TestSession, Prisma } from '@edulens/database';
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- Docker (for local development)
- PostgreSQL 15 (via Docker)
- Redis 7 (via Docker)
- AWS CLI (for deployment)

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd edulens-backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Start local services (PostgreSQL + Redis)
docker-compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Seed test data
npm run db:seed

# 7. Generate Prisma client
npm run generate:types
```

### Development

```bash
# Start specific service in development mode
npm run dev:test-engine
npm run dev:conversation-engine

# Run tests
npm test

# Run linter
npm run lint

# Type check
npm run typecheck
```

---

## 📦 Packages

### @edulens/common

Shared utilities, types, and constants used across all services.

**Install in a service:**
```json
{
  "dependencies": {
    "@edulens/common": "*"
  }
}
```

### @edulens/database

Database layer with Prisma ORM and Redis caching.

**Install in a service:**
```json
{
  "dependencies": {
    "@edulens/database": "*"
  }
}
```

---

## 🏗️ Service Architecture

### Service Boundaries

Each service is independently deployable:

1. **Test Engine** (Node.js)
   - REST API: Test session CRUD
   - WebSocket: Timer synchronization
   - Auto-scoring engine

2. **Profile Engine** (Python)
   - Bayesian mastery calculation
   - Error pattern classification
   - Time behavior analysis

3. **Conversation Engine** (Node.js)
   - AI chat with Claude Sonnet/Haiku
   - SSE streaming for real-time responses
   - Context management with token budgeting

4. **Background Jobs** (Python)
   - Conversation summarization
   - Insight extraction
   - Profile snapshots

5. **Admin Service** (Node.js)
   - Question management CRUD
   - Bulk import/export
   - Analytics generation

---

## 🔗 Integration Patterns

### Synchronous (HTTP)
```typescript
// Service A calls Service B directly
const response = await axios.post('http://profile-engine/calculate', data);
```

### Asynchronous (EventBridge)
```typescript
// Publish event
await eventBridge.putEvents({
  Entries: [{
    Source: 'test-engine',
    DetailType: 'test_completed',
    Detail: JSON.stringify({ sessionId, studentId })
  }]
});

// Another service consumes the event
// Configured in CDK infrastructure
```

### Job Queue (SQS)
```typescript
// Enqueue job
await sqs.sendMessage({
  QueueUrl: 'conversation-jobs',
  MessageBody: JSON.stringify({ sessionId, action: 'summarize' })
});
```

---

## 🗄️ Database Schema

### Key Tables

- **users** - Authentication and user data
- **students** - Student profiles and metadata
- **tests** - Test definitions
- **questions** - Question bank with skill tags
- **test_sessions** - Active test sessions with timer state
- **session_responses** - Student answers and scoring
- **chat_sessions** - AI conversation sessions
- **chat_messages** - Message history
- **conversation_memory** - Cross-session context
- **student_profiles** - Learning DNA and skill mastery
- **profile_snapshots** - Historical profile tracking
- **events** - Event sourcing for analytics

### Running Migrations

```bash
# Create migration
npm run db:migrate

# Deploy migrations to production
npm run migrate:deploy

# Check migration status
npm run migrate:status

# Open Prisma Studio (GUI)
npm run studio
```

---

## 🧪 Testing

### Test Strategy

- **70% Unit Tests** - Pure business logic
- **20% Integration Tests** - API endpoints, database
- **10% E2E Tests** - Full user flows

```bash
# Run all tests
npm test

# Run tests for specific service
npm run test:test-engine

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

---

## 🚀 Deployment

### Environments

- **dev** - Development environment
- **staging** - Pre-production testing
- **prod** - Production

### Deploy Commands

```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production (requires approval)
npm run deploy:prod
```

---

## 📚 Related Documentation

- [Backend-Architecture.md](../Backend-Architecture.md) - Detailed backend architecture
- [Frontend-Architecture.md](../Frontend-Architecture.md) - Frontend architecture
- [Deployment-Architecture.md](../Deployment-Architecture.md) - AWS infrastructure & CI/CD

---

## 🛠️ Next Steps

1. ✅ Set up shared packages (common, database) - **COMPLETED**
2. 📝 Create Test Engine service
3. 📝 Create Profile Engine service
4. 📝 Create Conversation Engine service
5. 📝 Create Background Jobs service
6. 📝 Create Admin service
7. 📝 Set up AWS CDK infrastructure
8. 📝 Configure CI/CD pipelines
9. 📝 Deploy to development environment

---

## 📝 License

Proprietary - EduLens

---

## 👥 Team

Backend Team - EduLens Engineering
