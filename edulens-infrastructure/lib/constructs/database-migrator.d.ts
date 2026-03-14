/**
 * Database Migrator Custom Resource
 *
 * Runs database migrations automatically during CDK deployment
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
export interface DatabaseMigratorProps {
    vpc: ec2.IVpc;
    securityGroup: ec2.ISecurityGroup;
    databaseSecret: secretsmanager.ISecret;
    migrationScriptPath: string;
}
export declare class DatabaseMigrator extends Construct {
    readonly customResource: cdk.CustomResource;
    constructor(scope: Construct, id: string, props: DatabaseMigratorProps);
}
