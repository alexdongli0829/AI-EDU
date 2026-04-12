/**
 * AgentCore Runtime Entrypoint for EduLens Foundation Agent
 *
 * This is the main entry point for deployment to AWS AgentCore Runtime.
 * It handles HTTP invocations, validates requests, and coordinates the Foundation Agent.
 */

import { FoundationAgent } from './foundation-agent.js';
import { InvocationRequest, InvocationRequestSchema, AgentResponse } from './shared/types.js';

// AgentCore Runtime handler interface
interface AgentCoreEvent {
  httpMethod?: string;
  path?: string;
  body?: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  requestContext?: {
    requestId: string;
    identity: {
      sourceIp: string;
    };
  };
}

interface AgentCoreContext {
  requestId: string;
  getRemainingTimeInMillis(): number;
}

interface AgentCoreResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Main handler function for AgentCore Runtime
 */
export async function handler(
  event: AgentCoreEvent,
  context: AgentCoreContext
): Promise<AgentCoreResponse> {
  const startTime = Date.now();
  console.log(`AgentCore invocation started: ${context.requestId}`);

  try {
    // Handle health check
    if (event.path === '/health' || event.httpMethod === 'GET') {
      return createResponse(200, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        agentType: 'foundation',
        domains: ['student_tutor', 'parent_advisor']
      });
    }

    // Handle main invocation
    if (event.httpMethod === 'POST' && event.path === '/invocations') {
      return await handleInvocation(event, context);
    }

    // Handle streaming endpoint
    if (event.httpMethod === 'POST' && event.path === '/stream') {
      return await handleStreamingInvocation(event, context);
    }

    // Unknown endpoint
    return createErrorResponse(404, 'ENDPOINT_NOT_FOUND', 'Unknown endpoint');

  } catch (error) {
    console.error('Handler error:', error);

    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'Internal server error',
      {
        requestId: context.requestId,
        duration: Date.now() - startTime
      }
    );
  }
}

/**
 * Handle standard invocation requests
 */
async function handleInvocation(
  event: AgentCoreEvent,
  context: AgentCoreContext
): Promise<AgentCoreResponse> {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    const requestData = parseRequestBody(event.body);
    const validatedRequest = InvocationRequestSchema.parse(requestData);

    // Extract JWT token from headers (optional — AgentCore Runtime doesn't forward JWT)
    const authHeader = event.headers?.['authorization'] || event.headers?.['Authorization'];
    const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    // Create Foundation Agent instance
    // When no JWT is present (AgentCore invocation), use actorId/role from request body
    const agent = new FoundationAgent({
      harnessName: validatedRequest.domain,
      sessionId: validatedRequest.sessionId || `session_${context.requestId}`,
      jwtToken,
      conversationHistory: validatedRequest.conversationHistory,
      // Fallback identity from request body when no JWT
      fallbackIdentity: !jwtToken ? {
        actorId: validatedRequest.actorId,
        role: validatedRequest.role,
        studentId: validatedRequest.studentId || (validatedRequest.role === 'student' ? validatedRequest.actorId : undefined),
        children: validatedRequest.children?.map(c => c.id) || [],
      } : undefined,
    });

    // Initialize agent
    await agent.initialize();

    // Process the request
    const response = await agent.processInput(
      validatedRequest.prompt,
      'conversation'
    );

    // Add request metadata
    const finalResponse: AgentResponse = {
      ...response,
      metadata: {
        ...response.metadata,
        requestId: context.requestId,
        domain: validatedRequest.domain,
        duration: Date.now() - startTime,
        model: agent.getDomainHarness()?.model || 'unknown'
      }
    };

    return createResponse(200, finalResponse);

  } catch (error) {
    console.error('Invocation error:', error);

    if (error instanceof Error) {
      // Handle validation errors
      if (error.name === 'ZodError') {
        return createErrorResponse(400, 'VALIDATION_ERROR', error.message);
      }

      // Handle authentication errors
      if (error.message.includes('JWT') || error.message.includes('identity')) {
        return createErrorResponse(401, 'AUTH_ERROR', error.message);
      }

      // Handle initialization errors
      if (error.message.includes('initialize') || error.message.includes('harness')) {
        return createErrorResponse(400, 'INITIALIZATION_ERROR', error.message);
      }
    }

    return createErrorResponse(500, 'PROCESSING_ERROR', 'Failed to process request');
  }
}

/**
 * Handle streaming invocation requests (future implementation)
 */
async function handleStreamingInvocation(
  event: AgentCoreEvent,
  context: AgentCoreContext
): Promise<AgentCoreResponse> {
  // For now, redirect to standard invocation
  // In future, implement Server-Sent Events streaming
  console.log('Streaming request received, falling back to standard invocation');
  return await handleInvocation(event, context);
}

/**
 * Parse request body with error handling
 */
function parseRequestBody(body?: string): any {
  if (!body) {
    throw new Error('Request body is required');
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Create successful response
 */
function createResponse(statusCode: number, data: any): AgentCoreResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Agent-Version': '2.0.0',
      'X-Agent-Type': 'foundation'
    },
    body: JSON.stringify(data, null, 2)
  };
}

/**
 * Create error response
 */
function createErrorResponse(
  statusCode: number,
  errorCode: string,
  message: string,
  details?: Record<string, unknown>
): AgentCoreResponse {
  const errorResponse = {
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      ...details
    }
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Error-Code': errorCode
    },
    body: JSON.stringify(errorResponse, null, 2)
  };
}

/**
 * Lambda handler for local testing and alternative deployment
 */
export async function lambdaHandler(event: any, context: any) {
  // Convert Lambda event to AgentCore event format
  const agentCoreEvent: AgentCoreEvent = {
    httpMethod: event.httpMethod || event.requestContext?.http?.method,
    path: event.path || event.rawPath,
    body: event.body,
    headers: event.headers || {},
    queryStringParameters: event.queryStringParameters || {},
    requestContext: {
      requestId: event.requestContext?.requestId || context.awsRequestId,
      identity: {
        sourceIp: event.requestContext?.identity?.sourceIp || 'unknown'
      }
    }
  };

  const agentCoreContext: AgentCoreContext = {
    requestId: context.awsRequestId,
    getRemainingTimeInMillis: () => context.getRemainingTimeInMillis()
  };

  return await handler(agentCoreEvent, agentCoreContext);
}

/**
 * Express.js handler for local development
 */
export async function expressHandler(req: any, res: any) {
  const event: AgentCoreEvent = {
    httpMethod: req.method,
    path: req.path,
    body: JSON.stringify(req.body),
    headers: req.headers,
    queryStringParameters: req.query,
    requestContext: {
      requestId: req.id || `req_${Date.now()}`,
      identity: {
        sourceIp: req.ip || req.connection.remoteAddress
      }
    }
  };

  const context: AgentCoreContext = {
    requestId: event.requestContext?.requestId || `req_${Date.now()}`,
    getRemainingTimeInMillis: () => 300000 // 5 minutes for development
  };

  try {
    const response = await handler(event, context);

    // Set headers
    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Send response
    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.error('Express handler error:', error);
    res.status(500).json({
      error: {
        code: 'EXPRESS_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Health check utility for monitoring
export function getHealthStatus() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    agentType: 'foundation',
    domains: ['student_tutor', 'parent_advisor'],
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };
}

// Graceful shutdown handler
let isShuttingDown = false;

process.on('SIGTERM', () => {
  console.log('SIGTERM received, starting graceful shutdown...');
  isShuttingDown = true;

  setTimeout(() => {
    console.log('Shutdown complete');
    process.exit(0);
  }, 5000);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, starting graceful shutdown...');
  isShuttingDown = true;
  process.exit(0);
});

// Unhandled error logging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export { isShuttingDown };