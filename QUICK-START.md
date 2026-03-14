# EduLens - Quick Start Guide

**Last Updated:** March 13, 2026

---

## 🚀 Get Running in 5 Minutes

### Prerequisites
- Node.js 20+
- Docker Desktop
- PostgreSQL client (optional, for debugging)

### Setup Steps

```bash
# 1. Navigate to backend
cd edulens-backend

# 2. Install dependencies
npm install

# 3. Start local services (PostgreSQL + Redis + LocalStack)
docker-compose up -d

# 4. Wait for services to be healthy
docker-compose ps

# 5. Run database migrations
cd packages/shared/database
npx prisma migrate dev --name init

# 6. Generate Prisma client
npx prisma generate

# 7. (Optional) Seed test data
npx tsx prisma/seed.ts

# 8. Back to root
cd ../../..

# 9. Build all services
npm run build

# 10. Run tests
npm test
```

---

## 📂 Project Structure

```
edulens-backend/
├── packages/shared/
│   ├── common/           ✅ Types, constants, errors, logger
│   └── database/         ✅ Prisma schema, DB client, Redis
│
├── services/
│   ├── test-engine/      ✅ Test sessions, timer, scoring
│   └── conversation-engine/ ✅ AI chat with Claude
│
├── docker-compose.yml    ✅ Local dev environment
├── .env.example          ✅ Environment variables
└── README.md             ✅ Documentation
```

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and update:

```bash
# Database
DATABASE_URL=postgresql://edulens:devpassword@localhost:5432/edulens_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Provider
ANTHROPIC_API_KEY=sk-ant-your-key-here

# AWS (LocalStack for local dev)
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localhost:4566
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific service
cd services/test-engine
npm test

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## 📡 API Endpoints (When Running)

### Test Engine (http://localhost:4000)

```bash
# Create test session
POST /tests/sessions
{
  "student_id": "uuid",
  "test_id": "uuid"
}

# Get session
GET /tests/sessions/:id

# Submit answer
POST /tests/sessions/:id/responses
{
  "question_id": "uuid",
  "student_answer": "option-a",
  "time_spent": 60
}

# Complete session
POST /tests/sessions/:id/complete

# Get results
GET /tests/sessions/:id/results
```

### Conversation Engine (http://localhost:4001)

```bash
# Create parent chat
POST /chat/parent/sessions
{
  "student_id": "uuid"
}

# Send message (SSE streaming)
POST /chat/parent/sessions/:id/messages
{
  "content": "How is my child doing in math?"
}

# Get history
GET /chat/parent/sessions/:id/messages
```

---

## 🐳 Docker Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Check service health
docker-compose ps
```

**Services:**
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- LocalStack: `localhost:4566`

---

## 🗄️ Database Management

```bash
# Open Prisma Studio (GUI)
cd packages/shared/database
npx prisma studio

# Create migration
npx prisma migrate dev --name add_new_field

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View migration status
npx prisma migrate status

# Generate Prisma client (after schema changes)
npx prisma generate
```

---

## 📝 Common Commands

### Development

```bash
# Build all services
npm run build

# Type check
npm run typecheck

# Lint code
npm run lint

# Run tests
npm test
```

### Database

```bash
# Run migrations
npm run db:migrate

# Seed data
npm run db:seed

# Generate types
npm run generate:types
```

---

## 🐛 Troubleshooting

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Redis Connection Failed

```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis connection
redis-cli ping
```

### Prisma Client Not Found

```bash
# Regenerate Prisma client
cd packages/shared/database
npx prisma generate
```

### Port Already in Use

```bash
# Find process using port
lsof -i :5432
lsof -i :6379

# Kill process
kill -9 <PID>
```

---

## 📚 Key Files to Know

### Configuration
- `.env` - Environment variables
- `docker-compose.yml` - Local services
- `package.json` - Dependencies and scripts

### Database
- `packages/shared/database/prisma/schema.prisma` - Database schema
- `packages/shared/database/prisma/migrations/` - Migration history

### Services
- `services/test-engine/src/` - Test Engine code
- `services/conversation-engine/src/` - Conversation Engine code

### Tests
- `services/*/tests/unit/` - Unit tests
- `services/*/tests/integration/` - Integration tests

---

## 🎯 What Works Right Now

✅ **Test Engine Service**
- Create/manage test sessions
- WebSocket timer synchronization
- Auto-scoring answers
- Calculate results with skill breakdown

✅ **Conversation Engine Service**
- Parent chat with SSE streaming
- Claude AI integration
- Token budget management
- Context with student profile

✅ **Database Layer**
- Complete schema (15 tables)
- Prisma ORM
- Redis caching
- Connection pooling

✅ **Shared Packages**
- Type definitions
- Error handling
- Validation
- Logging

---

## 📦 What's Missing

📝 **Profile Engine Service** (Python)
- Bayesian mastery calculation
- Error classification
- Time behavior analysis

📝 **Background Jobs Service** (Python)
- Conversation summarization
- Insight extraction
- Profile snapshots

📝 **Admin Service** (Node.js)
- Question CRUD
- Analytics
- Bulk operations

📝 **Infrastructure** (AWS CDK)
- VPC, RDS, ElastiCache
- API Gateway, Lambda
- Monitoring, alarms

---

## 🚀 Next Steps

1. **Try the services locally:**
   ```bash
   docker-compose up -d
   npm run db:migrate
   npm test
   ```

2. **Explore the code:**
   - Read service README files
   - Check API handlers
   - Review business logic

3. **Make changes:**
   - Modify handlers
   - Update schema
   - Add tests

4. **Deploy (when infrastructure is ready):**
   - Build infrastructure with CDK
   - Deploy services to AWS
   - Run E2E tests

---

## 🆘 Getting Help

- See `README.md` for detailed setup
- Check `STATUS.md` for current progress
- Review service-specific READMEs
- Read architecture documents

---

**Happy coding! 🎉**
