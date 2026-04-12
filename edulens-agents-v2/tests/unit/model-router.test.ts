/**
 * Unit tests for ModelRouter
 */

import { ModelRouter, TaskType } from '../../src/model-router.js';
import { DomainHarness } from '../../src/shared/types.js';

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
  });

  describe('getModelForTask', () => {
    const mockHaikuHarness: DomainHarness = {
      name: 'test_harness_haiku',
      systemPromptFile: 'test.md',
      model: 'haiku',
      maxTokens: 1024,
      temperature: 0.3,
      tools: [],
      toolPolicies: {}
    };

    const mockSonnetHarness: DomainHarness = {
      name: 'test_harness_sonnet',
      systemPromptFile: 'test.md',
      model: 'sonnet',
      maxTokens: 2048,
      temperature: 0.5,
      tools: [],
      toolPolicies: {}
    };

    test('should return BedrockModel for Haiku harness', () => {
      const model = router.getModelForTask('conversation', mockHaikuHarness);

      expect(model).toBeDefined();
      expect(model.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');
      // Note: BedrockModel doesn't expose region, temperature, maxTokens properties
      // These are internal to the model configuration
    });

    test('should return BedrockModel for Sonnet harness', () => {
      const model = router.getModelForTask('conversation', mockSonnetHarness);

      expect(model).toBeDefined();
      expect(model.modelId).toBe('global.anthropic.claude-sonnet-4-6');
      // Note: BedrockModel doesn't expose region, temperature, maxTokens properties
    });

    test('should override harness model for cheap tasks', () => {
      // Even if harness prefers Sonnet, should use Haiku for cheap tasks
      const model = router.getModelForTask('classification', mockSonnetHarness);

      expect(model.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');
    });

    test('should respect harness model for expensive tasks', () => {
      // For expensive tasks, should use harness preference
      const model = router.getModelForTask('conversation', mockSonnetHarness);

      expect(model.modelId).toBe('global.anthropic.claude-sonnet-4-6');
    });
  });

  describe('task classification', () => {
    const mockHarness: DomainHarness = {
      name: 'test_harness',
      systemPromptFile: 'test.md',
      model: 'sonnet',
      maxTokens: 2048,
      temperature: 0.5,
      tools: [],
      toolPolicies: {}
    };

    const cheapTasks: TaskType[] = ['classification', 'extraction', 'suggested_questions'];
    const expensiveTasks: TaskType[] = ['conversation', 'tutoring', 'analysis', 'reasoning'];

    test('should use Haiku for cheap tasks', () => {
      cheapTasks.forEach(taskType => {
        const model = router.getModelForTask(taskType, mockHarness);
        expect(model.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');
      });
    });

    test('should use harness preference for expensive tasks', () => {
      expensiveTasks.forEach(taskType => {
        const model = router.getModelForTask(taskType, mockHarness);
        expect(model.modelId).toBe('global.anthropic.claude-sonnet-4-6');
      });
    });
  });

  describe('getModelConfig', () => {
    test('should return Haiku configuration', () => {
      const config = router.getModelConfig('haiku');

      expect(config).toEqual({
        modelId: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
        region: 'us-west-2',
        temperature: 0.3,
        maxTokens: 1024,
        stream: true
      });
    });

    test('should return Sonnet configuration', () => {
      const config = router.getModelConfig('sonnet');

      expect(config).toEqual({
        modelId: 'global.anthropic.claude-sonnet-4-6',
        region: 'us-west-2',
        temperature: 0.5,
        maxTokens: 2048,
        stream: true
      });
    });

    test('should throw error for unknown model type', () => {
      expect(() => {
        router.getModelConfig('unknown' as any);
      }).toThrow('Model configuration not found');
    });
  });

  describe('createModel', () => {
    test('should create Haiku model with default config', () => {
      const model = router.createModel('haiku');

      expect(model).toBeDefined();
      expect(model.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');
      // Note: BedrockModel doesn't expose temperature, maxTokens properties
    });

    test('should create Sonnet model with default config', () => {
      const model = router.createModel('sonnet');

      expect(model).toBeDefined();
      expect(model.modelId).toBe('global.anthropic.claude-sonnet-4-6');
      // Note: BedrockModel doesn't expose temperature, maxTokens properties
    });

    test('should create model with overrides', () => {
      const model = router.createModel('haiku', {
        temperature: 0.7,
        maxTokens: 512
      });

      expect(model).toBeDefined();
      expect(model.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0'); // Should preserve base config
      // Note: BedrockModel doesn't expose temperature, maxTokens properties
    });

    test('should throw error for unknown model type', () => {
      expect(() => {
        router.createModel('unknown' as any);
      }).toThrow('Model configuration not found');
    });
  });

  describe('getAvailableModels', () => {
    test('should return list of available models', () => {
      const models = router.getAvailableModels();

      expect(models).toHaveLength(2);
      expect(models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'haiku' }),
          expect.objectContaining({ name: 'sonnet' })
        ])
      );

      const haikuModel = models.find(m => m.name === 'haiku');
      expect(haikuModel?.config.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');

      const sonnetModel = models.find(m => m.name === 'sonnet');
      expect(sonnetModel?.config.modelId).toBe('global.anthropic.claude-sonnet-4-6');
    });
  });

  describe('edge cases', () => {
    test('should handle missing fallback model', () => {
      const harnessWithoutFallback: DomainHarness = {
        name: 'test_harness',
        systemPromptFile: 'test.md',
        model: 'haiku',
        maxTokens: 1024,
        temperature: 0.3,
        tools: [],
        toolPolicies: {}
      };

      const model = router.getModelForTask('conversation', harnessWithoutFallback);
      expect(model.modelId).toBe('global.anthropic.claude-haiku-4-5-20251001-v1:0');
    });

    test('should handle extreme temperature values', () => {
      const extremeHarness: DomainHarness = {
        name: 'test_harness',
        systemPromptFile: 'test.md',
        model: 'sonnet',
        maxTokens: 2048,
        temperature: 0.0, // Minimum temperature
        tools: [],
        toolPolicies: {}
      };

      const model = router.getModelForTask('conversation', extremeHarness);
      expect(model).toBeDefined();
      expect(model.modelId).toBe('global.anthropic.claude-sonnet-4-6');
      // Note: BedrockModel doesn't expose temperature property
    });

    test('should handle maximum token values', () => {
      const maxTokenHarness: DomainHarness = {
        name: 'test_harness',
        systemPromptFile: 'test.md',
        model: 'sonnet',
        maxTokens: 8192, // Maximum tokens
        temperature: 0.5,
        tools: [],
        toolPolicies: {}
      };

      const model = router.getModelForTask('conversation', maxTokenHarness);
      expect(model).toBeDefined();
      expect(model.modelId).toBe('global.anthropic.claude-sonnet-4-6');
      // Note: BedrockModel doesn't expose maxTokens property
    });
  });
});