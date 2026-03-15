/**
 * POST /admin/contests
 * Create an individual contest within a series.
 * Status starts as 'draft' → must be explicitly transitioned to 'open'.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) return err(400, 'Request body is required');

    const {
      seriesId,
      title,
      testFormat,
      scheduledStart,
      scheduledEnd,
      registrationDeadline,
      maxParticipants,
    } = JSON.parse(event.body);

    if (!seriesId || !title) return err(400, 'seriesId and title are required');

    const prisma = await getPrismaClient();

    // Verify series exists
    const series = await prisma.$queryRawUnsafe(
      `SELECT id, stage_id FROM contest_series WHERE id = $1::uuid`,
      seriesId
    ) as any[];

    if (!series.length) return err(404, 'Contest series not found');

    const id = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO contests
         (id, series_id, title, status, test_format, scheduled_start, scheduled_end,
          registration_deadline, max_participants, created_at)
       VALUES
         ($1::uuid, $2::uuid, $3, 'draft', $4, $5, $6, $7, $8, NOW())`,
      id,
      seriesId,
      title,
      testFormat || 'practice',
      scheduledStart || null,
      scheduledEnd || null,
      registrationDeadline || null,
      maxParticipants || null
    );

    return ok(201, { success: true, contestId: id, seriesId, title });
  } catch (error) {
    console.error('create-contest error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
