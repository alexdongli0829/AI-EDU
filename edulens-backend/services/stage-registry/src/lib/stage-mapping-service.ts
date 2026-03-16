/**
 * Stage Mapping Service
 * 处理学生在不同stage之间的技能映射和转换
 */

import { getDb, query } from '../lib/database';

interface SkillBridge {
  id: string;
  fromStageId: string;
  fromSkill: string;
  toStageId: string;
  toSkill: string;
  priorWeight: number;
}

interface StageProfile {
  skill_graph: {
    taxonomy_id: string;
    nodes: Array<{
      skill_id: string;
      mastery: number;
      confidence: number;
      trend: string;
      sample_size: number;
      last_updated: string;
      bridged_from?: {
        stage: string;
        skill_id: string;
        mastery_at_transition: number;
      };
    }>;
  };
  stage_error_stats: {
    total_questions: number;
    error_distribution: Record<string, number>;
  };
  overall_mastery: number;
  strengths: string[];
  weaknesses: string[];
}

interface CoreProfile {
  error_profile: {
    lifetime_distribution: Record<string, number>;
    trend: string;
    notable_patterns: Array<{
      pattern: string;
      first_seen: string;
      last_seen: string;
      frequency: number;
      stages_observed: string[];
    }>;
  };
  time_behavior: {
    pacing_style: string;
    rush_tendency: number;
    stamina_pattern: string;
    completion_rate_avg: number;
    evolution: Array<{
      stage: string;
      completion_rate: number;
      measured_at: string;
    }>;
  };
  confidence_estimate: {
    calibration: string;
    answer_change_rate: number;
    risk_appetite: string;
  };
  learning_style: {
    prefers_worked_examples: boolean | null;
    responds_to_socratic: boolean | null;
    persistence_on_hard_questions: string;
    derived_from_sessions: number;
  };
  stage_evolution: Record<string, any>;
}

export class StageMappingService {
  
  /**
   * 获取两个stage之间的技能桥梁
   */
  async getSkillBridges(fromStageId: string, toStageId: string): Promise<SkillBridge[]> {
    const bridges = await query(`
      SELECT id, from_stage_id, from_skill, to_stage_id, to_skill, prior_weight
      FROM skill_bridges
      WHERE from_stage_id = $1 AND to_stage_id = $2
      ORDER BY from_skill ASC
    `, fromStageId, toStageId) as SkillBridge[];
    
    return bridges;
  }

  /**
   * 基于技能桥梁映射，从前一个stage初始化新stage的技能掌握度
   */
  async initializeStageFromPrevious(
    studentId: string, 
    fromStageId: string, 
    toStageId: string
  ): Promise<Partial<StageProfile>> {
    
    // 1. 获取学生在前一个stage的profile
    const previousStageResult = await query(`
      SELECT stage_profile
      FROM student_stages
      WHERE student_id = $1 AND stage_id = $2 AND status != 'inactive'
      ORDER BY activated_at DESC
      LIMIT 1
    `, studentId, fromStageId) as Array<{stage_profile: any}>;

    if (previousStageResult.length === 0) {
      throw new Error(`No previous stage profile found for student ${studentId} in stage ${fromStageId}`);
    }

    const previousProfile = previousStageResult[0].stage_profile as StageProfile;

    // 2. 获取技能桥梁
    const bridges = await this.getSkillBridges(fromStageId, toStageId);

    // 3. 基于桥梁映射创建新stage的初始技能图
    const mappedSkills: Array<{
      skill_id: string;
      mastery: number;
      confidence: number;
      trend: string;
      sample_size: number;
      last_updated: string;
      bridged_from: {
        stage: string;
        skill_id: string;
        mastery_at_transition: number;
      };
    }> = [];

    for (const bridge of bridges) {
      // 找到前一个stage中对应的技能
      const previousSkill = previousProfile.skill_graph.nodes.find(
        node => node.skill_id === bridge.fromSkill
      );

      if (previousSkill) {
        // 应用prior_weight来调整初始mastery
        const adjustedMastery = previousSkill.mastery * bridge.priorWeight;
        
        mappedSkills.push({
          skill_id: bridge.toSkill,
          mastery: adjustedMastery,
          confidence: Math.max(0.3, previousSkill.confidence * 0.8), // 降低confidence
          trend: 'transferred',
          sample_size: 0, // 新stage中还没有样本
          last_updated: new Date().toISOString(),
          bridged_from: {
            stage: fromStageId,
            skill_id: bridge.fromSkill,
            mastery_at_transition: previousSkill.mastery
          }
        });
      }
    }

    // 4. 获取目标stage的完整skill taxonomy
    const targetTaxonomy = await this.getStageSkillTaxonomy(toStageId);
    
    // 5. 为没有桥梁映射的技能设置默认值
    const allTargetSkills = this.extractSkillsFromTaxonomy(targetTaxonomy);
    const mappedSkillIds = new Set(mappedSkills.map(s => s.skill_id));

    for (const skillId of allTargetSkills) {
      if (!mappedSkillIds.has(skillId)) {
        mappedSkills.push({
          skill_id: skillId,
          mastery: 0.5, // 默认中等水平
          confidence: 0.5,
          trend: 'new',
          sample_size: 0,
          last_updated: new Date().toISOString(),
          bridged_from: {
            stage: 'baseline',
            skill_id: 'none',
            mastery_at_transition: 0.5
          }
        });
      }
    }

    // 6. 构造新的stage profile
    const newStageProfile: Partial<StageProfile> = {
      skill_graph: {
        taxonomy_id: `${toStageId}_skills_v1`,
        nodes: mappedSkills
      },
      stage_error_stats: {
        total_questions: 0,
        error_distribution: {
          concept_gap: 0.0,
          careless_error: 0.0,
          time_pressure: 0.0,
          misread_question: 0.0,
          elimination_failure: 0.0
        }
      },
      overall_mastery: this.calculateOverallMastery(mappedSkills),
      strengths: this.identifyStrengths(mappedSkills),
      weaknesses: this.identifyWeaknesses(mappedSkills)
    };

    return newStageProfile;
  }

  /**
   * 激活学生的新stage，应用技能映射
   */
  async activateStudentStage(
    studentId: string,
    stageId: string,
    previousStageId?: string
  ): Promise<string> {
    const db = await getDb();

    let stageProfile: Partial<StageProfile>;

    if (previousStageId) {
      // 基于前一个stage进行映射初始化
      stageProfile = await this.initializeStageFromPrevious(studentId, previousStageId, stageId);
    } else {
      // 新学生，使用默认初始化
      stageProfile = await this.initializeBaselineStage(stageId);
    }

    // 插入新的student_stage记录
    const result = await query(`
      INSERT INTO student_stages (student_id, stage_id, status, stage_profile, activated_at)
      VALUES ($1, $2, 'active', $3, NOW())
      RETURNING id
    `, studentId, stageId, JSON.stringify(stageProfile)) as Array<{id: string}>;

    // 更新学生的core profile，记录stage evolution
    await this.updateCoreProfileStageEvolution(studentId, stageId, previousStageId);

    return result[0].id;
  }

  /**
   * 更新Core Profile中的stage evolution记录
   */
  async updateCoreProfileStageEvolution(
    studentId: string, 
    newStageId: string, 
    previousStageId?: string
  ): Promise<void> {
    
    // 获取当前core profile
    const studentResult = await query(`
      SELECT core_profile
      FROM students
      WHERE id = $1
    `, studentId) as Array<{core_profile: any}>;

    let coreProfile: CoreProfile = studentResult[0]?.core_profile || this.getDefaultCoreProfile();

    // 更新stage evolution记录
    if (!coreProfile.stage_evolution) {
      coreProfile.stage_evolution = {};
    }

    coreProfile.stage_evolution[newStageId] = {
      activated_at: new Date().toISOString(),
      transitioned_from: previousStageId || null,
      initial_mastery: previousStageId ? 'transferred' : 'baseline'
    };

    // 如果有前一个stage，记录完成信息
    if (previousStageId && coreProfile.stage_evolution[previousStageId]) {
      coreProfile.stage_evolution[previousStageId].completed_at = new Date().toISOString();
      coreProfile.stage_evolution[previousStageId].transitioned_to = newStageId;
    }

    // 保存更新的core profile
    await query(`
      UPDATE students 
      SET core_profile = $2, updated_at = NOW()
      WHERE id = $1
    `, studentId, JSON.stringify(coreProfile));
  }

  /**
   * 获取学生的跨stage技能演进报告
   */
  async getCrossStageProgression(studentId: string): Promise<{
    stages: Array<{
      stageId: string;
      activatedAt: string;
      completedAt?: string;
      skillProgression: Array<{
        skillCategory: string;
        masteryEvolution: Array<{ stage: string; mastery: number; date: string }>;
      }>;
    }>;
    persistentStrengths: string[];
    persistentWeaknesses: string[];
    overallTrend: 'improving' | 'stable' | 'declining';
  }> {
    
    // 获取学生所有stage的历史记录
    const stageHistory = await query(`
      SELECT stage_id, stage_profile, activated_at, completed_at
      FROM student_stages
      WHERE student_id = $1
      ORDER BY activated_at ASC
    `, studentId) as Array<{
      stage_id: string;
      stage_profile: any;
      activated_at: string;
      completed_at: string | null;
    }>;

    // 分析技能演进
    const skillProgression = this.analyzeSkillProgression(stageHistory);
    
    // 识别持久的优势和弱势
    const { persistentStrengths, persistentWeaknesses } = this.identifyPersistentPatterns(stageHistory);

    // 计算整体趋势
    const overallTrend = this.calculateOverallTrend(stageHistory);

    return {
      stages: stageHistory.map(stage => ({
        stageId: stage.stage_id,
        activatedAt: stage.activated_at,
        completedAt: stage.completed_at,
        skillProgression: skillProgression[stage.stage_id] || []
      })),
      persistentStrengths,
      persistentWeaknesses,
      overallTrend
    };
  }

  // ======= Helper Methods =======

  private async getStageSkillTaxonomy(stageId: string): Promise<any> {
    const result = await query(`
      SELECT categories 
      FROM skill_taxonomies
      WHERE stage_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, stageId) as Array<{categories: any}>;

    return result[0]?.categories || {};
  }

  private extractSkillsFromTaxonomy(taxonomy: any): string[] {
    const skills: string[] = [];
    
    if (taxonomy.categories) {
      for (const category of taxonomy.categories) {
        if (category.skills) {
          for (const skill of category.skills) {
            skills.push(skill.id);
          }
        }
      }
    }
    
    return skills;
  }

  private calculateOverallMastery(skills: Array<{mastery: number}>): number {
    if (skills.length === 0) return 0.5;
    const sum = skills.reduce((total, skill) => total + skill.mastery, 0);
    return sum / skills.length;
  }

  private identifyStrengths(skills: Array<{skill_id: string; mastery: number}>): string[] {
    return skills
      .filter(skill => skill.mastery >= 0.75)
      .map(skill => skill.skill_id)
      .slice(0, 3); // Top 3 strengths
  }

  private identifyWeaknesses(skills: Array<{skill_id: string; mastery: number}>): string[] {
    return skills
      .filter(skill => skill.mastery <= 0.5)
      .map(skill => skill.skill_id)
      .slice(0, 3); // Top 3 weaknesses
  }

  private async initializeBaselineStage(stageId: string): Promise<Partial<StageProfile>> {
    const taxonomy = await this.getStageSkillTaxonomy(stageId);
    const allSkills = this.extractSkillsFromTaxonomy(taxonomy);

    const baselineSkills = allSkills.map(skillId => ({
      skill_id: skillId,
      mastery: 0.5,
      confidence: 0.5,
      trend: 'new',
      sample_size: 0,
      last_updated: new Date().toISOString(),
      bridged_from: {
        stage: 'baseline',
        skill_id: 'none',
        mastery_at_transition: 0.5
      }
    }));

    return {
      skill_graph: {
        taxonomy_id: `${stageId}_skills_v1`,
        nodes: baselineSkills
      },
      stage_error_stats: {
        total_questions: 0,
        error_distribution: {}
      },
      overall_mastery: 0.5,
      strengths: [],
      weaknesses: []
    };
  }

  private getDefaultCoreProfile(): CoreProfile {
    return {
      error_profile: {
        lifetime_distribution: {},
        trend: 'baseline',
        notable_patterns: []
      },
      time_behavior: {
        pacing_style: 'unknown',
        rush_tendency: 0.5,
        stamina_pattern: 'unknown',
        completion_rate_avg: 1.0,
        evolution: []
      },
      confidence_estimate: {
        calibration: 'unknown',
        answer_change_rate: 0.15,
        risk_appetite: 'moderate'
      },
      learning_style: {
        prefers_worked_examples: null,
        responds_to_socratic: null,
        persistence_on_hard_questions: 'unknown',
        derived_from_sessions: 0
      },
      stage_evolution: {}
    };
  }

  private analyzeSkillProgression(stageHistory: Array<any>): Record<string, any[]> {
    // Implementation for analyzing how skills evolve across stages
    return {};
  }

  private identifyPersistentPatterns(stageHistory: Array<any>): {
    persistentStrengths: string[];
    persistentWeaknesses: string[];
  } {
    // Implementation for identifying patterns that persist across stages
    return { persistentStrengths: [], persistentWeaknesses: [] };
  }

  private calculateOverallTrend(stageHistory: Array<any>): 'improving' | 'stable' | 'declining' {
    // Implementation for calculating overall learning trend
    return 'stable';
  }
}

export const stageMappingService = new StageMappingService();