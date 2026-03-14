/**
 * Jobs Stack
 *
 * Creates SQS queues and EventBridge rules for async job processing
 */

import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
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

  constructor(scope: Construct, id: string, props: JobsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ============================================================
    // Dead Letter Queues
    // ============================================================

    // DLQ for summarization queue
    this.summarizationDLQ = new sqs.Queue(this, 'SummarizationDLQ', {
      queueName: `edulens-summarization-dlq-${config.stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // DLQ for insights queue
    this.insightsDLQ = new sqs.Queue(this, 'InsightsDLQ', {
      queueName: `edulens-insights-dlq-${config.stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // ============================================================
    // SQS Queues
    // ============================================================

    // Conversation Summarization Queue
    this.summarizationQueue = new sqs.Queue(this, 'SummarizationQueue', {
      queueName: `edulens-summarization-queue-${config.stage}`,
      visibilityTimeout: cdk.Duration.minutes(5), // 5 min timeout for summarization
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling

      // Dead letter queue configuration
      deadLetterQueue: {
        queue: this.summarizationDLQ,
        maxReceiveCount: 3, // Retry 3 times before DLQ
      },

      // Encryption (production)
      encryption: config.stage === 'prod'
        ? sqs.QueueEncryption.KMS_MANAGED
        : sqs.QueueEncryption.UNENCRYPTED,
    });

    // Insights Extraction Queue
    this.insightsQueue = new sqs.Queue(this, 'InsightsQueue', {
      queueName: `edulens-insights-queue-${config.stage}`,
      visibilityTimeout: cdk.Duration.minutes(10), // 10 min timeout for insights
      retentionPeriod: cdk.Duration.days(4),
      receiveMessageWaitTime: cdk.Duration.seconds(20),

      deadLetterQueue: {
        queue: this.insightsDLQ,
        maxReceiveCount: 2, // Retry 2 times before DLQ
      },

      encryption: config.stage === 'prod'
        ? sqs.QueueEncryption.KMS_MANAGED
        : sqs.QueueEncryption.UNENCRYPTED,
    });

    // ============================================================
    // EventBridge Event Bus
    // ============================================================

    // Use default event bus (cost-effective)
    this.eventBus = events.EventBus.fromEventBusName(
      this,
      'DefaultEventBus',
      'default'
    );

    // ============================================================
    // EventBridge Rules
    // ============================================================

    // Rule 1: Chat Session Ended → Summarization Queue
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

    // Rule 2: Test Completed → Profile Calculation
    // (This will trigger Lambda directly, not via SQS)
    this.testCompletedRule = new events.Rule(this, 'TestCompletedRule', {
      ruleName: `edulens-test-completed-${config.stage}`,
      description: 'Trigger profile calculation when test completes',
      eventBus: this.eventBus,

      eventPattern: {
        source: ['edulens.test-engine'],
        detailType: ['test.completed'],
      },
    });

    // Target will be added in Lambda stack

    // Rule 3: Scheduled Batch Processing (Hourly)
    const batchProcessingRule = new events.Rule(this, 'BatchProcessingRule', {
      ruleName: `edulens-batch-processing-${config.stage}`,
      description: 'Hourly batch processing for unsummarized sessions',
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
    });

    // Target will be added in Lambda stack

    // Rule 4: Daily Insights Generation
    const dailyInsightsRule = new events.Rule(this, 'DailyInsightsRule', {
      ruleName: `edulens-daily-insights-${config.stage}`,
      description: 'Daily insights generation (2 AM UTC)',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    // Target will be added in Lambda stack

    // Rule 5: Timer Sync (Every 1 minute) - WebSocket broadcasts
    // Note: EventBridge minimum interval is 1 minute. For sub-minute updates,
    // use a different approach (e.g., WebSocket keep-alive from client or Step Functions)
    this.timerSyncRule = new events.Rule(this, 'TimerSyncRule', {
      ruleName: `edulens-timer-sync-${config.stage}`,
      description: 'Timer sync broadcasts every 1 minute',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });

    // Target will be added in Lambda stack

    // ============================================================
    // CloudWatch Alarms (Production)
    // ============================================================

    if (config.stage === 'prod') {
      // Alarm: DLQ has messages
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

      // Alarm: Queue depth is high
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
