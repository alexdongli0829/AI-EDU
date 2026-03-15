/**
 * WebSocket $connect handler
 * Stores the connection ID + session ID in DynamoDB.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const TABLE = process.env.CONNECTIONS_TABLE || 'timer-connections';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;
  const sessionId = event.queryStringParameters?.sessionId ?? '';
  const studentId = event.queryStringParameters?.studentId ?? '';

  await dynamodb.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        connectionId: { S: connectionId },
        sessionId: { S: sessionId },
        studentId: { S: studentId },
        connectedAt: { S: new Date().toISOString() },
      },
    })
  );

  return { statusCode: 200, body: 'Connected' };
}
