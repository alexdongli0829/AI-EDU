/**
 * Database Stack
 *
 * Creates RDS Aurora Serverless v2, ElastiCache Redis, and DynamoDB tables
 */
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
export interface DatabaseStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
    vpc: ec2.Vpc;
    rdsSecurityGroup: ec2.SecurityGroup;
    redisSecurityGroup: ec2.SecurityGroup;
}
export declare class DatabaseStack extends cdk.Stack {
    readonly auroraCluster: rds.DatabaseCluster;
    readonly auroraSecret: secretsmanager.ISecret;
    readonly redisCluster: elasticache.CfnCacheCluster;
    readonly redisEndpoint: string;
    readonly websocketConnectionsTable: dynamodb.Table;
    readonly connectionsTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props: DatabaseStackProps);
}
