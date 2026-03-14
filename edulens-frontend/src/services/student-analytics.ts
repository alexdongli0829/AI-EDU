import { TestSession, Test } from '@/types';

// NSW OC skill taxonomy — must mirror analyze-session.ts on the backend
export const OC_SKILLS = {
  math: [
    'Number & Algebra',
    'Fractions & Decimals',
    'Measurement & Geometry',
    'Statistics & Probability',
    'Problem Solving',
    'Working Mathematically',
  ],
  general_ability: [
    'Logical Reasoning',
    'Pattern Recognition',
    'Spatial Reasoning',
    'Verbal Reasoning',
    'Abstract Reasoning',
    'Critical Thinking',
  ],
  english: [
    'Reading Comprehension',
    'Vocabulary',
    'Inference & Interpretation',
    'Grammar & Language',
    'Text Structure',
    'Language & Expression',
  ],
} as const;

const SKILL_KEYWORDS: Record<string, Record<string, string[]>> = {
  math: {
    'Number & Algebra':         ['number', 'algebra', 'equation', 'integer', 'arithmetic'],
    'Fractions & Decimals':     ['fraction', 'decimal', 'percent', 'ratio', 'proportion'],
    'Measurement & Geometry':   ['measure', 'geometry', 'shape', 'area', 'perimeter', 'volume', 'angle'],
    'Statistics & Probability': ['statistic', 'probability', 'data', 'graph', 'average', 'mean', 'chance'],
    'Problem Solving':          ['problem', 'word problem', 'application', 'reasoning'],
    'Working Mathematically':   ['pattern', 'strategy', 'working', 'process', 'generalise'],
  },
  general_ability: {
    'Logical Reasoning':   ['logic', 'logical', 'deduction', 'argument', 'conclusion'],
    'Pattern Recognition': ['pattern', 'sequence', 'series', 'rule'],
    'Spatial Reasoning':   ['spatial', 'rotation', 'reflection', 'fold', '3d', 'visual'],
    'Verbal Reasoning':    ['verbal', 'analogy', 'synonym', 'antonym'],
    'Abstract Reasoning':  ['abstract', 'matrix', 'figure', 'symbol'],
    'Critical Thinking':   ['critical', 'evaluate', 'analyse', 'assess', 'inference'],
  },
  english: {
    'Reading Comprehension':     ['comprehension', 'passage', 'read', 'main idea'],
    'Vocabulary':                ['vocabulary', 'word', 'meaning', 'definition'],
    'Inference & Interpretation':['inference', 'infer', 'interpret', 'imply', 'deduce'],
    'Grammar & Language':        ['grammar', 'punctuation', 'spelling', 'verb', 'noun', 'tense'],
    'Text Structure':            ['structure', 'text type', 'genre', 'paragraph'],
    'Language & Expression':     ['expression', 'figurative', 'metaphor', 'simile', 'technique'],
  },
};

type SubjectKey = keyof typeof OC_SKILLS;

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
  };
  skillBreakdown: {
    math: SkillEntry[];
    thinking: SkillEntry[];
    reading: SkillEntry[];
  };
  scoreTrend: {
    math: Array<{ date: string; score: number }>;
    thinking: Array<{ date: string; score: number }>;
    reading: Array<{ date: string; score: number }>;
  };
  monthTrend: {
    math: Array<{ date: string; score: number }>;
    thinking: Array<{ date: string; score: number }>;
    reading: Array<{ date: string; score: number }>;
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

class StudentAnalyticsService {
  private baseUrl = process.env.NEXT_PUBLIC_TEST_API || 'http://localhost:3002';

  async getStudentAnalytics(studentId: string): Promise<StudentAnalytics> {
    const sessions = await this.fetchSessions(studentId);
    return this.buildAnalytics(sessions);
  }

  async getSessionDetail(studentId: string, sessionId: string): Promise<SessionDetail | null> {
    const sessions = await this.fetchSessions(studentId);
    const s = sessions.find((s: any) => s.sessionId === sessionId);
    if (!s) return null;
    return {
      sessionId: s.sessionId,
      testTitle: s.testTitle || 'OC Practice Test',
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
  }

  private async fetchSessions(studentId: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/student/${studentId}`);
      const data = await response.json();
      return data.success && data.sessions ? data.sessions : [];
    } catch {
      return [];
    }
  }

  private buildAnalytics(sessions: any[]): StudentAnalytics {
    if (sessions.length === 0) return this.emptyAnalytics();

    return {
      studentId: '',
      totalTests: sessions.length,
      averageScore: this.avgScore(sessions),
      lastTestDate: this.lastDate(sessions),
      learningDNA: this.buildDNA(sessions),
      skillBreakdown: this.buildSkillBreakdown(sessions),
      scoreTrend: this.buildScoreTrend(sessions),
      monthTrend: this.buildMonthTrend(sessions),
      recentResults: this.buildRecentResults(sessions),
      errorAnalysis: this.buildErrorAnalysis(sessions),
    };
  }

  private emptyAnalytics(): StudentAnalytics {
    return {
      studentId: '',
      totalTests: 0,
      averageScore: 0,
      lastTestDate: 'Never',
      learningDNA: { math: 0, thinking: 0, reading: 0 },
      skillBreakdown: {
        math: OC_SKILLS.math.map(skill => ({ skill, correct: 0, total: 0, percentage: 0, trend: 'stable', history: [] })),
        thinking: OC_SKILLS.general_ability.map(skill => ({ skill, correct: 0, total: 0, percentage: 0, trend: 'stable', history: [] })),
        reading: OC_SKILLS.english.map(skill => ({ skill, correct: 0, total: 0, percentage: 0, trend: 'stable', history: [] })),
      },
      scoreTrend: { math: [], thinking: [], reading: [] },
      monthTrend: { math: [], thinking: [], reading: [] },
      recentResults: [],
      errorAnalysis: {
        math: { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 },
        thinking: { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 },
        reading: { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 },
      },
    };
  }

  private avgScore(sessions: any[]): number {
    const total = sessions.reduce((s, x) => s + (x.finalResults?.scaledScore || 0), 0);
    return Math.round(total / sessions.length);
  }

  private lastDate(sessions: any[]): string {
    const last = [...sessions].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    )[0];
    const days = Math.floor((Date.now() - new Date(last.completedAt).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(last.completedAt).toLocaleDateString('en-AU');
  }

  private subjectToDNA(subj: string): 'math' | 'thinking' | 'reading' | null {
    if (subj === 'math') return 'math';
    if (subj === 'general_ability') return 'thinking';
    if (subj === 'english') return 'reading';
    return null;
  }

  private buildDNA(sessions: any[]): { math: number; thinking: number; reading: number } {
    const buckets: Record<string, number[]> = { math: [], thinking: [], reading: [] };
    sessions.forEach(s => {
      const key = this.subjectToDNA(s.subject);
      if (key) buckets[key].push(s.finalResults?.scaledScore || 0);
    });
    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return { math: avg(buckets.math), thinking: avg(buckets.thinking), reading: avg(buckets.reading) };
  }

  private mapTagsToOCSkills(tags: string[], subject: SubjectKey): string[] {
    const subjectSkills = OC_SKILLS[subject] as readonly string[];
    if (!tags.length) return [subjectSkills[0]];

    const keywordMap = SKILL_KEYWORDS[subject] || {};
    const matched = new Set<string>();

    for (const tag of tags) {
      const tagLower = tag.toLowerCase().replace(/_/g, ' ').trim();
      let found = false;
      for (const [skill, keywords] of Object.entries(keywordMap)) {
        if (keywords.some(kw => tagLower.includes(kw) || kw.includes(tagLower))) {
          matched.add(skill);
          found = true;
        }
      }
      if (!found) {
        const direct = subjectSkills.find(s =>
          s.toLowerCase().includes(tagLower) || tagLower.includes(s.toLowerCase().split(' ')[0])
        );
        if (direct) matched.add(direct);
      }
    }

    return matched.size > 0 ? Array.from(matched) : [subjectSkills[0]];
  }

  private buildSkillBreakdown(sessions: any[]): StudentAnalytics['skillBreakdown'] {
    type Counts = { correct: number; total: number };

    const now = Date.now();
    const MS_90  = 90  * 86400000; // 3 months
    const MS_45  = 45  * 86400000; // midpoint of that window

    // Limit to last 3 months; fall back to all sessions if fewer exist
    const inWindow = sessions.filter(
      s => now - new Date(s.completedAt).getTime() <= MS_90
    );
    const window3m = inWindow.length > 0 ? inWindow : sessions;

    // Sort chronologically
    const sorted = [...window3m].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

    // Split at the 45-day midpoint: "earlier half" vs "recent half"
    const recent  = sorted.filter(s => now - new Date(s.completedAt).getTime() <= MS_45);
    const history = sorted.filter(s => now - new Date(s.completedAt).getTime() >  MS_45);

    const accumulate = (sessionList: any[], subj: SubjectKey): Map<string, Counts> => {
      const map = new Map<string, Counts>();
      sessionList.forEach(session => {
        if (session.subject !== subj) return;
        session.answers?.forEach((a: any) => {
          const ocSkills = this.mapTagsToOCSkills(a.skillTags || [], subj);
          ocSkills.forEach(skill => {
            if (!map.has(skill)) map.set(skill, { correct: 0, total: 0 });
            const d = map.get(skill)!;
            d.total++;
            if (a.isCorrect) d.correct++;
          });
        });
      });
      return map;
    };

    const pct = (d: Counts | undefined) =>
      d && d.total > 0 ? Math.round((d.correct / d.total) * 100) : null;

    // Build one data point per session for a given skill
    const buildHistory = (subj: SubjectKey, skill: string): Array<{ date: string; percentage: number }> => {
      return sorted
        .filter(s => s.subject === subj)
        .map(s => {
          const counts = { correct: 0, total: 0 };
          s.answers?.forEach((a: any) => {
            const ocSkills = this.mapTagsToOCSkills(a.skillTags || [], subj);
            if (ocSkills.includes(skill)) {
              counts.total++;
              if (a.isCorrect) counts.correct++;
            }
          });
          if (counts.total === 0) return null;
          return {
            date: new Date(s.completedAt).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
            percentage: Math.round((counts.correct / counts.total) * 100),
          };
        })
        .filter((d): d is { date: string; percentage: number } => d !== null);
    };

    const toEntries = (subj: SubjectKey): SkillEntry[] => {
      const allMap    = accumulate(sorted,  subj);
      const recentMap = accumulate(recent,  subj);
      const histMap   = accumulate(history, subj);

      return (OC_SKILLS[subj] as readonly string[]).map(skill => {
        const all  = allMap.get(skill) || { correct: 0, total: 0 };
        const rec  = pct(recentMap.get(skill));
        const hist = pct(histMap.get(skill));

        // Trend: recent 45 days vs earlier 45 days (±8 % threshold)
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (rec !== null && hist !== null) {
          if (rec >= hist + 8) trend = 'up';
          else if (rec <= hist - 8) trend = 'down';
        }

        return {
          skill,
          correct: all.correct,
          total: all.total,
          percentage: pct(all) ?? 0,
          trend,
          history: buildHistory(subj, skill),
        };
      });
    };

    return {
      math:     toEntries('math'),
      thinking: toEntries('general_ability'),
      reading:  toEntries('english'),
    };
  }

  private buildScoreTrend(sessions: any[]): StudentAnalytics['scoreTrend'] {
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );
    const trend: StudentAnalytics['scoreTrend'] = { math: [], thinking: [], reading: [] };
    sorted.forEach(s => {
      const key = this.subjectToDNA(s.subject);
      if (!key) return;
      trend[key].push({
        date: new Date(s.completedAt).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
        score: s.finalResults?.scaledScore || 0,
      });
    });
    return trend;
  }

  private buildMonthTrend(sessions: any[]): StudentAnalytics['monthTrend'] {
    const now = Date.now();
    const MS_90 = 90 * 86400000;
    const MS_30 = 30 * 86400000;

    // Prefer last 30 days; fall back to last 90 days; fall back to all sessions
    const pick = (ms: number) => sessions.filter(s => now - new Date(s.completedAt).getTime() <= ms);
    const in30 = pick(MS_30);
    const in90 = pick(MS_90);

    const trend: StudentAnalytics['monthTrend'] = { math: [], thinking: [], reading: [] };

    // Build per-subject using the widest window that has at least 1 session per subject
    const subjectKeys: Array<'math' | 'general_ability' | 'english'> = ['math', 'general_ability', 'english'];
    subjectKeys.forEach(subj => {
      const dnaKey = this.subjectToDNA(subj)!;
      const has30 = in30.some(s => s.subject === subj);
      const pool  = has30 ? in30 : in90.some(s => s.subject === subj) ? in90 : sessions;
      const sorted = [...pool]
        .filter(s => s.subject === subj)
        .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
      sorted.forEach(s => {
        trend[dnaKey].push({
          date: new Date(s.completedAt).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
          score: s.finalResults?.scaledScore || 0,
        });
      });
    });

    return trend;
  }

  private buildErrorAnalysis(sessions: any[]): StudentAnalytics['errorAnalysis'] {
    const CARELESS_MAX = 5;      // seconds
    const TIME_PRESSURE_MIN = 0.20; // fraction of test time remaining
    const CONCEPT_GAP_MIN = 120;   // seconds

    const empty = (): ErrorBreakdown => ({ total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 });
    const result = { math: empty(), thinking: empty(), reading: empty() };

    for (const session of sessions) {
      const dnaKey = this.subjectToDNA(session.subject);
      if (!dnaKey) continue;
      const bucket = result[dnaKey];
      const timeLimit = session.timeLimit || 1800;
      const answers: any[] = session.answers || [];

      // Build cumulative time to determine % remaining when each question started
      let cumulative = 0;
      for (const a of answers) {
        if (!a.isCorrect) {
          const timeSpent = parseInt(a.timeSpent) || 0;
          const pctRemaining = (timeLimit - cumulative) / timeLimit;
          bucket.total++;

          if (timeSpent < CARELESS_MAX) {
            bucket.careless++;
          } else if (pctRemaining < TIME_PRESSURE_MIN) {
            bucket.timePressure++;
          } else if (timeSpent > CONCEPT_GAP_MIN) {
            bucket.conceptGap++;
          } else {
            bucket.other++;
          }
        }
        cumulative += parseInt(a.timeSpent) || 0;
      }
    }

    return result;
  }

  private buildRecentResults(sessions: any[]): StudentAnalytics['recentResults'] {
    return [...sessions]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 6)
      .map(s => {
        const score = s.finalResults?.scaledScore || 0;
        const status: 'good' | 'ok' | 'low' = score >= 75 ? 'good' : score >= 55 ? 'ok' : 'low';
        return {
          date: new Date(s.completedAt).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
          title: s.testTitle || 'OC Practice Test',
          score,
          status,
          sessionId: s.sessionId,
          subject: s.subject || '',
        };
      });
  }
}

export const studentAnalyticsService = new StudentAnalyticsService();
