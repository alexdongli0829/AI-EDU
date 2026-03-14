#!/usr/bin/env node
/**
 * EduLens CDK Application
 *
 * Deploys all infrastructure stacks for the EduLens platform
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ApiGatewayStack } from '../lib/stacks/api-gateway-stack';
import { AlbStack } from '../lib/stacks/alb-stack';
import { JobsStack } from '../lib/stacks/jobs-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { getConfig } from '../config/environments';

const app = new cdk.App();

// Get stage from context or environment variable
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const config = getConfig(stage);

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

const networkStack = new NetworkStack(app, `EduLensNetworkStack-${config.stage}`, {
  env,
  config,
  description: `EduLens Network Infrastructure (${config.stage})`,
  tags: config.tags,
});

// ============================================================
// Database Stack
// ============================================================

const databaseStack = new DatabaseStack(app, `EduLensDatabaseStack-${config.stage}`, {
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

const apiGatewayStack = new ApiGatewayStack(app, `EduLensApiGatewayStack-${config.stage}`, {
  env,
  config,
  description: `EduLens API Gateway Infrastructure (${config.stage})`,
  tags: config.tags,
});

// ============================================================
// ALB Stack (for SSE streaming)
// ============================================================

const albStack = new AlbStack(app, `EduLensAlbStack-${config.stage}`, {
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

const jobsStack = new JobsStack(app, `EduLensJobsStack-${config.stage}`, {
  env,
  config,
  description: `EduLens Jobs Infrastructure (${config.stage})`,
  tags: config.tags,
});

// ============================================================
// Lambda Stack (all 6 services)
// ============================================================

const lambdaStack = new LambdaStack(app, `EduLensLambdaStack-${config.stage}`, {
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

const monitoringStack = new MonitoringStack(app, `EduLensMonitoringStack-${config.stage}`, {
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
