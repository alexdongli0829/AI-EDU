/**
 * Monitoring Stack
 *
 * Creates CloudWatch dashboards and alarms for monitoring the EduLens platform
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface MonitoringStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  restApi: apigateway.RestApi;
  auroraCluster: rds.DatabaseCluster;
  summarizationQueue: sqs.Queue;
  insightsQueue: sqs.Queue;
  summarizationDLQ: sqs.Queue;
  insightsDLQ: sqs.Queue;
  lambdaFunctions: lambda.Function[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const {
      config,
      restApi,
      auroraCluster,
      summarizationQueue,
      insightsQueue,
      summarizationDLQ,
      insightsDLQ,
      lambdaFunctions,
    } = props;

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

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [apiRequestsMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [api4xxErrorsMetric, api5xxErrorsMetric],
        width: 12,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency',
        left: [apiLatencyMetric],
        width: 24,
      })
    );

    // ============================================================
    // Lambda Metrics
    // ============================================================

    // Create a composite metric for all Lambda errors
    const lambdaErrorsWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Errors (All Functions)',
      width: 12,
      left: lambdaFunctions.slice(0, 10).map((fn) =>
        fn.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        })
      ),
    });

    const lambdaDurationWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Duration (P95)',
      width: 12,
      left: lambdaFunctions.slice(0, 10).map((fn) =>
        fn.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'p95',
        })
      ),
    });

    this.dashboard.addWidgets(lambdaErrorsWidget, lambdaDurationWidget);

    const lambdaInvocationsWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Invocations',
      width: 12,
      left: lambdaFunctions.slice(0, 10).map((fn) =>
        fn.metricInvocations({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        })
      ),
    });

    const lambdaThrottlesWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Throttles',
      width: 12,
      left: lambdaFunctions.slice(0, 10).map((fn) =>
        fn.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        })
      ),
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

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'SQS Queue Depth',
        left: [summarizationQueueDepth, insightsQueueDepth],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'DLQ Depth (Should be 0)',
        left: [summarizationDLQDepth, insightsDLQDepth],
        width: 12,
      })
    );

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

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS CPU Utilization',
        left: [dbCpuMetric],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'RDS Connections',
        left: [dbConnectionsMetric],
        width: 12,
      })
    );

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
        alarmRule: cloudwatch.AlarmRule.anyOf(
          cloudwatch.AlarmRule.fromAlarm(summarizationDLQAlarm, cloudwatch.AlarmState.ALARM),
          cloudwatch.AlarmRule.fromAlarm(insightsDLQAlarm, cloudwatch.AlarmState.ALARM)
        ),
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
