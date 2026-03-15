/**
 * POST /students/:id/stages/:stageId
 * Enrolls a student in a stage. If the student has a completed prior stage,
 * bootstraps initial skill priors via skill_bridges (prior mastery transfer).
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { getDb, query } from '../lib/database';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId ?? event.pathParameters?.id;
    const stageId = event.pathParameters?.stageId;

    if (!studentId || !stageId) {
      return err(400, 'studentId and stageId are required');
    }

    const db = await getDb();

    // Verify stage exists and is active
    const stages = await query(
      `SELECT id, test_formats FROM stages WHERE id = $1 AND is_active = true`,
      stageId
    ) as any[];

    if (!stages.length) {
      return err(404, `Stage '${stageId}' not found or not active`);
    }

    // Check if already enrolled
    const existing = await query(
      `SELECT id, status FROM student_stages WHERE student_id = $1 AND stage_id = $2`,
      studentId, stageId
    ) as any[];

    if (existing.length && existing[0].status === 'active') {
      return err(409, 'Student is already actively enrolled in this stage');
    }

    // --- Bridge bootstrapping ---
    // Find the student's most recently completed stage to seed priors
    const completedStages = await query(`
      SELECT ss.stage_id, ss.stage_profile
      FROM student_stages ss
      WHERE ss.student_id = $1 AND ss.status = 'completed'
      ORDER BY ss.completed_at DESC
      LIMIT 1
    `, studentId) as any[];

    let bootstrappedSkillGraph: Record<string, any> = {};

    if (completedStages.length) {
      const sourceStageId = completedStages[0].stage_id;
      const sourceProfile = completedStages[0].stage_profile as any;
      const sourceSkillGraph: Record<string, any> = sourceProfile?.skill_graph || {};

      // Load bridges from completed stage → new stage
      const bridges = await query(`
        SELECT from_skill, to_skill, prior_weight
        FROM skill_bridges
        WHERE from_stage_id = $1 AND to_stage_id = $2
      `, sourceStageId, stageId) as any[];

      for (const bridge of bridges) {
        const sourceMastery = sourceSkillGraph[bridge.from_skill]?.mastery_level ?? 0;
        bootstrappedSkillGraph[bridge.to_skill] = {
          mastery_level: Math.round(sourceMastery * bridge.prior_weight * 100) / 100,
          confidence: 0.3, // Low initial confidence — will update after first questions
          sample_size: 0,
          trend: 'stable',
          bootstrapped: true,
        };
      }
    }

    const initialProfile = {
      skill_graph: bootstrappedSkillGraph,
      overall_mastery: 0.0,
      stage_error_stats: {},
      strengths: [],
      weaknesses: [],
    };

    // Deactivate any currently active stage (enforce single active stage)
    await query(
      `UPDATE student_stages SET status = 'paused' WHERE student_id = $1 AND status = 'active' AND stage_id != $2`,
      studentId, stageId
    );

    // Upsert the student_stages row
    const studentStageId = uuidv4();
    await query(`
      INSERT INTO student_stages (id, student_id, stage_id, status, stage_profile, activated_at)
      VALUES ($1::uuid, $2::uuid, $3, 'active', $4::jsonb, NOW())
      ON CONFLICT (student_id, stage_id)
      DO UPDATE SET status = 'active', stage_profile = $4::jsonb, activated_at = NOW(), completed_at = NULL
    `, studentStageId, studentId, stageId, JSON.stringify(initialProfile));

    // Retrieve the actual row id (may differ if ON CONFLICT fired)
    const rows = await query(
      `SELECT id FROM student_stages WHERE student_id = $1 AND stage_id = $2`,
      studentId, stageId
    ) as any[];

    return ok(201, {
      success: true,
      studentStageId: rows[0]?.id,
      stageId,
      bootstrappedSkillCount: Object.keys(bootstrappedSkillGraph).length,
      message: `Stage '${stageId}' activated for student`,
    });
  } catch (error) {
    console.error('activate-student-stage error:', error);
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
