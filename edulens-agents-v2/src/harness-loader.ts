/**
 * Domain Harness Loader - Loads YAML configuration files for domain-specific agent behavior
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { DomainHarness } from './shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class HarnessLoader {
  private readonly harnessCache = new Map<string, DomainHarness>();
  private readonly promptCache = new Map<string, string>();

  /**
   * Load a domain harness by name
   */
  async loadHarness(harnessName: string): Promise<DomainHarness> {
    // Check cache first
    if (this.harnessCache.has(harnessName)) {
      return this.harnessCache.get(harnessName)!;
    }

    const harnessPath = resolve(__dirname, 'harnesses', `${harnessName}.yaml`);

    if (!existsSync(harnessPath)) {
      throw new Error(`Harness not found: ${harnessName} at ${harnessPath}`);
    }

    try {
      const yamlContent = readFileSync(harnessPath, 'utf-8');
      const config = YAML.parse(yamlContent) as DomainHarness;

      // Validate required fields
      this.validateHarness(config, harnessName);

      // Load system prompt
      const systemPrompt = await this.loadSystemPrompt(config.systemPromptFile);

      // Store in cache
      this.harnessCache.set(harnessName, config);

      return config;
    } catch (error) {
      throw new Error(`Failed to load harness ${harnessName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load system prompt from markdown file
   */
  async loadSystemPrompt(promptFile: string): Promise<string> {
    // Check cache first
    if (this.promptCache.has(promptFile)) {
      return this.promptCache.get(promptFile)!;
    }

    const promptPath = resolve(__dirname, 'prompts', promptFile);

    if (!existsSync(promptPath)) {
      throw new Error(`System prompt file not found: ${promptFile} at ${promptPath}`);
    }

    try {
      const content = readFileSync(promptPath, 'utf-8');
      this.promptCache.set(promptFile, content);
      return content;
    } catch (error) {
      throw new Error(`Failed to load system prompt ${promptFile}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get available harness names
   */
  async getAvailableHarnesses(): Promise<string[]> {
    try {
      const fs = await import('fs/promises');
      const harnessDir = resolve(__dirname, 'harnesses');
      const files = await fs.readdir(harnessDir);

      return files
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => file.replace(/\.(yaml|yml)$/, ''));
    } catch {
      return [];
    }
  }

  /**
   * Clear caches (useful for development/testing)
   */
  clearCache(): void {
    this.harnessCache.clear();
    this.promptCache.clear();
  }

  /**
   * Validate harness configuration
   */
  private validateHarness(config: DomainHarness, name: string): void {
    const required = ['name', 'systemPromptFile', 'model', 'maxTokens', 'temperature', 'tools'];

    for (const field of required) {
      if (!(field in config)) {
        throw new Error(`Harness ${name} missing required field: ${field}`);
      }
    }

    // Validate model type
    if (!['haiku', 'sonnet'].includes(config.model)) {
      throw new Error(`Invalid model in harness ${name}: ${config.model}`);
    }

    // Validate fallback model if provided
    if (config.fallbackModel && !['haiku', 'sonnet'].includes(config.fallbackModel)) {
      throw new Error(`Invalid fallback model in harness ${name}: ${config.fallbackModel}`);
    }

    // Validate numeric ranges
    if (config.temperature < 0 || config.temperature > 1) {
      throw new Error(`Invalid temperature in harness ${name}: ${config.temperature}`);
    }

    if (config.maxTokens <= 0 || config.maxTokens > 8192) {
      throw new Error(`Invalid maxTokens in harness ${name}: ${config.maxTokens}`);
    }

    // Validate tools array
    if (!Array.isArray(config.tools)) {
      throw new Error(`Tools must be an array in harness ${name}`);
    }

    // Validate tool policies
    if (config.toolPolicies) {
      for (const [toolName, policy] of Object.entries(config.toolPolicies)) {
        if (!config.tools.includes(toolName)) {
          console.warn(`Tool policy defined for ${toolName} but tool not in tools array for harness ${name}`);
        }

        if (policy.maxCallsPerSession && policy.maxCallsPerSession <= 0) {
          throw new Error(`Invalid maxCallsPerSession for tool ${toolName} in harness ${name}`);
        }
      }
    }
  }
}

// Singleton instance
export const harnessLoader = new HarnessLoader();