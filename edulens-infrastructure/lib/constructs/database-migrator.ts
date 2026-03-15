/**
 * Database Migrator Custom Resource
 *
 * Runs database migrations automatically during CDK deployment
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface DatabaseMigratorProps {
  vpc: ec2.IVpc;
  securityGroup: ec2.ISecurityGroup;
  databaseSecret: secretsmanager.ISecret;
  migrationScriptPath: string;
}

export class DatabaseMigrator extends Construct {
  public readonly customResource: cdk.CustomResource;

  constructor(scope: Construct, id: string, props: DatabaseMigratorProps) {
    super(scope, id);

    // Lambda function to run migrations
    const migrationFunction = new lambda.Function(this, 'MigrationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(props.migrationScriptPath),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.securityGroup],
      environment: {
        DB_SECRET_ARN: props.databaseSecret.secretArn,
      },
    });

    // Grant read access to database secret
    props.databaseSecret.grantRead(migrationFunction);

    // Custom resource provider
    const provider = new cr.Provider(this, 'MigrationProvider', {
      onEventHandler: migrationFunction,
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    // Compute a hash of migration.sql so the custom resource re-runs
    // automatically whenever the SQL content changes.
    const sqlPath = path.join(props.migrationScriptPath, 'migration.sql');
    const sqlHash = fs.existsSync(sqlPath)
      ? crypto.createHash('sha256').update(fs.readFileSync(sqlPath)).digest('hex').slice(0, 12)
      : '0';

    // Custom resource that triggers migration
    this.customResource = new cdk.CustomResource(this, 'MigrationResource', {
      serviceToken: provider.serviceToken,
      properties: {
        // Auto-derived from migration.sql content — changes whenever SQL changes
        Version: sqlHash,
      },
    });
  }
}
