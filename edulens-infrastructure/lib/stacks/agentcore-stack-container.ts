/**
 * AgentCore Stack — Container Deployment (TypeScript)
 *
 * Provisions all Bedrock AgentCore resources for container-based deployment:
 *   - ECR repositories for agent container images
 *   - AgentCore Memory (created via CLI, referenced by ID)
 *   - IAM roles for Memory execution and Runtime execution
 *   - Security group for VPC-based agent networking
 *   - CfnRuntime for Parent Advisor and Student Tutor agents (container mode)
 *   - CfnRuntimeEndpoint for each agent
 *
 * Agent containers must be built and pushed to ECR before deployment.
 * Use scripts/deploy-agents-container.sh to build ARM64 containers and push.
 *
 * This replaces the Python direct code deployment version.
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface AgentCoreContainerStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  auroraSecret: secretsmanager.ISecret;
}

export class AgentCoreContainerStack extends cdk.Stack {
  public readonly memoryId: string;
  public readonly parentAdvisorEcrRepo: ecr.Repository;
  public readonly studentTutorEcrRepo: ecr.Repository;
  public readonly parentAdvisorRuntimeArn: string;
  public readonly studentTutorRuntimeArn: string;

  constructor(scope: Construct, id: string, props: AgentCoreContainerStackProps) {
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
    // ECR Repositories for Agent Container Images
    // ================================================================

    this.parentAdvisorEcrRepo = new ecr.Repository(this, 'ParentAdvisorEcrRepo', {
      repositoryName: `edulens-parent-advisor-${stageToken}`,
      removalPolicy: config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          rulePriority: 1,
          description: 'Keep only 10 most recent images',
          maxImageCount: 10,
        },
      ],
    });

    this.studentTutorEcrRepo = new ecr.Repository(this, 'StudentTutorEcrRepo', {
      repositoryName: `edulens-student-tutor-${stageToken}`,
      removalPolicy: config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          rulePriority: 1,
          description: 'Keep only 10 most recent images',
          maxImageCount: 10,
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

    // ECR image pull access
    runtimeExecutionRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRImagePull',
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
      ],
      resources: [
        this.parentAdvisorEcrRepo.repositoryArn,
        this.studentTutorEcrRepo.repositoryArn,
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
      description: 'Security group for AgentCore runtime agents (container mode)',
      allowAllOutbound: true,
    });

    cdk.Tags.of(agentSecurityGroup).add('Name', `edulens-agentcore-container-sg-${stageToken}`);

    // ================================================================
    // AgentCore Runtimes (Parent Advisor + Student Tutor) - Container Mode
    // ================================================================
    // Agent container images must be pushed to ECR BEFORE cdk deploy.
    // Use: scripts/deploy-agents-container.sh to build ARM64 containers and push.
    //
    // Key deployment constraints:
    //   - AgentCore Runtime runs on ARM64 Linux
    //   - Container must expose port 8080 with /ping and /invocations endpoints
    //   - Runtime env will set AGENT_TYPE environment variable
    //   - Container startup time should be < 30s (cold start limit)

    const parentAdvisorRuntime = new bedrockagentcore.CfnRuntime(this, 'ParentAdvisorRuntime', {
      agentRuntimeName: `edulens_parent_advisor_${stageToken}`,
      description: 'EduLens Parent Advisor Agent - TypeScript Container (ARM64)',
      agentRuntimeArtifact: {
        containerConfiguration: {
          imageUri: `${account}.dkr.ecr.${region}.amazonaws.com/${this.parentAdvisorEcrRepo.repositoryName}:latest`,
        },
      },
      roleArn: runtimeExecutionRole.roleArn,
      networkConfiguration: {
        networkMode: 'PUBLIC',
      },
      environmentVariables: {
        MODEL_ID: bedrockModelId,
        MEMORY_ID: this.memoryId,
        STAGE: stageToken,
        AGENT_TYPE: 'parent-advisor',
        NODE_ENV: 'production',
      },
      tags: {
        Project: 'EduLens',
        Stage: stageToken,
        Agent: 'parent-advisor',
        Runtime: 'container-typescript',
      },
    });

    const studentTutorRuntime = new bedrockagentcore.CfnRuntime(this, 'StudentTutorRuntime', {
      agentRuntimeName: `edulens_student_tutor_${stageToken}`,
      description: 'EduLens Student Tutor Agent - TypeScript Container (ARM64)',
      agentRuntimeArtifact: {
        containerConfiguration: {
          imageUri: `${account}.dkr.ecr.${region}.amazonaws.com/${this.studentTutorEcrRepo.repositoryName}:latest`,
        },
      },
      roleArn: runtimeExecutionRole.roleArn,
      networkConfiguration: {
        networkMode: 'PUBLIC',
      },
      environmentVariables: {
        MODEL_ID: bedrockModelId,
        MEMORY_ID: this.memoryId,
        STAGE: stageToken,
        AGENT_TYPE: 'student-tutor',
        NODE_ENV: 'production',
      },
      tags: {
        Project: 'EduLens',
        Stage: stageToken,
        Agent: 'student-tutor',
        Runtime: 'container-typescript',
      },
    });

    // Ensure runtimes are created after the ECR repositories and IAM role
    parentAdvisorRuntime.addDependency(this.parentAdvisorEcrRepo.node.defaultChild as cdk.CfnResource);
    studentTutorRuntime.addDependency(this.studentTutorEcrRepo.node.defaultChild as cdk.CfnResource);

    // ================================================================
    // AgentCore Runtime Endpoints
    // ================================================================

    const parentAdvisorEndpoint = new bedrockagentcore.CfnRuntimeEndpoint(this, 'ParentAdvisorEndpoint', {
      agentRuntimeId: parentAdvisorRuntime.attrAgentRuntimeId,
      name: `edulens_parent_advisor_ep_${stageToken}`,
      description: 'EduLens Parent Advisor Endpoint (Container)',
      tags: {
        Project: 'EduLens',
        Stage: stageToken,
        Agent: 'parent-advisor',
        Runtime: 'container-typescript',
      },
    });
    parentAdvisorEndpoint.addDependency(parentAdvisorRuntime);

    const studentTutorEndpoint = new bedrockagentcore.CfnRuntimeEndpoint(this, 'StudentTutorEndpoint', {
      agentRuntimeId: studentTutorRuntime.attrAgentRuntimeId,
      name: `edulens_student_tutor_ep_${stageToken}`,
      description: 'EduLens Student Tutor Endpoint (Container)',
      tags: {
        Project: 'EduLens',
        Stage: stageToken,
        Agent: 'student-tutor',
        Runtime: 'container-typescript',
      },
    });
    studentTutorEndpoint.addDependency(studentTutorRuntime);

    // Store ARNs for cross-stack reference
    this.parentAdvisorRuntimeArn = parentAdvisorRuntime.attrAgentRuntimeArn;
    this.studentTutorRuntimeArn = studentTutorRuntime.attrAgentRuntimeArn;

    // ================================================================
    // Outputs
    // ================================================================

    new cdk.CfnOutput(this, 'MemoryId', {
      value: this.memoryId,
      description: 'AgentCore Memory Store ID (created via CLI)',
      exportName: `edulens-agentcore-memory-id-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'ParentAdvisorEcrRepoUri', {
      value: this.parentAdvisorEcrRepo.repositoryUri,
      description: 'ECR repository URI for Parent Advisor container',
      exportName: `edulens-parent-advisor-ecr-uri-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'StudentTutorEcrRepoUri', {
      value: this.studentTutorEcrRepo.repositoryUri,
      description: 'ECR repository URI for Student Tutor container',
      exportName: `edulens-student-tutor-ecr-uri-${stageToken}`,
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

    new cdk.CfnOutput(this, 'ParentAdvisorRuntimeId', {
      value: parentAdvisorRuntime.attrAgentRuntimeId,
      description: 'Parent Advisor AgentCore Runtime ID',
      exportName: `edulens-parent-advisor-runtime-id-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'ParentAdvisorRuntimeArn', {
      value: parentAdvisorRuntime.attrAgentRuntimeArn,
      description: 'Parent Advisor AgentCore Runtime ARN',
      exportName: `edulens-parent-advisor-runtime-arn-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'ParentAdvisorEndpointName', {
      value: `edulens_parent_advisor_ep_${stageToken}`,
      description: 'Parent Advisor Endpoint Name (qualifier for invoke)',
      exportName: `edulens-parent-advisor-endpoint-name-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'StudentTutorRuntimeId', {
      value: studentTutorRuntime.attrAgentRuntimeId,
      description: 'Student Tutor AgentCore Runtime ID',
      exportName: `edulens-student-tutor-runtime-id-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'StudentTutorRuntimeArn', {
      value: studentTutorRuntime.attrAgentRuntimeArn,
      description: 'Student Tutor AgentCore Runtime ARN',
      exportName: `edulens-student-tutor-runtime-arn-${stageToken}`,
    });

    new cdk.CfnOutput(this, 'StudentTutorEndpointName', {
      value: `edulens_student_tutor_ep_${stageToken}`,
      description: 'Student Tutor Endpoint Name (qualifier for invoke)',
      exportName: `edulens-student-tutor-endpoint-name-${stageToken}`,
    });
  }
}