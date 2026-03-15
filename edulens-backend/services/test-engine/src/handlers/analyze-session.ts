/**
 * POST /sessions/{sessionId}/analyze
 * Computes stage-aware skill breakdown from sessions for the student's active stage
 * and persists to student_profiles.skill_graph.
 * Called by the frontend immediately after a test completes.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getDb, query } from '../lib/database';

const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true };

// NSW stage-aware skill taxonomies — mirrors frontend STAGE_SKILLS
export const STAGE_SKILLS: Record<string, Record<string, string[]>> = {
  oc_prep: {
    math:            ['Number & Algebra', 'Fractions & Decimals', 'Measurement & Geometry', 'Statistics & Probability', 'Problem Solving', 'Working Mathematically'],
    general_ability: ['Logical Reasoning', 'Pattern Recognition', 'Spatial Reasoning', 'Verbal Reasoning', 'Abstract Reasoning', 'Critical Thinking'],
    english:         ['Reading Comprehension', 'Vocabulary', 'Inference & Interpretation', 'Grammar & Language', 'Text Structure', 'Language & Expression'],
  },
  selective: {
    // Mathematical Reasoning paper — 35q / 40min / no calculator
    math:            ['Number & Algebra', 'Measurement & Space', 'Statistics & Probability', 'Working Mathematically', 'Problem Solving', 'Financial Maths'],
    // Thinking Skills paper — 40q / 40min / no prior knowledge required
    general_ability: ['Abstract Reasoning', 'Logical Deduction', 'Pattern Recognition', 'Spatial Reasoning', 'Verbal Reasoning', 'Critical Analysis'],
    // Reading paper — 17 questions (38 answers) / 45min; non-fiction, fiction, poetry, articles
    english:         ['Reading Comprehension', 'Inference & Interpretation', 'Vocabulary in Context', 'Text Analysis', 'Literary Techniques', "Author's Purpose"],
    // Writing paper — 1 open-response task / 30min; assessed on ideas, structure, language, grammar
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

// Backward-compat alias
export const OC_SKILLS = STAGE_SKILLS.oc_prep;

// Stage-aware keyword → skill maps
const STAGE_SKILL_KEYWORDS: Record<string, Record<string, Record<string, string[]>>> = {
  oc_prep: {
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
      'Reading Comprehension':      ['comprehension', 'passage', 'read', 'understand', 'main idea', 'purpose'],
      'Vocabulary':                 ['vocabulary', 'word', 'meaning', 'definition', 'context clue', 'synonym'],
      'Inference & Interpretation': ['inference', 'infer', 'interpret', 'imply', 'suggest', 'deduce'],
      'Grammar & Language':         ['grammar', 'punctuation', 'spelling', 'sentence', 'verb', 'noun', 'tense'],
      'Text Structure':             ['structure', 'text type', 'genre', 'feature', 'paragraph', 'author purpose'],
      'Language & Expression':      ['expression', 'figurative', 'metaphor', 'simile', 'language feature', 'technique'],
    },
  },
  selective: {
    math: {
      'Number & Algebra':         ['number', 'algebra', 'equation', 'integer', 'arithmetic', 'index', 'surds', 'numeral'],
      'Measurement & Space':      ['measure', 'space', 'geometry', 'shape', 'area', 'perimeter', 'volume', 'angle', 'coordinate', 'length'],
      'Statistics & Probability': ['statistic', 'probability', 'data', 'graph', 'chart', 'average', 'mean', 'median', 'chance'],
      'Working Mathematically':   ['working', 'strategy', 'process', 'communicate', 'generalise', 'justify', 'explain'],
      'Problem Solving':          ['problem', 'word problem', 'application', 'multi-step', 'real-world'],
      'Financial Maths':          ['financial', 'money', 'profit', 'loss', 'interest', 'tax', 'budget', 'cost', 'price'],
    },
    general_ability: {
      'Abstract Reasoning':  ['abstract', 'matrix', 'figure', 'diagram', 'symbol', 'non-verbal', 'pattern set'],
      'Logical Deduction':   ['logic', 'deduction', 'syllogism', 'if then', 'conclusion', 'argument', 'valid'],
      'Pattern Recognition': ['pattern', 'sequence', 'series', 'next term', 'continue', 'rule'],
      'Spatial Reasoning':   ['spatial', 'rotation', 'reflection', 'fold', 'net', '3d', 'visual', 'mirror'],
      'Verbal Reasoning':    ['verbal', 'analogy', 'synonym', 'antonym', 'word relationship', 'odd one out'],
      'Critical Analysis':   ['critical', 'analyse', 'evaluate', 'assess', 'flaw', 'assumption', 'strengthen'],
    },
    english: {
      'Reading Comprehension':      ['comprehension', 'passage', 'read', 'understand', 'main idea', 'summary'],
      'Inference & Interpretation': ['inference', 'infer', 'interpret', 'imply', 'suggest', 'deduce'],
      'Vocabulary in Context':      ['vocabulary', 'context', 'meaning', 'definition', 'connotation', 'denotation'],
      'Text Analysis':              ['analyse text', 'structure', 'genre', 'text type', 'purpose', 'form'],
      'Literary Techniques':        ['technique', 'figurative', 'metaphor', 'simile', 'imagery', 'alliteration', 'personification'],
      "Author's Purpose":           ['purpose', 'intent', 'audience', 'perspective', 'point of view', 'bias'],
    },
    writing: {
      'Ideas & Content':         ['idea', 'content', 'creativity', 'originality', 'detail', 'development', 'elaborate'],
      'Text Structure':          ['structure', 'paragraph', 'introduction', 'conclusion', 'organisation', 'cohesion'],
      'Language Features':       ['language', 'technique', 'figurative', 'metaphor', 'simile', 'imagery', 'tone', 'style'],
      'Grammar & Punctuation':   ['grammar', 'punctuation', 'sentence', 'tense', 'syntax', 'spelling', 'mechanics'],
      'Vocabulary':              ['vocabulary', 'word choice', 'diction', 'expression', 'precise', 'varied'],
      'Writing for Audience':    ['audience', 'purpose', 'persuade', 'narrative', 'creative', 'engage', 'voice'],
    },
  },
  hsc: {
    math: {
      'Functions & Graphs':     ['function', 'graph', 'curve', 'domain', 'range', 'polynomial', 'asymptote'],
      'Calculus':               ['calculus', 'derivative', 'integral', 'differentiation', 'integration', 'limit', 'rate of change'],
      'Financial Maths':        ['financial', 'annuity', 'compound interest', 'depreciation', 'investment', 'superannuation'],
      'Statistics & Data':      ['statistic', 'data', 'distribution', 'probability', 'regression', 'z-score', 'normal'],
      'Algebra & Equations':    ['algebra', 'equation', 'inequation', 'logarithm', 'exponential', 'quadratic', 'simultaneous'],
      'Measurement & Geometry': ['measurement', 'geometry', 'trigonometry', 'pythagoras', 'area', 'volume', 'surface area'],
    },
    general_ability: {
      'Scientific Reasoning': ['scientific', 'hypothesis', 'theory', 'model', 'evidence', 'peer review'],
      'Data Analysis':        ['data', 'graph', 'trend', 'table', 'analyse results', 'interpret', 'relationship'],
      'Experiment Design':    ['experiment', 'variable', 'control', 'method', 'reliability', 'validity', 'procedure'],
      'Chemical Concepts':    ['chemical', 'chemistry', 'reaction', 'element', 'compound', 'bond', 'periodic'],
      'Physical Concepts':    ['physics', 'force', 'energy', 'motion', 'wave', 'electricity', 'magnetism', 'momentum'],
      'Biological Concepts':  ['biology', 'cell', 'genetics', 'evolution', 'ecosystem', 'organism', 'dna'],
    },
    english: {
      'Textual Analysis':       ['analyse', 'text', 'passage', 'close reading', 'extract', 'textual'],
      'Essay Writing':          ['essay', 'thesis', 'argument', 'body paragraph', 'conclusion', 'introduction'],
      'Creative Writing':       ['creative', 'narrative', 'story', 'character', 'setting', 'plot'],
      'Vocabulary & Language':  ['vocabulary', 'language', 'word choice', 'diction', 'tone', 'register'],
      'Literary Techniques':    ['technique', 'metaphor', 'simile', 'imagery', 'symbolism', 'irony', 'allusion'],
      'Text & Context':         ['context', 'historical', 'cultural', 'social', 'composer', 'audience', 'reception'],
    },
  },
  lifelong: {
    math: {
      'Statistical Analysis':    ['statistic', 'hypothesis test', 'confidence', 'p-value', 'regression', 'variance'],
      'Mathematical Modelling':  ['model', 'modelling', 'simulation', 'optimisation', 'function', 'predict'],
      'Logical Reasoning':       ['logic', 'proof', 'formal', 'deductive', 'inductive', 'valid'],
      'Financial Literacy':      ['financial', 'investment', 'risk', 'return', 'market', 'budget', 'compound'],
      'Data Interpretation':     ['data', 'interpret', 'visualisation', 'chart', 'trend', 'insight', 'dashboard'],
      'Quantitative Analysis':   ['quantitative', 'measure', 'number', 'calculate', 'estimate', 'numerical'],
    },
    general_ability: {
      'Argumentation':        ['argument', 'claim', 'premise', 'conclusion', 'thesis', 'contention'],
      'Evidence Evaluation':  ['evidence', 'source', 'reliability', 'validity', 'credibility', 'cite'],
      'Logical Fallacies':    ['fallacy', 'ad hominem', 'straw man', 'false dichotomy', 'circular', 'slippery slope'],
      'Analytical Reasoning': ['analysis', 'break down', 'component', 'systemic', 'framework', 'structure'],
      'Synthesis & Inference':['synthesis', 'inference', 'combine', 'deduce', 'integrate', 'draw conclusion'],
      'Problem Framing':      ['problem', 'frame', 'define', 'scope', 'constraints', 'objectives'],
    },
    english: {
      'Academic Reading':      ['academic', 'journal', 'article', 'scholarly', 'literature review', 'research'],
      'Academic Writing':      ['academic writing', 'report', 'essay', 'citation', 'reference', 'apa', 'harvard'],
      'Rhetorical Analysis':   ['rhetoric', 'persuasion', 'appeal', 'ethos', 'pathos', 'logos', 'rhetorical'],
      'Vocabulary & Register': ['vocabulary', 'register', 'formal', 'technical', 'discipline-specific', 'jargon'],
      'Text Critique':         ['critique', 'evaluate text', 'assess', 'strengths', 'limitations', 'critically'],
      'Communication':         ['communicate', 'clarity', 'coherence', 'concise', 'audience', 'presentation'],
    },
  },
};

function getSkillsForStage(stageId: string, subject: string): string[] {
  return (STAGE_SKILLS[stageId] ?? STAGE_SKILLS.oc_prep)[subject] ?? [];
}

function mapTagsToSkills(tags: string[], subject: string, stageId: string): string[] {
  const subjectSkills = getSkillsForStage(stageId, subject);
  if (!subjectSkills.length) return [];
  if (!tags.length) return [subjectSkills[0]];

  const keywordMap = ((STAGE_SKILL_KEYWORDS[stageId] ?? STAGE_SKILL_KEYWORDS.oc_prep)[subject]) ?? {};
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
      const directMatch = subjectSkills.find(s =>
        s.toLowerCase().includes(tagLower) || tagLower.includes(s.toLowerCase().split(' ')[0])
      );
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

    const db = await getDb();

    // Resolve student_id from the completed session
    const sessionRows = await db.unsafe<any[]>(
      `SELECT student_id FROM test_sessions WHERE id = $1::uuid AND status = 'completed'`,
      sessionId
    );
    if (!sessionRows.length) return err(404, 'Completed session not found');
    const studentId = sessionRows[0].student_id;

    // Resolve the student's active stage (determines which skill taxonomy to use)
    const stageRows = await db.unsafe<any[]>(
      `SELECT stage_id FROM student_stages WHERE student_id = $1::uuid AND status = 'active' LIMIT 1`,
      studentId
    );
    const stageId: string = stageRows[0]?.stage_id ?? 'oc_prep';
    const stageSkills = STAGE_SKILLS[stageId] ?? STAGE_SKILLS.oc_prep;

    // Fetch responses scoped to this stage's sessions where possible,
    // falling back to all completed sessions if no stage match.
    const responses = await db.unsafe<any[]>(
      `SELECT sr.is_correct, q.skill_tags, q.subject
       FROM session_responses sr
       JOIN questions q ON sr.question_id = q.id
       JOIN test_sessions ts ON sr.session_id = ts.id
       WHERE ts.student_id = $1::uuid
         AND ts.status = 'completed'
         AND (ts.stage_id = $2 OR ts.stage_id IS NULL)`,
      studentId,
      stageId
    );

    // Accumulate correct/total per canonical stage skill per subject
    type SkillCounts = { correct: number; total: number };
    const maps: Record<string, Map<string, SkillCounts>> = {};
    for (const subj of Object.keys(stageSkills)) {
      maps[subj] = new Map();
    }

    for (const r of responses) {
      const subj: string = r.subject;
      if (!maps[subj]) continue;
      const rawTags: string[] = Array.isArray(r.skill_tags) ? r.skill_tags : [];
      const skills = mapTagsToSkills(rawTags, subj, stageId);
      for (const skill of skills) {
        if (!maps[subj].has(skill)) maps[subj].set(skill, { correct: 0, total: 0 });
        const d = maps[subj].get(skill)!;
        d.total++;
        if (r.is_correct) d.correct++;
      }
    }

    // Build full skill_graph — include all stage skills (even unpracticed ones with total=0)
    const skillGraph: Record<string, Array<{ skill: string; correct: number; total: number }>> = {};
    for (const [subj, skills] of Object.entries(stageSkills)) {
      const map = maps[subj] ?? new Map();
      skillGraph[subj] = skills.map(skill => {
        const d = map.get(skill) || { correct: 0, total: 0 };
        return { skill, correct: d.correct, total: d.total };
      });
    }

    // Upsert into student_profiles (legacy table — stage-specific graph stored here)
    await query(
      `INSERT INTO student_profiles (id, student_id, skill_graph, last_calculated, updated_at)
       VALUES (uuid_generate_v4(), $1::uuid, $2::jsonb, NOW(), NOW())
       ON CONFLICT (student_id)
       DO UPDATE SET skill_graph = $2::jsonb, last_calculated = NOW(), updated_at = NOW()`,
      studentId,
      JSON.stringify(skillGraph)
    );

    return ok({ success: true, stageId, skillGraph });
  } catch (error) {
    console.error('analyze-session error:', error);
    return err(500, 'Internal server error');
  }
}
