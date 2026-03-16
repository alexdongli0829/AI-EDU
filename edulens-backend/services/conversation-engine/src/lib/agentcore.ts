/**
 * AWS Bedrock AgentCore Runtime Client
 *
 * Invokes agents deployed on AgentCore Runtime (Strands Python agents).
 * The agents handle their own system prompts, tool calling, guardrails,
 * and signal extraction. This client sends the user prompt + context
 * and receives the response.
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

export interface AgentCoreRequest {
  prompt: string;
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

  const payload: Record<string, string> = { prompt: request.prompt };
  if (request.studentId)  payload.studentId  = request.studentId;
  if (request.questionId) payload.questionId = request.questionId;

  const command = new InvokeAgentRuntimeCommand({
    agentRuntimeArn: runtimeArn,
    qualifier,
    contentType: 'application/json',
    payload: new TextEncoder().encode(JSON.stringify(payload)),
  });

  const result = await agentCoreClient.send(command);

  // The response payload is a streaming blob — collect it
  let rawBody = '';
  if (result.response) {
    // response is a ReadableStream or similar
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.response as any) {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else if (chunk?.chunk?.bytes) {
        chunks.push(chunk.chunk.bytes);
      }
    }
    rawBody = new TextDecoder().decode(Buffer.concat(chunks));
  }

  // Parse JSON — handle double-encoding
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
