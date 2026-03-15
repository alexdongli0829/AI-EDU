/**
 * Node.js Lambda Construct
 *
 * Uses NodejsFunction (esbuild) to bundle only imported code, eliminating the
 * need to ship the entire node_modules directory. Packages listed in
 * `externalModules` are excluded from the bundle (available in the Lambda
 * runtime).
 */
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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
export declare class NodejsLambda extends Construct {
    readonly function: lambda.Function;
    constructor(scope: Construct, id: string, props: NodejsLambdaProps);
}
