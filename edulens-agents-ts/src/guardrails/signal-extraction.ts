/**
 * Signal extraction — extracts educational signals from conversations for analytics and memory.
 */

import { EducationalSignal } from '../shared/types.js';

const SKILL_PATTERNS: Record<string, string[]> = {
  math: ['math', 'maths', 'mathematics', 'arithmetic'],
  'math.number_patterns': ['number pattern', 'pattern', 'sequence', 'multiply'],
  'math.fractions': ['fraction', 'numerator', 'denominator', 'half', 'quarter'],
  'math.geometry': ['geometry', 'shape', 'angle', 'triangle', 'rectangle'],
  'math.word_problems': ['word problem', 'story problem'],
  reading: ['reading', 'comprehension', 'passage'],
  'reading.inference': ['inference', 'infer', 'implies', 'suggest'],
  'reading.vocabulary': ['vocabulary', 'word meaning', 'definition'],
  'reading.main_idea': ['main idea', 'theme', 'central'],
  thinking: ['thinking skills', 'general ability'],
  'thinking.spatial': ['spatial', 'rotation', 'flip', 'mirror'],
  'thinking.analogies': ['analogy', 'analogies', 'is to'],
  'thinking.logic': ['logic', 'logical', 'reasoning'],
};

const CONCERN_KEYWORDS = [
  'worried', 'concerned', 'struggling', 'falling behind', 'not improving',
  'frustrated', 'doesn\'t like', 'hates', 'refuses', 'won\'t study', 'giving up',
];

export function extractSignals(text: string): EducationalSignal[] {
  const signals: EducationalSignal[] = [];
  const lower = text.toLowerCase();
  const now = new Date().toISOString();

  // Extract skill mentions
  for (const [skill, keywords] of Object.entries(SKILL_PATTERNS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        signals.push({
          type: 'skill_mentioned',
          value: skill,
          confidence: 0.8,
          timestamp: now,
        });
        break; // one signal per skill
      }
    }
  }

  // Detect parent concerns
  for (const kw of CONCERN_KEYWORDS) {
    if (lower.includes(kw)) {
      signals.push({
        type: 'concern_raised',
        value: kw,
        confidence: 0.75,
        timestamp: now,
      });
    }
  }

  // Detect language preference (Chinese)
  if (/[\u4e00-\u9fff]/.test(text)) {
    signals.push({
      type: 'language_preference',
      value: 'chinese',
      confidence: 0.95,
      timestamp: now,
    });
  }

  // Detect student understanding indicators
  const understandingPhrases = ['i get it', 'oh i see', 'makes sense', 'i understand'];
  if (understandingPhrases.some(phrase => lower.includes(phrase))) {
    signals.push({
      type: 'understanding_demonstrated',
      value: 'self_reported',
      confidence: 0.7,
      timestamp: now,
    });
  }

  // Detect confusion
  const confusionPhrases = ['i don\'t understand', 'i don\'t get it', 'confused', 'i don\'t know', 'what do you mean'];
  if (confusionPhrases.some(phrase => lower.includes(phrase))) {
    signals.push({
      type: 'confusion_detected',
      value: 'self_reported',
      confidence: 0.8,
      timestamp: now,
    });
  }

  return signals;
}