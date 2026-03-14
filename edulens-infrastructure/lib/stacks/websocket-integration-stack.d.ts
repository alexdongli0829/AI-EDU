/**
 * WebSocket Integration Stack
 *
 * This stack connects WebSocket API routes to Lambda functions.
 * Deploy this AFTER the main stacks to avoid cyclic dependencies.
 *
 * Usage:
 *   npx cdk deploy EduLensWebSocketIntegrationStack-dev --context stage=dev
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
export interface WebSocketIntegrationStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
}
export declare class WebSocketIntegrationStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: WebSocketIntegrationStackProps);
}
