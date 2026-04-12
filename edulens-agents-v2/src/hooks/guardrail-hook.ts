/**
 * Guardrail Hook - Input/output safety and content filtering
 */

import { HookContext, HookResult } from '../shared/types.js';

export interface GuardrailInput {
  input: string;
}

export interface GuardrailResponse {
  response: string;
}

export class GuardrailHook {
  // Inappropriate content patterns
  private readonly blockedPatterns: RegExp[] = [
    /\b(?:password|secret|token|key)\s*[=:]\s*\S+/i,
    /\b(?:ssn|social security)\b.*\d{3}-\d{2}-\d{4}/i,
    /\b(?:credit card|visa|mastercard)\b.*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}/i,
    /\bharm\s+(?:yourself|myself|others)\b/i,
    /\b(?:kill|murder|suicide|self-harm)\b/i,
    /\b(?:racist|sexist|homophobic)\b.*\bslurs?\b/i,
    /\bcheat(?:ing)?\s+on\s+(?:test|exam|assignment)/i
  ];

  // Off-topic patterns for educational context
  private readonly offTopicPatterns: RegExp[] = [
    /\b(?:politics|political|election|vote|democrat|republican)\b/i,
    /\b(?:religion|religious|god|jesus|muslim|christian|hindu|buddhist)\b/i,
    /\b(?:dating|romance|relationship|girlfriend|boyfriend)\b/i,
    /\b(?:drugs|alcohol|smoking|marijuana|cocaine)\b/i,
    /\b(?:violence|fight|attack|weapon|gun|knife)\b/i
  ];

  // Educational content patterns (allowed)
  private readonly educationalPatterns: RegExp[] = [
    /\b(?:math|mathematics|arithmetic|algebra|geometry)\b/i,
    /\b(?:reading|comprehension|vocabulary|grammar)\b/i,
    /\b(?:science|physics|chemistry|biology)\b/i,
    /\b(?:history|geography|social studies)\b/i,
    /\b(?:test|exam|question|answer|practice|study)\b/i,
    /\b(?:nsw|oc|selective|school|education)\b/i,
    /\b(?:pattern|sequence|logic|reasoning|thinking)\b/i
  ];

  /**
   * Check input before processing
   */
  async beforeModelCall(input: GuardrailInput, context: HookContext): Promise<HookResult> {
    const text = input.input.toLowerCase();

    // Check for blocked content
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(text)) {
        console.log(`Input blocked by pattern: ${pattern.source}`);
        return {
          blocked: true,
          reason: 'Content violates safety guidelines',
          metadata: {
            pattern: pattern.source,
            type: 'blocked_content'
          }
        };
      }
    }

    // Check for off-topic content (unless admin)
    if (context.actorIdentity?.role !== 'admin') {
      const isEducational = this.educationalPatterns.some(pattern => pattern.test(text));
      const isOffTopic = this.offTopicPatterns.some(pattern => pattern.test(text));

      if (isOffTopic && !isEducational) {
        console.log(`Input redirected - off-topic content detected`);
        return {
          blocked: true,
          reason: 'Content is off-topic for educational context',
          metadata: {
            type: 'off_topic',
            redirect_message: "I'm here to help with NSW OC and Selective School preparation. Let's focus on your studies! What would you like to work on?"
          }
        };
      }
    }

    // Check for prompt injection attempts
    const injectionResult = this.checkPromptInjection(text);
    if (injectionResult.blocked) {
      return injectionResult;
    }

    return { blocked: false };
  }

  /**
   * Check response before sending to user
   */
  async beforeResponse(response: GuardrailResponse, context: HookContext): Promise<HookResult> {
    const text = response.response.toLowerCase();

    // Check for leaked sensitive information
    const sensitivePatterns = [
      /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token)\b/i,
      /\b(?:password|pwd)\s*[=:]\s*\S+/i,
      /\bbearer\s+[a-zA-Z0-9._-]+/i,
      /\b[a-f0-9]{32,64}\b/i // Hex strings that might be tokens
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(text)) {
        console.log(`Response blocked - sensitive information detected: ${pattern.source}`);
        return {
          blocked: true,
          reason: 'Response contains sensitive information',
          metadata: {
            pattern: pattern.source,
            type: 'sensitive_leak'
          }
        };
      }
    }

    // Check for inappropriate educational content
    const inappropriateEducational = [
      /\bhere'?s\s+the\s+(?:answer|solution)\b/i, // Direct answer giving
      /\bthe\s+correct\s+answer\s+is\b/i,
      /\bjust\s+(?:copy|memorize|remember)\s+this\b/i,
      /\bdon'?t\s+worry\s+about\s+understanding\b/i
    ];

    for (const pattern of inappropriateEducational) {
      if (pattern.test(text) && context.domainHarness?.name === 'student_tutor') {
        console.log(`Response flagged - inappropriate tutoring approach: ${pattern.source}`);
        // Don't block, but log for review
        return {
          blocked: false,
          metadata: {
            warning: 'Response may not follow Socratic method',
            pattern: pattern.source
          }
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Check for prompt injection attempts
   */
  private checkPromptInjection(text: string): HookResult {
    const injectionPatterns = [
      /ignore\s+(?:previous|all)\s+(?:instructions|prompts?)/i,
      /you\s+are\s+now\s+(?:a|an|acting as)/i,
      /forget\s+(?:everything|all)\s+(?:above|before|previous)/i,
      /new\s+instructions?\s*:\s*/i,
      /system\s*:\s*you\s+(?:are|must|should)/i,
      /\[?\s*(?:system|assistant|user)\s*\]?\s*:/i,
      /pretend\s+(?:you are|to be)/i,
      /roleplay\s+(?:as|being)/i,
      /act\s+like\s+you\s+(?:are|were)/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(text)) {
        console.log(`Prompt injection detected: ${pattern.source}`);
        return {
          blocked: true,
          reason: 'Prompt injection attempt detected',
          metadata: {
            pattern: pattern.source,
            type: 'prompt_injection'
          }
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Check if content is age-appropriate for primary school students
   */
  private checkAgeAppropriateness(text: string, targetAge: number = 10): boolean {
    // Complex words that might be inappropriate for young students
    const complexConcepts = [
      /\b(?:existential|metaphysical|philosophical)\b/i,
      /\b(?:advanced|graduate|university|college)\s+level/i,
      /\b(?:complex|sophisticated|intricate|nuanced)\b.*\b(?:concepts?|theories?|ideas?)\b/i
    ];

    // Check reading level (very basic heuristic)
    const words = text.split(/\s+/);
    const longWords = words.filter(word => word.length > 8).length;
    const longWordRatio = longWords / words.length;

    if (longWordRatio > 0.3) {
      return false; // Too many long words
    }

    // Check for complex concepts
    for (const pattern of complexConcepts) {
      if (pattern.test(text)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize content for safe display
   */
  sanitizeContent(content: string): string {
    // Remove potential HTML/script injection
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[script removed]')
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '[javascript removed]')
      .replace(/on\w+\s*=/gi, '[event handler removed]');
  }

  /**
   * Generate age-appropriate redirect message
   */
  generateRedirectMessage(reason: string, isStudent: boolean = true): string {
    const messages = {
      off_topic: isStudent
        ? "That's an interesting question, but I'm here to help you with your NSW OC and Selective School studies! What subject would you like to practice?"
        : "I focus on educational topics related to NSW OC and Selective School preparation. How can I help with your child's studies?",

      blocked_content: "I can't help with that, but I'm great at helping with math, reading, and test preparation! What would you like to work on?",

      prompt_injection: "I'm designed to help with educational questions. Let's focus on your studies - what subject can I help you with?",

      age_inappropriate: isStudent
        ? "That might be too advanced for now. Let's work on questions that are just right for your level! What subject interests you?"
        : "That content might not be age-appropriate. I focus on primary school level content for NSW OC and Selective preparation."
    };

    return messages[reason as keyof typeof messages] || messages.blocked_content;
  }
}