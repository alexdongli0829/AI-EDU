/**
 * AgentCore Stack — Phase 1 (Foundation)
 *
 * Provisions Bedrock AgentCore foundation resources:
 *   - S3 bucket for agent code zip artifacts (direct code deployment)
 *   - AgentCore Memory (created via CLI, referenced by ID)
 *   - IAM roles for Memory execution and Runtime execution
 *   - Security group for VPC-based agent networking
 *
 * AgentCore Runtimes are created in Phase 2 after agent code is
 * packaged and uploaded to S3. Uses direct code deployment (zip)
 * instead of container-based deployment for faster iteration.
 *
 * See: https://aws.amazon.com/blogs/machine-learning/iterate-faster-with-amazon-bedrock-agentcore-runtime-direct-code-deployment/
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface AgentCoreStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  auroraSecret: secretsmanager.ISecret;
}

export class AgentCoreStack extends cdk.Stack {
  public readonly memoryId: string;
  public readonly codeBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const { config, vpc, auroraSecret } = props;
    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;
    const stageToken = config.stage;

    // ================================================================
    // AgentCore Memory (created via CLI, not CloudFormation)
    // ================================================================
    // CLI: aws bedrock-agentcore-control create-memory --name edulens_memory_dev ...
    // CfnMemory has Lambda/SDK compatibility issues in CloudFormation.
    const memoryIds: Record<string, string> = {
      dev: 'edulens_memory_dev-fkjwsj2f5b',
      // prod: 'edulens_memory_prod-XXXXX',
    };
    this.memoryId = memoryIds[config.stage] || `edulens_memory_${stageToken}-PLACEHOLDER`;

    // ================================================================
    // S3 Bucket for Agent Code Artifacts (Direct Code Deployment)
    // ================================================================

    this.codeBucket = new s3.Bucket(this, 'AgentCodeBucket', {
      bucketName: `edulens-agent-code-${stageToken}-${account}`,
      removalPolicy: config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: config.stage !== 'prod',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'CleanupOldVersions',
          noncurrentVersionExpiration: cdk.Duration.days(30),
          enabled: true,
        },
      ],
    });

    // ================================================================
    // Memory Execution Role
    // ================================================================

    const memoryExecutionRole = new iam.Role(this, 'MemoryExecutionRole', {
      roleName: `edulens-agentcore-memory-role-${stageToken}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
        new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      ),
    });

    memoryExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockInvokeForMemoryExtraction',
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:*::foundation-model/*'],
    }));

    // ================================================================
    // Runtime Execution Role
    // ================================================================

    const runtimeExecutionRole = new iam.Role(this, 'RuntimeExecutionRole', {
      roleName: `edulens-agentcore-runtime-role-${stageToken}`,
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
    });

    // Bedrock model invocation
    const bedrockModelId = config.region.startsWith('eu-')
      ? 'eu.anthropic.claude-sonnet-4-20250514-v1:0'
      : config.region.startsWith('ap-')
        ? 'anthropic.claude-3-5-sonnet-20241022-v2:0'
        : 'us.anthropic.claude-sonnet-4-20250514-v1:0';

    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockModelInvoke',
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:Converse',
        'bedrock:ConverseStream',
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        `arn:aws:bedrock:${region}:${account}:inference-profile/${bedrockModelId}`,
      ],
    }));

    // S3 code artifact access
    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3CodeAccess',
      actions: [
        's3:GetObject',
        's3:GetObjectVersion',
        's3:ListBucket',
      ],
      resources: [
        this.codeBucket.bucketArn,
        `${this.codeBucket.bucketArn}/*`,
      ],
    }));

    // CloudWatch Logs
    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchLogs',
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: ['*'],
    }));

    // AgentCore Memory operations
    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'AgentCoreMemory',
      actions: [
        'bedrock-agentcore:CreateEvent',
        'bedrock-agentcore:ListEvents',
        'bedrock-agentcore:RetrieveMemoryRecords',
        'bedrock-agentcore:ListMemoryRecords',
        'bedrock-agentcore:ListSessions',
      ],
      resources: ['*'],
    }));

    // Secrets Manager (Aurora credentials)
    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SecretsManager',
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [auroraSecret.secretArn],
    }));

    // ================================================================
    // Agent Security Group (for VPC-based Runtime networking)
    // ================================================================

    const agentSecurityGroup = new ec2.SecurityGroup(this, 'AgentSecurityGroup', {
      vpc,
      description: 'Security group for AgentCore runtime agents',
      allowAllOutbound: true,
    });

    cdk.Tags.of(agentSecurityGroup).add('Name', `edulens-agentcore-sg-${stageToken}`);

    // ================================================================
    // Outputs
    // ================================================================

    new cdk.CfnOutput(this, 'MemoryId', {
      value: this.memoryId,
      description: 'AgentCore Memory Store ID (created via CLI)',
      exportName: `edulens-agentcore-memory-id-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'CodeBucketName', {
      value: this.codeBucket.bucketName,
      description: 'S3 bucket for agent code zip artifacts',
      exportName: `edulens-agentcore-code-bucket-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'RuntimeExecutionRoleArn', {
      value: runtimeExecutionRole.roleArn,
      description: 'Runtime execution role ARN',
      exportName: `edulens-agentcore-runtime-role-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'MemoryExecutionRoleArn', {
      value: memoryExecutionRole.roleArn,
      description: 'Memory execution role ARN',
    });

    new cdk.CfnOutput(this, 'AgentSecurityGroupId', {
      value: agentSecurityGroup.securityGroupId,
      description: 'AgentCore runtime security group ID',
    });

    new cdk.CfnOutput(this, 'BedrockModelId', {
      value: bedrockModelId,
      description: 'Bedrock model ID for agents',
    });
  }
}
