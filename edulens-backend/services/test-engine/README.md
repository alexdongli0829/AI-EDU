# Test Engine Service

**Version:** 1.0.0
**Language:** Node.js (TypeScript)
**Deployment:** AWS Lambda

---

## Overview

The Test Engine Service manages the complete test-taking lifecycle including:

- Test session creation and management
- Real-time timer synchronization via WebSocket
- Answer submission and auto-scoring
- Results calculation with skill breakdown
- Event publishing for downstream processing

---

## Architecture

### REST API Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/tests/sessions` | `create.ts` | Create new test session |
| GET | `/tests/sessions/:id` | `get.ts` | Get session details |
| POST | `/tests/sessions/:id/responses` | `submit-answer.ts` | Submit answer |
| POST | `/tests/sessions/:id/complete` | `complete.ts` | Complete test session |
| GET | `/tests/sessions/:id/results` | `get-results.ts` | Get detailed results |

### WebSocket API

| Event | Handler | Description |
|-------|---------|-------------|
| `$connect` | `connect.ts` | Establish WebSocket connection |
| `$disconnect` | `disconnect.ts` | Handle disconnection |
| Timer Sync (EventBridge) | `timer-sync.ts` | Broadcast timer updates every 5s |

---

## Service Layer

### SessionManager

**File:** `src/services/session-manager.ts`

**Responsibilities:**
- Create and manage test sessions
- Submit and evaluate answers
- Calculate scores and results
- Publish events

**Key Methods:**
```typescript
createSession(studentId: string, testId: string): Promise<TestSession>
getSession(sessionId: string): Promise<TestSession>
startSession(sessionId: string): Promise<TestSession>
submitAnswer(sessionId, questionId, answer, timeSpent): Promise<Result>
completeSession(sessionId: string): Promise<{session, score}>
getResults(sessionId: string): Promise<TestResults>
abandonSession(sessionId: string): Promise<TestSession>
```

### TimerService

**File:** `src/services/timer-service.ts`

**Responsibilities:**
- Initialize timer state in Redis
- Track time remaining
- Broadcast timer updates
- Handle pause/resume

**Key Methods:**
```typescript
initializeTimer(sessionId: string, totalTime: number): Promise<TimerState>
getTimerState(sessionId: string): Promise<TimerState | null>
updateTimer(sessionId: string, timeRemaining: number): Promise<TimerState>
pauseTimer(sessionId: string): Promise<TimerState | null>
resumeTimer(sessionId: string): Promise<TimerState | null>
stopTimer(sessionId: string): Promise<void>
```

---

## Data Flow

### 1. Create Test Session

```
Client → POST /tests/sessions
  ↓
Handler validates input
  ↓
SessionManager.createSession()
  ↓
Check student & test exist
  ↓
Check no active session
  ↓
Create session in RDS
  ↓
TimerService.initializeTimer()
  ↓
Store timer state in Redis
  ↓
Response with session ID
```

### 2. WebSocket Timer Sync

```
EventBridge (every 5s)
  ↓
timer-sync handler
  ↓
Get all active connections from DynamoDB
  ↓
For each session:
  - Get timer state from Redis
  - Decrement by 5 seconds
  - Update Redis
  - Broadcast to all connections
  ↓
Send WebSocket message to clients
```

### 3. Submit Answer

```
Client → POST /tests/sessions/:id/responses
  ↓
Handler validates input
  ↓
Check timer not expired
  ↓
SessionManager.submitAnswer()
  ↓
Get question from RDS
  ↓
Evaluate answer (auto-scoring)
  ↓
Save response to RDS
  ↓
Update session progress
  ↓
Response with isCorrect + timer status
```

### 4. Complete Session

```
Client → POST /tests/sessions/:id/complete
  ↓
SessionManager.completeSession()
  ↓
Get all responses
  ↓
Calculate score (correct/total * 100)
  ↓
Update session status = 'completed'
  ↓
TimerService.stopTimer()
  ↓
Publish test_completed event
  ↓
Response with final score
```

---

## Database Schema

**Tables Used:**
- `test_sessions` - Session state (status, timer, score)
- `session_responses` - Student answers
- `tests` - Test definitions
- `questions` - Question bank
- `students` - Student records

**Redis Keys:**
- `session:{sessionId}` - Cached session data (30s TTL)
- `timer:{sessionId}` - Timer state (real-time)

**DynamoDB:**
- `timer-connections` - WebSocket connection tracking

---

## Testing

### Run Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Coverage

- ✅ SessionManager: Create, start, submit, complete, results
- ✅ TimerService: Initialize, update, pause, resume
- 📝 TODO: Integration tests with actual DB
- 📝 TODO: E2E tests with API Gateway

---

## Deployment

### Build

```bash
npm run build
```

### Environment Variables

```bash
DATABASE_URL=postgresql://...
REDIS_HOST=redis.example.com
REDIS_PORT=6379
EVENT_BUS_NAME=edulens-event-bus-prod
CONNECTIONS_TABLE=timer-connections-prod
WS_ENDPOINT=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
```

### Lambda Configuration

**Memory:** 1024 MB
**Timeout:** 30 seconds (REST), 60 seconds (WebSocket sync)
**Runtime:** Node.js 20.x
**VPC:** Enabled (for RDS and Redis access)

---

## Events Published

### test_completed

Published when a student completes a test session.

**Event Schema:**
```json
{
  "source": "test-engine",
  "detailType": "test_completed",
  "detail": {
    "sessionId": "uuid",
    "studentId": "uuid",
    "testId": "uuid",
    "score": 85,
    "completedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Consumers:**
- Profile Engine (triggers Learning DNA calculation)
- Background Jobs (triggers insights extraction)

---

## Error Handling

### Common Errors

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| `SESSION_NOT_FOUND` | 404 | Session ID doesn't exist |
| `SESSION_ALREADY_STARTED` | 409 | Active session exists for student |
| `SESSION_EXPIRED` | 410 | Timer has expired |
| `INVALID_SESSION_STATE` | 409 | Invalid state transition |
| `VALIDATION_FAILED` | 400 | Invalid input data |

---

## Performance Considerations

### Caching Strategy

- Session data cached in Redis for 30 seconds
- Timer state stored in Redis (5-second updates)
- Questions cached when session starts

### Optimization

- Use connection pooling for RDS
- Batch DynamoDB queries for WebSocket connections
- Minimize Lambda cold starts with provisioned concurrency (production)

---

## Monitoring

### CloudWatch Metrics

- Lambda invocations, errors, duration
- DynamoDB read/write capacity
- Redis cache hit/miss rate

### CloudWatch Alarms

- Error rate > 5% in 5 minutes
- Duration > 20 seconds
- Throttles > 10 in 5 minutes

---

## Next Steps

1. ✅ Implement core session management
2. ✅ Implement timer synchronization
3. ✅ Add unit tests
4. 📝 Add EventBridge event publishing
5. 📝 Add integration tests
6. 📝 Add E2E tests with Playwright
7. 📝 Deploy to dev environment

---

**Status:** ✅ **Complete**
**Last Updated:** March 2026
