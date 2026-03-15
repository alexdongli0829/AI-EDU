"use strict";
/**
 * Jobs Stack
 *
 * Creates SQS queues and EventBridge rules for async job processing.
 * EventBridge targets are wired in app.ts after LambdaStack is created,
 * using constructed ARNs to avoid cyclic CloudFormation dependencies.
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
        this.eventBus = events.EventBus.fromEventBusName(this, 'DefaultEventBus', 'default');
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
        chatEndedRule.addTarget(new events_targets.SqsQueue(this.summarizationQueue, {
            message: events.RuleTargetInput.fromEventPath('$.detail'),
        }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiam9icy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImpvYnMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQywrREFBaUQ7QUFDakQsK0VBQWlFO0FBU2pFLE1BQWEsU0FBVSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBV3RDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBcUI7UUFDN0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV6QiwrREFBK0Q7UUFDL0QscUJBQXFCO1FBQ3JCLCtEQUErRDtRQUUvRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUM5RCxTQUFTLEVBQUUsNkJBQTZCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDdEQsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3BELFNBQVMsRUFBRSx3QkFBd0IsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUNqRCxlQUFlLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1NBQ3ZDLENBQUMsQ0FBQztRQUVILCtEQUErRDtRQUMvRCxhQUFhO1FBQ2IsK0RBQStEO1FBRS9ELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ2xFLFNBQVMsRUFBRSwrQkFBK0IsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUN4RCxpQkFBaUIsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDMUMsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNyQyxzQkFBc0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDaEQsZUFBZSxFQUFFO2dCQUNmLEtBQUssRUFBRSxJQUFJLENBQUMsZ0JBQWdCO2dCQUM1QixlQUFlLEVBQUUsQ0FBQzthQUNuQjtZQUNELFVBQVUsRUFBRSxNQUFNLENBQUMsS0FBSyxLQUFLLE1BQU07Z0JBQ2pDLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLFdBQVc7Z0JBQ2pDLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLFdBQVc7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN4RCxTQUFTLEVBQUUsMEJBQTBCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDbkQsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzNDLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDckMsc0JBQXNCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2hELGVBQWUsRUFBRTtnQkFDZixLQUFLLEVBQUUsSUFBSSxDQUFDLFdBQVc7Z0JBQ3ZCLGVBQWUsRUFBRSxDQUFDO2FBQ25CO1lBQ0QsVUFBVSxFQUFFLE1BQU0sQ0FBQyxLQUFLLEtBQUssTUFBTTtnQkFDakMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsV0FBVztnQkFDakMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsV0FBVztTQUNwQyxDQUFDLENBQUM7UUFFSCwrREFBK0Q7UUFDL0Qsd0JBQXdCO1FBQ3hCLCtEQUErRDtRQUUvRCxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQzlDLElBQUksRUFDSixpQkFBaUIsRUFDakIsU0FBUyxDQUNWLENBQUM7UUFFRiwrREFBK0Q7UUFDL0Qsb0JBQW9CO1FBQ3BCLCtEQUErRDtRQUUvRCx5RkFBeUY7UUFDekYsTUFBTSxhQUFhLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUNsRSxRQUFRLEVBQUUsc0JBQXNCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDOUMsV0FBVyxFQUFFLDhDQUE4QztZQUMzRCxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsWUFBWSxFQUFFO2dCQUNaLE1BQU0sRUFBRSxDQUFDLDZCQUE2QixDQUFDO2dCQUN2QyxVQUFVLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQzthQUNuQztTQUNGLENBQUMsQ0FBQztRQUVILGFBQWEsQ0FBQyxTQUFTLENBQ3JCLElBQUksY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7WUFDbkQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQztTQUMxRCxDQUFDLENBQ0gsQ0FBQztRQUVGLHdFQUF3RTtRQUN4RSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUNsRSxRQUFRLEVBQUUsMEJBQTBCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDbEQsV0FBVyxFQUFFLGlEQUFpRDtZQUM5RCxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsWUFBWSxFQUFFO2dCQUNaLE1BQU0sRUFBRSxDQUFDLHFCQUFxQixDQUFDO2dCQUMvQixVQUFVLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQzthQUMvQjtTQUNGLENBQUMsQ0FBQztRQUVILHVFQUF1RTtRQUN2RSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUN0RSxRQUFRLEVBQUUsNEJBQTRCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDcEQsV0FBVyxFQUFFLG1EQUFtRDtZQUNoRSxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDdEQsQ0FBQyxDQUFDO1FBRUgsNkRBQTZEO1FBQzdELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ2xFLFFBQVEsRUFBRSwwQkFBMEIsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUNsRCxXQUFXLEVBQUUsOERBQThEO1lBQzNFLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDN0IsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEdBQUc7Z0JBQ1QsR0FBRyxFQUFFLEdBQUc7Z0JBQ1IsS0FBSyxFQUFFLEdBQUc7Z0JBQ1YsSUFBSSxFQUFFLEdBQUc7YUFDVixDQUFDO1NBQ0gsQ0FBQyxDQUFDO1FBRUgsK0RBQStEO1FBQy9ELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDMUQsUUFBUSxFQUFFLHNCQUFzQixNQUFNLENBQUMsS0FBSyxFQUFFO1lBQzlDLFdBQVcsRUFBRSxzQ0FBc0M7WUFDbkQsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ3hELENBQUMsQ0FBQztRQUVILCtEQUErRDtRQUMvRCxpQ0FBaUM7UUFDakMsK0RBQStEO1FBRS9ELElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUM1QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsd0NBQXdDLEVBQUUsQ0FBQyxXQUFXLENBQzFFLElBQUksRUFDSix1QkFBdUIsRUFDdkI7Z0JBQ0UsU0FBUyxFQUFFLENBQUM7Z0JBQ1osaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsZ0JBQWdCLEVBQUUsK0JBQStCO2FBQ2xELENBQ0YsQ0FBQztZQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsd0NBQXdDLEVBQUUsQ0FBQyxXQUFXLENBQ3JFLElBQUksRUFDSixrQkFBa0IsRUFDbEI7Z0JBQ0UsU0FBUyxFQUFFLENBQUM7Z0JBQ1osaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEIsZ0JBQWdCLEVBQUUsMEJBQTBCO2FBQzdDLENBQ0YsQ0FBQztZQUVGLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyx3Q0FBd0MsRUFBRSxDQUFDLFdBQVcsQ0FDNUUsSUFBSSxFQUNKLDhCQUE4QixFQUM5QjtnQkFDRSxTQUFTLEVBQUUsSUFBSTtnQkFDZixpQkFBaUIsRUFBRSxDQUFDO2dCQUNwQixnQkFBZ0IsRUFBRSxnREFBZ0Q7YUFDbkUsQ0FDRixDQUFDO1FBQ0osQ0FBQztRQUVELCtEQUErRDtRQUMvRCxVQUFVO1FBQ1YsK0RBQStEO1FBRS9ELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRO1lBQ3ZDLFdBQVcsRUFBRSx5QkFBeUI7WUFDdEMsVUFBVSxFQUFFLCtCQUErQixNQUFNLENBQUMsS0FBSyxFQUFFO1NBQzFELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDL0MsS0FBSyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRO1lBQ3ZDLFdBQVcsRUFBRSx5QkFBeUI7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRO1lBQ2xDLFdBQVcsRUFBRSxvQkFBb0I7WUFDakMsVUFBVSxFQUFFLDBCQUEwQixNQUFNLENBQUMsS0FBSyxFQUFFO1NBQ3JELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUTtZQUNsQyxXQUFXLEVBQUUsb0JBQW9CO1NBQ2xDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVk7WUFDakMsV0FBVyxFQUFFLDRCQUE0QjtTQUMxQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0TUQsOEJBc01DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBKb2JzIFN0YWNrXG4gKlxuICogQ3JlYXRlcyBTUVMgcXVldWVzIGFuZCBFdmVudEJyaWRnZSBydWxlcyBmb3IgYXN5bmMgam9iIHByb2Nlc3NpbmcuXG4gKiBFdmVudEJyaWRnZSB0YXJnZXRzIGFyZSB3aXJlZCBpbiBhcHAudHMgYWZ0ZXIgTGFtYmRhU3RhY2sgaXMgY3JlYXRlZCxcbiAqIHVzaW5nIGNvbnN0cnVjdGVkIEFSTnMgdG8gYXZvaWQgY3ljbGljIENsb3VkRm9ybWF0aW9uIGRlcGVuZGVuY2llcy5cbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgZXZlbnRzX3RhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvZW52aXJvbm1lbnRzJztcblxuZXhwb3J0IGludGVyZmFjZSBKb2JzU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbn1cblxuZXhwb3J0IGNsYXNzIEpvYnNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzdW1tYXJpemF0aW9uUXVldWU6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IHN1bW1hcml6YXRpb25ETFE6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IGluc2lnaHRzUXVldWU6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IGluc2lnaHRzRExROiBzcXMuUXVldWU7XG4gIHB1YmxpYyByZWFkb25seSBldmVudEJ1czogZXZlbnRzLklFdmVudEJ1cztcbiAgcHVibGljIHJlYWRvbmx5IHRlc3RDb21wbGV0ZWRSdWxlOiBldmVudHMuUnVsZTtcbiAgcHVibGljIHJlYWRvbmx5IHRpbWVyU3luY1J1bGU6IGV2ZW50cy5SdWxlO1xuICBwdWJsaWMgcmVhZG9ubHkgZGFpbHlJbnNpZ2h0c1J1bGU6IGV2ZW50cy5SdWxlO1xuICBwdWJsaWMgcmVhZG9ubHkgYmF0Y2hQcm9jZXNzaW5nUnVsZTogZXZlbnRzLlJ1bGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEpvYnNTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IGNvbmZpZyB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBEZWFkIExldHRlciBRdWV1ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMuc3VtbWFyaXphdGlvbkRMUSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1N1bW1hcml6YXRpb25ETFEnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGBlZHVsZW5zLXN1bW1hcml6YXRpb24tZGxxLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICB9KTtcblxuICAgIHRoaXMuaW5zaWdodHNETFEgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdJbnNpZ2h0c0RMUScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYGVkdWxlbnMtaW5zaWdodHMtZGxxLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFNRUyBRdWV1ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMuc3VtbWFyaXphdGlvblF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnU3VtbWFyaXphdGlvblF1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiBgZWR1bGVucy1zdW1tYXJpemF0aW9uLXF1ZXVlLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDQpLFxuICAgICAgcmVjZWl2ZU1lc3NhZ2VXYWl0VGltZTogY2RrLkR1cmF0aW9uLnNlY29uZHMoMjApLFxuICAgICAgZGVhZExldHRlclF1ZXVlOiB7XG4gICAgICAgIHF1ZXVlOiB0aGlzLnN1bW1hcml6YXRpb25ETFEsXG4gICAgICAgIG1heFJlY2VpdmVDb3VudDogMyxcbiAgICAgIH0sXG4gICAgICBlbmNyeXB0aW9uOiBjb25maWcuc3RhZ2UgPT09ICdwcm9kJ1xuICAgICAgICA/IHNxcy5RdWV1ZUVuY3J5cHRpb24uS01TX01BTkFHRURcbiAgICAgICAgOiBzcXMuUXVldWVFbmNyeXB0aW9uLlVORU5DUllQVEVELFxuICAgIH0pO1xuXG4gICAgdGhpcy5pbnNpZ2h0c1F1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnSW5zaWdodHNRdWV1ZScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYGVkdWxlbnMtaW5zaWdodHMtcXVldWUtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxMCksXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDQpLFxuICAgICAgcmVjZWl2ZU1lc3NhZ2VXYWl0VGltZTogY2RrLkR1cmF0aW9uLnNlY29uZHMoMjApLFxuICAgICAgZGVhZExldHRlclF1ZXVlOiB7XG4gICAgICAgIHF1ZXVlOiB0aGlzLmluc2lnaHRzRExRLFxuICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDIsXG4gICAgICB9LFxuICAgICAgZW5jcnlwdGlvbjogY29uZmlnLnN0YWdlID09PSAncHJvZCdcbiAgICAgICAgPyBzcXMuUXVldWVFbmNyeXB0aW9uLktNU19NQU5BR0VEXG4gICAgICAgIDogc3FzLlF1ZXVlRW5jcnlwdGlvbi5VTkVOQ1JZUFRFRCxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEV2ZW50QnJpZGdlIEV2ZW50IEJ1c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdGhpcy5ldmVudEJ1cyA9IGV2ZW50cy5FdmVudEJ1cy5mcm9tRXZlbnRCdXNOYW1lKFxuICAgICAgdGhpcyxcbiAgICAgICdEZWZhdWx0RXZlbnRCdXMnLFxuICAgICAgJ2RlZmF1bHQnXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGVzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBSdWxlIDE6IENoYXQgU2Vzc2lvbiBFbmRlZCDihpIgU3VtbWFyaXphdGlvbiBRdWV1ZSAodGFyZ2V0IHdpcmVkIGlubGluZSDigJQgbm8gTGFtYmRhIGRlcClcbiAgICBjb25zdCBjaGF0RW5kZWRSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdDaGF0U2Vzc2lvbkVuZGVkUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgZWR1bGVucy1jaGF0LWVuZGVkLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXIgc3VtbWFyaXphdGlvbiB3aGVuIGNoYXQgc2Vzc2lvbiBlbmRzJyxcbiAgICAgIGV2ZW50QnVzOiB0aGlzLmV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydlZHVsZW5zLmNvbnZlcnNhdGlvbi1lbmdpbmUnXSxcbiAgICAgICAgZGV0YWlsVHlwZTogWydjaGF0X3Nlc3Npb24uZW5kZWQnXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjaGF0RW5kZWRSdWxlLmFkZFRhcmdldChcbiAgICAgIG5ldyBldmVudHNfdGFyZ2V0cy5TcXNRdWV1ZSh0aGlzLnN1bW1hcml6YXRpb25RdWV1ZSwge1xuICAgICAgICBtZXNzYWdlOiBldmVudHMuUnVsZVRhcmdldElucHV0LmZyb21FdmVudFBhdGgoJyQuZGV0YWlsJyksXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBSdWxlIDI6IFRlc3QgQ29tcGxldGVkIOKGkiBQcm9maWxlIENhbGN1bGF0aW9uICh0YXJnZXQgd2lyZWQgaW4gYXBwLnRzKVxuICAgIHRoaXMudGVzdENvbXBsZXRlZFJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1Rlc3RDb21wbGV0ZWRSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBlZHVsZW5zLXRlc3QtY29tcGxldGVkLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1RyaWdnZXIgcHJvZmlsZSBjYWxjdWxhdGlvbiB3aGVuIHRlc3QgY29tcGxldGVzJyxcbiAgICAgIGV2ZW50QnVzOiB0aGlzLmV2ZW50QnVzLFxuICAgICAgZXZlbnRQYXR0ZXJuOiB7XG4gICAgICAgIHNvdXJjZTogWydlZHVsZW5zLnRlc3QtZW5naW5lJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsndGVzdC5jb21wbGV0ZWQnXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBSdWxlIDM6IFNjaGVkdWxlZCBCYXRjaCBQcm9jZXNzaW5nIChIb3VybHkpIOKAlCB0YXJnZXQgd2lyZWQgaW4gYXBwLnRzXG4gICAgdGhpcy5iYXRjaFByb2Nlc3NpbmdSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdCYXRjaFByb2Nlc3NpbmdSdWxlJywge1xuICAgICAgcnVsZU5hbWU6IGBlZHVsZW5zLWJhdGNoLXByb2Nlc3NpbmctJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnSG91cmx5IGJhdGNoIHByb2Nlc3NpbmcgZm9yIHVuc3VtbWFyaXplZCBzZXNzaW9ucycsXG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLnJhdGUoY2RrLkR1cmF0aW9uLmhvdXJzKDEpKSxcbiAgICB9KTtcblxuICAgIC8vIFJ1bGUgNDogRGFpbHkgSW5zaWdodHMgR2VuZXJhdGlvbiAodGFyZ2V0IHdpcmVkIGluIGFwcC50cylcbiAgICB0aGlzLmRhaWx5SW5zaWdodHNSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdEYWlseUluc2lnaHRzUnVsZScsIHtcbiAgICAgIHJ1bGVOYW1lOiBgZWR1bGVucy1kYWlseS1pbnNpZ2h0cy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdEYWlseSBBSSBpbnNpZ2h0cyBnZW5lcmF0aW9uIGZvciBhbGwgc3R1ZGVudHMgKG1pZG5pZ2h0IFVUQyknLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHtcbiAgICAgICAgbWludXRlOiAnMCcsXG4gICAgICAgIGhvdXI6ICcwJyxcbiAgICAgICAgZGF5OiAnKicsXG4gICAgICAgIG1vbnRoOiAnKicsXG4gICAgICAgIHllYXI6ICcqJyxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gUnVsZSA1OiBUaW1lciBTeW5jIChFdmVyeSAxIG1pbnV0ZSkg4oCUIHRhcmdldCB3aXJlZCBpbiBhcHAudHNcbiAgICB0aGlzLnRpbWVyU3luY1J1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1RpbWVyU3luY1J1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYGVkdWxlbnMtdGltZXItc3luYy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdUaW1lciBzeW5jIGJyb2FkY2FzdHMgZXZlcnkgMSBtaW51dGUnLFxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKGNkay5EdXJhdGlvbi5taW51dGVzKDEpKSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENsb3VkV2F0Y2ggQWxhcm1zIChQcm9kdWN0aW9uKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgaWYgKGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgICB0aGlzLnN1bW1hcml6YXRpb25ETFEubWV0cmljQXBwcm94aW1hdGVOdW1iZXJPZk1lc3NhZ2VzVmlzaWJsZSgpLmNyZWF0ZUFsYXJtKFxuICAgICAgICB0aGlzLFxuICAgICAgICAnU3VtbWFyaXphdGlvbkRMUUFsYXJtJyxcbiAgICAgICAge1xuICAgICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnTWVzc2FnZXMgaW4gc3VtbWFyaXphdGlvbiBETFEnLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICB0aGlzLmluc2lnaHRzRExRLm1ldHJpY0FwcHJveGltYXRlTnVtYmVyT2ZNZXNzYWdlc1Zpc2libGUoKS5jcmVhdGVBbGFybShcbiAgICAgICAgdGhpcyxcbiAgICAgICAgJ0luc2lnaHRzRExRQWxhcm0nLFxuICAgICAgICB7XG4gICAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdNZXNzYWdlcyBpbiBpbnNpZ2h0cyBETFEnLFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICB0aGlzLnN1bW1hcml6YXRpb25RdWV1ZS5tZXRyaWNBcHByb3hpbWF0ZU51bWJlck9mTWVzc2FnZXNWaXNpYmxlKCkuY3JlYXRlQWxhcm0oXG4gICAgICAgIHRoaXMsXG4gICAgICAgICdTdW1tYXJpemF0aW9uUXVldWVEZXB0aEFsYXJtJyxcbiAgICAgICAge1xuICAgICAgICAgIHRocmVzaG9sZDogMTAwMCxcbiAgICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCBudW1iZXIgb2YgbWVzc2FnZXMgaW4gc3VtbWFyaXphdGlvbiBxdWV1ZScsXG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N1bW1hcml6YXRpb25RdWV1ZVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN1bW1hcml6YXRpb25RdWV1ZS5xdWV1ZVVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3VtbWFyaXphdGlvbiBxdWV1ZSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYGVkdWxlbnMtc3VtbWFyaXphdGlvbi1xdWV1ZS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N1bW1hcml6YXRpb25RdWV1ZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnN1bW1hcml6YXRpb25RdWV1ZS5xdWV1ZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3VtbWFyaXphdGlvbiBxdWV1ZSBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0luc2lnaHRzUXVldWVVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5pbnNpZ2h0c1F1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdJbnNpZ2h0cyBxdWV1ZSBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYGVkdWxlbnMtaW5zaWdodHMtcXVldWUtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbnNpZ2h0c1F1ZXVlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuaW5zaWdodHNRdWV1ZS5xdWV1ZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnSW5zaWdodHMgcXVldWUgQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFdmVudEJ1c05hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5ldmVudEJ1cy5ldmVudEJ1c05hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0V2ZW50QnJpZGdlIGV2ZW50IGJ1cyBuYW1lJyxcbiAgICB9KTtcbiAgfVxufVxuIl19