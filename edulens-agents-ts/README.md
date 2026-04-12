# EduLens Agents - TypeScript Implementation

This is the TypeScript implementation of EduLens AI Agents, migrated from Python for container-based deployment to AWS Bedrock AgentCore Runtime.

## Architecture

- **Runtime**: TypeScript/Node.js 20+ with ES Modules
- **Deployment**: Docker containers on ARM64 (AWS AgentCore Runtime)
- **Agent Framework**: [@strands-agents/sdk](https://www.npmjs.com/package/@strands-agents/sdk) v0.6.0
- **Runtime Adapter**: [bedrock-agentcore](https://www.npmjs.com/package/bedrock-agentcore) v0.2.2

## Agents

### Parent Advisor Agent (`parent-advisor`)
- **Purpose**: Educational advisor for parents discussing their child's learning progress
- **Tools**: Student profile queries, test results, skill breakdowns, time behavior, error patterns
- **System Prompt**: Caring teacher persona, data-grounded responses, no predictions/comparisons
- **Entry Point**: `src/agents/parent-advisor.ts`

### Student Tutor Agent (`student-tutor`)
- **Purpose**: Socratic tutor helping students understand wrong answers
- **Tools**: Question context loading, student level queries, understanding recording
- **System Prompt**: Patient tutor, guided discovery, age-appropriate language (9-12 years)
- **Entry Point**: `src/agents/student-tutor.ts`

## Project Structure

```
edulens-agents-ts/
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── Dockerfile                      # ARM64 container for AgentCore
├── .dockerignore
├── src/
│   ├── agents/
│   │   ├── parent-advisor.ts       # Parent Advisor main entry
│   │   └── student-tutor.ts        # Student Tutor main entry
│   ├── tools/
│   │   ├── parent-advisor-tools.ts # Parent advisor tool functions
│   │   ├── student-tutor-tools.ts  # Student tutor tool functions
│   │   ├── memory-tools.ts         # Shared memory retrieval
│   │   └── mock-data.ts           # Mock student/question data
│   ├── guardrails/
│   │   ├── input-guardrail.ts     # Input content filtering
│   │   ├── output-guardrail.ts    # Output compliance checking
│   │   └── signal-extraction.ts   # Educational signal extraction
│   └── shared/
│       └── types.ts               # Shared TypeScript interfaces
└── README.md                      # This file
```

## Development

### Prerequisites
- Node.js 20+
- npm or yarn
- Docker (for container testing)

### Setup
```bash
cd edulens-agents-ts
npm install
npm run build
```

### Local Development
```bash
# Build TypeScript
npm run build

# Start Parent Advisor locally
npm run start:parent-advisor

# Start Student Tutor locally
npm run start:student-tutor

# Watch mode (rebuilds on changes)
npm run dev
```

### Docker Testing
```bash
# Build image
npm run docker:build

# Test Parent Advisor
npm run docker:run:parent

# Test Student Tutor
npm run docker:run:tutor
```

## Container Deployment

The agents run as Docker containers on AWS AgentCore Runtime with the following specifications:

- **Platform**: `linux/arm64` (AgentCore requirement)
- **Port**: 8080 (AgentCore standard)
- **Entry Point**: Configurable via `AGENT_TYPE` environment variable
- **Health Check**: GET `/ping` (provided by BedrockAgentCoreApp)
- **Invocation**: POST `/invocations` (JSON request/SSE response)

### Agent Selection

The container supports both agents via the `AGENT_TYPE` environment variable:

```bash
# Parent Advisor
AGENT_TYPE=parent-advisor

# Student Tutor
AGENT_TYPE=student-tutor
```

## Key Differences from Python Version

### 1. **Tool Definition Format**
**Python** (Strands decorators):
```python
@tool
def query_student_profile(student_id: str) -> str:
    # ...
```

**TypeScript** (Strands SDK objects):
```typescript
export const tools = [{
  name: 'query_student_profile',
  description: '...',
  parameters: { /* JSON schema */ },
  function: queryStudentProfile,
}];
```

### 2. **Agent Creation**
**Python**:
```python
agent = Agent(model=model, tools=tools, system_prompt=prompt)
result = agent(prompt)
```

**TypeScript**:
```typescript
const agent = new Agent({ model, tools, systemPrompt });
for await (const event of agent.stream(prompt)) {
  // Handle streaming events
}
```

### 3. **Runtime Integration**
**Python** (BedrockAgentCoreApp decorator):
```python
@app.entrypoint
def invoke(payload: dict) -> str:
    return json.dumps(result)
```

**TypeScript** (BedrockAgentCoreApp generator):
```typescript
const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema: z.object({ /* ... */ }),
    process: async function* (request) {
      for await (const event of agent.stream(prompt)) {
        yield { event: 'message', data: { text: event.delta.text } };
      }
    },
  },
});
```

## Environment Variables

- `MODEL_ID`: Bedrock model ID (default: `us.anthropic.claude-sonnet-4-20250514-v1:0`)
- `MEMORY_ID`: AgentCore Memory Store ID (set by CDK)
- `STAGE`: Deployment stage (`dev`, `staging`, `prod`)
- `AGENT_TYPE`: Container agent selection (`parent-advisor` | `student-tutor`)

## Integration with EduLens Backend

The backend Lambda (`conversation-engine`) invokes agents via:

```typescript
import { BedrockAgentRuntimeClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agent-runtime';

const command = new InvokeAgentRuntimeCommand({
  agentRuntimeId: 'edulens_parent_advisor_dev-XXXXX',
  endpointName: 'edulens_parent_advisor_ep_dev',
  requestBody: JSON.stringify({
    prompt: userInput,
    studentId: 'mock-student-001',
    // ...
  }),
});
```

The agent responds with JSON containing `response` text and optional `signals` for analytics.

## Mock Data

Currently uses static mock data (`MOCK_STUDENT`, `MOCK_QUESTION`, `MOCK_MEMORY_RECORDS`) for development. In production, these will be replaced with:

- **Student Data**: Aurora PostgreSQL queries via RDS Data API
- **Question Data**: Test content from `questions` table
- **Memory**: AgentCore Memory SDK calls

## Deployment

See `scripts/deploy-agents-container.sh` for container build and deployment to AWS AgentCore Runtime.

The deployment process:
1. Build TypeScript (`npm run build`)
2. Build Docker image for ARM64
3. Push to ECR
4. Update AgentCore Runtime with new container image
5. Wait for READY status before testing