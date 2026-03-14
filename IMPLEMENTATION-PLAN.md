# Implementation Plan: Conversation Engine + Test Engine

## Status: In Progress

### ✅ Completed
1. Authentication Service (fully working)
2. Parent Chat Page UI (frontend ready at /parent/chat)

### 🔄 In Progress

## Part 1: Conversation Engine (Priority 1)

### Architecture
- **Storage**: Aurora PostgreSQL for messages, DynamoDB for sessions
- **AI**: AWS Bedrock (Claude 3)
- **Streaming**: ALB + Server-Sent Events (SSE)
- **Real-time**: WebSocket for status updates

### Components to Build

#### 1. Database Schema
```sql
-- Chat sessions table
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    student_id UUID REFERENCES students(id),
    agent_type VARCHAR(50), -- 'parent_advisor' or 'student_tutor'
    status VARCHAR(20), -- 'active' or 'ended'
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id),
    role VARCHAR(20), -- 'user' or 'assistant'
    content TEXT,
    timestamp TIMESTAMP
);
```

#### 2. Lambda Functions

**Parent Chat:**
- `create-parent-session.ts` - Create new chat session
- `send-parent-message.ts` - Send message (streaming via ALB)
- `get-parent-messages.ts` - Retrieve chat history
- `end-parent-session.ts` - End chat session

**Student Chat:**
- Similar functions for student tutor

#### 3. AWS Bedrock Integration
- Model: `anthropic.claude-3-sonnet-20240229-v1:0`
- Streaming responses
- Context management (student profile, recent tests)

### Implementation Steps

1. ✅ Create parent chat UI
2. ⏳ Set up conversation-engine package dependencies
3. ⏳ Create database schema auto-init
4. ⏳ Implement session management
5. ⏳ Implement AWS Bedrock streaming
6. ⏳ Deploy and test

## Part 2: Test Engine (Priority 2)

### Architecture
- **Test Storage**: Aurora PostgreSQL
- **Question Bank**: PostgreSQL with full-text search
- **IRT Algorithm**: Python with scipy
- **Caching**: Redis for active sessions

### Components to Build

#### 1. Database Schema
```sql
-- Tests table
CREATE TABLE tests (
    id UUID PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    subject VARCHAR(50),
    grade_level INTEGER,
    time_limit INTEGER,
    question_count INTEGER,
    created_at TIMESTAMP
);

-- Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY,
    test_id UUID REFERENCES tests(id),
    question_type VARCHAR(50),
    subject VARCHAR(50),
    question_text TEXT,
    options JSONB,
    correct_answer TEXT,
    skill_tags TEXT[],
    difficulty_level INTEGER,
    order_index INTEGER
);

-- Test sessions table
CREATE TABLE test_sessions (
    id UUID PRIMARY KEY,
    test_id UUID REFERENCES tests(id),
    student_id UUID REFERENCES students(id),
    status VARCHAR(20),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    time_remaining INTEGER,
    current_question_index INTEGER
);

-- Answers table
CREATE TABLE test_answers (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES test_sessions(id),
    question_id UUID REFERENCES questions(id),
    answer TEXT,
    is_correct BOOLEAN,
    time_spent INTEGER,
    answered_at TIMESTAMP
);
```

#### 2. Lambda Functions

- `create-test.ts` - Create new test
- `get-test.ts` - Get test details
- `start-test-session.ts` - Start test session
- `submit-answer.ts` - Submit answer + IRT calculation
- `end-test-session.ts` - Complete test + trigger profile update

#### 3. IRT Algorithm
- Adaptive question selection
- Ability estimation
- Difficulty calibration

### Implementation Steps

1. ⏳ Set up test-engine package dependencies
2. ⏳ Create database schema auto-init
3. ⏳ Implement test CRUD operations
4. ⏳ Implement session management
5. ⏳ Implement IRT algorithm
6. ⏳ Deploy and test

## Estimated Time

- **Conversation Engine**: 3-4 hours
- **Test Engine**: 4-5 hours
- **Total**: 7-9 hours

## Current Focus

Starting with Conversation Engine as it's needed for the parent chat page we just created.

## Next Steps

1. Install conversation-engine dependencies
2. Create database connection utility (reuse from auth-service)
3. Implement session management
4. Integrate AWS Bedrock for streaming
5. Deploy and test parent chat end-to-end
