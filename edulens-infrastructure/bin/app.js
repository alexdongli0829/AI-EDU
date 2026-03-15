#!/usr/bin/env node
"use strict";
/**
 * EduLens CDK Application
 *
 * Stack deployment order:
 *   1. Network, Database          — foundational resources
 *   2. JobsStack                  — SQS queues + EventBridge rules (no Lambda deps)
 *   3. LambdaStack                — Lambda functions + IAM (no API/ALB deps)
 *   4. ApiGatewayStack            — REST API + WebSocket routes (wired after Lambda)
 *   5. AlbStack                   — ALB + SSE target groups  (wired after Lambda)
 *   6. EventBridge targets        — addTarget() calls using constructed ARNs (no cyclic CFN refs)
 *   7. MonitoringStack            — CloudWatch alarms
 *
 * Cyclic dependency strategy:
 *   LambdaStack receives queue/eventBus ARNs as constructed strings (not CDK tokens),
 *   so no Fn::ImportValue cross-stack reference is generated. EventBridge targets are
 *   added directly via CfnRule.targets with literal Lambda ARN strings, avoiding
 *   CDK's automatic Lambda::Permission creation in JobsStack (which would require
 *   Lambda to already exist and would force a circular addDependency). All
 *   Lambda::Permission resources for EventBridge live in LambdaStack.
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const network_stack_1 = require("../lib/stacks/network-stack");
const database_stack_1 = require("../lib/stacks/database-stack");
const api_gateway_stack_1 = require("../lib/stacks/api-gateway-stack");
const alb_stack_1 = require("../lib/stacks/alb-stack");
const jobs_stack_1 = require("../lib/stacks/jobs-stack");
const lambda_stack_1 = require("../lib/stacks/lambda-stack");
const monitoring_stack_1 = require("../lib/stacks/monitoring-stack");
const environments_1 = require("../config/environments");
const app = new cdk.App();
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const config = (0, environments_1.getConfig)(stage);
console.log(`Deploying to stage: ${stage}`);
console.log(`Account: ${config.account}`);
console.log(`Region: ${config.region}`);
const env = {
    account: config.account,
    region: config.region,
};
// ============================================================
// 1. Network Stack
// ============================================================
const networkStack = new network_stack_1.NetworkStack(app, `EduLensNetworkStack-${config.stage}`, {
    env,
    config,
    description: `EduLens Network Infrastructure (${config.stage})`,
    tags: config.tags,
});
// ============================================================
// 2. Database Stack
// ============================================================
const databaseStack = new database_stack_1.DatabaseStack(app, `EduLensDatabaseStack-${config.stage}`, {
    env,
    config,
    vpc: networkStack.vpc,
    rdsSecurityGroup: networkStack.rdsSecurityGroup,
    redisSecurityGroup: networkStack.redisSecurityGroup,
    description: `EduLens Database Infrastructure (${config.stage})`,
    tags: config.tags,
});
databaseStack.addDependency(networkStack);
// ============================================================
// 3. Jobs Stack  (SQS + EventBridge rules — no Lambda deps)
// ============================================================
const jobsStack = new jobs_stack_1.JobsStack(app, `EduLensJobsStack-${config.stage}`, {
    env,
    config,
    description: `EduLens Jobs Infrastructure (${config.stage})`,
    tags: config.tags,
});
// ============================================================
// 4. API Gateway Stack  (REST + WebSocket API skeleton)
// ============================================================
const apiGatewayStack = new api_gateway_stack_1.ApiGatewayStack(app, `EduLensApiGatewayStack-${config.stage}`, {
    env,
    config,
    description: `EduLens API Gateway Infrastructure (${config.stage})`,
    tags: config.tags,
});
// ============================================================
// 5. ALB Stack  (ALB + HTTP listener skeleton)
// ============================================================
const albStack = new alb_stack_1.AlbStack(app, `EduLensAlbStack-${config.stage}`, {
    env,
    config,
    vpc: networkStack.vpc,
    albSecurityGroup: networkStack.albSecurityGroup,
    description: `EduLens ALB Infrastructure (${config.stage})`,
    tags: config.tags,
});
albStack.addDependency(networkStack);
// ============================================================
// 6. Lambda Stack  (Lambda functions + IAM — no API/ALB deps)
//
// Queue/EventBus ARNs are passed as constructed strings to avoid
// bidirectional CloudFormation cross-stack references with JobsStack.
// ============================================================
const summarizationQueueArn = `arn:aws:sqs:${config.region}:${config.account}:edulens-summarization-queue-${config.stage}`;
const insightsQueueArn = `arn:aws:sqs:${config.region}:${config.account}:edulens-insights-queue-${config.stage}`;
const eventBusArn = `arn:aws:events:${config.region}:${config.account}:event-bus/default`;
const lambdaStack = new lambda_stack_1.LambdaStack(app, `EduLensLambdaStack-${config.stage}`, {
    env,
    config,
    vpc: networkStack.vpc,
    lambdaSecurityGroup: networkStack.lambdaSecurityGroup,
    auroraSecret: databaseStack.auroraSecret,
    redisEndpoint: databaseStack.redisEndpoint,
    summarizationQueueArn,
    insightsQueueArn,
    eventBusArn,
    connectionsTable: databaseStack.connectionsTable,
    description: `EduLens Lambda Functions (${config.stage})`,
    tags: config.tags,
});
lambdaStack.addDependency(networkStack);
lambdaStack.addDependency(databaseStack);
lambdaStack.addDependency(jobsStack); // ensures queues exist before Lambda tries to consume them
// ============================================================
// 7. Wire API Gateway routes (REST + WebSocket)
//    Happens after LambdaStack so function objects are available.
//    ApiGatewayStack → LambdaStack is one-directional; no cycle.
// ============================================================
apiGatewayStack.addApiRoutes(lambdaStack);
apiGatewayStack.addDependency(lambdaStack);
// ============================================================
// 8. Wire ALB SSE target groups
// ============================================================
albStack.addTargetGroups(lambdaStack.parentChatSendStreamFunction, lambdaStack.studentChatSendStreamFunction);
albStack.addDependency(lambdaStack);
// ============================================================
// 9. Wire EventBridge targets
//
// We set targets directly on the underlying CfnRule using literal
// Lambda ARN strings. This avoids CDK's automatic Lambda::Permission
// creation (which would be scoped to JobsStack and require Lambda to
// already exist — causing a deploy-time failure or forcing a circular
// addDependency). Lambda::Permission resources are already created in
// LambdaStack via addPermission() calls with constructed rule ARNs.
// ============================================================
const eventBridgeTargets = [
    { rule: jobsStack.testCompletedRule, targetId: 'CalcProfile', fnName: `edulens-calculate-profile-${config.stage}` },
    { rule: jobsStack.timerSyncRule, targetId: 'TimerSync', fnName: `edulens-timer-sync-${config.stage}` },
    { rule: jobsStack.dailyInsightsRule, targetId: 'StudentInsights', fnName: `edulens-student-insights-${config.stage}` },
    { rule: jobsStack.batchProcessingRule, targetId: 'InsightsWorker', fnName: `edulens-insights-worker-${config.stage}` },
];
for (const { rule, targetId, fnName } of eventBridgeTargets) {
    const cfnRule = rule.node.defaultChild;
    const existing = cfnRule.targets ?? [];
    cfnRule.targets = [
        ...existing,
        {
            id: targetId,
            arn: `arn:aws:lambda:${config.region}:${config.account}:function:${fnName}`,
        },
    ];
}
// No jobsStack.addDependency(lambdaStack) — targets use literal ARNs,
// so JobsStack's CloudFormation template has no reference to LambdaStack.
// ============================================================
// 10. Monitoring Stack
// ============================================================
const monitoringStack = new monitoring_stack_1.MonitoringStack(app, `EduLensMonitoringStack-${config.stage}`, {
    env,
    config,
    restApi: apiGatewayStack.restApi,
    auroraCluster: databaseStack.auroraCluster,
    summarizationQueue: jobsStack.summarizationQueue,
    insightsQueue: jobsStack.insightsQueue,
    summarizationDLQ: jobsStack.summarizationDLQ,
    insightsDLQ: jobsStack.insightsDLQ,
    lambdaFunctions: [
        lambdaStack.createTestFunction,
        lambdaStack.startTestSessionFunction,
        lambdaStack.submitAnswerFunction,
        lambdaStack.endTestSessionFunction,
        lambdaStack.parentChatSendStreamFunction,
        lambdaStack.studentChatSendStreamFunction,
        lambdaStack.calculateProfileFunction,
        lambdaStack.summarizationWorkerFunction,
        lambdaStack.insightsWorkerFunction,
        lambdaStack.adminSystemMetricsFunction,
    ],
    description: `EduLens Monitoring Infrastructure (${config.stage})`,
    tags: config.tags,
});
monitoringStack.addDependency(lambdaStack);
monitoringStack.addDependency(apiGatewayStack);
// Tag all stacks
cdk.Tags.of(app).add('Project', 'EduLens');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Stage', config.stage);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUVuQywrREFBMkQ7QUFDM0QsaUVBQTZEO0FBQzdELHVFQUFrRTtBQUNsRSx1REFBbUQ7QUFDbkQseURBQXFEO0FBQ3JELDZEQUF5RDtBQUN6RCxxRUFBaUU7QUFDakUseURBQW1EO0FBRW5ELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQztBQUM1RSxNQUFNLE1BQU0sR0FBRyxJQUFBLHdCQUFTLEVBQUMsS0FBSyxDQUFDLENBQUM7QUFFaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBRXhDLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO0lBQ3ZCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtDQUN0QixDQUFDO0FBRUYsK0RBQStEO0FBQy9ELG1CQUFtQjtBQUNuQiwrREFBK0Q7QUFFL0QsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEdBQUcsRUFBRSx1QkFBdUIsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2hGLEdBQUc7SUFDSCxNQUFNO0lB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YUFBYSxFQUFFLFNBQVMsQ0FBQyxhQUFhO0lBQ3RDLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxnQkFBZ0I7SUFDNUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxXQUFXO0lBQ2xDLGVBQWUsRUFBRTtRQUNmLFdBQVcsQ0FBQyxrQkFBa0I7UUFDOUIsV0FBVyxDQUFDLHdCQUF3QjtRQUNwQyxXQUFXLENBQUMsb0JBQW9CO1FBQ2hDLFdBQVcsQ0FBQyxzQkFBc0I7UUFDbEMsV0FBVyxDQUFDLDRCQUE0QjtRQUN4QyxXQUFXLENBQUMsNkJBQTZCO1FBQ3pDLFdBQVcsQ0FBQyx3QkFBd0I7UUFDcEMsV0FBVyxDQUFDLDJCQUEyQjtRQUN2QyxXQUFXLENBQUMsc0JBQXNCO1FBQ2xDLFdBQVcsQ0FBQywwQkFBMEI7S0FDdkM7SUFDRCxXQUFXLEVBQUUsc0NBQXNDLE1BQU0sQ0FBQyxLQUFLLEdBQUc7SUFDbEUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO0NBQ2xCLENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDM0MsZUFBZSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUUvQyxpQkFBaUI7QUFDakIsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztBQUMzQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRTVDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogRWR1TGVucyBDREsgQXBwbGljYXRpb25cbiAqXG4gKiBTdGFjayBkZXBsb3ltZW50IG9yZGVyOlxuICogICAxLiBOZXR3b3JrLCBEYXRhYmFzZSAgICAgICAgICDigJQgZm91bmRhdGlvbmFsIHJlc291cmNlc1xuICogICAyLiBKb2JzU3RhY2sgICAgICAgICAgICAgICAgICDigJQgU1FTIHF1ZXVlcyArIEV2ZW50QnJpZGdlIHJ1bGVzIChubyBMYW1iZGEgZGVwcylcbiAqICAgMy4gTGFtYmRhU3RhY2sgICAgICAgICAgICAgICAg4oCUIExhbWJkYSBmdW5jdGlvbnMgKyBJQU0gKG5vIEFQSS9BTEIgZGVwcylcbiAqICAgNC4gQXBpR2F0ZXdheVN0YWNrICAgICAgICAgICAg4oCUIFJFU1QgQVBJICsgV2ViU29ja2V0IHJvdXRlcyAod2lyZWQgYWZ0ZXIgTGFtYmRhKVxuICogICA1LiBBbGJTdGFjayAgICAgICAgICAgICAgICAgICDigJQgQUxCICsgU1NFIHRhcmdldCBncm91cHMgICh3aXJlZCBhZnRlciBMYW1iZGEpXG4gKiAgIDYuIEV2ZW50QnJpZGdlIHRhcmdldHMgICAgICAgIOKAlCBhZGRUYXJnZXQoKSBjYWxscyB1c2luZyBjb25zdHJ1Y3RlZCBBUk5zIChubyBjeWNsaWMgQ0ZOIHJlZnMpXG4gKiAgIDcuIE1vbml0b3JpbmdTdGFjayAgICAgICAgICAgIOKAlCBDbG91ZFdhdGNoIGFsYXJtc1xuICpcbiAqIEN5Y2xpYyBkZXBlbmRlbmN5IHN0cmF0ZWd5OlxuICogICBMYW1iZGFTdGFjayByZWNlaXZlcyBxdWV1ZS9ldmVudEJ1cyBBUk5zIGFzIGNvbnN0cnVjdGVkIHN0cmluZ3MgKG5vdCBDREsgdG9rZW5zKSxcbiAqICAgc28gbm8gRm46OkltcG9ydFZhbHVlIGNyb3NzLXN0YWNrIHJlZmVyZW5jZSBpcyBnZW5lcmF0ZWQuIEV2ZW50QnJpZGdlIHRhcmdldHMgYXJlXG4gKiAgIGFkZGVkIGRpcmVjdGx5IHZpYSBDZm5SdWxlLnRhcmdldHMgd2l0aCBsaXRlcmFsIExhbWJkYSBBUk4gc3RyaW5ncywgYXZvaWRpbmdcbiAqICAgQ0RLJ3MgYXV0b21hdGljIExhbWJkYTo6UGVybWlzc2lvbiBjcmVhdGlvbiBpbiBKb2JzU3RhY2sgKHdoaWNoIHdvdWxkIHJlcXVpcmVcbiAqICAgTGFtYmRhIHRvIGFscmVhZHkgZXhpc3QgYW5kIHdvdWxkIGZvcmNlIGEgY2lyY3VsYXIgYWRkRGVwZW5kZW5jeSkuIEFsbFxuICogICBMYW1iZGE6OlBlcm1pc3Npb24gcmVzb3VyY2VzIGZvciBFdmVudEJyaWRnZSBsaXZlIGluIExhbWJkYVN0YWNrLlxuICovXG5cbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgeyBOZXR3b3JrU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL25ldHdvcmstc3RhY2snO1xuaW1wb3J0IHsgRGF0YWJhc2VTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvZGF0YWJhc2Utc3RhY2snO1xuaW1wb3J0IHsgQXBpR2F0ZXdheVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9hcGktZ2F0ZXdheS1zdGFjayc7XG5pbXBvcnQgeyBBbGJTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvYWxiLXN0YWNrJztcbmltcG9ydCB7IEpvYnNTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3Mvam9icy1zdGFjayc7XG5pbXBvcnQgeyBMYW1iZGFTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvbGFtYmRhLXN0YWNrJztcbmltcG9ydCB7IE1vbml0b3JpbmdTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvbW9uaXRvcmluZy1zdGFjayc7XG5pbXBvcnQgeyBnZXRDb25maWcgfSBmcm9tICcuLi9jb25maWcvZW52aXJvbm1lbnRzJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuY29uc3Qgc3RhZ2UgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFnZScpIHx8IHByb2Nlc3MuZW52LlNUQUdFIHx8ICdkZXYnO1xuY29uc3QgY29uZmlnID0gZ2V0Q29uZmlnKHN0YWdlKTtcblxuY29uc29sZS5sb2coYERlcGxveWluZyB0byBzdGFnZTogJHtzdGFnZX1gKTtcbmNvbnNvbGUubG9nKGBBY2NvdW50OiAke2NvbmZpZy5hY2NvdW50fWApO1xuY29uc29sZS5sb2coYFJlZ2lvbjogJHtjb25maWcucmVnaW9ufWApO1xuXG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IGNvbmZpZy5hY2NvdW50LFxuICByZWdpb246IGNvbmZpZy5yZWdpb24sXG59O1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIDEuIE5ldHdvcmsgU3RhY2tcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBuZXR3b3JrU3RhY2sgPSBuZXcgTmV0d29ya1N0YWNrKGFwcCwgYEVkdUxlbnNOZXR3b3JrU3RhY2stJHtjb25maWcuc3RhZ2V9YCwge1xuICBlbnYsXG4gIGNvbmZpZyxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIE5ldHdvcmsgSW5mcmFzdHJ1Y3R1cmUgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIDIuIERhdGFiYXNlIFN0YWNrXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgZGF0YWJhc2VTdGFjayA9IG5ldyBEYXRhYmFzZVN0YWNrKGFwcCwgYEVkdUxlbnNEYXRhYmFzZVN0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIHZwYzogbmV0d29ya1N0YWNrLnZwYyxcbiAgcmRzU2VjdXJpdHlHcm91cDogbmV0d29ya1N0YWNrLnJkc1NlY3VyaXR5R3JvdXAsXG4gIHJlZGlzU2VjdXJpdHlHcm91cDogbmV0d29ya1N0YWNrLnJlZGlzU2VjdXJpdHlHcm91cCxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIERhdGFiYXNlIEluZnJhc3RydWN0dXJlICgke2NvbmZpZy5zdGFnZX0pYCxcbiAgdGFnczogY29uZmlnLnRhZ3MsXG59KTtcblxuZGF0YWJhc2VTdGFjay5hZGREZXBlbmRlbmN5KG5ldHdvcmtTdGFjayk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gMy4gSm9icyBTdGFjayAgKFNRUyArIEV2ZW50QnJpZGdlIHJ1bGVzIOKAlCBubyBMYW1iZGEgZGVwcylcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBqb2JzU3RhY2sgPSBuZXcgSm9ic1N0YWNrKGFwcCwgYEVkdUxlbnNKb2JzU3RhY2stJHtjb25maWcuc3RhZ2V9YCwge1xuICBlbnYsXG4gIGNvbmZpZyxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIEpvYnMgSW5mcmFzdHJ1Y3R1cmUgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIDQuIEFQSSBHYXRld2F5IFN0YWNrICAoUkVTVCArIFdlYlNvY2tldCBBUEkgc2tlbGV0b24pXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgYXBpR2F0ZXdheVN0YWNrID0gbmV3IEFwaUdhdGV3YXlTdGFjayhhcHAsIGBFZHVMZW5zQXBpR2F0ZXdheVN0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBBUEkgR2F0ZXdheSBJbmZyYXN0cnVjdHVyZSAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gNS4gQUxCIFN0YWNrICAoQUxCICsgSFRUUCBsaXN0ZW5lciBza2VsZXRvbilcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBhbGJTdGFjayA9IG5ldyBBbGJTdGFjayhhcHAsIGBFZHVMZW5zQWxiU3RhY2stJHtjb25maWcuc3RhZ2V9YCwge1xuICBlbnYsXG4gIGNvbmZpZyxcbiAgdnBjOiBuZXR3b3JrU3RhY2sudnBjLFxuICBhbGJTZWN1cml0eUdyb3VwOiBuZXR3b3JrU3RhY2suYWxiU2VjdXJpdHlHcm91cCxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIEFMQiBJbmZyYXN0cnVjdHVyZSAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbmFsYlN0YWNrLmFkZERlcGVuZGVuY3kobmV0d29ya1N0YWNrKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA2LiBMYW1iZGEgU3RhY2sgIChMYW1iZGEgZnVuY3Rpb25zICsgSUFNIOKAlCBubyBBUEkvQUxCIGRlcHMpXG4vL1xuLy8gUXVldWUvRXZlbnRCdXMgQVJOcyBhcmUgcGFzc2VkIGFzIGNvbnN0cnVjdGVkIHN0cmluZ3MgdG8gYXZvaWRcbi8vIGJpZGlyZWN0aW9uYWwgQ2xvdWRGb3JtYXRpb24gY3Jvc3Mtc3RhY2sgcmVmZXJlbmNlcyB3aXRoIEpvYnNTdGFjay5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBzdW1tYXJpemF0aW9uUXVldWVBcm4gPSBgYXJuOmF3czpzcXM6JHtjb25maWcucmVnaW9ufToke2NvbmZpZy5hY2NvdW50fTplZHVsZW5zLXN1bW1hcml6YXRpb24tcXVldWUtJHtjb25maWcuc3RhZ2V9YDtcbmNvbnN0IGluc2lnaHRzUXVldWVBcm4gICAgICA9IGBhcm46YXdzOnNxczoke2NvbmZpZy5yZWdpb259OiR7Y29uZmlnLmFjY291bnR9OmVkdWxlbnMtaW5zaWdodHMtcXVldWUtJHtjb25maWcuc3RhZ2V9YDtcbmNvbnN0IGV2ZW50QnVzQXJuICAgICAgICAgICA9IGBhcm46YXdzOmV2ZW50czoke2NvbmZpZy5yZWdpb259OiR7Y29uZmlnLmFjY291bnR9OmV2ZW50LWJ1cy9kZWZhdWx0YDtcblxuY29uc3QgbGFtYmRhU3RhY2sgPSBuZXcgTGFtYmRhU3RhY2soYXBwLCBgRWR1TGVuc0xhbWJkYVN0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIHZwYzogbmV0d29ya1N0YWNrLnZwYyxcbiAgbGFtYmRhU2VjdXJpdHlHcm91cDogbmV0d29ya1N0YWNrLmxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gIGF1cm9yYVNlY3JldDogZGF0YWJhc2VTdGFjay5hdXJvcmFTZWNyZXQsXG4gIHJlZGlzRW5kcG9pbnQ6IGRhdGFiYXNlU3RhY2sucmVkaXNFbmRwb2ludCxcbiAgc3VtbWFyaXphdGlvblF1ZXVlQXJuLFxuICBpbnNpZ2h0c1F1ZXVlQXJuLFxuICBldmVudEJ1c0FybixcbiAgY29ubmVjdGlvbnNUYWJsZTogZGF0YWJhc2VTdGFjay5jb25uZWN0aW9uc1RhYmxlLFxuICBkZXNjcmlwdGlvbjogYEVkdUxlbnMgTGFtYmRhIEZ1bmN0aW9ucyAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbmxhbWJkYVN0YWNrLmFkZERlcGVuZGVuY3kobmV0d29ya1N0YWNrKTtcbmxhbWJkYVN0YWNrLmFkZERlcGVuZGVuY3koZGF0YWJhc2VTdGFjayk7XG5sYW1iZGFTdGFjay5hZGREZXBlbmRlbmN5KGpvYnNTdGFjayk7ICAgLy8gZW5zdXJlcyBxdWV1ZXMgZXhpc3QgYmVmb3JlIExhbWJkYSB0cmllcyB0byBjb25zdW1lIHRoZW1cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA3LiBXaXJlIEFQSSBHYXRld2F5IHJvdXRlcyAoUkVTVCArIFdlYlNvY2tldClcbi8vICAgIEhhcHBlbnMgYWZ0ZXIgTGFtYmRhU3RhY2sgc28gZnVuY3Rpb24gb2JqZWN0cyBhcmUgYXZhaWxhYmxlLlxuLy8gICAgQXBpR2F0ZXdheVN0YWNrIOKGkiBMYW1iZGFTdGFjayBpcyBvbmUtZGlyZWN0aW9uYWw7IG5vIGN5Y2xlLlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmFwaUdhdGV3YXlTdGFjay5hZGRBcGlSb3V0ZXMobGFtYmRhU3RhY2spO1xuYXBpR2F0ZXdheVN0YWNrLmFkZERlcGVuZGVuY3kobGFtYmRhU3RhY2spO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIDguIFdpcmUgQUxCIFNTRSB0YXJnZXQgZ3JvdXBzXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuYWxiU3RhY2suYWRkVGFyZ2V0R3JvdXBzKFxuICBsYW1iZGFTdGFjay5wYXJlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uLFxuICBsYW1iZGFTdGFjay5zdHVkZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbixcbik7XG5hbGJTdGFjay5hZGREZXBlbmRlbmN5KGxhbWJkYVN0YWNrKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA5LiBXaXJlIEV2ZW50QnJpZGdlIHRhcmdldHNcbi8vXG4vLyBXZSBzZXQgdGFyZ2V0cyBkaXJlY3RseSBvbiB0aGUgdW5kZXJseWluZyBDZm5SdWxlIHVzaW5nIGxpdGVyYWxcbi8vIExhbWJkYSBBUk4gc3RyaW5ncy4gVGhpcyBhdm9pZHMgQ0RLJ3MgYXV0b21hdGljIExhbWJkYTo6UGVybWlzc2lvblxuLy8gY3JlYXRpb24gKHdoaWNoIHdvdWxkIGJlIHNjb3BlZCB0byBKb2JzU3RhY2sgYW5kIHJlcXVpcmUgTGFtYmRhIHRvXG4vLyBhbHJlYWR5IGV4aXN0IOKAlCBjYXVzaW5nIGEgZGVwbG95LXRpbWUgZmFpbHVyZSBvciBmb3JjaW5nIGEgY2lyY3VsYXJcbi8vIGFkZERlcGVuZGVuY3kpLiBMYW1iZGE6OlBlcm1pc3Npb24gcmVzb3VyY2VzIGFyZSBhbHJlYWR5IGNyZWF0ZWQgaW5cbi8vIExhbWJkYVN0YWNrIHZpYSBhZGRQZXJtaXNzaW9uKCkgY2FsbHMgd2l0aCBjb25zdHJ1Y3RlZCBydWxlIEFSTnMuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgZXZlbnRCcmlkZ2VUYXJnZXRzOiBBcnJheTx7IHJ1bGU6IGV2ZW50cy5SdWxlOyB0YXJnZXRJZDogc3RyaW5nOyBmbk5hbWU6IHN0cmluZyB9PiA9IFtcbiAgeyBydWxlOiBqb2JzU3RhY2sudGVzdENvbXBsZXRlZFJ1bGUsICB0YXJnZXRJZDogJ0NhbGNQcm9maWxlJywgICAgIGZuTmFtZTogYGVkdWxlbnMtY2FsY3VsYXRlLXByb2ZpbGUtJHtjb25maWcuc3RhZ2V9YCB9LFxuICB7IHJ1bGU6IGpvYnNTdGFjay50aW1lclN5bmNSdWxlLCAgICAgIHRhcmdldElkOiAnVGltZXJTeW5jJywgICAgICAgZm5OYW1lOiBgZWR1bGVucy10aW1lci1zeW5jLSR7Y29uZmlnLnN0YWdlfWAgfSxcbiAgeyBydWxlOiBqb2JzU3RhY2suZGFpbHlJbnNpZ2h0c1J1bGUsICB0YXJnZXRJZDogJ1N0dWRlbnRJbnNpZ2h0cycsIGZuTmFtZTogYGVkdWxlbnMtc3R1ZGVudC1pbnNpZ2h0cy0ke2NvbmZpZy5zdGFnZX1gIH0sXG4gIHsgcnVsZTogam9ic1N0YWNrLmJhdGNoUHJvY2Vzc2luZ1J1bGUsIHRhcmdldElkOiAnSW5zaWdodHNXb3JrZXInLCBmbk5hbWU6IGBlZHVsZW5zLWluc2lnaHRzLXdvcmtlci0ke2NvbmZpZy5zdGFnZX1gIH0sXG5dO1xuXG5mb3IgKGNvbnN0IHsgcnVsZSwgdGFyZ2V0SWQsIGZuTmFtZSB9IG9mIGV2ZW50QnJpZGdlVGFyZ2V0cykge1xuICBjb25zdCBjZm5SdWxlID0gcnVsZS5ub2RlLmRlZmF1bHRDaGlsZCBhcyBldmVudHMuQ2ZuUnVsZTtcbiAgY29uc3QgZXhpc3RpbmcgPSAoY2ZuUnVsZS50YXJnZXRzIGFzIGV2ZW50cy5DZm5SdWxlLlRhcmdldFByb3BlcnR5W10gfCB1bmRlZmluZWQpID8/IFtdO1xuICBjZm5SdWxlLnRhcmdldHMgPSBbXG4gICAgLi4uZXhpc3RpbmcsXG4gICAge1xuICAgICAgaWQ6IHRhcmdldElkLFxuICAgICAgYXJuOiBgYXJuOmF3czpsYW1iZGE6JHtjb25maWcucmVnaW9ufToke2NvbmZpZy5hY2NvdW50fTpmdW5jdGlvbjoke2ZuTmFtZX1gLFxuICAgIH0sXG4gIF07XG59XG4vLyBObyBqb2JzU3RhY2suYWRkRGVwZW5kZW5jeShsYW1iZGFTdGFjaykg4oCUIHRhcmdldHMgdXNlIGxpdGVyYWwgQVJOcyxcbi8vIHNvIEpvYnNTdGFjaydzIENsb3VkRm9ybWF0aW9uIHRlbXBsYXRlIGhhcyBubyByZWZlcmVuY2UgdG8gTGFtYmRhU3RhY2suXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gMTAuIE1vbml0b3JpbmcgU3RhY2tcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBtb25pdG9yaW5nU3RhY2sgPSBuZXcgTW9uaXRvcmluZ1N0YWNrKGFwcCwgYEVkdUxlbnNNb25pdG9yaW5nU3RhY2stJHtjb25maWcuc3RhZ2V9YCwge1xuICBlbnYsXG4gIGNvbmZpZyxcbiAgcmVzdEFwaTogYXBpR2F0ZXdheVN0YWNrLnJlc3RBcGksXG4gIGF1cm9yYUNsdXN0ZXI6IGRhdGFiYXNlU3RhY2suYXVyb3JhQ2x1c3RlcixcbiAgc3VtbWFyaXphdGlvblF1ZXVlOiBqb2JzU3RhY2suc3VtbWFyaXphdGlvblF1ZXVlLFxuICBpbnNpZ2h0c1F1ZXVlOiBqb2JzU3RhY2suaW5zaWdodHNRdWV1ZSxcbiAgc3VtbWFyaXphdGlvbkRMUTogam9ic1N0YWNrLnN1bW1hcml6YXRpb25ETFEsXG4gIGluc2lnaHRzRExROiBqb2JzU3RhY2suaW5zaWdodHNETFEsXG4gIGxhbWJkYUZ1bmN0aW9uczogW1xuICAgIGxhbWJkYVN0YWNrLmNyZWF0ZVRlc3RGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5zdGFydFRlc3RTZXNzaW9uRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suc3VibWl0QW5zd2VyRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suZW5kVGVzdFNlc3Npb25GdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5wYXJlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLnN0dWRlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLmNhbGN1bGF0ZVByb2ZpbGVGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5zdW1tYXJpemF0aW9uV29ya2VyRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suaW5zaWdodHNXb3JrZXJGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5hZG1pblN5c3RlbU1ldHJpY3NGdW5jdGlvbixcbiAgXSxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIE1vbml0b3JpbmcgSW5mcmFzdHJ1Y3R1cmUgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG5tb25pdG9yaW5nU3RhY2suYWRkRGVwZW5kZW5jeShsYW1iZGFTdGFjayk7XG5tb25pdG9yaW5nU3RhY2suYWRkRGVwZW5kZW5jeShhcGlHYXRld2F5U3RhY2spO1xuXG4vLyBUYWcgYWxsIHN0YWNrc1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ1Byb2plY3QnLCAnRWR1TGVucycpO1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ01hbmFnZWRCeScsICdDREsnKTtcbmNkay5UYWdzLm9mKGFwcCkuYWRkKCdTdGFnZScsIGNvbmZpZy5zdGFnZSk7XG5cbmFwcC5zeW50aCgpO1xuIl19