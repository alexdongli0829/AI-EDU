/**
 * Admin Questions CRUD — raw SQL against actual DB schema
 * Handles: GET /admin/questions, POST /admin/questions, PUT /admin/questions/:id, DELETE /admin/questions/:id
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let prisma: PrismaClient | null = null;

async function getPrisma(): Promise<PrismaClient> {
  if (prisma) return prisma;
  if (!process.env.DATABASE_URL) {
    const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const res = await sm.send(new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN || 'edulens-aurora-secret' }));
    const s = JSON.parse(res.SecretString || '{}');
    process.env.DATABASE_URL = `postgresql://${s.username}:${s.password}@${s.host}:${s.port}/${s.dbname}`;
  }
  prisma = new PrismaClient();
  return prisma;
}

function resp(statusCode: number, body: object): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const method = event.httpMethod;
    const questionId = event.pathParameters?.questionId;
    const db = await getPrisma();

    // GET /admin/questions — list
    if (method === 'GET' && !questionId) {
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const offset = parseInt(event.queryStringParameters?.offset || '0');
      const subject = event.queryStringParameters?.subject;

      let whereClause = '';
      const params: any[] = [];
      if (subject) { params.push(subject); whereClause = `WHERE subject = $${params.length}`; }

      const questions = await db.$queryRawUnsafe<any[]>(
        `SELECT id, text, type, options, correct_answer, explanation, difficulty, estimated_time,
                skill_tags, subject, grade_level, is_active, created_at
         FROM questions ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        ...params
      );

      const countResult = await db.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int as count FROM questions ${whereClause}`,
        ...params
      );
      const total = countResult[0]?.count || 0;

      return resp(200, {
        success: true,
        questions: questions.map(mapQuestion),
        total,
      });
    }

    // POST /admin/questions — create
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await db.$queryRawUnsafe<any[]>(
        `INSERT INTO questions (id, text, type, options, correct_answer, explanation, difficulty,
          estimated_time, skill_tags, subject, grade_level, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4, $5, $6, $7, $8::text[], $9, $10, $11, NOW(), NOW())
         RETURNING id`,
        body.text || '',
        body.type || 'multiple_choice',
        JSON.stringify(body.options || []),
        body.correctAnswer || '',
        body.explanation || '',
        body.difficulty || 0.5,
        body.estimatedTime || 30,
        body.skillTags || [],
        body.subject || 'math',
        body.gradeLevel || 4,
        body.isActive !== false,
      );
      return resp(201, { success: true, id: result[0]?.id });
    }

    // PUT /admin/questions/:id — update
    if (method === 'PUT' && questionId) {
      const body = JSON.parse(event.body || '{}');
      await db.$queryRawUnsafe(
        `UPDATE questions SET
          text = COALESCE($2, text),
          type = COALESCE($3, type),
          options = COALESCE($4::jsonb, options),
          correct_answer = COALESCE($5, correct_answer),
          explanation = COALESCE($6, explanation),
          difficulty = COALESCE($7, difficulty),
          estimated_time = COALESCE($8, estimated_time),
          skill_tags = COALESCE($9::text[], skill_tags),
          subject = COALESCE($10, subject),
          grade_level = COALESCE($11, grade_level),
          is_active = COALESCE($12, is_active),
          updated_at = NOW()
         WHERE id = $1::uuid`,
        questionId,
        body.text ?? null,
        body.type ?? null,
        body.options ? JSON.stringify(body.options) : null,
        body.correctAnswer ?? null,
        body.explanation ?? null,
        body.difficulty ?? null,
        body.estimatedTime ?? null,
        body.skillTags ?? null,
        body.subject ?? null,
        body.gradeLevel ?? null,
        body.isActive ?? null,
      );
      return resp(200, { success: true });
    }

    // DELETE /admin/questions/:id
    if (method === 'DELETE' && questionId) {
      await db.$queryRawUnsafe(`DELETE FROM questions WHERE id = $1::uuid`, questionId);
      return resp(200, { success: true });
    }

    return resp(400, { success: false, error: 'Invalid request' });
  } catch (error: any) {
    console.error('Admin questions error:', error);
    return resp(500, { success: false, error: error.message || 'Internal server error' });
  }
}

function mapQuestion(q: any) {
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    correctAnswer: q.correct_answer,
    explanation: q.explanation,
    difficulty: parseFloat(q.difficulty) || 0.5,
    estimatedTime: parseInt(q.estimated_time) || 30,
    skillTags: q.skill_tags || [],
    subject: q.subject,
    gradeLevel: parseInt(q.grade_level) || 4,
    isActive: q.is_active !== false,
    createdAt: q.created_at,
  };
}
