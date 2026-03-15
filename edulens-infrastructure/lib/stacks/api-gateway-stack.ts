/**
 * API Gateway Stack
 *
 * Creates REST API and WebSocket API for EduLens services.
 * Call addApiRoutes() from app.ts after LambdaStack is created to wire
 * all Lambda integrations. This keeps the stack separation clean:
 *   - ApiGatewayStack owns all API Gateway resources (RestApi, routes, methods)
 *   - LambdaStack owns Lambda functions
 *   - No cyclic CloudFormation dependencies
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

/** Shape of Lambda function references needed to wire API routes */
export interface ApiRouteFunctions {
  // Auth
  loginFunction: lambda.Function;
  registerFunction: lambda.Function;
  createStudentFunction: lambda.Function;
  listStudentsFunction: lambda.Function;
  studentLoginFunction: lambda.Function;
  deleteStudentFunction: lambda.Function;
  // Test Engine
  createTestFunction: lambda.Function;
  getTestFunction: lambda.Function;
  getTestsFunction: lambda.Function;
  startTestSessionFunction: lambda.Function;
  submitAnswerFunction: lambda.Function;
  endTestSessionFunction: lambda.Function;
  getResultsFunction: lambda.Function;
  getStudentSessionsFunction: lambda.Function;
  studentInsightsFunction: lambda.Function;
  // Conversation Engine
  parentChatCreateFunction: lambda.Function;
  parentChatSendFunction: lambda.Function;
  parentChatGetMessagesFunction: lambda.Function;
  parentChatEndSessionFunction: lambda.Function;
  studentChatCreateFunction: lambda.Function;
  studentChatSendFunction: lambda.Function;
  studentChatGetMessagesFunction: lambda.Function;
  studentChatEndSessionFunction: lambda.Function;
  // WebSocket
  websocketConnectFunction: lambda.Function;
  websocketDisconnectFunction: lambda.Function;
  // Profile Engine
  errorPatternsAggregateFunction: lambda.Function;
  errorPatternsTrendsFunction: lambda.Function;
  // Admin Service
  adminCreateQuestionFunction: lambda.Function;
  adminUpdateQuestionFunction: lambda.Function;
  adminDeleteQuestionFunction: lambda.Function;
  adminListQuestionsFunction: lambda.Function;
  adminImportQuestionsFunction: lambda.Function;
  adminExportQuestionsFunction: lambda.Function;
  adminSystemMetricsFunction: lambda.Function;
  adminStudentAnalyticsFunction: lambda.Function;
  adminSystemConfigFunction: lambda.Function;
  // Stage Registry
  listStagesFunction: lambda.Function;
  getStageFunction: lambda.Function;
  getSkillTaxonomyFunction: lambda.Function;
  getSkillBridgesFunction: lambda.Function;
  listStudentStagesFunction: lambda.Function;
  activateStudentStageFunction: lambda.Function;
  deactivateStudentStageFunction: lambda.Function;
  // Contest Service
  listContestsFunction: lambda.Function;
  registerContestFunction: lambda.Function;
  submitContestResultFunction: lambda.Function;
  getContestResultsFunction: lambda.Function;
  adminListContestSeriesFunction: lambda.Function;
  adminCreateContestSeriesFunction: lambda.Function;
  adminCreateContestFunction: lambda.Function;
  adminUpdateContestFunction: lambda.Function;
  adminUpdateContestStatusFunction: lambda.Function;
  adminFinalizeContestResultsFunction: lambda.Function;
  getStudentContestHistoryFunction: lambda.Function;
}

export interface ApiGatewayStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly websocketApi: apigatewayv2.CfnApi;
  public readonly websocketStage: apigatewayv2.CfnStage;

  private readonly config: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { config } = props;
    this.config = config;

    // ============================================================
    // REST API Gateway
    // ============================================================

    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: `/aws/apigateway/edulens-${config.stage}`,
      retention: config.logRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `edulens-api-${config.stage}`,
      description: `EduLens REST API (${config.stage})`,
      deploy: true,
      deployOptions: {
        stageName: config.stage,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: config.stage !== 'prod',
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
      defaultCorsPreflightOptions: {
        allowOrigins: config.stage === 'prod'
          ? ['https://app.edulens.com']
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type', 'X-Amz-Date', 'Authorization',
          'X-Api-Key', 'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: true,
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
    usagePlan.addApiStage({ stage: this.restApi.deploymentStage });

    // ============================================================
    // WebSocket API
    // ============================================================

    this.websocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
      name: `edulens-ws-${config.stage}`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      description: `EduLens WebSocket API for timer sync (${config.stage})`,
    });

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

    new logs.LogGroup(this, 'WebSocketLogs', {
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

  // ============================================================
  // Wire REST API routes + WebSocket integrations (called from app.ts)
  // ============================================================

  addApiRoutes(fns: ApiRouteFunctions): void {
    const api = this.restApi;

    // ----------------------------------------------------------
    // Auth endpoints  /auth/...
    // ----------------------------------------------------------
    const authResource = api.root.addResource('auth');
    authResource.addMethod('POST', new apigateway.LambdaIntegration(fns.loginFunction));

    authResource.addResource('login')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.loginFunction));

    authResource.addResource('register')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.registerFunction));

    authResource.addResource('create-student')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.createStudentFunction));

    authResource.addResource('students')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.listStudentsFunction));

    authResource.addResource('student-login')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.studentLoginFunction));

    authResource.addResource('delete-student')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.deleteStudentFunction));

    // ----------------------------------------------------------
    // Test Engine  /tests/... and /sessions/...
    // ----------------------------------------------------------
    const testsResource = api.root.addResource('tests');
    testsResource.addMethod('POST', new apigateway.LambdaIntegration(fns.createTestFunction));
    testsResource.addMethod('GET', new apigateway.LambdaIntegration(fns.getTestsFunction));

    testsResource.addResource('{testId}')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.getTestFunction));

    const sessionsResource = api.root.addResource('sessions');
    sessionsResource.addMethod('POST', new apigateway.LambdaIntegration(fns.startTestSessionFunction));

    const sessionIdResource = sessionsResource.addResource('{sessionId}');
    sessionIdResource.addResource('answers')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.submitAnswerFunction));
    sessionIdResource.addResource('end')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.endTestSessionFunction));
    sessionIdResource.addResource('results')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.getResultsFunction));

    // /sessions/student/{studentId}
    sessionsResource.addResource('student')
      .addResource('{studentId}')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.getStudentSessionsFunction));

    // ----------------------------------------------------------
    // Students  /students/{studentId}/...
    // ----------------------------------------------------------
    const studentsRootResource = api.root.addResource('students');
    const studentByIdResource = studentsRootResource.addResource('{studentId}');

    // /students/{studentId}/insights
    const insightsResource = studentByIdResource.addResource('insights');
    insightsResource.addMethod('GET', new apigateway.LambdaIntegration(fns.studentInsightsFunction));
    insightsResource.addMethod('POST', new apigateway.LambdaIntegration(fns.studentInsightsFunction));

    // /students/{studentId}/error-patterns/aggregate|trends
    const errorPatternsResource = studentByIdResource.addResource('error-patterns');
    errorPatternsResource.addResource('aggregate')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.errorPatternsAggregateFunction));
    errorPatternsResource.addResource('trends')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.errorPatternsTrendsFunction));

    // /students/{studentId}/contest-history
    studentByIdResource.addResource('contest-history')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.getStudentContestHistoryFunction));

    // /students/{studentId}/stages  (Stage Registry enrollment)
    const studentStagesResource = studentByIdResource.addResource('stages');
    studentStagesResource.addMethod('GET', new apigateway.LambdaIntegration(fns.listStudentStagesFunction));
    const studentStageByIdResource = studentStagesResource.addResource('{stageId}');
    studentStageByIdResource.addMethod('POST', new apigateway.LambdaIntegration(fns.activateStudentStageFunction));
    studentStageByIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(fns.deactivateStudentStageFunction));

    // ----------------------------------------------------------
    // Conversation Engine  /parent-chat/... and /student-chat/...
    // ----------------------------------------------------------
    const parentChatResource = api.root.addResource('parent-chat');
    parentChatResource.addMethod('POST', new apigateway.LambdaIntegration(fns.parentChatCreateFunction));

    const parentSessionResource = parentChatResource.addResource('{sessionId}');
    parentSessionResource.addResource('message')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.parentChatSendFunction));
    parentSessionResource.addResource('messages')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.parentChatGetMessagesFunction));
    parentSessionResource.addResource('end')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.parentChatEndSessionFunction));

    const studentChatResource = api.root.addResource('student-chat');
    studentChatResource.addMethod('POST', new apigateway.LambdaIntegration(fns.studentChatCreateFunction));

    const studentSessionResource = studentChatResource.addResource('{sessionId}');
    studentSessionResource.addResource('message')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.studentChatSendFunction));
    studentSessionResource.addResource('messages')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.studentChatGetMessagesFunction));
    studentSessionResource.addResource('end')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.studentChatEndSessionFunction));

    // ----------------------------------------------------------
    // Stage Registry  /stages/...
    // ----------------------------------------------------------
    const stagesRootResource = api.root.addResource('stages');
    stagesRootResource.addMethod('GET', new apigateway.LambdaIntegration(fns.listStagesFunction));

    const stageByIdResource = stagesRootResource.addResource('{id}');
    stageByIdResource.addMethod('GET', new apigateway.LambdaIntegration(fns.getStageFunction));
    stageByIdResource.addResource('skill-taxonomy')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.getSkillTaxonomyFunction));
    stageByIdResource.addResource('bridges')
      .addResource('{toId}')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.getSkillBridgesFunction));

    // ----------------------------------------------------------
    // Contest Service  /contests/...
    // ----------------------------------------------------------
    const contestsRootResource = api.root.addResource('contests');
    contestsRootResource.addMethod('GET', new apigateway.LambdaIntegration(fns.listContestsFunction));

    const contestByIdResource = contestsRootResource.addResource('{id}');
    contestByIdResource.addResource('register')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.registerContestFunction));

    const contestResultsResource = contestByIdResource.addResource('results');
    contestResultsResource.addMethod('POST', new apigateway.LambdaIntegration(fns.submitContestResultFunction));
    contestResultsResource.addResource('{studentId}')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.getContestResultsFunction));

    // ----------------------------------------------------------
    // Admin Service  /admin/...
    // ----------------------------------------------------------
    const adminResource = api.root.addResource('admin');

    const questionsResource = adminResource.addResource('questions');
    questionsResource.addMethod('POST', new apigateway.LambdaIntegration(fns.adminCreateQuestionFunction), { apiKeyRequired: true });
    questionsResource.addMethod('GET', new apigateway.LambdaIntegration(fns.adminListQuestionsFunction), { apiKeyRequired: true });

    const questionIdResource = questionsResource.addResource('{questionId}');
    questionIdResource.addMethod('PUT', new apigateway.LambdaIntegration(fns.adminUpdateQuestionFunction), { apiKeyRequired: true });
    questionIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(fns.adminDeleteQuestionFunction), { apiKeyRequired: true });

    const bulkResource = adminResource.addResource('bulk');
    bulkResource.addResource('import')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.adminImportQuestionsFunction), { apiKeyRequired: true });
    bulkResource.addResource('export')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.adminExportQuestionsFunction), { apiKeyRequired: true });

    const analyticsResource = adminResource.addResource('analytics');
    analyticsResource.addResource('metrics')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.adminSystemMetricsFunction), { apiKeyRequired: true });
    analyticsResource.addResource('students')
      .addResource('{studentId}')
      .addMethod('GET', new apigateway.LambdaIntegration(fns.adminStudentAnalyticsFunction), { apiKeyRequired: true });

    const configResource = adminResource.addResource('config');
    configResource.addMethod('GET', new apigateway.LambdaIntegration(fns.adminSystemConfigFunction), { apiKeyRequired: true });
    configResource.addMethod('PUT', new apigateway.LambdaIntegration(fns.adminSystemConfigFunction), { apiKeyRequired: true });

    // Admin contest endpoints
    const adminContestSeriesResource = adminResource.addResource('contest-series');
    adminContestSeriesResource.addMethod('GET',  new apigateway.LambdaIntegration(fns.adminListContestSeriesFunction),   { apiKeyRequired: true });
    adminContestSeriesResource.addMethod('POST', new apigateway.LambdaIntegration(fns.adminCreateContestSeriesFunction), { apiKeyRequired: true });

    const adminContestsResource = adminResource.addResource('contests');
    adminContestsResource.addMethod('POST', new apigateway.LambdaIntegration(fns.adminCreateContestFunction), { apiKeyRequired: true });

    const adminContestByIdResource = adminContestsResource.addResource('{id}');
    adminContestByIdResource.addMethod('PUT', new apigateway.LambdaIntegration(fns.adminUpdateContestFunction), { apiKeyRequired: true });
    adminContestByIdResource.addResource('status')
      .addMethod('PATCH', new apigateway.LambdaIntegration(fns.adminUpdateContestStatusFunction), { apiKeyRequired: true });
    adminContestByIdResource.addResource('finalize')
      .addMethod('POST', new apigateway.LambdaIntegration(fns.adminFinalizeContestResultsFunction), { apiKeyRequired: true });

    // ----------------------------------------------------------
    // WebSocket routes  $connect / $disconnect
    // ----------------------------------------------------------
    const connectIntegration = new apigatewayv2.CfnIntegration(this, 'WsConnectIntegration', {
      apiId: this.websocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${fns.websocketConnectFunction.functionArn}/invocations`,
    });

    const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'WsDisconnectIntegration', {
      apiId: this.websocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${fns.websocketDisconnectFunction.functionArn}/invocations`,
    });

    new apigatewayv2.CfnRoute(this, 'WsConnectRoute', {
      apiId: this.websocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${connectIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'WsDisconnectRoute', {
      apiId: this.websocketApi.ref,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      target: `integrations/${disconnectIntegration.ref}`,
    });
  }
}
