/**
 * GET /contests
 * Returns contests visible to students/parents.
 * Query params:
 *   stageId  — filter by stage (optional)
 *   status   — filter by status (default: open,active)
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const q = event.queryStringParameters || {};
    const stageId = q.stageId || null;
    const statusFilter = (q.status || 'open,active').split(',').map(s => s.trim());

    const prisma = await getPrismaClient();

    // Build parameterised query
    const params: any[] = [statusFilter];
    let stageWhere = '';
    if (stageId) {
      params.push(stageId);
      stageWhere = `AND cs.stage_id = $${params.length}`;
    }

    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        c.id,
        c.title,
        c.status,
        c.test_format,
        c.scheduled_start,
        c.scheduled_end,
        c.registration_deadline,
        c.max_participants,
        cs.name  AS series_name,
        cs.stage_id
      FROM contests c
      JOIN contest_series cs ON c.series_id = cs.id
      WHERE c.status = ANY($1::text[])
        ${stageWhere}
      ORDER BY c.scheduled_start ASC NULLS LAST
    `, ...params) as any[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, contests: rows }),
    };
  } catch (error) {
    console.error('list-contests error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
