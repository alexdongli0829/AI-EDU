/**
 * POST /students/:studentId/stages/:stageId/activate
 * 激活学生的新stage，应用技能映射
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { stageMappingService } from '../lib/stage-mapping-service';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId;
    const stageId = event.pathParameters?.stageId;

    if (!studentId || !stageId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: false, 
          error: 'studentId and stageId are required' 
        }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { previousStageId, forceActivate = false } = body;

    // 检查学生是否已经在这个stage中活跃
    const existingStageResult = await stageMappingService.getStudentStage(studentId, stageId);
    
    if (existingStageResult && existingStageResult.status === 'active' && !forceActivate) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Student is already active in this stage',
          existingStageId: existingStageResult.id
        }),
      };
    }

    // 激活新的stage
    const newStageId = await stageMappingService.activateStudentStage(
      studentId,
      stageId,
      previousStageId
    );

    // 获取创建的stage profile用于响应
    const stageProfile = await stageMappingService.getStudentStageProfile(studentId, stageId);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        studentStageId: newStageId,
        stageProfile,
        message: previousStageId 
          ? `Stage activated with skill mapping from ${previousStageId}`
          : 'Stage activated with baseline profile'
      }),
    };

  } catch (error: any) {
    console.error('activate-student-stage error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
    };
  }
}