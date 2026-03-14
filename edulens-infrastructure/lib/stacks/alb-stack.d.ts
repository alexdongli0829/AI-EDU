/**
 * Application Load Balancer Stack
 *
 * Creates ALB for SSE streaming endpoints (Conversation Engine)
 * API Gateway doesn't support long-lived connections well, so we use ALB
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
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
    constructor(scope: Construct, id: string, props: AlbStackProps);
}
