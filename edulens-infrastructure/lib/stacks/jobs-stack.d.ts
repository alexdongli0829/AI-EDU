/**
 * Jobs Stack
 *
 * Creates SQS queues and EventBridge rules for async job processing.
 * EventBridge targets are wired in app.ts after LambdaStack is created,
 * using constructed ARNs to avoid cyclic CloudFormation dependencies.
 */
import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
export interface JobsStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
}
export declare class JobsStack extends cdk.Stack {
    readonly summarizationQueue: sqs.Queue;
    readonly summarizationDLQ: sqs.Queue;
    readonly insightsQueue: sqs.Queue;
    readonly insightsDLQ: sqs.Queue;
    readonly eventBus: events.IEventBus;
    readonly testCompletedRule: events.Rule;
    readonly timerSyncRule: events.Rule;
    readonly dailyInsightsRule: events.Rule;
    readonly batchProcessingRule: events.Rule;
    constructor(scope: Construct, id: string, props: JobsStackProps);
}
