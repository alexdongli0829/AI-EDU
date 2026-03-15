/**
 * Application Load Balancer Stack
 *
 * Creates ALB for SSE streaming endpoints (Conversation Engine).
 * Call addTargetGroups() from app.ts after LambdaStack is created.
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface AlbStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  albSecurityGroup: ec2.SecurityGroup;
}

export class AlbStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly httpListener: elbv2.ApplicationListener;
  public readonly httpsListener?: elbv2.ApplicationListener;

  private readonly config: EnvironmentConfig;

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id, props);

    const { config, vpc, albSecurityGroup } = props;
    this.config = config;

    // ============================================================
    // Application Load Balancer
    // ============================================================

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
      loadBalancerName: `edulens-alb-${config.stage}`,
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      deletionProtection: config.stage === 'prod',
      http2Enabled: true,
      idleTimeout: cdk.Duration.seconds(300),
    });

    if (config.stage === 'prod') {
      new logs.LogGroup(this, 'AlbAccessLogs', {
        logGroupName: `/aws/alb/edulens-${config.stage}`,
        retention: config.logRetentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    }

    // ============================================================
    // HTTP Listener (Port 80)
    // ============================================================

    this.httpListener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({
          error: 'Not Found',
          message: 'The requested resource was not found',
        }),
      }),
    });

    // ============================================================
    // Outputs
    // ============================================================

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS name',
      exportName: `edulens-alb-dns-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'AlbArn', {
      value: this.alb.loadBalancerArn,
      description: 'ALB ARN',
    });

    new cdk.CfnOutput(this, 'AlbUrl', {
      value: `http://${this.alb.loadBalancerDnsName}`,
      description: 'ALB URL (HTTP)',
    });

    cdk.Tags.of(this.alb).add('Name', `edulens-alb-${config.stage}`);
  }

  // ============================================================
  // Wire SSE streaming Lambda targets (called from app.ts)
  // ============================================================

  addTargetGroups(
    parentChatSendStreamFunction: lambda.Function,
    studentChatSendStreamFunction: lambda.Function,
  ): void {
    const { config } = this;

    const parentStreamTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ParentStreamTargetGroup', {
      targetGroupName: `edulens-parent-stream-${config.stage}`,
      targetType: elbv2.TargetType.LAMBDA,
      targets: [new elbv2_targets.LambdaTarget(parentChatSendStreamFunction)],
      healthCheck: {
        enabled: false,
      },
    });

    const studentStreamTargetGroup = new elbv2.ApplicationTargetGroup(this, 'StudentStreamTargetGroup', {
      targetGroupName: `edulens-student-stream-${config.stage}`,
      targetType: elbv2.TargetType.LAMBDA,
      targets: [new elbv2_targets.LambdaTarget(studentChatSendStreamFunction)],
      healthCheck: {
        enabled: false,
      },
    });

    this.httpListener.addTargetGroups('ParentStreamRule', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/parent-chat/*/send']),
      ],
      targetGroups: [parentStreamTargetGroup],
    });

    this.httpListener.addTargetGroups('StudentStreamRule', {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/student-chat/*/send']),
      ],
      targetGroups: [studentStreamTargetGroup],
    });
  }
}
