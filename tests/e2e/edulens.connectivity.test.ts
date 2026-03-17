/**
 * EduLens Connectivity Tests
 *
 * Basic connectivity and configuration tests that don't require AgentCore access
 */

import axios from 'axios';
import {
  BedrockAgentCoreClient
} from '@aws-sdk/client-bedrock-agentcore';

const API_BASE_URL = 'https://npwg8my4w5.execute-api.us-west-2.amazonaws.com/dev';
const AWS_REGION = 'us-west-2';

describe('EduLens Connectivity Tests', () => {
  describe('AWS SDK Configuration', () => {
    test('BedrockAgentCore client can be instantiated', () => {
      const client = new BedrockAgentCoreClient({ region: AWS_REGION });
      expect(client).toBeTruthy();
      expect(client.config.region()).resolves.toBe(AWS_REGION);
    });

    test('AWS credentials are configured', async () => {
      const client = new BedrockAgentCoreClient({ region: AWS_REGION });
      const credentials = await client.config.credentials();
      expect(credentials).toBeTruthy();
      expect(credentials.accessKeyId).toBeTruthy();
      expect(credentials.secretAccessKey).toBeTruthy();
    });
  });

  describe('API Gateway Accessibility', () => {
    test('API Gateway endpoint is reachable', async () => {
      try {
        // Try to hit a non-authenticated endpoint
        const response = await axios.get(`${API_BASE_URL}/health`, {
          timeout: 10000,
          validateStatus: () => true // Accept any status code
        });

        console.log('API Gateway response status:', response.status);
        expect([200, 404, 403, 401]).toContain(response.status); // Any response means it's reachable
      } catch (error) {
        if ((error as any).code === 'ECONNREFUSED') {
          throw new Error('API Gateway endpoint is not reachable');
        }
        // Other errors (like timeout) are also connectivity issues
        throw error;
      }
    });

    test('Login endpoint exists', async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
          email: 'test@example.com',
          password: 'invalid'
        }, {
          timeout: 10000,
          validateStatus: () => true
        });

        console.log('Login endpoint response status:', response.status);
        // Should get 401 (unauthorized) or 400 (bad request), not 404 (not found)
        expect([400, 401, 422, 500]).toContain(response.status);
      } catch (error) {
        if ((error as any).code === 'ECONNREFUSED') {
          throw new Error('Login endpoint is not reachable');
        }
        throw error;
      }
    });
  });

  describe('Test Data Validation', () => {
    test('Runtime ARN format is valid', () => {
      const parentRuntimeArn = 'arn:aws:bedrock-agentcore:us-west-2:534409838809:runtime/edulens_parent_advisor_dev-5KSGKX4ah8';
      const studentRuntimeArn = 'arn:aws:bedrock-agentcore:us-west-2:534409838809:runtime/edulens_student_tutor_dev-2amG664Tev';

      const arnRegex = /^arn:aws:bedrock-agentcore:[\w-]+:\d+:runtime\/[\w-]+$/;

      expect(parentRuntimeArn).toMatch(arnRegex);
      expect(studentRuntimeArn).toMatch(arnRegex);
    });

    test('Endpoint names are valid', () => {
      const parentEndpoint = 'edulens_parent_advisor_ep_dev';
      const studentEndpoint = 'edulens_student_tutor_ep_dev';

      const endpointRegex = /^[\w_]+$/;

      expect(parentEndpoint).toMatch(endpointRegex);
      expect(studentEndpoint).toMatch(endpointRegex);
    });
  });

  describe('Test Framework Validation', () => {
    test('Response collection function handles different input types', async () => {
      // Test the collectResponseBody function with different inputs
      const collectResponseBody = async (stream: any): Promise<string> => {
        const chunks: Uint8Array[] = [];

        if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
          for await (const chunk of stream) {
            if (chunk instanceof Uint8Array) {
              chunks.push(chunk);
            } else if (typeof chunk === 'object' && chunk !== null) {
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
      };

      // Test with string
      expect(await collectResponseBody('test string')).toBe('test string');

      // Test with Uint8Array
      const testBytes = new TextEncoder().encode('test bytes');
      expect(await collectResponseBody(testBytes)).toBe('test bytes');

      // Test with empty input
      expect(await collectResponseBody('')).toBe('');
      expect(await collectResponseBody(null)).toBe('');
      expect(await collectResponseBody(undefined)).toBe('');
    });

    test('JSON parsing handles different response formats', () => {
      const parseResponse = (rawBody: string) => {
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
          signals: parsed.signals
        };
      };

      // Test normal JSON response
      const jsonResponse = JSON.stringify({
        response: 'Hello world',
        blocked: false,
        signals: []
      });
      const parsed1 = parseResponse(jsonResponse);
      expect(parsed1.response).toBe('Hello world');
      expect(parsed1.blocked).toBe(false);

      // Test double-encoded JSON
      const doubleEncoded = JSON.stringify(JSON.stringify({
        response: 'Double encoded',
        blocked: true
      }));
      const parsed2 = parseResponse(doubleEncoded);
      expect(parsed2.response).toBe('Double encoded');
      expect(parsed2.blocked).toBe(true);

      // Test non-JSON response
      const nonJson = 'Plain text response';
      const parsed3 = parseResponse(nonJson);
      expect(parsed3.response).toBe('Plain text response');
      expect(parsed3.blocked).toBe(false);
    });
  });
});