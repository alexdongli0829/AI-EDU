/**
 * Lambda Stack
 *
 * Deploys all backend service Lambda functions and their IAM policies.
 * API Gateway routes   → api-gateway-stack.ts (addApiRoutes)
 * ALB target groups    → alb-stack.ts          (addTargetGroups)
 * EventBridge targets  → app.ts                (wireEventBridgeTargets)
 */

import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
import { NodejsLambda } from '../constructs/nodejs-lambda';
import { PythonLambda } from '../constructs/python-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export interface LambdaStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  auroraSecret: secretsmanager.ISecret;
  redisEndpoint: string;
  /** SQS queue ARN — pass as a constructed string to avoid cyclic CFN cross-stack refs */
  summarizationQueueArn: string;
  /** SQS queue ARN — pass as a constructed string to avoid cyclic CFN cross-stack refs */
  insightsQueueArn: string;
  /** EventBridge default bus ARN — pass as a constructed string */
  eventBusArn: string;
  connectionsTable: dynamodb.Table;
  /** AgentCore Runtime ARNs — pass as constructed strings to avoid cross-stack deps */
  parentAdvisorRuntimeArn?: string;
  studentTutorRuntimeArn?: string;
  parentAdvisorEndpointName?: string;
  studentTutorEndpointName?: string;
}

export class LambdaStack extends cdk.Stack {
  // Auth Service
  public readonly loginFunction: lambda.Function;
  public readonly registerFunction: lambda.Function;
  public readonly createStudentFunction: lambda.Function;
  public readonly listStudentsFunction: lambda.Function;
  public readonly studentLoginFunction: lambda.Function;
  public readonly deleteStudentFunction: lambda.Function;

  // Test Engine
  public readonly createTestFunction: lambda.Function;
  public readonly getTestFunction: lambda.Function;
  public readonly startTestSessionFunction: lambda.Function;
  public readonly submitAnswerFunction: lambda.Function;
  public readonly endTestSessionFunction: lambda.Function;
  public readonly getTestsFunction: lambda.Function;
  public readonly getResultsFunction: lambda.Function;
  public readonly getStudentSessionsFunction: lambda.Function;
  public readonly getStudentAnalyticsFunction: lambda.Function;
  public readonly studentInsightsFunction: lambda.Function;

  // Conversation Engine
  public readonly parentChatCreateFunction: lambda.Function;
  public readonly parentChatSendFunction: lambda.Function;
  public readonly parentChatSendStreamFunction: lambda.Function;
  public readonly parentChatGetMessagesFunction: lambda.Function;
  public readonly parentChatEndSessionFunction: lambda.Function;
  public readonly studentChatCreateFunction: lambda.Function;
  public readonly studentChatSendFunction: lambda.Function;
  public readonly studentChatSendStreamFunction: lambda.Function;
  public readonly studentChatGetMessagesFunction: lambda.Function;
  public readonly studentChatEndSessionFunction: lambda.Function;

  // WebSocket
  public readonly websocketConnectFunction: lambda.Function;
  public readonly websocketDisconnectFunction: lambda.Function;
  public readonly timerSyncFunction: lambda.Function;

  // Profile Engine
  public readonly calculateProfileFunction: lambda.Function;
  public readonly errorPatternsAggregateFunction: lambda.Function;
  public readonly errorPatternsTrendsFunction: lambda.Function;

  // Background Jobs
  public readonly summarizationWorkerFunction: lambda.Function;
  public readonly insightsWorkerFunction: lambda.Function;

  // Admin Service
  public readonly adminCreateQuestionFunction: lambda.Function;
  public readonly adminUpdateQuestionFunction: lambda.Function;
  public readonly adminDeleteQuestionFunction: lambda.Function;
  public readonly adminListQuestionsFunction: lambda.Function;
  public readonly adminImportQuestionsFunction: lambda.Function;
  public readonly adminExportQuestionsFunction: lambda.Function;
  public readonly adminSystemMetricsFunction: lambda.Function;
  public readonly adminStudentAnalyticsFunction: lambda.Function;
  public readonly adminSystemConfigFunction: lambda.Function;

  // Stage Registry
  public readonly listStagesFunction: lambda.Function;
  public readonly getStageFunction: lambda.Function;
  public readonly getSkillTaxonomyFunction: lambda.Function;
  public readonly getSkillBridgesFunction: lambda.Function;
  public readonly listStudentStagesFunction: lambda.Function;
  public readonly activateStudentStageFunction: lambda.Function;
  public readonly deactivateStudentStageFunction: lambda.Function;

  // Contest Service
  public readonly listContestsFunction: lambda.Function;
  public readonly registerContestFunction: lambda.Function;
  public readonly submitContestResultFunction: lambda.Function;
  public readonly getContestResultsFunction: lambda.Function;
  public readonly adminListContestSeriesFunction: lambda.Function;
  public readonly adminCreateContestSeriesFunction: lambda.Function;
  public readonly adminCreateContestFunction: lambda.Function;
  public readonly adminUpdateContestFunction: lambda.Function;
  public readonly adminUpdateContestStatusFunction: lambda.Function;
  public readonly adminFinalizeContestResultsFunction: lambda.Function;
  public readonly getStudentContestHistoryFunction: lambda.Function;
  // DB Migration
  public readonly dbMigrateFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const {
      config,
      vpc,
      lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      summarizationQueueArn,
      insightsQueueArn,
      eventBusArn,
      connectionsTable,
    } = props;

    // Cross-region inference profiles use 'us.' or 'eu.' prefixes.
    // For ap-* regions, Claude 4 requires inference profiles not yet available on-demand;
    // use Claude 3.5 Sonnet v2 which supports on-demand throughput in AP.
    const bedrockModelId = config.region.startsWith('eu-')
      ? 'eu.anthropic.claude-sonnet-4-20250514-v1:0'
      : config.region.startsWith('ap-')
        ? 'anthropic.claude-3-5-sonnet-20241022-v2:0'
        : 'us.anthropic.claude-sonnet-4-20250514-v1:0';

    // ============================================================
    // 0. AUTH SERVICE (Node.js)
    // ============================================================

    this.loginFunction = new NodejsLambda(this, 'LoginLambda', {
      config,
      functionName: `edulens-login-${config.stage}`,
      handler: 'dist/handlers/login.handler',
      codePath: '../edulens-backend/services/auth-service',
      description: 'User login',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.registerFunction = new NodejsLambda(this, 'RegisterLambda', {
      config,
      functionName: `edulens-register-${config.stage}`,
      handler: 'dist/handlers/register.handler',
      codePath: '../edulens-backend/services/auth-service',
      description: 'User registration',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.createStudentFunction = new NodejsLambda(this, 'CreateStudentLambda', {
      config,
      functionName: `edulens-create-student-${config.stage}`,
      handler: 'dist/handlers/create-student.handler',
      codePath: '../edulens-backend/services/auth-service',
      description: 'Parent creates student account',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.listStudentsFunction = new NodejsLambda(this, 'ListStudentsLambda', {
      config,
      functionName: `edulens-list-students-${config.stage}`,
      handler: 'dist/handlers/list-students.handler',
      codePath: '../edulens-backend/services/auth-service',
      description: 'Parent lists student profiles',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.studentLoginFunction = new NodejsLambda(this, 'StudentLoginLambda', {
      config,
      functionName: `edulens-student-login-${config.stage}`,
      handler: 'dist/handlers/student-login.handler',
      codePath: '../edulens-backend/services/auth-service',
      description: 'Student login by username',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.deleteStudentFunction = new NodejsLambda(this, 'DeleteStudentLambda', {
      config,
      functionName: `edulens-delete-student-${config.stage}`,
      handler: 'dist/handlers/delete-student.handler',
      codePath: '../edulens-backend/services/auth-service',
      description: 'Parent deletes student profile',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    // ============================================================
    // 1. TEST ENGINE SERVICE (Node.js)
    // ============================================================

    this.createTestFunction = new NodejsLambda(this, 'CreateTestLambda', {
      config,
      functionName: `edulens-create-test-${config.stage}`,
      handler: 'dist/handlers/create-test.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Create a new test',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getTestFunction = new NodejsLambda(this, 'GetTestLambda', {
      config,
      functionName: `edulens-get-test-${config.stage}`,
      handler: 'dist/handlers/get-test.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Get test details',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.startTestSessionFunction = new NodejsLambda(this, 'StartTestSessionLambda', {
      config,
      functionName: `edulens-start-test-session-${config.stage}`,
      handler: 'dist/handlers/start-test-session.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Start a test session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
    }).function;

    this.submitAnswerFunction = new NodejsLambda(this, 'SubmitAnswerLambda', {
      config,
      functionName: `edulens-submit-answer-${config.stage}`,
      handler: 'dist/handlers/submit-answer.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Submit an answer',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.endTestSessionFunction = new NodejsLambda(this, 'EndTestSessionLambda', {
      config,
      functionName: `edulens-end-test-session-${config.stage}`,
      handler: 'dist/handlers/complete.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'End a test session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
    }).function;

    this.getTestsFunction = new NodejsLambda(this, 'GetTestsLambda', {
      config,
      functionName: `edulens-get-tests-${config.stage}`,
      handler: 'dist/handlers/get-tests.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'List available tests',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getResultsFunction = new NodejsLambda(this, 'GetResultsLambda', {
      config,
      functionName: `edulens-get-results-${config.stage}`,
      handler: 'dist/handlers/get-results.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Get test session results',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getStudentSessionsFunction = new NodejsLambda(this, 'GetStudentSessionsLambda', {
      config,
      functionName: `edulens-get-student-sessions-${config.stage}`,
      handler: 'dist/handlers/get-student-sessions.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Get all completed test sessions for a student',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getStudentAnalyticsFunction = new NodejsLambda(this, 'GetStudentAnalyticsLambda', {
      config,
      functionName: `edulens-get-student-analytics-${config.stage}`,
      handler: 'dist/handlers/get-student-analytics.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Compute and return full student analytics for the dashboard',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
    }).function;

    this.studentInsightsFunction = new NodejsLambda(this, 'StudentInsightsLambda', {
      config,
      functionName: `edulens-student-insights-${config.stage}`,
      handler: 'dist/handlers/student-insights.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'AI-powered per-subject performance insights for a student',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(60),
      environment: {
        BEDROCK_REGION: cdk.Aws.REGION,
        BEDROCK_MODEL_ID: bedrockModelId,
      },
    }).function;

    this.studentInsightsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Grant EventBridge permission to invoke studentInsights (DailyInsightsRule)
    this.studentInsightsFunction.addPermission('AllowEventBridgeDailyInsights', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/edulens-daily-insights-${config.stage}`,
    });

    // Grant EventBridge publish for test completion
    this.endTestSessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBusArn],
      })
    );

    // ============================================================
    // 2. CONVERSATION ENGINE SERVICE (Node.js)
    // ============================================================

    const conversationEnvironment: Record<string, string> = {
      AI_PROVIDER: 'bedrock',
      BEDROCK_REGION: cdk.Aws.REGION,
      BEDROCK_MODEL_ID: bedrockModelId,
      ...(props.parentAdvisorRuntimeArn && {
        PARENT_ADVISOR_RUNTIME_ARN: props.parentAdvisorRuntimeArn,
        PARENT_ADVISOR_ENDPOINT_NAME: props.parentAdvisorEndpointName || `edulens_parent_advisor_ep_${config.stage}`,
        AGENTCORE_REGION: config.region,
      }),
      ...(props.studentTutorRuntimeArn && {
        STUDENT_TUTOR_RUNTIME_ARN: props.studentTutorRuntimeArn,
        STUDENT_TUTOR_ENDPOINT_NAME: props.studentTutorEndpointName || `edulens_student_tutor_ep_${config.stage}`,
      }),
    };

    this.parentChatCreateFunction = new NodejsLambda(this, 'ParentChatCreateLambda', {
      config,
      functionName: `edulens-parent-chat-create-${config.stage}`,
      handler: 'dist/handlers/parent-chat/create-session.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Create parent chat session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
    }).function;

    this.parentChatCreateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    this.parentChatSendFunction = new NodejsLambda(this, 'ParentChatSendLambda', {
      config,
      functionName: `edulens-parent-chat-send-${config.stage}`,
      handler: 'dist/handlers/parent-chat/send-message.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Parent chat send message (non-streaming)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
    }).function;

    this.parentChatSendFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // AgentCore invoke permission for parent chat
    if (props.parentAdvisorRuntimeArn) {
      this.parentChatSendFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['bedrock-agentcore:InvokeAgentRuntime'],
          resources: [props.parentAdvisorRuntimeArn],
        })
      );
    }

    this.parentChatSendStreamFunction = new NodejsLambda(this, 'ParentChatSendStreamLambda', {
      config,
      functionName: `edulens-parent-chat-send-stream-${config.stage}`,
      handler: 'dist/handlers/parent-chat/stream-message.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Parent chat send message (SSE streaming)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
    }).function;

    this.parentChatSendStreamFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    this.parentChatGetMessagesFunction = new NodejsLambda(this, 'ParentChatGetMessagesLambda', {
      config,
      functionName: `edulens-parent-chat-get-messages-${config.stage}`,
      handler: 'dist/handlers/parent-chat/get-messages.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Get parent chat messages',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.parentChatEndSessionFunction = new NodejsLambda(this, 'ParentChatEndSessionLambda', {
      config,
      functionName: `edulens-parent-chat-end-session-${config.stage}`,
      handler: 'dist/handlers/parent-chat/end-session.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'End parent chat session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.parentChatEndSessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBusArn],
      })
    );

    this.studentChatCreateFunction = new NodejsLambda(this, 'StudentChatCreateLambda', {
      config,
      functionName: `edulens-student-chat-create-${config.stage}`,
      handler: 'dist/handlers/student-chat/create-session.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Create student chat session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
    }).function;

    this.studentChatCreateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    this.studentChatSendFunction = new NodejsLambda(this, 'StudentChatSendLambda', {
      config,
      functionName: `edulens-student-chat-send-${config.stage}`,
      handler: 'dist/handlers/student-chat/send-message.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Student chat send message (non-streaming)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
    }).function;

    this.studentChatSendFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // AgentCore invoke permission for student chat
    if (props.studentTutorRuntimeArn) {
      this.studentChatSendFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['bedrock-agentcore:InvokeAgentRuntime'],
          resources: [props.studentTutorRuntimeArn],
        })
      );
    }

    this.studentChatSendStreamFunction = new NodejsLambda(this, 'StudentChatSendStreamLambda', {
      config,
      functionName: `edulens-student-chat-send-stream-${config.stage}`,
      handler: 'dist/handlers/student-chat/stream-message.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Student chat send message (SSE streaming)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
    }).function;

    this.studentChatSendStreamFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    this.studentChatGetMessagesFunction = new NodejsLambda(this, 'StudentChatGetMessagesLambda', {
      config,
      functionName: `edulens-student-chat-get-messages-${config.stage}`,
      handler: 'dist/handlers/student-chat/get-messages.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Get student chat messages',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.studentChatEndSessionFunction = new NodejsLambda(this, 'StudentChatEndSessionLambda', {
      config,
      functionName: `edulens-student-chat-end-session-${config.stage}`,
      handler: 'dist/handlers/student-chat/end-session.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'End student chat session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.studentChatEndSessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBusArn],
      })
    );

    // WebSocket - Connect
    this.websocketConnectFunction = new NodejsLambda(this, 'WebsocketConnectLambda', {
      config,
      functionName: `edulens-websocket-connect-${config.stage}`,
      handler: 'dist/handlers/websocket/connect.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'WebSocket connect handler',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.websocketConnectFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
          'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        ],
        resources: [connectionsTable.tableArn, `${connectionsTable.tableArn}/index/*`],
      })
    );

    // Grant API Gateway permission to invoke WebSocket connect function
    this.websocketConnectFunction.addPermission('AllowApiGatewayWsConnect', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/${config.stage}/$connect`,
    });

    // WebSocket - Disconnect
    this.websocketDisconnectFunction = new NodejsLambda(this, 'WebsocketDisconnectLambda', {
      config,
      functionName: `edulens-websocket-disconnect-${config.stage}`,
      handler: 'dist/handlers/websocket/disconnect.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'WebSocket disconnect handler',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    }).function;

    this.websocketDisconnectFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
          'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        ],
        resources: [connectionsTable.tableArn, `${connectionsTable.tableArn}/index/*`],
      })
    );

    this.websocketDisconnectFunction.addPermission('AllowApiGatewayWsDisconnect', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/${config.stage}/$disconnect`,
    });

    // WebSocket - Timer Sync
    this.timerSyncFunction = new NodejsLambda(this, 'TimerSyncLambda', {
      config,
      functionName: `edulens-timer-sync-${config.stage}`,
      handler: 'dist/handlers/websocket/timer-sync.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Timer sync broadcaster (every 1 minute)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
    }).function;

    this.timerSyncFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan'],
        resources: [connectionsTable.tableArn, `${connectionsTable.tableArn}/index/*`],
      })
    );

    // Grant EventBridge permission to invoke timerSync (TimerSyncRule)
    this.timerSyncFunction.addPermission('AllowEventBridgeTimerSync', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/edulens-timer-sync-${config.stage}`,
    });

    // ============================================================
    // 3. PROFILE ENGINE SERVICE (Python)
    // ============================================================

    this.calculateProfileFunction = new PythonLambda(this, 'CalculateProfileLambda', {
      config,
      functionName: `edulens-calculate-profile-${config.stage}`,
      handler: 'src.handlers.calculate_profile.handler',
      codePath: '../edulens-backend/services/profile-engine',
      description: 'Calculate student learning profile (Bayesian)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      requirementsFile: 'requirements-light.txt',
    }).function;

    // Grant EventBridge permission to invoke calculateProfile (TestCompletedRule)
    this.calculateProfileFunction.addPermission('AllowEventBridgeTestCompleted', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/edulens-test-completed-${config.stage}`,
    });

    this.errorPatternsAggregateFunction = new PythonLambda(this, 'ErrorPatternsAggregateLambda', {
      config,
      functionName: `edulens-error-patterns-aggregate-${config.stage}`,
      handler: 'src.handlers.get_error_patterns_aggregate.handler',
      codePath: '../edulens-backend/services/profile-engine',
      description: 'Get aggregated error pattern analysis for a student',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      requirementsFile: 'requirements-light.txt',
    }).function;

    this.errorPatternsTrendsFunction = new PythonLambda(this, 'ErrorPatternsTrendsLambda', {
      config,
      functionName: `edulens-error-patterns-trends-${config.stage}`,
      handler: 'src.handlers.get_error_patterns_trends.handler',
      codePath: '../edulens-backend/services/profile-engine',
      description: 'Get error pattern trends over time for a student',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      requirementsFile: 'requirements-light.txt',
    }).function;

    // ============================================================
    // 4. BACKGROUND JOBS SERVICE (Python)
    // ============================================================

    const backgroundJobsEnvironment = {
      AI_PROVIDER: 'bedrock',
    };

    this.summarizationWorkerFunction = new PythonLambda(this, 'SummarizationWorkerLambda', {
      config,
      functionName: `edulens-summarization-worker-${config.stage}`,
      handler: 'src.handlers.summarization_worker.handler',
      codePath: '../edulens-backend/services/background-jobs',
      description: 'Conversation summarization worker',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: backgroundJobsEnvironment,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    }).function;

    this.summarizationWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // SQS trigger (CfnEventSourceMapping avoids cross-stack circular refs)
    new lambda.CfnEventSourceMapping(this, 'SummarizationQueueTrigger', {
      functionName: this.summarizationWorkerFunction.functionName,
      eventSourceArn: summarizationQueueArn,
      batchSize: 1,
      maximumBatchingWindowInSeconds: 10,
    });

    this.summarizationWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        resources: [summarizationQueueArn],
      })
    );

    this.insightsWorkerFunction = new PythonLambda(this, 'InsightsWorkerLambda', {
      config,
      functionName: `edulens-insights-worker-${config.stage}`,
      handler: 'src.handlers.insights_worker.handler',
      codePath: '../edulens-backend/services/background-jobs',
      description: 'Insights extraction worker',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: backgroundJobsEnvironment,
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
    }).function;

    this.insightsWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    new lambda.CfnEventSourceMapping(this, 'InsightsQueueTrigger', {
      functionName: this.insightsWorkerFunction.functionName,
      eventSourceArn: insightsQueueArn,
      batchSize: 1,
      maximumBatchingWindowInSeconds: 30,
    });

    this.insightsWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        resources: [insightsQueueArn],
      })
    );

    // ============================================================
    // 5. ADMIN SERVICE (Node.js)
    // ============================================================

    this.adminCreateQuestionFunction = new NodejsLambda(this, 'AdminCreateQuestionLambda', {
      config,
      functionName: `edulens-admin-create-question-${config.stage}`,
      handler: 'dist/handlers/questions/create-question.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Create question',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminUpdateQuestionFunction = new NodejsLambda(this, 'AdminUpdateQuestionLambda', {
      config,
      functionName: `edulens-admin-update-question-${config.stage}`,
      handler: 'dist/handlers/questions/update-question.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Update question',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminDeleteQuestionFunction = new NodejsLambda(this, 'AdminDeleteQuestionLambda', {
      config,
      functionName: `edulens-admin-delete-question-${config.stage}`,
      handler: 'dist/handlers/questions/delete-question.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Delete question',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminListQuestionsFunction = new NodejsLambda(this, 'AdminListQuestionsLambda', {
      config,
      functionName: `edulens-admin-list-questions-${config.stage}`,
      handler: 'dist/handlers/questions/list-questions.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: List questions',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminImportQuestionsFunction = new NodejsLambda(this, 'AdminImportQuestionsLambda', {
      config,
      functionName: `edulens-admin-import-questions-${config.stage}`,
      handler: 'dist/handlers/bulk-operations/import-questions.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Import questions (bulk)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    }).function;

    this.adminExportQuestionsFunction = new NodejsLambda(this, 'AdminExportQuestionsLambda', {
      config,
      functionName: `edulens-admin-export-questions-${config.stage}`,
      handler: 'dist/handlers/bulk-operations/export-questions.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Export questions (bulk)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    }).function;

    this.adminSystemMetricsFunction = new NodejsLambda(this, 'AdminSystemMetricsLambda', {
      config,
      functionName: `edulens-admin-system-metrics-${config.stage}`,
      handler: 'dist/handlers/analytics/system-metrics.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: System-wide metrics',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
    }).function;

    this.adminStudentAnalyticsFunction = new NodejsLambda(this, 'AdminStudentAnalyticsLambda', {
      config,
      functionName: `edulens-admin-student-analytics-${config.stage}`,
      handler: 'dist/handlers/analytics/student-analytics.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Student analytics',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
    }).function;

    this.adminSystemConfigFunction = new NodejsLambda(this, 'AdminSystemConfigLambda', {
      config,
      functionName: `edulens-system-config-${config.stage}`,
      handler: 'dist/handlers/system-config.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Admin: Get/update system config thresholds',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    // ============================================================
    // 6. STAGE REGISTRY SERVICE (Node.js)
    // ============================================================

    const stageRegistryPath = '../edulens-backend/services/stage-registry';

    this.listStagesFunction = new NodejsLambda(this, 'ListStagesLambda', {
      config,
      functionName: `edulens-list-stages-${config.stage}`,
      handler: 'dist/handlers/list-stages.handler',
      codePath: stageRegistryPath,
      description: 'List all active stages',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getStageFunction = new NodejsLambda(this, 'GetStageLambda', {
      config,
      functionName: `edulens-get-stage-${config.stage}`,
      handler: 'dist/handlers/get-stage.handler',
      codePath: stageRegistryPath,
      description: 'Get stage details',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getSkillTaxonomyFunction = new NodejsLambda(this, 'GetSkillTaxonomyLambda', {
      config,
      functionName: `edulens-get-skill-taxonomy-${config.stage}`,
      handler: 'dist/handlers/get-skill-taxonomy.handler',
      codePath: stageRegistryPath,
      description: 'Get stage skill taxonomy',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getSkillBridgesFunction = new NodejsLambda(this, 'GetSkillBridgesLambda', {
      config,
      functionName: `edulens-get-skill-bridges-${config.stage}`,
      handler: 'dist/handlers/get-skill-bridges.handler',
      codePath: stageRegistryPath,
      description: 'Get skill bridges between stages',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.listStudentStagesFunction = new NodejsLambda(this, 'ListStudentStagesLambda', {
      config,
      functionName: `edulens-list-student-stages-${config.stage}`,
      handler: 'dist/handlers/list-student-stages.handler',
      codePath: stageRegistryPath,
      description: 'List student stage enrollments',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.activateStudentStageFunction = new NodejsLambda(this, 'ActivateStudentStageLambda', {
      config,
      functionName: `edulens-activate-student-stage-${config.stage}`,
      handler: 'dist/handlers/activate-student-stage.handler',
      codePath: stageRegistryPath,
      description: 'Enroll student in a stage',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.deactivateStudentStageFunction = new NodejsLambda(this, 'DeactivateStudentStageLambda', {
      config,
      functionName: `edulens-deactivate-student-stage-${config.stage}`,
      handler: 'dist/handlers/deactivate-student-stage.handler',
      codePath: stageRegistryPath,
      description: 'Pause a student stage enrollment',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    // ============================================================
    // 7. CONTEST SERVICE (Node.js)
    // ============================================================

    const contestServicePath = '../edulens-backend/services/contest-service';

    this.listContestsFunction = new NodejsLambda(this, 'ListContestsLambda', {
      config,
      functionName: `edulens-list-contests-${config.stage}`,
      handler: 'dist/handlers/list-contests.handler',
      codePath: contestServicePath,
      description: 'List contests',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.registerContestFunction = new NodejsLambda(this, 'RegisterContestLambda', {
      config,
      functionName: `edulens-register-contest-${config.stage}`,
      handler: 'dist/handlers/register-contest.handler',
      codePath: contestServicePath,
      description: 'Register student for a contest',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.submitContestResultFunction = new NodejsLambda(this, 'SubmitContestResultLambda', {
      config,
      functionName: `edulens-submit-contest-result-${config.stage}`,
      handler: 'dist/handlers/submit-contest-result.handler',
      codePath: contestServicePath,
      description: 'Submit contest test result',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.getContestResultsFunction = new NodejsLambda(this, 'GetContestResultsLambda', {
      config,
      functionName: `edulens-get-contest-results-${config.stage}`,
      handler: 'dist/handlers/get-contest-results.handler',
      codePath: contestServicePath,
      description: 'Get student contest results',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminListContestSeriesFunction = new NodejsLambda(this, 'AdminListContestSeriesLambda', {
      config,
      functionName: `edulens-admin-list-contest-series-${config.stage}`,
      handler: 'dist/handlers/admin/list-contest-series.handler',
      codePath: contestServicePath,
      description: 'Admin: List contest series',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminCreateContestSeriesFunction = new NodejsLambda(this, 'AdminCreateContestSeriesLambda', {
      config,
      functionName: `edulens-admin-create-contest-series-${config.stage}`,
      handler: 'dist/handlers/admin/create-contest-series.handler',
      codePath: contestServicePath,
      description: 'Admin: Create contest series',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminCreateContestFunction = new NodejsLambda(this, 'AdminCreateContestLambda', {
      config,
      functionName: `edulens-admin-create-contest-${config.stage}`,
      handler: 'dist/handlers/admin/create-contest.handler',
      codePath: contestServicePath,
      description: 'Admin: Create contest',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminUpdateContestFunction = new NodejsLambda(this, 'AdminUpdateContestLambda', {
      config,
      functionName: `edulens-admin-update-contest-${config.stage}`,
      handler: 'dist/handlers/admin/update-contest.handler',
      codePath: contestServicePath,
      description: 'Admin: Update contest details',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminUpdateContestStatusFunction = new NodejsLambda(this, 'AdminUpdateContestStatusLambda', {
      config,
      functionName: `edulens-admin-update-contest-status-${config.stage}`,
      handler: 'dist/handlers/admin/update-contest-status.handler',
      codePath: contestServicePath,
      description: 'Admin: Update contest status',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    this.adminFinalizeContestResultsFunction = new NodejsLambda(this, 'AdminFinalizeContestResultsLambda', {
      config,
      functionName: `edulens-admin-finalize-contest-${config.stage}`,
      handler: 'dist/handlers/admin/finalize-contest-results.handler',
      codePath: contestServicePath,
      description: 'Admin: Finalize contest results and calculate percentiles',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(60),
    }).function;

    this.getStudentContestHistoryFunction = new NodejsLambda(this, 'GetStudentContestHistoryLambda', {
      config,
      functionName: `edulens-student-contest-history-${config.stage}`,
      handler: 'dist/handlers/get-student-contest-history.handler',
      codePath: contestServicePath,
      description: 'Get student contest history with percentile trend',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    }).function;

    // ============================================================
    // 8. GRANT DATABASE SECRET ACCESS TO ALL FUNCTIONS
    // ============================================================

    const allFunctions = [
      this.loginFunction,
      this.registerFunction,
      this.createStudentFunction,
      this.listStudentsFunction,
      this.studentLoginFunction,
      this.deleteStudentFunction,
      this.createTestFunction,
      this.getTestFunction,
      this.getTestsFunction,
      this.getResultsFunction,
      this.getStudentSessionsFunction,
      this.studentInsightsFunction,
      this.startTestSessionFunction,
      this.submitAnswerFunction,
      this.endTestSessionFunction,
      this.parentChatCreateFunction,
      this.parentChatSendFunction,
      this.parentChatSendStreamFunction,
      this.parentChatGetMessagesFunction,
      this.parentChatEndSessionFunction,
      this.studentChatCreateFunction,
      this.studentChatSendFunction,
      this.studentChatSendStreamFunction,
      this.studentChatGetMessagesFunction,
      this.studentChatEndSessionFunction,
      this.websocketConnectFunction,
      this.websocketDisconnectFunction,
      this.timerSyncFunction,
      this.calculateProfileFunction,
      this.errorPatternsAggregateFunction,
      this.errorPatternsTrendsFunction,
      this.summarizationWorkerFunction,
      this.insightsWorkerFunction,
      this.adminCreateQuestionFunction,
      this.adminUpdateQuestionFunction,
      this.adminDeleteQuestionFunction,
      this.adminListQuestionsFunction,
      this.adminImportQuestionsFunction,
      this.adminExportQuestionsFunction,
      this.adminSystemMetricsFunction,
      this.adminStudentAnalyticsFunction,
      this.adminSystemConfigFunction,
      // Stage Registry
      this.listStagesFunction,
      this.getStageFunction,
      this.getSkillTaxonomyFunction,
      this.getSkillBridgesFunction,
      this.listStudentStagesFunction,
      this.activateStudentStageFunction,
      this.deactivateStudentStageFunction,
      // Contest Service
      this.listContestsFunction,
      this.registerContestFunction,
      this.submitContestResultFunction,
      this.getContestResultsFunction,
      this.adminListContestSeriesFunction,
      this.adminCreateContestSeriesFunction,
      this.adminCreateContestFunction,
      this.adminUpdateContestFunction,
      this.adminUpdateContestStatusFunction,
      this.adminFinalizeContestResultsFunction,
      this.getStudentContestHistoryFunction,
    ];

    const secretReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
      resources: [auroraSecret.secretArn],
    });

    allFunctions.forEach((fn) => fn.addToRolePolicy(secretReadPolicy));

    // ============================================================
    // 9. DB MIGRATION LAMBDA
    // Auto-runs schema migration on every deployment via AwsCustomResource.
    // Uses CREATE TABLE IF NOT EXISTS, so re-runs are safe/idempotent.
    // Also exposed as edulens-db-migrate-${stage} for manual SQL invocations.
    // ============================================================

    const migrationAssetPath = path.resolve(__dirname, '../../../edulens-backend/scripts/db-migration');

    this.dbMigrateFunction = new lambda.Function(this, 'DbMigrateLambda', {
      functionName: `edulens-db-migrate-${config.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(migrationAssetPath),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: auroraSecret.secretArn,
      },
      description: 'Run database schema migrations against Aurora PostgreSQL',
    });

    auroraSecret.grantRead(this.dbMigrateFunction);

    // Auto-run migration on every cdk deploy via CloudFormation custom resource.
    // The migration Lambda handles the CloudFormation event protocol and returns
    // a compact response so the 4 KB CFN limit is not exceeded.
    const migrationProvider = new cr.Provider(this, 'DbMigrationProvider', {
      onEventHandler: this.dbMigrateFunction,
    });

    new cdk.CustomResource(this, 'RunDbMigration', {
      serviceToken: migrationProvider.serviceToken,
      properties: {
        // Bump this value to force a re-run on the next deploy
        Version: '1.0.0',
      },
    });

    // ============================================================
    // 10. OUTPUTS
    // ============================================================

    new cdk.CfnOutput(this, 'LambdaFunctionsDeployed', {
      value: '52 functions deployed',
      description: 'Number of Lambda functions deployed',
    });

    cdk.Tags.of(this).add('Service', 'edulens');
    cdk.Tags.of(this).add('Environment', config.stage);
  }
}
