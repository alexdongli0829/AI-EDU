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
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
export interface LambdaStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
    vpc: ec2.Vpc;
    lambdaSecurityGroup: ec2.SecurityGroup;
    auroraSecret: secretsmanager.ISecret;
    redisEndpoint: string;
    restApi: apigateway.RestApi;
    alb: elbv2.ApplicationLoadBalancer;
    httpListener: elbv2.ApplicationListener;
    summarizationQueueArn: string;
    insightsQueueArn: string;
    eventBus: events.IEventBus;
    connectionsTable: dynamodb.Table;
    testCompletedRuleName: string;
    timerSyncRuleName: string;
}
export declare class LambdaStack extends cdk.Stack {
    readonly loginFunction: lambda.Function;
    readonly registerFunction: lambda.Function;
    readonly createStudentFunction: lambda.Function;
    readonly listStudentsFunction: lambda.Function;
    readonly studentLoginFunction: lambda.Function;
    readonly deleteStudentFunction: lambda.Function;
    readonly createTestFunction: lambda.Function;
    readonly getTestFunction: lambda.Function;
    readonly startTestSessionFunction: lambda.Function;
    readonly submitAnswerFunction: lambda.Function;
    readonly endTestSessionFunction: lambda.Function;
    readonly getTestsFunction: lambda.Function;
    readonly getResultsFunction: lambda.Function;
    readonly parentChatCreateFunction: lambda.Function;
    readonly parentChatSendFunction: lambda.Function;
    readonly parentChatSendStreamFunction: lambda.Function;
    readonly parentChatGetMessagesFunction: lambda.Function;
    readonly parentChatEndSessionFunction: lambda.Function;
    readonly studentChatCreateFunction: lambda.Function;
    readonly studentChatSendFunction: lambda.Function;
    readonly studentChatSendStreamFunction: lambda.Function;
    readonly studentChatGetMessagesFunction: lambda.Function;
    readonly studentChatEndSessionFunction: lambda.Function;
    readonly websocketConnectFunction: lambda.Function;
    readonly websocketDisconnectFunction: lambda.Function;
    readonly timerSyncFunction: lambda.Function;
    readonly calculateProfileFunction: lambda.Function;
    readonly summarizationWorkerFunction: lambda.Function;
    readonly insightsWorkerFunction: lambda.Function;
    readonly adminCreateQuestionFunction: lambda.Function;
    readonly adminUpdateQuestionFunction: lambda.Function;
    readonly adminDeleteQuestionFunction: lambda.Function;
    readonly adminListQuestionsFunction: lambda.Function;
    readonly adminImportQuestionsFunction: lambda.Function;
    readonly adminExportQuestionsFunction: lambda.Function;
    readonly adminSystemMetricsFunction: lambda.Function;
    readonly adminStudentAnalyticsFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: LambdaStackProps);
}
