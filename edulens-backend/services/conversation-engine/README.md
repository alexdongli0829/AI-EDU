# Conversation Engine Service

**Version:** 1.0.0
**Language:** Node.js (TypeScript)
**Deployment:** AWS Lambda + ALB (for SSE streaming)
**AI Provider:** Anthropic Claude

---

## Overview

The Conversation Engine Service provides AI-powered chat capabilities using Claude:

- **Parent Chat**: Advanced conversations about child's learning with SSE streaming
- **Student Chat**: Interactive tutoring and homework help
- **Context Management**: Token budget optimization (30K tokens)
- **Cross-Session Memory**: Recall from previous conversations
- **Grounding Data**: Student profile, test results, error patterns

---

## Architecture

### REST API Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/chat/parent/sessions` | `create-session.ts` | Create parent chat session |
| POST | `/chat/parent/sessions/:id/messages` | `send-message-stream.ts` | Send message (SSE streaming) |
| GET | `/chat/parent/sessions/:id/messages` | `get-history.ts` | Get chat history |

### SSE Streaming

Parent chat uses **Server-Sent Events (SSE)** for real-time streaming:

1. Client sends POST request with message
2. Server establishes SSE connection
3. Claude streams response in real-time
4. Client receives incremental text updates
5. Connection closes when complete

**SSE Event Types:**
- `started` - Message processing started
- `delta` - Text chunk received
- `done` - Message complete
- `error` - Error occurred

---

## Service Layer

### ChatService

**File:** `src/services/chat-service.ts`

**Responsibilities:**
- Create and manage chat sessions
- Orchestrate message flow
- Save messages to database

**Key Methods:**
```typescript
createSession(studentId, role): Promise<ChatSession>
sendMessage(sessionId, message): Promise<ChatResponse>
getChatHistory(sessionId): Promise<{session, messages}>
getSession(sessionId): Promise<SessionDetails>
```

### AnthropicClient

**File:** `src/services/ai-client/anthropic-client.ts`

**Responsibilities:**
- Communication with Claude API
- Streaming response handling
- Token estimation

**Key Methods:**
```typescript
streamMessage(messages, systemPrompt, options): Promise<void>
sendMessage(messages, systemPrompt): Promise<string>
estimateTokens(text): number
validateTokenBudget(messages, systemPrompt): ValidationResult
```

### ContextBuilder

**File:** `src/services/context/context-builder.ts`

**Responsibilities:**
- Build conversation context
- Apply token budget constraints
- Manage conversation history
- Include grounding data and cross-session recall

**Key Methods:**
```typescript
buildContext(sessionId, studentId): Promise<ConversationContext>
```

**Context Components:**

1. **System Prompt** (1,500 tokens)
   - Role definition (parent advisor vs student tutor)
   - Guidelines and conversation style

2. **Grounding Data** (5,000 tokens)
   - Student profile (mastery, strengths, weaknesses)
   - Recent test results (last 3 tests)
   - Error patterns

3. **Cross-Session Recall** (1,500 tokens)
   - Summaries of previous conversations
   - Key topics discussed
   - Parent questions from past sessions

4. **Conversation History** (~18,000 tokens)
   - Recent messages that fit in budget
   - Automatically truncated if needed

---

## Token Budget Management

Based on HLD specifications:

```typescript
Total Budget: 30,000 tokens

Allocation:
- System Prompt:        1,500 tokens
- Response Reserve:     4,000 tokens
- Grounding Data:       5,000 tokens
- Cross-Session Recall: 1,500 tokens
- Conversation History: 18,000 tokens (remaining)
```

**How it works:**
1. System prompt is built with role + grounding + recall
2. Conversation history is fetched from database
3. Messages are kept from newest to oldest until budget is full
4. Older messages are automatically dropped if needed
5. Claude generates response with reserved 4K tokens

---

## System Prompts

### Parent Agent Prompt

```
You are an AI educational advisor helping parents understand their
child's learning progress.

Your Role:
- Explain the child's Learning DNA
- Provide actionable recommendations
- Answer questions about test results
- Suggest specific resources and strategies

Guidelines:
- Use simple, non-technical language
- Focus on strengths first
- Provide specific, actionable advice
- Be empathetic and supportive
- Reference specific data from profile
```

### Student Agent Prompt

```
You are an AI tutor helping a student with their learning.

Your Role:
- Answer questions about homework
- Explain concepts in age-appropriate language
- Guide students to discover answers (Socratic method)
- Encourage and motivate

Guidelines:
- Use guiding questions, don't just give answers
- Break down complex concepts
- Use examples and analogies
- Adapt to student's grade level
```

---

## Data Flow

### Parent Chat with SSE Streaming

```
1. Client → POST /chat/parent/sessions/:id/messages
   {
     "content": "How is my child doing in math?"
   }

2. Handler validates session (must be 'parent' role)

3. Update agent state → 'processing'

4. Save user message to RDS

5. ContextBuilder.buildContext():
   - Get system prompt (parent advisor)
   - Fetch student profile from RDS
   - Fetch recent tests from RDS
   - Fetch conversation memories
   - Get message history
   - Apply token budget

6. AnthropicClient.streamMessage():
   - Send request to Claude API
   - Stream response chunks

7. For each chunk:
   - Send SSE event: {event: "delta", data: {text: "chunk"}}

8. When complete:
   - Save assistant message to RDS
   - Update session (turnCount++, agentState → 'idle')
   - Send SSE event: {event: "done", data: {messageId}}

9. Close SSE connection

10. Client has received full response incrementally
```

---

## Database Schema

**Tables Used:**
- `chat_sessions` - Chat session state
- `chat_messages` - Message history (role, content, timestamp)
- `conversation_memory` - Cross-session summaries
- `student_profiles` - Learning DNA for grounding
- `test_sessions` - Recent test results
- `students` - Student records

**Redis Keys:**
- `grounding:{studentId}` - Cached grounding data (30min TTL)
- `chat:context:{sessionId}` - Cached context (10min TTL)

---

## Model Selection

| Use Case | Model | Cost | Rationale |
|----------|-------|------|-----------|
| Parent Chat | Claude Sonnet 4.5 | $3/$15 per 1M tokens | High quality, empathetic responses needed |
| Student Chat | Claude Sonnet 4.5 | $3/$15 per 1M tokens | Educational content, needs accuracy |
| Summarization (Background) | Claude Haiku 4.5 | $0.25/$1.25 per 1M tokens | 12x cheaper, sufficient for summaries |

---

## Cost Optimization

### Strategies Implemented:

1. **Token Budget Management**
   - Hard limit of 30K tokens per request
   - Automatic message truncation
   - Keeps only necessary context

2. **Caching**
   - Grounding data cached for 30 minutes
   - Avoids redundant database queries

3. **Model Routing**
   - Use Haiku for background summarization
   - Use Sonnet only for real-time chat

4. **Prompt Caching** (TODO)
   - Cache system prompts across requests
   - Save 29% on repeated prompts
   - Requires Anthropic prompt caching feature

**Estimated Costs:**
- Parent chat: ~5K tokens input + 500 tokens output = $0.023 per message
- 100 messages/day = $2.30/day = ~$70/month

---

## Testing

### Run Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test Areas

- ✅ ChatService: Create session, send message, get history
- ✅ ContextBuilder: Token budget, grounding data, history truncation
- ✅ AnthropicClient: Streaming, token estimation
- 📝 TODO: Integration tests with Claude API
- 📝 TODO: E2E tests with SSE streaming

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
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=anthropic
```

### Lambda Configuration

**REST API Handlers:**
- Memory: 1024 MB
- Timeout: 30 seconds
- Runtime: Node.js 20.x
- VPC: Enabled

**SSE Streaming Handler:**
- Memory: 2048 MB (larger for streaming)
- Timeout: 120 seconds (2 minutes for long conversations)
- Runtime: Node.js 20.x
- VPC: Enabled
- **Note:** Deployed behind ALB, not API Gateway

---

## SSE vs WebSocket

**Why SSE instead of WebSocket?**

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client | Bi-directional |
| Protocol | HTTP | TCP |
| Complexity | Simple | Complex |
| Auto-reconnect | Built-in | Manual |
| Use Case | AI streaming | Real-time timer |

For AI chat, we only need server→client streaming, so SSE is simpler and more reliable.

---

## Error Handling

### Common Errors

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| `CHAT_SESSION_NOT_FOUND` | 404 | Session doesn't exist |
| `INVALID_ROLE` | 403 | Wrong role for endpoint |
| `AI_SERVICE_ERROR` | 502 | Claude API error |
| `AI_TIMEOUT` | 504 | Request took too long |
| `VALIDATION_FAILED` | 400 | Invalid input |

---

## Monitoring

### CloudWatch Metrics

- Lambda invocations, errors, duration
- AI API latency and errors
- Token usage per request
- Message count per session

### CloudWatch Alarms

- Error rate > 5%
- Duration > 60 seconds
- AI API errors > 10 in 5 minutes

---

## Next Steps

1. ✅ Implement core chat service
2. ✅ Implement Claude AI client
3. ✅ Implement context management
4. ✅ Implement SSE streaming
5. 📝 Add student chat handlers (similar to parent)
6. 📝 Add guardrails layer (content filtering)
7. 📝 Add prompt caching
8. 📝 Add conversation summarization (background job)
9. 📝 Add integration tests
10. 📝 Deploy to dev environment

---

**Status:** ✅ **Core Implementation Complete**
**Last Updated:** March 2026
