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
    const existing = Array.isArray(cfnRule.targets) ? cfnRule.targets : [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FtQkc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUVuQywrREFBMkQ7QUFDM0QsaUVBQTZEO0FBQzdELHVFQUFrRTtBQUNsRSx1REFBbUQ7QUFDbkQseURBQXFEO0FBQ3JELDZEQUF5RDtBQUN6RCxxRUFBaUU7QUFDakUseURBQW1EO0FBRW5ELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQztBQUM1RSxNQUFNLE1BQU0sR0FBRyxJQUFBLHdCQUFTLEVBQUMsS0FBSyxDQUFDLENBQUM7QUFFaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBRXhDLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPO0lBQ3ZCLE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtDQUN0QixDQUFDO0FBRUYsK0RBQStEO0FBQy9ELG1CQUFtQjtBQUNuQiwrREFBK0Q7QUFFL0QsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEdBQUcsRUFBRSx1QkFBdUIsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ2hGLEdBQUc7SUFDSCxNQUFNO0lB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dGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIEVkdUxlbnMgQ0RLIEFwcGxpY2F0aW9uXG4gKlxuICogU3RhY2sgZGVwbG95bWVudCBvcmRlcjpcbiAqICAgMS4gTmV0d29yaywgRGF0YWJhc2UgICAgICAgICAg4oCUIGZvdW5kYXRpb25hbCByZXNvdXJjZXNcbiAqICAgMi4gSm9ic1N0YWNrICAgICAgICAgICAgICAgICAg4oCUIFNRUyBxdWV1ZXMgKyBFdmVudEJyaWRnZSBydWxlcyAobm8gTGFtYmRhIGRlcHMpXG4gKiAgIDMuIExhbWJkYVN0YWNrICAgICAgICAgICAgICAgIOKAlCBMYW1iZGEgZnVuY3Rpb25zICsgSUFNIChubyBBUEkvQUxCIGRlcHMpXG4gKiAgIDQuIEFwaUdhdGV3YXlTdGFjayAgICAgICAgICAgIOKAlCBSRVNUIEFQSSArIFdlYlNvY2tldCByb3V0ZXMgKHdpcmVkIGFmdGVyIExhbWJkYSlcbiAqICAgNS4gQWxiU3RhY2sgICAgICAgICAgICAgICAgICAg4oCUIEFMQiArIFNTRSB0YXJnZXQgZ3JvdXBzICAod2lyZWQgYWZ0ZXIgTGFtYmRhKVxuICogICA2LiBFdmVudEJyaWRnZSB0YXJnZXRzICAgICAgICDigJQgYWRkVGFyZ2V0KCkgY2FsbHMgdXNpbmcgY29uc3RydWN0ZWQgQVJOcyAobm8gY3ljbGljIENGTiByZWZzKVxuICogICA3LiBNb25pdG9yaW5nU3RhY2sgICAgICAgICAgICDigJQgQ2xvdWRXYXRjaCBhbGFybXNcbiAqXG4gKiBDeWNsaWMgZGVwZW5kZW5jeSBzdHJhdGVneTpcbiAqICAgTGFtYmRhU3RhY2sgcmVjZWl2ZXMgcXVldWUvZXZlbnRCdXMgQVJOcyBhcyBjb25zdHJ1Y3RlZCBzdHJpbmdzIChub3QgQ0RLIHRva2VucyksXG4gKiAgIHNvIG5vIEZuOjpJbXBvcnRWYWx1ZSBjcm9zcy1zdGFjayByZWZlcmVuY2UgaXMgZ2VuZXJhdGVkLiBFdmVudEJyaWRnZSB0YXJnZXRzIGFyZVxuICogICBhZGRlZCBkaXJlY3RseSB2aWEgQ2ZuUnVsZS50YXJnZXRzIHdpdGggbGl0ZXJhbCBMYW1iZGEgQVJOIHN0cmluZ3MsIGF2b2lkaW5nXG4gKiAgIENESydzIGF1dG9tYXRpYyBMYW1iZGE6OlBlcm1pc3Npb24gY3JlYXRpb24gaW4gSm9ic1N0YWNrICh3aGljaCB3b3VsZCByZXF1aXJlXG4gKiAgIExhbWJkYSB0byBhbHJlYWR5IGV4aXN0IGFuZCB3b3VsZCBmb3JjZSBhIGNpcmN1bGFyIGFkZERlcGVuZGVuY3kpLiBBbGxcbiAqICAgTGFtYmRhOjpQZXJtaXNzaW9uIHJlc291cmNlcyBmb3IgRXZlbnRCcmlkZ2UgbGl2ZSBpbiBMYW1iZGFTdGFjay5cbiAqL1xuXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0IHsgTmV0d29ya1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9uZXR3b3JrLXN0YWNrJztcbmltcG9ydCB7IERhdGFiYXNlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2RhdGFiYXNlLXN0YWNrJztcbmltcG9ydCB7IEFwaUdhdGV3YXlTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvYXBpLWdhdGV3YXktc3RhY2snO1xuaW1wb3J0IHsgQWxiU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2FsYi1zdGFjayc7XG5pbXBvcnQgeyBKb2JzU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2pvYnMtc3RhY2snO1xuaW1wb3J0IHsgTGFtYmRhU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2xhbWJkYS1zdGFjayc7XG5pbXBvcnQgeyBNb25pdG9yaW5nU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL21vbml0b3Jpbmctc3RhY2snO1xuaW1wb3J0IHsgZ2V0Q29uZmlnIH0gZnJvbSAnLi4vY29uZmlnL2Vudmlyb25tZW50cyc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IHN0YWdlID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnc3RhZ2UnKSB8fCBwcm9jZXNzLmVudi5TVEFHRSB8fCAnZGV2JztcbmNvbnN0IGNvbmZpZyA9IGdldENvbmZpZyhzdGFnZSk7XG5cbmNvbnNvbGUubG9nKGBEZXBsb3lpbmcgdG8gc3RhZ2U6ICR7c3RhZ2V9YCk7XG5jb25zb2xlLmxvZyhgQWNjb3VudDogJHtjb25maWcuYWNjb3VudH1gKTtcbmNvbnNvbGUubG9nKGBSZWdpb246ICR7Y29uZmlnLnJlZ2lvbn1gKTtcblxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBjb25maWcuYWNjb3VudCxcbiAgcmVnaW9uOiBjb25maWcucmVnaW9uLFxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyAxLiBOZXR3b3JrIFN0YWNrXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgbmV0d29ya1N0YWNrID0gbmV3IE5ldHdvcmtTdGFjayhhcHAsIGBFZHVMZW5zTmV0d29ya1N0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBOZXR3b3JrIEluZnJhc3RydWN0dXJlICgke2NvbmZpZy5zdGFnZX0pYCxcbiAgdGFnczogY29uZmlnLnRhZ3MsXG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyAyLiBEYXRhYmFzZSBTdGFja1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IGRhdGFiYXNlU3RhY2sgPSBuZXcgRGF0YWJhc2VTdGFjayhhcHAsIGBFZHVMZW5zRGF0YWJhc2VTdGFjay0ke2NvbmZpZy5zdGFnZX1gLCB7XG4gIGVudixcbiAgY29uZmlnLFxuICB2cGM6IG5ldHdvcmtTdGFjay52cGMsXG4gIHJkc1NlY3VyaXR5R3JvdXA6IG5ldHdvcmtTdGFjay5yZHNTZWN1cml0eUdyb3VwLFxuICByZWRpc1NlY3VyaXR5R3JvdXA6IG5ldHdvcmtTdGFjay5yZWRpc1NlY3VyaXR5R3JvdXAsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBEYXRhYmFzZSBJbmZyYXN0cnVjdHVyZSAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbmRhdGFiYXNlU3RhY2suYWRkRGVwZW5kZW5jeShuZXR3b3JrU3RhY2spO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIDMuIEpvYnMgU3RhY2sgIChTUVMgKyBFdmVudEJyaWRnZSBydWxlcyDigJQgbm8gTGFtYmRhIGRlcHMpXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3Qgam9ic1N0YWNrID0gbmV3IEpvYnNTdGFjayhhcHAsIGBFZHVMZW5zSm9ic1N0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBKb2JzIEluZnJhc3RydWN0dXJlICgke2NvbmZpZy5zdGFnZX0pYCxcbiAgdGFnczogY29uZmlnLnRhZ3MsXG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA0LiBBUEkgR2F0ZXdheSBTdGFjayAgKFJFU1QgKyBXZWJTb2NrZXQgQVBJIHNrZWxldG9uKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IGFwaUdhdGV3YXlTdGFjayA9IG5ldyBBcGlHYXRld2F5U3RhY2soYXBwLCBgRWR1TGVuc0FwaUdhdGV3YXlTdGFjay0ke2NvbmZpZy5zdGFnZX1gLCB7XG4gIGVudixcbiAgY29uZmlnLFxuICBkZXNjcmlwdGlvbjogYEVkdUxlbnMgQVBJIEdhdGV3YXkgSW5mcmFzdHJ1Y3R1cmUgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIDUuIEFMQiBTdGFjayAgKEFMQiArIEhUVFAgbGlzdGVuZXIgc2tlbGV0b24pXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgYWxiU3RhY2sgPSBuZXcgQWxiU3RhY2soYXBwLCBgRWR1TGVuc0FsYlN0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIHZwYzogbmV0d29ya1N0YWNrLnZwYyxcbiAgYWxiU2VjdXJpdHlHcm91cDogbmV0d29ya1N0YWNrLmFsYlNlY3VyaXR5R3JvdXAsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBBTEIgSW5mcmFzdHJ1Y3R1cmUgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG5hbGJTdGFjay5hZGREZXBlbmRlbmN5KG5ldHdvcmtTdGFjayk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gNi4gTGFtYmRhIFN0YWNrICAoTGFtYmRhIGZ1bmN0aW9ucyArIElBTSDigJQgbm8gQVBJL0FMQiBkZXBzKVxuLy9cbi8vIFF1ZXVlL0V2ZW50QnVzIEFSTnMgYXJlIHBhc3NlZCBhcyBjb25zdHJ1Y3RlZCBzdHJpbmdzIHRvIGF2b2lkXG4vLyBiaWRpcmVjdGlvbmFsIENsb3VkRm9ybWF0aW9uIGNyb3NzLXN0YWNrIHJlZmVyZW5jZXMgd2l0aCBKb2JzU3RhY2suXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3Qgc3VtbWFyaXphdGlvblF1ZXVlQXJuID0gYGFybjphd3M6c3FzOiR7Y29uZmlnLnJlZ2lvbn06JHtjb25maWcuYWNjb3VudH06ZWR1bGVucy1zdW1tYXJpemF0aW9uLXF1ZXVlLSR7Y29uZmlnLnN0YWdlfWA7XG5jb25zdCBpbnNpZ2h0c1F1ZXVlQXJuICAgICAgPSBgYXJuOmF3czpzcXM6JHtjb25maWcucmVnaW9ufToke2NvbmZpZy5hY2NvdW50fTplZHVsZW5zLWluc2lnaHRzLXF1ZXVlLSR7Y29uZmlnLnN0YWdlfWA7XG5jb25zdCBldmVudEJ1c0FybiAgICAgICAgICAgPSBgYXJuOmF3czpldmVudHM6JHtjb25maWcucmVnaW9ufToke2NvbmZpZy5hY2NvdW50fTpldmVudC1idXMvZGVmYXVsdGA7XG5cbmNvbnN0IGxhbWJkYVN0YWNrID0gbmV3IExhbWJkYVN0YWNrKGFwcCwgYEVkdUxlbnNMYW1iZGFTdGFjay0ke2NvbmZpZy5zdGFnZX1gLCB7XG4gIGVudixcbiAgY29uZmlnLFxuICB2cGM6IG5ldHdvcmtTdGFjay52cGMsXG4gIGxhbWJkYVNlY3VyaXR5R3JvdXA6IG5ldHdvcmtTdGFjay5sYW1iZGFTZWN1cml0eUdyb3VwLFxuICBhdXJvcmFTZWNyZXQ6IGRhdGFiYXNlU3RhY2suYXVyb3JhU2VjcmV0LFxuICByZWRpc0VuZHBvaW50OiBkYXRhYmFzZVN0YWNrLnJlZGlzRW5kcG9pbnQsXG4gIHN1bW1hcml6YXRpb25RdWV1ZUFybixcbiAgaW5zaWdodHNRdWV1ZUFybixcbiAgZXZlbnRCdXNBcm4sXG4gIGNvbm5lY3Rpb25zVGFibGU6IGRhdGFiYXNlU3RhY2suY29ubmVjdGlvbnNUYWJsZSxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIExhbWJkYSBGdW5jdGlvbnMgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG5sYW1iZGFTdGFjay5hZGREZXBlbmRlbmN5KG5ldHdvcmtTdGFjayk7XG5sYW1iZGFTdGFjay5hZGREZXBlbmRlbmN5KGRhdGFiYXNlU3RhY2spO1xubGFtYmRhU3RhY2suYWRkRGVwZW5kZW5jeShqb2JzU3RhY2spOyAgIC8vIGVuc3VyZXMgcXVldWVzIGV4aXN0IGJlZm9yZSBMYW1iZGEgdHJpZXMgdG8gY29uc3VtZSB0aGVtXG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gNy4gV2lyZSBBUEkgR2F0ZXdheSByb3V0ZXMgKFJFU1QgKyBXZWJTb2NrZXQpXG4vLyAgICBIYXBwZW5zIGFmdGVyIExhbWJkYVN0YWNrIHNvIGZ1bmN0aW9uIG9iamVjdHMgYXJlIGF2YWlsYWJsZS5cbi8vICAgIEFwaUdhdGV3YXlTdGFjayDihpIgTGFtYmRhU3RhY2sgaXMgb25lLWRpcmVjdGlvbmFsOyBubyBjeWNsZS5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5hcGlHYXRld2F5U3RhY2suYWRkQXBpUm91dGVzKGxhbWJkYVN0YWNrKTtcbmFwaUdhdGV3YXlTdGFjay5hZGREZXBlbmRlbmN5KGxhbWJkYVN0YWNrKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyA4LiBXaXJlIEFMQiBTU0UgdGFyZ2V0IGdyb3Vwc1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmFsYlN0YWNrLmFkZFRhcmdldEdyb3VwcyhcbiAgbGFtYmRhU3RhY2sucGFyZW50Q2hhdFNlbmRTdHJlYW1GdW5jdGlvbixcbiAgbGFtYmRhU3RhY2suc3R1ZGVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24sXG4pO1xuYWxiU3RhY2suYWRkRGVwZW5kZW5jeShsYW1iZGFTdGFjayk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gOS4gV2lyZSBFdmVudEJyaWRnZSB0YXJnZXRzXG4vL1xuLy8gV2Ugc2V0IHRhcmdldHMgZGlyZWN0bHkgb24gdGhlIHVuZGVybHlpbmcgQ2ZuUnVsZSB1c2luZyBsaXRlcmFsXG4vLyBMYW1iZGEgQVJOIHN0cmluZ3MuIFRoaXMgYXZvaWRzIENESydzIGF1dG9tYXRpYyBMYW1iZGE6OlBlcm1pc3Npb25cbi8vIGNyZWF0aW9uICh3aGljaCB3b3VsZCBiZSBzY29wZWQgdG8gSm9ic1N0YWNrIGFuZCByZXF1aXJlIExhbWJkYSB0b1xuLy8gYWxyZWFkeSBleGlzdCDigJQgY2F1c2luZyBhIGRlcGxveS10aW1lIGZhaWx1cmUgb3IgZm9yY2luZyBhIGNpcmN1bGFyXG4vLyBhZGREZXBlbmRlbmN5KS4gTGFtYmRhOjpQZXJtaXNzaW9uIHJlc291cmNlcyBhcmUgYWxyZWFkeSBjcmVhdGVkIGluXG4vLyBMYW1iZGFTdGFjayB2aWEgYWRkUGVybWlzc2lvbigpIGNhbGxzIHdpdGggY29uc3RydWN0ZWQgcnVsZSBBUk5zLlxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IGV2ZW50QnJpZGdlVGFyZ2V0czogQXJyYXk8eyBydWxlOiBldmVudHMuUnVsZTsgdGFyZ2V0SWQ6IHN0cmluZzsgZm5OYW1lOiBzdHJpbmcgfT4gPSBbXG4gIHsgcnVsZTogam9ic1N0YWNrLnRlc3RDb21wbGV0ZWRSdWxlLCAgdGFyZ2V0SWQ6ICdDYWxjUHJvZmlsZScsICAgICBmbk5hbWU6IGBlZHVsZW5zLWNhbGN1bGF0ZS1wcm9maWxlLSR7Y29uZmlnLnN0YWdlfWAgfSxcbiAgeyBydWxlOiBqb2JzU3RhY2sudGltZXJTeW5jUnVsZSwgICAgICB0YXJnZXRJZDogJ1RpbWVyU3luYycsICAgICAgIGZuTmFtZTogYGVkdWxlbnMtdGltZXItc3luYy0ke2NvbmZpZy5zdGFnZX1gIH0sXG4gIHsgcnVsZTogam9ic1N0YWNrLmRhaWx5SW5zaWdodHNSdWxlLCAgdGFyZ2V0SWQ6ICdTdHVkZW50SW5zaWdodHMnLCBmbk5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtaW5zaWdodHMtJHtjb25maWcuc3RhZ2V9YCB9LFxuICB7IHJ1bGU6IGpvYnNTdGFjay5iYXRjaFByb2Nlc3NpbmdSdWxlLCB0YXJnZXRJZDogJ0luc2lnaHRzV29ya2VyJywgZm5OYW1lOiBgZWR1bGVucy1pbnNpZ2h0cy13b3JrZXItJHtjb25maWcuc3RhZ2V9YCB9LFxuXTtcblxuZm9yIChjb25zdCB7IHJ1bGUsIHRhcmdldElkLCBmbk5hbWUgfSBvZiBldmVudEJyaWRnZVRhcmdldHMpIHtcbiAgY29uc3QgY2ZuUnVsZSA9IHJ1bGUubm9kZS5kZWZhdWx0Q2hpbGQgYXMgZXZlbnRzLkNmblJ1bGU7XG4gIGNvbnN0IGV4aXN0aW5nID0gQXJyYXkuaXNBcnJheShjZm5SdWxlLnRhcmdldHMpID8gY2ZuUnVsZS50YXJnZXRzIDogW107XG4gIGNmblJ1bGUudGFyZ2V0cyA9IFtcbiAgICAuLi5leGlzdGluZyxcbiAgICB7XG4gICAgICBpZDogdGFyZ2V0SWQsXG4gICAgICBhcm46IGBhcm46YXdzOmxhbWJkYToke2NvbmZpZy5yZWdpb259OiR7Y29uZmlnLmFjY291bnR9OmZ1bmN0aW9uOiR7Zm5OYW1lfWAsXG4gICAgfSxcbiAgXTtcbn1cbi8vIE5vIGpvYnNTdGFjay5hZGREZXBlbmRlbmN5KGxhbWJkYVN0YWNrKSDigJQgdGFyZ2V0cyB1c2UgbGl0ZXJhbCBBUk5zLFxuLy8gc28gSm9ic1N0YWNrJ3MgQ2xvdWRGb3JtYXRpb24gdGVtcGxhdGUgaGFzIG5vIHJlZmVyZW5jZSB0byBMYW1iZGFTdGFjay5cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyAxMC4gTW9uaXRvcmluZyBTdGFja1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IG1vbml0b3JpbmdTdGFjayA9IG5ldyBNb25pdG9yaW5nU3RhY2soYXBwLCBgRWR1TGVuc01vbml0b3JpbmdTdGFjay0ke2NvbmZpZy5zdGFnZX1gLCB7XG4gIGVudixcbiAgY29uZmlnLFxuICByZXN0QXBpOiBhcGlHYXRld2F5U3RhY2sucmVzdEFwaSxcbiAgYXVyb3JhQ2x1c3RlcjogZGF0YWJhc2VTdGFjay5hdXJvcmFDbHVzdGVyLFxuICBzdW1tYXJpemF0aW9uUXVldWU6IGpvYnNTdGFjay5zdW1tYXJpemF0aW9uUXVldWUsXG4gIGluc2lnaHRzUXVldWU6IGpvYnNTdGFjay5pbnNpZ2h0c1F1ZXVlLFxuICBzdW1tYXJpemF0aW9uRExROiBqb2JzU3RhY2suc3VtbWFyaXphdGlvbkRMUSxcbiAgaW5zaWdodHNETFE6IGpvYnNTdGFjay5pbnNpZ2h0c0RMUSxcbiAgbGFtYmRhRnVuY3Rpb25zOiBbXG4gICAgbGFtYmRhU3RhY2suY3JlYXRlVGVzdEZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLnN0YXJ0VGVzdFNlc3Npb25GdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5zdWJtaXRBbnN3ZXJGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5lbmRUZXN0U2Vzc2lvbkZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLnBhcmVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suc3R1ZGVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suY2FsY3VsYXRlUHJvZmlsZUZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLnN1bW1hcml6YXRpb25Xb3JrZXJGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5pbnNpZ2h0c1dvcmtlckZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLmFkbWluU3lzdGVtTWV0cmljc0Z1bmN0aW9uLFxuICBdLFxuICBkZXNjcmlwdGlvbjogYEVkdUxlbnMgTW9uaXRvcmluZyBJbmZyYXN0cnVjdHVyZSAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGxhbWJkYVN0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGFwaUdhdGV3YXlTdGFjayk7XG5cbi8vIFRhZyBhbGwgc3RhY2tzXG5jZGsuVGFncy5vZihhcHApLmFkZCgnUHJvamVjdCcsICdFZHVMZW5zJyk7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ1N0YWdlJywgY29uZmlnLnN0YWdlKTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=