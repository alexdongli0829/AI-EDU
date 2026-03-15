/**
 * Python Lambda Construct
 *
 * Reusable construct for creating Python Lambda functions with common configuration
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface PythonLambdaProps {
  config: EnvironmentConfig;
  functionName: string;
  handler: string;
  codePath: string;
  description: string;
  vpc: ec2.Vpc;
  securityGroup: ec2.SecurityGroup;
  auroraSecret: secretsmanager.ISecret;
  redisEndpoint?: string;
  environment?: Record<string, string>;
  timeout?: cdk.Duration;
  memorySize?: number;
  /** Requirements file to install (relative to codePath). Default: requirements.txt */
  requirementsFile?: string;
}

export class PythonLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: PythonLambdaProps) {
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
      requirementsFile = 'requirements.txt',
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
      runtime: lambda.Runtime.PYTHON_3_12,
      handler,
      // Bundle dependencies at CDK deploy time using the Lambda Python 3.12 runtime image.
      // This installs pip packages for linux/x86_64 and copies the src/ directory.
      code: lambda.Code.fromAsset(codePath, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            [
              `pip install -r /asset-input/${requirementsFile} -t /asset-output --quiet --no-cache-dir`,
              'cp -au /asset-input/src /asset-output/',
            ].join(' && '),
          ],
        },
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
        PYTHONPATH: '/var/task:/var/runtime',
        STAGE: config.stage,
        DB_SECRET_ARN: auroraSecret.secretArn, // Lambda will read secret and construct connection string
        ...(redisEndpoint && {
          REDIS_URL: `redis://${redisEndpoint}:6379`,
        }),
        LOG_LEVEL: 'info',
        ...environment,
      },

      // X-Ray tracing
      tracing: config.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,

      // Reserved concurrency (production only)
      ...(config.stage === 'prod' && {
        reservedConcurrentExecutions: 50,
      }),

      // Log group
      logGroup,
    });

    // Note: Database secret access is granted in the Lambda stack to avoid cyclic dependencies

    // Add tags
    cdk.Tags.of(this.function).add('Service', functionName.split('-')[1] || 'unknown');
  }
}
