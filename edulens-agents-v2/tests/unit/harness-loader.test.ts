/**
 * Unit tests for HarnessLoader
 */

import { HarnessLoader } from '../../src/harness-loader.js';

describe('HarnessLoader', () => {
  let loader: HarnessLoader;

  beforeEach(() => {
    loader = new HarnessLoader();
  });

  afterEach(() => {
    loader.clearCache();
  });

  describe('loadHarness', () => {
    test('should load student_tutor harness successfully', async () => {
      const harness = await loader.loadHarness('student_tutor');

      expect(harness).toBeDefined();
      expect(harness.name).toBe('student_tutor');
      expect(harness.model).toBe('haiku');
      expect(harness.fallbackModel).toBe('sonnet');
      expect(harness.tools).toContain('load_question_context');
      expect(harness.tools).toContain('query_student_level');
      expect(harness.toolPolicies).toBeDefined();
    });

    test('should load parent_advisor harness successfully', async () => {
      const harness = await loader.loadHarness('parent_advisor');

      expect(harness).toBeDefined();
      expect(harness.name).toBe('parent_advisor');
      expect(harness.model).toBe('sonnet');
      expect(harness.fallbackModel).toBe('haiku');
      expect(harness.tools).toContain('query_student_profile');
      expect(harness.tools).toContain('query_test_results');
      expect(harness.toolPolicies).toBeDefined();
    });

    test('should cache harness after first load', async () => {
      const harness1 = await loader.loadHarness('student_tutor');
      const harness2 = await loader.loadHarness('student_tutor');

      expect(harness1).toBe(harness2); // Same object reference
    });

    test('should throw error for non-existent harness', async () => {
      await expect(loader.loadHarness('nonexistent')).rejects.toThrow('Harness not found');
    });
  });

  describe('loadSystemPrompt', () => {
    test('should load student tutor system prompt', async () => {
      const prompt = await loader.loadSystemPrompt('student-tutor.md');

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('Socratic');
    });

    test('should load parent advisor system prompt', async () => {
      const prompt = await loader.loadSystemPrompt('parent-advisor.md');

      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('educational advisor');
    });

    test('should cache system prompt after first load', async () => {
      const prompt1 = await loader.loadSystemPrompt('student-tutor.md');
      const prompt2 = await loader.loadSystemPrompt('student-tutor.md');

      expect(prompt1).toBe(prompt2); // Same string reference
    });

    test('should throw error for non-existent prompt file', async () => {
      await expect(loader.loadSystemPrompt('nonexistent.md')).rejects.toThrow('System prompt file not found');
    });
  });

  describe('validation', () => {
    test('should validate harness structure', async () => {
      const harness = await loader.loadHarness('student_tutor');

      // Required fields
      expect(harness.name).toBeDefined();
      expect(harness.systemPromptFile).toBeDefined();
      expect(harness.model).toBeDefined();
      expect(harness.maxTokens).toBeDefined();
      expect(harness.temperature).toBeDefined();
      expect(harness.tools).toBeDefined();

      // Valid model types
      expect(['haiku', 'sonnet']).toContain(harness.model);
      if (harness.fallbackModel) {
        expect(['haiku', 'sonnet']).toContain(harness.fallbackModel);
      }

      // Valid ranges
      expect(harness.temperature).toBeGreaterThanOrEqual(0);
      expect(harness.temperature).toBeLessThanOrEqual(1);
      expect(harness.maxTokens).toBeGreaterThan(0);
      expect(harness.maxTokens).toBeLessThanOrEqual(8192);

      // Tools array
      expect(Array.isArray(harness.tools)).toBe(true);
      expect(harness.tools.length).toBeGreaterThan(0);
    });

    test('should validate tool policies structure', async () => {
      const harness = await loader.loadHarness('parent_advisor');

      for (const [toolName, policy] of Object.entries(harness.toolPolicies)) {
        expect(typeof toolName).toBe('string');
        expect(policy).toBeDefined();

        if (policy.maxCallsPerSession) {
          expect(policy.maxCallsPerSession).toBeGreaterThan(0);
        }

        if (policy.dataAccess) {
          expect(['own', 'children', 'all']).toContain(policy.dataAccess);
        }

        if (policy.requiresRole) {
          expect(Array.isArray(policy.requiresRole)).toBe(true);
          policy.requiresRole.forEach(role => {
            expect(['student', 'parent', 'admin']).toContain(role);
          });
        }

        if (policy.allowedDomains) {
          expect(Array.isArray(policy.allowedDomains)).toBe(true);
        }
      }
    });
  });

  describe('clearCache', () => {
    test('should clear cache and reload harness', async () => {
      // Load once
      const harness1 = await loader.loadHarness('student_tutor');

      // Clear cache
      loader.clearCache();

      // Load again
      const harness2 = await loader.loadHarness('student_tutor');

      // Should be different objects (not cached)
      expect(harness1).not.toBe(harness2);
      // But should have same content
      expect(harness1).toEqual(harness2);
    });
  });
});