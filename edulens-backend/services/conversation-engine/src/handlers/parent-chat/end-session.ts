/**
 * End Parent Chat Session Handler
 *
 * Marks the session as ended, then publishes a chat_session_ended event
 * to EventBridge so the background-jobs service can generate a Tier-2
 * conversation summary (stored in conversation_memory for cross-session recall).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { query } from '../../lib/database';

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

function successResponse(data: any): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('End parent chat session:', { path: event.path, method: event.httpMethod });

  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return errorResponse(400, 'sessionId is required');
    }

    // Fetch session info before closing (need student_id for the event)
    const sessions = await query(
      `SELECT id, user_id, student_id FROM chat_sessions WHERE id = $1`,
      sessionId
    ) as any[];
    const studentId: string | null = sessions?.[0]?.student_id ?? null;

    // Count messages to include in event payload
    const countRows = await query(
      `SELECT COUNT(*)::int AS count FROM chat_messages WHERE session_id = $1`,
      sessionId
    ) as any[];
    const messageCount: number = countRows?.[0]?.count ?? 0;

    // Mark session ended + reset agent state
    await query(
      `UPDATE chat_sessions
       SET status = 'ended', ended_at = NOW(), agent_state = 'idle'
       WHERE id = $1`,
      sessionId
    );

    // Publish event so background-jobs can generate a Tier-2 summary
    if (studentId && messageCount > 0) {
      await eventBridge.send(new PutEventsCommand({
        Entries: [{
          EventBusName: process.env.EVENT_BUS_NAME || 'edulens-event-bus',
          Source: 'conversation-engine',
          DetailType: 'chat_session_ended',
          Detail: JSON.stringify({ sessionId, studentId, messageCount }),
        }],
      })).catch((err) => console.error('Failed to publish chat_session_ended event:', err));
    }

    console.log('Parent chat session ended:', sessionId);

    return successResponse({
      success: true,
      message: 'Chat session ended successfully',
    });
  } catch (error) {
    console.error('End parent chat session error:', error);
    return errorResponse(500, 'Internal server error');
  }
}
