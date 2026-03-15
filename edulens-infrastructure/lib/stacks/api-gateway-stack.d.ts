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
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
/** Shape of Lambda function references needed to wire API routes */
export interface ApiRouteFunctions {
    loginFunction: lambda.Function;
    registerFunction: lambda.Function;
    createStudentFunction: lambda.Function;
    listStudentsFunction: lambda.Function;
    studentLoginFunction: lambda.Function;
    deleteStudentFunction: lambda.Function;
    createTestFunction: lambda.Function;
    getTestFunction: lambda.Function;
    getTestsFunction: lambda.Function;
    startTestSessionFunction: lambda.Function;
    submitAnswerFunction: lambda.Function;
    endTestSessionFunction: lambda.Function;
    getResultsFunction: lambda.Function;
    getStudentSessionsFunction: lambda.Function;
    studentInsightsFunction: lambda.Function;
    parentChatCreateFunction: lambda.Function;
    parentChatSendFunction: lambda.Function;
    parentChatGetMessagesFunction: lambda.Function;
    parentChatEndSessionFunction: lambda.Function;
    studentChatCreateFunction: lambda.Function;
    studentChatSendFunction: lambda.Function;
    studentChatGetMessagesFunction: lambda.Function;
    studentChatEndSessionFunction: lambda.Function;
    websocketConnectFunction: lambda.Function;
    websocketDisconnectFunction: lambda.Function;
    errorPatternsAggregateFunction: lambda.Function;
    errorPatternsTrendsFunction: lambda.Function;
    adminCreateQuestionFunction: lambda.Function;
    adminUpdateQuestionFunction: lambda.Function;
    adminDeleteQuestionFunction: lambda.Function;
    adminListQuestionsFunction: lambda.Function;
    adminImportQuestionsFunction: lambda.Function;
    adminExportQuestionsFunction: lambda.Function;
    adminSystemMetricsFunction: lambda.Function;
    adminStudentAnalyticsFunction: lambda.Function;
    adminSystemConfigFunction: lambda.Function;
    listStagesFunction: lambda.Function;
    getStageFunction: lambda.Function;
    getSkillTaxonomyFunction: lambda.Function;
    getSkillBridgesFunction: lambda.Function;
    listStudentStagesFunction: lambda.Function;
    activateStudentStageFunction: lambda.Function;
    listContestsFunction: lambda.Function;
    registerContestFunction: lambda.Function;
    submitContestResultFunction: lambda.Function;
    getContestResultsFunction: lambda.Function;
    adminCreateContestSeriesFunction: lambda.Function;
    adminCreateContestFunction: lambda.Function;
    adminUpdateContestStatusFunction: lambda.Function;
    adminFinalizeContestResultsFunction: lambda.Function;
    getStudentContestHistoryFunction: lambda.Function;
}
export interface ApiGatewayStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
}
export declare class ApiGatewayStack extends cdk.Stack {
    readonly restApi: apigateway.RestApi;
    readonly websocketApi: apigatewayv2.CfnApi;
    readonly websocketStage: apigatewayv2.CfnStage;
    private readonly config;
    constructor(scope: Construct, id: string, props: ApiGatewayStackProps);
    addApiRoutes(fns: ApiRouteFunctions): void;
}
