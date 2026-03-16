/**
 * GET  /students/{studentId}/insights  — return cached insights (regenerate if >24h stale)
 * POST /students/{studentId}/insights  — force-regenerate insights
 * EventBridge scheduled event          — daily batch over all students
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getDb, query } from '../lib/database';
import { getSystemConfig, cfgStr, cfgInt, cfgNum } from '../lib/system-config';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
};

const SUBJECT_META: Record<string, { label: string; skills: string[] }> = {
  math: {
    label: 'Mathematical Reasoning',
    skills: [
      'Number & Algebra', 'Fractions & Decimals', 'Measurement & Geometry',
      'Statistics & Probability', 'Problem Solving', 'Working Mathematically',
    ],
  },
  general_ability: {
    label: 'Thinking Skills',
    skills: [
      'Logical Reasoning', 'Pattern Recognition', 'Spatial Reasoning',
      'Verbal Reasoning', 'Abstract Reasoning', 'Critical Thinking',
    ],
  },
  english: {
    label: 'English Reading',
    skills: [
      'Reading Comprehension', 'Vocabulary', 'Inference & Interpretation',
      'Grammar & Language', 'Text Structure', 'Language & Expression',
    ],
  },
};

const SKILL_KEYWORDS: Record<string, Record<string, string[]>> = {
  math: {
    'Number & Algebra':         ['number', 'algebra', 'equation', 'integer', 'arithmetic'],
    'Fractions & Decimals':     ['fraction', 'decimal', 'percent', 'ratio', 'proportion'],
    'Measurement & Geometry':   ['measure', 'geometry', 'shape', 'area', 'perimeter', 'volume', 'angle'],
    'Statistics & Probability': ['statistic', 'probability', 'data', 'graph', 'average', 'mean', 'chance'],
    'Problem Solving':          ['problem', 'word problem', 'application', 'real-world'],
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
};

const bedrock = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
});

function ok(data: object): APIGatewayProxyResult {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
}
function errResp(code: number, msg: string): APIGatewayProxyResult {
  return { statusCode: code, headers: CORS, body: JSON.stringify({ success: false, error: msg }) };
}

function mapTagsToSkill(tags: string[], subject: string): string {
  const meta = SUBJECT_META[subject];
  if (!meta) return '';
  const keywords = SKILL_KEYWORDS[subject] || {};
  for (const tag of tags) {
    const t = tag.toLowerCase().replace(/_/g, ' ').trim();
    for (const [skill, kws] of Object.entries(keywords)) {
      if (kws.some(kw => t.includes(kw) || kw.includes(t))) return skill;
    }
  }
  return meta.skills[0];
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function handler(event: any): Promise<any> {
  // EventBridge scheduled event
  if (event.source === 'aws.events' || event['detail-type'] === 'Scheduled Event') {
    return handleBatch();
  }
  // API Gateway
  const studentId = (event as APIGatewayProxyEvent).pathParameters?.studentId;
  if (!studentId) return errResp(400, 'studentId required');
  const method = (event as APIGatewayProxyEvent).httpMethod;
  const forceRefresh = method === 'POST';
  // Stage filter: GET → query param; POST → body
  let stageId: string | undefined;
  if (method === 'GET') {
    stageId = (event as APIGatewayProxyEvent).queryStringParameters?.stageId ?? undefined;
  } else {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
      stageId = body.stageId ?? undefined;
    } catch {}
  }
  return handleSingleStudent(studentId, forceRefresh, stageId);
}

// ─── Batch mode (EventBridge daily) ──────────────────────────────────────────

async function handleBatch(): Promise<void> {
  const db = await getDb();
  const students = await db.unsafe<Array<{ id: string }>>(
    `SELECT id FROM students`
  );
  console.log(`Daily insights batch: ${students.length} students`);
  for (const s of students) {
    try { await handleSingleStudent(s.id, true); }
    catch (e) { console.error(`Insights failed for ${s.id}:`, e); }
  }
}

// ─── Single student ───────────────────────────────────────────────────────────

async function handleSingleStudent(studentId: string, forceRefresh: boolean, stageId?: string): Promise<APIGatewayProxyResult> {
  const [, sysConfig] = await Promise.all([getDb(), getSystemConfig()]);
  const staleHours = cfgNum(sysConfig, 'testInsightsCacheHours');

  // Return cache immediately on GET (stale-while-revalidate).
  if (!forceRefresh) {
    const rows = await query(
      `SELECT insights_json, last_insights_at, stage_insights_json FROM student_profiles WHERE student_id = $1::uuid`,
      studentId
    ) as any[];
    if (rows.length) {
      let cachedInsights: any = null;
      let lastUpdated: string | null = null;
      if (stageId) {
        // Per-stage cache
        const raw = rows[0].stage_insights_json;
        const stageMap = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        const stageData = stageMap[stageId];
        if (stageData) {
          cachedInsights = typeof stageData === 'string' ? JSON.parse(stageData) : stageData;
          lastUpdated = cachedInsights?._updatedAt ?? null;
        }
      } else {
        // Global cache
        const raw = rows[0].insights_json;
        if (raw) {
          cachedInsights = typeof raw === 'string' ? JSON.parse(raw) : raw;
          lastUpdated = rows[0].last_insights_at;
        }
      }
      if (cachedInsights) {
        const ageHours = lastUpdated
          ? (Date.now() - new Date(lastUpdated).getTime()) / 3_600_000
          : Infinity;
        return ok({ success: true, insights: cachedInsights, cached: true, stale: ageHours >= staleHours });
      }
    }
  }

  // Fetch completed sessions — optionally filtered to a specific stage
  const sessions = stageId
    ? await query(
        `SELECT ts.id, ts.completed_at,
                COALESCE(t.subject, sq.subject) AS subject,
                COALESCE(t.title, ts.stage_id || ' Practice') AS title,
                ts.scaled_score, ts.correct_count, ts.total_items
         FROM test_sessions ts
         LEFT JOIN tests t ON ts.test_id = t.id
         LEFT JOIN LATERAL (
           SELECT q.subject FROM session_responses sr
           JOIN questions q ON sr.question_id = q.id
           WHERE sr.session_id = ts.id LIMIT 1
         ) sq ON true
         WHERE ts.student_id = $1::uuid AND ts.status = 'completed' AND ts.stage_id = $2
         ORDER BY ts.completed_at ASC`,
        studentId, stageId
      ) as any[]
    : await query(
        `SELECT ts.id, ts.completed_at,
                COALESCE(t.subject, sq.subject) AS subject,
                COALESCE(t.title, ts.stage_id || ' Practice') AS title,
                ts.scaled_score, ts.correct_count, ts.total_items
         FROM test_sessions ts
         LEFT JOIN tests t ON ts.test_id = t.id
         LEFT JOIN LATERAL (
           SELECT q.subject FROM session_responses sr
           JOIN questions q ON sr.question_id = q.id
           WHERE sr.session_id = ts.id LIMIT 1
         ) sq ON true
         WHERE ts.student_id = $1::uuid AND ts.status = 'completed'
         ORDER BY ts.completed_at ASC`,
        studentId
      ) as any[];

  if (!sessions.length) {
    return ok({ success: true, insights: null, reason: 'no_tests' });
  }

  // Fetch responses for the same scope
  const responses = stageId
    ? await query(
        `SELECT sr.is_correct, q.skill_tags, q.subject, ts.completed_at
         FROM session_responses sr
         JOIN questions q ON sr.question_id = q.id
         JOIN test_sessions ts ON sr.session_id = ts.id
         WHERE ts.student_id = $1::uuid AND ts.status = 'completed' AND ts.stage_id = $2`,
        studentId, stageId
      ) as any[]
    : await query(
        `SELECT sr.is_correct, q.skill_tags, q.subject, ts.completed_at
         FROM session_responses sr
         JOIN questions q ON sr.question_id = q.id
         JOIN test_sessions ts ON sr.session_id = ts.id
         WHERE ts.student_id = $1::uuid AND ts.status = 'completed'`,
        studentId
      ) as any[];

  // Student grade level
  const studentRow = await query(
    `SELECT grade_level FROM students WHERE id = $1::uuid`,
    studentId
  ) as any[];
  const gradeLevel = studentRow[0]?.grade_level || 5;

  // Build per-subject summary for the prompt
  const subjectStats: Record<string, any> = {};
  for (const [subj, meta] of Object.entries(SUBJECT_META)) {
    const subjSessions = sessions.filter(s => s.subject === subj);
    const scores = subjSessions.map(s => ({
      date: new Date(s.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      score: Number(s.scaled_score) || 0,
    }));
    const skillMap: Record<string, { correct: number; total: number }> = {};
    for (const skill of meta.skills) skillMap[skill] = { correct: 0, total: 0 };
    for (const r of responses.filter(r => r.subject === subj)) {
      const tags: string[] = Array.isArray(r.skill_tags) ? r.skill_tags : [];
      const skill = mapTagsToSkill(tags, subj);
      if (skill && skillMap[skill]) {
        skillMap[skill].total++;
        if (r.is_correct) skillMap[skill].correct++;
      }
    }
    subjectStats[subj] = {
      label: meta.label,
      testsCount: subjSessions.length,
      scores,
      skillBreakdown: meta.skills.map(skill => {
        const d = skillMap[skill];
        return {
          skill,
          percentage: d.total > 0 ? Math.round((d.correct / d.total) * 100) : null,
          correct: d.correct, total: d.total,
        };
      }),
    };
  }

  // Call Claude
  const prompt = buildPrompt(gradeLevel, sessions.length, subjectStats, stageId);
  const modelId = cfgStr(sysConfig, 'aiInsightsModelId') || process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0';
  const maxTokens = cfgInt(sysConfig, 'aiMaxTokensInsights');
  const temperature = cfgNum(sysConfig, 'aiTemperatureInsights');
  const insights = await callClaude(prompt, modelId, maxTokens, temperature);
  insights.generatedAt = new Date().toISOString();
  insights._updatedAt = new Date().toISOString();
  insights.studentId = studentId;
  insights.stageId = stageId ?? null;
  insights.totalTests = sessions.length;

  if (stageId) {
    // Read existing stage map, merge in new stage insights, upsert whole column
    const existingRows = await query(
      `SELECT stage_insights_json FROM student_profiles WHERE student_id = $1::uuid`,
      studentId
    ) as any[];
    const existingRaw = existingRows[0]?.stage_insights_json;
    const existingMap = existingRaw
      ? (typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw)
      : {};
    const updatedMap = { ...existingMap, [stageId]: insights };
    await query(
      `INSERT INTO student_profiles (id, student_id, stage_insights_json, updated_at)
       VALUES (uuid_generate_v4(), $1::uuid, $2::jsonb, NOW())
       ON CONFLICT (student_id)
       DO UPDATE SET stage_insights_json = $2::jsonb, updated_at = NOW()`,
      studentId, JSON.stringify(updatedMap)
    );
  } else {
    await query(
      `INSERT INTO student_profiles (id, student_id, insights_json, last_insights_at, updated_at)
       VALUES (uuid_generate_v4(), $1::uuid, $2::jsonb, NOW(), NOW())
       ON CONFLICT (student_id)
       DO UPDATE SET insights_json = $2::jsonb, last_insights_at = NOW(), updated_at = NOW()`,
      studentId, JSON.stringify(insights)
    );
  }

  return ok({ success: true, insights, cached: false });
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  oc_prep: 'OC (Opportunity Class) Preparation',
  selective: 'Selective High School Preparation',
  hsc: 'HSC Preparation',
  lifelong: 'University & Lifelong Learning',
};

function buildPrompt(gradeLevel: number, totalTests: number, stats: Record<string, any>, stageId?: string): string {
  const stageContext = stageId
    ? `The student is currently enrolled in the ${STAGE_LABELS[stageId] ?? stageId} pathway.`
    : 'This is an overall view across all learning stages.';
  return `You are an expert NSW exam preparation tutor.
${stageContext}
Analyse this Grade ${gradeLevel} student's performance across ${totalTests} practice tests in this stage and return structured insights.

PERFORMANCE DATA:
${JSON.stringify(stats, null, 2)}

Return ONLY a valid JSON object with this exact structure (no markdown fences, no extra text):
{
  "overallSummary": "2-3 encouraging sentences summarising the student's overall progress and top priority",
  "subjects": [
    {
      "subject": "math",
      "trend": "improving|declining|stable",
      "trendDelta": <integer: last score minus first score, or 0 if only 1 test>,
      "currentStatus": "One sentence describing current ability in Mathematical Reasoning",
      "strongSkills": ["skill name", "skill name"],
      "weakSkills": ["skill name", "skill name"],
      "dailyProgress": "One sentence describing score change pattern over recent tests",
      "improvements": ["concrete improvement area 1", "concrete improvement area 2"],
      "nextSteps": ["actionable study step 1", "actionable study step 2", "actionable study step 3"]
    },
    {
      "subject": "general_ability",
      "trend": "improving|declining|stable",
      "trendDelta": <integer>,
      "currentStatus": "One sentence describing current ability in Thinking Skills",
      "strongSkills": ["skill name"],
      "weakSkills": ["skill name"],
      "dailyProgress": "One sentence describing score change pattern",
      "improvements": ["area 1", "area 2"],
      "nextSteps": ["step 1", "step 2", "step 3"]
    },
    {
      "subject": "english",
      "trend": "improving|declining|stable",
      "trendDelta": <integer>,
      "currentStatus": "One sentence describing current ability in English Reading",
      "strongSkills": ["skill name"],
      "weakSkills": ["skill name"],
      "dailyProgress": "One sentence describing score change pattern",
      "improvements": ["area 1", "area 2"],
      "nextSteps": ["step 1", "step 2", "step 3"]
    }
  ]
}

Rules:
- strongSkills: use exact skill names from data; pick top 1-2 with highest percentage (skip if total=0)
- weakSkills: use exact skill names; pick bottom 1-2 with lowest percentage (skip if total=0)
- If a subject has testsCount=0, set trend="stable", trendDelta=0, and mention no data yet in currentStatus
- improvements: specific to actual weak skills observed, not generic advice
- nextSteps: Grade ${gradeLevel}-appropriate, concrete, actionable (e.g. "Practise fraction word problems for 15 min daily")
- dailyProgress: mention actual dates/scores if multiple tests exist, otherwise note it's the first test
- Language should be parent-friendly, encouraging but honest`;
}

// ─── Bedrock call ─────────────────────────────────────────────────────────────

async function callClaude(
  prompt: string,
  modelId: string,
  maxTokens: number,
  temperature: number,
): Promise<any> {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const text: string = body.content[0].text;
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  return JSON.parse(cleaned);
}
