/**
 * Node.js Lambda Construct
 *
 * Uses NodejsFunction (esbuild) to bundle only imported code, eliminating the
 * need to ship the entire node_modules directory. Packages listed in
 * `externalModules` are excluded from the bundle (available in the Lambda
 * runtime). `@prisma/client` is excluded from esbuild bundling and installed
 * via `nodeModules` so its native binary is available at runtime.
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

    // Absolute path to the service root (for Prisma schema lookup)
    const serviceRoot = path.resolve(__dirname, '../../', codePath);

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

        // @prisma/client cannot be bundled by esbuild (native binary).
        // NodejsFunction will npm-install it into the output dir separately.
        nodeModules: ['@prisma/client'],

        commandHooks: {
          beforeBundling():  string[] { return []; },
          beforeInstall():   string[] { return []; },
          // After npm installs @prisma/client, copy the pre-generated .prisma/client
          // directory (which contains the Lambda-compatible rhel-openssl-3.0.x binary
          // produced by `prisma generate` with binaryTargets in schema.prisma).
          afterBundling(inputDir: string, outputDir: string): string[] {
            return [
              `[ -d "${inputDir}/node_modules/.prisma" ] && cp -r "${inputDir}/node_modules/.prisma" "${outputDir}/node_modules/.prisma" || true`,
            ];
          },
        },

        minify:    true,
        sourceMap: false,
        target:    'node20',
      },
    });

    cdk.Tags.of(this.function).add('Service', functionName.split('-')[1] || 'unknown');
  }
}
