#!/usr/bin/env node
"use strict";
/**
 * EduLens CDK Application
 *
 * Deploys all infrastructure stacks for the EduLens platform
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
// Get stage from context or environment variable
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const config = (0, environments_1.getConfig)(stage);
console.log(`Deploying to stage: ${stage}`);
console.log(`Account: ${config.account}`);
console.log(`Region: ${config.region}`);
// Stack environment
const env = {
    account: config.account,
    region: config.region,
};
// ============================================================
// Network Stack
// ============================================================
const networkStack = new network_stack_1.NetworkStack(app, `EduLensNetworkStack-${config.stage}`, {
    env,
    config,
    description: `EduLens Network Infrastructure (${config.stage})`,
    tags: config.tags,
});
// ============================================================
// Database Stack
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
// API Gateway Stack
// ============================================================
const apiGatewayStack = new api_gateway_stack_1.ApiGatewayStack(app, `EduLensApiGatewayStack-${config.stage}`, {
    env,
    config,
    description: `EduLens API Gateway Infrastructure (${config.stage})`,
    tags: config.tags,
});
// ============================================================
// ALB Stack (for SSE streaming)
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
// Jobs Stack (SQS + EventBridge)
// ============================================================
const jobsStack = new jobs_stack_1.JobsStack(app, `EduLensJobsStack-${config.stage}`, {
    env,
    config,
    description: `EduLens Jobs Infrastructure (${config.stage})`,
    tags: config.tags,
});
// ============================================================
// Lambda Stack (all 6 services)
// ============================================================
const lambdaStack = new lambda_stack_1.LambdaStack(app, `EduLensLambdaStack-${config.stage}`, {
    env,
    config,
    vpc: networkStack.vpc,
    lambdaSecurityGroup: networkStack.lambdaSecurityGroup,
    auroraSecret: databaseStack.auroraSecret,
    redisEndpoint: databaseStack.redisEndpoint,
    restApi: apiGatewayStack.restApi,
    // websocketApi: apiGatewayStack.websocketApi, // Removed to avoid cyclic dependency
    alb: albStack.alb,
    httpListener: albStack.httpListener,
    summarizationQueueArn: jobsStack.summarizationQueue.queueArn,
    insightsQueueArn: jobsStack.insightsQueue.queueArn,
    eventBus: jobsStack.eventBus,
    connectionsTable: databaseStack.connectionsTable,
    testCompletedRuleName: jobsStack.testCompletedRule.ruleName,
    timerSyncRuleName: jobsStack.timerSyncRule.ruleName,
    description: `EduLens Lambda Functions (${config.stage})`,
    tags: config.tags,
});
lambdaStack.addDependency(networkStack);
lambdaStack.addDependency(databaseStack);
// Note: apiGatewayStack, albStack, and jobsStack dependencies are implicit when integrations are added
// ============================================================
// Monitoring Stack (CloudWatch + X-Ray)
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
// Tag all stacks
cdk.Tags.of(app).add('Project', 'EduLens');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Stage', config.stage);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0E7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLCtEQUEyRDtBQUMzRCxpRUFBNkQ7QUFDN0QsdUVBQWtFO0FBQ2xFLHVEQUFtRDtBQUNuRCx5REFBcUQ7QUFDckQsNkRBQXlEO0FBQ3pELHFFQUFpRTtBQUNqRSx5REFBbUQ7QUFFbkQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsaURBQWlEO0FBQ2pELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQztBQUM1RSxNQUFNLE1BQU0sR0FBRyxJQUFBLHdCQUFTLEVBQUMsS0FBSyxDQUFDLENBQUM7QUFFaEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDMUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBRXhDLG9CQUFvQjtBQUNwQixNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTztJQUN2QixNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07Q0FDdEIsQ0FBQztBQUVGLCtEQUErRDtBQUMvRCxnQkFBZ0I7QUFDaEIsK0RBQStEO0FBRS9ELE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsdUJBQXVCLE1BQU0sQ0FBQyxLQUFLLEVBQUUsRUFBRTtJQUNoRixHQUFHO0lBQ0gsTUFBTTtJQUNOLFdBQVcsRUFBRSxtQ0FBbUMsTUFBTSxDQUFDLEtBQUssR0FBRztJQUMvRCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7Q0FDbEIsQ0FBQyxDQUFDO0FBRUgsK0RBQStEO0FBQy9ELGlCQUFpQjtBQUNqQiwrREFBK0Q7QUFFL0QsTUFBTSxhQUFhLEdBQUcsSUFBSSw4QkFBYSxDQUFDLEdBQUcsRUFBRSx3QkFBd0IsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ25GLEdBQUc7SUFDSCxNQUFNO0lBQ04sR0FBRyxFQUFFLFlBQVksQ0FBQyxHQUFHO0lBQ3JCLGdCQUFnQixFQUFFLFlBQVksQ0FBQyxnQkFBZ0I7SUFDL0Msa0JBQWtCLEVBQUUsWUFBWSxDQUFDLGtCQUFrQjtJQUNuRCxXQUFXLEVBQUUsb0NBQW9DLE1BQU0sQ0FBQyxLQUFLLEdBQUc7SUFDaEUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO0NBQ2xCLENBQUMsQ0FBQztBQUVILGFBQWEsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFMUMsK0RBQStEO0FBQy9ELG9CQUFvQjtBQUNwQiwrREFBK0Q7QUFFL0QsTUFBTSxlQUFlLEdBQUcsSUFBSSxtQ0FBZSxDQUFDLEdBQUcsRUFBRSwwQkFBMEIsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ3pGLEdBQUc7SUFDSCxNQUFNO0lBQ04sV0FBVyxFQUFFLHVDQUF1QyxNQUFNLENBQUMsS0FBSyxHQUFHO0lBQ25FLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtDQUNsQixDQUFDLENBQUM7QUFFSCwrREFBK0Q7QUFDL0QsZ0NBQWdDO0FBQ2hDLCtEQUErRDtBQUUvRCxNQUFNLFFBQVEsR0FBRyxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLG1CQUFtQixNQUFNLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDcEUsR0FBRztJQUNILE1BQU07SUFDTixHQUFHLEVBQUUsWUFBWSxDQUFDLEdBQUc7SUFDckIsZ0JBQWdCLEVBQUUsWUFBWSxDQUFDLGdCQUFnQjtJQUMvQyxXQUFXLEVBQUUsK0JBQStCLE1BQU0sQ0FBQyxLQUFLLEdBQUc7SUFDM0QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO0NBQ2xCLENBQUMsQ0FBQztBQUVILFFBQVEsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFckMsK0RBQStEO0FBQy9ELGlDQUFpQztBQUNqQywrREFBK0Q7QUFFL0QsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEdBQUcsRUFBRSxvQkFBb0IsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFO0lBQ3ZFLEdBQUc7SUFDSCxNQUFNO0lBQ04sV0FBVyxFQUFFLGdDQUFnQyxNQUFNLENBQUMsS0FBSyxHQUFHO0lBQzVELElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTtDQUNsQixDQUFDLENBQUM7QUFFSCwrREFBK0Q7QUFDL0QsZ0NBQWdDO0FBQ2hDLCtEQUErRDtBQUUvRCxNQUFNLFdBQVcsR0FBRyxJQUFJLDBCQUFXLENBQUMsR0FBRyxFQUFFLHNCQUFzQixNQUFNLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDN0UsR0FBRztJQUNILE1BQU07SUFDTixHQUFHLEVBQUUsWUFBWSxDQUFDLEdBQUc7SUFDckIsbUJBQW1CLEVBQUUsWUFBWSxDQUFDLG1CQUFtQjtJQUNyRCxZQUFZLEVBQUUsYUFBYSxDQUFDLFlBQVk7SUFDeEMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxhQUFhO0lBQzFDLE9BQU8sRUFBRSxlQUFlLENBQUMsT0FBTztJQUNoQyxvRkFBb0Y7SUFDcEYsR0FBRyxFQUFFLFFBQVEsQ0FBQyxHQUFHO0lBQ2pCLFlBQVksRUFBRSxRQUFRLENBQUMsWUFBWTtJQUNuQyxxQkFBcUIsRUFBRSxTQUFTLENBQUMsa0JBQWtCLENBQUMsUUFBUTtJQUM1RCxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsYUFBYSxDQUFDLFFBQVE7SUFDbEQsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRO0lBQzVCLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxnQkFBZ0I7SUFDaEQscUJBQXFCLEVBQUUsU0FBUyxDQUFDLGlCQUFpQixDQUFDLFFBQVE7SUFDM0QsaUJBQWlCLEVBQUUsU0FBUyxDQUFDLGFBQWEsQ0FBQyxRQUFRO0lBQ25ELFdBQVcsRUFBRSw2QkFBNkIsTUFBTSxDQUFDLEtBQUssR0FBRztJQUN6RCxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7Q0FDbEIsQ0FBQyxDQUFDO0FBRUgsV0FBVyxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN4QyxXQUFXLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3pDLHVHQUF1RztBQUV2RywrREFBK0Q7QUFDL0Qsd0NBQXdDO0FBQ3hDLCtEQUErRDtBQUUvRCxNQUFNLGVBQWUsR0FBRyxJQUFJLGtDQUFlLENBQUMsR0FBRyxFQUFFLDBCQUEwQixNQUFNLENBQUMsS0FBSyxFQUFFLEVBQUU7SUFDekYsR0FBRztJQUNILE1BQU07SUFDTixPQUFPLEVBQUUsZUFBZSxDQUFDLE9BQU87SUFDaEMsYUFBYSxFQUFFLGFBQWEsQ0FBQyxhQUFhO0lBQzFDLGtCQUFrQixFQUFFLFNBQVMsQ0FBQyxrQkFBa0I7SUFDaEQsYUFBYSxFQUFFLFNBQVMsQ0FBQyxhQUFhO0lBQ3RDLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxnQkFBZ0I7SUFDNUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxXQUFXO0lBQ2xDLGVBQWUsRUFBRTtRQUNmLFdBQVcsQ0FBQyxrQkFBa0I7UUFDOUIsV0FBVyxDQUFDLHdCQUF3QjtRQUNwQyxXQUFXLENBQUMsb0JBQW9CO1FBQ2hDLFdBQVcsQ0FBQyxzQkFBc0I7UUFDbEMsV0FBVyxDQUFDLDRCQUE0QjtRQUN4QyxXQUFXLENBQUMsNkJBQTZCO1FBQ3pDLFdBQVcsQ0FBQyx3QkFBd0I7UUFDcEMsV0FBVyxDQUFDLDJCQUEyQjtRQUN2QyxXQUFXLENBQUMsc0JBQXNCO1FBQ2xDLFdBQVcsQ0FBQywwQkFBMEI7S0FDdkM7SUFDRCxXQUFXLEVBQUUsc0NBQXNDLE1BQU0sQ0FBQyxLQUFLLEdBQUc7SUFDbEUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO0NBQ2xCLENBQUMsQ0FBQztBQUVILGVBQWUsQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFM0MsaUJBQWlCO0FBQ2pCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDM0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN6QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUU1QyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIEVkdUxlbnMgQ0RLIEFwcGxpY2F0aW9uXG4gKlxuICogRGVwbG95cyBhbGwgaW5mcmFzdHJ1Y3R1cmUgc3RhY2tzIGZvciB0aGUgRWR1TGVucyBwbGF0Zm9ybVxuICovXG5cbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBOZXR3b3JrU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL25ldHdvcmstc3RhY2snO1xuaW1wb3J0IHsgRGF0YWJhc2VTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvZGF0YWJhc2Utc3RhY2snO1xuaW1wb3J0IHsgQXBpR2F0ZXdheVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9hcGktZ2F0ZXdheS1zdGFjayc7XG5pbXBvcnQgeyBBbGJTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvYWxiLXN0YWNrJztcbmltcG9ydCB7IEpvYnNTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3Mvam9icy1zdGFjayc7XG5pbXBvcnQgeyBMYW1iZGFTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvbGFtYmRhLXN0YWNrJztcbmltcG9ydCB7IE1vbml0b3JpbmdTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvbW9uaXRvcmluZy1zdGFjayc7XG5pbXBvcnQgeyBnZXRDb25maWcgfSBmcm9tICcuLi9jb25maWcvZW52aXJvbm1lbnRzJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IHN0YWdlIGZyb20gY29udGV4dCBvciBlbnZpcm9ubWVudCB2YXJpYWJsZVxuY29uc3Qgc3RhZ2UgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFnZScpIHx8IHByb2Nlc3MuZW52LlNUQUdFIHx8ICdkZXYnO1xuY29uc3QgY29uZmlnID0gZ2V0Q29uZmlnKHN0YWdlKTtcblxuY29uc29sZS5sb2coYERlcGxveWluZyB0byBzdGFnZTogJHtzdGFnZX1gKTtcbmNvbnNvbGUubG9nKGBBY2NvdW50OiAke2NvbmZpZy5hY2NvdW50fWApO1xuY29uc29sZS5sb2coYFJlZ2lvbjogJHtjb25maWcucmVnaW9ufWApO1xuXG4vLyBTdGFjayBlbnZpcm9ubWVudFxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBjb25maWcuYWNjb3VudCxcbiAgcmVnaW9uOiBjb25maWcucmVnaW9uLFxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBOZXR3b3JrIFN0YWNrXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgbmV0d29ya1N0YWNrID0gbmV3IE5ldHdvcmtTdGFjayhhcHAsIGBFZHVMZW5zTmV0d29ya1N0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBOZXR3b3JrIEluZnJhc3RydWN0dXJlICgke2NvbmZpZy5zdGFnZX0pYCxcbiAgdGFnczogY29uZmlnLnRhZ3MsXG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBEYXRhYmFzZSBTdGFja1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbmNvbnN0IGRhdGFiYXNlU3RhY2sgPSBuZXcgRGF0YWJhc2VTdGFjayhhcHAsIGBFZHVMZW5zRGF0YWJhc2VTdGFjay0ke2NvbmZpZy5zdGFnZX1gLCB7XG4gIGVudixcbiAgY29uZmlnLFxuICB2cGM6IG5ldHdvcmtTdGFjay52cGMsXG4gIHJkc1NlY3VyaXR5R3JvdXA6IG5ldHdvcmtTdGFjay5yZHNTZWN1cml0eUdyb3VwLFxuICByZWRpc1NlY3VyaXR5R3JvdXA6IG5ldHdvcmtTdGFjay5yZWRpc1NlY3VyaXR5R3JvdXAsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBEYXRhYmFzZSBJbmZyYXN0cnVjdHVyZSAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbmRhdGFiYXNlU3RhY2suYWRkRGVwZW5kZW5jeShuZXR3b3JrU3RhY2spO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIEFQSSBHYXRld2F5IFN0YWNrXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgYXBpR2F0ZXdheVN0YWNrID0gbmV3IEFwaUdhdGV3YXlTdGFjayhhcHAsIGBFZHVMZW5zQXBpR2F0ZXdheVN0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBBUEkgR2F0ZXdheSBJbmZyYXN0cnVjdHVyZSAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gQUxCIFN0YWNrIChmb3IgU1NFIHN0cmVhbWluZylcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBhbGJTdGFjayA9IG5ldyBBbGJTdGFjayhhcHAsIGBFZHVMZW5zQWxiU3RhY2stJHtjb25maWcuc3RhZ2V9YCwge1xuICBlbnYsXG4gIGNvbmZpZyxcbiAgdnBjOiBuZXR3b3JrU3RhY2sudnBjLFxuICBhbGJTZWN1cml0eUdyb3VwOiBuZXR3b3JrU3RhY2suYWxiU2VjdXJpdHlHcm91cCxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIEFMQiBJbmZyYXN0cnVjdHVyZSAoJHtjb25maWcuc3RhZ2V9KWAsXG4gIHRhZ3M6IGNvbmZpZy50YWdzLFxufSk7XG5cbmFsYlN0YWNrLmFkZERlcGVuZGVuY3kobmV0d29ya1N0YWNrKTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBKb2JzIFN0YWNrIChTUVMgKyBFdmVudEJyaWRnZSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBqb2JzU3RhY2sgPSBuZXcgSm9ic1N0YWNrKGFwcCwgYEVkdUxlbnNKb2JzU3RhY2stJHtjb25maWcuc3RhZ2V9YCwge1xuICBlbnYsXG4gIGNvbmZpZyxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIEpvYnMgSW5mcmFzdHJ1Y3R1cmUgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIExhbWJkYSBTdGFjayAoYWxsIDYgc2VydmljZXMpXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuY29uc3QgbGFtYmRhU3RhY2sgPSBuZXcgTGFtYmRhU3RhY2soYXBwLCBgRWR1TGVuc0xhbWJkYVN0YWNrLSR7Y29uZmlnLnN0YWdlfWAsIHtcbiAgZW52LFxuICBjb25maWcsXG4gIHZwYzogbmV0d29ya1N0YWNrLnZwYyxcbiAgbGFtYmRhU2VjdXJpdHlHcm91cDogbmV0d29ya1N0YWNrLmxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gIGF1cm9yYVNlY3JldDogZGF0YWJhc2VTdGFjay5hdXJvcmFTZWNyZXQsXG4gIHJlZGlzRW5kcG9pbnQ6IGRhdGFiYXNlU3RhY2sucmVkaXNFbmRwb2ludCxcbiAgcmVzdEFwaTogYXBpR2F0ZXdheVN0YWNrLnJlc3RBcGksXG4gIC8vIHdlYnNvY2tldEFwaTogYXBpR2F0ZXdheVN0YWNrLndlYnNvY2tldEFwaSwgLy8gUmVtb3ZlZCB0byBhdm9pZCBjeWNsaWMgZGVwZW5kZW5jeVxuICBhbGI6IGFsYlN0YWNrLmFsYixcbiAgaHR0cExpc3RlbmVyOiBhbGJTdGFjay5odHRwTGlzdGVuZXIsXG4gIHN1bW1hcml6YXRpb25RdWV1ZUFybjogam9ic1N0YWNrLnN1bW1hcml6YXRpb25RdWV1ZS5xdWV1ZUFybixcbiAgaW5zaWdodHNRdWV1ZUFybjogam9ic1N0YWNrLmluc2lnaHRzUXVldWUucXVldWVBcm4sXG4gIGV2ZW50QnVzOiBqb2JzU3RhY2suZXZlbnRCdXMsXG4gIGNvbm5lY3Rpb25zVGFibGU6IGRhdGFiYXNlU3RhY2suY29ubmVjdGlvbnNUYWJsZSxcbiAgdGVzdENvbXBsZXRlZFJ1bGVOYW1lOiBqb2JzU3RhY2sudGVzdENvbXBsZXRlZFJ1bGUucnVsZU5hbWUsXG4gIHRpbWVyU3luY1J1bGVOYW1lOiBqb2JzU3RhY2sudGltZXJTeW5jUnVsZS5ydWxlTmFtZSxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIExhbWJkYSBGdW5jdGlvbnMgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG5sYW1iZGFTdGFjay5hZGREZXBlbmRlbmN5KG5ldHdvcmtTdGFjayk7XG5sYW1iZGFTdGFjay5hZGREZXBlbmRlbmN5KGRhdGFiYXNlU3RhY2spO1xuLy8gTm90ZTogYXBpR2F0ZXdheVN0YWNrLCBhbGJTdGFjaywgYW5kIGpvYnNTdGFjayBkZXBlbmRlbmNpZXMgYXJlIGltcGxpY2l0IHdoZW4gaW50ZWdyYXRpb25zIGFyZSBhZGRlZFxuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIE1vbml0b3JpbmcgU3RhY2sgKENsb3VkV2F0Y2ggKyBYLVJheSlcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG5jb25zdCBtb25pdG9yaW5nU3RhY2sgPSBuZXcgTW9uaXRvcmluZ1N0YWNrKGFwcCwgYEVkdUxlbnNNb25pdG9yaW5nU3RhY2stJHtjb25maWcuc3RhZ2V9YCwge1xuICBlbnYsXG4gIGNvbmZpZyxcbiAgcmVzdEFwaTogYXBpR2F0ZXdheVN0YWNrLnJlc3RBcGksXG4gIGF1cm9yYUNsdXN0ZXI6IGRhdGFiYXNlU3RhY2suYXVyb3JhQ2x1c3RlcixcbiAgc3VtbWFyaXphdGlvblF1ZXVlOiBqb2JzU3RhY2suc3VtbWFyaXphdGlvblF1ZXVlLFxuICBpbnNpZ2h0c1F1ZXVlOiBqb2JzU3RhY2suaW5zaWdodHNRdWV1ZSxcbiAgc3VtbWFyaXphdGlvbkRMUTogam9ic1N0YWNrLnN1bW1hcml6YXRpb25ETFEsXG4gIGluc2lnaHRzRExROiBqb2JzU3RhY2suaW5zaWdodHNETFEsXG4gIGxhbWJkYUZ1bmN0aW9uczogW1xuICAgIGxhbWJkYVN0YWNrLmNyZWF0ZVRlc3RGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5zdGFydFRlc3RTZXNzaW9uRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suc3VibWl0QW5zd2VyRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suZW5kVGVzdFNlc3Npb25GdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5wYXJlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLnN0dWRlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uLFxuICAgIGxhbWJkYVN0YWNrLmNhbGN1bGF0ZVByb2ZpbGVGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5zdW1tYXJpemF0aW9uV29ya2VyRnVuY3Rpb24sXG4gICAgbGFtYmRhU3RhY2suaW5zaWdodHNXb3JrZXJGdW5jdGlvbixcbiAgICBsYW1iZGFTdGFjay5hZG1pblN5c3RlbU1ldHJpY3NGdW5jdGlvbixcbiAgXSxcbiAgZGVzY3JpcHRpb246IGBFZHVMZW5zIE1vbml0b3JpbmcgSW5mcmFzdHJ1Y3R1cmUgKCR7Y29uZmlnLnN0YWdlfSlgLFxuICB0YWdzOiBjb25maWcudGFncyxcbn0pO1xuXG5tb25pdG9yaW5nU3RhY2suYWRkRGVwZW5kZW5jeShsYW1iZGFTdGFjayk7XG5cbi8vIFRhZyBhbGwgc3RhY2tzXG5jZGsuVGFncy5vZihhcHApLmFkZCgnUHJvamVjdCcsICdFZHVMZW5zJyk7XG5jZGsuVGFncy5vZihhcHApLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ1N0YWdlJywgY29uZmlnLnN0YWdlKTtcblxuYXBwLnN5bnRoKCk7XG4iXX0=