/**
 * Application Load Balancer Stack
 *
 * Creates ALB for SSE streaming endpoints (Conversation Engine)
 * API Gateway doesn't support long-lived connections well, so we use ALB
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
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

  constructor(scope: Construct, id: string, props: AlbStackProps) {
    super(scope, id, props);

    const { config, vpc, albSecurityGroup } = props;

    // ============================================================
    // Application Load Balancer
    // ============================================================

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc,
      internetFacing: true,
      loadBalancerName: `edulens-alb-${config.stage}`,
      securityGroup: albSecurityGroup,

      // Use public subnets
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },

      // Deletion protection (production only)
      deletionProtection: config.stage === 'prod',

      // Enable HTTP/2 (for SSE streaming)
      http2Enabled: true,

      // Idle timeout (important for SSE - default is 60s, increase for streaming)
      idleTimeout: cdk.Duration.seconds(300), // 5 minutes
    });

    // Access logs (production only)
    if (config.stage === 'prod') {
      const logGroup = new logs.LogGroup(this, 'AlbAccessLogs', {
        logGroupName: `/aws/alb/edulens-${config.stage}`,
        retention: config.logRetentionDays,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      // Note: ALB access logs typically go to S3, not CloudWatch
      // For production, you'd want to create an S3 bucket for ALB logs
    }

    // ============================================================
    // HTTP Listener (Port 80)
    // ============================================================

    this.httpListener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,

      // Default action: return 404
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({
          error: 'Not Found',
          message: 'The requested resource was not found',
        }),
      }),
    });

    // ============================================================
    // HTTPS Listener (Port 443) - Production only
    // ============================================================

    // For production, you would add an HTTPS listener with a certificate
    // This requires a domain name and ACM certificate
    //
    // if (config.stage === 'prod') {
    //   const certificate = acm.Certificate.fromCertificateArn(
    //     this,
    //     'Certificate',
    //     'arn:aws:acm:...'
    //   );
    //
    //   this.httpsListener = this.alb.addListener('HttpsListener', {
    //     port: 443,
    //     protocol: elbv2.ApplicationProtocol.HTTPS,
    //     certificates: [certificate],
    //     defaultAction: elbv2.ListenerAction.fixedResponse(404),
    //   });
    // }

    // ============================================================
    // Target Groups (for Lambda targets - created in Lambda stack)
    // ============================================================

    // Target groups will be created in the Lambda stack and registered here
    // We'll create them for:
    // 1. Parent chat streaming endpoint
    // 2. Student chat streaming endpoint

    // ============================================================
    // Connection Draining
    // ============================================================

    // Set connection draining timeout (for graceful shutdowns)
    // This will be set on target groups in the Lambda stack

    // ============================================================
    // Health Checks
    // ============================================================

    // Health checks will be configured on target groups in Lambda stack

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

    // Add tags
    cdk.Tags.of(this.alb).add('Name', `edulens-alb-${config.stage}`);
  }
}
