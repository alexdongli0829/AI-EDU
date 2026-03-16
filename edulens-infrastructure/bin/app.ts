#!/usr/bin/env node
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
 *   8. AgentCoreStack             — ECR repos + Memory store + Runtime (AI agents)
 *
 * Cyclic dependency strategy:
 *   LambdaStack receives queue/eventBus ARNs as constructed strings (not CDK tokens),
 *   so no Fn::ImportValue cross-stack reference is generated. EventBridge targets are
 *   added directly via CfnRule.targets with literal Lambda ARN strings, avoiding
 *   CDK's automatic Lambda::Permission creation in JobsStack (which would require
 *   Lambda to already exist and would force a circular addDependency). All
 *   Lambda::Permission resources for EventBridge live in LambdaStack.
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ApiGatewayStack } from '../lib/stacks/api-gateway-stack';
import { AlbStack } from '../lib/stacks/alb-stack';
import { JobsStack } from '../lib/stacks/jobs-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { AgentCoreStack } from '../lib/stacks/agentcore-stack';
import { getConfig } from '../config/environments';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const config = getConfig(stage);

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

const networkStack = new NetworkStack(app, `EduLensNetworkStack-${config.stage}`, {
  env,
  config,
  description: `EduLens Network Infrastructure (${config.stage})`,
  tags: config.tags,
});

// ============================================================
// 2. Database Stack
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
// 3. Jobs Stack  (SQS + EventBridge rules — no Lambda deps)
// ============================================================

const jobsStack = new JobsStack(app, `EduLensJobsStack-${config.stage}`, {
  env,
  config,
  description: `EduLens Jobs Infrastructure (${config.stage})`,
  tags: config.tags,
});

// ============================================================
// 4. API Gateway Stack  (REST + WebSocket API skeleton)
// ============================================================

const apiGatewayStack = new ApiGatewayStack(app, `EduLensApiGatewayStack-${config.stage}`, {
  env,
  config,
  description: `EduLens API Gateway Infrastructure (${config.stage})`,
  tags: config.tags,
});

// ============================================================
// 5. ALB Stack  (ALB + HTTP listener skeleton)
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
// 6. Lambda Stack  (Lambda functions + IAM — no API/ALB deps)
//
// Queue/EventBus ARNs are passed as constructed strings to avoid
// bidirectional CloudFormation cross-stack references with JobsStack.
// ============================================================

const summarizationQueueArn = `arn:aws:sqs:${config.region}:${config.account}:edulens-summarization-queue-${config.stage}`;
const insightsQueueArn      = `arn:aws:sqs:${config.region}:${config.account}:edulens-insights-queue-${config.stage}`;
const eventBusArn           = `arn:aws:events:${config.region}:${config.account}:event-bus/default`;

const lambdaStack = new LambdaStack(app, `EduLensLambdaStack-${config.stage}`, {
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
lambdaStack.addDependency(jobsStack);   // ensures queues exist before Lambda tries to consume them

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

albStack.addTargetGroups(
  lambdaStack.parentChatSendStreamFunction,
  lambdaStack.studentChatSendStreamFunction,
);
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

const eventBridgeTargets: Array<{ rule: events.Rule; targetId: string; fnName: string }> = [
  { rule: jobsStack.testCompletedRule,  targetId: 'CalcProfile',     fnName: `edulens-calculate-profile-${config.stage}` },
  { rule: jobsStack.timerSyncRule,      targetId: 'TimerSync',       fnName: `edulens-timer-sync-${config.stage}` },
  { rule: jobsStack.dailyInsightsRule,  targetId: 'StudentInsights', fnName: `edulens-student-insights-${config.stage}` },
  { rule: jobsStack.batchProcessingRule, targetId: 'InsightsWorker', fnName: `edulens-insights-worker-${config.stage}` },
];

for (const { rule, targetId, fnName } of eventBridgeTargets) {
  const cfnRule = rule.node.defaultChild as events.CfnRule;
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
monitoringStack.addDependency(apiGatewayStack);

// ============================================================
// 11. AgentCore Stack  (S3 + IAM + Memory for AI agents)
//
// Depends on Network (VPC/subnets) and Database (Aurora secret).
// Phase 1: S3 bucket, IAM roles, SG, Memory reference
// Phase 2: Package agent code, upload zip to S3, create Runtimes via CLI
// ============================================================

const agentCoreStack = new AgentCoreStack(app, `EduLensAgentCoreStack-${config.stage}`, {
  env,
  config,
  vpc: networkStack.vpc,
  lambdaSecurityGroup: networkStack.lambdaSecurityGroup,
  auroraSecret: databaseStack.auroraSecret,
  description: `EduLens AgentCore AI Agents (${config.stage})`,
  tags: config.tags,
});

agentCoreStack.addDependency(networkStack);
agentCoreStack.addDependency(databaseStack);

// Tag all stacks
cdk.Tags.of(app).add('Project', 'EduLens');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Stage', config.stage);

app.synth();
