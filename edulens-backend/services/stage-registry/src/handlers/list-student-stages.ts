/**
 * GET /students/:id/stages
 * Returns all stage enrollments for a student (active, completed, paused).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId ?? event.pathParameters?.id;
    if (!studentId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'studentId is required' }),
      };
    }

    const db = await getDb();

    const rows = await query(`
      SELECT
        ss.id,
        ss.student_id,
        ss.stage_id,
        ss.status,
        ss.stage_profile,
        ss.activated_at,
        ss.completed_at,
        s.display_name,
        s.test_formats,
        s.sort_order
      FROM student_stages ss
      JOIN stages s ON ss.stage_id = s.id
      WHERE ss.student_id = $1
      ORDER BY s.sort_order ASC
    `, studentId) as any[];

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, stages: rows }),
    };
  } catch (error) {
    console.error('list-student-stages error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
}
