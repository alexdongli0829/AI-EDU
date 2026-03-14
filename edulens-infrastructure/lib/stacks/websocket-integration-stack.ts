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
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface WebSocketIntegrationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class WebSocketIntegrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebSocketIntegrationStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ============================================================
    // Import Existing Resources
    // ============================================================

    // Import WebSocket API ID from stack exports
    const websocketApiId = cdk.Fn.importValue(`edulens-ws-api-id-${config.stage}`);

    // Import Lambda functions by name
    const websocketConnectFunction = lambda.Function.fromFunctionName(
      this,
      'WebsocketConnectFunction',
      `edulens-websocket-connect-${config.stage}`
    );

    const websocketDisconnectFunction = lambda.Function.fromFunctionName(
      this,
      'WebsocketDisconnectFunction',
      `edulens-websocket-disconnect-${config.stage}`
    );

    // ============================================================
    // Create WebSocket Integrations
    // ============================================================

    // $connect Integration
    const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: websocketApiId,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${websocketConnectFunction.functionArn}/invocations`,
    });

    // $disconnect Integration
    const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: websocketApiId,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${websocketDisconnectFunction.functionArn}/invocations`,
    });

    // ============================================================
    // Create WebSocket Routes
    // ============================================================

    new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
      apiId: websocketApiId,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${connectIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: websocketApiId,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    // ============================================================
    // Grant Permissions
    // ============================================================

    // Grant API Gateway permission to invoke Lambda functions
    websocketConnectFunction.addPermission('AllowApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${websocketApiId}/*`,
    });

    websocketDisconnectFunction.addPermission('AllowApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${websocketApiId}/*`,
    });

    // ============================================================
    // Outputs
    // ============================================================

    new cdk.CfnOutput(this, 'WebSocketIntegrationsCreated', {
      value: 'WebSocket $connect and $disconnect routes configured',
      description: 'WebSocket integration status',
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: `wss://${websocketApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com/${config.stage}`,
      description: 'WebSocket API URL',
    });
  }
}
