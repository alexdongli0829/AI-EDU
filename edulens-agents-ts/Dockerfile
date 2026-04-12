# EduLens Agents - TypeScript Container for ARM64 AgentCore Runtime
FROM --platform=linux/arm64 node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy built application
COPY dist/ ./dist/

# Create startup script that selects agent based on env var
RUN echo '#!/bin/bash\n\
if [ "$AGENT_TYPE" = "parent-advisor" ]; then\n\
  exec node dist/agents/parent-advisor.js\n\
elif [ "$AGENT_TYPE" = "student-tutor" ]; then\n\
  exec node dist/agents/student-tutor.js\n\
else\n\
  echo "ERROR: AGENT_TYPE must be parent-advisor or student-tutor"\n\
  exit 1\n\
fi' > /app/start.sh && chmod +x /app/start.sh

# Health check endpoint
EXPOSE 8080

# Runtime user (non-root)
RUN useradd -r -s /bin/false appuser && chown -R appuser:appuser /app
USER appuser

# Start the selected agent
CMD ["/app/start.sh"]