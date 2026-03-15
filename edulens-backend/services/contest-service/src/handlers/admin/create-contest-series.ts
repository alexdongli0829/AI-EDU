/**
 * POST /admin/contest-series
 * Create a new contest series (e.g. "Term 1 2026 OC Prep Championship").
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) return err(400, 'Request body is required');

    const { name, stageId, description, scheduledStart, scheduledEnd } = JSON.parse(event.body);

    if (!name || !stageId) return err(400, 'name and stageId are required');

    const prisma = await getPrismaClient();

    // Verify stage exists
    const stages = await prisma.$queryRawUnsafe(
      `SELECT id FROM stages WHERE id = $1 AND is_active = true`,
      stageId
    ) as any[];

    if (!stages.length) return err(404, `Stage '${stageId}' not found`);

    const id = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO contest_series (id, stage_id, name, description, status, scheduled_start, scheduled_end, created_at)
       VALUES ($1::uuid, $2, $3, $4, 'draft', $5, $6, NOW())`,
      id,
      stageId,
      name,
      description || null,
      scheduledStart || null,
      scheduledEnd || null
    );

    return ok(201, { success: true, contestSeriesId: id, name, stageId });
  } catch (error) {
    console.error('create-contest-series error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
