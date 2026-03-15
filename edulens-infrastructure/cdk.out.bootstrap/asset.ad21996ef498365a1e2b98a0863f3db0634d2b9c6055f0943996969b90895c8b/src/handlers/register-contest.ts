/**
 * POST /contests/:id/register
 * Register a student for a contest.
 * Body: { studentId }
 *
 * Rules:
 *  - Contest must be in 'open' status
 *  - Registration deadline must not have passed
 *  - Student must not already be registered
 *  - max_participants cap enforced if set
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getPrismaClient } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const contestId = event.pathParameters?.id;
    if (!contestId) return err(400, 'contestId is required');
    if (!event.body) return err(400, 'Request body is required');

    const { studentId } = JSON.parse(event.body);
    if (!studentId) return err(400, 'studentId is required');

    const prisma = await getPrismaClient();

    // Validate contest
    const contests = await prisma.$queryRawUnsafe(
      `SELECT id, status, registration_deadline, max_participants FROM contests WHERE id = $1::uuid`,
      contestId
    ) as any[];

    if (!contests.length) return err(404, 'Contest not found');

    const contest = contests[0];
    if (contest.status !== 'open') {
      return err(409, `Contest is not open for registration (status: ${contest.status})`);
    }
    if (contest.registration_deadline && new Date(contest.registration_deadline) < new Date()) {
      return err(409, 'Registration deadline has passed');
    }

    // Check for existing registration
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM contest_registrations WHERE contest_id = $1::uuid AND student_id = $2::uuid`,
      contestId, studentId
    ) as any[];

    if (existing.length) return err(409, 'Student is already registered for this contest');

    // Enforce participant cap
    if (contest.max_participants) {
      const countRows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM contest_registrations WHERE contest_id = $1::uuid`,
        contestId
      ) as any[];
      const count = parseInt(countRows[0]?.cnt ?? '0');
      if (count >= contest.max_participants) {
        return err(409, 'Contest is full');
      }
    }

    const registrationId = uuidv4();
    await prisma.$executeRawUnsafe(
      `INSERT INTO contest_registrations (id, contest_id, student_id, registered_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, NOW())`,
      registrationId,
      contestId,
      studentId
    );

    return ok(201, { success: true, registrationId, contestId, studentId });
  } catch (error) {
    console.error('register-contest error:', error);
    return err(500, 'Internal server error');
  }
}

function ok(statusCode: number, data: object): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) };
}

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success: false, error: message }) };
}
