"use strict";
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
exports.ApiGatewayStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ApiGatewayStack extends cdk.Stack {
    constructor(scope, id, props) {
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
    addApiRoutes(fns) {
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
        studentStagesResource.addResource('{stageId}')
            .addMethod('POST', new apigateway.LambdaIntegration(fns.activateStudentStageFunction));
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
        adminResource.addResource('contest-series')
            .addMethod('POST', new apigateway.LambdaIntegration(fns.adminCreateContestSeriesFunction), { apiKeyRequired: true });
        const adminContestsResource = adminResource.addResource('contests');
        adminContestsResource.addMethod('POST', new apigateway.LambdaIntegration(fns.adminCreateContestFunction), { apiKeyRequired: true });
        const adminContestByIdResource = adminContestsResource.addResource('{id}');
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
exports.ApiGatewayStack = ApiGatewayStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWdhdGV3YXktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcGktZ2F0ZXdheS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsdUVBQXlEO0FBQ3pELDJFQUE2RDtBQUU3RCwyREFBNkM7QUF1RTdDLE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQU81QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFFckIsK0RBQStEO1FBQy9ELG1CQUFtQjtRQUNuQiwrREFBK0Q7UUFFL0QsTUFBTSxXQUFXLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUM1RCxZQUFZLEVBQUUsMkJBQTJCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDdkQsU0FBUyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7WUFDbEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ3JELFdBQVcsRUFBRSxlQUFlLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDMUMsV0FBVyxFQUFFLHFCQUFxQixNQUFNLENBQUMsS0FBSyxHQUFHO1lBQ2pELE1BQU0sRUFBRSxJQUFJO1lBQ1osYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxNQUFNLENBQUMsS0FBSztnQkFDdkIsY0FBYyxF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VztZQUM1QixjQUFjLEVBQUUsc0JBQXNCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxxQ0FBcUMsR0FBRyxDQUFDLHdCQUF3QixDQUFDLFdBQVcsY0FBYztTQUNoSixDQUFDLENBQUM7UUFFSCxNQUFNLHFCQUFxQixHQUFHLElBQUksWUFBWSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUseUJBQXlCLEVBQUU7WUFDN0YsS0FBSyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRztZQUM1QixlQUFlLEVBQUUsV0FBVztZQUM1QixjQUFjLEVBQUUsc0JBQXNCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxxQ0FBcUMsR0FBRyxDQUFDLDJCQUEyQixDQUFDLFdBQVcsY0FBYztTQUNuSixDQUFDLENBQUM7UUFFSCxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ2hELEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUc7WUFDNUIsUUFBUSxFQUFFLFVBQVU7WUFDcEIsaUJBQWlCLEVBQUUsTUFBTTtZQUN6QixNQUFNLEVBQUUsZ0JBQWdCLGtCQUFrQixDQUFDLEdBQUcsRUFBRTtTQUNqRCxDQUFDLENBQUM7UUFFSCxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ25ELEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUc7WUFDNUIsUUFBUSxFQUFFLGFBQWE7WUFDdkIsaUJBQWlCLEVBQUUsTUFBTTtZQUN6QixNQUFNLEVBQUUsZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtTQUNwRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFqV0QsMENBaVdDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBUEkgR2F0ZXdheSBTdGFja1xuICpcbiAqIENyZWF0ZXMgUkVTVCBBUEkgYW5kIFdlYlNvY2tldCBBUEkgZm9yIEVkdUxlbnMgc2VydmljZXMuXG4gKiBDYWxsIGFkZEFwaVJvdXRlcygpIGZyb20gYXBwLnRzIGFmdGVyIExhbWJkYVN0YWNrIGlzIGNyZWF0ZWQgdG8gd2lyZVxuICogYWxsIExhbWJkYSBpbnRlZ3JhdGlvbnMuIFRoaXMga2VlcHMgdGhlIHN0YWNrIHNlcGFyYXRpb24gY2xlYW46XG4gKiAgIC0gQXBpR2F0ZXdheVN0YWNrIG93bnMgYWxsIEFQSSBHYXRld2F5IHJlc291cmNlcyAoUmVzdEFwaSwgcm91dGVzLCBtZXRob2RzKVxuICogICAtIExhbWJkYVN0YWNrIG93bnMgTGFtYmRhIGZ1bmN0aW9uc1xuICogICAtIE5vIGN5Y2xpYyBDbG91ZEZvcm1hdGlvbiBkZXBlbmRlbmNpZXNcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvZW52aXJvbm1lbnRzJztcblxuLyoqIFNoYXBlIG9mIExhbWJkYSBmdW5jdGlvbiByZWZlcmVuY2VzIG5lZWRlZCB0byB3aXJlIEFQSSByb3V0ZXMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXBpUm91dGVGdW5jdGlvbnMge1xuICAvLyBBdXRoXG4gIGxvZ2luRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcmVnaXN0ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBjcmVhdGVTdHVkZW50RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgbGlzdFN0dWRlbnRzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgc3R1ZGVudExvZ2luRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZGVsZXRlU3R1ZGVudEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIC8vIFRlc3QgRW5naW5lXG4gIGNyZWF0ZVRlc3RGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBnZXRUZXN0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZ2V0VGVzdHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBzdGFydFRlc3RTZXNzaW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgc3VibWl0QW5zd2VyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZW5kVGVzdFNlc3Npb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBnZXRSZXN1bHRzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZ2V0U3R1ZGVudFNlc3Npb25zRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgc3R1ZGVudEluc2lnaHRzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgLy8gQ29udmVyc2F0aW9uIEVuZ2luZVxuICBwYXJlbnRDaGF0Q3JlYXRlRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcGFyZW50Q2hhdFNlbmRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwYXJlbnRDaGF0R2V0TWVzc2FnZXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwYXJlbnRDaGF0RW5kU2Vzc2lvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHN0dWRlbnRDaGF0Q3JlYXRlRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgc3R1ZGVudENoYXRTZW5kRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgc3R1ZGVudENoYXRHZXRNZXNzYWdlc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIHN0dWRlbnRDaGF0RW5kU2Vzc2lvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIC8vIFdlYlNvY2tldFxuICB3ZWJzb2NrZXRDb25uZWN0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgd2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIC8vIFByb2ZpbGUgRW5naW5lXG4gIGVycm9yUGF0dGVybnNBZ2dyZWdhdGVGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBlcnJvclBhdHRlcm5zVHJlbmRzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgLy8gQWRtaW4gU2VydmljZVxuICBhZG1pbkNyZWF0ZVF1ZXN0aW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgYWRtaW5VcGRhdGVRdWVzdGlvbkZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIGFkbWluRGVsZXRlUXVlc3Rpb25GdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBhZG1pbkxpc3RRdWVzdGlvbnNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBhZG1pbkltcG9ydFF1ZXN0aW9uc0Z1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIGFkbWluRXhwb3J0UXVlc3Rpb25zRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgYWRtaW5TeXN0ZW1NZXRyaWNzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgYWRtaW5TdHVkZW50QW5hbHl0aWNzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgYWRtaW5TeXN0ZW1Db25maWdGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICAvLyBTdGFnZSBSZWdpc3RyeVxuICBsaXN0U3RhZ2VzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZ2V0U3RhZ2VGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBnZXRTa2lsbFRheG9ub215RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZ2V0U2tpbGxCcmlkZ2VzRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgbGlzdFN0dWRlbnRTdGFnZXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBhY3RpdmF0ZVN0dWRlbnRTdGFnZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIC8vIENvbnRlc3QgU2VydmljZVxuICBsaXN0Q29udGVzdHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICByZWdpc3RlckNvbnRlc3RGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBzdWJtaXRDb250ZXN0UmVzdWx0RnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZ2V0Q29udGVzdFJlc3VsdHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBhZG1pbkNyZWF0ZUNvbnRlc3RTZXJpZXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBhZG1pbkNyZWF0ZUNvbnRlc3RGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBhZG1pblVwZGF0ZUNvbnRlc3RTdGF0dXNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBhZG1pbkZpbmFsaXplQ29udGVzdFJlc3VsdHNGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBnZXRTdHVkZW50Q29udGVzdEhpc3RvcnlGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFwaUdhdGV3YXlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgQXBpR2F0ZXdheVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHJlc3RBcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldEFwaTogYXBpZ2F0ZXdheXYyLkNmbkFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldFN0YWdlOiBhcGlnYXRld2F5djIuQ2ZuU3RhZ2U7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcGlHYXRld2F5U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBjb25maWcgfSA9IHByb3BzO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUkVTVCBBUEkgR2F0ZXdheVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3QgYXBpTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQXBpR2F0ZXdheUxvZ3MnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2FwaWdhdGV3YXkvZWR1bGVucy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgcmV0ZW50aW9uOiBjb25maWcubG9nUmV0ZW50aW9uRGF5cyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICB0aGlzLnJlc3RBcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdSZXN0QXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGBlZHVsZW5zLWFwaS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246IGBFZHVMZW5zIFJFU1QgQVBJICgke2NvbmZpZy5zdGFnZX0pYCxcbiAgICAgIGRlcGxveTogdHJ1ZSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiBjb25maWcuc3RhZ2UsXG4gICAgICAgIG1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBsb2dnaW5nTGV2ZWw6IGFwaWdhdGV3YXkuTWV0aG9kTG9nZ2luZ0xldmVsLklORk8sXG4gICAgICAgIGRhdGFUcmFjZUVuYWJsZWQ6IGNvbmZpZy5zdGFnZSAhPT0gJ3Byb2QnLFxuICAgICAgICBhY2Nlc3NMb2dEZXN0aW5hdGlvbjogbmV3IGFwaWdhdGV3YXkuTG9nR3JvdXBMb2dEZXN0aW5hdGlvbihhcGlMb2dHcm91cCksXG4gICAgICAgIGFjY2Vzc0xvZ0Zvcm1hdDogYXBpZ2F0ZXdheS5BY2Nlc3NMb2dGb3JtYXQuanNvbldpdGhTdGFuZGFyZEZpZWxkcyh7XG4gICAgICAgICAgY2FsbGVyOiB0cnVlLFxuICAgICAgICAgIGh0dHBNZXRob2Q6IHRydWUsXG4gICAgICAgICAgaXA6IHRydWUsXG4gICAgICAgICAgcHJvdG9jb2w6IHRydWUsXG4gICAgICAgICAgcmVxdWVzdFRpbWU6IHRydWUsXG4gICAgICAgICAgcmVzb3VyY2VQYXRoOiB0cnVlLFxuICAgICAgICAgIHJlc3BvbnNlTGVuZ3RoOiB0cnVlLFxuICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICB1c2VyOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBjb25maWcuc3RhZ2UgPT09ICdwcm9kJ1xuICAgICAgICAgID8gWydodHRwczovL2FwcC5lZHVsZW5zLmNvbSddXG4gICAgICAgICAgOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQXBpLUtleScsICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXG4gICAgICAgIF0sXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICB9LFxuICAgICAgY2xvdWRXYXRjaFJvbGU6IHRydWUsXG4gICAgICBlbmRwb2ludFR5cGVzOiBbYXBpZ2F0ZXdheS5FbmRwb2ludFR5cGUuUkVHSU9OQUxdLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEtleSBhbmQgVXNhZ2UgUGxhbiAoZm9yIGFkbWluIGVuZHBvaW50cylcbiAgICBjb25zdCBhcGlLZXkgPSBuZXcgYXBpZ2F0ZXdheS5BcGlLZXkodGhpcywgJ0FwaUtleScsIHtcbiAgICAgIGFwaUtleU5hbWU6IGBlZHVsZW5zLWFkbWluLWtleS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgS2V5IGZvciBhZG1pbiBlbmRwb2ludHMnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNhZ2VQbGFuID0gdGhpcy5yZXN0QXBpLmFkZFVzYWdlUGxhbignVXNhZ2VQbGFuJywge1xuICAgICAgbmFtZTogYGVkdWxlbnMtdXNhZ2UtcGxhbi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgdGhyb3R0bGU6IHtcbiAgICAgICAgcmF0ZUxpbWl0OiBjb25maWcuc3RhZ2UgPT09ICdwcm9kJyA/IDUwMCA6IDUwLFxuICAgICAgICBidXJzdExpbWl0OiBjb25maWcuc3RhZ2UgPT09ICdwcm9kJyA/IDEwMDAgOiAxMDAsXG4gICAgICB9LFxuICAgICAgcXVvdGE6IHtcbiAgICAgICAgbGltaXQ6IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnID8gMTAwMDAwIDogMTAwMDAsXG4gICAgICAgIHBlcmlvZDogYXBpZ2F0ZXdheS5QZXJpb2QuREFZLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHVzYWdlUGxhbi5hZGRBcGlLZXkoYXBpS2V5KTtcbiAgICB1c2FnZVBsYW4uYWRkQXBpU3RhZ2UoeyBzdGFnZTogdGhpcy5yZXN0QXBpLmRlcGxveW1lbnRTdGFnZSB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFdlYlNvY2tldCBBUElcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMud2Vic29ja2V0QXBpID0gbmV3IGFwaWdhdGV3YXl2Mi5DZm5BcGkodGhpcywgJ1dlYlNvY2tldEFwaScsIHtcbiAgICAgIG5hbWU6IGBlZHVsZW5zLXdzLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBwcm90b2NvbFR5cGU6ICdXRUJTT0NLRVQnLFxuICAgICAgcm91dGVTZWxlY3Rpb25FeHByZXNzaW9uOiAnJHJlcXVlc3QuYm9keS5hY3Rpb24nLFxuICAgICAgZGVzY3JpcHRpb246IGBFZHVMZW5zIFdlYlNvY2tldCBBUEkgZm9yIHRpbWVyIHN5bmMgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICAgIH0pO1xuXG4gICAgdGhpcy53ZWJzb2NrZXRTdGFnZSA9IG5ldyBhcGlnYXRld2F5djIuQ2ZuU3RhZ2UodGhpcywgJ1dlYlNvY2tldFN0YWdlJywge1xuICAgICAgYXBpSWQ6IHRoaXMud2Vic29ja2V0QXBpLnJlZixcbiAgICAgIHN0YWdlTmFtZTogY29uZmlnLnN0YWdlLFxuICAgICAgZGVzY3JpcHRpb246IGBXZWJTb2NrZXQgc3RhZ2UgZm9yICR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxuICAgICAgZGVmYXVsdFJvdXRlU2V0dGluZ3M6IHtcbiAgICAgICAgdGhyb3R0bGluZ1JhdGVMaW1pdDogMTAwLFxuICAgICAgICB0aHJvdHRsaW5nQnVyc3RMaW1pdDogMjAwLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdXZWJTb2NrZXRMb2dzJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9hcGlnYXRld2F5L3dlYnNvY2tldC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgcmV0ZW50aW9uOiBjb25maWcubG9nUmV0ZW50aW9uRGF5cyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBPdXRwdXRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmVzdEFwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlc3RBcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdSRVNUIEFQSSBlbmRwb2ludCBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYGVkdWxlbnMtYXBpLXVybC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jlc3RBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlc3RBcGkucmVzdEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdSRVNUIEFQSSBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0QXBpVXJsJywge1xuICAgICAgdmFsdWU6IGB3c3M6Ly8ke3RoaXMud2Vic29ja2V0QXBpLnJlZn0uZXhlY3V0ZS1hcGkuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgQVBJIGVuZHBvaW50IFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgZWR1bGVucy13cy11cmwtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNvY2tldEFwaS5yZWYsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBBUEkgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYGVkdWxlbnMtd3MtYXBpLWlkLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpS2V5SWQnLCB7XG4gICAgICB2YWx1ZTogYXBpS2V5LmtleUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgS2V5IElEIChmb3IgYWRtaW4gZW5kcG9pbnRzKScsXG4gICAgfSk7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gV2lyZSBSRVNUIEFQSSByb3V0ZXMgKyBXZWJTb2NrZXQgaW50ZWdyYXRpb25zIChjYWxsZWQgZnJvbSBhcHAudHMpXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gIGFkZEFwaVJvdXRlcyhmbnM6IEFwaVJvdXRlRnVuY3Rpb25zKTogdm9pZCB7XG4gICAgY29uc3QgYXBpID0gdGhpcy5yZXN0QXBpO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEF1dGggZW5kcG9pbnRzICAvYXV0aC8uLi5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgYXV0aFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2F1dGgnKTtcbiAgICBhdXRoUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmxvZ2luRnVuY3Rpb24pKTtcblxuICAgIGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZSgnbG9naW4nKVxuICAgICAgLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5sb2dpbkZ1bmN0aW9uKSk7XG5cbiAgICBhdXRoUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3JlZ2lzdGVyJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMucmVnaXN0ZXJGdW5jdGlvbikpO1xuXG4gICAgYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdjcmVhdGUtc3R1ZGVudCcpXG4gICAgICAuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmNyZWF0ZVN0dWRlbnRGdW5jdGlvbikpO1xuXG4gICAgYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdzdHVkZW50cycpXG4gICAgICAuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMubGlzdFN0dWRlbnRzRnVuY3Rpb24pKTtcblxuICAgIGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3R1ZGVudC1sb2dpbicpXG4gICAgICAuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLnN0dWRlbnRMb2dpbkZ1bmN0aW9uKSk7XG5cbiAgICBhdXRoUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2RlbGV0ZS1zdHVkZW50JylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuZGVsZXRlU3R1ZGVudEZ1bmN0aW9uKSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gVGVzdCBFbmdpbmUgIC90ZXN0cy8uLi4gYW5kIC9zZXNzaW9ucy8uLi5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgdGVzdHNSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCd0ZXN0cycpO1xuICAgIHRlc3RzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmNyZWF0ZVRlc3RGdW5jdGlvbikpO1xuICAgIHRlc3RzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuZ2V0VGVzdHNGdW5jdGlvbikpO1xuXG4gICAgdGVzdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3Rlc3RJZH0nKVxuICAgICAgLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmdldFRlc3RGdW5jdGlvbikpO1xuXG4gICAgY29uc3Qgc2Vzc2lvbnNSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdzZXNzaW9ucycpO1xuICAgIHNlc3Npb25zUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLnN0YXJ0VGVzdFNlc3Npb25GdW5jdGlvbikpO1xuXG4gICAgY29uc3Qgc2Vzc2lvbklkUmVzb3VyY2UgPSBzZXNzaW9uc1Jlc291cmNlLmFkZFJlc291cmNlKCd7c2Vzc2lvbklkfScpO1xuICAgIHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdhbnN3ZXJzJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuc3VibWl0QW5zd2VyRnVuY3Rpb24pKTtcbiAgICBzZXNzaW9uSWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZW5kJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuZW5kVGVzdFNlc3Npb25GdW5jdGlvbikpO1xuICAgIHNlc3Npb25JZFJlc291cmNlLmFkZFJlc291cmNlKCdyZXN1bHRzJylcbiAgICAgIC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5nZXRSZXN1bHRzRnVuY3Rpb24pKTtcblxuICAgIC8vIC9zZXNzaW9ucy9zdHVkZW50L3tzdHVkZW50SWR9XG4gICAgc2Vzc2lvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3R1ZGVudCcpXG4gICAgICAuYWRkUmVzb3VyY2UoJ3tzdHVkZW50SWR9JylcbiAgICAgIC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5nZXRTdHVkZW50U2Vzc2lvbnNGdW5jdGlvbikpO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFN0dWRlbnRzICAvc3R1ZGVudHMve3N0dWRlbnRJZH0vLi4uXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHN0dWRlbnRzUm9vdFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3N0dWRlbnRzJyk7XG4gICAgY29uc3Qgc3R1ZGVudEJ5SWRSZXNvdXJjZSA9IHN0dWRlbnRzUm9vdFJlc291cmNlLmFkZFJlc291cmNlKCd7c3R1ZGVudElkfScpO1xuXG4gICAgLy8gL3N0dWRlbnRzL3tzdHVkZW50SWR9L2luc2lnaHRzXG4gICAgY29uc3QgaW5zaWdodHNSZXNvdXJjZSA9IHN0dWRlbnRCeUlkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2luc2lnaHRzJyk7XG4gICAgaW5zaWdodHNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5zdHVkZW50SW5zaWdodHNGdW5jdGlvbikpO1xuICAgIGluc2lnaHRzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLnN0dWRlbnRJbnNpZ2h0c0Z1bmN0aW9uKSk7XG5cbiAgICAvLyAvc3R1ZGVudHMve3N0dWRlbnRJZH0vZXJyb3ItcGF0dGVybnMvYWdncmVnYXRlfHRyZW5kc1xuICAgIGNvbnN0IGVycm9yUGF0dGVybnNSZXNvdXJjZSA9IHN0dWRlbnRCeUlkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2Vycm9yLXBhdHRlcm5zJyk7XG4gICAgZXJyb3JQYXR0ZXJuc1Jlc291cmNlLmFkZFJlc291cmNlKCdhZ2dyZWdhdGUnKVxuICAgICAgLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmVycm9yUGF0dGVybnNBZ2dyZWdhdGVGdW5jdGlvbikpO1xuICAgIGVycm9yUGF0dGVybnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgndHJlbmRzJylcbiAgICAgIC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5lcnJvclBhdHRlcm5zVHJlbmRzRnVuY3Rpb24pKTtcblxuICAgIC8vIC9zdHVkZW50cy97c3R1ZGVudElkfS9jb250ZXN0LWhpc3RvcnlcbiAgICBzdHVkZW50QnlJZFJlc291cmNlLmFkZFJlc291cmNlKCdjb250ZXN0LWhpc3RvcnknKVxuICAgICAgLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmdldFN0dWRlbnRDb250ZXN0SGlzdG9yeUZ1bmN0aW9uKSk7XG5cbiAgICAvLyAvc3R1ZGVudHMve3N0dWRlbnRJZH0vc3RhZ2VzICAoU3RhZ2UgUmVnaXN0cnkgZW5yb2xsbWVudClcbiAgICBjb25zdCBzdHVkZW50U3RhZ2VzUmVzb3VyY2UgPSBzdHVkZW50QnlJZFJlc291cmNlLmFkZFJlc291cmNlKCdzdGFnZXMnKTtcbiAgICBzdHVkZW50U3RhZ2VzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMubGlzdFN0dWRlbnRTdGFnZXNGdW5jdGlvbikpO1xuICAgIHN0dWRlbnRTdGFnZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3N0YWdlSWR9JylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuYWN0aXZhdGVTdHVkZW50U3RhZ2VGdW5jdGlvbikpO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIENvbnZlcnNhdGlvbiBFbmdpbmUgIC9wYXJlbnQtY2hhdC8uLi4gYW5kIC9zdHVkZW50LWNoYXQvLi4uXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGNvbnN0IHBhcmVudENoYXRSZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdwYXJlbnQtY2hhdCcpO1xuICAgIHBhcmVudENoYXRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMucGFyZW50Q2hhdENyZWF0ZUZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBwYXJlbnRTZXNzaW9uUmVzb3VyY2UgPSBwYXJlbnRDaGF0UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tzZXNzaW9uSWR9Jyk7XG4gICAgcGFyZW50U2Vzc2lvblJlc291cmNlLmFkZFJlc291cmNlKCdtZXNzYWdlJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMucGFyZW50Q2hhdFNlbmRGdW5jdGlvbikpO1xuICAgIHBhcmVudFNlc3Npb25SZXNvdXJjZS5hZGRSZXNvdXJjZSgnbWVzc2FnZXMnKVxuICAgICAgLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLnBhcmVudENoYXRHZXRNZXNzYWdlc0Z1bmN0aW9uKSk7XG4gICAgcGFyZW50U2Vzc2lvblJlc291cmNlLmFkZFJlc291cmNlKCdlbmQnKVxuICAgICAgLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5wYXJlbnRDaGF0RW5kU2Vzc2lvbkZ1bmN0aW9uKSk7XG5cbiAgICBjb25zdCBzdHVkZW50Q2hhdFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3N0dWRlbnQtY2hhdCcpO1xuICAgIHN0dWRlbnRDaGF0UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLnN0dWRlbnRDaGF0Q3JlYXRlRnVuY3Rpb24pKTtcblxuICAgIGNvbnN0IHN0dWRlbnRTZXNzaW9uUmVzb3VyY2UgPSBzdHVkZW50Q2hhdFJlc291cmNlLmFkZFJlc291cmNlKCd7c2Vzc2lvbklkfScpO1xuICAgIHN0dWRlbnRTZXNzaW9uUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ21lc3NhZ2UnKVxuICAgICAgLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5zdHVkZW50Q2hhdFNlbmRGdW5jdGlvbikpO1xuICAgIHN0dWRlbnRTZXNzaW9uUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ21lc3NhZ2VzJylcbiAgICAgIC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5zdHVkZW50Q2hhdEdldE1lc3NhZ2VzRnVuY3Rpb24pKTtcbiAgICBzdHVkZW50U2Vzc2lvblJlc291cmNlLmFkZFJlc291cmNlKCdlbmQnKVxuICAgICAgLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5zdHVkZW50Q2hhdEVuZFNlc3Npb25GdW5jdGlvbikpO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFN0YWdlIFJlZ2lzdHJ5ICAvc3RhZ2VzLy4uLlxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBzdGFnZXNSb290UmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnc3RhZ2VzJyk7XG4gICAgc3RhZ2VzUm9vdFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmxpc3RTdGFnZXNGdW5jdGlvbikpO1xuXG4gICAgY29uc3Qgc3RhZ2VCeUlkUmVzb3VyY2UgPSBzdGFnZXNSb290UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tpZH0nKTtcbiAgICBzdGFnZUJ5SWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5nZXRTdGFnZUZ1bmN0aW9uKSk7XG4gICAgc3RhZ2VCeUlkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3NraWxsLXRheG9ub215JylcbiAgICAgIC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5nZXRTa2lsbFRheG9ub215RnVuY3Rpb24pKTtcbiAgICBzdGFnZUJ5SWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYnJpZGdlcycpXG4gICAgICAuYWRkUmVzb3VyY2UoJ3t0b0lkfScpXG4gICAgICAuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuZ2V0U2tpbGxCcmlkZ2VzRnVuY3Rpb24pKTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBDb250ZXN0IFNlcnZpY2UgIC9jb250ZXN0cy8uLi5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgY29udGVzdHNSb290UmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgnY29udGVzdHMnKTtcbiAgICBjb250ZXN0c1Jvb3RSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5saXN0Q29udGVzdHNGdW5jdGlvbikpO1xuXG4gICAgY29uc3QgY29udGVzdEJ5SWRSZXNvdXJjZSA9IGNvbnRlc3RzUm9vdFJlc291cmNlLmFkZFJlc291cmNlKCd7aWR9Jyk7XG4gICAgY29udGVzdEJ5SWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgncmVnaXN0ZXInKVxuICAgICAgLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5yZWdpc3RlckNvbnRlc3RGdW5jdGlvbikpO1xuXG4gICAgY29uc3QgY29udGVzdFJlc3VsdHNSZXNvdXJjZSA9IGNvbnRlc3RCeUlkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3Jlc3VsdHMnKTtcbiAgICBjb250ZXN0UmVzdWx0c1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5zdWJtaXRDb250ZXN0UmVzdWx0RnVuY3Rpb24pKTtcbiAgICBjb250ZXN0UmVzdWx0c1Jlc291cmNlLmFkZFJlc291cmNlKCd7c3R1ZGVudElkfScpXG4gICAgICAuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuZ2V0Q29udGVzdFJlc3VsdHNGdW5jdGlvbikpO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIEFkbWluIFNlcnZpY2UgIC9hZG1pbi8uLi5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgYWRtaW5SZXNvdXJjZSA9IGFwaS5yb290LmFkZFJlc291cmNlKCdhZG1pbicpO1xuXG4gICAgY29uc3QgcXVlc3Rpb25zUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdxdWVzdGlvbnMnKTtcbiAgICBxdWVzdGlvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuYWRtaW5DcmVhdGVRdWVzdGlvbkZ1bmN0aW9uKSwgeyBhcGlLZXlSZXF1aXJlZDogdHJ1ZSB9KTtcbiAgICBxdWVzdGlvbnNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5hZG1pbkxpc3RRdWVzdGlvbnNGdW5jdGlvbiksIHsgYXBpS2V5UmVxdWlyZWQ6IHRydWUgfSk7XG5cbiAgICBjb25zdCBxdWVzdGlvbklkUmVzb3VyY2UgPSBxdWVzdGlvbnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3F1ZXN0aW9uSWR9Jyk7XG4gICAgcXVlc3Rpb25JZFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmFkbWluVXBkYXRlUXVlc3Rpb25GdW5jdGlvbiksIHsgYXBpS2V5UmVxdWlyZWQ6IHRydWUgfSk7XG4gICAgcXVlc3Rpb25JZFJlc291cmNlLmFkZE1ldGhvZCgnREVMRVRFJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmFkbWluRGVsZXRlUXVlc3Rpb25GdW5jdGlvbiksIHsgYXBpS2V5UmVxdWlyZWQ6IHRydWUgfSk7XG5cbiAgICBjb25zdCBidWxrUmVzb3VyY2UgPSBhZG1pblJlc291cmNlLmFkZFJlc291cmNlKCdidWxrJyk7XG4gICAgYnVsa1Jlc291cmNlLmFkZFJlc291cmNlKCdpbXBvcnQnKVxuICAgICAgLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5hZG1pbkltcG9ydFF1ZXN0aW9uc0Z1bmN0aW9uKSwgeyBhcGlLZXlSZXF1aXJlZDogdHJ1ZSB9KTtcbiAgICBidWxrUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2V4cG9ydCcpXG4gICAgICAuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuYWRtaW5FeHBvcnRRdWVzdGlvbnNGdW5jdGlvbiksIHsgYXBpS2V5UmVxdWlyZWQ6IHRydWUgfSk7XG5cbiAgICBjb25zdCBhbmFseXRpY3NSZXNvdXJjZSA9IGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FuYWx5dGljcycpO1xuICAgIGFuYWx5dGljc1Jlc291cmNlLmFkZFJlc291cmNlKCdtZXRyaWNzJylcbiAgICAgIC5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGZucy5hZG1pblN5c3RlbU1ldHJpY3NGdW5jdGlvbiksIHsgYXBpS2V5UmVxdWlyZWQ6IHRydWUgfSk7XG4gICAgYW5hbHl0aWNzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N0dWRlbnRzJylcbiAgICAgIC5hZGRSZXNvdXJjZSgne3N0dWRlbnRJZH0nKVxuICAgICAgLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmFkbWluU3R1ZGVudEFuYWx5dGljc0Z1bmN0aW9uKSwgeyBhcGlLZXlSZXF1aXJlZDogdHJ1ZSB9KTtcblxuICAgIGNvbnN0IGNvbmZpZ1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnY29uZmlnJyk7XG4gICAgY29uZmlnUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuYWRtaW5TeXN0ZW1Db25maWdGdW5jdGlvbiksIHsgYXBpS2V5UmVxdWlyZWQ6IHRydWUgfSk7XG4gICAgY29uZmlnUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuYWRtaW5TeXN0ZW1Db25maWdGdW5jdGlvbiksIHsgYXBpS2V5UmVxdWlyZWQ6IHRydWUgfSk7XG5cbiAgICAvLyBBZG1pbiBjb250ZXN0IGVuZHBvaW50c1xuICAgIGFkbWluUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2NvbnRlc3Qtc2VyaWVzJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuYWRtaW5DcmVhdGVDb250ZXN0U2VyaWVzRnVuY3Rpb24pLCB7IGFwaUtleVJlcXVpcmVkOiB0cnVlIH0pO1xuXG4gICAgY29uc3QgYWRtaW5Db250ZXN0c1Jlc291cmNlID0gYWRtaW5SZXNvdXJjZS5hZGRSZXNvdXJjZSgnY29udGVzdHMnKTtcbiAgICBhZG1pbkNvbnRlc3RzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmFkbWluQ3JlYXRlQ29udGVzdEZ1bmN0aW9uKSwgeyBhcGlLZXlSZXF1aXJlZDogdHJ1ZSB9KTtcblxuICAgIGNvbnN0IGFkbWluQ29udGVzdEJ5SWRSZXNvdXJjZSA9IGFkbWluQ29udGVzdHNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIGFkbWluQ29udGVzdEJ5SWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnc3RhdHVzJylcbiAgICAgIC5hZGRNZXRob2QoJ1BBVENIJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZm5zLmFkbWluVXBkYXRlQ29udGVzdFN0YXR1c0Z1bmN0aW9uKSwgeyBhcGlLZXlSZXF1aXJlZDogdHJ1ZSB9KTtcbiAgICBhZG1pbkNvbnRlc3RCeUlkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2ZpbmFsaXplJylcbiAgICAgIC5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihmbnMuYWRtaW5GaW5hbGl6ZUNvbnRlc3RSZXN1bHRzRnVuY3Rpb24pLCB7IGFwaUtleVJlcXVpcmVkOiB0cnVlIH0pO1xuXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFdlYlNvY2tldCByb3V0ZXMgICRjb25uZWN0IC8gJGRpc2Nvbm5lY3RcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgY29uc3QgY29ubmVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2Mi5DZm5JbnRlZ3JhdGlvbih0aGlzLCAnV3NDb25uZWN0SW50ZWdyYXRpb24nLCB7XG4gICAgICBhcGlJZDogdGhpcy53ZWJzb2NrZXRBcGkucmVmLFxuICAgICAgaW50ZWdyYXRpb25UeXBlOiAnQVdTX1BST1hZJyxcbiAgICAgIGludGVncmF0aW9uVXJpOiBgYXJuOmF3czphcGlnYXRld2F5OiR7Y2RrLkF3cy5SRUdJT059OmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLyR7Zm5zLndlYnNvY2tldENvbm5lY3RGdW5jdGlvbi5mdW5jdGlvbkFybn0vaW52b2NhdGlvbnNgLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGlzY29ubmVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2Mi5DZm5JbnRlZ3JhdGlvbih0aGlzLCAnV3NEaXNjb25uZWN0SW50ZWdyYXRpb24nLCB7XG4gICAgICBhcGlJZDogdGhpcy53ZWJzb2NrZXRBcGkucmVmLFxuICAgICAgaW50ZWdyYXRpb25UeXBlOiAnQVdTX1BST1hZJyxcbiAgICAgIGludGVncmF0aW9uVXJpOiBgYXJuOmF3czphcGlnYXRld2F5OiR7Y2RrLkF3cy5SRUdJT059OmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLyR7Zm5zLndlYnNvY2tldERpc2Nvbm5lY3RGdW5jdGlvbi5mdW5jdGlvbkFybn0vaW52b2NhdGlvbnNgLFxuICAgIH0pO1xuXG4gICAgbmV3IGFwaWdhdGV3YXl2Mi5DZm5Sb3V0ZSh0aGlzLCAnV3NDb25uZWN0Um91dGUnLCB7XG4gICAgICBhcGlJZDogdGhpcy53ZWJzb2NrZXRBcGkucmVmLFxuICAgICAgcm91dGVLZXk6ICckY29ubmVjdCcsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogJ05PTkUnLFxuICAgICAgdGFyZ2V0OiBgaW50ZWdyYXRpb25zLyR7Y29ubmVjdEludGVncmF0aW9uLnJlZn1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGFwaWdhdGV3YXl2Mi5DZm5Sb3V0ZSh0aGlzLCAnV3NEaXNjb25uZWN0Um91dGUnLCB7XG4gICAgICBhcGlJZDogdGhpcy53ZWJzb2NrZXRBcGkucmVmLFxuICAgICAgcm91dGVLZXk6ICckZGlzY29ubmVjdCcsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogJ05PTkUnLFxuICAgICAgdGFyZ2V0OiBgaW50ZWdyYXRpb25zLyR7ZGlzY29ubmVjdEludGVncmF0aW9uLnJlZn1gLFxuICAgIH0pO1xuICB9XG59XG4iXX0=