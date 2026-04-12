/**
 * Development Server for local testing of Foundation Agent
 */

import express from 'express';
import { expressHandler, getHealthStatus } from './entrypoint.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Health check endpoints (AgentCore uses /ping, local uses /health)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

app.get('/health', (req, res) => {
  res.json(getHealthStatus());
});

// Main invocation endpoint
app.post('/invocations', expressHandler);

// Streaming endpoint
app.post('/stream', expressHandler);

// Development test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'EduLens Foundation Agent Development Server',
    version: '2.0.0',
    endpoints: {
      health: 'GET /health',
      invocations: 'POST /invocations',
      stream: 'POST /stream',
      test: 'GET /test'
    },
    sampleRequest: {
      method: 'POST',
      url: '/invocations',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <your-jwt-token>'
      },
      body: {
        prompt: 'I need help with this math question',
        domain: 'student_tutor',
        actorId: 'student_001',
        role: 'student',
        studentId: 'student_001'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint not found: ${req.method} ${req.path}`,
      timestamp: new Date().toISOString()
    }
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 EduLens Foundation Agent Development Server
📍 Running on: http://localhost:${PORT}
🏥 Health check: http://localhost:${PORT}/health
📝 Test info: http://localhost:${PORT}/test

Available domains:
  - student_tutor: Socratic tutoring for NSW OC/Selective prep
  - parent_advisor: Comprehensive student insights for parents

To test, send POST request to /invocations with:
- Authorization: Bearer <jwt-token>
- Body: { "prompt": "...", "domain": "student_tutor|parent_advisor", "actorId": "...", "role": "student|parent|admin" }
  `);
});

export default app;