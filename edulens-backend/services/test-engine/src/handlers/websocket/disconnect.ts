/**
 * WebSocket $disconnect handler
 * Removes the connection record from DynamoDB.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const TABLE = process.env.CONNECTIONS_TABLE || 'timer-connections';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId!;

  await dynamodb.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: { connectionId: { S: connectionId } },
    })
  );

  return { statusCode: 200, body: 'Disconnected' };
}
