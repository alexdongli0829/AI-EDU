/**
 * POST /sessions/{sessionId}/analyze
 * Computes OC-aligned skill breakdown from ALL completed sessions for the student
 * and persists to student_profiles.skill_graph.
 * Called by the frontend immediately after a test completes.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPrismaClient } from '../lib/database';

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true };

// NSW OC test skill taxonomy — 6 skills per subject
export const OC_SKILLS: Record<string, string[]> = {
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
};

// Keyword → OC skill mappings for fuzzy tag matching
const SKILL_KEYWORDS: Record<string, Record<string, string[]>> = {
  math: {
    'Number & Algebra':         ['number', 'algebra', 'equation', 'integer', 'arithmetic', 'numeral', 'digit'],
    'Fractions & Decimals':     ['fraction', 'decimal', 'percent', 'ratio', 'proportion', 'percentage'],
    'Measurement & Geometry':   ['measure', 'geometry', 'shape', 'area', 'perimeter', 'volume', 'angle', 'length', 'weight', 'mass'],
    'Statistics & Probability': ['statistic', 'probability', 'data', 'graph', 'chart', 'average', 'mean', 'median', 'chance'],
    'Problem Solving':          ['problem', 'word problem', 'application', 'real-world', 'reasoning'],
    'Working Mathematically':   ['pattern', 'strategy', 'working', 'process', 'communicate', 'generalise'],
  },
  general_ability: {
    'Logical Reasoning':   ['logic', 'logical', 'deduction', 'induction', 'argument', 'conclusion', 'premise'],
    'Pattern Recognition': ['pattern', 'sequence', 'series', 'next', 'continue', 'rule'],
    'Spatial Reasoning':   ['spatial', 'space', 'rotation', 'reflection', 'fold', 'net', 'shape', '3d', 'visual'],
    'Verbal Reasoning':    ['verbal', 'word', 'analogy', 'synonym', 'antonym', 'vocabulary', 'language'],
    'Abstract Reasoning':  ['abstract', 'matrix', 'figure', 'diagram', 'symbol', 'non-verbal'],
    'Critical Thinking':   ['critical', 'evaluate', 'analyse', 'assess', 'judge', 'inference'],
  },
  english: {
    'Reading Comprehension':    ['comprehension', 'passage', 'read', 'understand', 'main idea', 'purpose'],
    'Vocabulary':               ['vocabulary', 'word', 'meaning', 'definition', 'context clue', 'synonym'],
    'Inference & Interpretation':['inference', 'infer', 'interpret', 'imply', 'suggest', 'deduce'],
    'Grammar & Language':       ['grammar', 'punctuation', 'spelling', 'sentence', 'verb', 'noun', 'tense'],
    'Text Structure':           ['structure', 'text type', 'genre', 'feature', 'paragraph', 'author purpose'],
    'Language & Expression':    ['expression', 'figurative', 'metaphor', 'simile', 'language feature', 'technique'],
  },
};

function mapTagsToOCSkills(tags: string[], subject: string): string[] {
  const subjectSkills = OC_SKILLS[subject];
  if (!subjectSkills) return [];
  if (!tags.length) return [subjectSkills[0]]; // default to first skill

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
    // Direct match against OC skill names
    if (!found) {
      const directMatch = subjectSkills.find(s => s.toLowerCase().includes(tagLower) || tagLower.includes(s.toLowerCase().split(' ')[0]));
      if (directMatch) matched.add(directMatch);
    }
  }

  return matched.size > 0 ? Array.from(matched) : [subjectSkills[0]];
}

function ok(data: object): APIGatewayProxyResult {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
}
function err(code: number, msg: string): APIGatewayProxyResult {
  return { statusCode: code, headers: CORS, body: JSON.stringify({ success: false, error: msg }) };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) return err(400, 'sessionId is required');

    const prisma = await getPrismaClient();

    // Resolve student_id from the completed session
    const sessionRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT student_id FROM test_sessions WHERE id = $1::uuid AND status = 'completed'`,
      sessionId
    );
    if (!sessionRows.length) return err(404, 'Completed session not found');
    const studentId = sessionRows[0].student_id;

    // Fetch all responses across ALL completed sessions for this student
    const responses = await prisma.$queryRawUnsafe<any[]>(
      `SELECT sr.is_correct, q.skill_tags, q.subject
       FROM session_responses sr
       JOIN questions q ON sr.question_id = q.id
       JOIN test_sessions ts ON sr.session_id = ts.id
       WHERE ts.student_id = $1::uuid AND ts.status = 'completed'`,
      studentId
    );

    // Accumulate correct/total per OC skill per subject
    type SkillCounts = { correct: number; total: number };
    const maps: Record<string, Map<string, SkillCounts>> = {
      math: new Map(),
      general_ability: new Map(),
      english: new Map(),
    };

    for (const r of responses) {
      const subj: string = r.subject;
      if (!maps[subj]) continue;
      const rawTags: string[] = Array.isArray(r.skill_tags) ? r.skill_tags : [];
      const ocSkills = mapTagsToOCSkills(rawTags, subj);
      for (const skill of ocSkills) {
        if (!maps[subj].has(skill)) maps[subj].set(skill, { correct: 0, total: 0 });
        const d = maps[subj].get(skill)!;
        d.total++;
        if (r.is_correct) d.correct++;
      }
    }

    // Build full skill_graph — include all OC skills (even unpracticed ones with total=0)
    const skillGraph: Record<string, Array<{ skill: string; correct: number; total: number }>> = {};
    for (const [subj, skills] of Object.entries(OC_SKILLS)) {
      const map = maps[subj];
      skillGraph[subj] = skills.map(skill => {
        const d = map.get(skill) || { correct: 0, total: 0 };
        return { skill, correct: d.correct, total: d.total };
      });
    }

    // Upsert into student_profiles
    await prisma.$executeRawUnsafe(
      `INSERT INTO student_profiles (id, student_id, skill_graph, last_calculated, updated_at)
       VALUES (uuid_generate_v4(), $1::uuid, $2::jsonb, NOW(), NOW())
       ON CONFLICT (student_id)
       DO UPDATE SET skill_graph = $2::jsonb, last_calculated = NOW(), updated_at = NOW()`,
      studentId,
      JSON.stringify(skillGraph)
    );

    return ok({ success: true, skillGraph });
  } catch (error) {
    console.error('analyze-session error:', error);
    return err(500, 'Internal server error');
  }
}
