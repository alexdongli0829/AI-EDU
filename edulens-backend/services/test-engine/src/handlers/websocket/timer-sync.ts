/**
 * WebSocket Timer Sync Handler
 * Triggered by EventBridge every 5 seconds.
 * Decrements each active session timer and broadcasts the new value
 * to all connected WebSocket clients for that session.
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import {
  DynamoDBClient,
  QueryCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { query } from '../../lib/database';
import { TimerService } from '../../services/timer-service';

const TICK_SECONDS = 5;
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const timerService = new TimerService();

export async function handler(): Promise<void> {
  const wsEndpoint = process.env.WS_ENDPOINT;
  const connectionsTable = process.env.CONNECTIONS_TABLE || 'timer-connections';

  if (!wsEndpoint) {
    console.error('WS_ENDPOINT not configured');
    return;
  }

  const apigw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });

  // Get all active test sessions
  const activeSessions = await query(
    `SELECT id, student_id FROM test_sessions WHERE status = 'active'`
  ) as { id: string; student_id: string }[];

  await Promise.all(
    activeSessions.map((row) => processSession(
      { id: row.id, studentId: row.student_id },
      apigw, dynamodb, connectionsTable
    ))
  );
}

async function processSession(
  session: { id: string; studentId: string },
  apigw: ApiGatewayManagementApiClient,
  db: DynamoDBClient,
  connectionsTable: string
): Promise<void> {
  const timer = await timerService.decrementTimer(session.id, TICK_SECONDS);
  if (!timer) return;

  // Auto-complete the session when time runs out
  if (timer.timeRemaining <= 0) {
    try {
      const responses = await query(
        `SELECT is_correct FROM session_responses WHERE session_id = $1::uuid`,
        session.id
      ) as any[];
      const answeredCount = responses.length;
      const correctCount = responses.filter((r: any) => r.is_correct).length;
      const sessionRows = await query(
        `SELECT question_count FROM test_sessions WHERE id = $1::uuid`,
        session.id
      ) as any[];
      const totalQ = parseInt(sessionRows[0]?.question_count) || answeredCount || 1;
      const rawScore = totalQ > 0 ? (correctCount / totalQ) * 100 : 0;
      const scaledScore = Math.round(rawScore);
      await query(
        `UPDATE test_sessions SET status = 'completed', completed_at = NOW(),
         scaled_score = $1, raw_score = $2, total_items = $3, correct_count = $4
         WHERE id = $5::uuid AND status != 'completed'`,
        scaledScore, rawScore / 100, answeredCount, correctCount, session.id
      );
      await timerService.stopTimer(session.id);
    } catch (e) {
      console.error('Auto-complete error for session', session.id, e);
    }
  }

  // Fetch WebSocket connections for this session from DynamoDB
  const result = await db.send(
    new QueryCommand({
      TableName: connectionsTable,
      IndexName: 'SessionIndex',
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': { S: session.id } },
    })
  );

  const connections = result.Items ?? [];
  const message = JSON.stringify({ type: 'timer_sync', timeRemaining: timer.timeRemaining });

  await Promise.all(
    connections.map(async (item) => {
      const connectionId = item.connectionId?.S;
      if (!connectionId) return;

      try {
        await apigw.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(message),
          })
        );
      } catch (error: any) {
        // Connection gone — clean up DynamoDB record
        if (error.statusCode === 410) {
          await db.send(
            new DeleteItemCommand({
              TableName: connectionsTable,
              Key: { connectionId: { S: connectionId } },
            })
          );
        }
      }
    })
  );
}
