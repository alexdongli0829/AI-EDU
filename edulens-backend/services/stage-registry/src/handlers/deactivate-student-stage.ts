/**
 * DELETE /students/:studentId/stages/:stageId
 * Pauses (deactivates) a student's enrollment in a stage.
 * Preserves stage_profile data so progress is not lost.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId ?? event.pathParameters?.id;
    const stageId = event.pathParameters?.stageId;

    if (!studentId || !stageId) {
      return err(400, 'studentId and stageId are required');
    }

    const existing = await query(
      `SELECT id, status FROM student_stages WHERE student_id = $1 AND stage_id = $2`,
      studentId, stageId
    ) as any[];

    if (!existing.length) {
      return err(404, 'Student is not enrolled in this stage');
    }

    if (existing[0].status !== 'active') {
      return err(409, `Stage is already ${existing[0].status}, cannot deactivate`);
    }

    await query(
      `UPDATE student_stages SET status = 'paused' WHERE student_id = $1 AND stage_id = $2`,
      studentId, stageId
    );

    return ok(200, {
      success: true,
      stageId,
      message: `Stage '${stageId}' deactivated for student`,
    });
  } catch (error) {
    console.error('deactivate-student-stage error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(data),
  };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: false, error: message }),
  };
}
