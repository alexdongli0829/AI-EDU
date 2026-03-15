/**
 * Node.js Lambda Construct
 *
 * Uses NodejsFunction (esbuild) to bundle only imported code, eliminating the
 * need to ship the entire node_modules directory. Packages listed in
 * `externalModules` are excluded from the bundle (available in the Lambda
 * runtime).
 */

import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';

export interface NodejsLambdaProps {
  config: EnvironmentConfig;
  functionName: string;
  /**
   * Lambda handler in the form used by CDK: `dist/handlers/login.handler`
   * The construct converts this to a TypeScript entry path:
   *   dist/handlers/login.handler  →  <codePath>/src/handlers/login.ts
   */
  handler: string;
  /** Relative path from the infra root to the service directory */
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

    // ── Derive TypeScript entry from handler string ───────────────────────────
    // 'dist/handlers/login.handler'               → src/handlers/login.ts
    // 'dist/handlers/parent-chat/stream.handler'  → src/handlers/parent-chat/stream.ts
    const parts = handler.split('.');
    const exportedFn = parts[parts.length - 1];          // 'handler'
    const filePart   = parts.slice(0, -1).join('.');     // 'dist/handlers/login'
    const srcRelPath = filePart.replace(/^dist\//, 'src/') + '.ts';
    const entry      = path.resolve(__dirname, '../../', codePath, srcRelPath);

    // ── Log group ─────────────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention:    config.logRetentionDays,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── Lambda function (esbuild-bundled) ─────────────────────────────────────
    this.function = new NodejsFunction(this, 'Function', {
      functionName,
      runtime:     lambda.Runtime.NODEJS_20_X,
      entry,
      handler:     exportedFn,
      description,

      vpc,
      vpcSubnets:    { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [securityGroup],

      timeout:    timeout    || cdk.Duration.seconds(config.lambda.timeout),
      memorySize: memorySize || config.lambda.memorySize,

      environment: {
        NODE_ENV:      config.stage,
        STAGE:         config.stage,
        DB_SECRET_ARN: auroraSecret.secretArn,
        REDIS_URL:     `redis://${redisEndpoint}:6379`,
        LOG_LEVEL:     'info',
        ...environment,
      },

      tracing: config.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,

      ...(config.stage === 'prod' && {
        reservedConcurrentExecutions: 100,
      }),

      logGroup,

      bundling: {
        // @aws-sdk/* is built into the Node 20 managed runtime — no need to bundle it.
        externalModules: ['@aws-sdk/*'],

        // Prefer TypeScript source for workspace packages (e.g. @edulens/common,
        // @edulens/database) that have a "source" field pointing to src/index.ts.
        // This lets esbuild bundle them directly without requiring a pre-built dist/.
        mainFields: ['source', 'module', 'main'],

        minify:    true,
        sourceMap: false,
        target:    'node20',
      },
    });

    cdk.Tags.of(this.function).add('Service', functionName.split('-')[1] || 'unknown');
  }
}
