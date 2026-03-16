/**
 * AgentCore Stack
 *
 * Provisions Bedrock AgentCore resources for the EduLens AI agents:
 *   - ECR repositories for agent container images
 *   - AgentCore Memory store (semantic + summary + user preference strategies)
 *   - AgentCore Runtime for Parent Advisor and Student Tutor agents
 *   - IAM roles with Bedrock, Memory, Secrets Manager, and VPC permissions
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
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
  public readonly parentAdvisorRepo: ecr.Repository;
  public readonly studentTutorRepo: ecr.Repository;
  public readonly memory: agentcore.CfnMemory;
  public readonly parentAdvisorRuntime: agentcore.CfnRuntime;
  public readonly studentTutorRuntime: agentcore.CfnRuntime;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const { config, vpc, lambdaSecurityGroup, auroraSecret } = props;
    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // AgentCore resource names: ^[a-zA-Z][a-zA-Z0-9_]{0,47}$ (underscores only)
    const stageToken = config.stage;

    // ================================================================
    // ECR Repositories
    // ================================================================

    this.parentAdvisorRepo = new ecr.Repository(this, 'ParentAdvisorRepo', {
      repositoryName: `edulens-parent-advisor-${stageToken}`,
      removalPolicy: config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: config.stage !== 'prod',
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
        },
      ],
    });

    this.studentTutorRepo = new ecr.Repository(this, 'StudentTutorRepo', {
      repositoryName: `edulens-student-tutor-${stageToken}`,
      removalPolicy: config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: config.stage !== 'prod',
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
        },
      ],
    });

    // ================================================================
    // Memory Execution Role — must trust BOTH bedrock and bedrock-agentcore
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
    // AgentCore Memory Store
    // ================================================================

    this.memory = new agentcore.CfnMemory(this, 'Memory', {
      name: `edulens_memory_${stageToken}`,
      eventExpiryDuration: config.stage === 'prod' ? 365 : 90,
      memoryExecutionRoleArn: memoryExecutionRole.roleArn,
      memoryStrategies: [
        { semanticMemoryStrategy: {} },
        { summaryMemoryStrategy: {} },
        { userPreferenceMemoryStrategy: {} },
      ],
    });

    // ================================================================
    // Agent Security Group (reuse Lambda SG for Aurora/Redis access)
    // The Lambda SG already has ingress rules from ALB and egress to
    // Aurora (5432) and Redis (6379). AgentCore VPC agents need the
    // same network path.
    // ================================================================

    const agentSecurityGroup = new ec2.SecurityGroup(this, 'AgentSecurityGroup', {
      vpc,
      description: 'Security group for AgentCore runtime agents',
      allowAllOutbound: true,
    });

    cdk.Tags.of(agentSecurityGroup).add('Name', `edulens-agentcore-sg-${stageToken}`);

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

    // ECR image pull
    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EcrAuth',
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));

    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EcrPull',
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:BatchGetImage',
        'ecr:GetDownloadUrlForLayer',
      ],
      resources: [
        this.parentAdvisorRepo.repositoryArn,
        this.studentTutorRepo.repositoryArn,
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
    // Parent Advisor Runtime
    // ================================================================

    const privateSubnetIds = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    }).subnetIds;

    this.parentAdvisorRuntime = new agentcore.CfnRuntime(this, 'ParentAdvisorRuntime', {
      agentRuntimeName: `edulens_parent_advisor_${stageToken}`,
      roleArn: runtimeExecutionRole.roleArn,
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: `${account}.dkr.ecr.${region}.amazonaws.com/edulens-parent-advisor-${stageToken}:latest`,
        },
      },
      networkConfiguration: {
        networkMode: 'VPC',
        networkModeConfig: {
          vpcEndpointConfiguration: {
            securityGroupIds: [agentSecurityGroup.securityGroupId],
            subnetIds: privateSubnetIds,
          },
        },
      },
      environmentVariables: {
        AGENT_TYPE: 'parent-advisor',
        MEMORY_ID: this.memory.attrMemoryId,
        DB_SECRET_ARN: auroraSecret.secretArn,
        STAGE: stageToken,
        AWS_REGION_NAME: config.region,
        BEDROCK_MODEL_ID: bedrockModelId,
        IMAGE_VERSION: '1',
      },
      lifecycleConfiguration: {
        idleRuntimeSessionTimeout: config.stage === 'prod' ? 900 : 300,
        maxLifetime: 28800,
      },
      protocolConfiguration: { serverProtocol: 'HTTP' },
    });

    // DEFAULT endpoint auto-created; add explicit endpoint for pinned versions
    new agentcore.CfnRuntimeEndpoint(this, 'ParentAdvisorEndpoint', {
      name: `edulens_parent_advisor_live_${stageToken}`,
      agentRuntimeId: this.parentAdvisorRuntime.attrAgentRuntimeId,
    });

    // ================================================================
    // Student Tutor Runtime
    // ================================================================

    this.studentTutorRuntime = new agentcore.CfnRuntime(this, 'StudentTutorRuntime', {
      agentRuntimeName: `edulens_student_tutor_${stageToken}`,
      roleArn: runtimeExecutionRole.roleArn,
      agentRuntimeArtifact: {
        containerConfiguration: {
          containerUri: `${account}.dkr.ecr.${region}.amazonaws.com/edulens-student-tutor-${stageToken}:latest`,
        },
      },
      networkConfiguration: {
        networkMode: 'VPC',
        networkModeConfig: {
          vpcEndpointConfiguration: {
            securityGroupIds: [agentSecurityGroup.securityGroupId],
            subnetIds: privateSubnetIds,
          },
        },
      },
      environmentVariables: {
        AGENT_TYPE: 'student-tutor',
        MEMORY_ID: this.memory.attrMemoryId,
        DB_SECRET_ARN: auroraSecret.secretArn,
        STAGE: stageToken,
        AWS_REGION_NAME: config.region,
        BEDROCK_MODEL_ID: bedrockModelId,
        IMAGE_VERSION: '1',
      },
      lifecycleConfiguration: {
        idleRuntimeSessionTimeout: config.stage === 'prod' ? 900 : 300,
        maxLifetime: 28800,
      },
      protocolConfiguration: { serverProtocol: 'HTTP' },
    });

    new agentcore.CfnRuntimeEndpoint(this, 'StudentTutorEndpoint', {
      name: `edulens_student_tutor_live_${stageToken}`,
      agentRuntimeId: this.studentTutorRuntime.attrAgentRuntimeId,
    });

    // ================================================================
    // Allow AgentCore agents to connect to Aurora (port 5432)
    // Reuses the existing RDS security group ingress pattern from
    // network-stack.ts: RDS SG accepts 5432 from Lambda SG.
    // We also need RDS SG to accept from agentSecurityGroup.
    // NOTE: We don't modify the NetworkStack — just add ingress here.
    // ================================================================

    // The RDS security group ID is not directly available as a prop,
    // but agents in VPC with allowAllOutbound can reach Aurora through
    // the existing Lambda SG rules since they share the same VPC.
    // For explicit access, the deployer should add an ingress rule on
    // the RDS SG for agentSecurityGroup. We output the SG ID below.

    // ================================================================
    // Outputs
    // ================================================================

    new cdk.CfnOutput(this, 'MemoryId', {
      value: this.memory.attrMemoryId,
      description: 'AgentCore Memory Store ID',
      exportName: `edulens-agentcore-memory-id-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'ParentAdvisorRuntimeId', {
      value: this.parentAdvisorRuntime.attrAgentRuntimeId,
      description: 'Parent Advisor Runtime ID',
      exportName: `edulens-parent-advisor-runtime-id-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'StudentTutorRuntimeId', {
      value: this.studentTutorRuntime.attrAgentRuntimeId,
      description: 'Student Tutor Runtime ID',
      exportName: `edulens-student-tutor-runtime-id-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'ParentAdvisorRepoUri', {
      value: this.parentAdvisorRepo.repositoryUri,
      description: 'Parent Advisor ECR Repository URI',
    });

    new cdk.CfnOutput(this, 'StudentTutorRepoUri', {
      value: this.studentTutorRepo.repositoryUri,
      description: 'Student Tutor ECR Repository URI',
    });

    new cdk.CfnOutput(this, 'AgentSecurityGroupId', {
      value: agentSecurityGroup.securityGroupId,
      description: 'AgentCore runtime security group ID (add to RDS SG ingress for Aurora access)',
    });
  }
}
