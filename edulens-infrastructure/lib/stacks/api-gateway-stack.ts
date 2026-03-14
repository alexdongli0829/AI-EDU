/**
 * API Gateway Stack
 *
 * Creates REST API and WebSocket API for EduLens services
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface ApiGatewayStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly websocketApi: apigatewayv2.CfnApi;
  public readonly websocketStage: apigatewayv2.CfnStage;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ============================================================
    // REST API Gateway
    // ============================================================

    // CloudWatch log group for API Gateway
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: `/aws/apigateway/edulens-${config.stage}`,
      retention: config.logRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create REST API
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `edulens-api-${config.stage}`,
      description: `EduLens REST API (${config.stage})`,

      // Deploy configuration
      deploy: true,
      deployOptions: {
        stageName: config.stage,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: config.stage !== 'prod', // Disable data trace in prod
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },

      // CORS configuration
      defaultCorsPreflightOptions: {
        allowOrigins: config.stage === 'prod'
          ? ['https://app.edulens.com'] // Replace with actual domain
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },

      // CloudWatch role
      cloudWatchRole: true,

      // Endpoint type
      endpointTypes: [apigateway.EndpointType.REGIONAL],
    });

    // API Key and Usage Plan (for admin endpoints)
    const apiKey = new apigateway.ApiKey(this, 'ApiKey', {
      apiKeyName: `edulens-admin-key-${config.stage}`,
      description: 'API Key for admin endpoints',
    });

    const usagePlan = this.restApi.addUsagePlan('UsagePlan', {
      name: `edulens-usage-plan-${config.stage}`,
      throttle: {
        rateLimit: config.stage === 'prod' ? 500 : 50,
        burstLimit: config.stage === 'prod' ? 1000 : 100,
      },
      quota: {
        limit: config.stage === 'prod' ? 100000 : 10000,
        period: apigateway.Period.DAY,
      },
    });

    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({
      stage: this.restApi.deploymentStage,
    });

    // Note: API Gateway resources and methods are created in the Lambda stack
    // to avoid cyclic dependencies

    // ============================================================
    // WebSocket API
    // ============================================================

    // Create WebSocket API
    this.websocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `edulens-ws-${config.stage}`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      description: `EduLens WebSocket API for timer sync (${config.stage})`,
    });

    // WebSocket Stage
    this.websocketStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', {
      apiId: this.websocketApi.ref,
      stageName: config.stage,
      description: `WebSocket stage for ${config.stage}`,
      autoDeploy: true,
      defaultRouteSettings: {
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    // CloudWatch logs for WebSocket
    const wsLogGroup = new logs.LogGroup(this, 'WebSocketLogs', {
      logGroupName: `/aws/apigateway/websocket-${config.stage}`,
      retention: config.logRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ============================================================
    // Outputs
    // ============================================================

    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: this.restApi.url,
      description: 'REST API endpoint URL',
      exportName: `edulens-api-url-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'RestApiId', {
      value: this.restApi.restApiId,
      description: 'REST API ID',
    });

    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: `wss://${this.websocketApi.ref}.execute-api.${this.region}.amazonaws.com/${config.stage}`,
      description: 'WebSocket API endpoint URL',
      exportName: `edulens-ws-url-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: this.websocketApi.ref,
      description: 'WebSocket API ID',
      exportName: `edulens-ws-api-id-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID (for admin endpoints)',
    });
  }
}
