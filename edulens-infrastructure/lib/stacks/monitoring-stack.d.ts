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
export declare class MonitoringStack extends cdk.Stack {
    readonly dashboard: cloudwatch.Dashboard;
    constructor(scope: Construct, id: string, props: MonitoringStackProps);
}
