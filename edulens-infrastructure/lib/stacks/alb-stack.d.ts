/**
 * Application Load Balancer Stack
 *
 * Creates ALB for SSE streaming endpoints (Conversation Engine).
 * Call addTargetGroups() from app.ts after LambdaStack is created.
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
export interface AlbStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
    vpc: ec2.Vpc;
    albSecurityGroup: ec2.SecurityGroup;
}
export declare class AlbStack extends cdk.Stack {
    readonly alb: elbv2.ApplicationLoadBalancer;
    readonly httpListener: elbv2.ApplicationListener;
    readonly httpsListener?: elbv2.ApplicationListener;
    private readonly config;
    constructor(scope: Construct, id: string, props: AlbStackProps);
    addTargetGroups(parentChatSendStreamFunction: lambda.Function, studentChatSendStreamFunction: lambda.Function): void;
}
