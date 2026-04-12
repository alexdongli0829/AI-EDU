FROM node:20-slim AS builder

WORKDIR /app

# Install all dependencies (including dev for tsc)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc && cp -r src/harnesses dist/harnesses && cp -r src/prompts dist/prompts

# --- Production image ---
FROM node:20-slim

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy compiled output from builder
COPY --from=builder /app/dist/ ./dist/

EXPOSE 8080

CMD ["node", "dist/dev-server.js"]
