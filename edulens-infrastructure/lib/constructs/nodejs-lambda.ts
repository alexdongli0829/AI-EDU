/**
 * Node.js Lambda Construct
 *
 * Reusable construct for creating Node.js Lambda functions with common configuration
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface NodejsLambdaProps {
  config: EnvironmentConfig;
  functionName: string;
  handler: string;
  codePath: string;
  description: string;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  auroraSecret: secretsmanager.ISecret;
  redisEndpoint: string;
  environment?: Record<string, string>;
  timeout?: cdk.Duration;
  memorySize?: number;
}

export class NodejsLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: NodejsLambdaProps) {
    super(scope, id);

    const {
      config,
      functionName,
      handler,
      codePath,
      description,
      vpc,
      securityGroup,
      auroraSecret,
      redisEndpoint,
      environment = {},
      timeout,
      memorySize,
    } = props;

    // Create log group
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: config.logRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Lambda function
    this.function = new lambda.Function(this, 'Function', {
      functionName,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler,
      code: lambda.Code.fromAsset(codePath, {
        exclude: [
          'test',
          'tests',
          '__tests__',
          '*.test.ts',
          '*.test.js',
          '*.spec.ts',
          '*.spec.js',
          '*.md',
          '.git',
          '.env',
          '.env.local',
          'tsconfig.json',
          'jest.config.js',
          'coverage',
          'node_modules/@types',
          'node_modules/typescript',
          'node_modules/prisma',
        ],
      }),
      description,

      // VPC configuration
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [securityGroup],

      // Resource configuration
      timeout: timeout || cdk.Duration.seconds(config.lambda.timeout),
      memorySize: memorySize || config.lambda.memorySize,

      // Environment variables
      environment: {
        NODE_ENV: config.stage,
        STAGE: config.stage,
        DB_SECRET_ARN: auroraSecret.secretArn, // Lambda will read secret and construct connection string
        REDIS_URL: `redis://${redisEndpoint}:6379`,
        LOG_LEVEL: 'info',
        ...environment,
      },

      // X-Ray tracing
      tracing: config.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,

      // Reserved concurrency (production only)
      ...(config.stage === 'prod' && {
        reservedConcurrentExecutions: 100,
      }),

      // Log group
      logGroup,
    });

    // Note: Database secret access is granted in the Lambda stack to avoid cyclic dependencies

    // Add tags
    cdk.Tags.of(this.function).add('Service', functionName.split('-')[1] || 'unknown');
  }
}
