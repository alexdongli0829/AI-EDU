"use strict";
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
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const elbv2_targets = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const nodejs_lambda_1 = require("../constructs/nodejs-lambda");
const python_lambda_1 = require("../constructs/python-lambda");
class LambdaStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config, vpc, lambdaSecurityGroup, auroraSecret, redisEndpoint, restApi, 
        // websocketApi, // Removed to avoid cyclic dependency
        alb, httpListener, summarizationQueueArn, insightsQueueArn, eventBus, connectionsTable, testCompletedRuleName, timerSyncRuleName, } = props;
        // AWS Bedrock will be used instead of Anthropic API
        // IAM permissions will be granted to invoke Bedrock models
        // ============================================================
        // 0. AUTH SERVICE (Node.js)
        // ============================================================
        // Login
        const loginLambda = new nodejs_lambda_1.NodejsLambda(this, 'LoginLambda', {
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
        const registerLambda = new nodejs_lambda_1.NodejsLambda(this, 'RegisterLambda', {
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
        const createStudentLambda = new nodejs_lambda_1.NodejsLambda(this, 'CreateStudentLambda', {
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
        const listStudentsLambda = new nodejs_lambda_1.NodejsLambda(this, 'ListStudentsLambda', {
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
        const studentLoginLambda = new nodejs_lambda_1.NodejsLambda(this, 'StudentLoginLambda', {
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
        const deleteStudentLambda = new nodejs_lambda_1.NodejsLambda(this, 'DeleteStudentLambda', {
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
        const createTestLambda = new nodejs_lambda_1.NodejsLambda(this, 'CreateTestLambda', {
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
        const getTestLambda = new nodejs_lambda_1.NodejsLambda(this, 'GetTestLambda', {
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
        const startTestSessionLambda = new nodejs_lambda_1.NodejsLambda(this, 'StartTestSessionLambda', {
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
        const submitAnswerLambda = new nodejs_lambda_1.NodejsLambda(this, 'SubmitAnswerLambda', {
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
        const endTestSessionLambda = new nodejs_lambda_1.NodejsLambda(this, 'EndTestSessionLambda', {
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
        const getTestsLambda = new nodejs_lambda_1.NodejsLambda(this, 'GetTestsLambda', {
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
        const getResultsLambda = new nodejs_lambda_1.NodejsLambda(this, 'GetResultsLambda', {
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
        // Grant EventBridge publish permissions
        this.endTestSessionFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [eventBus.eventBusArn],
        }));
        // ============================================================
        // 2. CONVERSATION ENGINE SERVICE (Node.js)
        // ============================================================
        const bedrockModelId = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
        const conversationEnvironment = {
            AI_PROVIDER: 'bedrock',
            BEDROCK_REGION: cdk.Aws.REGION,
            BEDROCK_MODEL_ID: bedrockModelId,
        };
        // Parent Chat - Create Session
        const parentChatCreateLambda = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatCreateLambda', {
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
        this.parentChatCreateFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Parent Chat - Send Message (non-streaming JSON response via API Gateway)
        const parentChatSendLambda = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatSendLambda', {
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
        this.parentChatSendFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Parent Chat - Send Message (SSE Stream)
        const parentChatSendStreamLambda = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatSendStreamLambda', {
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
        this.parentChatSendStreamFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Parent Chat - Get Messages
        const parentChatGetMessagesLambda = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatGetMessagesLambda', {
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
        const parentChatEndSessionLambda = new nodejs_lambda_1.NodejsLambda(this, 'ParentChatEndSessionLambda', {
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
        this.parentChatEndSessionFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [eventBus.eventBusArn],
        }));
        // Student Chat - Create Session
        const studentChatCreateLambda = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatCreateLambda', {
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
        this.studentChatCreateFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Student Chat - Send Message (non-streaming JSON response via API Gateway)
        const studentChatSendLambda = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatSendLambda', {
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
        this.studentChatSendFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Student Chat - Send Message (SSE Stream)
        const studentChatSendStreamLambda = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatSendStreamLambda', {
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
        this.studentChatSendStreamFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Student Chat - Get Messages
        const studentChatGetMessagesLambda = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatGetMessagesLambda', {
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
        const studentChatEndSessionLambda = new nodejs_lambda_1.NodejsLambda(this, 'StudentChatEndSessionLambda', {
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
        this.studentChatEndSessionFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['events:PutEvents'],
            resources: [eventBus.eventBusArn],
        }));
        // WebSocket - Connect
        const websocketConnectLambda = new nodejs_lambda_1.NodejsLambda(this, 'WebsocketConnectLambda', {
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
        this.websocketConnectFunction.addToRolePolicy(new iam.PolicyStatement({
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
        }));
        // WebSocket - Disconnect
        const websocketDisconnectLambda = new nodejs_lambda_1.NodejsLambda(this, 'WebsocketDisconnectLambda', {
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
        this.websocketDisconnectFunction.addToRolePolicy(new iam.PolicyStatement({
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
        }));
        // WebSocket - Timer Sync (EventBridge triggered)
        const timerSyncLambda = new nodejs_lambda_1.NodejsLambda(this, 'TimerSyncLambda', {
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
        this.timerSyncFunction.addToRolePolicy(new iam.PolicyStatement({
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
        }));
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
        const calculateProfileLambda = new python_lambda_1.PythonLambda(this, 'CalculateProfileLambda', {
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
        const summarizationWorkerLambda = new python_lambda_1.PythonLambda(this, 'SummarizationWorkerLambda', {
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
        this.summarizationWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Add SQS trigger using CfnEventSourceMapping to avoid cyclic dependency
        new lambda.CfnEventSourceMapping(this, 'SummarizationQueueTrigger', {
            functionName: this.summarizationWorkerFunction.functionName,
            eventSourceArn: summarizationQueueArn,
            batchSize: 1,
            maximumBatchingWindowInSeconds: 10,
        });
        // Grant permissions to read from the queue
        this.summarizationWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
            ],
            resources: [summarizationQueueArn],
        }));
        // Insights Worker
        const insightsWorkerLambda = new python_lambda_1.PythonLambda(this, 'InsightsWorkerLambda', {
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
        this.insightsWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: [
                `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:inference-profile/${bedrockModelId}`,
                `arn:aws:bedrock:*::foundation-model/*`,
            ],
        }));
        // Add SQS trigger using CfnEventSourceMapping to avoid cyclic dependency
        new lambda.CfnEventSourceMapping(this, 'InsightsQueueTrigger', {
            functionName: this.insightsWorkerFunction.functionName,
            eventSourceArn: insightsQueueArn,
            batchSize: 1,
            maximumBatchingWindowInSeconds: 30,
        });
        // Grant permissions to read from the queue
        this.insightsWorkerFunction.addToRolePolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
            ],
            resources: [insightsQueueArn],
        }));
        // ============================================================
        // 5. ADMIN SERVICE (Node.js)
        // ============================================================
        // Create Question
        const adminCreateQuestionLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminCreateQuestionLambda', {
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
        const adminUpdateQuestionLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminUpdateQuestionLambda', {
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
        const adminDeleteQuestionLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminDeleteQuestionLambda', {
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
        const adminListQuestionsLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminListQuestionsLambda', {
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
        const adminImportQuestionsLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminImportQuestionsLambda', {
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
        const adminExportQuestionsLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminExportQuestionsLambda', {
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
        const adminSystemMetricsLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminSystemMetricsLambda', {
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
        const adminStudentAnalyticsLambda = new nodejs_lambda_1.NodejsLambda(this, 'AdminStudentAnalyticsLambda', {
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
        this.websocketConnectFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
        this.websocketDisconnectFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
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
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7O0dBU0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsdUVBQXlEO0FBRXpELDhFQUFnRTtBQUNoRSw4RkFBZ0Y7QUFPaEYseURBQTJDO0FBRzNDLCtEQUEyRDtBQUMzRCwrREFBMkQ7QUFxQjNELE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBb0R4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFDSixNQUFNLEVBQ04sR0FBRyxFQUNILG1CQUFtQixFQUNuQixZQUFZLEVBQ1osYUFBYSxFQUNiLE9BQU87UUFDUCxzREFBc0Q7UUFDdEQsR0FBRyxFQUNILFlBQVksRUFDWixxQkFBcUIsRUFDckIsZ0JBQWdCLEVBQ2hCLFFBQVEsRUFDUixnQkFBZ0IsRUFDaEIscUJBQXFCLEVBQ3JCLGlCQUFpQixHQUNsQixHQUFHLEtBQUssQ0FBQztRQUVWLG9EQUFvRDtRQUNwRCwyREFBMkQ7UUFFM0QsK0RBQStEO1FBQy9ELDRCQUE0QjtRQUM1QiwrREFBK0Q7UUFFL0QsUUFBUTtRQUNSLE1BQU0sV0FBVyxHQUFHLElBQUksNEJBQVksQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3hELE1BQU07WUFDTixZQUFZLEVBQUUsaUJBQWlCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDN0MsT0FBTyxFQUFFLDZCQUE2QjtZQUN0QyxRQUFRLEVBQUUsMENBQTBDO1lBQ3BELFdBQVcsRUFBRSxZQUFZO1lBQ3pCLEdBQUc7WUFDSCxhQUFhLEVBQUUsbUJBQW1CO1lBQ2xDLFlBQVk7WUFDWixhQUFhO1lB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akMsSUFBSSxDQUFDLDRCQUE0QjtZQUNqQyxJQUFJLENBQUMsMEJBQTBCO1lBQy9CLElBQUksQ0FBQyw2QkFBNkI7U0FDbkMsQ0FBQztRQUVGLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQy9DLE1BQU0sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDeEIsT0FBTyxFQUFFO2dCQUNQLCtCQUErQjtnQkFDL0IsK0JBQStCO2FBQ2hDO1lBQ0QsU0FBUyxFQUFFLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQztTQUNwQyxDQUFDLENBQUM7UUFFSCxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUU7WUFDMUIsRUFBRSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3ZDLENBQUMsQ0FBQyxDQUFDO1FBRUgsK0RBQStEO1FBQy9ELGNBQWM7UUFDZCwrREFBK0Q7UUFFL0QsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBRTtZQUNqRCxLQUFLLEVBQUUsb0NBQW9DO1lBQzNDLFdBQVcsRUFBRSxxQ0FBcUM7U0FDbkQsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDNUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDckQsQ0FBQztDQUNGO0FBMXBDRCxrQ0EwcENDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBMYW1iZGEgU3RhY2tcbiAqXG4gKiBEZXBsb3lzIGFsbCA2IGJhY2tlbmQgc2VydmljZXMgYXMgTGFtYmRhIGZ1bmN0aW9ucyBhbmQgd2lyZXMgdGhlbSB0bzpcbiAqIC0gQVBJIEdhdGV3YXkgKFJFU1QgZW5kcG9pbnRzKVxuICogLSBXZWJTb2NrZXQgQVBJIChyZWFsLXRpbWUgY29ubmVjdGlvbnMpXG4gKiAtIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXIgKFNTRSBzdHJlYW1pbmcpXG4gKiAtIFNRUyBRdWV1ZXMgKGFzeW5jIGpvYiBwcm9jZXNzaW5nKVxuICogLSBFdmVudEJyaWRnZSAoZXZlbnQtZHJpdmVuIHRyaWdnZXJzKVxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyJztcbmltcG9ydCAqIGFzIGVsYnYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lbGFzdGljbG9hZGJhbGFuY2luZ3YyJztcbmltcG9ydCAqIGFzIGVsYnYyX3RhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjItdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyBldmVudHNfdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50cyc7XG5pbXBvcnQgeyBOb2RlanNMYW1iZGEgfSBmcm9tICcuLi9jb25zdHJ1Y3RzL25vZGVqcy1sYW1iZGEnO1xuaW1wb3J0IHsgUHl0aG9uTGFtYmRhIH0gZnJvbSAnLi4vY29uc3RydWN0cy9weXRob24tbGFtYmRhJztcbmltcG9ydCB7IFNxc0V2ZW50U291cmNlIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ldmVudC1zb3VyY2VzJztcblxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuICB2cGM6IGVjMi5WcGM7XG4gIGxhbWJkYVNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBhdXJvcmFTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XG4gIHJlZGlzRW5kcG9pbnQ6IHN0cmluZztcbiAgcmVzdEFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICAvLyB3ZWJzb2NrZXRBcGk6IGFwaWdhdGV3YXl2Mi5DZm5BcGk7IC8vIFJlbW92ZWQgdG8gYXZvaWQgY3ljbGljIGRlcGVuZGVuY3lcbiAgYWxiOiBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcjtcbiAgaHR0cExpc3RlbmVyOiBlbGJ2Mi5BcHBsaWNhdGlvbkxpc3RlbmVyO1xuICBzdW1tYXJpemF0aW9uUXVldWVBcm46IHN0cmluZztcbiAgaW5zaWdodHNRdWV1ZUFybjogc3RyaW5nO1xuICBldmVudEJ1czogZXZlbnRzLklFdmVudEJ1cztcbiAgY29ubmVjdGlvbnNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHRlc3RDb21wbGV0ZWRSdWxlTmFtZTogc3RyaW5nO1xuICB0aW1lclN5bmNSdWxlTmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTGFtYmRhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAvLyBBdXRoIFNlcnZpY2UgZnVuY3Rpb25zXG4gIHB1YmxpYyByZWFkb25seSBsb2dpbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSByZWdpc3RlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBjcmVhdGVTdHVkZW50RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGxpc3RTdHVkZW50c0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzdHVkZW50TG9naW5GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZGVsZXRlU3R1ZGVudEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLy8gVGVzdCBFbmdpbmUgZnVuY3Rpb25zXG4gIHB1YmxpYyByZWFkb25seSBjcmVhdGVUZXN0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGdldFRlc3RGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3RhcnRUZXN0U2Vzc2lvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzdWJtaXRBbnN3ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZW5kVGVzdFNlc3Npb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0VGVzdHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0UmVzdWx0c0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLy8gQ29udmVyc2F0aW9uIEVuZ2luZSBmdW5jdGlvbnNcbiAgcHVibGljIHJlYWRvbmx5IHBhcmVudENoYXRDcmVhdGVGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgcGFyZW50Q2hhdFNlbmRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgcGFyZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgcGFyZW50Q2hhdEdldE1lc3NhZ2VzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHBhcmVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0dWRlbnRDaGF0Q3JlYXRlRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IHN0dWRlbnRDaGF0U2VuZEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzdHVkZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgc3R1ZGVudENoYXRHZXRNZXNzYWdlc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBzdHVkZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8vIFdlYlNvY2tldCBmdW5jdGlvbnNcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldENvbm5lY3RGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSB0aW1lclN5bmNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIC8vIFByb2ZpbGUgRW5naW5lIGZ1bmN0aW9uc1xuICBwdWJsaWMgcmVhZG9ubHkgY2FsY3VsYXRlUHJvZmlsZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLy8gQmFja2dyb3VuZCBKb2JzIGZ1bmN0aW9uc1xuICBwdWJsaWMgcmVhZG9ubHkgc3VtbWFyaXphdGlvbldvcmtlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBpbnNpZ2h0c1dvcmtlckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgLy8gQWRtaW4gU2VydmljZSBmdW5jdGlvbnNcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluQ3JlYXRlUXVlc3Rpb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5VcGRhdGVRdWVzdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pbkRlbGV0ZVF1ZXN0aW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluTGlzdFF1ZXN0aW9uc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pbkltcG9ydFF1ZXN0aW9uc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pbkV4cG9ydFF1ZXN0aW9uc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBhZG1pblN5c3RlbU1ldHJpY3NGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYWRtaW5TdHVkZW50QW5hbHl0aWNzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTGFtYmRhU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3Qge1xuICAgICAgY29uZmlnLFxuICAgICAgdnBjLFxuICAgICAgbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICByZXN0QXBpLFxuICAgICAgLy8gd2Vic29ja2V0QXBpLCAvLyBSZW1vdmVkIHRvIGF2b2lkIGN5Y2xpYyBkZXBlbmRlbmN5XG4gICAgICBhbGIsXG4gICAgICBodHRwTGlzdGVuZXIsXG4gICAgICBzdW1tYXJpemF0aW9uUXVldWVBcm4sXG4gICAgICBpbnNpZ2h0c1F1ZXVlQXJuLFxuICAgICAgZXZlbnRCdXMsXG4gICAgICBjb25uZWN0aW9uc1RhYmxlLFxuICAgICAgdGVzdENvbXBsZXRlZFJ1bGVOYW1lLFxuICAgICAgdGltZXJTeW5jUnVsZU5hbWUsXG4gICAgfSA9IHByb3BzO1xuXG4gICAgLy8gQVdTIEJlZHJvY2sgd2lsbCBiZSB1c2VkIGluc3RlYWQgb2YgQW50aHJvcGljIEFQSVxuICAgIC8vIElBTSBwZXJtaXNzaW9ucyB3aWxsIGJlIGdyYW50ZWQgdG8gaW52b2tlIEJlZHJvY2sgbW9kZWxzXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAwLiBBVVRIIFNFUlZJQ0UgKE5vZGUuanMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBMb2dpblxuICAgIGNvbnN0IGxvZ2luTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnTG9naW5MYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWxvZ2luLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9sb2dpbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2F1dGgtc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgbG9naW4nLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSk7XG4gICAgdGhpcy5sb2dpbkZ1bmN0aW9uID0gbG9naW5MYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBSZWdpc3RlclxuICAgIGNvbnN0IHJlZ2lzdGVyTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnUmVnaXN0ZXJMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXJlZ2lzdGVyLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9yZWdpc3Rlci5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2F1dGgtc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZXIgcmVnaXN0cmF0aW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuICAgIHRoaXMucmVnaXN0ZXJGdW5jdGlvbiA9IHJlZ2lzdGVyTGFtYmRhLmZ1bmN0aW9uO1xuXG4gICAgLy8gQ3JlYXRlIFN0dWRlbnQgKHBhcmVudCBjcmVhdGVzIGNoaWxkIGFjY291bnQpXG4gICAgY29uc3QgY3JlYXRlU3R1ZGVudExhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0NyZWF0ZVN0dWRlbnRMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWNyZWF0ZS1zdHVkZW50LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9jcmVhdGUtc3R1ZGVudC5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2F1dGgtc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BhcmVudCBjcmVhdGVzIHN0dWRlbnQgYWNjb3VudCcsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICB9KTtcbiAgICB0aGlzLmNyZWF0ZVN0dWRlbnRGdW5jdGlvbiA9IGNyZWF0ZVN0dWRlbnRMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBMaXN0IFN0dWRlbnRzIChwYXJlbnQgbGlzdHMgY2hpbGRyZW4pXG4gICAgY29uc3QgbGlzdFN0dWRlbnRzTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnTGlzdFN0dWRlbnRzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1saXN0LXN0dWRlbnRzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9saXN0LXN0dWRlbnRzLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYXV0aC1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGFyZW50IGxpc3RzIHN0dWRlbnQgcHJvZmlsZXMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSk7XG4gICAgdGhpcy5saXN0U3R1ZGVudHNGdW5jdGlvbiA9IGxpc3RTdHVkZW50c0xhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vIFN0dWRlbnQgTG9naW4gKHVzZXJuYW1lLWJhc2VkKVxuICAgIGNvbnN0IHN0dWRlbnRMb2dpbkxhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0dWRlbnRMb2dpbkxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtc3R1ZGVudC1sb2dpbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvc3R1ZGVudC1sb2dpbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2F1dGgtc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0dWRlbnQgbG9naW4gYnkgdXNlcm5hbWUnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSk7XG4gICAgdGhpcy5zdHVkZW50TG9naW5GdW5jdGlvbiA9IHN0dWRlbnRMb2dpbkxhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vIERlbGV0ZSBTdHVkZW50XG4gICAgY29uc3QgZGVsZXRlU3R1ZGVudExhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0RlbGV0ZVN0dWRlbnRMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWRlbGV0ZS1zdHVkZW50LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9kZWxldGUtc3R1ZGVudC5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2F1dGgtc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BhcmVudCBkZWxldGVzIHN0dWRlbnQgcHJvZmlsZScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICB9KTtcbiAgICB0aGlzLmRlbGV0ZVN0dWRlbnRGdW5jdGlvbiA9IGRlbGV0ZVN0dWRlbnRMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyAxLiBURVNUIEVOR0lORSBTRVJWSUNFIChOb2RlLmpzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gQ3JlYXRlIFRlc3RcbiAgICBjb25zdCBjcmVhdGVUZXN0TGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQ3JlYXRlVGVzdExhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtY3JlYXRlLXRlc3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2NyZWF0ZS10ZXN0LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgYSBuZXcgdGVzdCcsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KTtcbiAgICB0aGlzLmNyZWF0ZVRlc3RGdW5jdGlvbiA9IGNyZWF0ZVRlc3RMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHZXQgVGVzdFxuICAgIGNvbnN0IGdldFRlc3RMYW1iZGEgPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdHZXRUZXN0TGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1nZXQtdGVzdC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvZ2V0LXRlc3QuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy90ZXN0LWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCB0ZXN0IGRldGFpbHMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSk7XG4gICAgdGhpcy5nZXRUZXN0RnVuY3Rpb24gPSBnZXRUZXN0TGFtYmRhLmZ1bmN0aW9uO1xuXG4gICAgLy8gU3RhcnQgVGVzdCBTZXNzaW9uXG4gICAgY29uc3Qgc3RhcnRUZXN0U2Vzc2lvbkxhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0YXJ0VGVzdFNlc3Npb25MYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN0YXJ0LXRlc3Qtc2Vzc2lvbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvc3RhcnQtdGVzdC1zZXNzaW9uLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdTdGFydCBhIHRlc3Qgc2Vzc2lvbicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICB9KTtcbiAgICB0aGlzLnN0YXJ0VGVzdFNlc3Npb25GdW5jdGlvbiA9IHN0YXJ0VGVzdFNlc3Npb25MYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBTdWJtaXQgQW5zd2VyXG4gICAgY29uc3Qgc3VibWl0QW5zd2VyTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnU3VibWl0QW5zd2VyTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zdWJtaXQtYW5zd2VyLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdWJtaXQtYW5zd2VyLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvdGVzdC1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdTdWJtaXQgYW4gYW5zd2VyJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuICAgIHRoaXMuc3VibWl0QW5zd2VyRnVuY3Rpb24gPSBzdWJtaXRBbnN3ZXJMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBFbmQgVGVzdCBTZXNzaW9uXG4gICAgY29uc3QgZW5kVGVzdFNlc3Npb25MYW1iZGEgPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdFbmRUZXN0U2Vzc2lvbkxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtZW5kLXRlc3Qtc2Vzc2lvbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvZW5kLXRlc3Qtc2Vzc2lvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL3Rlc3QtZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW5kIGEgdGVzdCBzZXNzaW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgIH0pO1xuICAgIHRoaXMuZW5kVGVzdFNlc3Npb25GdW5jdGlvbiA9IGVuZFRlc3RTZXNzaW9uTGFtYmRhLmZ1bmN0aW9uO1xuXG4gICAgLy8gR2V0IFRlc3RzIChsaXN0IGF2YWlsYWJsZSB0ZXN0cylcbiAgICBjb25zdCBnZXRUZXN0c0xhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0dldFRlc3RzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1nZXQtdGVzdHMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2dldC10ZXN0cy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL3Rlc3QtZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBhdmFpbGFibGUgdGVzdHMnLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSk7XG4gICAgdGhpcy5nZXRUZXN0c0Z1bmN0aW9uID0gZ2V0VGVzdHNMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHZXQgUmVzdWx0c1xuICAgIGNvbnN0IGdldFJlc3VsdHNMYW1iZGEgPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdHZXRSZXN1bHRzTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1nZXQtcmVzdWx0cy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvZ2V0LXJlc3VsdHMuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy90ZXN0LWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dldCB0ZXN0IHNlc3Npb24gcmVzdWx0cycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KTtcbiAgICB0aGlzLmdldFJlc3VsdHNGdW5jdGlvbiA9IGdldFJlc3VsdHNMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHcmFudCBFdmVudEJyaWRnZSBwdWJsaXNoIHBlcm1pc3Npb25zXG4gICAgdGhpcy5lbmRUZXN0U2Vzc2lvbkZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydldmVudHM6UHV0RXZlbnRzJ10sXG4gICAgICAgIHJlc291cmNlczogW2V2ZW50QnVzLmV2ZW50QnVzQXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDIuIENPTlZFUlNBVElPTiBFTkdJTkUgU0VSVklDRSAoTm9kZS5qcylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGJlZHJvY2tNb2RlbElkID0gJ3VzLmFudGhyb3BpYy5jbGF1ZGUtc29ubmV0LTQtMjAyNTA1MTQtdjE6MCc7XG4gICAgY29uc3QgY29udmVyc2F0aW9uRW52aXJvbm1lbnQgPSB7XG4gICAgICBBSV9QUk9WSURFUjogJ2JlZHJvY2snLFxuICAgICAgQkVEUk9DS19SRUdJT046IGNkay5Bd3MuUkVHSU9OLFxuICAgICAgQkVEUk9DS19NT0RFTF9JRDogYmVkcm9ja01vZGVsSWQsXG4gICAgfTtcblxuICAgIC8vIFBhcmVudCBDaGF0IC0gQ3JlYXRlIFNlc3Npb25cbiAgICBjb25zdCBwYXJlbnRDaGF0Q3JlYXRlTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnUGFyZW50Q2hhdENyZWF0ZUxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtcGFyZW50LWNoYXQtY3JlYXRlLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9wYXJlbnQtY2hhdC9jcmVhdGUtc2Vzc2lvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgcGFyZW50IGNoYXQgc2Vzc2lvbicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJzYXRpb25FbnZpcm9ubWVudCxcbiAgICB9KTtcbiAgICB0aGlzLnBhcmVudENoYXRDcmVhdGVGdW5jdGlvbiA9IHBhcmVudENoYXRDcmVhdGVMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHcmFudCBCZWRyb2NrIGFjY2Vzc1xuICAgIHRoaXMucGFyZW50Q2hhdENyZWF0ZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06aW5mZXJlbmNlLXByb2ZpbGUvJHtiZWRyb2NrTW9kZWxJZH1gLFxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFBhcmVudCBDaGF0IC0gU2VuZCBNZXNzYWdlIChub24tc3RyZWFtaW5nIEpTT04gcmVzcG9uc2UgdmlhIEFQSSBHYXRld2F5KVxuICAgIGNvbnN0IHBhcmVudENoYXRTZW5kTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnUGFyZW50Q2hhdFNlbmRMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXBhcmVudC1jaGF0LXNlbmQtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3BhcmVudC1jaGF0L3NlbmQtbWVzc2FnZS5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXJlbnQgY2hhdCBzZW5kIG1lc3NhZ2UgKG5vbi1zdHJlYW1pbmcpJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbnZlcnNhdGlvbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICB9KTtcbiAgICB0aGlzLnBhcmVudENoYXRTZW5kRnVuY3Rpb24gPSBwYXJlbnRDaGF0U2VuZExhbWJkYS5mdW5jdGlvbjtcblxuICAgIHRoaXMucGFyZW50Q2hhdFNlbmRGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCcsICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmluZmVyZW5jZS1wcm9maWxlLyR7YmVkcm9ja01vZGVsSWR9YCxcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBQYXJlbnQgQ2hhdCAtIFNlbmQgTWVzc2FnZSAoU1NFIFN0cmVhbSlcbiAgICBjb25zdCBwYXJlbnRDaGF0U2VuZFN0cmVhbUxhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1BhcmVudENoYXRTZW5kU3RyZWFtTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1wYXJlbnQtY2hhdC1zZW5kLXN0cmVhbS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvcGFyZW50LWNoYXQvc2VuZC1tZXNzYWdlLXN0cmVhbS5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdQYXJlbnQgY2hhdCBzZW5kIG1lc3NhZ2UgKFNTRSBzdHJlYW1pbmcpJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgZW52aXJvbm1lbnQ6IGNvbnZlcnNhdGlvbkVudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTIwKSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgfSk7XG4gICAgdGhpcy5wYXJlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uID0gcGFyZW50Q2hhdFNlbmRTdHJlYW1MYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHcmFudCBCZWRyb2NrIGFjY2Vzc1xuICAgIHRoaXMucGFyZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCcsICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmluZmVyZW5jZS1wcm9maWxlLyR7YmVkcm9ja01vZGVsSWR9YCxcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBQYXJlbnQgQ2hhdCAtIEdldCBNZXNzYWdlc1xuICAgIGNvbnN0IHBhcmVudENoYXRHZXRNZXNzYWdlc0xhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1BhcmVudENoYXRHZXRNZXNzYWdlc0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtcGFyZW50LWNoYXQtZ2V0LW1lc3NhZ2VzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9wYXJlbnQtY2hhdC9nZXQtbWVzc2FnZXMuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9jb252ZXJzYXRpb24tZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHBhcmVudCBjaGF0IG1lc3NhZ2VzJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pO1xuICAgIHRoaXMucGFyZW50Q2hhdEdldE1lc3NhZ2VzRnVuY3Rpb24gPSBwYXJlbnRDaGF0R2V0TWVzc2FnZXNMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBQYXJlbnQgQ2hhdCAtIEVuZCBTZXNzaW9uXG4gICAgY29uc3QgcGFyZW50Q2hhdEVuZFNlc3Npb25MYW1iZGEgPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdQYXJlbnRDaGF0RW5kU2Vzc2lvbkxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtcGFyZW50LWNoYXQtZW5kLXNlc3Npb24tJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3BhcmVudC1jaGF0L2VuZC1zZXNzaW9uLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuZCBwYXJlbnQgY2hhdCBzZXNzaW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pO1xuICAgIHRoaXMucGFyZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbiA9IHBhcmVudENoYXRFbmRTZXNzaW9uTGFtYmRhLmZ1bmN0aW9uO1xuICAgIHRoaXMucGFyZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuICAgICAgICByZXNvdXJjZXM6IFtldmVudEJ1cy5ldmVudEJ1c0Fybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBTdHVkZW50IENoYXQgLSBDcmVhdGUgU2Vzc2lvblxuICAgIGNvbnN0IHN0dWRlbnRDaGF0Q3JlYXRlTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnU3R1ZGVudENoYXRDcmVhdGVMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtY2hhdC1jcmVhdGUtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3N0dWRlbnQtY2hhdC9jcmVhdGUtc2Vzc2lvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGUgc3R1ZGVudCBjaGF0IHNlc3Npb24nLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICBlbnZpcm9ubWVudDogY29udmVyc2F0aW9uRW52aXJvbm1lbnQsXG4gICAgfSk7XG4gICAgdGhpcy5zdHVkZW50Q2hhdENyZWF0ZUZ1bmN0aW9uID0gc3R1ZGVudENoYXRDcmVhdGVMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHcmFudCBCZWRyb2NrIGFjY2Vzc1xuICAgIHRoaXMuc3R1ZGVudENoYXRDcmVhdGVGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCcsICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJ10sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmluZmVyZW5jZS1wcm9maWxlLyR7YmVkcm9ja01vZGVsSWR9YCxcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6OmZvdW5kYXRpb24tbW9kZWwvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBTdHVkZW50IENoYXQgLSBTZW5kIE1lc3NhZ2UgKG5vbi1zdHJlYW1pbmcgSlNPTiByZXNwb25zZSB2aWEgQVBJIEdhdGV3YXkpXG4gICAgY29uc3Qgc3R1ZGVudENoYXRTZW5kTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnU3R1ZGVudENoYXRTZW5kTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1zdHVkZW50LWNoYXQtc2VuZC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvc3R1ZGVudC1jaGF0L3NlbmQtbWVzc2FnZS5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdTdHVkZW50IGNoYXQgc2VuZCBtZXNzYWdlIChub24tc3RyZWFtaW5nKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJzYXRpb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgfSk7XG4gICAgdGhpcy5zdHVkZW50Q2hhdFNlbmRGdW5jdGlvbiA9IHN0dWRlbnRDaGF0U2VuZExhbWJkYS5mdW5jdGlvbjtcblxuICAgIHRoaXMuc3R1ZGVudENoYXRTZW5kRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfTppbmZlcmVuY2UtcHJvZmlsZS8ke2JlZHJvY2tNb2RlbElkfWAsXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gU3R1ZGVudCBDaGF0IC0gU2VuZCBNZXNzYWdlIChTU0UgU3RyZWFtKVxuICAgIGNvbnN0IHN0dWRlbnRDaGF0U2VuZFN0cmVhbUxhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0dWRlbnRDaGF0U2VuZFN0cmVhbUxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtc3R1ZGVudC1jaGF0LXNlbmQtc3RyZWFtLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdHVkZW50LWNoYXQvc2VuZC1tZXNzYWdlLXN0cmVhbS5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdTdHVkZW50IGNoYXQgc2VuZCBtZXNzYWdlIChTU0Ugc3RyZWFtaW5nKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJzYXRpb25FbnZpcm9ubWVudCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEyMCksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgIH0pO1xuICAgIHRoaXMuc3R1ZGVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24gPSBzdHVkZW50Q2hhdFNlbmRTdHJlYW1MYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHcmFudCBCZWRyb2NrIGFjY2Vzc1xuICAgIHRoaXMuc3R1ZGVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnLCAnYmVkcm9jazpJbnZva2VNb2RlbFdpdGhSZXNwb25zZVN0cmVhbSddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfTppbmZlcmVuY2UtcHJvZmlsZS8ke2JlZHJvY2tNb2RlbElkfWAsXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOjpmb3VuZGF0aW9uLW1vZGVsLypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gU3R1ZGVudCBDaGF0IC0gR2V0IE1lc3NhZ2VzXG4gICAgY29uc3Qgc3R1ZGVudENoYXRHZXRNZXNzYWdlc0xhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0dWRlbnRDaGF0R2V0TWVzc2FnZXNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtY2hhdC1nZXQtbWVzc2FnZXMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3N0dWRlbnQtY2hhdC9nZXQtbWVzc2FnZXMuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9jb252ZXJzYXRpb24tZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2V0IHN0dWRlbnQgY2hhdCBtZXNzYWdlcycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KTtcbiAgICB0aGlzLnN0dWRlbnRDaGF0R2V0TWVzc2FnZXNGdW5jdGlvbiA9IHN0dWRlbnRDaGF0R2V0TWVzc2FnZXNMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBTdHVkZW50IENoYXQgLSBFbmQgU2Vzc2lvblxuICAgIGNvbnN0IHN0dWRlbnRDaGF0RW5kU2Vzc2lvbkxhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1N0dWRlbnRDaGF0RW5kU2Vzc2lvbkxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtc3R1ZGVudC1jaGF0LWVuZC1zZXNzaW9uLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9zdHVkZW50LWNoYXQvZW5kLXNlc3Npb24uaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9jb252ZXJzYXRpb24tZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW5kIHN0dWRlbnQgY2hhdCBzZXNzaW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pO1xuICAgIHRoaXMuc3R1ZGVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb24gPSBzdHVkZW50Q2hhdEVuZFNlc3Npb25MYW1iZGEuZnVuY3Rpb247XG4gICAgdGhpcy5zdHVkZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnZXZlbnRzOlB1dEV2ZW50cyddLFxuICAgICAgICByZXNvdXJjZXM6IFtldmVudEJ1cy5ldmVudEJ1c0Fybl0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBXZWJTb2NrZXQgLSBDb25uZWN0XG4gICAgY29uc3Qgd2Vic29ja2V0Q29ubmVjdExhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1dlYnNvY2tldENvbm5lY3RMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXdlYnNvY2tldC1jb25uZWN0LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy93ZWJzb2NrZXQvY29ubmVjdC5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2NvbnZlcnNhdGlvbi1lbmdpbmUnLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgY29ubmVjdCBoYW5kbGVyJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgIH0pO1xuICAgIHRoaXMud2Vic29ja2V0Q29ubmVjdEZ1bmN0aW9uID0gd2Vic29ja2V0Q29ubmVjdExhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIGFjY2VzcyB1c2luZyBJQU0gcG9saWN5IChhdm9pZCBjeWNsaWMgZGVwZW5kZW5jeSlcbiAgICB0aGlzLndlYnNvY2tldENvbm5lY3RGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdkeW5hbW9kYjpHZXRJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6UHV0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlVwZGF0ZUl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpEZWxldGVJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6UXVlcnknLFxuICAgICAgICAgICdkeW5hbW9kYjpTY2FuJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgY29ubmVjdGlvbnNUYWJsZS50YWJsZUFybixcbiAgICAgICAgICBgJHtjb25uZWN0aW9uc1RhYmxlLnRhYmxlQXJufS9pbmRleC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIFdlYlNvY2tldCAtIERpc2Nvbm5lY3RcbiAgICBjb25zdCB3ZWJzb2NrZXREaXNjb25uZWN0TGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnV2Vic29ja2V0RGlzY29ubmVjdExhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtd2Vic29ja2V0LWRpc2Nvbm5lY3QtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3dlYnNvY2tldC9kaXNjb25uZWN0LmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvY29udmVyc2F0aW9uLWVuZ2luZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBkaXNjb25uZWN0IGhhbmRsZXInLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgfSk7XG4gICAgdGhpcy53ZWJzb2NrZXREaXNjb25uZWN0RnVuY3Rpb24gPSB3ZWJzb2NrZXREaXNjb25uZWN0TGFtYmRhLmZ1bmN0aW9uO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgYWNjZXNzIHVzaW5nIElBTSBwb2xpY3kgKGF2b2lkIGN5Y2xpYyBkZXBlbmRlbmN5KVxuICAgIHRoaXMud2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcbiAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBjb25uZWN0aW9uc1RhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgIGAke2Nvbm5lY3Rpb25zVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gV2ViU29ja2V0IC0gVGltZXIgU3luYyAoRXZlbnRCcmlkZ2UgdHJpZ2dlcmVkKVxuICAgIGNvbnN0IHRpbWVyU3luY0xhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ1RpbWVyU3luY0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtdGltZXItc3luYy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvd2Vic29ja2V0L3RpbWVyLXN5bmMuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9jb252ZXJzYXRpb24tZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGltZXIgc3luYyBicm9hZGNhc3RlciAoZXZlcnkgNSBzZWNvbmRzKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIC8vIFdFQlNPQ0tFVF9BUElfRU5EUE9JTlQgd2lsbCBiZSBhZGRlZCB2aWEgc2VwYXJhdGUgc3RhY2sgb3IgbWFudWFsIGNvbmZpZ3VyYXRpb25cbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy50aW1lclN5bmNGdW5jdGlvbiA9IHRpbWVyU3luY0xhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHJlYWQgYWNjZXNzIHVzaW5nIElBTSBwb2xpY3kgKGF2b2lkIGN5Y2xpYyBkZXBlbmRlbmN5KVxuICAgIHRoaXMudGltZXJTeW5jRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIGNvbm5lY3Rpb25zVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgYCR7Y29ubmVjdGlvbnNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBBUEkgR2F0ZXdheSBtYW5hZ2VtZW50IHBlcm1pc3Npb25zIGZvciBXZWJTb2NrZXRcbiAgICAvLyBOb3RlOiBXZWJTb2NrZXQgQVBJIHJlc291cmNlIEFSTiB3aWxsIG5lZWQgdG8gYmUgYWRkZWQgbWFudWFsbHkgb3IgdmlhIHNlcGFyYXRlIHN0YWNrXG4gICAgLy8gdGhpcy50aW1lclN5bmNGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koXG4gICAgLy8gICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgLy8gICAgIGFjdGlvbnM6IFsnZXhlY3V0ZS1hcGk6TWFuYWdlQ29ubmVjdGlvbnMnXSxcbiAgICAvLyAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OiovJHtjb25maWcuc3RhZ2V9L1BPU1QvQGNvbm5lY3Rpb25zLypgXSxcbiAgICAvLyAgIH0pXG4gICAgLy8gKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDMuIFBST0ZJTEUgRU5HSU5FIFNFUlZJQ0UgKFB5dGhvbilcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGNhbGN1bGF0ZVByb2ZpbGVMYW1iZGEgPSBuZXcgUHl0aG9uTGFtYmRhKHRoaXMsICdDYWxjdWxhdGVQcm9maWxlTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1jYWxjdWxhdGUtcHJvZmlsZS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ3NyYy5oYW5kbGVycy5jYWxjdWxhdGVfcHJvZmlsZS5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL3Byb2ZpbGUtZW5naW5lJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2FsY3VsYXRlIHN0dWRlbnQgbGVhcm5pbmcgcHJvZmlsZSAoQmF5ZXNpYW4pJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgIH0pO1xuICAgIHRoaXMuY2FsY3VsYXRlUHJvZmlsZUZ1bmN0aW9uID0gY2FsY3VsYXRlUHJvZmlsZUxhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDQuIEJBQ0tHUk9VTkQgSk9CUyBTRVJWSUNFIChQeXRob24pXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCBiYWNrZ3JvdW5kSm9ic0Vudmlyb25tZW50ID0ge1xuICAgICAgQUlfUFJPVklERVI6ICdiZWRyb2NrJywgLy8gVXNlIEFXUyBCZWRyb2NrIGluc3RlYWQgb2YgQW50aHJvcGljIEFQSVxuICAgICAgLy8gQVdTX1JFR0lPTiBpcyBhdXRvbWF0aWNhbGx5IHByb3ZpZGVkIGJ5IExhbWJkYSBydW50aW1lXG4gICAgfTtcblxuICAgIC8vIFN1bW1hcml6YXRpb24gV29ya2VyXG4gICAgY29uc3Qgc3VtbWFyaXphdGlvbldvcmtlckxhbWJkYSA9IG5ldyBQeXRob25MYW1iZGEodGhpcywgJ1N1bW1hcml6YXRpb25Xb3JrZXJMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLXN1bW1hcml6YXRpb24td29ya2VyLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnc3JjLmhhbmRsZXJzLnN1bW1hcml6YXRpb25fd29ya2VyLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYmFja2dyb3VuZC1qb2JzJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29udmVyc2F0aW9uIHN1bW1hcml6YXRpb24gd29ya2VyJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgZW52aXJvbm1lbnQ6IGJhY2tncm91bmRKb2JzRW52aXJvbm1lbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcbiAgICB0aGlzLnN1bW1hcml6YXRpb25Xb3JrZXJGdW5jdGlvbiA9IHN1bW1hcml6YXRpb25Xb3JrZXJMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBHcmFudCBCZWRyb2NrIGFjY2Vzc1xuICAgIHRoaXMuc3VtbWFyaXphdGlvbldvcmtlckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06aW5mZXJlbmNlLXByb2ZpbGUvJHtiZWRyb2NrTW9kZWxJZH1gLFxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBTUVMgdHJpZ2dlciB1c2luZyBDZm5FdmVudFNvdXJjZU1hcHBpbmcgdG8gYXZvaWQgY3ljbGljIGRlcGVuZGVuY3lcbiAgICBuZXcgbGFtYmRhLkNmbkV2ZW50U291cmNlTWFwcGluZyh0aGlzLCAnU3VtbWFyaXphdGlvblF1ZXVlVHJpZ2dlcicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogdGhpcy5zdW1tYXJpemF0aW9uV29ya2VyRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZXZlbnRTb3VyY2VBcm46IHN1bW1hcml6YXRpb25RdWV1ZUFybixcbiAgICAgIGJhdGNoU2l6ZTogMSxcbiAgICAgIG1heGltdW1CYXRjaGluZ1dpbmRvd0luU2Vjb25kczogMTAsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byByZWFkIGZyb20gdGhlIHF1ZXVlXG4gICAgdGhpcy5zdW1tYXJpemF0aW9uV29ya2VyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnc3FzOlJlY2VpdmVNZXNzYWdlJyxcbiAgICAgICAgICAnc3FzOkRlbGV0ZU1lc3NhZ2UnLFxuICAgICAgICAgICdzcXM6R2V0UXVldWVBdHRyaWJ1dGVzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbc3VtbWFyaXphdGlvblF1ZXVlQXJuXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEluc2lnaHRzIFdvcmtlclxuICAgIGNvbnN0IGluc2lnaHRzV29ya2VyTGFtYmRhID0gbmV3IFB5dGhvbkxhbWJkYSh0aGlzLCAnSW5zaWdodHNXb3JrZXJMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWluc2lnaHRzLXdvcmtlci0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ3NyYy5oYW5kbGVycy5pbnNpZ2h0c193b3JrZXIuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9iYWNrZ3JvdW5kLWpvYnMnLFxuICAgICAgZGVzY3JpcHRpb246ICdJbnNpZ2h0cyBleHRyYWN0aW9uIHdvcmtlcicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50OiBiYWNrZ3JvdW5kSm9ic0Vudmlyb25tZW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICB9KTtcbiAgICB0aGlzLmluc2lnaHRzV29ya2VyRnVuY3Rpb24gPSBpbnNpZ2h0c1dvcmtlckxhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vIEdyYW50IEJlZHJvY2sgYWNjZXNzXG4gICAgdGhpcy5pbnNpZ2h0c1dvcmtlckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgYGFybjphd3M6YmVkcm9jazoke2Nkay5Bd3MuUkVHSU9OfToke2Nkay5Bd3MuQUNDT1VOVF9JRH06aW5mZXJlbmNlLXByb2ZpbGUvJHtiZWRyb2NrTW9kZWxJZH1gLFxuICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6Kjo6Zm91bmRhdGlvbi1tb2RlbC8qYCxcbiAgICAgICAgXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFkZCBTUVMgdHJpZ2dlciB1c2luZyBDZm5FdmVudFNvdXJjZU1hcHBpbmcgdG8gYXZvaWQgY3ljbGljIGRlcGVuZGVuY3lcbiAgICBuZXcgbGFtYmRhLkNmbkV2ZW50U291cmNlTWFwcGluZyh0aGlzLCAnSW5zaWdodHNRdWV1ZVRyaWdnZXInLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IHRoaXMuaW5zaWdodHNXb3JrZXJGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBldmVudFNvdXJjZUFybjogaW5zaWdodHNRdWV1ZUFybixcbiAgICAgIGJhdGNoU2l6ZTogMSxcbiAgICAgIG1heGltdW1CYXRjaGluZ1dpbmRvd0luU2Vjb25kczogMzAsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byByZWFkIGZyb20gdGhlIHF1ZXVlXG4gICAgdGhpcy5pbnNpZ2h0c1dvcmtlckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3NxczpSZWNlaXZlTWVzc2FnZScsXG4gICAgICAgICAgJ3NxczpEZWxldGVNZXNzYWdlJyxcbiAgICAgICAgICAnc3FzOkdldFF1ZXVlQXR0cmlidXRlcycsXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW2luc2lnaHRzUXVldWVBcm5dLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gNS4gQURNSU4gU0VSVklDRSAoTm9kZS5qcylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIENyZWF0ZSBRdWVzdGlvblxuICAgIGNvbnN0IGFkbWluQ3JlYXRlUXVlc3Rpb25MYW1iZGEgPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pbkNyZWF0ZVF1ZXN0aW9uTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1hZG1pbi1jcmVhdGUtcXVlc3Rpb24tJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL3F1ZXN0aW9ucy9jcmVhdGUtcXVlc3Rpb24uaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9hZG1pbi1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW46IENyZWF0ZSBxdWVzdGlvbicsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KTtcbiAgICB0aGlzLmFkbWluQ3JlYXRlUXVlc3Rpb25GdW5jdGlvbiA9IGFkbWluQ3JlYXRlUXVlc3Rpb25MYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBVcGRhdGUgUXVlc3Rpb25cbiAgICBjb25zdCBhZG1pblVwZGF0ZVF1ZXN0aW9uTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQWRtaW5VcGRhdGVRdWVzdGlvbkxhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtYWRtaW4tdXBkYXRlLXF1ZXN0aW9uLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9xdWVzdGlvbnMvdXBkYXRlLXF1ZXN0aW9uLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYWRtaW4tc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBVcGRhdGUgcXVlc3Rpb24nLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgfSk7XG4gICAgdGhpcy5hZG1pblVwZGF0ZVF1ZXN0aW9uRnVuY3Rpb24gPSBhZG1pblVwZGF0ZVF1ZXN0aW9uTGFtYmRhLmZ1bmN0aW9uO1xuXG4gICAgLy8gRGVsZXRlIFF1ZXN0aW9uXG4gICAgY29uc3QgYWRtaW5EZWxldGVRdWVzdGlvbkxhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0FkbWluRGVsZXRlUXVlc3Rpb25MYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLWRlbGV0ZS1xdWVzdGlvbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvcXVlc3Rpb25zL2RlbGV0ZS1xdWVzdGlvbi5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2FkbWluLXNlcnZpY2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbjogRGVsZXRlIHF1ZXN0aW9uJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgIH0pO1xuICAgIHRoaXMuYWRtaW5EZWxldGVRdWVzdGlvbkZ1bmN0aW9uID0gYWRtaW5EZWxldGVRdWVzdGlvbkxhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vIExpc3QgUXVlc3Rpb25zXG4gICAgY29uc3QgYWRtaW5MaXN0UXVlc3Rpb25zTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQWRtaW5MaXN0UXVlc3Rpb25zTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1hZG1pbi1saXN0LXF1ZXN0aW9ucy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgaGFuZGxlcjogJ2Rpc3QvaGFuZGxlcnMvcXVlc3Rpb25zL2xpc3QtcXVlc3Rpb25zLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYWRtaW4tc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBMaXN0IHF1ZXN0aW9ucycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICB9KTtcbiAgICB0aGlzLmFkbWluTGlzdFF1ZXN0aW9uc0Z1bmN0aW9uID0gYWRtaW5MaXN0UXVlc3Rpb25zTGFtYmRhLmZ1bmN0aW9uO1xuXG4gICAgLy8gSW1wb3J0IFF1ZXN0aW9uc1xuICAgIGNvbnN0IGFkbWluSW1wb3J0UXVlc3Rpb25zTGFtYmRhID0gbmV3IE5vZGVqc0xhbWJkYSh0aGlzLCAnQWRtaW5JbXBvcnRRdWVzdGlvbnNMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLWltcG9ydC1xdWVzdGlvbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2J1bGstb3BlcmF0aW9ucy9pbXBvcnQtcXVlc3Rpb25zLmhhbmRsZXInLFxuICAgICAgY29kZVBhdGg6ICcuLi9lZHVsZW5zLWJhY2tlbmQvc2VydmljZXMvYWRtaW4tc2VydmljZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluOiBJbXBvcnQgcXVlc3Rpb25zIChidWxrKScsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcbiAgICB0aGlzLmFkbWluSW1wb3J0UXVlc3Rpb25zRnVuY3Rpb24gPSBhZG1pbkltcG9ydFF1ZXN0aW9uc0xhbWJkYS5mdW5jdGlvbjtcblxuICAgIC8vIEV4cG9ydCBRdWVzdGlvbnNcbiAgICBjb25zdCBhZG1pbkV4cG9ydFF1ZXN0aW9uc0xhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0FkbWluRXhwb3J0UXVlc3Rpb25zTGFtYmRhJywge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZWR1bGVucy1hZG1pbi1leHBvcnQtcXVlc3Rpb25zLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9idWxrLW9wZXJhdGlvbnMvZXhwb3J0LXF1ZXN0aW9ucy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2FkbWluLXNlcnZpY2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbjogRXhwb3J0IHF1ZXN0aW9ucyAoYnVsayknLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cDogbGFtYmRhU2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgfSk7XG4gICAgdGhpcy5hZG1pbkV4cG9ydFF1ZXN0aW9uc0Z1bmN0aW9uID0gYWRtaW5FeHBvcnRRdWVzdGlvbnNMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyBTeXN0ZW0gTWV0cmljc1xuICAgIGNvbnN0IGFkbWluU3lzdGVtTWV0cmljc0xhbWJkYSA9IG5ldyBOb2RlanNMYW1iZGEodGhpcywgJ0FkbWluU3lzdGVtTWV0cmljc0xhbWJkYScsIHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGVkdWxlbnMtYWRtaW4tc3lzdGVtLW1ldHJpY3MtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGhhbmRsZXI6ICdkaXN0L2hhbmRsZXJzL2FuYWx5dGljcy9zeXN0ZW0tbWV0cmljcy5oYW5kbGVyJyxcbiAgICAgIGNvZGVQYXRoOiAnLi4vZWR1bGVucy1iYWNrZW5kL3NlcnZpY2VzL2FkbWluLXNlcnZpY2UnLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbjogU3lzdGVtLXdpZGUgbWV0cmljcycsXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwOiBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICB9KTtcbiAgICB0aGlzLmFkbWluU3lzdGVtTWV0cmljc0Z1bmN0aW9uID0gYWRtaW5TeXN0ZW1NZXRyaWNzTGFtYmRhLmZ1bmN0aW9uO1xuXG4gICAgLy8gU3R1ZGVudCBBbmFseXRpY3NcbiAgICBjb25zdCBhZG1pblN0dWRlbnRBbmFseXRpY3NMYW1iZGEgPSBuZXcgTm9kZWpzTGFtYmRhKHRoaXMsICdBZG1pblN0dWRlbnRBbmFseXRpY3NMYW1iZGEnLCB7XG4gICAgICBjb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBlZHVsZW5zLWFkbWluLXN0dWRlbnQtYW5hbHl0aWNzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9oYW5kbGVycy9hbmFseXRpY3Mvc3R1ZGVudC1hbmFseXRpY3MuaGFuZGxlcicsXG4gICAgICBjb2RlUGF0aDogJy4uL2VkdWxlbnMtYmFja2VuZC9zZXJ2aWNlcy9hZG1pbi1zZXJ2aWNlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW46IFN0dWRlbnQgYW5hbHl0aWNzJyxcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBhdXJvcmFTZWNyZXQsXG4gICAgICByZWRpc0VuZHBvaW50LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgIH0pO1xuICAgIHRoaXMuYWRtaW5TdHVkZW50QW5hbHl0aWNzRnVuY3Rpb24gPSBhZG1pblN0dWRlbnRBbmFseXRpY3NMYW1iZGEuZnVuY3Rpb247XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA2LiBBUEkgR0FURVdBWSBJTlRFR1JBVElPTlNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIEF1dGggZW5kcG9pbnRzXG4gICAgY29uc3QgYXV0aFJlc291cmNlID0gcmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdhdXRoJyk7XG4gICAgYXV0aFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMubG9naW5GdW5jdGlvbiksIHtcbiAgICAgIC8vIE5vIGF1dGggcmVxdWlyZWQgZm9yIGxvZ2luIGVuZHBvaW50XG4gICAgfSk7XG5cbiAgICBjb25zdCBsb2dpblJlc291cmNlID0gYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdsb2dpbicpO1xuICAgIGxvZ2luUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5sb2dpbkZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCByZWdpc3RlclJlc291cmNlID0gYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdyZWdpc3RlcicpO1xuICAgIHJlZ2lzdGVyUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5yZWdpc3RlckZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBjcmVhdGVTdHVkZW50UmVzb3VyY2UgPSBhdXRoUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2NyZWF0ZS1zdHVkZW50Jyk7XG4gICAgY3JlYXRlU3R1ZGVudFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuY3JlYXRlU3R1ZGVudEZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBzdHVkZW50c1Jlc291cmNlID0gYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdzdHVkZW50cycpO1xuICAgIHN0dWRlbnRzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmxpc3RTdHVkZW50c0Z1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBzdHVkZW50TG9naW5SZXNvdXJjZSA9IGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3R1ZGVudC1sb2dpbicpO1xuICAgIHN0dWRlbnRMb2dpblJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuc3R1ZGVudExvZ2luRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IGRlbGV0ZVN0dWRlbnRSZXNvdXJjZSA9IGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZGVsZXRlLXN0dWRlbnQnKTtcbiAgICBkZWxldGVTdHVkZW50UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5kZWxldGVTdHVkZW50RnVuY3Rpb24pKTtcblxuICAgIC8vIFRlc3QgRW5naW5lIGVuZHBvaW50c1xuICAgIGNvbnN0IHRlc3RzUmVzb3VyY2UgPSByZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Rlc3RzJyk7XG4gICAgdGVzdHNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmNyZWF0ZVRlc3RGdW5jdGlvbikpO1xuICAgIHRlc3RzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmdldFRlc3RzRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHRlc3RJZFJlc291cmNlID0gdGVzdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3Rlc3RJZH0nKTtcbiAgICB0ZXN0SWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuZ2V0VGVzdEZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBzZXNzaW9uc1Jlc291cmNlID0gcmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdzZXNzaW9ucycpO1xuICAgIHNlc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5zdGFydFRlc3RTZXNzaW9uRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHNlc3Npb25JZFJlc291cmNlID0gc2Vzc2lvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3Nlc3Npb25JZH0nKTtcbiAgICBjb25zdCBhbnN3ZXJzUmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYW5zd2VycycpO1xuICAgIGFuc3dlcnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnN1Ym1pdEFuc3dlckZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBlbmRTZXNzaW9uUmVzb3VyY2UgPSBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZW5kJyk7XG4gICAgZW5kU2Vzc2lvblJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuZW5kVGVzdFNlc3Npb25GdW5jdGlvbikpO1xuXG4gICAgY29uc3QgcmVzdWx0c1Jlc291cmNlID0gc2Vzc2lvbklkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Jlc3VsdHMnKTtcbiAgICByZXN1bHRzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmdldFJlc3VsdHNGdW5jdGlvbikpO1xuXG4gICAgLy8gQ29udmVyc2F0aW9uIEVuZ2luZSAtIFBhcmVudCBDaGF0IChub24tc3RyZWFtaW5nKVxuICAgIGNvbnN0IHBhcmVudENoYXRSZXNvdXJjZSA9IHJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgncGFyZW50LWNoYXQnKTtcbiAgICBwYXJlbnRDaGF0UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5wYXJlbnRDaGF0Q3JlYXRlRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHBhcmVudFNlc3Npb25SZXNvdXJjZSA9IHBhcmVudENoYXRSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3Nlc3Npb25JZH0nKTtcblxuICAgIGNvbnN0IHBhcmVudE1lc3NhZ2VSZXNvdXJjZSA9IHBhcmVudFNlc3Npb25SZXNvdXJjZS5hZGRSZXNvdXJjZSgnbWVzc2FnZScpO1xuICAgIHBhcmVudE1lc3NhZ2VSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnBhcmVudENoYXRTZW5kRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHBhcmVudE1lc3NhZ2VzUmVzb3VyY2UgPSBwYXJlbnRTZXNzaW9uUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ21lc3NhZ2VzJyk7XG4gICAgcGFyZW50TWVzc2FnZXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMucGFyZW50Q2hhdEdldE1lc3NhZ2VzRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHBhcmVudEVuZFJlc291cmNlID0gcGFyZW50U2Vzc2lvblJlc291cmNlLmFkZFJlc291cmNlKCdlbmQnKTtcbiAgICBwYXJlbnRFbmRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnBhcmVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb24pKTtcblxuICAgIC8vIENvbnZlcnNhdGlvbiBFbmdpbmUgLSBTdHVkZW50IENoYXQgKG5vbi1zdHJlYW1pbmcpXG4gICAgY29uc3Qgc3R1ZGVudENoYXRSZXNvdXJjZSA9IHJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnc3R1ZGVudC1jaGF0Jyk7XG4gICAgc3R1ZGVudENoYXRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLnN0dWRlbnRDaGF0Q3JlYXRlRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHN0dWRlbnRTZXNzaW9uUmVzb3VyY2UgPSBzdHVkZW50Q2hhdFJlc291cmNlLmFkZFJlc291cmNlKCd7c2Vzc2lvbklkfScpO1xuXG4gICAgY29uc3Qgc3R1ZGVudE1lc3NhZ2VSZXNvdXJjZSA9IHN0dWRlbnRTZXNzaW9uUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ21lc3NhZ2UnKTtcbiAgICBzdHVkZW50TWVzc2FnZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuc3R1ZGVudENoYXRTZW5kRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHN0dWRlbnRNZXNzYWdlc1Jlc291cmNlID0gc3R1ZGVudFNlc3Npb25SZXNvdXJjZS5hZGRSZXNvdXJjZSgnbWVzc2FnZXMnKTtcbiAgICBzdHVkZW50TWVzc2FnZXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuc3R1ZGVudENoYXRHZXRNZXNzYWdlc0Z1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBzdHVkZW50RW5kUmVzb3VyY2UgPSBzdHVkZW50U2Vzc2lvblJlc291cmNlLmFkZFJlc291cmNlKCdlbmQnKTtcbiAgICBzdHVkZW50RW5kUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5zdHVkZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbikpO1xuXG4gICAgLy8gQWRtaW4gU2VydmljZSBlbmRwb2ludHMgKHJlcXVpcmUgQVBJIGtleSlcbiAgICBjb25zdCBhZG1pblJlc291cmNlID0gcmVzdEFwaS5yb290LmFkZFJlc291cmNlKCdhZG1pbicpO1xuXG4gICAgY29uc3QgcXVlc3Rpb25zUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdxdWVzdGlvbnMnKTtcbiAgICBxdWVzdGlvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmFkbWluQ3JlYXRlUXVlc3Rpb25GdW5jdGlvbiksIHtcbiAgICAgIGFwaUtleVJlcXVpcmVkOiB0cnVlLFxuICAgIH0pO1xuICAgIHF1ZXN0aW9uc1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5hZG1pbkxpc3RRdWVzdGlvbnNGdW5jdGlvbiksIHtcbiAgICAgIGFwaUtleVJlcXVpcmVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcXVlc3Rpb25JZFJlc291cmNlID0gcXVlc3Rpb25zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3txdWVzdGlvbklkfScpO1xuICAgIHF1ZXN0aW9uSWRSZXNvdXJjZS5hZGRNZXRob2QoJ1BVVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuYWRtaW5VcGRhdGVRdWVzdGlvbkZ1bmN0aW9uKSwge1xuICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWUsXG4gICAgfSk7XG4gICAgcXVlc3Rpb25JZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5hZG1pbkRlbGV0ZVF1ZXN0aW9uRnVuY3Rpb24pLCB7XG4gICAgICBhcGlLZXlSZXF1aXJlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGJ1bGtSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2J1bGsnKTtcbiAgICBjb25zdCBpbXBvcnRSZXNvdXJjZSA9IGJ1bGtSZXNvdXJjZS5hZGRSZXNvdXJjZSgnaW1wb3J0Jyk7XG4gICAgaW1wb3J0UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24odGhpcy5hZG1pbkltcG9ydFF1ZXN0aW9uc0Z1bmN0aW9uKSwge1xuICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBleHBvcnRSZXNvdXJjZSA9IGJ1bGtSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZXhwb3J0Jyk7XG4gICAgZXhwb3J0UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmFkbWluRXhwb3J0UXVlc3Rpb25zRnVuY3Rpb24pLCB7XG4gICAgICBhcGlLZXlSZXF1aXJlZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFuYWx5dGljc1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnYW5hbHl0aWNzJyk7XG4gICAgY29uc3QgbWV0cmljc1Jlc291cmNlID0gYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ21ldHJpY3MnKTtcbiAgICBtZXRyaWNzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmFkbWluU3lzdGVtTWV0cmljc0Z1bmN0aW9uKSwge1xuICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdHVkZW50QW5hbHl0aWNzUmVzb3VyY2UgPSBhbmFseXRpY3NSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3R1ZGVudHMnKS5hZGRSZXNvdXJjZSgne3N0dWRlbnRJZH0nKTtcbiAgICBzdHVkZW50QW5hbHl0aWNzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbih0aGlzLmFkbWluU3R1ZGVudEFuYWx5dGljc0Z1bmN0aW9uKSwge1xuICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyA3LiBXRUJTT0NLRVQgQVBJIElOVEVHUkFUSU9OU1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gTm90ZTogV2ViU29ja2V0IGludGVncmF0aW9ucyBjb21tZW50ZWQgb3V0IHRvIGF2b2lkIGN5Y2xpYyBkZXBlbmRlbmNpZXNcbiAgICAvLyBUT0RPOiBDcmVhdGUgdGhlc2UgaW4gYSBzZXBhcmF0ZSBpbnRlZ3JhdGlvbiBzdGFjayBhZnRlciBMYW1iZGEgYW5kIEFQSSBHYXRld2F5IHN0YWNrcyBhcmUgZGVwbG95ZWRcblxuICAgIC8vIGNvbnN0IGNvbm5lY3RJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djIuQ2ZuSW50ZWdyYXRpb24odGhpcywgJ0Nvbm5lY3RJbnRlZ3JhdGlvbicsIHtcbiAgICAvLyAgIGFwaUlkOiB3ZWJzb2NrZXRBcGkucmVmLFxuICAgIC8vICAgaW50ZWdyYXRpb25UeXBlOiAnQVdTX1BST1hZJyxcbiAgICAvLyAgIGludGVncmF0aW9uVXJpOiBgYXJuOmF3czphcGlnYXRld2F5OiR7Y2RrLkF3cy5SRUdJT059OmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLyR7dGhpcy53ZWJzb2NrZXRDb25uZWN0RnVuY3Rpb24uZnVuY3Rpb25Bcm59L2ludm9jYXRpb25zYCxcbiAgICAvLyB9KTtcblxuICAgIC8vIGNvbnN0IGRpc2Nvbm5lY3RJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djIuQ2ZuSW50ZWdyYXRpb24odGhpcywgJ0Rpc2Nvbm5lY3RJbnRlZ3JhdGlvbicsIHtcbiAgICAvLyAgIGFwaUlkOiB3ZWJzb2NrZXRBcGkucmVmLFxuICAgIC8vICAgaW50ZWdyYXRpb25UeXBlOiAnQVdTX1BST1hZJyxcbiAgICAvLyAgIGludGVncmF0aW9uVXJpOiBgYXJuOmF3czphcGlnYXRld2F5OiR7Y2RrLkF3cy5SRUdJT059OmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLyR7dGhpcy53ZWJzb2NrZXREaXNjb25uZWN0RnVuY3Rpb24uZnVuY3Rpb25Bcm59L2ludm9jYXRpb25zYCxcbiAgICAvLyB9KTtcblxuICAgIC8vIG5ldyBhcGlnYXRld2F5djIuQ2ZuUm91dGUodGhpcywgJ0Nvbm5lY3RSb3V0ZScsIHtcbiAgICAvLyAgIGFwaUlkOiB3ZWJzb2NrZXRBcGkucmVmLFxuICAgIC8vICAgcm91dGVLZXk6ICckY29ubmVjdCcsXG4gICAgLy8gICBhdXRob3JpemF0aW9uVHlwZTogJ05PTkUnLFxuICAgIC8vICAgdGFyZ2V0OiBgaW50ZWdyYXRpb25zLyR7Y29ubmVjdEludGVncmF0aW9uLnJlZn1gLFxuICAgIC8vIH0pO1xuXG4gICAgLy8gbmV3IGFwaWdhdGV3YXl2Mi5DZm5Sb3V0ZSh0aGlzLCAnRGlzY29ubmVjdFJvdXRlJywge1xuICAgIC8vICAgYXBpSWQ6IHdlYnNvY2tldEFwaS5yZWYsXG4gICAgLy8gICByb3V0ZUtleTogJyRkaXNjb25uZWN0JyxcbiAgICAvLyAgIGF1dGhvcml6YXRpb25UeXBlOiAnTk9ORScsXG4gICAgLy8gICB0YXJnZXQ6IGBpbnRlZ3JhdGlvbnMvJHtkaXNjb25uZWN0SW50ZWdyYXRpb24ucmVmfWAsXG4gICAgLy8gfSk7XG5cbiAgICAvLyBHcmFudCBBUEkgR2F0ZXdheSBwZXJtaXNzaW9uIHRvIGludm9rZSBXZWJTb2NrZXQgZnVuY3Rpb25zXG4gICAgdGhpcy53ZWJzb2NrZXRDb25uZWN0RnVuY3Rpb24uZ3JhbnRJbnZva2UoXG4gICAgICBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2FwaWdhdGV3YXkuYW1hem9uYXdzLmNvbScpXG4gICAgKTtcbiAgICB0aGlzLndlYnNvY2tldERpc2Nvbm5lY3RGdW5jdGlvbi5ncmFudEludm9rZShcbiAgICAgIG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJylcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gOC4gQUxCIFRBUkdFVCBHUk9VUFMgKFNTRSBTdHJlYW1pbmcpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBQYXJlbnQgQ2hhdCBTdHJlYW1pbmcgVGFyZ2V0IEdyb3VwXG4gICAgY29uc3QgcGFyZW50U3RyZWFtVGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnUGFyZW50U3RyZWFtVGFyZ2V0R3JvdXAnLCB7XG4gICAgICB0YXJnZXRHcm91cE5hbWU6IGBlZHVsZW5zLXBhcmVudC1zdHJlYW0tJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIHRhcmdldFR5cGU6IGVsYnYyLlRhcmdldFR5cGUuTEFNQkRBLFxuICAgICAgdGFyZ2V0czogW25ldyBlbGJ2Ml90YXJnZXRzLkxhbWJkYVRhcmdldCh0aGlzLnBhcmVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24pXSxcbiAgICAgIGhlYWx0aENoZWNrOiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLCAvLyBMYW1iZGEgdGFyZ2V0cyBkb24ndCBuZWVkIGhlYWx0aCBjaGVja3NcbiAgICAgIH0sXG4gICAgICAvLyBOb3RlOiBkZXJlZ2lzdHJhdGlvbkRlbGF5IGlzIG5vdCBzdXBwb3J0ZWQgZm9yIExhbWJkYSB0YXJnZXQgZ3JvdXBzXG4gICAgfSk7XG5cbiAgICAvLyBTdHVkZW50IENoYXQgU3RyZWFtaW5nIFRhcmdldCBHcm91cFxuICAgIGNvbnN0IHN0dWRlbnRTdHJlYW1UYXJnZXRHcm91cCA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvblRhcmdldEdyb3VwKHRoaXMsICdTdHVkZW50U3RyZWFtVGFyZ2V0R3JvdXAnLCB7XG4gICAgICB0YXJnZXRHcm91cE5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtc3RyZWFtLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLkxBTUJEQSxcbiAgICAgIHRhcmdldHM6IFtuZXcgZWxidjJfdGFyZ2V0cy5MYW1iZGFUYXJnZXQodGhpcy5zdHVkZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbildLFxuICAgICAgaGVhbHRoQ2hlY2s6IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICB9LFxuICAgICAgLy8gTm90ZTogZGVyZWdpc3RyYXRpb25EZWxheSBpcyBub3Qgc3VwcG9ydGVkIGZvciBMYW1iZGEgdGFyZ2V0IGdyb3Vwc1xuICAgIH0pO1xuXG4gICAgLy8gQWRkIGxpc3RlbmVyIHJ1bGVzXG4gICAgaHR0cExpc3RlbmVyLmFkZFRhcmdldEdyb3VwcygnUGFyZW50U3RyZWFtUnVsZScsIHtcbiAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgIGNvbmRpdGlvbnM6IFtcbiAgICAgICAgZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFsnL3BhcmVudC1jaGF0Lyovc2VuZCddKSxcbiAgICAgIF0sXG4gICAgICB0YXJnZXRHcm91cHM6IFtwYXJlbnRTdHJlYW1UYXJnZXRHcm91cF0sXG4gICAgfSk7XG5cbiAgICBodHRwTGlzdGVuZXIuYWRkVGFyZ2V0R3JvdXBzKCdTdHVkZW50U3RyZWFtUnVsZScsIHtcbiAgICAgIHByaW9yaXR5OiAyMCxcbiAgICAgIGNvbmRpdGlvbnM6IFtcbiAgICAgICAgZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFsnL3N0dWRlbnQtY2hhdC8qL3NlbmQnXSksXG4gICAgICBdLFxuICAgICAgdGFyZ2V0R3JvdXBzOiBbc3R1ZGVudFN0cmVhbVRhcmdldEdyb3VwXSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIDkuIEVWRU5UQlJJREdFIFRBUkdFVFNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIE5vdGU6IEV2ZW50QnJpZGdlIHJ1bGVzIGV4aXN0IGluIEpvYnNTdGFjaywgYnV0IHRhcmdldHMgbmVlZCB0byBiZSBhZGRlZFxuICAgIC8vIGFmdGVyIGRlcGxveW1lbnQgdG8gYXZvaWQgY3ljbGljIGRlcGVuZGVuY2llcy5cbiAgICAvLyBTZWUgc2NyaXB0cy9jb25uZWN0LWV2ZW50YnJpZGdlLnNoIG9yIEVWRU5UQlJJREdFLVNFVFVQLm1kXG5cbiAgICAvLyBHcmFudCBFdmVudEJyaWRnZSBwZXJtaXNzaW9uIHRvIGludm9rZSBMYW1iZGEgZnVuY3Rpb25zXG4gICAgdGhpcy5jYWxjdWxhdGVQcm9maWxlRnVuY3Rpb24uYWRkUGVybWlzc2lvbignQWxsb3dFdmVudEJyaWRnZUludm9rZScsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdldmVudHMuYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiBgYXJuOmF3czpldmVudHM6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OnJ1bGUvJHt0ZXN0Q29tcGxldGVkUnVsZU5hbWV9YCxcbiAgICB9KTtcblxuICAgIHRoaXMudGltZXJTeW5jRnVuY3Rpb24uYWRkUGVybWlzc2lvbignQWxsb3dFdmVudEJyaWRnZUludm9rZVRpbWVyU3luYycsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdldmVudHMuYW1hem9uYXdzLmNvbScpLFxuICAgICAgc291cmNlQXJuOiBgYXJuOmF3czpldmVudHM6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OnJ1bGUvJHt0aW1lclN5bmNSdWxlTmFtZX1gLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMTAuIEdSQU5UIERBVEFCQVNFIFNFQ1JFVCBBQ0NFU1NcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIEdyYW50IGFsbCBMYW1iZGEgZnVuY3Rpb25zIGFjY2VzcyB0byByZWFkIHRoZSBBdXJvcmEgc2VjcmV0XG4gICAgLy8gVXNpbmcgYWRkVG9Sb2xlUG9saWN5IGluc3RlYWQgb2YgZ3JhbnRSZWFkIHRvIGF2b2lkIGN5Y2xpYyBkZXBlbmRlbmNpZXNcbiAgICBjb25zdCBhbGxGdW5jdGlvbnMgPSBbXG4gICAgICB0aGlzLmxvZ2luRnVuY3Rpb24sXG4gICAgICB0aGlzLnJlZ2lzdGVyRnVuY3Rpb24sXG4gICAgICB0aGlzLmNyZWF0ZVN0dWRlbnRGdW5jdGlvbixcbiAgICAgIHRoaXMubGlzdFN0dWRlbnRzRnVuY3Rpb24sXG4gICAgICB0aGlzLnN0dWRlbnRMb2dpbkZ1bmN0aW9uLFxuICAgICAgdGhpcy5kZWxldGVTdHVkZW50RnVuY3Rpb24sXG4gICAgICB0aGlzLmNyZWF0ZVRlc3RGdW5jdGlvbixcbiAgICAgIHRoaXMuZ2V0VGVzdEZ1bmN0aW9uLFxuICAgICAgdGhpcy5nZXRUZXN0c0Z1bmN0aW9uLFxuICAgICAgdGhpcy5nZXRSZXN1bHRzRnVuY3Rpb24sXG4gICAgICB0aGlzLnN0YXJ0VGVzdFNlc3Npb25GdW5jdGlvbixcbiAgICAgIHRoaXMuc3VibWl0QW5zd2VyRnVuY3Rpb24sXG4gICAgICB0aGlzLmVuZFRlc3RTZXNzaW9uRnVuY3Rpb24sXG4gICAgICB0aGlzLnBhcmVudENoYXRDcmVhdGVGdW5jdGlvbixcbiAgICAgIHRoaXMucGFyZW50Q2hhdFNlbmRGdW5jdGlvbixcbiAgICAgIHRoaXMucGFyZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbixcbiAgICAgIHRoaXMucGFyZW50Q2hhdEdldE1lc3NhZ2VzRnVuY3Rpb24sXG4gICAgICB0aGlzLnBhcmVudENoYXRFbmRTZXNzaW9uRnVuY3Rpb24sXG4gICAgICB0aGlzLnN0dWRlbnRDaGF0Q3JlYXRlRnVuY3Rpb24sXG4gICAgICB0aGlzLnN0dWRlbnRDaGF0U2VuZEZ1bmN0aW9uLFxuICAgICAgdGhpcy5zdHVkZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbixcbiAgICAgIHRoaXMuc3R1ZGVudENoYXRHZXRNZXNzYWdlc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5zdHVkZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbixcbiAgICAgIHRoaXMud2Vic29ja2V0Q29ubmVjdEZ1bmN0aW9uLFxuICAgICAgdGhpcy53ZWJzb2NrZXREaXNjb25uZWN0RnVuY3Rpb24sXG4gICAgICB0aGlzLnRpbWVyU3luY0Z1bmN0aW9uLFxuICAgICAgdGhpcy5jYWxjdWxhdGVQcm9maWxlRnVuY3Rpb24sXG4gICAgICB0aGlzLnN1bW1hcml6YXRpb25Xb3JrZXJGdW5jdGlvbixcbiAgICAgIHRoaXMuaW5zaWdodHNXb3JrZXJGdW5jdGlvbixcbiAgICAgIHRoaXMuYWRtaW5DcmVhdGVRdWVzdGlvbkZ1bmN0aW9uLFxuICAgICAgdGhpcy5hZG1pblVwZGF0ZVF1ZXN0aW9uRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluRGVsZXRlUXVlc3Rpb25GdW5jdGlvbixcbiAgICAgIHRoaXMuYWRtaW5MaXN0UXVlc3Rpb25zRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluSW1wb3J0UXVlc3Rpb25zRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluRXhwb3J0UXVlc3Rpb25zRnVuY3Rpb24sXG4gICAgICB0aGlzLmFkbWluU3lzdGVtTWV0cmljc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5hZG1pblN0dWRlbnRBbmFseXRpY3NGdW5jdGlvbixcbiAgICBdO1xuXG4gICAgY29uc3Qgc2VjcmV0UmVhZFBvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3NlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlJyxcbiAgICAgICAgJ3NlY3JldHNtYW5hZ2VyOkRlc2NyaWJlU2VjcmV0JyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFthdXJvcmFTZWNyZXQuc2VjcmV0QXJuXSxcbiAgICB9KTtcblxuICAgIGFsbEZ1bmN0aW9ucy5mb3JFYWNoKChmbikgPT4ge1xuICAgICAgZm4uYWRkVG9Sb2xlUG9saWN5KHNlY3JldFJlYWRQb2xpY3kpO1xuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gMTEuIE9VVFBVVFNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMYW1iZGFGdW5jdGlvbnNEZXBsb3llZCcsIHtcbiAgICAgIHZhbHVlOiAnMjQgZnVuY3Rpb25zIGRlcGxveWVkIHN1Y2Nlc3NmdWxseScsXG4gICAgICBkZXNjcmlwdGlvbjogJ051bWJlciBvZiBMYW1iZGEgZnVuY3Rpb25zIGRlcGxveWVkJyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YWdzIHRvIGFsbCBMYW1iZGEgZnVuY3Rpb25zXG4gICAgY2RrLlRhZ3Mub2YodGhpcykuYWRkKCdTZXJ2aWNlJywgJ2VkdWxlbnMnKTtcbiAgICBjZGsuVGFncy5vZih0aGlzKS5hZGQoJ0Vudmlyb25tZW50JywgY29uZmlnLnN0YWdlKTtcbiAgfVxufVxuIl19