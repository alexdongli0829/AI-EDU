/**
 * Student analytics service.
 *
 * All computation happens server-side via GET /analytics/student/{studentId}.
 * This file is intentionally thin — it just fetches and types the response.
 * STAGE_SKILLS is still exported so UI components can read skill label lists
 * without making a network call.
 */

// ─── Stage-aware skill taxonomies (UI reference only — computation is backend) ──
export const STAGE_SKILLS: Record<string, {
  math: readonly string[];
  general_ability: readonly string[];
  english: readonly string[];
  writing?: readonly string[];
}> = {
  oc_prep: {
    math:            ['Number & Algebra', 'Fractions & Decimals', 'Measurement & Geometry', 'Statistics & Probability', 'Problem Solving', 'Working Mathematically'],
    general_ability: ['Logical Reasoning', 'Pattern Recognition', 'Spatial Reasoning', 'Verbal Reasoning', 'Abstract Reasoning', 'Critical Thinking'],
    english:         ['Reading Comprehension', 'Vocabulary', 'Inference & Interpretation', 'Grammar & Language', 'Text Structure', 'Language & Expression'],
  },
  selective: {
    math:            ['Number & Algebra', 'Measurement & Space', 'Statistics & Probability', 'Working Mathematically', 'Problem Solving', 'Financial Maths'],
    general_ability: ['Abstract Reasoning', 'Logical Deduction', 'Pattern Recognition', 'Spatial Reasoning', 'Verbal Reasoning', 'Critical Analysis'],
    english:         ['Reading Comprehension', 'Inference & Interpretation', 'Vocabulary in Context', 'Text Analysis', 'Literary Techniques', "Author's Purpose"],
    writing:         ['Ideas & Content', 'Text Structure', 'Language Features', 'Grammar & Punctuation', 'Vocabulary', 'Writing for Audience'],
  },
  hsc: {
    math:            ['Functions & Graphs', 'Calculus', 'Financial Maths', 'Statistics & Data', 'Algebra & Equations', 'Measurement & Geometry'],
    general_ability: ['Scientific Reasoning', 'Data Analysis', 'Experiment Design', 'Chemical Concepts', 'Physical Concepts', 'Biological Concepts'],
    english:         ['Textual Analysis', 'Essay Writing', 'Creative Writing', 'Vocabulary & Language', 'Literary Techniques', 'Text & Context'],
  },
  lifelong: {
    math:            ['Statistical Analysis', 'Mathematical Modelling', 'Logical Reasoning', 'Financial Literacy', 'Data Interpretation', 'Quantitative Analysis'],
    general_ability: ['Argumentation', 'Evidence Evaluation', 'Logical Fallacies', 'Analytical Reasoning', 'Synthesis & Inference', 'Problem Framing'],
    english:         ['Academic Reading', 'Academic Writing', 'Rhetorical Analysis', 'Vocabulary & Register', 'Text Critique', 'Communication'],
  },
};

// Backwards-compatible alias
export const OC_SKILLS = STAGE_SKILLS.oc_prep;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SkillEntry {
  skill: string;
  correct: number;
  total: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  history: Array<{ date: string; percentage: number }>;
}

export interface StudentAnalytics {
  studentId: string;
  totalTests: number;
  averageScore: number;
  lastTestDate: string;
  learningDNA: {
    math: number;
    thinking: number;
    reading: number;
    writing?: number;
  };
  skillBreakdown: {
    math: SkillEntry[];
    thinking: SkillEntry[];
    reading: SkillEntry[];
    writing?: SkillEntry[];
  };
  scoreTrend: {
    math: Array<{ date: string; score: number }>;
    thinking: Array<{ date: string; score: number }>;
    reading: Array<{ date: string; score: number }>;
    writing?: Array<{ date: string; score: number }>;
  };
  monthTrend: {
    math: Array<{ date: string; score: number }>;
    thinking: Array<{ date: string; score: number }>;
    reading: Array<{ date: string; score: number }>;
    writing?: Array<{ date: string; score: number }>;
  };
  recentResults: Array<{
    date: string;
    title: string;
    score: number;
    status: 'good' | 'ok' | 'low';
    sessionId: string;
    subject: string;
  }>;
  errorAnalysis: {
    math: ErrorBreakdown;
    thinking: ErrorBreakdown;
    reading: ErrorBreakdown;
    writing?: ErrorBreakdown;
  };
}

export interface ErrorBreakdown {
  total: number;
  careless: number;
  timePressure: number;
  conceptGap: number;
  other: number;
}

export interface SessionDetail {
  sessionId: string;
  testTitle: string;
  subject: string;
  completedAt: string;
  scaledScore: number;
  correctCount: number;
  totalItems: number;
  timeLimit: number;
  answers: Array<{
    questionId: string;
    questionText: string;
    options: string[];
    correctAnswer: string;
    studentAnswer: string;
    isCorrect: boolean;
    timeSpent: number;
    skillTags: string[];
    reattemptCount: number;
    aiInteractions: number;
    errorClassification: string | null;
  }>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

class StudentAnalyticsService {
  private baseUrl = process.env.NEXT_PUBLIC_TEST_API || 'http://localhost:3002';

  async getStudentAnalytics(studentId: string, stageId?: string): Promise<StudentAnalytics> {
    try {
      const url = new URL(`${this.baseUrl}/analytics/student/${studentId}`);
      if (stageId) url.searchParams.set('stageId', stageId);
      const response = await fetch(url.toString());
      const data = await response.json();
      if (data.success && data.analytics) {
        return data.analytics as StudentAnalytics;
      }
      return this.emptyAnalytics(stageId);
    } catch {
      return this.emptyAnalytics(stageId);
    }
  }

  async getSessionDetail(studentId: string, sessionId: string): Promise<SessionDetail | null> {
    try {
      const url = `${this.baseUrl}/sessions/student/${studentId}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!data.success || !data.sessions) return null;
      const s = data.sessions.find((s: any) => s.sessionId === sessionId);
      if (!s) return null;
      return {
        sessionId: s.sessionId,
        testTitle: s.testTitle || 'Practice Test',
        subject: s.subject || '',
        completedAt: s.completedAt,
        scaledScore: s.finalResults?.scaledScore || 0,
        correctCount: s.finalResults?.correctCount || 0,
        totalItems: s.finalResults?.totalItems || 0,
        timeLimit: s.timeLimit || 1800,
        answers: (s.answers || []).map((a: any) => ({
          questionId: a.questionId,
          questionText: a.questionText || '',
          options: a.options || [],
          correctAnswer: a.correctAnswer || '',
          studentAnswer: a.studentAnswer || '',
          isCorrect: a.isCorrect,
          timeSpent: parseInt(a.timeSpent) || 0,
          skillTags: a.skillTags || [],
          reattemptCount: parseInt(a.reattemptCount) || 0,
          aiInteractions: parseInt(a.aiInteractions) || 0,
          errorClassification: a.errorClassification || null,
        })),
      };
    } catch {
      return null;
    }
  }

  private emptyAnalytics(stageId?: string): StudentAnalytics {
    const hasWriting = stageId === 'selective';
    const stageMap = STAGE_SKILLS[stageId ?? 'oc_prep'] ?? STAGE_SKILLS.oc_prep;
    const empty = (skills: readonly string[]) =>
      skills.map(skill => ({ skill, correct: 0, total: 0, percentage: 0, trend: 'stable' as const, history: [] }));
    return {
      studentId: '',
      totalTests: 0,
      averageScore: 0,
      lastTestDate: 'Never',
      learningDNA: { math: 0, thinking: 0, reading: 0, ...(hasWriting ? { writing: 0 } : {}) },
      skillBreakdown: {
        math:     empty(stageMap.math),
        thinking: empty(stageMap.general_ability),
        reading:  empty(stageMap.english),
        ...(hasWriting ? { writing: empty(stageMap.writing ?? []) } : {}),
      },
      scoreTrend:   { math: [], thinking: [], reading: [], ...(hasWriting ? { writing: [] } : {}) },
      monthTrend:   { math: [], thinking: [], reading: [], ...(hasWriting ? { writing: [] } : {}) },
      recentResults: [],
      errorAnalysis: {
        math:     { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 },
        thinking: { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 },
        reading:  { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 },
        ...(hasWriting ? { writing: { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 } } : {}),
      },
    };
  }
}

export const studentAnalyticsService = new StudentAnalyticsService();
