# EduLens Agent Container for AgentCore Runtime
# Builds a container with Agent SDK + tools for deployment to AgentCore

FROM node:20-slim AS builder

WORKDIR /app

# Copy agent source
COPY prototype/edulens-agent/package.json prototype/edulens-agent/package-lock.json ./prototype/
COPY prototype/edulens-agent/tsconfig.json ./prototype/
COPY prototype/edulens-agent/src/ ./prototype/src/
COPY prototype/edulens-agent/.claude/ ./prototype/.claude/

# Copy production integration code
COPY edulens-backend/agents/ ./agents/

# Install dependencies
WORKDIR /app/prototype
RUN npm ci --production=false

# Compile TypeScript
RUN npx tsc

# ---- Runtime stage ----
FROM node:20-slim

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/prototype/dist/ ./dist/
COPY --from=builder /app/prototype/node_modules/ ./node_modules/
COPY --from=builder /app/prototype/.claude/ ./.claude/
COPY --from=builder /app/prototype/package.json ./

# Agent type is set via env variable: AGENT_TYPE=parent-advisor|student-tutor
ENV AGENT_TYPE=parent-advisor
ENV CLAUDE_CODE_USE_BEDROCK=1
ENV NODE_ENV=production

# AgentCore Runtime expects the container to listen on port 8080
EXPOSE 8080

# Entry point — AgentCore invokes via HTTP
# Shell form required for env var expansion
CMD node dist/agents/${AGENT_TYPE}.js
