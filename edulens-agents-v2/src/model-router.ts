/**
 * Model Router - Selects appropriate Claude model based on task type and domain harness config
 */

import { BedrockModel } from '@strands-agents/sdk';
import { DomainHarness } from './shared/types.js';

export type TaskType =
  | 'classification'
  | 'extraction'
  | 'suggested_questions'
  | 'conversation'
  | 'tutoring'
  | 'analysis'
  | 'reasoning';

export interface ModelConfig {
  modelId: string;
  region: string;
  temperature: number;
  maxTokens: number;
  stream: boolean;
}

export class ModelRouter {
  private readonly models: Map<'haiku' | 'sonnet', ModelConfig>;

  constructor() {
    this.models = new Map([
      ['haiku', {
        modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        region: 'us-west-2',
        temperature: 0.3,
        maxTokens: 1024,
        stream: true
      }],
      ['sonnet', {
        modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        region: 'us-west-2',
        temperature: 0.5,
        maxTokens: 2048,
        stream: true
      }]
    ]);
  }

  /**
   * Get the appropriate model for a task type and domain harness
   */
  getModelForTask(taskType: TaskType, harness: DomainHarness): BedrockModel {
    const preferredModel = this.selectModelType(taskType, harness);
    const config = this.models.get(preferredModel);

    if (!config) {
      throw new Error(`Model configuration not found for: ${preferredModel}`);
    }

    // Override config with harness-specific settings
    const finalConfig = {
      ...config,
      temperature: harness.temperature,
      maxTokens: harness.maxTokens
    };

    return new BedrockModel(finalConfig);
  }

  /**
   * Select model type based on task complexity and harness preferences
   */
  private selectModelType(taskType: TaskType, harness: DomainHarness): 'haiku' | 'sonnet' {
    // Check harness preference first
    if (harness.model === 'sonnet' || harness.model === 'haiku') {
      // For cheap tasks, prefer Haiku even if harness says Sonnet
      if (this.isCheapTask(taskType) && harness.model === 'sonnet') {
        return 'haiku';
      }
      return harness.model;
    }

    // Default task-based routing
    return this.isCheapTask(taskType) ? 'haiku' : 'sonnet';
  }

  /**
   * Determine if a task type should use the cheaper Haiku model
   */
  private isCheapTask(taskType: TaskType): boolean {
    const cheapTasks: TaskType[] = [
      'classification',
      'extraction',
      'suggested_questions'
    ];

    return cheapTasks.includes(taskType);
  }

  /**
   * Get model configuration without creating instance
   */
  getModelConfig(modelType: 'haiku' | 'sonnet'): ModelConfig {
    const config = this.models.get(modelType);
    if (!config) {
      throw new Error(`Model configuration not found for: ${modelType}`);
    }
    return { ...config };
  }

  /**
   * Create a model instance with custom configuration
   */
  createModel(modelType: 'haiku' | 'sonnet', overrides?: Partial<ModelConfig>): BedrockModel {
    const baseConfig = this.getModelConfig(modelType);
    const finalConfig = { ...baseConfig, ...overrides };

    return new BedrockModel(finalConfig);
  }

  /**
   * List all available models
   */
  getAvailableModels(): Array<{ name: 'haiku' | 'sonnet'; config: ModelConfig }> {
    return Array.from(this.models.entries()).map(([name, config]) => ({
      name,
      config: { ...config }
    }));
  }
}