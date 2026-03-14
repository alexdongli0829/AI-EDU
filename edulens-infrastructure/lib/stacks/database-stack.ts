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

export class DatabaseStack extends cdk.Stack {
  public readonly auroraCluster: rds.DatabaseCluster;
  public readonly auroraSecret: secretsmanager.ISecret;
  public readonly redisCluster: elasticache.CfnCacheCluster;
  public readonly redisEndpoint: string;
  public readonly websocketConnectionsTable: dynamodb.Table;
  public readonly connectionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { config, vpc, rdsSecurityGroup, redisSecurityGroup } = props;

    // ============================================================
    // RDS Aurora Serverless v2 (PostgreSQL)
    // ============================================================

    // Create subnet group for RDS (use isolated subnets)
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', {
      description: 'Subnet group for Aurora cluster',
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create Aurora Serverless v2 cluster
    this.auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.of('15.8', '15'), // Full version, major version for parameter group
      }),

      credentials: rds.Credentials.fromGeneratedSecret('postgres', {
        secretName: `edulens-db-credentials-${config.stage}`,
      }),

      defaultDatabaseName: 'edulens',

      writer: rds.ClusterInstance.serverlessV2('writer', {
        enablePerformanceInsights: config.stage === 'prod',
      }),

      readers: config.stage === 'prod'
        ? [
            rds.ClusterInstance.serverlessV2('reader', {
              scaleWithWriter: true,
            }),
          ]
        : undefined,

      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [rdsSecurityGroup],
      subnetGroup: dbSubnetGroup,

      // Serverless v2 scaling
      serverlessV2MinCapacity: config.rds.minCapacity,
      serverlessV2MaxCapacity: config.rds.maxCapacity,

      // Backups
      backup: {
        retention: config.stage === 'prod'
          ? cdk.Duration.days(30)
          : cdk.Duration.days(7),
        preferredWindow: '03:00-04:00', // 3-4 AM UTC
      },

      // Deletion protection (production only)
      deletionProtection: config.stage === 'prod',

      // Remove cluster on stack deletion (non-prod only)
      removalPolicy: config.stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    this.auroraSecret = this.auroraCluster.secret!;

    // CloudWatch alarms for Aurora
    if (config.stage === 'prod') {
      this.auroraCluster.metricServerlessDatabaseCapacity().createAlarm(this, 'AuroraHighCapacity', {
        threshold: config.rds.maxCapacity * 0.8,
        evaluationPeriods: 3,
        alarmDescription: 'Aurora capacity is high',
      });
    }

    // ============================================================
    // ElastiCache Redis
    // ============================================================

    // Create subnet group for Redis (use private subnets)
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds,
    });

    // Create Redis cluster
    this.redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: config.redis.nodeType,
      engine: 'redis',
      engineVersion: '7.1',
      numCacheNodes: config.redis.numCacheNodes,

      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.ref,

      // Automatic failover (multi-node only)
      autoMinorVersionUpgrade: true,

      // Snapshots
      snapshotRetentionLimit: config.stage === 'prod' ? 7 : 1,
      snapshotWindow: '03:00-05:00',

      // Maintenance window
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
    });

    this.redisCluster.addDependency(redisSubnetGroup);

    // Set Redis endpoint for easy access
    this.redisEndpoint = this.redisCluster.attrRedisEndpointAddress;

    // ============================================================
    // DynamoDB - WebSocket Connections
    // ============================================================

    this.websocketConnectionsTable = new dynamodb.Table(this, 'WebSocketConnectionsTable', {
      tableName: `edulens-websocket-connections-${config.stage}`,
      partitionKey: {
        name: 'connectionId',
        type: dynamodb.AttributeType.STRING,
      },

      // TTL for automatic cleanup
      timeToLiveAttribute: 'ttl',

      // Billing mode
      billingMode: config.stage === 'prod'
        ? dynamodb.BillingMode.PROVISIONED
        : dynamodb.BillingMode.PAY_PER_REQUEST,

      // Capacity (if provisioned)
      ...(config.stage === 'prod' && {
        readCapacity: 5,
        writeCapacity: 5,
      }),

      // Point-in-time recovery (production)
      pointInTimeRecovery: config.stage === 'prod',

      // Deletion protection
      removalPolicy: config.stage === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying by session ID
    this.websocketConnectionsTable.addGlobalSecondaryIndex({
      indexName: 'sessionIdIndex',
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,

      ...(config.stage === 'prod' && {
        readCapacity: 2,
        writeCapacity: 2,
      }),
    });

    // Auto-scaling for DynamoDB (production)
    if (config.stage === 'prod') {
      const readScaling = this.websocketConnectionsTable.autoScaleReadCapacity({
        minCapacity: 5,
        maxCapacity: 100,
      });

      readScaling.scaleOnUtilization({
        targetUtilizationPercent: 70,
      });

      const writeScaling = this.websocketConnectionsTable.autoScaleWriteCapacity({
        minCapacity: 5,
        maxCapacity: 100,
      });

      writeScaling.scaleOnUtilization({
        targetUtilizationPercent: 70,
      });
    }

    // Alias for easy access from Lambda stack
    this.connectionsTable = this.websocketConnectionsTable;

    // ============================================================
    // Outputs
    // ============================================================

    new cdk.CfnOutput(this, 'AuroraClusterEndpoint', {
      value: this.auroraCluster.clusterEndpoint.hostname,
      description: 'Aurora cluster writer endpoint',
      exportName: `edulens-aurora-endpoint-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'AuroraSecretArn', {
      value: this.auroraSecret.secretArn,
      description: 'Aurora credentials secret ARN',
      exportName: `edulens-aurora-secret-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrRedisEndpointAddress,
      description: 'Redis cluster endpoint',
      exportName: `edulens-redis-endpoint-${config.stage}`,
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: this.redisCluster.attrRedisEndpointPort,
      description: 'Redis cluster port',
    });

    new cdk.CfnOutput(this, 'WebSocketTableName', {
      value: this.websocketConnectionsTable.tableName,
      description: 'DynamoDB WebSocket connections table name',
      exportName: `edulens-websocket-table-${config.stage}`,
    });
  }
}
