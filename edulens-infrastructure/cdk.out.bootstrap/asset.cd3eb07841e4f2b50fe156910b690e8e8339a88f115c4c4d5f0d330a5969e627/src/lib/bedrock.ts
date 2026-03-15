/**
 * AWS Bedrock Integration for AI Chat
 */

import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
});

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

export interface BedrockOptions {
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULT_MODEL = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Stream chat completion from AWS Bedrock.
 * All generation parameters can be overridden via `options` (sourced from system config).
 */
export async function* streamChatCompletion(
  messages: Message[],
  systemPrompt?: string,
  options: BedrockOptions = {},
): AsyncGenerator<StreamChunk> {
  try {
    const modelId    = options.modelId    ?? DEFAULT_MODEL;
    const maxTokens  = options.maxTokens  ?? DEFAULT_MAX_TOKENS;
    const temperature = options.temperature ?? DEFAULT_TEMPERATURE;

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || 'You are a helpful AI assistant.',
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);

    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }

    for await (const event of response.body) {
      if (event.chunk && event.chunk.bytes) {
        const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          yield { type: 'content', content: chunk.delta.text };
        }

        if (chunk.type === 'message_stop') {
          yield { type: 'done' };
          return;
        }
      }
    }

    yield { type: 'done' };
  } catch (error) {
    console.error('Bedrock streaming error:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get non-streaming chat completion.
 */
export async function getChatCompletion(
  messages: Message[],
  systemPrompt?: string,
  options: BedrockOptions = {},
): Promise<string> {
  let fullResponse = '';

  for await (const chunk of streamChatCompletion(messages, systemPrompt, options)) {
    if (chunk.type === 'content' && chunk.content) {
      fullResponse += chunk.content;
    } else if (chunk.type === 'error') {
      throw new Error(chunk.error || 'Bedrock error');
    }
  }

  return fullResponse;
}
