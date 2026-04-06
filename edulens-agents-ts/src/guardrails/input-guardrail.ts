/**
 * Input guardrails — validates user messages before sending to the agent.
 * Blocks medical/psychological content, inappropriate language, off-topic,
 * admission prediction requests, and overly long messages.
 */

import { GuardrailResult } from '../shared/types.js';

// Medical / psychological keywords that should trigger a redirect
const MEDICAL_KEYWORDS = [
  'adhd', 'autism', 'dyslexia', 'anxiety', 'depression', 'medication',
  'therapy', 'therapist', 'psychiatrist', 'psychologist', 'diagnosis',
  'disorder', 'behavioral issue', 'behavioural issue', 'mental health',
  'special needs', 'learning disability',
];

// Inappropriate content patterns (use word-boundary to catch inflections like "fucking")
const INAPPROPRIATE_PATTERNS = [
  /\b(fuck|shit|damn|ass|bitch|bastard)/i,
  /\b(kill|hurt|abuse|violence)\b/i,
  /\b(sex|porn|nude|naked)\b/i,
];

// Admission prediction request patterns — redirect without blocking
const ADMISSION_PREDICTION_PATTERNS = [
  /will (my child|he|she|they) (get into|make it|be accepted|be selected)/i,
  /what (score|mark) (does|do) (my child|he|she|they) need to get into/i,
  /chance.{0,20}(getting in|accepted|selected|admission)/i,
  /guarantee.{0,20}(place|spot|entry|admission)/i,
  /predict.{0,20}(result|outcome|admission|placement)/i,
];

// Educational topic indicators
const EDUCATIONAL_KEYWORDS = [
  'test', 'score', 'math', 'reading', 'thinking', 'writing', 'practice', 'study',
  'learn', 'exam', 'question', 'homework', 'school', 'grade', 'skill',
  'mastery', 'tutor', 'performance', 'improve', 'weakness', 'strength',
  'subject', 'pattern', 'vocabulary', 'inference', 'geometry', 'fraction',
  'spatial', 'oc', 'selective', 'mia', 'result', 'time', 'speed', 'error',
  'mistake', 'focus', 'prepare', 'preparation', 'rushing', 'stamina',
  'progress', 'how is', 'how are', 'what should', 'report', 'analyse',
  'analyze', 'chinese', 'plan', 'strategy', 'review', 'mock', 'stage',
  'writing', 'narrative', 'persuasive', 'spelling', 'grammar',
  'james ruse', 'north sydney', 'kogarah', 'hornsby', 'opportunity class',
  '她', '他', '数学', '成绩', '考试', '学习', '练习', '阅读', '写作',
];

const MAX_MESSAGE_LENGTH = 2000;

export function checkInputGuardrails(message: string): GuardrailResult {
  const lower = message.toLowerCase();

  // Rule 1: Medical keywords → redirect to professional
  for (const keyword of MEDICAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        blocked: true,
        reason: 'medical_redirect',
        redirect_message: (
          `I appreciate you sharing that concern. Questions about ` +
          `${keyword.toUpperCase()} and similar topics are best addressed by ` +
          `a qualified healthcare or educational psychology professional. ` +
          `I'm here to help with academic performance, test preparation, ` +
          `and learning strategies. Is there anything about your child's ` +
          `academic progress I can help with?`
        ),
      };
    }
  }

  // Rule 2: Inappropriate content → block
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason: 'inappropriate_content',
        redirect_message: 'I\'m here to help with educational topics. Could you please rephrase your question?',
      };
    }
  }

  // Rule 3: Admission prediction requests → soft redirect (not blocked, but flagged)
  for (const pattern of ADMISSION_PREDICTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: false,
        reason: 'admission_prediction_redirect',
        redirect_message: (
          'I can\'t predict specific admission outcomes because cut-off scores change each year ' +
          'based on the applicant pool. What I can do is show you where your child\'s current ' +
          'performance sits relative to the skill levels that typically correspond to different ' +
          'school tiers. Would you like me to break that down?'
        ),
      };
    }
  }

  // Rule 4: Message too long → ask to shorten
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      blocked: true,
      reason: 'message_too_long',
      redirect_message: (
        `Your message is ${message.length} characters long. ` +
        `Please shorten it to under ${MAX_MESSAGE_LENGTH} characters ` +
        `so I can give you a focused response.`
      ),
    };
  }

  // Rule 5: Off-topic detection (only for messages with 3+ words)
  const words = message.trim().split(/\s+/);
  if (words.length >= 3) {
    const hasEducational = EDUCATIONAL_KEYWORDS.some(kw => lower.includes(kw));
    if (!hasEducational) {
      return {
        blocked: true,
        reason: 'off_topic',
        redirect_message: (
          'I\'m an educational advisor focused on your child\'s learning ' +
          'progress and test preparation. Could you ask me something about ' +
          'their academic performance, test results, or study strategies?'
        ),
      };
    }
  }

  return { blocked: false };
}