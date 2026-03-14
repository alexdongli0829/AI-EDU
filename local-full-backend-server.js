#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import our test engine handlers
const { handler: createTestHandler } = require('./edulens-backend/services/test-engine/dist/handlers/create-test');
const { handler: getTestsHandler } = require('./edulens-backend/services/test-engine/dist/handlers/get-tests');
const { handler: getTestHandler } = require('./edulens-backend/services/test-engine/dist/handlers/get-test');
const { handler: startSessionHandler } = require('./edulens-backend/services/test-engine/dist/handlers/start-test-session');
const { handler: submitAnswerHandler } = require('./edulens-backend/services/test-engine/dist/handlers/submit-answer');

// Import conversation engine handlers
const { handler: createChatSessionHandler } = require('./edulens-backend/services/conversation-engine/dist/handlers/parent-chat/create-session');
const { handler: sendMessageHandler } = require('./edulens-backend/services/conversation-engine/dist/handlers/parent-chat/send-message');
const { handler: getMessagesHandler } = require('./edulens-backend/services/conversation-engine/dist/handlers/parent-chat/get-messages');
const { handler: endChatSessionHandler } = require('./edulens-backend/services/conversation-engine/dist/handlers/parent-chat/end-session');

const app = express();
const port = 3002; // Different port for the full backend API

app.use(cors());
app.use(express.json());

// Helper to convert Express req/res to Lambda event format
function createLambdaEvent(req, pathParams = {}) {
  return {
    httpMethod: req.method,
    path: req.path,
    pathParameters: pathParams,
    queryStringParameters: req.query,
    body: JSON.stringify(req.body),
    headers: req.headers
  };
}

// Test Engine Endpoints
app.post('/api/tests', async (req, res) => {
  try {
    const event = createLambdaEvent(req);
    const result = await createTestHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tests', async (req, res) => {
  try {
    const event = createLambdaEvent(req);
    const result = await getTestsHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tests/:testId', async (req, res) => {
  try {
    const event = createLambdaEvent(req, { testId: req.params.testId });
    const result = await getTestHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/test-sessions', async (req, res) => {
  try {
    const event = createLambdaEvent(req);
    const result = await startSessionHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/test-sessions/:sessionId/answers', async (req, res) => {
  try {
    const event = createLambdaEvent(req, { sessionId: req.params.sessionId });
    const result = await submitAnswerHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Parent Chat Endpoints (from conversation engine)
app.post('/api/parent-chat/session', async (req, res) => {
  try {
    const event = createLambdaEvent(req);
    const result = await createChatSessionHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/parent-chat/:sessionId/message', async (req, res) => {
  try {
    const event = createLambdaEvent(req, { sessionId: req.params.sessionId });
    const result = await sendMessageHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/parent-chat/:sessionId/messages', async (req, res) => {
  try {
    const event = createLambdaEvent(req, { sessionId: req.params.sessionId });
    const result = await getMessagesHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/parent-chat/:sessionId/end', async (req, res) => {
  try {
    const event = createLambdaEvent(req, { sessionId: req.params.sessionId });
    const result = await endChatSessionHandler(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: ['test-engine', 'conversation-engine'],
    version: '1.0.0'
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    name: 'EduLens Backend API',
    version: '1.0.0',
    endpoints: [
      'GET /health - Health check',
      'POST /api/tests - Create test',
      'GET /api/tests - List tests',
      'GET /api/tests/:testId - Get test details',
      'POST /api/test-sessions - Start test session',
      'POST /api/test-sessions/:sessionId/answers - Submit answer',
      'POST /api/parent-chat/session - Create chat session',
      'POST /api/parent-chat/:sessionId/message - Send message',
      'GET /api/parent-chat/:sessionId/messages - Get messages',
      'POST /api/parent-chat/:sessionId/end - End chat session'
    ]
  });
});

app.listen(port, () => {
  console.log(`🚀 EduLens Full Backend API running at http://localhost:${port}`);
  console.log(`📝 Available Services:`);
  console.log(`   🧪 Test Engine - Adaptive testing with IRT`);
  console.log(`   💬 Conversation Engine - AI parent/student chat`);
  console.log(`   📊 Health Check: GET /health`);
  console.log(`   🔗 API Docs: GET /`);
  console.log(``);
  console.log(`🎯 Frontend: http://localhost:3000`);
  console.log(`🔧 Backend: http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down EduLens backend server...');
  process.exit(0);
});