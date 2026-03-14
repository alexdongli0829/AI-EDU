"use strict";
/**
 * Monitoring Stack
 *
 * Creates CloudWatch dashboards and alarms for monitoring the EduLens platform
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
exports.MonitoringStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
class MonitoringStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config, restApi, auroraCluster, summarizationQueue, insightsQueue, summarizationDLQ, insightsDLQ, lambdaFunctions, } = props;
        // ============================================================
        // CloudWatch Dashboard
        // ============================================================
        this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
            dashboardName: `edulens-${config.stage}`,
        });
        // ============================================================
        // API Gateway Metrics
        // ============================================================
        const apiRequestsMetric = restApi.metricCount({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        });
        const api4xxErrorsMetric = restApi.metricClientError({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        });
        const api5xxErrorsMetric = restApi.metricServerError({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        });
        const apiLatencyMetric = restApi.metricLatency({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'API Gateway Requests',
            left: [apiRequestsMetric],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'API Gateway Errors',
            left: [api4xxErrorsMetric, api5xxErrorsMetric],
            width: 12,
        }));
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'API Gateway Latency',
            left: [apiLatencyMetric],
            width: 24,
        }));
        // ============================================================
        // Lambda Metrics
        // ============================================================
        // Create a composite metric for all Lambda errors
        const lambdaErrorsWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Errors (All Functions)',
            width: 12,
            left: lambdaFunctions.slice(0, 10).map((fn) => fn.metricErrors({
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            })),
        });
        const lambdaDurationWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Duration (P95)',
            width: 12,
            left: lambdaFunctions.slice(0, 10).map((fn) => fn.metricDuration({
                period: cdk.Duration.minutes(5),
                statistic: 'p95',
            })),
        });
        this.dashboard.addWidgets(lambdaErrorsWidget, lambdaDurationWidget);
        const lambdaInvocationsWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Invocations',
            width: 12,
            left: lambdaFunctions.slice(0, 10).map((fn) => fn.metricInvocations({
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            })),
        });
        const lambdaThrottlesWidget = new cloudwatch.GraphWidget({
            title: 'Lambda Throttles',
            width: 12,
            left: lambdaFunctions.slice(0, 10).map((fn) => fn.metricThrottles({
                period: cdk.Duration.minutes(5),
                statistic: 'Sum',
            })),
        });
        this.dashboard.addWidgets(lambdaInvocationsWidget, lambdaThrottlesWidget);
        // ============================================================
        // SQS Metrics
        // ============================================================
        const summarizationQueueDepth = summarizationQueue.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });
        const insightsQueueDepth = insightsQueue.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });
        const summarizationDLQDepth = summarizationDLQ.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });
        const insightsDLQDepth = insightsDLQ.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'SQS Queue Depth',
            left: [summarizationQueueDepth, insightsQueueDepth],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'DLQ Depth (Should be 0)',
            left: [summarizationDLQDepth, insightsDLQDepth],
            width: 12,
        }));
        // ============================================================
        // RDS Metrics
        // ============================================================
        const dbCpuMetric = auroraCluster.metricCPUUtilization({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });
        const dbConnectionsMetric = auroraCluster.metricDatabaseConnections({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
        });
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'RDS CPU Utilization',
            left: [dbCpuMetric],
            width: 12,
        }), new cloudwatch.GraphWidget({
            title: 'RDS Connections',
            left: [dbConnectionsMetric],
            width: 12,
        }));
        // ============================================================
        // Alarms (Production Only)
        // ============================================================
        if (config.stage === 'prod') {
            // API Gateway 5xx error rate alarm
            const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
                metric: api5xxErrorsMetric,
                threshold: 10,
                evaluationPeriods: 2,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                alarmDescription: 'High number of API Gateway 5xx errors',
                alarmName: `edulens-api-5xx-${config.stage}`,
            });
            // Lambda error rate alarm (for critical functions)
            lambdaFunctions.slice(0, 5).forEach((fn, index) => {
                new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
                    metric: fn.metricErrors({
                        period: cdk.Duration.minutes(5),
                        statistic: 'Sum',
                    }),
                    threshold: 5,
                    evaluationPeriods: 2,
                    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                    alarmDescription: `High error rate for ${fn.functionName}`,
                    alarmName: `edulens-lambda-errors-${fn.functionName}`,
                });
            });
            // DLQ depth alarms (create individual alarms first)
            const summarizationDLQAlarm = new cloudwatch.Alarm(this, 'SummarizationDLQAlarm', {
                metric: summarizationDLQDepth,
                threshold: 1,
                evaluationPeriods: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                alarmDescription: 'Messages in summarization DLQ',
                alarmName: `edulens-summarization-dlq-${config.stage}`,
            });
            const insightsDLQAlarm = new cloudwatch.Alarm(this, 'InsightsDLQAlarm', {
                metric: insightsDLQDepth,
                threshold: 1,
                evaluationPeriods: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                alarmDescription: 'Messages in insights DLQ',
                alarmName: `edulens-insights-dlq-${config.stage}`,
            });
            // Composite alarm for any DLQ having messages
            new cloudwatch.CompositeAlarm(this, 'DLQCompositeAlarm', {
                compositeAlarmName: `edulens-dlq-composite-${config.stage}`,
                alarmDescription: 'Any DLQ has messages',
                alarmRule: cloudwatch.AlarmRule.anyOf(cloudwatch.AlarmRule.fromAlarm(summarizationDLQAlarm, cloudwatch.AlarmState.ALARM), cloudwatch.AlarmRule.fromAlarm(insightsDLQAlarm, cloudwatch.AlarmState.ALARM)),
            });
            // RDS CPU alarm
            new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
                metric: dbCpuMetric,
                threshold: 80,
                evaluationPeriods: 3,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                alarmDescription: 'High RDS CPU utilization',
                alarmName: `edulens-rds-cpu-${config.stage}`,
            });
            // RDS connections alarm
            new cloudwatch.Alarm(this, 'RdsConnectionsAlarm', {
                metric: dbConnectionsMetric,
                threshold: 80,
                evaluationPeriods: 2,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                alarmDescription: 'High number of RDS connections',
                alarmName: `edulens-rds-connections-${config.stage}`,
            });
        }
        // ============================================================
        // Outputs
        // ============================================================
        new cdk.CfnOutput(this, 'DashboardUrl', {
            value: `https://console.aws.amazon.com/cloudwatch/home?region=${cdk.Aws.REGION}#dashboards:name=${this.dashboard.dashboardName}`,
            description: 'CloudWatch Dashboard URL',
        });
        new cdk.CfnOutput(this, 'DashboardName', {
            value: this.dashboard.dashboardName,
            description: 'CloudWatch Dashboard Name',
        });
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx1RUFBeUQ7QUFtQnpELE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUc1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFDSixNQUFNLEVBQ04sT0FBTyxFQUNQLGFBQWEsRUFDYixrQkFBa0IsRUFDbEIsYUFBYSxFQUNiLGdCQUFnQixFQUNoQixXQUFXLEVBQ1gsZUFBZSxHQUNoQixHQUFHLEtBQUssQ0FBQztRQUVWLCtEQUErRDtRQUMvRCx1QkFBdUI7UUFDdkIsK0RBQStEO1FBRS9ELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDM0QsYUFBYSxFQUFFLFdBQVcsTUFBTSxDQUFDLEtBQUssRUFBRTtTQUN6QyxDQUFDLENBQUM7UUFFSCwrREFBK0Q7UUFDL0Qsc0JBQXNCO1FBQ3RCLCtEQUErRDtRQUUvRCxNQUFNLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDNUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUMvQixTQUFTLEVBQUUsS0FBSztTQUNqQixDQUFDLENBQUM7UUFFSCxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztZQUNuRCxNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQy9CLFNBQVMsRUFBRSxLQUFLO1NBQ2pC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QkFBMkI7U0FDekMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBelJELDBDQXlSQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTW9uaXRvcmluZyBTdGFja1xuICpcbiAqIENyZWF0ZXMgQ2xvdWRXYXRjaCBkYXNoYm9hcmRzIGFuZCBhbGFybXMgZm9yIG1vbml0b3JpbmcgdGhlIEVkdUxlbnMgcGxhdGZvcm1cbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIHJkcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtcmRzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvZW52aXJvbm1lbnRzJztcblxuZXhwb3J0IGludGVyZmFjZSBNb25pdG9yaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgcmVzdEFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBhdXJvcmFDbHVzdGVyOiByZHMuRGF0YWJhc2VDbHVzdGVyO1xuICBzdW1tYXJpemF0aW9uUXVldWU6IHNxcy5RdWV1ZTtcbiAgaW5zaWdodHNRdWV1ZTogc3FzLlF1ZXVlO1xuICBzdW1tYXJpemF0aW9uRExROiBzcXMuUXVldWU7XG4gIGluc2lnaHRzRExROiBzcXMuUXVldWU7XG4gIGxhbWJkYUZ1bmN0aW9uczogbGFtYmRhLkZ1bmN0aW9uW107XG59XG5cbmV4cG9ydCBjbGFzcyBNb25pdG9yaW5nU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkOiBjbG91ZHdhdGNoLkRhc2hib2FyZDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIHJlc3RBcGksXG4gICAgICBhdXJvcmFDbHVzdGVyLFxuICAgICAgc3VtbWFyaXphdGlvblF1ZXVlLFxuICAgICAgaW5zaWdodHNRdWV1ZSxcbiAgICAgIHN1bW1hcml6YXRpb25ETFEsXG4gICAgICBpbnNpZ2h0c0RMUSxcbiAgICAgIGxhbWJkYUZ1bmN0aW9ucyxcbiAgICB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDbG91ZFdhdGNoIERhc2hib2FyZFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdGhpcy5kYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ0Rhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGBlZHVsZW5zLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBUEkgR2F0ZXdheSBNZXRyaWNzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCBhcGlSZXF1ZXN0c01ldHJpYyA9IHJlc3RBcGkubWV0cmljQ291bnQoe1xuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGk0eHhFcnJvcnNNZXRyaWMgPSByZXN0QXBpLm1ldHJpY0NsaWVudEVycm9yKHtcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBpNXh4RXJyb3JzTWV0cmljID0gcmVzdEFwaS5tZXRyaWNTZXJ2ZXJFcnJvcih7XG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaUxhdGVuY3lNZXRyaWMgPSByZXN0QXBpLm1ldHJpY0xhdGVuY3koe1xuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSBSZXF1ZXN0cycsXG4gICAgICAgIGxlZnQ6IFthcGlSZXF1ZXN0c01ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IEVycm9ycycsXG4gICAgICAgIGxlZnQ6IFthcGk0eHhFcnJvcnNNZXRyaWMsIGFwaTV4eEVycm9yc01ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgTGF0ZW5jeScsXG4gICAgICAgIGxlZnQ6IFthcGlMYXRlbmN5TWV0cmljXSxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gTGFtYmRhIE1ldHJpY3NcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIENyZWF0ZSBhIGNvbXBvc2l0ZSBtZXRyaWMgZm9yIGFsbCBMYW1iZGEgZXJyb3JzXG4gICAgY29uc3QgbGFtYmRhRXJyb3JzV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdMYW1iZGEgRXJyb3JzIChBbGwgRnVuY3Rpb25zKScsXG4gICAgICB3aWR0aDogMTIsXG4gICAgICBsZWZ0OiBsYW1iZGFGdW5jdGlvbnMuc2xpY2UoMCwgMTApLm1hcCgoZm4pID0+XG4gICAgICAgIGZuLm1ldHJpY0Vycm9ycyh7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgICB9KVxuICAgICAgKSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGxhbWJkYUR1cmF0aW9uV2lkZ2V0ID0gbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgdGl0bGU6ICdMYW1iZGEgRHVyYXRpb24gKFA5NSknLFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgbGVmdDogbGFtYmRhRnVuY3Rpb25zLnNsaWNlKDAsIDEwKS5tYXAoKGZuKSA9PlxuICAgICAgICBmbi5tZXRyaWNEdXJhdGlvbih7XG4gICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICBzdGF0aXN0aWM6ICdwOTUnLFxuICAgICAgICB9KVxuICAgICAgKSxcbiAgICB9KTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMobGFtYmRhRXJyb3JzV2lkZ2V0LCBsYW1iZGFEdXJhdGlvbldpZGdldCk7XG5cbiAgICBjb25zdCBsYW1iZGFJbnZvY2F0aW9uc1dpZGdldCA9IG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgIHRpdGxlOiAnTGFtYmRhIEludm9jYXRpb25zJyxcbiAgICAgIHdpZHRoOiAxMixcbiAgICAgIGxlZnQ6IGxhbWJkYUZ1bmN0aW9ucy5zbGljZSgwLCAxMCkubWFwKChmbikgPT5cbiAgICAgICAgZm4ubWV0cmljSW52b2NhdGlvbnMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSlcbiAgICAgICksXG4gICAgfSk7XG5cbiAgICBjb25zdCBsYW1iZGFUaHJvdHRsZXNXaWRnZXQgPSBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICB0aXRsZTogJ0xhbWJkYSBUaHJvdHRsZXMnLFxuICAgICAgd2lkdGg6IDEyLFxuICAgICAgbGVmdDogbGFtYmRhRnVuY3Rpb25zLnNsaWNlKDAsIDEwKS5tYXAoKGZuKSA9PlxuICAgICAgICBmbi5tZXRyaWNUaHJvdHRsZXMoe1xuICAgICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgICAgfSlcbiAgICAgICksXG4gICAgfSk7XG5cbiAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKGxhbWJkYUludm9jYXRpb25zV2lkZ2V0LCBsYW1iZGFUaHJvdHRsZXNXaWRnZXQpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU1FTIE1ldHJpY3NcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IHN1bW1hcml6YXRpb25RdWV1ZURlcHRoID0gc3VtbWFyaXphdGlvblF1ZXVlLm1ldHJpY0FwcHJveGltYXRlTnVtYmVyT2ZNZXNzYWdlc1Zpc2libGUoe1xuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaW5zaWdodHNRdWV1ZURlcHRoID0gaW5zaWdodHNRdWV1ZS5tZXRyaWNBcHByb3hpbWF0ZU51bWJlck9mTWVzc2FnZXNWaXNpYmxlKHtcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICB9KTtcblxuICAgIGNvbnN0IHN1bW1hcml6YXRpb25ETFFEZXB0aCA9IHN1bW1hcml6YXRpb25ETFEubWV0cmljQXBwcm94aW1hdGVOdW1iZXJPZk1lc3NhZ2VzVmlzaWJsZSh7XG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBpbnNpZ2h0c0RMUURlcHRoID0gaW5zaWdodHNETFEubWV0cmljQXBwcm94aW1hdGVOdW1iZXJPZk1lc3NhZ2VzVmlzaWJsZSh7XG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgfSk7XG5cbiAgICB0aGlzLmRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1NRUyBRdWV1ZSBEZXB0aCcsXG4gICAgICAgIGxlZnQ6IFtzdW1tYXJpemF0aW9uUXVldWVEZXB0aCwgaW5zaWdodHNRdWV1ZURlcHRoXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnRExRIERlcHRoIChTaG91bGQgYmUgMCknLFxuICAgICAgICBsZWZ0OiBbc3VtbWFyaXphdGlvbkRMUURlcHRoLCBpbnNpZ2h0c0RMUURlcHRoXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUkRTIE1ldHJpY3NcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGRiQ3B1TWV0cmljID0gYXVyb3JhQ2x1c3Rlci5tZXRyaWNDUFVVdGlsaXphdGlvbih7XG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkYkNvbm5lY3Rpb25zTWV0cmljID0gYXVyb3JhQ2x1c3Rlci5tZXRyaWNEYXRhYmFzZUNvbm5lY3Rpb25zKHtcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICB9KTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnUkRTIENQVSBVdGlsaXphdGlvbicsXG4gICAgICAgIGxlZnQ6IFtkYkNwdU1ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgIH0pLFxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ1JEUyBDb25uZWN0aW9ucycsXG4gICAgICAgIGxlZnQ6IFtkYkNvbm5lY3Rpb25zTWV0cmljXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQWxhcm1zIChQcm9kdWN0aW9uIE9ubHkpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBpZiAoY29uZmlnLnN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgIC8vIEFQSSBHYXRld2F5IDV4eCBlcnJvciByYXRlIGFsYXJtXG4gICAgICBjb25zdCBhcGk1eHhBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdBcGk1eHhBbGFybScsIHtcbiAgICAgICAgbWV0cmljOiBhcGk1eHhFcnJvcnNNZXRyaWMsXG4gICAgICAgIHRocmVzaG9sZDogMTAsXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdIaWdoIG51bWJlciBvZiBBUEkgR2F0ZXdheSA1eHggZXJyb3JzJyxcbiAgICAgICAgYWxhcm1OYW1lOiBgZWR1bGVucy1hcGktNXh4LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgLy8gTGFtYmRhIGVycm9yIHJhdGUgYWxhcm0gKGZvciBjcml0aWNhbCBmdW5jdGlvbnMpXG4gICAgICBsYW1iZGFGdW5jdGlvbnMuc2xpY2UoMCwgNSkuZm9yRWFjaCgoZm4sIGluZGV4KSA9PiB7XG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsIGBMYW1iZGFFcnJvckFsYXJtJHtpbmRleH1gLCB7XG4gICAgICAgICAgbWV0cmljOiBmbi5tZXRyaWNFcnJvcnMoe1xuICAgICAgICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogJ1N1bScsXG4gICAgICAgICAgfSksXG4gICAgICAgICAgdGhyZXNob2xkOiA1LFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBgSGlnaCBlcnJvciByYXRlIGZvciAke2ZuLmZ1bmN0aW9uTmFtZX1gLFxuICAgICAgICAgIGFsYXJtTmFtZTogYGVkdWxlbnMtbGFtYmRhLWVycm9ycy0ke2ZuLmZ1bmN0aW9uTmFtZX1gLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBETFEgZGVwdGggYWxhcm1zIChjcmVhdGUgaW5kaXZpZHVhbCBhbGFybXMgZmlyc3QpXG4gICAgICBjb25zdCBzdW1tYXJpemF0aW9uRExRQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnU3VtbWFyaXphdGlvbkRMUUFsYXJtJywge1xuICAgICAgICBtZXRyaWM6IHN1bW1hcml6YXRpb25ETFFEZXB0aCxcbiAgICAgICAgdGhyZXNob2xkOiAxLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnTWVzc2FnZXMgaW4gc3VtbWFyaXphdGlvbiBETFEnLFxuICAgICAgICBhbGFybU5hbWU6IGBlZHVsZW5zLXN1bW1hcml6YXRpb24tZGxxLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgaW5zaWdodHNETFFBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdJbnNpZ2h0c0RMUUFsYXJtJywge1xuICAgICAgICBtZXRyaWM6IGluc2lnaHRzRExRRGVwdGgsXG4gICAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ01lc3NhZ2VzIGluIGluc2lnaHRzIERMUScsXG4gICAgICAgIGFsYXJtTmFtZTogYGVkdWxlbnMtaW5zaWdodHMtZGxxLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ29tcG9zaXRlIGFsYXJtIGZvciBhbnkgRExRIGhhdmluZyBtZXNzYWdlc1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guQ29tcG9zaXRlQWxhcm0odGhpcywgJ0RMUUNvbXBvc2l0ZUFsYXJtJywge1xuICAgICAgICBjb21wb3NpdGVBbGFybU5hbWU6IGBlZHVsZW5zLWRscS1jb21wb3NpdGUtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FueSBETFEgaGFzIG1lc3NhZ2VzJyxcbiAgICAgICAgYWxhcm1SdWxlOiBjbG91ZHdhdGNoLkFsYXJtUnVsZS5hbnlPZihcbiAgICAgICAgICBjbG91ZHdhdGNoLkFsYXJtUnVsZS5mcm9tQWxhcm0oc3VtbWFyaXphdGlvbkRMUUFsYXJtLCBjbG91ZHdhdGNoLkFsYXJtU3RhdGUuQUxBUk0pLFxuICAgICAgICAgIGNsb3Vkd2F0Y2guQWxhcm1SdWxlLmZyb21BbGFybShpbnNpZ2h0c0RMUUFsYXJtLCBjbG91ZHdhdGNoLkFsYXJtU3RhdGUuQUxBUk0pXG4gICAgICAgICksXG4gICAgICB9KTtcblxuICAgICAgLy8gUkRTIENQVSBhbGFybVxuICAgICAgbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgJ1Jkc0NwdUFsYXJtJywge1xuICAgICAgICBtZXRyaWM6IGRiQ3B1TWV0cmljLFxuICAgICAgICB0aHJlc2hvbGQ6IDgwLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCBSRFMgQ1BVIHV0aWxpemF0aW9uJyxcbiAgICAgICAgYWxhcm1OYW1lOiBgZWR1bGVucy1yZHMtY3B1LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB9KTtcblxuICAgICAgLy8gUkRTIGNvbm5lY3Rpb25zIGFsYXJtXG4gICAgICBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnUmRzQ29ubmVjdGlvbnNBbGFybScsIHtcbiAgICAgICAgbWV0cmljOiBkYkNvbm5lY3Rpb25zTWV0cmljLFxuICAgICAgICB0aHJlc2hvbGQ6IDgwLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiAnSGlnaCBudW1iZXIgb2YgUkRTIGNvbm5lY3Rpb25zJyxcbiAgICAgICAgYWxhcm1OYW1lOiBgZWR1bGVucy1yZHMtY29ubmVjdGlvbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE91dHB1dHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7Y2RrLkF3cy5SRUdJT059I2Rhc2hib2FyZHM6bmFtZT0ke3RoaXMuZGFzaGJvYXJkLmRhc2hib2FyZE5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGFzaGJvYXJkLmRhc2hib2FyZE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIE5hbWUnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=