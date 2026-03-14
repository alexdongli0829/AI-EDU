"use strict";
/**
 * Database Stack
 *
 * Creates RDS Aurora Serverless v2, ElastiCache Redis, and DynamoDB tables
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const elasticache = __importStar(require("aws-cdk-lib/aws-elasticache"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class DatabaseStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        this.auroraSecret = this.auroraCluster.secret;
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
exports.DatabaseStack = DatabaseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhYmFzZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MseUVBQTJEO0FBQzNELG1FQUFxRDtBQVlyRCxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQVExQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixFQUFFLGtCQUFrQixFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXBFLCtEQUErRDtRQUMvRCx3Q0FBd0M7UUFDeEMsK0RBQStEO1FBRS9ELHFEQUFxRDtRQUNyRCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUMvRCxXQUFXLEVBQUUsaUNBQWlDO1lBQzlDLEdBQUc7WUFDSCxVQUFVLEVBQUU7Z0JBQ1YsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCO2FBQzVDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsc0NBQXNDO1FBQ3RDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDbEUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUM7Z0JBQy9DLE9BQU8sRUFBRSxHQUFHLENBQUMsMkJBQTJCLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsRUFBRSxrREFBa0Q7YUFDOUcsQ0FBQztZQUVGLFdBQVcsRUFBRSxHQUFHLENB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Q0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxTQUFTO1lBQy9DLFdBQVcsRUFBRSwyQ0FBMkM7WUFDeEQsVUFBVSxFQUFFLDJCQUEyQixNQUFNLENBQUMsS0FBSyxFQUFFO1NBQ3RELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXpPRCxzQ0F5T0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERhdGFiYXNlIFN0YWNrXG4gKlxuICogQ3JlYXRlcyBSRFMgQXVyb3JhIFNlcnZlcmxlc3MgdjIsIEVsYXN0aUNhY2hlIFJlZGlzLCBhbmQgRHluYW1vREIgdGFibGVzXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHJkcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtcmRzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGVsYXN0aWNhY2hlIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lbGFzdGljYWNoZSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvZW52aXJvbm1lbnRzJztcblxuZXhwb3J0IGludGVyZmFjZSBEYXRhYmFzZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG4gIHZwYzogZWMyLlZwYztcbiAgcmRzU2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXA7XG4gIHJlZGlzU2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXA7XG59XG5cbmV4cG9ydCBjbGFzcyBEYXRhYmFzZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGF1cm9yYUNsdXN0ZXI6IHJkcy5EYXRhYmFzZUNsdXN0ZXI7XG4gIHB1YmxpYyByZWFkb25seSBhdXJvcmFTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XG4gIHB1YmxpYyByZWFkb25seSByZWRpc0NsdXN0ZXI6IGVsYXN0aWNhY2hlLkNmbkNhY2hlQ2x1c3RlcjtcbiAgcHVibGljIHJlYWRvbmx5IHJlZGlzRW5kcG9pbnQ6IHN0cmluZztcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldENvbm5lY3Rpb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgY29ubmVjdGlvbnNUYWJsZTogZHluYW1vZGIuVGFibGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IERhdGFiYXNlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBjb25maWcsIHZwYywgcmRzU2VjdXJpdHlHcm91cCwgcmVkaXNTZWN1cml0eUdyb3VwIH0gPSBwcm9wcztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFJEUyBBdXJvcmEgU2VydmVybGVzcyB2MiAoUG9zdGdyZVNRTClcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIENyZWF0ZSBzdWJuZXQgZ3JvdXAgZm9yIFJEUyAodXNlIGlzb2xhdGVkIHN1Ym5ldHMpXG4gICAgY29uc3QgZGJTdWJuZXRHcm91cCA9IG5ldyByZHMuU3VibmV0R3JvdXAodGhpcywgJ0RiU3VibmV0R3JvdXAnLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ1N1Ym5ldCBncm91cCBmb3IgQXVyb3JhIGNsdXN0ZXInLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBBdXJvcmEgU2VydmVybGVzcyB2MiBjbHVzdGVyXG4gICAgdGhpcy5hdXJvcmFDbHVzdGVyID0gbmV3IHJkcy5EYXRhYmFzZUNsdXN0ZXIodGhpcywgJ0F1cm9yYUNsdXN0ZXInLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhUG9zdGdyZXMoe1xuICAgICAgICB2ZXJzaW9uOiByZHMuQXVyb3JhUG9zdGdyZXNFbmdpbmVWZXJzaW9uLm9mKCcxNS44JywgJzE1JyksIC8vIEZ1bGwgdmVyc2lvbiwgbWFqb3IgdmVyc2lvbiBmb3IgcGFyYW1ldGVyIGdyb3VwXG4gICAgICB9KSxcblxuICAgICAgY3JlZGVudGlhbHM6IHJkcy5DcmVkZW50aWFscy5mcm9tR2VuZXJhdGVkU2VjcmV0KCdwb3N0Z3JlcycsIHtcbiAgICAgICAgc2VjcmV0TmFtZTogYGVkdWxlbnMtZGItY3JlZGVudGlhbHMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIH0pLFxuXG4gICAgICBkZWZhdWx0RGF0YWJhc2VOYW1lOiAnZWR1bGVucycsXG5cbiAgICAgIHdyaXRlcjogcmRzLkNsdXN0ZXJJbnN0YW5jZS5zZXJ2ZXJsZXNzVjIoJ3dyaXRlcicsIHtcbiAgICAgICAgZW5hYmxlUGVyZm9ybWFuY2VJbnNpZ2h0czogY29uZmlnLnN0YWdlID09PSAncHJvZCcsXG4gICAgICB9KSxcblxuICAgICAgcmVhZGVyczogY29uZmlnLnN0YWdlID09PSAncHJvZCdcbiAgICAgICAgPyBbXG4gICAgICAgICAgICByZHMuQ2x1c3Rlckluc3RhbmNlLnNlcnZlcmxlc3NWMigncmVhZGVyJywge1xuICAgICAgICAgICAgICBzY2FsZVdpdGhXcml0ZXI6IHRydWUsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdXG4gICAgICAgIDogdW5kZWZpbmVkLFxuXG4gICAgICB2cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfSVNPTEFURUQsXG4gICAgICB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtyZHNTZWN1cml0eUdyb3VwXSxcbiAgICAgIHN1Ym5ldEdyb3VwOiBkYlN1Ym5ldEdyb3VwLFxuXG4gICAgICAvLyBTZXJ2ZXJsZXNzIHYyIHNjYWxpbmdcbiAgICAgIHNlcnZlcmxlc3NWMk1pbkNhcGFjaXR5OiBjb25maWcucmRzLm1pbkNhcGFjaXR5LFxuICAgICAgc2VydmVybGVzc1YyTWF4Q2FwYWNpdHk6IGNvbmZpZy5yZHMubWF4Q2FwYWNpdHksXG5cbiAgICAgIC8vIEJhY2t1cHNcbiAgICAgIGJhY2t1cDoge1xuICAgICAgICByZXRlbnRpb246IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBjZGsuRHVyYXRpb24uZGF5cygzMClcbiAgICAgICAgICA6IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgICBwcmVmZXJyZWRXaW5kb3c6ICcwMzowMC0wNDowMCcsIC8vIDMtNCBBTSBVVENcbiAgICAgIH0sXG5cbiAgICAgIC8vIERlbGV0aW9uIHByb3RlY3Rpb24gKHByb2R1Y3Rpb24gb25seSlcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogY29uZmlnLnN0YWdlID09PSAncHJvZCcsXG5cbiAgICAgIC8vIFJlbW92ZSBjbHVzdGVyIG9uIHN0YWNrIGRlbGV0aW9uIChub24tcHJvZCBvbmx5KVxuICAgICAgcmVtb3ZhbFBvbGljeTogY29uZmlnLnN0YWdlID09PSAncHJvZCdcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hdXJvcmFTZWNyZXQgPSB0aGlzLmF1cm9yYUNsdXN0ZXIuc2VjcmV0ITtcblxuICAgIC8vIENsb3VkV2F0Y2ggYWxhcm1zIGZvciBBdXJvcmFcbiAgICBpZiAoY29uZmlnLnN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgIHRoaXMuYXVyb3JhQ2x1c3Rlci5tZXRyaWNTZXJ2ZXJsZXNzRGF0YWJhc2VDYXBhY2l0eSgpLmNyZWF0ZUFsYXJtKHRoaXMsICdBdXJvcmFIaWdoQ2FwYWNpdHknLCB7XG4gICAgICAgIHRocmVzaG9sZDogY29uZmlnLnJkcy5tYXhDYXBhY2l0eSAqIDAuOCxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBdXJvcmEgY2FwYWNpdHkgaXMgaGlnaCcsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBFbGFzdGlDYWNoZSBSZWRpc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gQ3JlYXRlIHN1Ym5ldCBncm91cCBmb3IgUmVkaXMgKHVzZSBwcml2YXRlIHN1Ym5ldHMpXG4gICAgY29uc3QgcmVkaXNTdWJuZXRHcm91cCA9IG5ldyBlbGFzdGljYWNoZS5DZm5TdWJuZXRHcm91cCh0aGlzLCAnUmVkaXNTdWJuZXRHcm91cCcsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnU3VibmV0IGdyb3VwIGZvciBSZWRpcyBjbHVzdGVyJyxcbiAgICAgIHN1Ym5ldElkczogdnBjLnNlbGVjdFN1Ym5ldHMoe1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSkuc3VibmV0SWRzLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFJlZGlzIGNsdXN0ZXJcbiAgICB0aGlzLnJlZGlzQ2x1c3RlciA9IG5ldyBlbGFzdGljYWNoZS5DZm5DYWNoZUNsdXN0ZXIodGhpcywgJ1JlZGlzQ2x1c3RlcicsIHtcbiAgICAgIGNhY2hlTm9kZVR5cGU6IGNvbmZpZy5yZWRpcy5ub2RlVHlwZSxcbiAgICAgIGVuZ2luZTogJ3JlZGlzJyxcbiAgICAgIGVuZ2luZVZlcnNpb246ICc3LjEnLFxuICAgICAgbnVtQ2FjaGVOb2RlczogY29uZmlnLnJlZGlzLm51bUNhY2hlTm9kZXMsXG5cbiAgICAgIHZwY1NlY3VyaXR5R3JvdXBJZHM6IFtyZWRpc1NlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkXSxcbiAgICAgIGNhY2hlU3VibmV0R3JvdXBOYW1lOiByZWRpc1N1Ym5ldEdyb3VwLnJlZixcblxuICAgICAgLy8gQXV0b21hdGljIGZhaWxvdmVyIChtdWx0aS1ub2RlIG9ubHkpXG4gICAgICBhdXRvTWlub3JWZXJzaW9uVXBncmFkZTogdHJ1ZSxcblxuICAgICAgLy8gU25hcHNob3RzXG4gICAgICBzbmFwc2hvdFJldGVudGlvbkxpbWl0OiBjb25maWcuc3RhZ2UgPT09ICdwcm9kJyA/IDcgOiAxLFxuICAgICAgc25hcHNob3RXaW5kb3c6ICcwMzowMC0wNTowMCcsXG5cbiAgICAgIC8vIE1haW50ZW5hbmNlIHdpbmRvd1xuICAgICAgcHJlZmVycmVkTWFpbnRlbmFuY2VXaW5kb3c6ICdzdW46MDU6MDAtc3VuOjA2OjAwJyxcbiAgICB9KTtcblxuICAgIHRoaXMucmVkaXNDbHVzdGVyLmFkZERlcGVuZGVuY3kocmVkaXNTdWJuZXRHcm91cCk7XG5cbiAgICAvLyBTZXQgUmVkaXMgZW5kcG9pbnQgZm9yIGVhc3kgYWNjZXNzXG4gICAgdGhpcy5yZWRpc0VuZHBvaW50ID0gdGhpcy5yZWRpc0NsdXN0ZXIuYXR0clJlZGlzRW5kcG9pbnRBZGRyZXNzO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRHluYW1vREIgLSBXZWJTb2NrZXQgQ29ubmVjdGlvbnNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMud2Vic29ja2V0Q29ubmVjdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnV2ViU29ja2V0Q29ubmVjdGlvbnNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGVkdWxlbnMtd2Vic29ja2V0LWNvbm5lY3Rpb25zLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2Nvbm5lY3Rpb25JZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcblxuICAgICAgLy8gVFRMIGZvciBhdXRvbWF0aWMgY2xlYW51cFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG5cbiAgICAgIC8vIEJpbGxpbmcgbW9kZVxuICAgICAgYmlsbGluZ01vZGU6IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnXG4gICAgICAgID8gZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORURcbiAgICAgICAgOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG5cbiAgICAgIC8vIENhcGFjaXR5IChpZiBwcm92aXNpb25lZClcbiAgICAgIC4uLihjb25maWcuc3RhZ2UgPT09ICdwcm9kJyAmJiB7XG4gICAgICAgIHJlYWRDYXBhY2l0eTogNSxcbiAgICAgICAgd3JpdGVDYXBhY2l0eTogNSxcbiAgICAgIH0pLFxuXG4gICAgICAvLyBQb2ludC1pbi10aW1lIHJlY292ZXJ5IChwcm9kdWN0aW9uKVxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogY29uZmlnLnN0YWdlID09PSAncHJvZCcsXG5cbiAgICAgIC8vIERlbGV0aW9uIHByb3RlY3Rpb25cbiAgICAgIHJlbW92YWxQb2xpY3k6IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEdTSSBmb3IgcXVlcnlpbmcgYnkgc2Vzc2lvbiBJRFxuICAgIHRoaXMud2Vic29ja2V0Q29ubmVjdGlvbnNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdzZXNzaW9uSWRJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3Nlc3Npb25JZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HLFxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTEwsXG5cbiAgICAgIC4uLihjb25maWcuc3RhZ2UgPT09ICdwcm9kJyAmJiB7XG4gICAgICAgIHJlYWRDYXBhY2l0eTogMixcbiAgICAgICAgd3JpdGVDYXBhY2l0eTogMixcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gQXV0by1zY2FsaW5nIGZvciBEeW5hbW9EQiAocHJvZHVjdGlvbilcbiAgICBpZiAoY29uZmlnLnN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgIGNvbnN0IHJlYWRTY2FsaW5nID0gdGhpcy53ZWJzb2NrZXRDb25uZWN0aW9uc1RhYmxlLmF1dG9TY2FsZVJlYWRDYXBhY2l0eSh7XG4gICAgICAgIG1pbkNhcGFjaXR5OiA1LFxuICAgICAgICBtYXhDYXBhY2l0eTogMTAwLFxuICAgICAgfSk7XG5cbiAgICAgIHJlYWRTY2FsaW5nLnNjYWxlT25VdGlsaXphdGlvbih7XG4gICAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogNzAsXG4gICAgICB9KTtcblxuICAgICAgY29uc3Qgd3JpdGVTY2FsaW5nID0gdGhpcy53ZWJzb2NrZXRDb25uZWN0aW9uc1RhYmxlLmF1dG9TY2FsZVdyaXRlQ2FwYWNpdHkoe1xuICAgICAgICBtaW5DYXBhY2l0eTogNSxcbiAgICAgICAgbWF4Q2FwYWNpdHk6IDEwMCxcbiAgICAgIH0pO1xuXG4gICAgICB3cml0ZVNjYWxpbmcuc2NhbGVPblV0aWxpemF0aW9uKHtcbiAgICAgICAgdGFyZ2V0VXRpbGl6YXRpb25QZXJjZW50OiA3MCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEFsaWFzIGZvciBlYXN5IGFjY2VzcyBmcm9tIExhbWJkYSBzdGFja1xuICAgIHRoaXMuY29ubmVjdGlvbnNUYWJsZSA9IHRoaXMud2Vic29ja2V0Q29ubmVjdGlvbnNUYWJsZTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE91dHB1dHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdXJvcmFDbHVzdGVyRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdXJvcmFDbHVzdGVyLmNsdXN0ZXJFbmRwb2ludC5ob3N0bmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXVyb3JhIGNsdXN0ZXIgd3JpdGVyIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLWF1cm9yYS1lbmRwb2ludC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F1cm9yYVNlY3JldEFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF1cm9yYVNlY3JldC5zZWNyZXRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1cm9yYSBjcmVkZW50aWFscyBzZWNyZXQgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLWF1cm9yYS1zZWNyZXQtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZWRpc0VuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IHRoaXMucmVkaXNDbHVzdGVyLmF0dHJSZWRpc0VuZHBvaW50QWRkcmVzcyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVkaXMgY2x1c3RlciBlbmRwb2ludCcsXG4gICAgICBleHBvcnROYW1lOiBgZWR1bGVucy1yZWRpcy1lbmRwb2ludC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlZGlzUG9ydCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJlZGlzQ2x1c3Rlci5hdHRyUmVkaXNFbmRwb2ludFBvcnQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JlZGlzIGNsdXN0ZXIgcG9ydCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0VGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMud2Vic29ja2V0Q29ubmVjdGlvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIFdlYlNvY2tldCBjb25uZWN0aW9ucyB0YWJsZSBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLXdlYnNvY2tldC10YWJsZS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgIH0pO1xuICB9XG59XG4iXX0=