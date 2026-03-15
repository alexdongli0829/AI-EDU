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
