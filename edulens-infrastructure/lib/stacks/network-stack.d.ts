/**
 * Network Stack
 *
 * Creates VPC with public and private subnets, NAT Gateway, and security groups
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
export interface NetworkStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
}
export declare class NetworkStack extends cdk.Stack {
    readonly vpc: ec2.Vpc;
    readonly lambdaSecurityGroup: ec2.SecurityGroup;
    readonly rdsSecurityGroup: ec2.SecurityGroup;
    readonly redisSecurityGroup: ec2.SecurityGroup;
    readonly albSecurityGroup: ec2.SecurityGroup;
    constructor(scope: Construct, id: string, props: NetworkStackProps);
}
