"use strict";
/**
 * Jobs Stack
 *
 * Creates SQS queues and EventBridge rules for async job processing
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
exports.JobsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const events_targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
class JobsStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        this.eventBus = events.EventBus.fromEventBusName(this, 'DefaultEventBus', 'default');
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
        chatEndedRule.addTarget(new events_targets.SqsQueue(this.summarizationQueue, {
            message: events.RuleTargetInput.fromEventPath('$.detail'),
        }));
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
            this.summarizationDLQ.metricApproximateNumberOfMessagesVisible().createAlarm(this, 'SummarizationDLQAlarm', {
                threshold: 1,
                evaluationPeriods: 1,
                alarmDescription: 'Messages in summarization DLQ',
            });
            this.insightsDLQ.metricApproximateNumberOfMessagesVisible().createAlarm(this, 'InsightsDLQAlarm', {
                threshold: 1,
                evaluationPeriods: 1,
                alarmDescription: 'Messages in insights DLQ',
            });
            // Alarm: Queue depth is high
            this.summarizationQueue.metricApproximateNumberOfMessagesVisible().createAlarm(this, 'SummarizationQueueDepthAlarm', {
                threshold: 1000,
                evaluationPeriods: 2,
                alarmDescription: 'High number of messages in summarization queue',
            });
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
exports.JobsStack = JobsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9icy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImpvYnMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MsK0RBQWlEO0FBQ2pELCtFQUFpRTtBQVFqRSxNQUFhLFNBQVUsU0FBUSxHQUFHLENBQUMsS0FBSztJQVN0QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXFCO1FBQzdELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFekIsK0RBQStEO1FBQy9ELHFCQUFxQjtRQUNyQiwrREFBK0Q7UUFFL0QsOEJBQThCO1FBQzlCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzlELFNBQVMsRUFBRSw2QkFBNkIsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUN0RCxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1NBQ3ZDLENBQUMsQ0FBQztRQUVILHlCQUF5QjtRQUN6QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3BELFNBQVMsRUFBRSx3QkFBd0IsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUNqRCxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1NBQ3ZDLENBQUMsQ0FBQztRQUVILCtEQUErRDtRQUMvRCxhQUFhO1FBQ2IsK0RBQStEO1FBRS9ELG1DQUFtQztRQUNuQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUNsRSxTQUFTLEVBQUUsK0JBQStCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDeEQsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsa0NBQWtDO1lBQzlFLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDckMsc0JBQXNCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsZUFBZTtZQUVqRSxrQ0FBa0M7WUFDbEMsZUFBZSxFQUFFO2dCQUNmLEtBQUssRUFBRSxJQUFJLENBQUMsZ0JBQWdCO2dCQUM1QixlQUFlLEVBQUUsQ0FBQyxFQUFFLDJCQUEyQjthQUNoRDtZQUVELDBCQUEwQjtZQUMxQixVQUFVLEVBQUUsTUFBTSxDQUFDLEtBQUssS0FBSyxNQUFNO2dCQUNqQyxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxXQUFXO2dCQUNqQyxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxXQUFXO1NBQ3BDLENBQUMsQ0FBQztRQUVILDRCQUE0QjtRQUM1QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3hELFNBQVMsRUFBRSwwQkFBMEIsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUNuRCxpQkFBaUIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSw4QkFBOEI7WUFDM0UsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNyQyxzQkFBc0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFFaEQsZUFBZSxFQUFFO2dCQUNmLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVztnQkFDdkIsZUFBZSxFQUFFLENBQUMsRUFBRSwyQkFBMkI7YUFDaEQ7WUFFRCxVQUFVLEVBQUUsTUFBTSxDQUFDLEtBQUssS0FBSyxNQUFNO2dCQUNqQyxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxXQUFXO2dCQUNqQyxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxXQUFXO1NBQ3BDLENBQUMsQ0FBQztRQUVILCtEQUErRDtRQUMvRCx3QkFBd0I7UUFDeEIsK0RBQStEO1FBRS9ELHlDQUF5QztRQUN6QyxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQzlDLElBQUksRUFDSixpQkFBaUIsRUFDakIsU0FBUyxDQUNWLENBQUM7UUFFRiwrREFBK0Q7UUFDL0Qsb0JBQW9CO1FBQ3BCLCtEQUErRDtRQUUvRCxtREFBbUQ7UUFDbkQsTUFBTSxhQUFhLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUNsRSxRQUFRLEVBQUUsc0JBQXNCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDOUMsV0FBVyxFQUFFLDhDQUE4QztZQUMzRCxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFFdkIsWUFBWSxFQUFFO2dCQUNaLE1BQU0sRUFBRSxDQUFDLDZCQUE2QixDQUFDO2dCQUN2QyxVQUFVLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQzthQUNuQztTQUNGLENBQUMsQ0FBQztRQUVILGFBQWEsQ0FBQyxTQUFTLENBQ3JCLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7WUFDbkQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQztTQUMxRCxDQUFDLENBQ0gsQ0FBQztRQUVGLCtDQUErQztRQUMvQyxtREFBbUQ7UUFDbkQsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDbEUsUUFBUSxFQUFFLDBCQUEwQixNQUFNLENBQUMsS0FBSyxFQUFFO1lBQ2xELFdBQVcsRUFBRSxpREFBaUQ7WUFDOUQsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBRXZCLFlBQVksRUFBRTtnQkFDWixNQUFNLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztnQkFDL0IsVUFBVSxFQUFFLENBQUMsZ0JBQWdCLENBQUM7YUFDL0I7U0FDRixDQUFDLENBQUM7UUFFSCx1Q0FBdUM7UUFFdkMsOENBQThDO1FBQzlDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUN2RSxRQUFRLEVBQUUsNEJBQTRCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDcEQsV0FBVyxFQUFFLG1EQUFtRDtZQUNoRSxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDdEQsQ0FBQyxDQUFDO1FBRUgsdUNBQXVDO1FBRXZDLG9DQUFvQztRQUNwQyxNQUFNLGlCQUFpQixHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDbkUsUUFBUSxFQUFFLDBCQUEwQixNQUFNLENBQUMsS0FBSyxFQUFFO1lBQ2xELFdBQVcsRUFBRSxzQ0FBc0M7WUFDbkQsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO2dCQUM3QixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsR0FBRztnQkFDVCxHQUFHLEVBQUUsR0FBRztnQkFDUixLQUFLLEVBQUUsR0FBRztnQkFDVixJQUFJLEVBQUUsR0FBRzthQUNWLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCx1Q0FBdUM7UUFFdkMsNkRBQTZEO1FBQzdELDBFQUEwRTtRQUMxRSxzRkFBc0Y7UUFDdEYsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUMxRCxRQUFRLEVBQUUsc0JBQXNCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDOUMsV0FBVyxFQUFFLHNDQUFzQztZQUNuRCxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDeEQsQ0FBQyxDQUFDO1FBRUgsdUNBQXVDO1FBRXZDLCtEQUErRDtRQUMvRCxpQ0FBaUM7UUFDakMsK0RBQStEO1FBRS9ELElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUM1QiwwQkFBMEI7WUFDMUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLHdDQUF3QyxFQUFFLENBQUMsV0FBVyxDQUMxRSxJQUFJLEVBQ0osdUJBQXVCLEVBQ3ZCO2dCQUNFLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLGdCQUFnQixFQUFFLCtCQUErQjthQUNsRCxDQUNGLENBQUM7WUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLHdDQUF3QyxFQUFFLENBQUMsV0FBVyxDQUNyRSxJQUFJLEVBQ0osa0JBQWtCLEVBQ2xCO2dCQUNFLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLGdCQUFnQixFQUFFLDBCQUEwQjthQUM3QyxDQUNGLENBQUM7WUFFRiw2QkFBNkI7WUFDN0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLHdDQUF3QyxFQUFFLENBQUMsV0FBVyxDQUM1RSxJQUFJLEVBQ0osOEJBQThCLEVBQzlCO2dCQUNFLFNBQVMsRUFBRSxJQUFJO2dCQUNmLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLGdCQUFnQixFQUFFLGdEQUFnRDthQUNuRSxDQUNGLENBQUM7UUFDSixDQUFDO1FBRUQsK0RBQStEO1FBQy9ELFVBQVU7UUFDViwrREFBK0Q7UUFFL0QsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVE7WUFDdkMsV0FBVyxFQUFFLHlCQUF5QjtZQUN0QyxVQUFVLEVBQUUsK0JBQStCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7U0FDMUQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVE7WUFDdkMsV0FBVyxFQUFFLHlCQUF5QjtTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQzFDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7WUFDbEMsV0FBVyxFQUFFLG9CQUFvQjtZQUNqQyxVQUFVLEVBQUUsMEJBQTBCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7U0FDckQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1lBQ2xDLFdBQVcsRUFBRSxvQkFBb0I7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWTtZQUNqQyxXQUFXLEVBQUUsNEJBQTRCO1NBQzFDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTlORCw4QkE4TkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEpvYnMgU3RhY2tcbiAqXG4gKiBDcmVhdGVzIFNRUyBxdWV1ZXMgYW5kIEV2ZW50QnJpZGdlIHJ1bGVzIGZvciBhc3luYyBqb2IgcHJvY2Vzc2luZ1xuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyBldmVudHNfdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEpvYnNTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgSm9ic1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHN1bW1hcml6YXRpb25RdWV1ZTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgc3VtbWFyaXphdGlvbkRMUTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgaW5zaWdodHNRdWV1ZTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgaW5zaWdodHNETFE6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IGV2ZW50QnVzOiBldmVudHMuSUV2ZW50QnVzO1xuICBwdWJsaWMgcmVhZG9ubHkgdGVzdENvbXBsZXRlZFJ1bGU6IGV2ZW50cy5SdWxlO1xuICBwdWJsaWMgcmVhZG9ubHkgdGltZXJTeW5jUnVsZTogZXZlbnRzLlJ1bGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEpvYnNTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IGNvbmZpZyB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBEZWFkIExldHRlciBRdWV1ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIERMUSBmb3Igc3VtbWFyaXphdGlvbiBxdWV1ZVxuICAgIHRoaXMuc3VtbWFyaXphdGlvbkRMUSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1N1bW1hcml6YXRpb25ETFEnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGBlZHVsZW5zLXN1bW1hcml6YXRpb24tZGxxLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICB9KTtcblxuICAgIC8vIERMUSBmb3IgaW5zaWdodHMgcXVldWVcbiAgICB0aGlzLmluc2lnaHRzRExRID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnSW5zaWdodHNETFEnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGBlZHVsZW5zLWluc2lnaHRzLWRscS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTUVMgUXVldWVzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBDb252ZXJzYXRpb24gU3VtbWFyaXphdGlvbiBRdWV1ZVxuICAgIHRoaXMuc3VtbWFyaXphdGlvblF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnU3VtbWFyaXphdGlvblF1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiBgZWR1bGVucy1zdW1tYXJpemF0aW9uLXF1ZXVlLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksIC8vIDUgbWluIHRpbWVvdXQgZm9yIHN1bW1hcml6YXRpb25cbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoNCksXG4gICAgICByZWNlaXZlTWVzc2FnZVdhaXRUaW1lOiBjZGsuRHVyYXRpb24uc2Vjb25kcygyMCksIC8vIExvbmcgcG9sbGluZ1xuXG4gICAgICAvLyBEZWFkIGxldHRlciBxdWV1ZSBjb25maWd1cmF0aW9uXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgICAgcXVldWU6IHRoaXMuc3VtbWFyaXphdGlvbkRMUSxcbiAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLCAvLyBSZXRyeSAzIHRpbWVzIGJlZm9yZSBETFFcbiAgICAgIH0sXG5cbiAgICAgIC8vIEVuY3J5cHRpb24gKHByb2R1Y3Rpb24pXG4gICAgICBlbmNyeXB0aW9uOiBjb25maWcuc3RhZ2UgPT09ICdwcm9kJ1xuICAgICAgICA/IHNxcy5RdWV1ZUVuY3J5cHRpb24uS01TX01BTkFHRURcbiAgICAgICAgOiBzcXMuUXVldWVFbmNyeXB0aW9uLlVORU5DUllQVEVELFxuICAgIH0pO1xuXG4gICAgLy8gSW5zaWdodHMgRXh0cmFjdGlvbiBRdWV1ZVxuICAgIHRoaXMuaW5zaWdodHNRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ0luc2lnaHRzUXVldWUnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGBlZHVsZW5zLWluc2lnaHRzLXF1ZXVlLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLCAvLyAxMCBtaW4gdGltZW91dCBmb3IgaW5zaWdodHNcbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoNCksXG4gICAgICByZWNlaXZlTWVzc2FnZVdhaXRUaW1lOiBjZGsuRHVyYXRpb24uc2Vjb25kcygyMCksXG5cbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogdGhpcy5pbnNpZ2h0c0RMUSxcbiAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAyLCAvLyBSZXRyeSAyIHRpbWVzIGJlZm9yZSBETFFcbiAgICAgIH0sXG5cbiAgICAgIGVuY3J5cHRpb246IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnXG4gICAgICAgID8gc3FzLlF1ZXVlRW5jcnlwdGlvbi5LTVNfTUFOQUdFRFxuICAgICAgICA6IHNxcy5RdWV1ZUVuY3J5cHRpb24uVU5FTkNSWVBURUQsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBFdmVudEJyaWRnZSBFdmVudCBCdXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIFVzZSBkZWZhdWx0IGV2ZW50IGJ1cyAoY29zdC1lZmZlY3RpdmUpXG4gICAgdGhpcy5ldmVudEJ1cyA9IGV2ZW50cy5FdmVudEJ1cy5mcm9tRXZlbnRCdXNOYW1lKFxuICAgICAgdGhpcyxcbiAgICAgICdEZWZhdWx0RXZlbnRCdXMnLFxuICAgICAgJ2RlZmF1bHQnXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGVzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBSdWxlIDE6IENoYXQgU2Vzc2lvbiBFbmRlZCDihpIgU3VtbWFyaXphdGlvbiBRdWV1ZVxuICAgIGNvbnN0IGNoYXRFbmRlZFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0NoYXRTZXNzaW9uRW5kZWRSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBlZHVsZW5zLWNoYXQtZW5kZWQtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHJpZ2dlciBzdW1tYXJpemF0aW9uIHdoZW4gY2hhdCBzZXNzaW9uIGVuZHMnLFxuICAgICAgZXZlbnRCdXM6IHRoaXMuZXZlbnRCdXMsXG5cbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnZWR1bGVucy5jb252ZXJzYXRpb24tZW5naW5lJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnY2hhdF9zZXNzaW9uLmVuZGVkJ10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY2hhdEVuZGVkUnVsZS5hZGRUYXJnZXQoXG4gICAgICBuZXcgZXZlbnRzX3RhcmdldHMuU3FzUXVldWUodGhpcy5zdW1tYXJpemF0aW9uUXVldWUsIHtcbiAgICAgICAgbWVzc2FnZTogZXZlbnRzLlJ1bGVUYXJnZXRJbnB1dC5mcm9tRXZlbnRQYXRoKCckLmRldGFpbCcpLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gUnVsZSAyOiBUZXN0IENvbXBsZXRlZCDihpIgUHJvZmlsZSBDYWxjdWxhdGlvblxuICAgIC8vIChUaGlzIHdpbGwgdHJpZ2dlciBMYW1iZGEgZGlyZWN0bHksIG5vdCB2aWEgU1FTKVxuICAgIHRoaXMudGVzdENvbXBsZXRlZFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1Rlc3RDb21wbGV0ZWRSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBlZHVsZW5zLXRlc3QtY29tcGxldGVkLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXIgcHJvZmlsZSBjYWxjdWxhdGlvbiB3aGVuIHRlc3QgY29tcGxldGVzJyxcbiAgICAgIGV2ZW50QnVzOiB0aGlzLmV2ZW50QnVzLFxuXG4gICAgICBldmVudFBhdHRlcm46IHtcbiAgICAgICAgc291cmNlOiBbJ2VkdWxlbnMudGVzdC1lbmdpbmUnXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWyd0ZXN0LmNvbXBsZXRlZCddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFRhcmdldCB3aWxsIGJlIGFkZGVkIGluIExhbWJkYSBzdGFja1xuXG4gICAgLy8gUnVsZSAzOiBTY2hlZHVsZWQgQmF0Y2ggUHJvY2Vzc2luZyAoSG91cmx5KVxuICAgIGNvbnN0IGJhdGNoUHJvY2Vzc2luZ1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0JhdGNoUHJvY2Vzc2luZ1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGVkdWxlbnMtYmF0Y2gtcHJvY2Vzc2luZy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdIb3VybHkgYmF0Y2ggcHJvY2Vzc2luZyBmb3IgdW5zdW1tYXJpemVkIHNlc3Npb25zJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUucmF0ZShjZGsuRHVyYXRpb24uaG91cnMoMSkpLFxuICAgIH0pO1xuXG4gICAgLy8gVGFyZ2V0IHdpbGwgYmUgYWRkZWQgaW4gTGFtYmRhIHN0YWNrXG5cbiAgICAvLyBSdWxlIDQ6IERhaWx5IEluc2lnaHRzIEdlbmVyYXRpb25cbiAgICBjb25zdCBkYWlseUluc2lnaHRzUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnRGFpbHlJbnNpZ2h0c1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGVkdWxlbnMtZGFpbHktaW5zaWdodHMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGFpbHkgaW5zaWdodHMgZ2VuZXJhdGlvbiAoMiBBTSBVVEMpJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMicsXG4gICAgICAgIGRheTogJyonLFxuICAgICAgICBtb250aDogJyonLFxuICAgICAgICB5ZWFyOiAnKicsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIFRhcmdldCB3aWxsIGJlIGFkZGVkIGluIExhbWJkYSBzdGFja1xuXG4gICAgLy8gUnVsZSA1OiBUaW1lciBTeW5jIChFdmVyeSAxIG1pbnV0ZSkgLSBXZWJTb2NrZXQgYnJvYWRjYXN0c1xuICAgIC8vIE5vdGU6IEV2ZW50QnJpZGdlIG1pbmltdW0gaW50ZXJ2YWwgaXMgMSBtaW51dGUuIEZvciBzdWItbWludXRlIHVwZGF0ZXMsXG4gICAgLy8gdXNlIGEgZGlmZmVyZW50IGFwcHJvYWNoIChlLmcuLCBXZWJTb2NrZXQga2VlcC1hbGl2ZSBmcm9tIGNsaWVudCBvciBTdGVwIEZ1bmN0aW9ucylcbiAgICB0aGlzLnRpbWVyU3luY1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1RpbWVyU3luY1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGVkdWxlbnMtdGltZXItc3luYy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdUaW1lciBzeW5jIGJyb2FkY2FzdHMgZXZlcnkgMSBtaW51dGUnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKGNkay5EdXJhdGlvbi5taW51dGVzKDEpKSxcbiAgICB9KTtcblxuICAgIC8vIFRhcmdldCB3aWxsIGJlIGFkZGVkIGluIExhbWJkYSBzdGFja1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ2xvdWRXYXRjaCBBbGFybXMgKFByb2R1Y3Rpb24pXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBpZiAoY29uZmlnLnN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgIC8vIEFsYXJtOiBETFEgaGFzIG1lc3NhZ2VzXG4gICAgICB0aGlzLnN1bW1hcml6YXRpb25ETFEubWV0cmljQXBwcm94aW1hdGVOdW1iZXJPZk1lc3NhZ2VzVmlzaWJsZSgpLmNyZWF0ZUFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnU3VtbWFyaXphdGlvbkRMUUFsYXJtJyxcbiAgICAgICAge1xuICAgICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnTWVzc2FnZXMgaW4gc3VtbWFyaXphdGlvbiBETFEnLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICB0aGlzLmluc2lnaHRzRExRLm1ldHJpY0FwcHJveGltYXRlTnVtYmVyT2ZNZXNzYWdlc1Zpc2libGUoKS5jcmVhdGVBbGFybShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ0luc2lnaHRzRExRQWxhcm0nLFxuICAgICAgICB7XG4gICAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdNZXNzYWdlcyBpbiBpbnNpZ2h0cyBETFEnLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBBbGFybTogUXVldWUgZGVwdGggaXMgaGlnaFxuICAgICAgdGhpcy5zdW1tYXJpemF0aW9uUXVldWUubWV0cmljQXBwcm94aW1hdGVOdW1iZXJPZk1lc3NhZ2VzVmlzaWJsZSgpLmNyZWF0ZUFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnU3VtbWFyaXphdGlvblF1ZXVlRGVwdGhBbGFybScsXG4gICAgICAgIHtcbiAgICAgICAgICB0aHJlc2hvbGQ6IDEwMDAsXG4gICAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDIsXG4gICAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0hpZ2ggbnVtYmVyIG9mIG1lc3NhZ2VzIGluIHN1bW1hcml6YXRpb24gcXVldWUnLFxuICAgICAgICB9XG4gICAgICApO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE91dHB1dHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdW1tYXJpemF0aW9uUXVldWVVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdW1tYXJpemF0aW9uUXVldWUucXVldWVVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1N1bW1hcml6YXRpb24gcXVldWUgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLXN1bW1hcml6YXRpb24tcXVldWUtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdW1tYXJpemF0aW9uUXVldWVBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zdW1tYXJpemF0aW9uUXVldWUucXVldWVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1N1bW1hcml6YXRpb24gcXVldWUgQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbnNpZ2h0c1F1ZXVlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuaW5zaWdodHNRdWV1ZS5xdWV1ZVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnSW5zaWdodHMgcXVldWUgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLWluc2lnaHRzLXF1ZXVlLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW5zaWdodHNRdWV1ZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmluc2lnaHRzUXVldWUucXVldWVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0luc2lnaHRzIHF1ZXVlIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRXZlbnRCdXNOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZXZlbnRCdXMuZXZlbnRCdXNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdFdmVudEJyaWRnZSBldmVudCBidXMgbmFtZScsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==