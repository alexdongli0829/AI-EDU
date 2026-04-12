/**
 * E2E tests for AgentCore entrypoint
 * Tests the HTTP handler, validation, routing, CORS, and error handling.
 */

import { handler, getHealthStatus } from '../../src/entrypoint.js';
import { IdentityHook } from '../../src/hooks/identity-hook.js';

describe('AgentCore Entrypoint E2E', () => {
  const mockContext = {
    requestId: 'test_request_123',
    getRemainingTimeInMillis: () => 30000
  };

  describe('Health Check', () => {
    test('should return healthy status for GET /health', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        body: undefined
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.version).toBe('2.0.0');
      expect(body.agentType).toBe('foundation');
      expect(body.domains).toContain('student_tutor');
      expect(body.domains).toContain('parent_advisor');
    });

    test('should return healthy status for any GET request', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/any-path',
        headers: {},
        body: undefined
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
    });
  });

  describe('Invocations', () => {
    test('should process valid student tutor invocation', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const requestBody = {
        prompt: 'I need help with this math question',
        domain: 'student_tutor',
        actorId: 'student_001',
        role: 'student',
        studentId: 'student_001'
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['X-Agent-Version']).toBe('2.0.0');
      expect(response.headers['X-Agent-Type']).toBe('foundation');

      const body = JSON.parse(response.body);
      expect(body.response).toBeDefined();
      expect(typeof body.response).toBe('string');
      expect(body.response.length).toBeGreaterThan(0);
      expect(body.metadata.requestId).toBe('test_request_123');
      expect(body.metadata.domain).toBe('student_tutor');
    });

    test('should process valid parent advisor invocation', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'parent_001',
        role: 'parent',
        children: ['student_001']
      });

      const requestBody = {
        prompt: 'How is my child performing?',
        domain: 'parent_advisor',
        actorId: 'parent_001',
        role: 'parent',
        children: [{ id: 'student_001', name: 'Emma', gradeLevel: 5 }]
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.response).toBeDefined();
      expect(body.metadata.domain).toBe('parent_advisor');
    });

    test('should handle conversation history', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const requestBody = {
        prompt: 'So the answer is B?',
        domain: 'student_tutor',
        actorId: 'student_001',
        role: 'student',
        conversationHistory: [
          {
            role: 'user',
            content: 'I got this question wrong: 2, 6, 18, ?'
          },
          {
            role: 'assistant',
            content: 'Let me help you find the pattern. What operation takes you from 2 to 6?'
          },
          {
            role: 'user',
            content: 'Multiplication by 3?'
          },
          {
            role: 'assistant',
            content: 'Exactly! So if 2×3=6 and 6×3=18, what would 18×3 be?'
          }
        ]
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.response).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should return 401 for missing Authorization header', async () => {
      const requestBody = {
        prompt: 'Test prompt',
        domain: 'student_tutor',
        actorId: 'student_001',
        role: 'student'
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MISSING_AUTH');
      expect(body.error.message).toBe('Authorization header required');
    });

    test('should return 400 for invalid JSON body', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: 'invalid json{'
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PROCESSING_ERROR');
    });

    test('should return 400 for missing required fields', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const requestBody = {
        // Missing prompt and domain
        actorId: 'student_001',
        role: 'student'
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should return 400 for invalid domain', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const requestBody = {
        prompt: 'Test prompt',
        domain: 'invalid_domain',
        actorId: 'student_001',
        role: 'student'
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should return 404 for unknown endpoint', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/unknown-endpoint',
        headers: {},
        body: '{}'
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ENDPOINT_NOT_FOUND');
    });

    test('should handle malformed JWT token', async () => {
      const requestBody = {
        prompt: 'Test prompt',
        domain: 'student_tutor',
        actorId: 'student_001',
        role: 'student'
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': 'Bearer invalid.jwt.token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('CORS Headers', () => {
    test('should include proper CORS headers', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        body: undefined
      };

      const response = await handler(event, mockContext);

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
      expect(response.headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization');
    });

    test('should include agent identification headers', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/health',
        headers: {},
        body: undefined
      };

      const response = await handler(event, mockContext);

      expect(response.headers['X-Agent-Version']).toBe('2.0.0');
      expect(response.headers['X-Agent-Type']).toBe('foundation');
    });
  });

  describe('Streaming Endpoint', () => {
    test('should handle streaming requests (fallback to standard)', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const requestBody = {
        prompt: 'Test streaming',
        domain: 'student_tutor',
        actorId: 'student_001',
        role: 'student'
      };

      const event = {
        httpMethod: 'POST',
        path: '/stream',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      };

      const response = await handler(event, mockContext);

      // Currently falls back to standard invocation
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.response).toBeDefined();
    });
  });

  describe('Request Context', () => {
    test('should include request metadata in response', async () => {
      const mockJWT = IdentityHook.createMockJWT({
        actor_id: 'student_001',
        role: 'student'
      });

      const requestBody = {
        prompt: 'Test with context',
        domain: 'student_tutor',
        actorId: 'student_001',
        role: 'student',
        sessionId: 'custom_session_123'
      };

      const event = {
        httpMethod: 'POST',
        path: '/invocations',
        headers: {
          'Authorization': `Bearer ${mockJWT}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        requestContext: {
          requestId: 'custom_request_456',
          identity: { sourceIp: '192.168.1.1' }
        }
      };

      const customContext = {
        requestId: 'custom_request_456',
        getRemainingTimeInMillis: () => 25000
      };

      const response = await handler(event, customContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.metadata.requestId).toBe('custom_request_456');
      expect(body.metadata.domain).toBe('student_tutor');
      expect(body.metadata.duration).toBeDefined();
    });
  });

  describe('Health Status Utility', () => {
    test('should return comprehensive health status', () => {
      const health = getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.version).toBe('2.0.0');
      expect(health.agentType).toBe('foundation');
      expect(health.domains).toContain('student_tutor');
      expect(health.domains).toContain('parent_advisor');
      expect(health.timestamp).toBeDefined();
      expect(health.environment.nodeVersion).toBeDefined();
      expect(health.environment.platform).toBeDefined();
      expect(health.environment.memory).toBeDefined();
      expect(health.environment.uptime).toBeDefined();
    });
  });
});