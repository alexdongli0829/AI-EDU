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
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface JobsStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class JobsStack extends cdk.Stack {
  public readonly summarizationQueue: sqs.Queue;
  public readonly summarizationDLQ: sqs.Queue;
  public readonly insightsQueue: sqs.Queue;
  public readonly insightsDLQ: sqs.Queue;
  public readonly eventBus: events.IEventBus;
  public readonly testCompletedRule: events.Rule;
  public readonly timerSyncRule: events.Rule;
  public readonly dailyInsightsRule: events.Rule;
  public readonly batchProcessingRule: events.Rule;

  constructor(scope: Construct, id: string, props: JobsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ============================================================
    // Dead Letter Queues
    // ============================================================

    this.summarizationDLQ = new sqs.Queue(this, 'SummarizationDLQ', {
      queueName: `edulens-summarization-dlq-${config.stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.insightsDLQ = new sqs.Queue(this, 'InsightsDLQ', {
      queueName: `edulens-insights-dlq-${config.stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // ============================================================
    // SQS Queues
    // ============================================================

    this.summarizationQueue = new sqs.Queue(this, 'SummarizationQueue', {
      queueName: `edulens-summarization-queue-${config.stage}`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.summarizationDLQ,
        maxReceiveCount: 3,
      },
      encryption: config.stage === 'prod'
        ? sqs.QueueEncryption.KMS_MANAGED
        : sqs.QueueEncryption.UNENCRYPTED,
    });

    this.insightsQueue = new sqs.Queue(this, 'InsightsQueue', {
      queueName: `edulens-insights-queue-${config.stage}`,
      visibilityTimeout: cdk.Duration.minutes(10),
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.insightsDLQ,
        maxReceiveCount: 2,
      },
      encryption: config.stage === 'prod'
        ? sqs.QueueEncryption.KMS_MANAGED
        : sqs.QueueEncryption.UNENCRYPTED,
    });

    // ============================================================
    // EventBridge Event Bus
    // ============================================================

    this.eventBus = events.EventBus.fromEventBusName(
      this,
      'DefaultEventBus',
      'default'
    );

    // ============================================================
    // EventBridge Rules
    // ============================================================

    // Rule 1: Chat Session Ended → Summarization Queue (target wired inline — no Lambda dep)
    const chatEndedRule = new events.Rule(this, 'ChatSessionEndedRule', {
      ruleName: `edulens-chat-ended-${config.stage}`,
      description: 'Trigger summarization when chat session ends',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['edulens.conversation-engine'],
        detailType: ['chat_session.ended'],
      },
    });

    chatEndedRule.addTarget(
      new events_targets.SqsQueue(this.summarizationQueue, {
        message: events.RuleTargetInput.fromEventPath('$.detail'),
      })
    );

    // Rule 2: Test Completed → Profile Calculation (target wired in app.ts)
    this.testCompletedRule = new events.Rule(this, 'TestCompletedRule', {
      ruleName: `edulens-test-completed-${config.stage}`,
      description: 'Trigger profile calculation when test completes',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['edulens.test-engine'],
        detailType: ['test.completed'],
      },
    });

    // Rule 3: Scheduled Batch Processing (Hourly) — target wired in app.ts
    this.batchProcessingRule = new events.Rule(this, 'BatchProcessingRule', {
      ruleName: `edulens-batch-processing-${config.stage}`,
      description: 'Hourly batch processing for unsummarized sessions',
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    // Rule 4: Daily Insights Generation (target wired in app.ts)
    this.dailyInsightsRule = new events.Rule(this, 'DailyInsightsRule', {
      ruleName: `edulens-daily-insights-${config.stage}`,
      description: 'Daily AI insights generation for all students (midnight UTC)',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '0',
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    // Rule 5: Timer Sync (Every 1 minute) — target wired in app.ts
    this.timerSyncRule = new events.Rule(this, 'TimerSyncRule', {
      ruleName: `edulens-timer-sync-${config.stage}`,
      description: 'Timer sync broadcasts every 1 minute',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });

    // ============================================================
    // CloudWatch Alarms (Production)
    // ============================================================

    if (config.stage === 'prod') {
      this.summarizationDLQ.metricApproximateNumberOfMessagesVisible().createAlarm(
        this,
        'SummarizationDLQAlarm',
        {
          threshold: 1,
          evaluationPeriods: 1,
          alarmDescription: 'Messages in summarization DLQ',
        }
      );

      this.insightsDLQ.metricApproximateNumberOfMessagesVisible().createAlarm(
        this,
        'InsightsDLQAlarm',
        {
          threshold: 1,
          evaluationPeriods: 1,
          alarmDescription: 'Messages in insights DLQ',
        }
      );

      this.summarizationQueue.metricApproximateNumberOfMessagesVisible().createAlarm(
        this,
        'SummarizationQueueDepthAlarm',
        {
          threshold: 1000,
          evaluationPeriods: 2,
          alarmDescription: 'High number of messages in summarization queue',
        }
      );
    }

    // ============================================================
    // Outputs
    // ============================================================

    new cdk.CfnOutput(this, 'SummarizationQueueUrl', {
      value: this.summarizationQueue.queueUrl,
      description: 'Summarization queue URL',
      exportName: `edulens-summarization-queue-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'SummarizationQueueArn', {
      value: this.summarizationQueue.queueArn,
      description: 'Summarization queue ARN',
    });

    new cdk.CfnOutput(this, 'InsightsQueueUrl', {
      value: this.insightsQueue.queueUrl,
      description: 'Insights queue URL',
      exportName: `edulens-insights-queue-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'InsightsQueueArn', {
      value: this.insightsQueue.queueArn,
      description: 'Insights queue ARN',
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'EventBridge event bus name',
    });
  }
}
