/**
 * AWS Bedrock AgentCore Runtime Client
 *
 * Invokes agents deployed on AgentCore Runtime (Strands Python agents).
 * The agents handle their own system prompts, tool calling, guardrails,
 * and signal extraction. This client sends the user prompt + context
 * (including conversation history for multi-turn) and receives the response.
 */

import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';

const agentCoreClient = new BedrockAgentCoreClient({
  region: process.env.AGENTCORE_REGION || process.env.AWS_DEFAULT_REGION || 'us-west-2',
});

// Runtime ARNs — set via Lambda environment variables (from CDK stack outputs)
const PARENT_ADVISOR_RUNTIME_ARN = process.env.PARENT_ADVISOR_RUNTIME_ARN || '';
const STUDENT_TUTOR_RUNTIME_ARN  = process.env.STUDENT_TUTOR_RUNTIME_ARN || '';
const PARENT_ADVISOR_ENDPOINT    = process.env.PARENT_ADVISOR_ENDPOINT_NAME || 'edulens_parent_advisor_ep_dev';
const STUDENT_TUTOR_ENDPOINT     = process.env.STUDENT_TUTOR_ENDPOINT_NAME || 'edulens_student_tutor_ep_dev';

export type AgentType = 'parent-advisor' | 'student-tutor';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentCoreRequest {
  prompt: string;
  conversationHistory?: ChatMessage[];
  studentId?: string;
  questionId?: string;
}

export interface AgentCoreResponse {
  response: string;
  blocked?: boolean;
  reason?: string;
  signals?: any[];
  runtimeSessionId?: string;
}

function getConfig(agentType: AgentType) {
  if (agentType === 'parent-advisor') {
    return { runtimeArn: PARENT_ADVISOR_RUNTIME_ARN, qualifier: PARENT_ADVISOR_ENDPOINT };
  }
  return { runtimeArn: STUDENT_TUTOR_RUNTIME_ARN, qualifier: STUDENT_TUTOR_ENDPOINT };
}

/**
 * Collect the streaming response body into a string.
 * The SDK returns `response` as a ReadableStream / AsyncIterable of bytes.
 */
async function collectResponseBody(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];

  if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
    for await (const chunk of stream) {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else if (typeof chunk === 'object' && chunk !== null) {
        // SDK may wrap in event objects — try common shapes
        const bytes = chunk.chunk?.bytes ?? chunk.bytes ?? chunk.body;
        if (bytes instanceof Uint8Array) {
          chunks.push(bytes);
        } else if (typeof bytes === 'string') {
          chunks.push(new TextEncoder().encode(bytes));
        }
      }
    }
  } else if (stream instanceof Uint8Array) {
    chunks.push(stream);
  } else if (typeof stream === 'string') {
    return stream;
  }

  if (chunks.length === 0) return '';
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Invoke an AgentCore Runtime agent and return the full response.
 */
export async function invokeAgent(
  agentType: AgentType,
  request: AgentCoreRequest,
): Promise<AgentCoreResponse> {
  const { runtimeArn, qualifier } = getConfig(agentType);

  if (!runtimeArn) {
    throw new Error(
      `Missing runtime ARN for ${agentType}. Set ` +
      `${agentType === 'parent-advisor' ? 'PARENT_ADVISOR_RUNTIME_ARN' : 'STUDENT_TUTOR_RUNTIME_ARN'} env var.`
    );
  }

  // Build payload with conversation history for multi-turn context
  const payload: Record<string, any> = { prompt: request.prompt };
  if (request.conversationHistory?.length) {
    payload.conversationHistory = request.conversationHistory;
  }
  if (request.studentId)  payload.studentId  = request.studentId;
  if (request.questionId) payload.questionId = request.questionId;

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: runtimeArn,
    qualifier,
    contentType: 'application/json',
    payload: new TextEncoder().encode(JSON.stringify(payload)),
  });

  const result = await agentCoreClient.send(command);

  const rawBody = await collectResponseBody(result.response);

  // Parse JSON — handle possible double-encoding
  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  } catch {
    parsed = { response: rawBody };
  }

  return {
    response: parsed.response || rawBody || '',
    blocked: parsed.blocked || false,
    reason: parsed.reason,
    signals: parsed.signals,
    runtimeSessionId: result.runtimeSessionId,
  };
}
