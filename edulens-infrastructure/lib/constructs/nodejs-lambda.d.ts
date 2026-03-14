/**
 * Node.js Lambda Construct
 *
 * Reusable construct for creating Node.js Lambda functions with common configuration
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
export declare class NodejsLambda extends Construct {
    readonly function: lambda.Function;
    constructor(scope: Construct, id: string, props: NodejsLambdaProps);
}
