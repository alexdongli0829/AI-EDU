/**
 * Lambda Stack
 *
 * Deploys all 6 backend services as Lambda functions and wires them to:
 * - API Gateway (REST endpoints)
 * - WebSocket API (real-time connections)
 * - Application Load Balancer (SSE streaming)
 * - SQS Queues (async job processing)
 * - EventBridge (event-driven triggers)
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
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
  restApi: apigateway.RestApi;
  // websocketApi: apigatewayv2.CfnApi; // Removed to avoid cyclic dependency
  alb: elbv2.ApplicationLoadBalancer;
  httpListener: elbv2.ApplicationListener;
  summarizationQueueArn: string;
  insightsQueueArn: string;
  eventBus: events.IEventBus;
  connectionsTable: dynamodb.Table;
  testCompletedRuleName: string;
  timerSyncRuleName: string;
}

export class LambdaStack extends cdk.Stack {
  // Auth Service functions
  public readonly loginFunction: lambda.Function;
  public readonly registerFunction: lambda.Function;
  public readonly createStudentFunction: lambda.Function;
  public readonly listStudentsFunction: lambda.Function;
  public readonly studentLoginFunction: lambda.Function;
  public readonly deleteStudentFunction: lambda.Function;

  // Test Engine functions
  public readonly createTestFunction: lambda.Function;
  public readonly getTestFunction: lambda.Function;
  public readonly startTestSessionFunction: lambda.Function;
  public readonly submitAnswerFunction: lambda.Function;
  public readonly endTestSessionFunction: lambda.Function;
  public readonly getTestsFunction: lambda.Function;
  public readonly getResultsFunction: lambda.Function;
  public readonly getStudentSessionsFunction: lambda.Function;
  public readonly studentInsightsFunction: lambda.Function;

  // Conversation Engine functions
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

  // WebSocket functions
  public readonly websocketConnectFunction: lambda.Function;
  public readonly websocketDisconnectFunction: lambda.Function;
  public readonly timerSyncFunction: lambda.Function;

  // Profile Engine functions
  public readonly calculateProfileFunction: lambda.Function;

  // Background Jobs functions
  public readonly summarizationWorkerFunction: lambda.Function;
  public readonly insightsWorkerFunction: lambda.Function;

  // Admin Service functions
  public readonly adminCreateQuestionFunction: lambda.Function;
  public readonly adminUpdateQuestionFunction: lambda.Function;
  public readonly adminDeleteQuestionFunction: lambda.Function;
  public readonly adminListQuestionsFunction: lambda.Function;
  public readonly adminImportQuestionsFunction: lambda.Function;
  public readonly adminExportQuestionsFunction: lambda.Function;
  public readonly adminSystemMetricsFunction: lambda.Function;
  public readonly adminStudentAnalyticsFunction: lambda.Function;
  public readonly adminSystemConfigFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const {
      config,
      vpc,
      lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      restApi,
      // websocketApi, // Removed to avoid cyclic dependency
      alb,
      httpListener,
      summarizationQueueArn,
      insightsQueueArn,
      eventBus,
      connectionsTable,
      testCompletedRuleName,
      timerSyncRuleName,
    } = props;

    // AWS Bedrock will be used instead of Anthropic API
    // IAM permissions will be granted to invoke Bedrock models

    // ============================================================
    // 0. AUTH SERVICE (Node.js)
    // ============================================================

    // Login
    const loginLambda = new NodejsLambda(this, 'LoginLambda', {
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
    });
    this.loginFunction = loginLambda.function;

    // Register
    const registerLambda = new NodejsLambda(this, 'RegisterLambda', {
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
    });
    this.registerFunction = registerLambda.function;

    // Create Student (parent creates child account)
    const createStudentLambda = new NodejsLambda(this, 'CreateStudentLambda', {
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
    });
    this.createStudentFunction = createStudentLambda.function;

    // List Students (parent lists children)
    const listStudentsLambda = new NodejsLambda(this, 'ListStudentsLambda', {
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
    });
    this.listStudentsFunction = listStudentsLambda.function;

    // Student Login (username-based)
    const studentLoginLambda = new NodejsLambda(this, 'StudentLoginLambda', {
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
    });
    this.studentLoginFunction = studentLoginLambda.function;

    // Delete Student
    const deleteStudentLambda = new NodejsLambda(this, 'DeleteStudentLambda', {
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
    });
    this.deleteStudentFunction = deleteStudentLambda.function;

    // ============================================================
    // 1. TEST ENGINE SERVICE (Node.js)
    // ============================================================

    // Create Test
    const createTestLambda = new NodejsLambda(this, 'CreateTestLambda', {
      config,
      functionName: `edulens-create-test-${config.stage}`,
      handler: 'dist/handlers/create-test.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Create a new test',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.createTestFunction = createTestLambda.function;

    // Get Test
    const getTestLambda = new NodejsLambda(this, 'GetTestLambda', {
      config,
      functionName: `edulens-get-test-${config.stage}`,
      handler: 'dist/handlers/get-test.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Get test details',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.getTestFunction = getTestLambda.function;

    // Start Test Session
    const startTestSessionLambda = new NodejsLambda(this, 'StartTestSessionLambda', {
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
    });
    this.startTestSessionFunction = startTestSessionLambda.function;

    // Submit Answer
    const submitAnswerLambda = new NodejsLambda(this, 'SubmitAnswerLambda', {
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
    });
    this.submitAnswerFunction = submitAnswerLambda.function;

    // End Test Session
    const endTestSessionLambda = new NodejsLambda(this, 'EndTestSessionLambda', {
      config,
      functionName: `edulens-end-test-session-${config.stage}`,
      handler: 'dist/handlers/end-test-session.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'End a test session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
    });
    this.endTestSessionFunction = endTestSessionLambda.function;

    // Get Tests (list available tests)
    const getTestsLambda = new NodejsLambda(this, 'GetTestsLambda', {
      config,
      functionName: `edulens-get-tests-${config.stage}`,
      handler: 'dist/handlers/get-tests.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'List available tests',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.getTestsFunction = getTestsLambda.function;

    // Get Results
    const getResultsLambda = new NodejsLambda(this, 'GetResultsLambda', {
      config,
      functionName: `edulens-get-results-${config.stage}`,
      handler: 'dist/handlers/get-results.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Get test session results',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.getResultsFunction = getResultsLambda.function;

    // Get Student Sessions (all completed sessions for a student)
    const getStudentSessionsLambda = new NodejsLambda(this, 'GetStudentSessionsLambda', {
      config,
      functionName: `edulens-get-student-sessions-${config.stage}`,
      handler: 'dist/handlers/get-student-sessions.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Get all completed test sessions for a student',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.getStudentSessionsFunction = getStudentSessionsLambda.function;

    // Student Insights — AI-generated per-subject analysis (GET: return/regenerate, POST: force refresh)
    const bedrockModelId = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
    const studentInsightsLambda = new NodejsLambda(this, 'StudentInsightsLambda', {
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
    });
    this.studentInsightsFunction = studentInsightsLambda.function;

    // Grant Bedrock access
    this.studentInsightsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Daily EventBridge rule to regenerate insights for all students at midnight UTC
    new events.Rule(this, 'DailyInsightsRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      description: 'Trigger daily AI insights generation for all students',
      targets: [new events_targets.LambdaFunction(this.studentInsightsFunction)],
    });

    // Grant EventBridge publish permissions
    this.endTestSessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      })
    );

    // ============================================================
    // 2. CONVERSATION ENGINE SERVICE (Node.js)
    // ============================================================

    const conversationEnvironment = {
      AI_PROVIDER: 'bedrock',
      BEDROCK_REGION: cdk.Aws.REGION,
      BEDROCK_MODEL_ID: bedrockModelId,
    };

    // Parent Chat - Create Session
    const parentChatCreateLambda = new NodejsLambda(this, 'ParentChatCreateLambda', {
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
    });
    this.parentChatCreateFunction = parentChatCreateLambda.function;

    // Grant Bedrock access
    this.parentChatCreateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Parent Chat - Send Message (non-streaming JSON response via API Gateway)
    const parentChatSendLambda = new NodejsLambda(this, 'ParentChatSendLambda', {
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
    });
    this.parentChatSendFunction = parentChatSendLambda.function;

    this.parentChatSendFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Parent Chat - Send Message (SSE Stream)
    const parentChatSendStreamLambda = new NodejsLambda(this, 'ParentChatSendStreamLambda', {
      config,
      functionName: `edulens-parent-chat-send-stream-${config.stage}`,
      handler: 'dist/handlers/parent-chat/send-message-stream.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Parent chat send message (SSE streaming)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
    });
    this.parentChatSendStreamFunction = parentChatSendStreamLambda.function;

    // Grant Bedrock access
    this.parentChatSendStreamFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Parent Chat - Get Messages
    const parentChatGetMessagesLambda = new NodejsLambda(this, 'ParentChatGetMessagesLambda', {
      config,
      functionName: `edulens-parent-chat-get-messages-${config.stage}`,
      handler: 'dist/handlers/parent-chat/get-messages.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Get parent chat messages',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.parentChatGetMessagesFunction = parentChatGetMessagesLambda.function;

    // Parent Chat - End Session
    const parentChatEndSessionLambda = new NodejsLambda(this, 'ParentChatEndSessionLambda', {
      config,
      functionName: `edulens-parent-chat-end-session-${config.stage}`,
      handler: 'dist/handlers/parent-chat/end-session.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'End parent chat session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.parentChatEndSessionFunction = parentChatEndSessionLambda.function;
    this.parentChatEndSessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      })
    );

    // Student Chat - Create Session
    const studentChatCreateLambda = new NodejsLambda(this, 'StudentChatCreateLambda', {
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
    });
    this.studentChatCreateFunction = studentChatCreateLambda.function;

    // Grant Bedrock access
    this.studentChatCreateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Student Chat - Send Message (non-streaming JSON response via API Gateway)
    const studentChatSendLambda = new NodejsLambda(this, 'StudentChatSendLambda', {
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
    });
    this.studentChatSendFunction = studentChatSendLambda.function;

    this.studentChatSendFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Student Chat - Send Message (SSE Stream)
    const studentChatSendStreamLambda = new NodejsLambda(this, 'StudentChatSendStreamLambda', {
      config,
      functionName: `edulens-student-chat-send-stream-${config.stage}`,
      handler: 'dist/handlers/student-chat/send-message-stream.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Student chat send message (SSE streaming)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      environment: conversationEnvironment,
      timeout: cdk.Duration.seconds(120),
      memorySize: 1024,
    });
    this.studentChatSendStreamFunction = studentChatSendStreamLambda.function;

    // Grant Bedrock access
    this.studentChatSendStreamFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Student Chat - Get Messages
    const studentChatGetMessagesLambda = new NodejsLambda(this, 'StudentChatGetMessagesLambda', {
      config,
      functionName: `edulens-student-chat-get-messages-${config.stage}`,
      handler: 'dist/handlers/student-chat/get-messages.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Get student chat messages',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.studentChatGetMessagesFunction = studentChatGetMessagesLambda.function;

    // Student Chat - End Session
    const studentChatEndSessionLambda = new NodejsLambda(this, 'StudentChatEndSessionLambda', {
      config,
      functionName: `edulens-student-chat-end-session-${config.stage}`,
      handler: 'dist/handlers/student-chat/end-session.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'End student chat session',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.studentChatEndSessionFunction = studentChatEndSessionLambda.function;
    this.studentChatEndSessionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      })
    );

    // WebSocket - Connect
    const websocketConnectLambda = new NodejsLambda(this, 'WebsocketConnectLambda', {
      config,
      functionName: `edulens-websocket-connect-${config.stage}`,
      handler: 'dist/handlers/websocket/connect.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'WebSocket connect handler',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    });
    this.websocketConnectFunction = websocketConnectLambda.function;

    // Grant DynamoDB access using IAM policy (avoid cyclic dependency)
    this.websocketConnectFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          connectionsTable.tableArn,
          `${connectionsTable.tableArn}/index/*`,
        ],
      })
    );

    // WebSocket - Disconnect
    const websocketDisconnectLambda = new NodejsLambda(this, 'WebsocketDisconnectLambda', {
      config,
      functionName: `edulens-websocket-disconnect-${config.stage}`,
      handler: 'dist/handlers/websocket/disconnect.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'WebSocket disconnect handler',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(10),
    });
    this.websocketDisconnectFunction = websocketDisconnectLambda.function;

    // Grant DynamoDB access using IAM policy (avoid cyclic dependency)
    this.websocketDisconnectFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          connectionsTable.tableArn,
          `${connectionsTable.tableArn}/index/*`,
        ],
      })
    );

    // WebSocket - Timer Sync (EventBridge triggered)
    const timerSyncLambda = new NodejsLambda(this, 'TimerSyncLambda', {
      config,
      functionName: `edulens-timer-sync-${config.stage}`,
      handler: 'dist/handlers/websocket/timer-sync.handler',
      codePath: '../edulens-backend/services/conversation-engine',
      description: 'Timer sync broadcaster (every 5 seconds)',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
      timeout: cdk.Duration.seconds(30),
      environment: {
        // WEBSOCKET_API_ENDPOINT will be added via separate stack or manual configuration
      },
    });
    this.timerSyncFunction = timerSyncLambda.function;

    // Grant DynamoDB read access using IAM policy (avoid cyclic dependency)
    this.timerSyncFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [
          connectionsTable.tableArn,
          `${connectionsTable.tableArn}/index/*`,
        ],
      })
    );

    // Grant API Gateway management permissions for WebSocket
    // Note: WebSocket API resource ARN will need to be added manually or via separate stack
    // this.timerSyncFunction.addToRolePolicy(
    //   new iam.PolicyStatement({
    //     actions: ['execute-api:ManageConnections'],
    //     resources: [`arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/${config.stage}/POST/@connections/*`],
    //   })
    // );

    // ============================================================
    // 3. PROFILE ENGINE SERVICE (Python)
    // ============================================================

    const calculateProfileLambda = new PythonLambda(this, 'CalculateProfileLambda', {
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
    });
    this.calculateProfileFunction = calculateProfileLambda.function;

    // ============================================================
    // 4. BACKGROUND JOBS SERVICE (Python)
    // ============================================================

    const backgroundJobsEnvironment = {
      AI_PROVIDER: 'bedrock', // Use AWS Bedrock instead of Anthropic API
      // AWS_REGION is automatically provided by Lambda runtime
    };

    // Summarization Worker
    const summarizationWorkerLambda = new PythonLambda(this, 'SummarizationWorkerLambda', {
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
    });
    this.summarizationWorkerFunction = summarizationWorkerLambda.function;

    // Grant Bedrock access
    this.summarizationWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Add SQS trigger using CfnEventSourceMapping to avoid cyclic dependency
    new lambda.CfnEventSourceMapping(this, 'SummarizationQueueTrigger', {
      functionName: this.summarizationWorkerFunction.functionName,
      eventSourceArn: summarizationQueueArn,
      batchSize: 1,
      maximumBatchingWindowInSeconds: 10,
    });

    // Grant permissions to read from the queue
    this.summarizationWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: [summarizationQueueArn],
      })
    );

    // Insights Worker
    const insightsWorkerLambda = new PythonLambda(this, 'InsightsWorkerLambda', {
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
    });
    this.insightsWorkerFunction = insightsWorkerLambda.function;

    // Grant Bedrock access
    this.insightsWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
          `arn:aws:bedrock:*::foundation-model/*`,
        ],
      })
    );

    // Add SQS trigger using CfnEventSourceMapping to avoid cyclic dependency
    new lambda.CfnEventSourceMapping(this, 'InsightsQueueTrigger', {
      functionName: this.insightsWorkerFunction.functionName,
      eventSourceArn: insightsQueueArn,
      batchSize: 1,
      maximumBatchingWindowInSeconds: 30,
    });

    // Grant permissions to read from the queue
    this.insightsWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: [insightsQueueArn],
      })
    );

    // ============================================================
    // 5. ADMIN SERVICE (Node.js)
    // ============================================================

    // Create Question
    const adminCreateQuestionLambda = new NodejsLambda(this, 'AdminCreateQuestionLambda', {
      config,
      functionName: `edulens-admin-create-question-${config.stage}`,
      handler: 'dist/handlers/questions/create-question.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Create question',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.adminCreateQuestionFunction = adminCreateQuestionLambda.function;

    // Update Question
    const adminUpdateQuestionLambda = new NodejsLambda(this, 'AdminUpdateQuestionLambda', {
      config,
      functionName: `edulens-admin-update-question-${config.stage}`,
      handler: 'dist/handlers/questions/update-question.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Update question',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.adminUpdateQuestionFunction = adminUpdateQuestionLambda.function;

    // Delete Question
    const adminDeleteQuestionLambda = new NodejsLambda(this, 'AdminDeleteQuestionLambda', {
      config,
      functionName: `edulens-admin-delete-question-${config.stage}`,
      handler: 'dist/handlers/questions/delete-question.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: Delete question',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.adminDeleteQuestionFunction = adminDeleteQuestionLambda.function;

    // List Questions
    const adminListQuestionsLambda = new NodejsLambda(this, 'AdminListQuestionsLambda', {
      config,
      functionName: `edulens-admin-list-questions-${config.stage}`,
      handler: 'dist/handlers/questions/list-questions.handler',
      codePath: '../edulens-backend/services/admin-service',
      description: 'Admin: List questions',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.adminListQuestionsFunction = adminListQuestionsLambda.function;

    // Import Questions
    const adminImportQuestionsLambda = new NodejsLambda(this, 'AdminImportQuestionsLambda', {
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
    });
    this.adminImportQuestionsFunction = adminImportQuestionsLambda.function;

    // Export Questions
    const adminExportQuestionsLambda = new NodejsLambda(this, 'AdminExportQuestionsLambda', {
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
    });
    this.adminExportQuestionsFunction = adminExportQuestionsLambda.function;

    // System Metrics
    const adminSystemMetricsLambda = new NodejsLambda(this, 'AdminSystemMetricsLambda', {
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
    });
    this.adminSystemMetricsFunction = adminSystemMetricsLambda.function;

    // Student Analytics
    const adminStudentAnalyticsLambda = new NodejsLambda(this, 'AdminStudentAnalyticsLambda', {
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
    });
    this.adminStudentAnalyticsFunction = adminStudentAnalyticsLambda.function;

    // System Config (thresholds)
    const adminSystemConfigLambda = new NodejsLambda(this, 'AdminSystemConfigLambda', {
      config,
      functionName: `edulens-system-config-${config.stage}`,
      handler: 'dist/handlers/system-config.handler',
      codePath: '../edulens-backend/services/test-engine',
      description: 'Admin: Get/update system config thresholds',
      vpc,
      securityGroup: lambdaSecurityGroup,
      auroraSecret,
      redisEndpoint,
    });
    this.adminSystemConfigFunction = adminSystemConfigLambda.function;

    // ============================================================
    // 6. API GATEWAY INTEGRATIONS
    // ============================================================

    // Auth endpoints
    const authResource = restApi.root.addResource('auth');
    authResource.addMethod('POST', new apigateway.LambdaIntegration(this.loginFunction), {
      // No auth required for login endpoint
    });

    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', new apigateway.LambdaIntegration(this.loginFunction));

    const registerResource = authResource.addResource('register');
    registerResource.addMethod('POST', new apigateway.LambdaIntegration(this.registerFunction));

    const createStudentResource = authResource.addResource('create-student');
    createStudentResource.addMethod('POST', new apigateway.LambdaIntegration(this.createStudentFunction));

    const studentsResource = authResource.addResource('students');
    studentsResource.addMethod('GET', new apigateway.LambdaIntegration(this.listStudentsFunction));

    const studentLoginResource = authResource.addResource('student-login');
    studentLoginResource.addMethod('POST', new apigateway.LambdaIntegration(this.studentLoginFunction));

    const deleteStudentResource = authResource.addResource('delete-student');
    deleteStudentResource.addMethod('POST', new apigateway.LambdaIntegration(this.deleteStudentFunction));

    // Test Engine endpoints
    const testsResource = restApi.root.addResource('tests');
    testsResource.addMethod('POST', new apigateway.LambdaIntegration(this.createTestFunction));
    testsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getTestsFunction));

    const testIdResource = testsResource.addResource('{testId}');
    testIdResource.addMethod('GET', new apigateway.LambdaIntegration(this.getTestFunction));

    const sessionsResource = restApi.root.addResource('sessions');
    sessionsResource.addMethod('POST', new apigateway.LambdaIntegration(this.startTestSessionFunction));

    const sessionIdResource = sessionsResource.addResource('{sessionId}');
    const answersResource = sessionIdResource.addResource('answers');
    answersResource.addMethod('POST', new apigateway.LambdaIntegration(this.submitAnswerFunction));

    const endSessionResource = sessionIdResource.addResource('end');
    endSessionResource.addMethod('POST', new apigateway.LambdaIntegration(this.endTestSessionFunction));

    const resultsResource = sessionIdResource.addResource('results');
    resultsResource.addMethod('GET', new apigateway.LambdaIntegration(this.getResultsFunction));

    // Student Sessions - get all completed sessions for a student
    const studentSessionsResource = sessionsResource.addResource('student');
    const studentSessionsByIdResource = studentSessionsResource.addResource('{studentId}');
    studentSessionsByIdResource.addMethod('GET', new apigateway.LambdaIntegration(this.getStudentSessionsFunction));

    // Student Insights — /students/{studentId}/insights
    const studentsRootResource = restApi.root.addResource('students');
    const studentByIdResource = studentsRootResource.addResource('{studentId}');
    const insightsResource = studentByIdResource.addResource('insights');
    insightsResource.addMethod('GET', new apigateway.LambdaIntegration(this.studentInsightsFunction));
    insightsResource.addMethod('POST', new apigateway.LambdaIntegration(this.studentInsightsFunction));

    // Conversation Engine - Parent Chat (non-streaming)
    const parentChatResource = restApi.root.addResource('parent-chat');
    parentChatResource.addMethod('POST', new apigateway.LambdaIntegration(this.parentChatCreateFunction));

    const parentSessionResource = parentChatResource.addResource('{sessionId}');

    const parentMessageResource = parentSessionResource.addResource('message');
    parentMessageResource.addMethod('POST', new apigateway.LambdaIntegration(this.parentChatSendFunction));

    const parentMessagesResource = parentSessionResource.addResource('messages');
    parentMessagesResource.addMethod('GET', new apigateway.LambdaIntegration(this.parentChatGetMessagesFunction));

    const parentEndResource = parentSessionResource.addResource('end');
    parentEndResource.addMethod('POST', new apigateway.LambdaIntegration(this.parentChatEndSessionFunction));

    // Conversation Engine - Student Chat (non-streaming)
    const studentChatResource = restApi.root.addResource('student-chat');
    studentChatResource.addMethod('POST', new apigateway.LambdaIntegration(this.studentChatCreateFunction));

    const studentSessionResource = studentChatResource.addResource('{sessionId}');

    const studentMessageResource = studentSessionResource.addResource('message');
    studentMessageResource.addMethod('POST', new apigateway.LambdaIntegration(this.studentChatSendFunction));

    const studentMessagesResource = studentSessionResource.addResource('messages');
    studentMessagesResource.addMethod('GET', new apigateway.LambdaIntegration(this.studentChatGetMessagesFunction));

    const studentEndResource = studentSessionResource.addResource('end');
    studentEndResource.addMethod('POST', new apigateway.LambdaIntegration(this.studentChatEndSessionFunction));

    // Admin Service endpoints (require API key)
    const adminResource = restApi.root.addResource('admin');

    const questionsResource = adminResource.addResource('questions');
    questionsResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminCreateQuestionFunction), {
      apiKeyRequired: true,
    });
    questionsResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminListQuestionsFunction), {
      apiKeyRequired: true,
    });

    const questionIdResource = questionsResource.addResource('{questionId}');
    questionIdResource.addMethod('PUT', new apigateway.LambdaIntegration(this.adminUpdateQuestionFunction), {
      apiKeyRequired: true,
    });
    questionIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(this.adminDeleteQuestionFunction), {
      apiKeyRequired: true,
    });

    const bulkResource = adminResource.addResource('bulk');
    const importResource = bulkResource.addResource('import');
    importResource.addMethod('POST', new apigateway.LambdaIntegration(this.adminImportQuestionsFunction), {
      apiKeyRequired: true,
    });

    const exportResource = bulkResource.addResource('export');
    exportResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminExportQuestionsFunction), {
      apiKeyRequired: true,
    });

    const analyticsResource = adminResource.addResource('analytics');
    const metricsResource = analyticsResource.addResource('metrics');
    metricsResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminSystemMetricsFunction), {
      apiKeyRequired: true,
    });

    const studentAnalyticsResource = analyticsResource.addResource('students').addResource('{studentId}');
    studentAnalyticsResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminStudentAnalyticsFunction), {
      apiKeyRequired: true,
    });

    const configResource = adminResource.addResource('config');
    configResource.addMethod('GET', new apigateway.LambdaIntegration(this.adminSystemConfigFunction), {
      apiKeyRequired: true,
    });
    configResource.addMethod('PUT', new apigateway.LambdaIntegration(this.adminSystemConfigFunction), {
      apiKeyRequired: true,
    });

    // ============================================================
    // 7. WEBSOCKET API INTEGRATIONS
    // ============================================================

    // Note: WebSocket integrations commented out to avoid cyclic dependencies
    // TODO: Create these in a separate integration stack after Lambda and API Gateway stacks are deployed

    // const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
    //   apiId: websocketApi.ref,
    //   integrationType: 'AWS_PROXY',
    //   integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${this.websocketConnectFunction.functionArn}/invocations`,
    // });

    // const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
    //   apiId: websocketApi.ref,
    //   integrationType: 'AWS_PROXY',
    //   integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${this.websocketDisconnectFunction.functionArn}/invocations`,
    // });

    // new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
    //   apiId: websocketApi.ref,
    //   routeKey: '$connect',
    //   authorizationType: 'NONE',
    //   target: `integrations/${connectIntegration.ref}`,
    // });

    // new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
    //   apiId: websocketApi.ref,
    //   routeKey: '$disconnect',
    //   authorizationType: 'NONE',
    //   target: `integrations/${disconnectIntegration.ref}`,
    // });

    // Grant API Gateway permission to invoke WebSocket functions
    this.websocketConnectFunction.grantInvoke(
      new iam.ServicePrincipal('apigateway.amazonaws.com')
    );
    this.websocketDisconnectFunction.grantInvoke(
      new iam.ServicePrincipal('apigateway.amazonaws.com')
    );

    // ============================================================
    // 8. ALB TARGET GROUPS (SSE Streaming)
    // ============================================================

    // Parent Chat Streaming Target Group
    const parentStreamTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ParentStreamTargetGroup', {
      targetGroupName: `edulens-parent-stream-${config.stage}`,
      targetType: elbv2.TargetType.LAMBDA,
      targets: [new elbv2_targets.LambdaTarget(this.parentChatSendStreamFunction)],
      healthCheck: {
        enabled: false, // Lambda targets don't need health checks
      },
      // Note: deregistrationDelay is not supported for Lambda target groups
    });

    // Student Chat Streaming Target Group
    const studentStreamTargetGroup = new elbv2.ApplicationTargetGroup(this, 'StudentStreamTargetGroup', {
      targetGroupName: `edulens-student-stream-${config.stage}`,
      targetType: elbv2.TargetType.LAMBDA,
      targets: [new elbv2_targets.LambdaTarget(this.studentChatSendStreamFunction)],
      healthCheck: {
        enabled: false,
      },
      // Note: deregistrationDelay is not supported for Lambda target groups
    });

    // Add listener rules
    httpListener.addTargetGroups('ParentStreamRule', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/parent-chat/*/send']),
      ],
      targetGroups: [parentStreamTargetGroup],
    });

    httpListener.addTargetGroups('StudentStreamRule', {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/student-chat/*/send']),
      ],
      targetGroups: [studentStreamTargetGroup],
    });

    // ============================================================
    // 9. EVENTBRIDGE TARGETS
    // ============================================================

    // Note: EventBridge rules exist in JobsStack, but targets need to be added
    // after deployment to avoid cyclic dependencies.
    // See scripts/connect-eventbridge.sh or EVENTBRIDGE-SETUP.md

    // Grant EventBridge permission to invoke Lambda functions
    this.calculateProfileFunction.addPermission('AllowEventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/${testCompletedRuleName}`,
    });

    this.timerSyncFunction.addPermission('AllowEventBridgeInvokeTimerSync', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/${timerSyncRuleName}`,
    });

    // ============================================================
    // 10. GRANT DATABASE SECRET ACCESS
    // ============================================================

    // Grant all Lambda functions access to read the Aurora secret
    // Using addToRolePolicy instead of grantRead to avoid cyclic dependencies
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
    ];

    const secretReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [auroraSecret.secretArn],
    });

    allFunctions.forEach((fn) => {
      fn.addToRolePolicy(secretReadPolicy);
    });

    // ============================================================
    // 11. OUTPUTS
    // ============================================================

    new cdk.CfnOutput(this, 'LambdaFunctionsDeployed', {
      value: '24 functions deployed successfully',
      description: 'Number of Lambda functions deployed',
    });

    // Add tags to all Lambda functions
    cdk.Tags.of(this).add('Service', 'edulens');
    cdk.Tags.of(this).add('Environment', config.stage);
  }
}
