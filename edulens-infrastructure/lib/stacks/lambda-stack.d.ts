/**
 * Lambda Stack
 *
 * Deploys all backend service Lambda functions and their IAM policies.
 * API Gateway routes   → api-gateway-stack.ts (addApiRoutes)
 * ALB target groups    → alb-stack.ts          (addTargetGroups)
 * EventBridge targets  → app.ts                (wireEventBridgeTargets)
 */
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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
    /** SQS queue ARN — pass as a constructed string to avoid cyclic CFN cross-stack refs */
    summarizationQueueArn: string;
    /** SQS queue ARN — pass as a constructed string to avoid cyclic CFN cross-stack refs */
    insightsQueueArn: string;
    /** EventBridge default bus ARN — pass as a constructed string */
    eventBusArn: string;
    connectionsTable: dynamodb.Table;
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
    readonly getStudentSessionsFunction: lambda.Function;
    readonly studentInsightsFunction: lambda.Function;
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
    readonly errorPatternsAggregateFunction: lambda.Function;
    readonly errorPatternsTrendsFunction: lambda.Function;
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
    readonly adminSystemConfigFunction: lambda.Function;
    readonly listStagesFunction: lambda.Function;
    readonly getStageFunction: lambda.Function;
    readonly getSkillTaxonomyFunction: lambda.Function;
    readonly getSkillBridgesFunction: lambda.Function;
    readonly listStudentStagesFunction: lambda.Function;
    readonly activateStudentStageFunction: lambda.Function;
    readonly listContestsFunction: lambda.Function;
    readonly registerContestFunction: lambda.Function;
    readonly submitContestResultFunction: lambda.Function;
    readonly getContestResultsFunction: lambda.Function;
    readonly adminCreateContestSeriesFunction: lambda.Function;
    readonly adminCreateContestFunction: lambda.Function;
    readonly adminUpdateContestStatusFunction: lambda.Function;
    readonly adminFinalizeContestResultsFunction: lambda.Function;
    readonly getStudentContestHistoryFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: LambdaStackProps);
}
