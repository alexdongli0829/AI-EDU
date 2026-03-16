/**
 * GET /students/:studentId/stage-progression
 * 获取学生的跨stage技能演进报告
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { stageMappingService } from '../lib/stage-mapping-service';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId;

    if (!studentId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: false, 
          error: 'studentId is required' 
        }),
      };
    }

    // 获取跨stage演进报告
    const progressionReport = await stageMappingService.getCrossStageProgression(studentId);

    // 计算额外的统计信息
    const stageCount = progressionReport.stages.length;
    const completedStages = progressionReport.stages.filter(s => s.completedAt).length;
    const currentStage = progressionReport.stages.find(s => !s.completedAt);

    const summary = {
      totalStages: stageCount,
      completedStages,
      currentStage: currentStage?.stageId || null,
      overallTrend: progressionReport.overallTrend,
      persistentStrengths: progressionReport.persistentStrengths,
      persistentWeaknesses: progressionReport.persistentWeaknesses,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        summary,
        detailed: progressionReport
      }),
    };

  } catch (error: any) {
    console.error('get-stage-progression error:', error);
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