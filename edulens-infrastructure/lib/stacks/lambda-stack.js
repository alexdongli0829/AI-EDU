"use strict";
/**
 * Lambda Stack
 *
 * Deploys all backend service Lambda functions and their IAM policies.
 * API Gateway routes   → api-gateway-stack.ts (addApiRoutes)
 * ALB target groups    → alb-stack.ts          (addTargetGroups)
 * EventBridge targets  → app.ts                (wireEventBridgeTargets)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const nodejs_lambda_1 = require("../constructs/nodejs-lambda");
const python_lambda_1 = require("../constructs/python-lambda");
class LambdaStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config, vpc, lambdaSecurityGroup, auroraSecret, redisEndpoint, summarizationQueueArn, insightsQueueArn, eventBusArn, connectionsTable, } = props;
        const bedrockModelId = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
        // ============================================================
        // 0. AUTH SERVICE (Node.js)
        // ============================================================
        this.loginFunction = new nodejs_lambda_1.NodejsLambda(this, 'LoginLambda', {
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
        this.registerFunction = new nodejs_lambda_1.NodejsLambda(this, 'RegisterLambda', {
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
        this.createStudentFunction = new nodejs_lambda_1.NodejsLambda(this, 'CreateStudentLambda', {
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
        this.listStudentsFunction = new nodejs_lambda_1.NodejsLambda(this, 'ListStudentsLambda', {
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
        this.studentLoginFunction = new nodejs_lambda_1.NodejsLambda(this, 'StudentLoginLambda', {
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
        this.deleteStudentFunction = new nodejs_lambda_1.NodejsLambda(this, 'DeleteStudentLambda', {
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
        this.createTestFunction = new nodejs_lambda_1.NodejsLambda(this, 'CreateTestLambda', {
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
        this.getTestFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetTestLambda', {
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
        this.startTestSessionFunction = new nodejs_lambda_1.NodejsLambda(this, 'StartTestSessionLambda', {
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
        this.submitAnswerFunction = new nodejs_lambda_1.NodejsLambda(this, 'SubmitAnswerLambda', {
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
        this.endTestSessionFunction = new nodejs_lambda_1.NodejsLambda(this, 'EndTestSessionLambda', {
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
        }).function;
        this.getTestsFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetTestsLambda', {
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
        this.getResultsFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetResultsLambda', {
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
        this.getStudentSessionsFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetStudentSessionsLambda', {
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
        this.studentInsightsFunction = new nodejs_lambda_1.NodejsLambda(this, 'StudentInsightsLambda', {
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
        this.studentInsightsFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Grant EventBridge permission to invoke studentInsights (DailyInsightsRule)
        this.studentInsightsFunction.addPermission('AllowEventBridgeDailyInsights', {
            principal: new iam.ServicePrincipal('events.amazonaws.com'),
            sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/edulens-daily-insights-${config.stage}`,
        });
        // Grant EventBridge publish for test completion
        this.endTestSessionFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [eventBusArn],
        }));
        // ============================================================
        // 2. CONVERSATION ENGINE SERVICE (Node.js)
        // ============================================================
        const conversationEnvironment = {
            AI_PROVIDER: 'bedrock',
            BEDROCK_REGION: cdk.Aws.REGION,
            BEDROCK_MODEL_ID: bedrockModelId,
        };
        this.parentChatCreateFunction = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatCreateLambda', {
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
        this.parentChatCreateFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        this.parentChatSendFunction = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatSendLambda', {
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
        this.parentChatSendFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        this.parentChatSendStreamFunction = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatSendStreamLambda', {
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
        }).function;
        this.parentChatSendStreamFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        this.parentChatGetMessagesFunction = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatGetMessagesLambda', {
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
        this.parentChatEndSessionFunction = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatEndSessionLambda', {
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
        this.parentChatEndSessionFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [eventBusArn],
        }));
        this.studentChatCreateFunction = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatCreateLambda', {
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
        this.studentChatCreateFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        this.studentChatSendFunction = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatSendLambda', {
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
        this.studentChatSendFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        this.studentChatSendStreamFunction = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatSendStreamLambda', {
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
        }).function;
        this.studentChatSendStreamFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        this.studentChatGetMessagesFunction = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatGetMessagesLambda', {
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
        this.studentChatEndSessionFunction = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatEndSessionLambda', {
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
        this.studentChatEndSessionFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [eventBusArn],
        }));
        // WebSocket - Connect
        this.websocketConnectFunction = new nodejs_lambda_1.NodejsLambda(this, 'WebsocketConnectLambda', {
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
        }).function;
        this.websocketConnectFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
                'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
            ],
            resources: [connectionsTable.tableArn, `${connectionsTable.tableArn}/index/*`],
        }));
        // Grant API Gateway permission to invoke WebSocket connect function
        this.websocketConnectFunction.addPermission('AllowApiGatewayWsConnect', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/${config.stage}/$connect`,
        });
        // WebSocket - Disconnect
        this.websocketDisconnectFunction = new nodejs_lambda_1.NodejsLambda(this, 'WebsocketDisconnectLambda', {
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
        }).function;
        this.websocketDisconnectFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
                'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
            ],
            resources: [connectionsTable.tableArn, `${connectionsTable.tableArn}/index/*`],
        }));
        this.websocketDisconnectFunction.addPermission('AllowApiGatewayWsDisconnect', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/${config.stage}/$disconnect`,
        });
        // WebSocket - Timer Sync
        this.timerSyncFunction = new nodejs_lambda_1.NodejsLambda(this, 'TimerSyncLambda', {
            config,
            functionName: `edulens-timer-sync-${config.stage}`,
            handler: 'dist/handlers/websocket/timer-sync.handler',
            codePath: '../edulens-backend/services/conversation-engine',
            description: 'Timer sync broadcaster (every 1 minute)',
            vpc,
            securityGroup: lambdaSecurityGroup,
            auroraSecret,
            redisEndpoint,
            timeout: cdk.Duration.seconds(30),
        }).function;
        this.timerSyncFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan'],
            resources: [connectionsTable.tableArn, `${connectionsTable.tableArn}/index/*`],
        }));
        // Grant EventBridge permission to invoke timerSync (TimerSyncRule)
        this.timerSyncFunction.addPermission('AllowEventBridgeTimerSync', {
            principal: new iam.ServicePrincipal('events.amazonaws.com'),
            sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/edulens-timer-sync-${config.stage}`,
        });
        // ============================================================
        // 3. PROFILE ENGINE SERVICE (Python)
        // ============================================================
        this.calculateProfileFunction = new python_lambda_1.PythonLambda(this, 'CalculateProfileLambda', {
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
        }).function;
        // Grant EventBridge permission to invoke calculateProfile (TestCompletedRule)
        this.calculateProfileFunction.addPermission('AllowEventBridgeTestCompleted', {
            principal: new iam.ServicePrincipal('events.amazonaws.com'),
            sourceArn: `arn:aws:events:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:rule/edulens-test-completed-${config.stage}`,
        });
        this.errorPatternsAggregateFunction = new python_lambda_1.PythonLambda(this, 'ErrorPatternsAggregateLambda', {
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
        }).function;
        this.errorPatternsTrendsFunction = new python_lambda_1.PythonLambda(this, 'ErrorPatternsTrendsLambda', {
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
        }).function;
        // ============================================================
        // 4. BACKGROUND JOBS SERVICE (Python)
        // ============================================================
        const backgroundJobsEnvironment = {
            AI_PROVIDER: 'bedrock',
        };
        this.summarizationWorkerFunction = new python_lambda_1.PythonLambda(this, 'SummarizationWorkerLambda', {
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
        this.summarizationWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // SQS trigger (CfnEventSourceMapping avoids cross-stack circular refs)
        new lambda.CfnEventSourceMapping(this, 'SummarizationQueueTrigger', {
            functionName: this.summarizationWorkerFunction.functionName,
            eventSourceArn: summarizationQueueArn,
            batchSize: 1,
            maximumBatchingWindowInSeconds: 10,
        });
        this.summarizationWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
            resources: [summarizationQueueArn],
        }));
        this.insightsWorkerFunction = new python_lambda_1.PythonLambda(this, 'InsightsWorkerLambda', {
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
        this.insightsWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        new lambda.CfnEventSourceMapping(this, 'InsightsQueueTrigger', {
            functionName: this.insightsWorkerFunction.functionName,
            eventSourceArn: insightsQueueArn,
            batchSize: 1,
            maximumBatchingWindowInSeconds: 30,
        });
        this.insightsWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
            resources: [insightsQueueArn],
        }));
        // ============================================================
        // 5. ADMIN SERVICE (Node.js)
        // ============================================================
        this.adminCreateQuestionFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminCreateQuestionLambda', {
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
        this.adminUpdateQuestionFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminUpdateQuestionLambda', {
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
        this.adminDeleteQuestionFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminDeleteQuestionLambda', {
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
        this.adminListQuestionsFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminListQuestionsLambda', {
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
        this.adminImportQuestionsFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminImportQuestionsLambda', {
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
        this.adminExportQuestionsFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminExportQuestionsLambda', {
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
        this.adminSystemMetricsFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminSystemMetricsLambda', {
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
        this.adminStudentAnalyticsFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminStudentAnalyticsLambda', {
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
        this.adminSystemConfigFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminSystemConfigLambda', {
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
        this.listStagesFunction = new nodejs_lambda_1.NodejsLambda(this, 'ListStagesLambda', {
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
        this.getStageFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetStageLambda', {
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
        this.getSkillTaxonomyFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetSkillTaxonomyLambda', {
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
        this.getSkillBridgesFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetSkillBridgesLambda', {
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
        this.listStudentStagesFunction = new nodejs_lambda_1.NodejsLambda(this, 'ListStudentStagesLambda', {
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
        this.activateStudentStageFunction = new nodejs_lambda_1.NodejsLambda(this, 'ActivateStudentStageLambda', {
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
        // ============================================================
        // 7. CONTEST SERVICE (Node.js)
        // ============================================================
        const contestServicePath = '../edulens-backend/services/contest-service';
        this.listContestsFunction = new nodejs_lambda_1.NodejsLambda(this, 'ListContestsLambda', {
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
        this.registerContestFunction = new nodejs_lambda_1.NodejsLambda(this, 'RegisterContestLambda', {
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
        this.submitContestResultFunction = new nodejs_lambda_1.NodejsLambda(this, 'SubmitContestResultLambda', {
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
        this.getContestResultsFunction = new nodejs_lambda_1.NodejsLambda(this, 'GetContestResultsLambda', {
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
        this.adminCreateContestSeriesFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminCreateContestSeriesLambda', {
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
        this.adminCreateContestFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminCreateContestLambda', {
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
        this.adminUpdateContestStatusFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminUpdateContestStatusLambda', {
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
        this.adminFinalizeContestResultsFunction = new nodejs_lambda_1.NodejsLambda(this, 'AdminFinalizeContestResultsLambda', {
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
            // Stage Registry
            this.listStagesFunction,
            this.getStageFunction,
            this.getSkillTaxonomyFunction,
            this.getSkillBridgesFunction,
            this.listStudentStagesFunction,
            this.activateStudentStageFunction,
            // Contest Service
            this.listContestsFunction,
            this.registerContestFunction,
            this.submitContestResultFunction,
            this.getContestResultsFunction,
            this.adminCreateContestSeriesFunction,
            this.adminCreateContestFunction,
            this.adminUpdateContestStatusFunction,
            this.adminFinalizeContestResultsFunction,
        ];
        const secretReadPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
            resources: [auroraSecret.secretArn],
        });
        allFunctions.forEach((fn) => fn.addToRolePolicy(secretReadPolicy));
        // ============================================================
        // 9. OUTPUTS
        // ============================================================
        new cdk.CfnOutput(this, 'LambdaFunctionsDeployed', {
            value: '52 functions deployed',
            description: 'Number of Lambda functions deployed',
        });
        cdk.Tags.of(this).add('Service', 'edulens');
        cdk.Tags.of(this).add('Environment', config.stage);
    }
}
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7OztHQU9HOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsK0RBQWlEO0FBS2pELHlEQUEyQztBQUczQywrREFBMkQ7QUFDM0QsK0RBQTJEO0FBa0IzRCxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQTJFeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF1QjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQ0osTUFBTSxFQUNOLEdBQUcsRUFDSCxtQkFBbUIsRUFDbkIsWUFBWSxFQUNaLGFBQWEsRUFDYixxQkFBcUIsRUFDckIsZ0JBQWdCLEVBQ2hCLFdBQVcsRUFDWCxnQkFBZ0IsR0FDakIsR0FBRyxLQUFLLENBQUM7UUFFVixNQUFNLGNBQWMsR0FBRyw0Q0FBNEMsQ0FBQztRQUVwRSwrREFBK0Q7UUFDL0QsNEJBQTRCO1FBQzVCLCtEQUErRDtRQUUvRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksNEJBQVksQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3pELE1BQU07WUFDTixZQUFZLEVBQUUsaUJBQWlCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDN0MsT0FBTyxFQUFFLDZCQUE2QjtZQUN0QyxRQUFRLEVBQUUsMENBQTBDO1lBQ3BELFdBQVcsRUFBRSxZQUFZO1lBQ3pCLEdBQUc7WUFDSCxhQUFhLEVBQUUsbUJBQW1CO1lBQ2xDLFlBQVk7WUFDWixhQUFhO1lBQ2IsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztTQUNsQyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBRVosSUFBSSxDQUFDLGdCQUFnQixHQUFHLElB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RCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHlCQUF5QixFQUFFO1lBQ2pELEtBQUssRUFBRSx1QkFBdUI7WUFDOUIsV0FBVyxFQUFFLHFDQUFxQztTQUNuRCxDQUFDLENBQUM7UUFFSCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzVDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3JELENBQUM7Q0FDRjtBQTduQ0Qsa0NBNm5DQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTGFtYmRhIFN0YWNrXG4gKlxuICogRGVwbG95cyBhbGwgYmFja2VuZCBzZXJ2aWNlIExhbWJkYSBmdW5jdGlvbnMgYW5kIHRoZWlyIElBTSBwb2xpY2llcy5cbiAqIEFQSSBHYXRld2F5IHJvdXRlcyAgIOKGkiBhcGktZ2F0ZXdheS1zdGFjay50cyAoYWRkQXBpUm91dGVzKVxuICogQUxCIHRhcmdldCBncm91cHMgICAg4oaSIGFsYi1zdGFjay50cyAgICAgICAgICAoYWRkVGFyZ2V0R3JvdXBzKVxuICogRXZlbnRCcmlkZ2UgdGFyZ2V0cyAg4oaSIGFwcC50cyAgICAgICAgICAgICAgICAod2lyZUV2ZW50QnJpZGdlVGFyZ2V0cylcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50cyc7XG5pbXBvcnQgeyBOb2RlanNMYW1iZGEgfSBmcm9tICcuLi9jb25zdHJ1Y3RzL25vZGVqcy1sYW1iZGEnO1xuaW1wb3J0IHsgUHl0aG9uTGFtYmRhIH0gZnJvbSAnLi4vY29uc3RydWN0cy9weXRob24tbGFtYmRhJztcbmltcG9ydCB7IFNxc0V2ZW50U291cmNlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzJztcblxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuICB2cGM6IGVjMi5WcGM7XG4gIGxhbWJkYVNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBhdXJvcmFTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XG4gIHJlZGlzRW5kcG9pbnQ6IHN0cmluZztcbiAgLyoqIFNRUyBxdWV1ZSBBUk4g4oCUIHBhc3MgYXMgYSBjb25zdHJ1Y3RlZCBzdHJpbmcgdG8gYXZvaWQgY3ljbGljIENGTiBjcm9zcy1zdGFjayByZWZzICovXG4gIHN1bW1hcml6YXRpb25RdWV1ZUFybjogc3RyaW5nO1xuICAvKiogU1FTIHF1ZXVlIEFSTiDigJQgcGFzcyBhcyBhIGNvbnN0cnVjdGVkIHN0cmluZyB0byBhdm9pZCBjeWNsaWMgQ0ZOIGNyb3NzLXN0YWNrIHJlZnMgKi9cbiAgaW5zaWdodHNRdWV1ZUFybjogc3RyaW5nO1xuICAvKiogRXZlbnRCcmlkZ2UgZGVmYXVsdCBidXMgQVJOIOKAlCBwYXNzIGFzIGEgY29uc3RydWN0ZWQgc3RyaW5nICovXG4gIGV2ZW50QnVzQXJuOiBzdHJpbmc7XG4gIGNvbm5lY3Rpb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xufVxuXG5leHBvcnQgY2xhc3MgTGFtYmRhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAvLyBBdXRoIFNlcnZpY2VcbiAgcHVibGljIHJlYWRvbmx5IGxvZ2luRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHJlZ2lzdGVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGNyZWF0ZVN0dWRlbnRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgbGlzdFN0dWRlbnRzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0dWRlbnRMb2dpbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBkZWxldGVTdHVkZW50RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvLyBUZXN0IEVuZ2luZVxuICBwdWJsaWMgcmVhZG9ubHkgY3JlYXRlVGVzdEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBnZXRUZXN0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0YXJ0VGVzdFNlc3Npb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3VibWl0QW5zd2VyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGVuZFRlc3RTZXNzaW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGdldFRlc3RzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGdldFJlc3VsdHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0U3R1ZGVudFNlc3Npb25zRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0dWRlbnRJbnNpZ2h0c0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLy8gQ29udmVyc2F0aW9uIEVuZ2luZVxuICBwdWJsaWMgcmVhZG9ubHkgcGFyZW50Q2hhdENyZWF0ZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBwYXJlbnRDaGF0U2VuZEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBwYXJlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBwYXJlbnRDaGF0R2V0TWVzc2FnZXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgcGFyZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3R1ZGVudENoYXRDcmVhdGVGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3R1ZGVudENoYXRTZW5kRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0dWRlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzdHVkZW50Q2hhdEdldE1lc3NhZ2VzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0dWRlbnRDaGF0RW5kU2Vzc2lvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLy8gV2ViU29ja2V0XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzb2NrZXRDb25uZWN0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldERpc2Nvbm5lY3RGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgdGltZXJTeW5jRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvLyBQcm9maWxlIEVuZ2luZVxuICBwdWJsaWMgcmVhZG9ubHkgY2FsY3VsYXRlUHJvZmlsZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBlcnJvclBhdHRlcm5zQWdncmVnYXRlRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGVycm9yUGF0dGVybnNUcmVuZHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8vIEJhY2tncm91bmQgSm9ic1xuICBwdWJsaWMgcmVhZG9ubHkgc3VtbWFyaXphdGlvbldvcmtlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBpbnNpZ2h0c1dvcmtlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLy8gQWRtaW4gU2VydmljZVxuICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5DcmVhdGVRdWVzdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pblVwZGF0ZVF1ZXN0aW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluRGVsZXRlUXVlc3Rpb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5MaXN0UXVlc3Rpb25zRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluSW1wb3J0UXVlc3Rpb25zRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluRXhwb3J0UXVlc3Rpb25zRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluU3lzdGVtTWV0cmljc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pblN0dWRlbnRBbmFseXRpY3NGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5TeXN0ZW1Db25maWdGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8vIFN0YWdlIFJlZ2lzdHJ5XG4gIHB1YmxpYyByZWFkb25seSBsaXN0U3RhZ2VzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGdldFN0YWdlRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGdldFNraWxsVGF4b25vbXlGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0U2tpbGxCcmlkZ2VzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGxpc3RTdHVkZW50U3RhZ2VzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFjdGl2YXRlU3R1ZGVudFN0YWdlRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcblxuICAvLyBDb250ZXN0IFNlcnZpY2VcbiAgcHVibGljIHJlYWRvbmx5IGxpc3RDb250ZXN0c0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSByZWdpc3RlckNvbnRlc3RGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3VibWl0Q29udGVzdFJlc3VsdEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBnZXRDb250ZXN0UmVzdWx0c0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pbkNyZWF0ZUNvbnRlc3RTZXJpZXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5DcmVhdGVDb250ZXN0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluVXBkYXRlQ29udGVzdFN0YXR1c0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pbkZpbmFsaXplQ29udGVzdFJlc3VsdHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBMYW1iZGFTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7XG4gICAgICBjb25maWcsXG4gICAgICB2cGMsXG4gICAgICBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHN1bW1hcml6YXRpb25RdWV1ZUFybixcbiAgICAgIGluc2lnaHRzUXVldWVBcm4sXG4gICAgICBldmVudEJ1c0FybixcbiAgICAgIGNvbm5lY3Rpb25zVGFibGUsXG4gICAgfSA9IHByb3BzO1xuXG4gICAgY29uc3QgYmVkcm9ja01vZGVsSWQgPSAndXMuYW50aHJvcGljLmNsYXVkZS1zb25uZXQtNC0yMDI1MDUxNC12MTowJztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDAuIEFVVEggU0VSVklDRSAoTm9kZS5qcylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMubG9naW5GdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0xvZ2luTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1sb2dpbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvbG9naW4uaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9hdXRoLXNlcnZpY2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdVc2VyIGxvZ2luJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5yZWdpc3RlckZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnUmVnaXN0ZXJMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXJlZ2lzdGVyLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9yZWdpc3Rlci5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2F1dGgtc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgcmVnaXN0cmF0aW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5jcmVhdGVTdHVkZW50RnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdDcmVhdGVTdHVkZW50TGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1jcmVhdGUtc3R1ZGVudC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvY3JlYXRlLXN0dWRlbnQuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9hdXRoLXNlcnZpY2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXJlbnQgY3JlYXRlcyBzdHVkZW50IGFjY291bnQnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmxpc3RTdHVkZW50c0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnTGlzdFN0dWRlbnRzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1saXN0LXN0dWRlbnRzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9saXN0LXN0dWRlbnRzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYXV0aC1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGFyZW50IGxpc3RzIHN0dWRlbnQgcHJvZmlsZXMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLnN0dWRlbnRMb2dpbkZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnU3R1ZGVudExvZ2luTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zdHVkZW50LWxvZ2luLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdHVkZW50LWxvZ2luLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYXV0aC1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3R1ZGVudCBsb2dpbiBieSB1c2VybmFtZScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuZGVsZXRlU3R1ZGVudEZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnRGVsZXRlU3R1ZGVudExhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtZGVsZXRlLXN0dWRlbnQtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2RlbGV0ZS1zdHVkZW50LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYXV0aC1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGFyZW50IGRlbGV0ZXMgc3R1ZGVudCBwcm9maWxlJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMS4gVEVTVCBFTkdJTkUgU0VSVklDRSAoTm9kZS5qcylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMuY3JlYXRlVGVzdEZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQ3JlYXRlVGVzdExhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtY3JlYXRlLXRlc3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2NyZWF0ZS10ZXN0LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgYSBuZXcgdGVzdCcsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuZ2V0VGVzdEZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnR2V0VGVzdExhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtZ2V0LXRlc3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2dldC10ZXN0LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgdGVzdCBkZXRhaWxzJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5zdGFydFRlc3RTZXNzaW9uRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdTdGFydFRlc3RTZXNzaW9uTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zdGFydC10ZXN0LXNlc3Npb24tJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3N0YXJ0LXRlc3Qtc2Vzc2lvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL3Rlc3QtZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3RhcnQgYSB0ZXN0IHNlc3Npb24nLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLnN1Ym1pdEFuc3dlckZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnU3VibWl0QW5zd2VyTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zdWJtaXQtYW5zd2VyLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdWJtaXQtYW5zd2VyLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdTdWJtaXQgYW4gYW5zd2VyJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5lbmRUZXN0U2Vzc2lvbkZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnRW5kVGVzdFNlc3Npb25MYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWVuZC10ZXN0LXNlc3Npb24tJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2VuZC10ZXN0LXNlc3Npb24uaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy90ZXN0LWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuZCBhIHRlc3Qgc2Vzc2lvbicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuZ2V0VGVzdHNGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0dldFRlc3RzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1nZXQtdGVzdHMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2dldC10ZXN0cy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL3Rlc3QtZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBhdmFpbGFibGUgdGVzdHMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmdldFJlc3VsdHNGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0dldFJlc3VsdHNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWdldC1yZXN1bHRzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9nZXQtcmVzdWx0cy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL3Rlc3QtZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHRlc3Qgc2Vzc2lvbiByZXN1bHRzJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5nZXRTdHVkZW50U2Vzc2lvbnNGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0dldFN0dWRlbnRTZXNzaW9uc0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtZ2V0LXN0dWRlbnQtc2Vzc2lvbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2dldC1zdHVkZW50LXNlc3Npb25zLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgYWxsIGNvbXBsZXRlZCB0ZXN0IHNlc3Npb25zIGZvciBhIHN0dWRlbnQnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLnN0dWRlbnRJbnNpZ2h0c0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnU3R1ZGVudEluc2lnaHRzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zdHVkZW50LWluc2lnaHRzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdHVkZW50LWluc2lnaHRzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdBSS1wb3dlcmVkIHBlci1zdWJqZWN0IHBlcmZvcm1hbmNlIGluc2lnaHRzIGZvciBhIHN0dWRlbnQnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBCRURST0NLX1JFR0lPTjogY2RrLkF3cy5SRUdJT04sXG4gICAgICAgIEJFRFJPQ0tfTU9ERUxfSUQ6IGJlZHJvY2tNb2RlbElkLFxuICAgICAgfSxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuc3R1ZGVudEluc2lnaHRzRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfTppbmZlcmVuY2UtcHJvZmlsZS8ke2JlZHJvY2tNb2RlbElkfWAsXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgRXZlbnRCcmlkZ2UgcGVybWlzc2lvbiB0byBpbnZva2Ugc3R1ZGVudEluc2lnaHRzIChEYWlseUluc2lnaHRzUnVsZSlcbiAgICB0aGlzLnN0dWRlbnRJbnNpZ2h0c0Z1bmN0aW9uLmFkZFBlcm1pc3Npb24oJ0FsbG93RXZlbnRCcmlkZ2VEYWlseUluc2lnaHRzJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2V2ZW50cy5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IGBhcm46YXdzOmV2ZW50czoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06cnVsZS9lZHVsZW5zLWRhaWx5LWluc2lnaHRzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBFdmVudEJyaWRnZSBwdWJsaXNoIGZvciB0ZXN0IGNvbXBsZXRpb25cbiAgICB0aGlzLmVuZFRlc3RTZXNzaW9uRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbZXZlbnRCdXNBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMi4gQ09OVkVSU0FUSU9OIEVOR0lORSBTRVJWSUNFIChOb2RlLmpzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3QgY29udmVyc2F0aW9uRW52aXJvbm1lbnQgPSB7XG4gICAgICBBSV9QUk9WSURFUjogJ2JlZHJvY2snLFxuICAgICAgQkVEUk9DS19SRUdJT046IGNkay5Bd3MuUkVHSU9OLFxuICAgICAgQkVEUk9DS19NT0RFTF9JRDogYmVkcm9ja01vZGVsSWQsXG4gICAgfTtcblxuICAgIHRoaXMucGFyZW50Q2hhdENyZWF0ZUZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnUGFyZW50Q2hhdENyZWF0ZUxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtcGFyZW50LWNoYXQtY3JlYXRlLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9wYXJlbnQtY2hhdC9jcmVhdGUtc2Vzc2lvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgcGFyZW50IGNoYXQgc2Vzc2lvbicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJzYXRpb25FbnZpcm9ubWVudCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMucGFyZW50Q2hhdENyZWF0ZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06aW5mZXJlbmNlLXByb2ZpbGUvJHtiZWRyb2NrTW9kZWxJZH1gLFxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMucGFyZW50Q2hhdFNlbmRGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1BhcmVudENoYXRTZW5kTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1wYXJlbnQtY2hhdC1zZW5kLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9wYXJlbnQtY2hhdC9zZW5kLW1lc3NhZ2UuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9jb252ZXJzYXRpb24tZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGFyZW50IGNoYXQgc2VuZCBtZXNzYWdlIChub24tc3RyZWFtaW5nKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJzYXRpb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLnBhcmVudENoYXRTZW5kRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfTppbmZlcmVuY2UtcHJvZmlsZS8ke2JlZHJvY2tNb2RlbElkfWAsXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5wYXJlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnUGFyZW50Q2hhdFNlbmRTdHJlYW1MYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXBhcmVudC1jaGF0LXNlbmQtc3RyZWFtLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9wYXJlbnQtY2hhdC9zZW5kLW1lc3NhZ2Utc3RyZWFtLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BhcmVudCBjaGF0IHNlbmQgbWVzc2FnZSAoU1NFIHN0cmVhbWluZyknLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICBlbnZpcm9ubWVudDogY29udmVyc2F0aW9uRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMjApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMucGFyZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCcsICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmluZmVyZW5jZS1wcm9maWxlLyR7YmVkcm9ja01vZGVsSWR9YCxcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnBhcmVudENoYXRHZXRNZXNzYWdlc0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnUGFyZW50Q2hhdEdldE1lc3NhZ2VzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1wYXJlbnQtY2hhdC1nZXQtbWVzc2FnZXMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3BhcmVudC1jaGF0L2dldC1tZXNzYWdlcy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgcGFyZW50IGNoYXQgbWVzc2FnZXMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLnBhcmVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdQYXJlbnRDaGF0RW5kU2Vzc2lvbkxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtcGFyZW50LWNoYXQtZW5kLXNlc3Npb24tJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3BhcmVudC1jaGF0L2VuZC1zZXNzaW9uLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuZCBwYXJlbnQgY2hhdCBzZXNzaW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5wYXJlbnRDaGF0RW5kU2Vzc2lvbkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICAgIHJlc291cmNlczogW2V2ZW50QnVzQXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuc3R1ZGVudENoYXRDcmVhdGVGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0dWRlbnRDaGF0Q3JlYXRlTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zdHVkZW50LWNoYXQtY3JlYXRlLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdHVkZW50LWNoYXQvY3JlYXRlLXNlc3Npb24uaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9jb252ZXJzYXRpb24tZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3JlYXRlIHN0dWRlbnQgY2hhdCBzZXNzaW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbnZlcnNhdGlvbkVudmlyb25tZW50LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5zdHVkZW50Q2hhdENyZWF0ZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06aW5mZXJlbmNlLXByb2ZpbGUvJHtiZWRyb2NrTW9kZWxJZH1gLFxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuc3R1ZGVudENoYXRTZW5kRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdTdHVkZW50Q2hhdFNlbmRMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtY2hhdC1zZW5kLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdHVkZW50LWNoYXQvc2VuZC1tZXNzYWdlLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0dWRlbnQgY2hhdCBzZW5kIG1lc3NhZ2UgKG5vbi1zdHJlYW1pbmcpJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbnZlcnNhdGlvbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuc3R1ZGVudENoYXRTZW5kRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfTppbmZlcmVuY2UtcHJvZmlsZS8ke2JlZHJvY2tNb2RlbElkfWAsXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5zdHVkZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0dWRlbnRDaGF0U2VuZFN0cmVhbUxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtc3R1ZGVudC1jaGF0LXNlbmQtc3RyZWFtLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdHVkZW50LWNoYXQvc2VuZC1tZXNzYWdlLXN0cmVhbS5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdTdHVkZW50IGNoYXQgc2VuZCBtZXNzYWdlIChTU0Ugc3RyZWFtaW5nKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJzYXRpb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEyMCksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5zdHVkZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCcsICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmluZmVyZW5jZS1wcm9maWxlLyR7YmVkcm9ja01vZGVsSWR9YCxcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICB0aGlzLnN0dWRlbnRDaGF0R2V0TWVzc2FnZXNGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0dWRlbnRDaGF0R2V0TWVzc2FnZXNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtY2hhdC1nZXQtbWVzc2FnZXMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3N0dWRlbnQtY2hhdC9nZXQtbWVzc2FnZXMuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9jb252ZXJzYXRpb24tZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHN0dWRlbnQgY2hhdCBtZXNzYWdlcycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuc3R1ZGVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdTdHVkZW50Q2hhdEVuZFNlc3Npb25MYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtY2hhdC1lbmQtc2Vzc2lvbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvc3R1ZGVudC1jaGF0L2VuZC1zZXNzaW9uLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuZCBzdHVkZW50IGNoYXQgc2Vzc2lvbicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuc3R1ZGVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2V2ZW50czpQdXRFdmVudHMnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbZXZlbnRCdXNBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gV2ViU29ja2V0IC0gQ29ubmVjdFxuICAgIHRoaXMud2Vic29ja2V0Q29ubmVjdEZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnV2Vic29ja2V0Q29ubmVjdExhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtd2Vic29ja2V0LWNvbm5lY3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3dlYnNvY2tldC9jb25uZWN0LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBjb25uZWN0IGhhbmRsZXInLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLndlYnNvY2tldENvbm5lY3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJywgJ2R5bmFtb2RiOlB1dEl0ZW0nLCAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLCAnZHluYW1vZGI6UXVlcnknLCAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW2Nvbm5lY3Rpb25zVGFibGUudGFibGVBcm4sIGAke2Nvbm5lY3Rpb25zVGFibGUudGFibGVBcm59L2luZGV4LypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IEFQSSBHYXRld2F5IHBlcm1pc3Npb24gdG8gaW52b2tlIFdlYlNvY2tldCBjb25uZWN0IGZ1bmN0aW9uXG4gICAgdGhpcy53ZWJzb2NrZXRDb25uZWN0RnVuY3Rpb24uYWRkUGVybWlzc2lvbignQWxsb3dBcGlHYXRld2F5V3NDb25uZWN0Jywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2FwaWdhdGV3YXkuYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiBgYXJuOmF3czpleGVjdXRlLWFwaToke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06Ki8ke2NvbmZpZy5zdGFnZX0vJGNvbm5lY3RgLFxuICAgIH0pO1xuXG4gICAgLy8gV2ViU29ja2V0IC0gRGlzY29ubmVjdFxuICAgIHRoaXMud2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnV2Vic29ja2V0RGlzY29ubmVjdExhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtd2Vic29ja2V0LWRpc2Nvbm5lY3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3dlYnNvY2tldC9kaXNjb25uZWN0LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBkaXNjb25uZWN0IGhhbmRsZXInLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLndlYnNvY2tldERpc2Nvbm5lY3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJywgJ2R5bmFtb2RiOlB1dEl0ZW0nLCAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLCAnZHluYW1vZGI6UXVlcnknLCAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW2Nvbm5lY3Rpb25zVGFibGUudGFibGVBcm4sIGAke2Nvbm5lY3Rpb25zVGFibGUudGFibGVBcm59L2luZGV4LypgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMud2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uLmFkZFBlcm1pc3Npb24oJ0FsbG93QXBpR2F0ZXdheVdzRGlzY29ubmVjdCcsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OiovJHtjb25maWcuc3RhZ2V9LyRkaXNjb25uZWN0YCxcbiAgICB9KTtcblxuICAgIC8vIFdlYlNvY2tldCAtIFRpbWVyIFN5bmNcbiAgICB0aGlzLnRpbWVyU3luY0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnVGltZXJTeW5jTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy10aW1lci1zeW5jLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy93ZWJzb2NrZXQvdGltZXItc3luYy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdUaW1lciBzeW5jIGJyb2FkY2FzdGVyIChldmVyeSAxIG1pbnV0ZSknLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLnRpbWVyU3luY0Z1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbJ2R5bmFtb2RiOkdldEl0ZW0nLCAnZHluYW1vZGI6UXVlcnknLCAnZHluYW1vZGI6U2NhbiddLFxuICAgICAgICByZXNvdXJjZXM6IFtjb25uZWN0aW9uc1RhYmxlLnRhYmxlQXJuLCBgJHtjb25uZWN0aW9uc1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBFdmVudEJyaWRnZSBwZXJtaXNzaW9uIHRvIGludm9rZSB0aW1lclN5bmMgKFRpbWVyU3luY1J1bGUpXG4gICAgdGhpcy50aW1lclN5bmNGdW5jdGlvbi5hZGRQZXJtaXNzaW9uKCdBbGxvd0V2ZW50QnJpZGdlVGltZXJTeW5jJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2V2ZW50cy5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IGBhcm46YXdzOmV2ZW50czoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06cnVsZS9lZHVsZW5zLXRpbWVyLXN5bmMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDMuIFBST0ZJTEUgRU5HSU5FIFNFUlZJQ0UgKFB5dGhvbilcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMuY2FsY3VsYXRlUHJvZmlsZUZ1bmN0aW9uID0gbmV3IFB5dGhvbkxhbWJkYSh0aGlzLCAnQ2FsY3VsYXRlUHJvZmlsZUxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtY2FsY3VsYXRlLXByb2ZpbGUtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdzcmMuaGFuZGxlcnMuY2FsY3VsYXRlX3Byb2ZpbGUuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9wcm9maWxlLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NhbGN1bGF0ZSBzdHVkZW50IGxlYXJuaW5nIHByb2ZpbGUgKEJheWVzaWFuKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIC8vIEdyYW50IEV2ZW50QnJpZGdlIHBlcm1pc3Npb24gdG8gaW52b2tlIGNhbGN1bGF0ZVByb2ZpbGUgKFRlc3RDb21wbGV0ZWRSdWxlKVxuICAgIHRoaXMuY2FsY3VsYXRlUHJvZmlsZUZ1bmN0aW9uLmFkZFBlcm1pc3Npb24oJ0FsbG93RXZlbnRCcmlkZ2VUZXN0Q29tcGxldGVkJywge1xuICAgICAgcHJpbmNpcGFsOiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2V2ZW50cy5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IGBhcm46YXdzOmV2ZW50czoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06cnVsZS9lZHVsZW5zLXRlc3QtY29tcGxldGVkLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG5cbiAgICB0aGlzLmVycm9yUGF0dGVybnNBZ2dyZWdhdGVGdW5jdGlvbiA9IG5ldyBQeXRob25MYW1iZGEodGhpcywgJ0Vycm9yUGF0dGVybnNBZ2dyZWdhdGVMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWVycm9yLXBhdHRlcm5zLWFnZ3JlZ2F0ZS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ3NyYy5oYW5kbGVycy5nZXRfZXJyb3JfcGF0dGVybnNfYWdncmVnYXRlLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvcHJvZmlsZS1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgYWdncmVnYXRlZCBlcnJvciBwYXR0ZXJuIGFuYWx5c2lzIGZvciBhIHN0dWRlbnQnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmVycm9yUGF0dGVybnNUcmVuZHNGdW5jdGlvbiA9IG5ldyBQeXRob25MYW1iZGEodGhpcywgJ0Vycm9yUGF0dGVybnNUcmVuZHNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWVycm9yLXBhdHRlcm5zLXRyZW5kcy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ3NyYy5oYW5kbGVycy5nZXRfZXJyb3JfcGF0dGVybnNfdHJlbmRzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvcHJvZmlsZS1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgZXJyb3IgcGF0dGVybiB0cmVuZHMgb3ZlciB0aW1lIGZvciBhIHN0dWRlbnQnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA0LiBCQUNLR1JPVU5EIEpPQlMgU0VSVklDRSAoUHl0aG9uKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3QgYmFja2dyb3VuZEpvYnNFbnZpcm9ubWVudCA9IHtcbiAgICAgIEFJX1BST1ZJREVSOiAnYmVkcm9jaycsXG4gICAgfTtcblxuICAgIHRoaXMuc3VtbWFyaXphdGlvbldvcmtlckZ1bmN0aW9uID0gbmV3IFB5dGhvbkxhbWJkYSh0aGlzLCAnU3VtbWFyaXphdGlvbldvcmtlckxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtc3VtbWFyaXphdGlvbi13b3JrZXItJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdzcmMuaGFuZGxlcnMuc3VtbWFyaXphdGlvbl93b3JrZXIuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9iYWNrZ3JvdW5kLWpvYnMnLFxuICAgICAgZGVzY3JpcHRpb246ICdDb252ZXJzYXRpb24gc3VtbWFyaXphdGlvbiB3b3JrZXInLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICBlbnZpcm9ubWVudDogYmFja2dyb3VuZEpvYnNFbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5zdW1tYXJpemF0aW9uV29ya2VyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfTppbmZlcmVuY2UtcHJvZmlsZS8ke2JlZHJvY2tNb2RlbElkfWAsXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gU1FTIHRyaWdnZXIgKENmbkV2ZW50U291cmNlTWFwcGluZyBhdm9pZHMgY3Jvc3Mtc3RhY2sgY2lyY3VsYXIgcmVmcylcbiAgICBuZXcgbGFtYmRhLkNmbkV2ZW50U291cmNlTWFwcGluZyh0aGlzLCAnU3VtbWFyaXphdGlvblF1ZXVlVHJpZ2dlcicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogdGhpcy5zdW1tYXJpemF0aW9uV29ya2VyRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZXZlbnRTb3VyY2VBcm46IHN1bW1hcml6YXRpb25RdWV1ZUFybixcbiAgICAgIGJhdGNoU2l6ZTogMSxcbiAgICAgIG1heGltdW1CYXRjaGluZ1dpbmRvd0luU2Vjb25kczogMTAsXG4gICAgfSk7XG5cbiAgICB0aGlzLnN1bW1hcml6YXRpb25Xb3JrZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogWydzcXM6UmVjZWl2ZU1lc3NhZ2UnLCAnc3FzOkRlbGV0ZU1lc3NhZ2UnLCAnc3FzOkdldFF1ZXVlQXR0cmlidXRlcyddLFxuICAgICAgICByZXNvdXJjZXM6IFtzdW1tYXJpemF0aW9uUXVldWVBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgdGhpcy5pbnNpZ2h0c1dvcmtlckZ1bmN0aW9uID0gbmV3IFB5dGhvbkxhbWJkYSh0aGlzLCAnSW5zaWdodHNXb3JrZXJMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWluc2lnaHRzLXdvcmtlci0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ3NyYy5oYW5kbGVycy5pbnNpZ2h0c193b3JrZXIuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9iYWNrZ3JvdW5kLWpvYnMnLFxuICAgICAgZGVzY3JpcHRpb246ICdJbnNpZ2h0cyBleHRyYWN0aW9uIHdvcmtlcicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBiYWNrZ3JvdW5kSm9ic0Vudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuaW5zaWdodHNXb3JrZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCcsICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmluZmVyZW5jZS1wcm9maWxlLyR7YmVkcm9ja01vZGVsSWR9YCxcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBuZXcgbGFtYmRhLkNmbkV2ZW50U291cmNlTWFwcGluZyh0aGlzLCAnSW5zaWdodHNRdWV1ZVRyaWdnZXInLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IHRoaXMuaW5zaWdodHNXb3JrZXJGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBldmVudFNvdXJjZUFybjogaW5zaWdodHNRdWV1ZUFybixcbiAgICAgIGJhdGNoU2l6ZTogMSxcbiAgICAgIG1heGltdW1CYXRjaGluZ1dpbmRvd0luU2Vjb25kczogMzAsXG4gICAgfSk7XG5cbiAgICB0aGlzLmluc2lnaHRzV29ya2VyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFsnc3FzOlJlY2VpdmVNZXNzYWdlJywgJ3NxczpEZWxldGVNZXNzYWdlJywgJ3NxczpHZXRRdWV1ZUF0dHJpYnV0ZXMnXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbaW5zaWdodHNRdWV1ZUFybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA1LiBBRE1JTiBTRVJWSUNFIChOb2RlLmpzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdGhpcy5hZG1pbkNyZWF0ZVF1ZXN0aW9uRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pbkNyZWF0ZVF1ZXN0aW9uTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1hZG1pbi1jcmVhdGUtcXVlc3Rpb24tJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3F1ZXN0aW9ucy9jcmVhdGUtcXVlc3Rpb24uaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9hZG1pbi1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW46IENyZWF0ZSBxdWVzdGlvbicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuYWRtaW5VcGRhdGVRdWVzdGlvbkZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQWRtaW5VcGRhdGVRdWVzdGlvbkxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtYWRtaW4tdXBkYXRlLXF1ZXN0aW9uLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9xdWVzdGlvbnMvdXBkYXRlLXF1ZXN0aW9uLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYWRtaW4tc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBVcGRhdGUgcXVlc3Rpb24nLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmFkbWluRGVsZXRlUXVlc3Rpb25GdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0FkbWluRGVsZXRlUXVlc3Rpb25MYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLWRlbGV0ZS1xdWVzdGlvbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvcXVlc3Rpb25zL2RlbGV0ZS1xdWVzdGlvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2FkbWluLXNlcnZpY2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbjogRGVsZXRlIHF1ZXN0aW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5hZG1pbkxpc3RRdWVzdGlvbnNGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0FkbWluTGlzdFF1ZXN0aW9uc0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtYWRtaW4tbGlzdC1xdWVzdGlvbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3F1ZXN0aW9ucy9saXN0LXF1ZXN0aW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2FkbWluLXNlcnZpY2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbjogTGlzdCBxdWVzdGlvbnMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmFkbWluSW1wb3J0UXVlc3Rpb25zRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pbkltcG9ydFF1ZXN0aW9uc0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtYWRtaW4taW1wb3J0LXF1ZXN0aW9ucy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvYnVsay1vcGVyYXRpb25zL2ltcG9ydC1xdWVzdGlvbnMuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9hZG1pbi1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW46IEltcG9ydCBxdWVzdGlvbnMgKGJ1bGspJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5hZG1pbkV4cG9ydFF1ZXN0aW9uc0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQWRtaW5FeHBvcnRRdWVzdGlvbnNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLWV4cG9ydC1xdWVzdGlvbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2J1bGstb3BlcmF0aW9ucy9leHBvcnQtcXVlc3Rpb25zLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYWRtaW4tc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBFeHBvcnQgcXVlc3Rpb25zIChidWxrKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuYWRtaW5TeXN0ZW1NZXRyaWNzRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pblN5c3RlbU1ldHJpY3NMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLXN5c3RlbS1tZXRyaWNzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9hbmFseXRpY3Mvc3lzdGVtLW1ldHJpY3MuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9hZG1pbi1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW46IFN5c3RlbS13aWRlIG1ldHJpY3MnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmFkbWluU3R1ZGVudEFuYWx5dGljc0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQWRtaW5TdHVkZW50QW5hbHl0aWNzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1hZG1pbi1zdHVkZW50LWFuYWx5dGljcy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvYW5hbHl0aWNzL3N0dWRlbnQtYW5hbHl0aWNzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYWRtaW4tc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBTdHVkZW50IGFuYWx5dGljcycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuYWRtaW5TeXN0ZW1Db25maWdGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0FkbWluU3lzdGVtQ29uZmlnTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zeXN0ZW0tY29uZmlnLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zeXN0ZW0tY29uZmlnLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbjogR2V0L3VwZGF0ZSBzeXN0ZW0gY29uZmlnIHRocmVzaG9sZHMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA2LiBTVEFHRSBSRUdJU1RSWSBTRVJWSUNFIChOb2RlLmpzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3Qgc3RhZ2VSZWdpc3RyeVBhdGggPSAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL3N0YWdlLXJlZ2lzdHJ5JztcblxuICAgIHRoaXMubGlzdFN0YWdlc0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnTGlzdFN0YWdlc0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtbGlzdC1zdGFnZXMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2xpc3Qtc3RhZ2VzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6IHN0YWdlUmVnaXN0cnlQYXRoLFxuICAgICAgZGVzY3JpcHRpb246ICdMaXN0IGFsbCBhY3RpdmUgc3RhZ2VzJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5nZXRTdGFnZUZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnR2V0U3RhZ2VMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWdldC1zdGFnZS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvZ2V0LXN0YWdlLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6IHN0YWdlUmVnaXN0cnlQYXRoLFxuICAgICAgZGVzY3JpcHRpb246ICdHZXQgc3RhZ2UgZGV0YWlscycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuZ2V0U2tpbGxUYXhvbm9teUZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnR2V0U2tpbGxUYXhvbm9teUxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtZ2V0LXNraWxsLXRheG9ub215LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9nZXQtc2tpbGwtdGF4b25vbXkuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogc3RhZ2VSZWdpc3RyeVBhdGgsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBzdGFnZSBza2lsbCB0YXhvbm9teScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuZ2V0U2tpbGxCcmlkZ2VzRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdHZXRTa2lsbEJyaWRnZXNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWdldC1za2lsbC1icmlkZ2VzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9nZXQtc2tpbGwtYnJpZGdlcy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiBzdGFnZVJlZ2lzdHJ5UGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHNraWxsIGJyaWRnZXMgYmV0d2VlbiBzdGFnZXMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmxpc3RTdHVkZW50U3RhZ2VzRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdMaXN0U3R1ZGVudFN0YWdlc0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtbGlzdC1zdHVkZW50LXN0YWdlcy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvbGlzdC1zdHVkZW50LXN0YWdlcy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiBzdGFnZVJlZ2lzdHJ5UGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBzdHVkZW50IHN0YWdlIGVucm9sbG1lbnRzJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pLmZ1bmN0aW9uO1xuXG4gICAgdGhpcy5hY3RpdmF0ZVN0dWRlbnRTdGFnZUZ1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQWN0aXZhdGVTdHVkZW50U3RhZ2VMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFjdGl2YXRlLXN0dWRlbnQtc3RhZ2UtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2FjdGl2YXRlLXN0dWRlbnQtc3RhZ2UuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogc3RhZ2VSZWdpc3RyeVBhdGgsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Vucm9sbCBzdHVkZW50IGluIGEgc3RhZ2UnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA3LiBDT05URVNUIFNFUlZJQ0UgKE5vZGUuanMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCBjb250ZXN0U2VydmljZVBhdGggPSAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnRlc3Qtc2VydmljZSc7XG5cbiAgICB0aGlzLmxpc3RDb250ZXN0c0Z1bmN0aW9uID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnTGlzdENvbnRlc3RzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1saXN0LWNvbnRlc3RzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9saXN0LWNvbnRlc3RzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6IGNvbnRlc3RTZXJ2aWNlUGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBjb250ZXN0cycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMucmVnaXN0ZXJDb250ZXN0RnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdSZWdpc3RlckNvbnRlc3RMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXJlZ2lzdGVyLWNvbnRlc3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3JlZ2lzdGVyLWNvbnRlc3QuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogY29udGVzdFNlcnZpY2VQYXRoLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWdpc3RlciBzdHVkZW50IGZvciBhIGNvbnRlc3QnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLnN1Ym1pdENvbnRlc3RSZXN1bHRGdW5jdGlvbiA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N1Ym1pdENvbnRlc3RSZXN1bHRMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN1Ym1pdC1jb250ZXN0LXJlc3VsdC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvc3VibWl0LWNvbnRlc3QtcmVzdWx0LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6IGNvbnRlc3RTZXJ2aWNlUGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3VibWl0IGNvbnRlc3QgdGVzdCByZXN1bHQnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSkuZnVuY3Rpb247XG5cbiAgICB0aGlzLmdldENvbnRlc3RSZXN1bHRzRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdHZXRDb250ZXN0UmVzdWx0c0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtZ2V0LWNvbnRlc3QtcmVzdWx0cy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvZ2V0LWNvbnRlc3QtcmVzdWx0cy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiBjb250ZXN0U2VydmljZVBhdGgsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCBzdHVkZW50IGNvbnRlc3QgcmVzdWx0cycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuYWRtaW5DcmVhdGVDb250ZXN0U2VyaWVzRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pbkNyZWF0ZUNvbnRlc3RTZXJpZXNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLWNyZWF0ZS1jb250ZXN0LXNlcmllcy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvYWRtaW4vY3JlYXRlLWNvbnRlc3Qtc2VyaWVzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6IGNvbnRlc3RTZXJ2aWNlUGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW46IENyZWF0ZSBjb250ZXN0IHNlcmllcycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuYWRtaW5DcmVhdGVDb250ZXN0RnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pbkNyZWF0ZUNvbnRlc3RMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLWNyZWF0ZS1jb250ZXN0LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9hZG1pbi9jcmVhdGUtY29udGVzdC5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiBjb250ZXN0U2VydmljZVBhdGgsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBDcmVhdGUgY29udGVzdCcsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuYWRtaW5VcGRhdGVDb250ZXN0U3RhdHVzRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pblVwZGF0ZUNvbnRlc3RTdGF0dXNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLXVwZGF0ZS1jb250ZXN0LXN0YXR1cy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvYWRtaW4vdXBkYXRlLWNvbnRlc3Qtc3RhdHVzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6IGNvbnRlc3RTZXJ2aWNlUGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW46IFVwZGF0ZSBjb250ZXN0IHN0YXR1cycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIHRoaXMuYWRtaW5GaW5hbGl6ZUNvbnRlc3RSZXN1bHRzRnVuY3Rpb24gPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pbkZpbmFsaXplQ29udGVzdFJlc3VsdHNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLWZpbmFsaXplLWNvbnRlc3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2FkbWluL2ZpbmFsaXplLWNvbnRlc3QtcmVzdWx0cy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiBjb250ZXN0U2VydmljZVBhdGgsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBGaW5hbGl6ZSBjb250ZXN0IHJlc3VsdHMgYW5kIGNhbGN1bGF0ZSBwZXJjZW50aWxlcycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICB9KS5mdW5jdGlvbjtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDguIEdSQU5UIERBVEFCQVNFIFNFQ1JFVCBBQ0NFU1MgVE8gQUxMIEZVTkNUSU9OU1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3QgYWxsRnVuY3Rpb25zID0gW1xuICAgICAgdGhpcy5sb2dpbkZ1bmN0aW9uLFxuICAgICAgdGhpcy5yZWdpc3RlckZ1bmN0aW9uLFxuICAgICAgdGhpcy5jcmVhdGVTdHVkZW50RnVuY3Rpb24sXG4gICAgICB0aGlzLmxpc3RTdHVkZW50c0Z1bmN0aW9uLFxuICAgICAgdGhpcy5zdHVkZW50TG9naW5GdW5jdGlvbixcbiAgICAgIHRoaXMuZGVsZXRlU3R1ZGVudEZ1bmN0aW9uLFxuICAgICAgdGhpcy5jcmVhdGVUZXN0RnVuY3Rpb24sXG4gICAgICB0aGlzLmdldFRlc3RGdW5jdGlvbixcbiAgICAgIHRoaXMuZ2V0VGVzdHNGdW5jdGlvbixcbiAgICAgIHRoaXMuZ2V0UmVzdWx0c0Z1bmN0aW9uLFxuICAgICAgdGhpcy5nZXRTdHVkZW50U2Vzc2lvbnNGdW5jdGlvbixcbiAgICAgIHRoaXMuc3R1ZGVudEluc2lnaHRzRnVuY3Rpb24sXG4gICAgICB0aGlzLnN0YXJ0VGVzdFNlc3Npb25GdW5jdGlvbixcbiAgICAgIHRoaXMuc3VibWl0QW5zd2VyRnVuY3Rpb24sXG4gICAgICB0aGlzLmVuZFRlc3RTZXNzaW9uRnVuY3Rpb24sXG4gICAgICB0aGlzLnBhcmVudENoYXRDcmVhdGVGdW5jdGlvbixcbiAgICAgIHRoaXMucGFyZW50Q2hhdFNlbmRGdW5jdGlvbixcbiAgICAgIHRoaXMucGFyZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbixcbiAgICAgIHRoaXMucGFyZW50Q2hhdEdldE1lc3NhZ2VzRnVuY3Rpb24sXG4gICAgICB0aGlzLnBhcmVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb24sXG4gICAgICB0aGlzLnN0dWRlbnRDaGF0Q3JlYXRlRnVuY3Rpb24sXG4gICAgICB0aGlzLnN0dWRlbnRDaGF0U2VuZEZ1bmN0aW9uLFxuICAgICAgdGhpcy5zdHVkZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbixcbiAgICAgIHRoaXMuc3R1ZGVudENoYXRHZXRNZXNzYWdlc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5zdHVkZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbixcbiAgICAgIHRoaXMud2Vic29ja2V0Q29ubmVjdEZ1bmN0aW9uLFxuICAgICAgdGhpcy53ZWJzb2NrZXREaXNjb25uZWN0RnVuY3Rpb24sXG4gICAgICB0aGlzLnRpbWVyU3luY0Z1bmN0aW9uLFxuICAgICAgdGhpcy5jYWxjdWxhdGVQcm9maWxlRnVuY3Rpb24sXG4gICAgICB0aGlzLmVycm9yUGF0dGVybnNBZ2dyZWdhdGVGdW5jdGlvbixcbiAgICAgIHRoaXMuZXJyb3JQYXR0ZXJuc1RyZW5kc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5zdW1tYXJpemF0aW9uV29ya2VyRnVuY3Rpb24sXG4gICAgICB0aGlzLmluc2lnaHRzV29ya2VyRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluQ3JlYXRlUXVlc3Rpb25GdW5jdGlvbixcbiAgICAgIHRoaXMuYWRtaW5VcGRhdGVRdWVzdGlvbkZ1bmN0aW9uLFxuICAgICAgdGhpcy5hZG1pbkRlbGV0ZVF1ZXN0aW9uRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluTGlzdFF1ZXN0aW9uc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5hZG1pbkltcG9ydFF1ZXN0aW9uc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5hZG1pbkV4cG9ydFF1ZXN0aW9uc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5hZG1pblN5c3RlbU1ldHJpY3NGdW5jdGlvbixcbiAgICAgIHRoaXMuYWRtaW5TdHVkZW50QW5hbHl0aWNzRnVuY3Rpb24sXG4gICAgICAvLyBTdGFnZSBSZWdpc3RyeVxuICAgICAgdGhpcy5saXN0U3RhZ2VzRnVuY3Rpb24sXG4gICAgICB0aGlzLmdldFN0YWdlRnVuY3Rpb24sXG4gICAgICB0aGlzLmdldFNraWxsVGF4b25vbXlGdW5jdGlvbixcbiAgICAgIHRoaXMuZ2V0U2tpbGxCcmlkZ2VzRnVuY3Rpb24sXG4gICAgICB0aGlzLmxpc3RTdHVkZW50U3RhZ2VzRnVuY3Rpb24sXG4gICAgICB0aGlzLmFjdGl2YXRlU3R1ZGVudFN0YWdlRnVuY3Rpb24sXG4gICAgICAvLyBDb250ZXN0IFNlcnZpY2VcbiAgICAgIHRoaXMubGlzdENvbnRlc3RzRnVuY3Rpb24sXG4gICAgICB0aGlzLnJlZ2lzdGVyQ29udGVzdEZ1bmN0aW9uLFxuICAgICAgdGhpcy5zdWJtaXRDb250ZXN0UmVzdWx0RnVuY3Rpb24sXG4gICAgICB0aGlzLmdldENvbnRlc3RSZXN1bHRzRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluQ3JlYXRlQ29udGVzdFNlcmllc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5hZG1pbkNyZWF0ZUNvbnRlc3RGdW5jdGlvbixcbiAgICAgIHRoaXMuYWRtaW5VcGRhdGVDb250ZXN0U3RhdHVzRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluRmluYWxpemVDb250ZXN0UmVzdWx0c0Z1bmN0aW9uLFxuICAgIF07XG5cbiAgICBjb25zdCBzZWNyZXRSZWFkUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogWydzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsICdzZWNyZXRzbWFuYWdlcjpEZXNjcmliZVNlY3JldCddLFxuICAgICAgcmVzb3VyY2VzOiBbYXVyb3JhU2VjcmV0LnNlY3JldEFybl0sXG4gICAgfSk7XG5cbiAgICBhbGxGdW5jdGlvbnMuZm9yRWFjaCgoZm4pID0+IGZuLmFkZFRvUm9sZVBvbGljeShzZWNyZXRSZWFkUG9saWN5KSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA5LiBPVVRQVVRTXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTGFtYmRhRnVuY3Rpb25zRGVwbG95ZWQnLCB7XG4gICAgICB2YWx1ZTogJzUyIGZ1bmN0aW9ucyBkZXBsb3llZCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ051bWJlciBvZiBMYW1iZGEgZnVuY3Rpb25zIGRlcGxveWVkJyxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU2VydmljZScsICdlZHVsZW5zJyk7XG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdFbnZpcm9ubWVudCcsIGNvbmZpZy5zdGFnZSk7XG4gIH1cbn1cbiJdfQ==