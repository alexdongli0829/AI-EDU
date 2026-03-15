/**
 * GET /analytics/student/{studentId}?stageId=xxx
 *
 * Computes and returns the full StudentAnalytics payload server-side.
 * The frontend should call this instead of fetching raw sessions and
 * recomputing skill breakdowns, trends, and error analysis client-side.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../lib/database';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
};

// ─── Stage-aware skill taxonomies ──────────────────────────────────────────
const STAGE_SKILLS: Record<string, Record<string, string[]>> = {
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

const STAGE_SKILL_KEYWORDS: Record<string, Record<string, Record<string, string[]>>> = {
  oc_prep: {
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
      'Reading Comprehension':      ['comprehension', 'passage', 'read', 'main idea'],
      'Vocabulary':                 ['vocabulary', 'word', 'meaning', 'definition'],
      'Inference & Interpretation': ['inference', 'infer', 'interpret', 'imply', 'deduce'],
      'Grammar & Language':         ['grammar', 'punctuation', 'spelling', 'verb', 'noun', 'tense'],
      'Text Structure':             ['structure', 'text type', 'genre', 'paragraph'],
      'Language & Expression':      ['expression', 'figurative', 'metaphor', 'simile', 'technique'],
    },
  },
  selective: {
    math: {
      'Number & Algebra':         ['number', 'algebra', 'equation', 'integer', 'arithmetic', 'index', 'surds'],
      'Measurement & Space':      ['measure', 'space', 'geometry', 'shape', 'area', 'perimeter', 'volume', 'angle', 'coordinate'],
      'Statistics & Probability': ['statistic', 'probability', 'data', 'graph', 'average', 'mean', 'median', 'chance'],
      'Working Mathematically':   ['working', 'strategy', 'process', 'generalise', 'justify'],
      'Problem Solving':          ['problem', 'word problem', 'application', 'multi-step'],
      'Financial Maths':          ['financial', 'money', 'profit', 'loss', 'interest', 'tax', 'budget'],
    },
    general_ability: {
      'Abstract Reasoning':  ['abstract', 'matrix', 'figure', 'symbol', 'non-verbal'],
      'Logical Deduction':   ['logic', 'deduction', 'syllogism', 'if then', 'conclusion', 'argument'],
      'Pattern Recognition': ['pattern', 'sequence', 'series', 'rule', 'next term'],
      'Spatial Reasoning':   ['spatial', 'rotation', 'reflection', 'fold', '3d', 'visual', 'nets'],
      'Verbal Reasoning':    ['verbal', 'analogy', 'synonym', 'antonym', 'word relationship'],
      'Critical Analysis':   ['critical', 'analyse', 'evaluate', 'assess', 'flaw', 'assumption'],
    },
    english: {
      'Reading Comprehension':      ['comprehension', 'passage', 'read', 'main idea', 'summary'],
      'Inference & Interpretation': ['inference', 'infer', 'interpret', 'imply', 'deduce', 'suggest'],
      'Vocabulary in Context':      ['vocabulary', 'context', 'meaning', 'definition', 'connotation'],
      'Text Analysis':              ['analyse', 'analyse text', 'structure', 'genre', 'text type', 'purpose'],
      'Literary Techniques':        ['technique', 'figurative', 'metaphor', 'simile', 'imagery', 'alliteration', 'personification'],
      "Author's Purpose":           ['purpose', 'intent', 'audience', 'perspective', 'point of view', 'bias'],
    },
    writing: {
      'Ideas & Content':         ['idea', 'content', 'creativity', 'originality', 'detail', 'development'],
      'Text Structure':          ['structure', 'paragraph', 'introduction', 'conclusion', 'organisation', 'cohesion'],
      'Language Features':       ['language', 'technique', 'figurative', 'metaphor', 'simile', 'imagery', 'tone'],
      'Grammar & Punctuation':   ['grammar', 'punctuation', 'sentence', 'tense', 'syntax', 'spelling'],
      'Vocabulary':              ['vocabulary', 'word choice', 'diction', 'expression', 'precise'],
      'Writing for Audience':    ['audience', 'purpose', 'persuade', 'narrative', 'creative', 'engage'],
    },
  },
  hsc: {
    math: {
      'Functions & Graphs':     ['function', 'graph', 'curve', 'domain', 'range', 'polynomial'],
      'Calculus':               ['calculus', 'derivative', 'integral', 'differentiation', 'integration', 'limit'],
      'Financial Maths':        ['financial', 'annuity', 'compound interest', 'depreciation', 'investment'],
      'Statistics & Data':      ['statistic', 'data', 'distribution', 'probability', 'regression', 'z-score'],
      'Algebra & Equations':    ['algebra', 'equation', 'inequation', 'logarithm', 'exponential', 'quadratic'],
      'Measurement & Geometry': ['measurement', 'geometry', 'trigonometry', 'pythagoras', 'area', 'volume'],
    },
    general_ability: {
      'Scientific Reasoning': ['scientific', 'hypothesis', 'theory', 'model', 'evidence'],
      'Data Analysis':        ['data', 'graph', 'trend', 'table', 'analyse results', 'interpret'],
      'Experiment Design':    ['experiment', 'variable', 'control', 'method', 'reliability', 'validity'],
      'Chemical Concepts':    ['chemical', 'chemistry', 'reaction', 'element', 'compound', 'bond'],
      'Physical Concepts':    ['physics', 'force', 'energy', 'motion', 'wave', 'electricity', 'magnetism'],
      'Biological Concepts':  ['biology', 'cell', 'genetics', 'evolution', 'ecosystem', 'organism'],
    },
    english: {
      'Textual Analysis':       ['analyse', 'text', 'passage', 'close reading', 'extract'],
      'Essay Writing':          ['essay', 'thesis', 'argument', 'body paragraph', 'conclusion'],
      'Creative Writing':       ['creative', 'narrative', 'story', 'character', 'setting'],
      'Vocabulary & Language':  ['vocabulary', 'language', 'word choice', 'diction', 'tone'],
      'Literary Techniques':    ['technique', 'metaphor', 'simile', 'imagery', 'symbolism', 'irony'],
      'Text & Context':         ['context', 'historical', 'cultural', 'social', 'composer', 'audience'],
    },
  },
  lifelong: {
    math: {
      'Statistical Analysis':    ['statistic', 'hypothesis test', 'confidence', 'p-value', 'regression'],
      'Mathematical Modelling':  ['model', 'modelling', 'simulation', 'optimisation', 'function'],
      'Logical Reasoning':       ['logic', 'proof', 'formal', 'deductive', 'inductive'],
      'Financial Literacy':      ['financial', 'investment', 'risk', 'return', 'market', 'budget'],
      'Data Interpretation':     ['data', 'interpret', 'visualisation', 'chart', 'trend', 'insight'],
      'Quantitative Analysis':   ['quantitative', 'measure', 'number', 'calculate', 'estimate'],
    },
    general_ability: {
      'Argumentation':         ['argument', 'claim', 'premise', 'conclusion', 'thesis'],
      'Evidence Evaluation':   ['evidence', 'source', 'reliability', 'validity', 'credibility'],
      'Logical Fallacies':     ['fallacy', 'ad hominem', 'straw man', 'false', 'circular'],
      'Analytical Reasoning':  ['analysis', 'break down', 'component', 'systemic', 'framework'],
      'Synthesis & Inference': ['synthesis', 'inference', 'combine', 'deduce', 'integrate'],
      'Problem Framing':       ['problem', 'frame', 'define', 'scope', 'constraints'],
    },
    english: {
      'Academic Reading':      ['academic', 'journal', 'article', 'scholarly', 'literature review'],
      'Academic Writing':      ['academic writing', 'report', 'essay', 'citation', 'reference'],
      'Rhetorical Analysis':   ['rhetoric', 'persuasion', 'appeal', 'ethos', 'pathos', 'logos'],
      'Vocabulary & Register': ['vocabulary', 'register', 'formal', 'technical', 'discipline-specific'],
      'Text Critique':         ['critique', 'evaluate text', 'assess', 'strengths', 'limitations'],
      'Communication':         ['communicate', 'clarity', 'coherence', 'concise', 'audience'],
    },
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStageSkills(stageId: string): Record<string, string[]> {
  return STAGE_SKILLS[stageId] ?? STAGE_SKILLS.oc_prep;
}

function mapTagsToSkills(tags: string[], subject: string, stageId: string): string[] {
  const stageKws = STAGE_SKILL_KEYWORDS[stageId] ?? STAGE_SKILL_KEYWORDS.oc_prep;
  const subjectKws = stageKws[subject] ?? {};
  const subjectSkills = getStageSkills(stageId)[subject] ?? [];
  if (!subjectSkills.length) return [];
  if (!tags.length) return [subjectSkills[0]];

  const matched = new Set<string>();
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().replace(/_/g, ' ').trim();
    let found = false;
    for (const [skill, keywords] of Object.entries(subjectKws)) {
      if ((keywords as string[]).some(kw => tagLower.includes(kw) || kw.includes(tagLower))) {
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

function subjectToDNAKey(subj: string): string | null {
  if (subj === 'math')            return 'math';
  if (subj === 'general_ability') return 'thinking';
  if (subj === 'english')         return 'reading';
  if (subj === 'writing')         return 'writing';
  return null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

function lastActivity(sessions: any[]): string {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );
  const days = Math.floor((Date.now() - new Date(sorted[0].completed_at).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days} days ago`;
  return fmtDate(sorted[0].completed_at);
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const studentId = event.pathParameters?.studentId;
    if (!studentId) return res(400, { success: false, error: 'studentId is required' });

    // Optional stageId filter (caller passes active stage)
    let stageId = event.queryStringParameters?.stageId;

    // If no stageId provided, resolve from student_stages
    if (!stageId) {
      const stageRows = await query(
        `SELECT stage_id FROM student_stages WHERE student_id = $1::uuid AND status = 'active' LIMIT 1`,
        studentId
      ) as any[];
      stageId = stageRows[0]?.stage_id ?? 'oc_prep';
    }

    const stageSkills = getStageSkills(stageId ?? 'oc_prep');
    const subjects    = Object.keys(stageSkills);
    const hasWriting  = 'writing' in stageSkills;

    // ── Fetch sessions ────────────────────────────────────────────────────
    // Strict stage match: only sessions explicitly tagged to this stage.
    // For stage-based sessions test_id is NULL, so we infer subject from
    // the questions answered via a lateral subquery.
    const sessions = await query(
      `SELECT
         ts.id          AS session_id,
         COALESCE(t.subject, sq.subject) AS subject,
         COALESCE(t.title, sq.subject)   AS raw_title,
         ts.stage_id,
         ts.completed_at,
         ts.scaled_score,
         ts.correct_count,
         ts.total_items,
         COALESCE(t.time_limit, 1800)    AS time_limit
       FROM test_sessions ts
       LEFT JOIN tests t ON ts.test_id = t.id
       LEFT JOIN LATERAL (
         SELECT q.subject
         FROM session_responses sr
         JOIN questions q ON sr.question_id = q.id
         WHERE sr.session_id = ts.id
         LIMIT 1
       ) sq ON true
       WHERE ts.student_id = $1::uuid
         AND ts.status = 'completed'
         AND ts.stage_id = $2
       ORDER BY ts.completed_at DESC`,
      studentId,
      stageId ?? 'oc_prep'
    ) as any[];

    if (sessions.length === 0) {
      return res(200, { success: true, stageId, analytics: emptyAnalytics(studentId, stageId ?? 'oc_prep', stageSkills) });
    }

    // ── Fetch all answers for those sessions ──────────────────────────────
    const sessionIds = sessions.map((s: any) => s.session_id);
    const answers = await query(
      `SELECT
         sr.session_id,
         sr.is_correct,
         sr.time_spent,
         q.skill_tags,
         q.subject AS question_subject
       FROM session_responses sr
       JOIN questions q ON sr.question_id = q.id
       WHERE sr.session_id = ANY($1::uuid[])`,
      sessionIds
    ) as any[];

    // Index answers by session_id
    const answersBySession = new Map<string, any[]>();
    for (const a of answers) {
      if (!answersBySession.has(a.session_id)) answersBySession.set(a.session_id, []);
      answersBySession.get(a.session_id)!.push(a);
    }

    // Enrich sessions with their answers
    const enriched = sessions.map((s: any) => ({
      ...s,
      answers: answersBySession.get(s.session_id) || [],
    }));

    // ── Compute analytics ─────────────────────────────────────────────────
    const avgScore = Math.round(
      enriched.reduce((sum: number, s: any) => sum + (parseFloat(s.scaled_score) || 0), 0) / enriched.length
    );

    const analytics = {
      studentId,
      totalTests:   enriched.length,
      averageScore: avgScore,
      lastTestDate: lastActivity(enriched.map((s: any) => ({ completed_at: s.completed_at }))),
      learningDNA:  buildDNA(enriched),
      skillBreakdown: buildSkillBreakdown(enriched, stageId ?? 'oc_prep', stageSkills, subjects, hasWriting),
      scoreTrend:     buildScoreTrend(enriched, hasWriting),
      monthTrend:     buildMonthTrend(enriched, stageId ?? 'oc_prep', subjects, hasWriting),
      recentResults:  buildRecentResults(enriched),
      errorAnalysis:  buildErrorAnalysis(enriched, hasWriting),
    };

    return res(200, { success: true, stageId, analytics });
  } catch (error) {
    console.error('get-student-analytics error:', error);
    return res(500, { success: false, error: 'Internal server error' });
  }
}

// ─── Builder functions ──────────────────────────────────────────────────────

function emptyAnalytics(studentId: string, stageId: string, stageSkills: Record<string, string[]>) {
  const empty = (skills: string[]) =>
    skills.map(skill => ({ skill, correct: 0, total: 0, percentage: 0, trend: 'stable', history: [] }));
  const hasWriting = 'writing' in stageSkills;
  return {
    studentId,
    totalTests:   0,
    averageScore: 0,
    lastTestDate: 'Never',
    learningDNA:  { math: 0, thinking: 0, reading: 0, ...(hasWriting ? { writing: 0 } : {}) },
    skillBreakdown: {
      math:     empty(stageSkills.math     || []),
      thinking: empty(stageSkills.general_ability || []),
      reading:  empty(stageSkills.english  || []),
      ...(hasWriting ? { writing: empty(stageSkills.writing || []) } : {}),
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

function buildDNA(sessions: any[]) {
  const buckets: Record<string, number[]> = { math: [], thinking: [], reading: [], writing: [] };
  for (const s of sessions) {
    const key = subjectToDNAKey(s.subject);
    if (key) buckets[key].push(parseFloat(s.scaled_score) || 0);
  }
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const dna: Record<string, number> = {
    math: avg(buckets.math),
    thinking: avg(buckets.thinking),
    reading: avg(buckets.reading),
  };
  if (buckets.writing.length) dna.writing = avg(buckets.writing);
  return dna;
}

function buildSkillBreakdown(
  sessions: any[],
  stageId: string,
  stageSkills: Record<string, string[]>,
  subjects: string[],
  hasWriting: boolean,
) {
  const now = Date.now();
  const MS_90 = 90 * 86400000;
  const MS_45 = 45 * 86400000;

  const inWindow = sessions.filter(s => now - new Date(s.completed_at).getTime() <= MS_90);
  const window3m = inWindow.length > 0 ? inWindow : sessions;
  const sorted   = [...window3m].sort((a, b) =>
    new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  );
  const recent  = sorted.filter(s => now - new Date(s.completed_at).getTime() <= MS_45);
  const history = sorted.filter(s => now - new Date(s.completed_at).getTime() >  MS_45);

  type Counts = { correct: number; total: number };

  const accumulate = (pool: any[], subj: string): Map<string, Counts> => {
    const map = new Map<string, Counts>();
    for (const session of pool) {
      if (session.subject !== subj) continue;
      for (const a of session.answers) {
        if (a.question_subject && a.question_subject !== subj) continue;
        const tags: string[] = Array.isArray(a.skill_tags) ? a.skill_tags : [];
        const skills = mapTagsToSkills(tags, subj, stageId);
        for (const skill of skills) {
          if (!map.has(skill)) map.set(skill, { correct: 0, total: 0 });
          const d = map.get(skill)!;
          d.total++;
          if (a.is_correct) d.correct++;
        }
      }
    }
    return map;
  };

  const pct = (d: Counts | undefined) =>
    d && d.total > 0 ? Math.round((d.correct / d.total) * 100) : null;

  const buildHistory = (subj: string, skill: string) => {
    return sorted
      .filter(s => s.subject === subj)
      .map(s => {
        const counts = { correct: 0, total: 0 };
        for (const a of s.answers) {
          const tags: string[] = Array.isArray(a.skill_tags) ? a.skill_tags : [];
          const skills = mapTagsToSkills(tags, subj, stageId);
          if (skills.includes(skill)) {
            counts.total++;
            if (a.is_correct) counts.correct++;
          }
        }
        if (counts.total === 0) return null;
        return {
          date: fmtDate(s.completed_at),
          percentage: Math.round((counts.correct / counts.total) * 100),
        };
      })
      .filter((d): d is { date: string; percentage: number } => d !== null);
  };

  const toEntries = (subj: string) => {
    const allMap    = accumulate(sorted,  subj);
    const recentMap = accumulate(recent,  subj);
    const histMap   = accumulate(history, subj);
    return (stageSkills[subj] || []).map(skill => {
      const all  = allMap.get(skill)    || { correct: 0, total: 0 };
      const rec  = pct(recentMap.get(skill));
      const hist = pct(histMap.get(skill));
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (rec !== null && hist !== null) {
        if (rec >= hist + 8) trend = 'up';
        else if (rec <= hist - 8) trend = 'down';
      }
      return {
        skill,
        correct: all.correct,
        total:   all.total,
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
    ...(hasWriting ? { writing: toEntries('writing') } : {}),
  };
}

function buildScoreTrend(sessions: any[], hasWriting: boolean) {
  const sorted = [...sessions].sort((a, b) =>
    new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  );
  const trend: Record<string, Array<{ date: string; score: number }>> = {
    math: [], thinking: [], reading: [], ...(hasWriting ? { writing: [] } : {}),
  };
  for (const s of sorted) {
    const key = subjectToDNAKey(s.subject);
    if (!key || !(key in trend)) continue;
    trend[key].push({ date: fmtDate(s.completed_at), score: parseFloat(s.scaled_score) || 0 });
  }
  return trend;
}

function buildMonthTrend(sessions: any[], stageId: string, subjects: string[], hasWriting: boolean) {
  const now   = Date.now();
  const MS_30 = 30 * 86400000;
  const MS_90 = 90 * 86400000;

  const trend: Record<string, Array<{ date: string; score: number }>> = {
    math: [], thinking: [], reading: [], ...(hasWriting ? { writing: [] } : {}),
  };

  for (const subj of subjects) {
    const dnaKey = subjectToDNAKey(subj);
    if (!dnaKey || !(dnaKey in trend)) continue;

    const in30 = sessions.filter(s => s.subject === subj && now - new Date(s.completed_at).getTime() <= MS_30);
    const in90 = sessions.filter(s => s.subject === subj && now - new Date(s.completed_at).getTime() <= MS_90);
    const all  = sessions.filter(s => s.subject === subj);

    const pool = in30.length ? in30 : in90.length ? in90 : all;
    const sorted = [...pool].sort((a, b) =>
      new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    );
    trend[dnaKey] = sorted.map(s => ({ date: fmtDate(s.completed_at), score: parseFloat(s.scaled_score) || 0 }));
  }
  return trend;
}

const SUBJECT_LABELS: Record<string, string> = {
  math:            'Mathematical Reasoning',
  general_ability: 'Thinking Skills',
  english:         'English Reading',
  writing:         'Writing',
};

function buildRecentResults(sessions: any[]) {
  return [...sessions]
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, 6)
    .map(s => {
      const score   = parseFloat(s.scaled_score) || 0;
      const status  = score >= 75 ? 'good' : score >= 55 ? 'ok' : 'low';
      const subject = s.subject || '';
      // Use real test title if present; otherwise derive from subject
      const title   = (s.raw_title && !SUBJECT_LABELS[s.raw_title])
        ? s.raw_title
        : (SUBJECT_LABELS[subject] || 'Practice Test');
      return {
        date:      fmtDate(s.completed_at),
        title,
        score,
        status,
        sessionId: s.session_id,
        subject,
      };
    });
}

function buildErrorAnalysis(sessions: any[], hasWriting: boolean) {
  const CARELESS_MAX      = 5;
  const TIME_PRESSURE_MIN = 0.20;
  const CONCEPT_GAP_MIN   = 120;

  const empty = () => ({ total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 });
  const result: Record<string, ReturnType<typeof empty>> = {
    math: empty(), thinking: empty(), reading: empty(),
    ...(hasWriting ? { writing: empty() } : {}),
  };

  for (const session of sessions) {
    const dnaKey = subjectToDNAKey(session.subject);
    if (!dnaKey || !(dnaKey in result)) continue;
    const bucket    = result[dnaKey];
    const timeLimit = parseInt(session.time_limit) || 1800;
    let cumulative  = 0;

    for (const a of session.answers) {
      if (!a.is_correct) {
        const timeSpent    = parseInt(a.time_spent) || 0;
        const pctRemaining = (timeLimit - cumulative) / timeLimit;
        bucket.total++;
        if (timeSpent < CARELESS_MAX)          bucket.careless++;
        else if (pctRemaining < TIME_PRESSURE_MIN) bucket.timePressure++;
        else if (timeSpent > CONCEPT_GAP_MIN)  bucket.conceptGap++;
        else                                   bucket.other++;
      }
      cumulative += parseInt(a.time_spent) || 0;
    }
  }
  return result;
}

// ─── Response helper ────────────────────────────────────────────────────────

function res(statusCode: number, body: object): APIGatewayProxyResult {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}
