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
import { prisma } from '@edulens/database';
import { TimerService } from '../../services/timer-service';
import { SessionManager } from '../../services/session-manager';

const TICK_SECONDS = 5;
const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const timerService = new TimerService();
const sessionManager = new SessionManager();

export async function handler(): Promise<void> {
  const wsEndpoint = process.env.WS_ENDPOINT;
  const connectionsTable = process.env.CONNECTIONS_TABLE || 'timer-connections';

  if (!wsEndpoint) {
    console.error('WS_ENDPOINT not configured');
    return;
  }

  const apigw = new ApiGatewayManagementApiClient({ endpoint: wsEndpoint });

  // Get all active test sessions
  const activeSessions = await prisma.testSession.findMany({
    where: { status: 'in_progress' },
    select: { id: true, studentId: true },
  });

  await Promise.all(
    activeSessions.map((session) => processSession(session, apigw, dynamodb, connectionsTable))
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
      await sessionManager.completeSession(session.id);
      await timerService.stopTimer(session.id);
    } catch {
      // Session may already be completed
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
