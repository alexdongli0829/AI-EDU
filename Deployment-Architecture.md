# EduLens Deployment Architecture

**Version:** 1.0
**Last Updated:** March 2026
**Author:** Senior DevOps/SRE Architect

---

## Table of Contents

1. [Deployment Overview](#1-deployment-overview)
2. [Infrastructure as Code](#2-infrastructure-as-code)
3. [Multi-Environment Strategy](#3-multi-environment-strategy)
4. [AWS Infrastructure](#4-aws-infrastructure)
5. [Networking Architecture](#5-networking-architecture)
6. [CI/CD Pipelines](#6-cicd-pipelines)
7. [Secrets Management](#7-secrets-management)
8. [Monitoring & Observability](#8-monitoring--observability)
9. [Logging Strategy](#9-logging-strategy)
10. [Security & Compliance](#10-security--compliance)
11. [Disaster Recovery & Backup](#11-disaster-recovery--backup)
12. [Cost Optimization](#12-cost-optimization)
13. [Deployment Process](#13-deployment-process)
14. [Runbooks & Operations](#14-runbooks--operations)

---

## 1. Deployment Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS Cloud (us-east-1)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Edge Layer                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │   │
│  │  │ CloudFront   │  │  Route 53    │  │   WAF        │     │   │
│  │  │ (CDN)        │  │  (DNS)       │  │  (Firewall)  │     │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Application Layer                          │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Frontend (S3 + CloudFront)                          │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  API Gateway → Lambda (REST APIs)                    │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  API Gateway (WebSocket) → Lambda                    │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  ALB → Lambda (SSE Streaming)                        │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Data Layer                               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │  RDS Aurora │  │ ElastiCache  │  │  DynamoDB    │      │   │
│  │  │  Serverless │  │  (Redis)     │  │  (NoSQL)     │      │   │
│  │  └─────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Integration Layer                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ EventBridge │  │     SQS      │  │      SNS     │      │   │
│  │  │  (Events)   │  │   (Queues)   │  │ (Notifications)│    │   │
│  │  └─────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Observability Layer                         │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │ CloudWatch  │  │   X-Ray      │  │  CloudWatch  │      │   │
│  │  │   Logs      │  │  (Tracing)   │  │   Alarms     │      │   │
│  │  └─────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                             ↓                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Security Layer                             │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │     IAM     │  │   Secrets    │  │     KMS      │      │   │
│  │  │   (Access)  │  │   Manager    │  │(Encryption)  │      │   │
│  │  └─────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

                              ↓

┌─────────────────────────────────────────────────────────────────────┐
│                        External Services                             │
│  • Anthropic Claude API (AI)                                        │
│  • GitHub (CI/CD)                                                    │
│  • PagerDuty (Alerting)                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Deployment Principles

1. **Infrastructure as Code (IaC)**: All infrastructure defined in code (AWS CDK)
2. **Immutable Infrastructure**: No in-place updates, always replace
3. **Blue-Green Deployments**: Zero-downtime deployments with quick rollback
4. **Multi-Environment Parity**: Dev/Staging/Production have identical structure
5. **Security by Default**: Least privilege, encryption everywhere, audit logging
6. **Observability First**: Comprehensive logging, metrics, tracing
7. **Cost-Aware**: Auto-scaling, serverless, right-sizing

### 1.3 Technology Stack

```json
{
  "iac": "AWS CDK (TypeScript)",
  "ci_cd": "GitHub Actions",
  "container_registry": "Amazon ECR (for Lambda containers)",
  "secrets": "AWS Secrets Manager + Parameter Store",
  "monitoring": "CloudWatch + X-Ray",
  "alerting": "CloudWatch Alarms + SNS + PagerDuty",
  "backup": "AWS Backup",
  "dns": "Route 53",
  "cdn": "CloudFront",
  "waf": "AWS WAF"
}
```

---

## 2. Infrastructure as Code

### 2.1 AWS CDK Project Structure

```
edulens-infrastructure/
├── bin/
│   └── app.ts                      # CDK App entry point
│
├── lib/
│   ├── stacks/
│   │   ├── network-stack.ts        # VPC, subnets, security groups
│   │   ├── database-stack.ts       # RDS, ElastiCache, DynamoDB
│   │   ├── storage-stack.ts        # S3 buckets
│   │   ├── frontend-stack.ts       # CloudFront + S3 hosting
│   │   ├── api-stack.ts            # API Gateway + Lambda
│   │   ├── websocket-stack.ts      # WebSocket Gateway + Lambda
│   │   ├── sse-stack.ts            # ALB + Lambda for SSE
│   │   ├── background-stack.ts     # SQS + EventBridge + Lambda
│   │   ├── monitoring-stack.ts     # CloudWatch, X-Ray, Alarms
│   │   ├── security-stack.ts       # Secrets, KMS, WAF
│   │   └── cicd-stack.ts           # CI/CD infrastructure
│   │
│   ├── constructs/
│   │   ├── lambda-function.ts      # Reusable Lambda construct
│   │   ├── api-endpoint.ts         # API Gateway endpoint construct
│   │   ├── database-cluster.ts     # Aurora cluster construct
│   │   └── monitoring-dashboard.ts # CloudWatch dashboard construct
│   │
│   └── config/
│       ├── dev.ts                  # Development config
│       ├── staging.ts              # Staging config
│       └── production.ts           # Production config
│
├── scripts/
│   ├── deploy.sh                   # Deployment script
│   ├── rollback.sh                 # Rollback script
│   └── seed-database.sh            # Database seeding
│
├── tests/
│   └── stacks/
│       └── *.test.ts               # CDK stack tests
│
├── cdk.json                        # CDK configuration
├── package.json
├── tsconfig.json
└── README.md
```

### 2.2 CDK App Entry Point

```typescript
// bin/app.ts
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { WebSocketStack } from '../lib/stacks/websocket-stack';
import { SSEStack } from '../lib/stacks/sse-stack';
import { BackgroundStack } from '../lib/stacks/background-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { SecurityStack } from '../lib/stacks/security-stack';
import { getConfig } from '../lib/config';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';
const config = getConfig(environment);

// Tags for all resources
const commonTags = {
  Project: 'EduLens',
  Environment: environment,
  ManagedBy: 'CDK',
};

// Security Stack (KMS, Secrets, WAF)
const securityStack = new SecurityStack(app, `EduLens-Security-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
});

// Network Stack (VPC, Subnets, Security Groups)
const networkStack = new NetworkStack(app, `EduLens-Network-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
});

// Database Stack (RDS, ElastiCache, DynamoDB)
const databaseStack = new DatabaseStack(app, `EduLens-Database-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  vpc: networkStack.vpc,
  kmsKey: securityStack.databaseKey,
});

// Storage Stack (S3 Buckets)
const storageStack = new StorageStack(app, `EduLens-Storage-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  kmsKey: securityStack.storageKey,
});

// Frontend Stack (CloudFront + S3)
const frontendStack = new FrontendStack(app, `EduLens-Frontend-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  assetsBucket: storageStack.assetsBucket,
});

// API Stack (API Gateway + Lambda)
const apiStack = new ApiStack(app, `EduLens-API-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  vpc: networkStack.vpc,
  database: databaseStack.database,
  redis: databaseStack.redis,
});

// WebSocket Stack
const websocketStack = new WebSocketStack(app, `EduLens-WebSocket-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  vpc: networkStack.vpc,
  database: databaseStack.database,
  redis: databaseStack.redis,
});

// SSE Stack (ALB + Lambda)
const sseStack = new SSEStack(app, `EduLens-SSE-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  vpc: networkStack.vpc,
  database: databaseStack.database,
  redis: databaseStack.redis,
});

// Background Jobs Stack (SQS + EventBridge + Lambda)
const backgroundStack = new BackgroundStack(app, `EduLens-Background-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  vpc: networkStack.vpc,
  database: databaseStack.database,
  redis: databaseStack.redis,
  eventBus: databaseStack.eventBus,
});

// Monitoring Stack (CloudWatch, X-Ray, Alarms)
const monitoringStack = new MonitoringStack(app, `EduLens-Monitoring-${environment}`, {
  env: config.awsEnv,
  tags: commonTags,
  config,
  apiGateway: apiStack.api,
  lambdaFunctions: [
    ...apiStack.functions,
    ...websocketStack.functions,
    ...sseStack.functions,
    ...backgroundStack.functions,
  ],
  database: databaseStack.database,
  redis: databaseStack.redis,
});

app.synth();
```

### 2.3 Environment Configuration

```typescript
// lib/config/index.ts
export interface EnvironmentConfig {
  environment: 'dev' | 'staging' | 'production';
  awsEnv: {
    account: string;
    region: string;
  };
  vpc: {
    cidr: string;
    maxAzs: number;
    natGateways: number;
  };
  database: {
    aurora: {
      minCapacity: number;
      maxCapacity: number;
      autoPause: boolean;
      backupRetentionDays: number;
    };
    redis: {
      nodeType: string;
      numCacheNodes: number;
    };
  };
  frontend: {
    domainName: string;
    certificateArn: string;
  };
  lambda: {
    defaultMemory: number;
    defaultTimeout: number;
  };
  monitoring: {
    alarmEmail: string;
    pagerDutyIntegrationKey?: string;
  };
}

export function getConfig(environment: string): EnvironmentConfig {
  switch (environment) {
    case 'dev':
      return require('./dev').devConfig;
    case 'staging':
      return require('./staging').stagingConfig;
    case 'production':
      return require('./production').productionConfig;
    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}
```

```typescript
// lib/config/production.ts
export const productionConfig: EnvironmentConfig = {
  environment: 'production',
  awsEnv: {
    account: process.env.AWS_ACCOUNT_ID!,
    region: 'us-east-1',
  },
  vpc: {
    cidr: '10.0.0.0/16',
    maxAzs: 3,
    natGateways: 3, // High availability
  },
  database: {
    aurora: {
      minCapacity: 2,
      maxCapacity: 16,
      autoPause: false, // Always on
      backupRetentionDays: 30,
    },
    redis: {
      nodeType: 'cache.r7g.large',
      numCacheNodes: 2, // Multi-AZ
    },
  },
  frontend: {
    domainName: 'edulens.com',
    certificateArn: process.env.ACM_CERTIFICATE_ARN!,
  },
  lambda: {
    defaultMemory: 1024,
    defaultTimeout: 30,
  },
  monitoring: {
    alarmEmail: 'ops@edulens.com',
    pagerDutyIntegrationKey: process.env.PAGERDUTY_KEY!,
  },
};
```

```typescript
// lib/config/dev.ts
export const devConfig: EnvironmentConfig = {
  environment: 'dev',
  awsEnv: {
    account: process.env.AWS_ACCOUNT_ID!,
    region: 'us-east-1',
  },
  vpc: {
    cidr: '10.1.0.0/16',
    maxAzs: 2,
    natGateways: 1, // Cost optimization
  },
  database: {
    aurora: {
      minCapacity: 0.5,
      maxCapacity: 2,
      autoPause: true, // Auto-pause after 5 min
      backupRetentionDays: 7,
    },
    redis: {
      nodeType: 'cache.t4g.micro',
      numCacheNodes: 1,
    },
  },
  frontend: {
    domainName: 'dev.edulens.com',
    certificateArn: process.env.ACM_CERTIFICATE_ARN!,
  },
  lambda: {
    defaultMemory: 512,
    defaultTimeout: 30,
  },
  monitoring: {
    alarmEmail: 'dev-team@edulens.com',
  },
};
```

### 2.4 Network Stack Example

```typescript
// lib/stacks/network-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config';

interface NetworkStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { config } = props;

    // VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'VPC', {
      ipAddresses: ec2.IpAddresses.cidr(config.vpc.cidr),
      maxAzs: config.vpc.maxAzs,
      natGateways: config.vpc.natGateways,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    // VPC Flow Logs
    new ec2.FlowLog(this, 'VPCFlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
    });

    // Security Group for Lambda functions
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Security Group for RDS
    this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSG', {
      vpc: this.vpc,
      description: 'Security group for RDS Aurora',
      allowAllOutbound: false,
    });

    // Allow Lambda to access RDS
    this.databaseSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to access PostgreSQL'
    );

    // Security Group for Redis
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSG', {
      vpc: this.vpc,
      description: 'Security group for ElastiCache Redis',
      allowAllOutbound: false,
    });

    // Allow Lambda to access Redis
    this.redisSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Lambda to access Redis'
    );

    // VPC Endpoints for cost optimization (no NAT charges)
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    // Outputs
    new cdk.CfnOutput(this, 'VPCId', {
      value: this.vpc.vpcId,
      exportName: `${config.environment}-VPCId`,
    });
  }
}
```

### 2.5 Database Stack Example

```typescript
// lib/stacks/database-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config';

interface DatabaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  kmsKey: kms.Key;
}

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseCluster;
  public readonly redis: elasticache.CfnCacheCluster;
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { config, vpc, kmsKey } = props;

    // RDS Aurora Serverless v2 (PostgreSQL)
    this.database = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        autoMinorVersionUpgrade: true,
      }),
      readers: config.environment === 'production' ? [
        rds.ClusterInstance.serverlessV2('Reader', {
          scaleWithWriter: true,
        }),
      ] : [],
      serverlessV2MinCapacity: config.database.aurora.minCapacity,
      serverlessV2MaxCapacity: config.database.aurora.maxCapacity,
      storageEncrypted: true,
      storageEncryptionKey: kmsKey,
      backup: {
        retention: cdk.Duration.days(config.database.aurora.backupRetentionDays),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      deletionProtection: config.environment === 'production',
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.SNAPSHOT
        : cdk.RemovalPolicy.DESTROY,
    });

    // Store database credentials in Secrets Manager (automatic)
    // Access via: database.secret

    // ElastiCache Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for ElastiCache Redis',
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds,
    });

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSG', {
      vpc,
      description: 'Security group for Redis',
    });

    this.redis = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: config.database.redis.nodeType,
      engine: 'redis',
      engineVersion: '7.0',
      numCacheNodes: config.database.redis.numCacheNodes,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
      autoMinorVersionUpgrade: true,
      snapshotRetentionLimit: config.environment === 'production' ? 7 : 0,
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
    });

    this.redis.addDependency(redisSubnetGroup);

    // DynamoDB for event sourcing
    const eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: `${config.environment}-edulens-events`,
      partitionKey: {
        name: 'aggregate_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'event_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.environment === 'production',
      removalPolicy: config.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying events by timestamp
    eventsTable.addGlobalSecondaryIndex({
      indexName: 'timestamp-index',
      partitionKey: {
        name: 'aggregate_type',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // EventBridge for async processing
    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `${config.environment}-edulens-events`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.clusterEndpoint.hostname,
      exportName: `${config.environment}-DatabaseEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.secret!.secretArn,
      exportName: `${config.environment}-DatabaseSecretArn`,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redis.attrRedisEndpointAddress,
      exportName: `${config.environment}-RedisEndpoint`,
    });
  }
}
```

### 2.6 Lambda Function Construct

```typescript
// lib/constructs/lambda-function.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface LambdaFunctionProps {
  functionName: string;
  handler: string;
  code: lambda.Code;
  runtime: lambda.Runtime;
  environment?: { [key: string]: string };
  vpc?: ec2.IVpc;
  securityGroups?: ec2.ISecurityGroup[];
  timeout?: cdk.Duration;
  memorySize?: number;
  reservedConcurrentExecutions?: number;
  layers?: lambda.ILayerVersion[];
}

export class LambdaFunction extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionProps) {
    super(scope, id);

    this.function = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      handler: props.handler,
      code: props.code,
      runtime: props.runtime,
      environment: {
        ...props.environment,
        LOG_LEVEL: 'INFO',
        POWERTOOLS_SERVICE_NAME: props.functionName,
      },
      vpc: props.vpc,
      vpcSubnets: props.vpc ? {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      } : undefined,
      securityGroups: props.securityGroups,
      timeout: props.timeout || cdk.Duration.seconds(30),
      memorySize: props.memorySize || 1024,
      reservedConcurrentExecutions: props.reservedConcurrentExecutions,
      layers: props.layers,
      tracing: lambda.Tracing.ACTIVE, // X-Ray
      logRetention: logs.RetentionDays.ONE_WEEK,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
    });

    // CloudWatch Alarms
    const errorMetric = this.function.metricErrors({
      statistic: 'sum',
      period: cdk.Duration.minutes(5),
    });

    errorMetric.createAlarm(this, 'ErrorAlarm', {
      alarmName: `${props.functionName}-errors`,
      alarmDescription: `Errors in ${props.functionName}`,
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const throttleMetric = this.function.metricThrottles({
      statistic: 'sum',
      period: cdk.Duration.minutes(5),
    });

    throttleMetric.createAlarm(this, 'ThrottleAlarm', {
      alarmName: `${props.functionName}-throttles`,
      alarmDescription: `Throttles in ${props.functionName}`,
      threshold: 10,
      evaluationPeriods: 1,
    });
  }
}
```

---

## 3. Multi-Environment Strategy

### 3.1 Environment Comparison

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Purpose** | Feature development | Pre-production testing | Live users |
| **Data** | Synthetic test data | Anonymized prod data | Real user data |
| **Scale** | Minimal (cost-optimized) | 50% of production | Full scale |
| **Availability** | Single AZ | Multi-AZ | Multi-AZ + DR |
| **Auto-scaling** | Disabled | Enabled | Enabled |
| **Monitoring** | Basic | Full | Full + PagerDuty |
| **Backups** | 7 days | 14 days | 30 days |
| **Cost** | ~$50-100/month | ~$150-200/month | ~$300-400/month |

### 3.2 Environment Promotion Strategy

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│              │      │              │      │              │
│ Development  ├─────>│   Staging    ├─────>│  Production  │
│              │      │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
     │                     │                      │
     │                     │                      │
  Feature               Smoke                  Gradual
  Branches              Tests +                Rollout +
     +                  E2E Tests              Monitoring
  PR Checks
```

**Promotion Gates:**

1. **Dev → Staging**
   - All PR checks pass (lint, test, build)
   - Code review approved
   - Automated unit tests pass

2. **Staging → Production**
   - All E2E tests pass in staging
   - Load testing completed
   - Security scan passed
   - Manual approval from tech lead
   - Change management ticket

### 3.3 Deployment Commands

```bash
# Deploy to development
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (requires approval)
./scripts/deploy.sh production

# Rollback production
./scripts/rollback.sh production <version>
```

```bash
# scripts/deploy.sh
#!/bin/bash

set -e

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: ./deploy.sh <environment>"
  exit 1
fi

echo "Deploying to $ENVIRONMENT..."

# Load environment variables
export $(cat .env.$ENVIRONMENT | xargs)

# Run pre-deployment checks
echo "Running pre-deployment checks..."
npm run test
npm run lint

# Deploy infrastructure
echo "Deploying infrastructure..."
cd infrastructure
cdk deploy --all \
  --context environment=$ENVIRONMENT \
  --require-approval never

# Deploy backend
echo "Deploying backend..."
cd ../backend
npm run deploy:$ENVIRONMENT

# Deploy frontend
echo "Deploying frontend..."
cd ../frontend
npm run build
npm run deploy:$ENVIRONMENT

# Run smoke tests
echo "Running smoke tests..."
npm run test:smoke -- --env $ENVIRONMENT

echo "Deployment to $ENVIRONMENT completed successfully!"
```

---

## 4. AWS Infrastructure

### 4.1 Resource Naming Convention

```
{environment}-{project}-{service}-{resource-type}

Examples:
- prod-edulens-api-lambda
- prod-edulens-database-aurora
- prod-edulens-cache-redis
- staging-edulens-api-lambda
- dev-edulens-database-aurora
```

### 4.2 Tagging Strategy

All resources must have these tags:

```typescript
{
  Project: 'EduLens',
  Environment: 'production' | 'staging' | 'dev',
  ManagedBy: 'CDK',
  CostCenter: 'Engineering',
  Owner: 'platform-team@edulens.com',
  Service: 'api' | 'frontend' | 'background' | 'database',
}
```

### 4.3 IAM Roles & Policies

```typescript
// Least privilege Lambda execution role
const lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
  ],
});

// Grant specific permissions
database.secret!.grantRead(lambdaRole);
eventsTable.grantReadWriteData(lambdaRole);
eventBus.grantPutEventsTo(lambdaRole);
```

### 4.4 Cost Allocation

```typescript
// Enable cost allocation tags
new cdk.CfnTag({
  key: 'CostCenter',
  value: 'Engineering',
});

new cdk.CfnTag({
  key: 'Service',
  value: 'api',
});
```

Use AWS Cost Explorer to track costs by:
- Environment (dev vs staging vs production)
- Service (api vs frontend vs database)
- Resource type (Lambda vs RDS vs ElastiCache)

---

## 5. Networking Architecture

### 5.1 VPC Design

```
VPC: 10.0.0.0/16 (65,536 IPs)

├── us-east-1a
│   ├── Public Subnet (10.0.1.0/24)      → 256 IPs
│   ├── Private Subnet (10.0.11.0/24)    → 256 IPs (Lambda)
│   └── Isolated Subnet (10.0.21.0/24)   → 256 IPs (RDS, Redis)
│
├── us-east-1b
│   ├── Public Subnet (10.0.2.0/24)      → 256 IPs
│   ├── Private Subnet (10.0.12.0/24)    → 256 IPs (Lambda)
│   └── Isolated Subnet (10.0.22.0/24)   → 256 IPs (RDS, Redis)
│
└── us-east-1c
    ├── Public Subnet (10.0.3.0/24)      → 256 IPs
    ├── Private Subnet (10.0.13.0/24)    → 256 IPs (Lambda)
    └── Isolated Subnet (10.0.23.0/24)   → 256 IPs (RDS, Redis)
```

### 5.2 Security Groups

```typescript
// Lambda Security Group
// Outbound: All (to access internet, RDS, Redis)
// Inbound: None (Lambda doesn't accept inbound)

// RDS Security Group
// Outbound: None
// Inbound: Port 5432 from Lambda SG only

// Redis Security Group
// Outbound: None
// Inbound: Port 6379 from Lambda SG only

// ALB Security Group (for SSE)
// Outbound: All
// Inbound: Port 443 from 0.0.0.0/0 (internet)
```

### 5.3 Network ACLs

Use default NACLs (allow all) + Security Groups for granular control.

### 5.4 VPC Endpoints

```typescript
// Interface Endpoints (cost: ~$7/month each)
vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
  service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
});

// Gateway Endpoints (free)
vpc.addGatewayEndpoint('S3Endpoint', {
  service: ec2.GatewayVpcEndpointAwsService.S3,
});

vpc.addGatewayEndpoint('DynamoDBEndpoint', {
  service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
});
```

**Cost Savings**: Gateway endpoints eliminate NAT Gateway charges for S3 and DynamoDB traffic (~$45/month savings in production).

---

## 6. CI/CD Pipelines

### 6.1 Pipeline Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    GitHub Repository                      │
│  • Backend code                                           │
│  • Frontend code                                          │
│  • Infrastructure code                                    │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ↓ (Push / PR)
┌──────────────────────────────────────────────────────────┐
│                  GitHub Actions                           │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  PR Checks (on pull_request)                       │ │
│  │  1. Lint code                                      │ │
│  │  2. Run unit tests                                 │ │
│  │  3. Type check (TypeScript)                        │ │
│  │  4. Security scan (Snyk)                           │ │
│  │  5. Build application                              │ │
│  │  6. Report coverage                                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Deploy to Dev (on push to develop)               │ │
│  │  1. Run all PR checks                             │ │
│  │  2. Deploy infrastructure (CDK)                   │ │
│  │  3. Deploy backend (Lambda)                       │ │
│  │  4. Deploy frontend (S3 + CloudFront)             │ │
│  │  5. Run smoke tests                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Deploy to Staging (on push to main)              │ │
│  │  1. Run all PR checks                             │ │
│  │  2. Deploy infrastructure                         │ │
│  │  3. Deploy backend + frontend                     │ │
│  │  4. Run E2E tests                                 │ │
│  │  5. Run load tests                                │ │
│  │  6. Create release candidate                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Deploy to Production (manual approval)           │ │
│  │  1. Require manual approval                       │ │
│  │  2. Deploy with blue-green strategy               │ │
│  │  3. Run smoke tests                               │ │
│  │  4. Monitor for 15 minutes                        │ │
│  │  5. Auto-rollback on errors                       │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 6.2 GitHub Actions Workflows

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: |
          corepack enable pnpm
          pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Unit tests
        run: pnpm test:unit --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Build
        run: pnpm build
```

```yaml
# .github/workflows/deploy-dev.yml
name: Deploy Development

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: development

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: |
          corepack enable pnpm
          pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Deploy infrastructure
        working-directory: ./infrastructure
        run: |
          pnpm cdk deploy --all \
            --context environment=dev \
            --require-approval never

      - name: Deploy backend
        working-directory: ./backend
        run: pnpm deploy:dev

      - name: Build frontend
        working-directory: ./frontend
        run: |
          pnpm build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.DEV_API_URL }}
          NEXT_PUBLIC_WS_URL: ${{ secrets.DEV_WS_URL }}

      - name: Deploy frontend
        working-directory: ./frontend
        run: |
          aws s3 sync ./out s3://dev-edulens-frontend --delete
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.DEV_CLOUDFRONT_ID }} \
            --paths "/*"

      - name: Run smoke tests
        run: pnpm test:smoke --env dev

      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment to dev ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy (e.g., v1.2.3)'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.version }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: |
          corepack enable pnpm
          pnpm install --frozen-lockfile

      - name: Run all tests
        run: |
          pnpm test
          pnpm test:e2e

      - name: Deploy infrastructure
        working-directory: ./infrastructure
        run: |
          pnpm cdk deploy --all \
            --context environment=production \
            --require-approval never

      - name: Deploy backend (Blue-Green)
        working-directory: ./backend
        run: |
          # Deploy to new Lambda version (alias: green)
          pnpm deploy:production --alias green

          # Shift 10% traffic to green
          aws lambda update-alias \
            --function-name prod-edulens-api \
            --name live \
            --routing-config AdditionalVersionWeights={green=0.1}

          # Wait and monitor
          sleep 300

          # Check error rates
          ERROR_RATE=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Errors \
            --dimensions Name=FunctionName,Value=prod-edulens-api \
            --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
            --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
            --period 300 \
            --statistics Sum \
            --query 'Datapoints[0].Sum' \
            --output text)

          if [ "$ERROR_RATE" -gt "5" ]; then
            echo "Error rate too high, rolling back..."
            aws lambda update-alias \
              --function-name prod-edulens-api \
              --name live \
              --routing-config AdditionalVersionWeights={}
            exit 1
          fi

          # Shift 100% traffic to green
          aws lambda update-alias \
            --function-name prod-edulens-api \
            --name live \
            --routing-config AdditionalVersionWeights={green=1.0}

      - name: Deploy frontend
        working-directory: ./frontend
        run: |
          pnpm build
          aws s3 sync ./out s3://prod-edulens-frontend --delete
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.PROD_CLOUDFRONT_ID }} \
            --paths "/*"

      - name: Run smoke tests
        run: pnpm test:smoke --env production

      - name: Create GitHub release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.event.inputs.version }}
          release_name: Release ${{ github.event.inputs.version }}
          draft: false
          prerelease: false

      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### 6.3 Deployment Strategies

#### Blue-Green Deployment (Lambda)

```typescript
// Lambda alias for traffic shifting
const liveAlias = new lambda.Alias(this, 'LiveAlias', {
  aliasName: 'live',
  version: lambdaFunction.currentVersion,
});

// CodeDeploy for gradual rollout
const application = new codedeploy.LambdaApplication(this, 'CodeDeployApp');

new codedeploy.LambdaDeploymentGroup(this, 'DeploymentGroup', {
  application,
  alias: liveAlias,
  deploymentConfig: codedeploy.LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
  alarms: [errorAlarm, throttleAlarm],
  autoRollback: {
    failedDeployment: true,
    deploymentInAlarm: true,
  },
});
```

#### CloudFront Deployment

```bash
# Zero-downtime frontend deployment
aws s3 sync ./out s3://prod-edulens-frontend --delete
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

---

## 7. Secrets Management

### 7.1 Secrets Strategy

```
┌──────────────────────────────────────────────────────┐
│              Secrets Management                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  AWS Secrets Manager (for sensitive secrets)         │
│  • Database credentials                               │
│  • API keys (Anthropic, external services)           │
│  • JWT signing keys                                   │
│  • Automatic rotation support                         │
│  • Cost: $0.40/secret/month + $0.05/10K API calls   │
│                                                       │
│  AWS Systems Manager Parameter Store (config)        │
│  • Environment-specific config                        │
│  • Feature flags                                      │
│  • Non-sensitive settings                             │
│  • Free for standard parameters                       │
│                                                       │
│  Environment Variables (Lambda)                       │
│  • Injected from Secrets Manager at deploy time      │
│  • Encrypted at rest with KMS                         │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 7.2 Secret Naming Convention

```
{environment}/{service}/{secret-name}

Examples:
- production/database/master-password
- production/api/anthropic-api-key
- production/api/jwt-secret
- staging/database/master-password
```

### 7.3 Secrets in CDK

```typescript
// lib/stacks/security-stack.ts
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class SecurityStack extends cdk.Stack {
  public readonly jwtSecret: secretsmanager.Secret;
  public readonly anthropicApiKey: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    const { config } = props;

    // JWT Secret (auto-generated)
    this.jwtSecret = new secretsmanager.Secret(this, 'JWTSecret', {
      secretName: `${config.environment}/api/jwt-secret`,
      description: 'JWT signing secret',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ algorithm: 'HS256' }),
        generateStringKey: 'secret',
        excludeCharacters: '"@/\\',
      },
    });

    // Anthropic API Key (imported from existing secret)
    this.anthropicApiKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'AnthropicApiKey',
      `${config.environment}/api/anthropic-api-key`
    );

    // Feature flags in Parameter Store
    new ssm.StringParameter(this, 'EnableChatFeature', {
      parameterName: `/${config.environment}/features/enable-chat`,
      stringValue: 'true',
      description: 'Enable chat feature',
    });

    // Non-sensitive config
    new ssm.StringParameter(this, 'MaxTestDuration', {
      parameterName: `/${config.environment}/config/max-test-duration`,
      stringValue: '3600', // 1 hour in seconds
      description: 'Maximum test duration',
    });
  }
}
```

### 7.4 Accessing Secrets in Lambda

```typescript
// Lambda environment variables (injected at deploy time)
const lambdaFunction = new lambda.Function(this, 'ApiFunction', {
  // ...
  environment: {
    JWT_SECRET_ARN: jwtSecret.secretArn,
    ANTHROPIC_API_KEY_ARN: anthropicApiKey.secretArn,
    DATABASE_SECRET_ARN: database.secret!.secretArn,
  },
});

// Grant read permissions
jwtSecret.grantRead(lambdaFunction);
anthropicApiKey.grantRead(lambdaFunction);
database.secret!.grantRead(lambdaFunction);
```

```typescript
// Backend code - fetching secrets
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsClient = new SecretsManagerClient({ region: 'us-east-1' });

async function getSecret(secretArn: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await secretsClient.send(command);
  return response.SecretString!;
}

// Cache secrets to avoid API calls
let cachedJwtSecret: string | null = null;

export async function getJwtSecret(): Promise<string> {
  if (!cachedJwtSecret) {
    cachedJwtSecret = await getSecret(process.env.JWT_SECRET_ARN!);
  }
  return cachedJwtSecret;
}
```

### 7.5 Secret Rotation

```typescript
// Automatic rotation for database credentials
new secretsmanager.SecretRotation(this, 'DatabaseSecretRotation', {
  secret: database.secret!,
  application: secretsmanager.SecretRotationApplication.POSTGRES_ROTATION_SINGLE_USER,
  vpc,
  automaticallyAfter: cdk.Duration.days(30),
});
```

---

## 8. Monitoring & Observability

### 8.1 Observability Stack

```
┌──────────────────────────────────────────────────────┐
│                  CloudWatch Logs                      │
│  • Centralized log aggregation                        │
│  • Log groups per Lambda function                     │
│  • Retention: 7 days (dev), 30 days (prod)           │
│  • Log insights for querying                          │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│                 CloudWatch Metrics                    │
│  • Lambda invocations, errors, duration              │
│  • API Gateway request count, latency, 4xx/5xx       │
│  • RDS CPU, connections, IOPS                        │
│  • Redis CPU, memory, connections                    │
│  • Custom business metrics                            │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│                   AWS X-Ray                          │
│  • Distributed tracing                                │
│  • Service map visualization                          │
│  • Performance bottleneck identification             │
│  • Request flow tracking                              │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│               CloudWatch Dashboards                  │
│  • Real-time metrics visualization                    │
│  • Service health overview                            │
│  • Cost tracking                                      │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│               CloudWatch Alarms                      │
│  • Error rate thresholds                              │
│  • Latency thresholds                                 │
│  • Resource utilization                               │
│  • Cost anomalies                                     │
└──────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────┐
│            SNS + PagerDuty Integration               │
│  • Email notifications                                │
│  • Slack notifications                                │
│  • PagerDuty incidents (production only)             │
└──────────────────────────────────────────────────────┘
```

### 8.2 CloudWatch Dashboard

```typescript
// lib/stacks/monitoring-stack.ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { config, apiGateway, lambdaFunctions, database, redis } = props;

    // Main dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'MainDashboard', {
      dashboardName: `${config.environment}-edulens-dashboard`,
    });

    // API Gateway metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [
          apiGateway.metricCount({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
        ],
        right: [
          apiGateway.metric4XXError({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
          apiGateway.metric5XXError({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency (p50, p95, p99)',
        left: [
          apiGateway.metricLatency({ statistic: 'p50', period: cdk.Duration.minutes(5) }),
          apiGateway.metricLatency({ statistic: 'p95', period: cdk.Duration.minutes(5) }),
          apiGateway.metricLatency({ statistic: 'p99', period: cdk.Duration.minutes(5) }),
        ],
      })
    );

    // Lambda metrics
    const lambdaWidgets = lambdaFunctions.map((fn) =>
      new cloudwatch.GraphWidget({
        title: `Lambda: ${fn.functionName}`,
        left: [
          fn.metricInvocations({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
        ],
        right: [
          fn.metricErrors({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
          fn.metricThrottles({ statistic: 'sum', period: cdk.Duration.minutes(5) }),
        ],
      })
    );
    dashboard.addWidgets(...lambdaWidgets);

    // Database metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS CPU Utilization',
        left: [
          database.metricCPUUtilization({ period: cdk.Duration.minutes(5) }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'RDS Connections',
        left: [
          database.metricDatabaseConnections({ period: cdk.Duration.minutes(5) }),
        ],
      })
    );

    // Custom business metrics
    const testCompletionsMetric = new cloudwatch.Metric({
      namespace: 'EduLens',
      metricName: 'TestCompletions',
      statistic: 'sum',
      period: cdk.Duration.hours(1),
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Test Completions (hourly)',
        left: [testCompletionsMetric],
      })
    );
  }
}
```

### 8.3 CloudWatch Alarms

```typescript
// Critical alarms
const apiErrorAlarm = new cloudwatch.Alarm(this, 'APIErrorAlarm', {
  alarmName: `${config.environment}-api-errors`,
  metric: apiGateway.metric5XXError({
    statistic: 'sum',
    period: cdk.Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});

const databaseCPUAlarm = new cloudwatch.Alarm(this, 'DatabaseCPUAlarm', {
  alarmName: `${config.environment}-database-cpu`,
  metric: database.metricCPUUtilization({ period: cdk.Duration.minutes(5) }),
  threshold: 80,
  evaluationPeriods: 3,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});

// SNS topic for alarms
const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
  topicName: `${config.environment}-edulens-alarms`,
});

alarmTopic.addSubscription(
  new subscriptions.EmailSubscription(config.monitoring.alarmEmail)
);

if (config.monitoring.pagerDutyIntegrationKey) {
  // PagerDuty integration for production
  alarmTopic.addSubscription(
    new subscriptions.UrlSubscription(
      `https://events.pagerduty.com/integration/${config.monitoring.pagerDutyIntegrationKey}/enqueue`
    )
  );
}

// Add alarms to topic
apiErrorAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
databaseCPUAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
```

### 8.4 AWS X-Ray Tracing

```typescript
// Enable X-Ray in Lambda
const lambdaFunction = new lambda.Function(this, 'Function', {
  // ...
  tracing: lambda.Tracing.ACTIVE,
});

// X-Ray in API Gateway
const api = new apigateway.RestApi(this, 'API', {
  // ...
  deployOptions: {
    tracingEnabled: true,
  },
});
```

```typescript
// Backend code - add X-Ray segments
import { captureAWS } from 'aws-xray-sdk-core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Instrument AWS SDK
const dynamoClient = captureAWS(new DynamoDBClient({}));

// Custom subsegments
import * as AWSXRay from 'aws-xray-sdk-core';

export async function processTestResponse(sessionId: string, response: string) {
  const segment = AWSXRay.getSegment();
  const subsegment = segment.addNewSubsegment('calculateScore');

  try {
    // Your logic here
    const score = await calculateScore(response);
    subsegment.addAnnotation('score', score);
    return score;
  } catch (error) {
    subsegment.addError(error);
    throw error;
  } finally {
    subsegment.close();
  }
}
```

### 8.5 Custom Metrics

```typescript
// Backend code - publish custom metrics
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatchClient = new CloudWatchClient({ region: 'us-east-1' });

export async function publishMetric(
  metricName: string,
  value: number,
  unit: string = 'Count'
) {
  const command = new PutMetricDataCommand({
    Namespace: 'EduLens',
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
      },
    ],
  });

  await cloudwatchClient.send(command);
}

// Usage
await publishMetric('TestCompleted', 1);
await publishMetric('ChatMessageSent', 1);
await publishMetric('TestDuration', durationSeconds, 'Seconds');
```

---

## 9. Logging Strategy

### 9.1 Log Levels

```typescript
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

// Structured logging
export function log(level: LogLevel, message: string, context?: object) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    // Add trace ID from X-Ray
    traceId: process.env._X_AMZN_TRACE_ID,
  }));
}

// Usage
log(LogLevel.INFO, 'Test session created', {
  sessionId: 'abc123',
  studentId: 'student-456',
  testId: 'test-789',
});
```

### 9.2 Log Aggregation

```typescript
// CloudWatch Log Groups (auto-created by Lambda)
/aws/lambda/prod-edulens-api-createTest
/aws/lambda/prod-edulens-api-submitAnswer
/aws/lambda/prod-edulens-chat-sendMessage
// ... etc

// Retention configured in CDK
logRetention: logs.RetentionDays.ONE_WEEK, // dev
logRetention: logs.RetentionDays.ONE_MONTH, // production
```

### 9.3 Log Insights Queries

```sql
-- Top 10 slowest API calls
fields @timestamp, @message, @duration
| filter @type = "REPORT"
| sort @duration desc
| limit 10

-- Error rate by function
fields @timestamp, @message
| filter @type = "ERROR"
| stats count() as errorCount by @functionName
| sort errorCount desc

-- Chat messages by student
fields @timestamp, message, studentId
| filter eventType = "chat_message_sent"
| stats count() as messageCount by studentId
| sort messageCount desc
| limit 20

-- Test completion rate
fields @timestamp, sessionId, completed
| filter eventType = "test_session"
| stats count() as total, sum(completed) as completedCount
| eval completionRate = completedCount / total * 100
```

### 9.4 Centralized Error Tracking

Consider integrating Sentry for better error tracking:

```typescript
// Install Sentry SDK
import * as Sentry from '@sentry/serverless';

Sentry.AWSLambda.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT,
  tracesSampleRate: 0.1, // 10% of transactions
});

export const handler = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  // Your Lambda handler code
  try {
    // ...
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
});
```

---

## 10. Security & Compliance

### 10.1 Security Checklist

- [x] **Network Security**
  - VPC with private subnets for Lambda
  - Security groups with least privilege
  - VPC endpoints to avoid internet traffic
  - VPC Flow Logs enabled

- [x] **Data Encryption**
  - RDS encrypted at rest (KMS)
  - S3 buckets encrypted at rest
  - Redis encryption in transit and at rest
  - Secrets Manager for sensitive data

- [x] **IAM & Access Control**
  - Least privilege IAM roles
  - No hardcoded credentials
  - MFA for AWS Console access
  - Service-specific IAM roles

- [x] **API Security**
  - HTTPS only (TLS 1.2+)
  - JWT authentication
  - Rate limiting (API Gateway)
  - WAF rules for common attacks

- [x] **Logging & Monitoring**
  - CloudTrail enabled
  - VPC Flow Logs
  - CloudWatch alarms
  - X-Ray tracing

- [x] **Compliance**
  - GDPR compliance (data retention, right to be forgotten)
  - SOC 2 Type II (audit logging)
  - HIPAA compliance (if storing health data)

### 10.2 AWS WAF Rules

```typescript
// lib/stacks/security-stack.ts
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebACL',
  },
  rules: [
    // Rate limiting: max 2000 requests per 5 minutes per IP
    {
      name: 'RateLimit',
      priority: 1,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: 'IP',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimit',
      },
    },
    // AWS Managed Rules - Core Rule Set
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 2,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesCommonRuleSet',
      },
    },
    // AWS Managed Rules - Known Bad Inputs
    {
      name: 'AWSManagedRulesKnownBadInputsRuleSet',
      priority: 3,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
      },
    },
  ],
});

// Associate WAF with CloudFront
// (done in CloudFront distribution configuration)
```

### 10.3 Secrets Rotation

```bash
# Rotate database password
aws secretsmanager rotate-secret \
  --secret-id production/database/master-password \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:SecretsManagerRotation

# Rotate API keys
aws secretsmanager rotate-secret \
  --secret-id production/api/jwt-secret
```

### 10.4 Compliance & Audit

```typescript
// Enable CloudTrail for audit logging
const trail = new cloudtrail.Trail(this, 'CloudTrail', {
  trailName: `${config.environment}-edulens-trail`,
  sendToCloudWatchLogs: true,
  includeGlobalServiceEvents: true,
  isMultiRegionTrail: true,
});

// Enable AWS Config for compliance monitoring
const configRecorder = new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
  roleArn: configRole.roleArn,
  recordingGroup: {
    allSupported: true,
    includeGlobalResourceTypes: true,
  },
});
```

---

## 11. Disaster Recovery & Backup

### 11.1 RTO & RPO Targets

| Environment | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
|-------------|-------------------------------|--------------------------------|
| Development | 4 hours | 24 hours |
| Staging | 2 hours | 12 hours |
| Production | 1 hour | 15 minutes |

### 11.2 Backup Strategy

```typescript
// AWS Backup plan
const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
  backupPlanName: `${config.environment}-edulens-backup`,
  backupPlanRules: [
    new backup.BackupPlanRule({
      ruleName: 'DailyBackup',
      scheduleExpression: events.Schedule.cron({
        hour: '2',
        minute: '0',
      }),
      deleteAfter: cdk.Duration.days(config.database.aurora.backupRetentionDays),
    }),
  ],
});

// Add resources to backup
backupPlan.addSelection('DatabaseBackup', {
  resources: [
    backup.BackupResource.fromRdsDatabaseCluster(database),
  ],
});
```

### 11.3 Multi-Region Strategy (Production)

For production high availability:

```typescript
// Primary region: us-east-1
// Secondary region: us-west-2

// Cross-region RDS replication
const replicaCluster = new rds.DatabaseClusterFromSnapshot(this, 'ReplicaCluster', {
  snapshotIdentifier: primaryCluster.snapshotIdentifier,
  engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_15_4 }),
  vpc: replicaVpc,
  // ... other config
});

// S3 cross-region replication
bucket.addLifecycleRule({
  id: 'CrossRegionReplication',
  enabled: true,
  transitions: [{
    storageClass: s3.StorageClass.GLACIER,
    transitionAfter: cdk.Duration.days(90),
  }],
});
```

### 11.4 Disaster Recovery Runbook

```markdown
# Disaster Recovery Procedure

## Scenario 1: Database Failure

1. **Detect**: CloudWatch alarm triggers
2. **Assess**: Check RDS console for cluster status
3. **Restore**:
   ```bash
   aws rds restore-db-cluster-from-snapshot \
     --db-cluster-identifier prod-edulens-db-restored \
     --snapshot-identifier <latest-snapshot> \
     --engine aurora-postgresql
   ```
4. **Update DNS**: Point application to restored cluster
5. **Verify**: Run smoke tests
6. **Communicate**: Notify users of resolution

## Scenario 2: Region Failure (us-east-1)

1. **Failover to us-west-2**:
   ```bash
   # Update Route 53 to point to us-west-2
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456 \
     --change-batch file://failover.json
   ```
2. **Promote replica database** to primary
3. **Deploy Lambda functions** in us-west-2
4. **Verify** all services operational
5. **Monitor** closely for 24 hours

## Scenario 3: Data Corruption

1. **Identify** corruption timeframe
2. **Point-in-time recovery**:
   ```bash
   aws rds restore-db-cluster-to-point-in-time \
     --source-db-cluster-identifier prod-edulens-db \
     --db-cluster-identifier prod-edulens-db-restored \
     --restore-to-time 2026-03-13T10:00:00Z
   ```
3. **Validate** data integrity
4. **Cutover** to restored database
```

---

## 12. Cost Optimization

### 12.1 Cost Breakdown (Production - 100 users)

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| **Compute** | | |
| Lambda (API) | 500K invocations, 512MB, 3s avg | $15 |
| Lambda (Background) | 100K invocations, 1GB, 10s avg | $8 |
| Lambda (Chat/SSE) | 50K invocations, 1GB, 30s avg | $12 |
| **Data** | | |
| RDS Aurora Serverless v2 | 2 ACU avg, 20GB storage | $87 |
| ElastiCache Redis | cache.r7g.large, 2 nodes | $118 |
| DynamoDB | 10M reads, 1M writes | $3 |
| **Storage** | | |
| S3 (frontend + assets) | 50GB storage, 1TB transfer | $23 |
| **Networking** | | |
| CloudFront | 1TB data transfer | $85 |
| NAT Gateway | 3 gateways, 100GB data | $105 |
| VPC Endpoints | 3 endpoints | $21 |
| **Other** | | |
| Anthropic Claude API | 1M tokens (optimized) | $60 |
| Secrets Manager | 10 secrets | $4 |
| CloudWatch Logs | 50GB ingestion | $25 |
| **Total** | | **~$566/month** |

### 12.2 Cost Optimization Strategies

#### 1. Use VPC Endpoints (Save ~$90/month)

```typescript
// Gateway endpoints are FREE
vpc.addGatewayEndpoint('S3Endpoint', {
  service: ec2.GatewayVpcEndpointAwsService.S3,
});

vpc.addGatewayEndpoint('DynamoDBEndpoint', {
  service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
});

// Reduces NAT Gateway data transfer costs significantly
```

#### 2. Right-Size Lambda Memory

```bash
# Use AWS Lambda Power Tuning
# https://github.com/alexcasalboni/aws-lambda-power-tuning

# Find optimal memory configuration
# Often 512MB is sufficient (cheaper than 1024MB)
```

#### 3. ElastiCache Reserved Instances (Save 30-50%)

```bash
# Purchase 1-year reserved instance
aws elasticache purchase-reserved-cache-nodes-offering \
  --reserved-cache-nodes-offering-id <offering-id> \
  --cache-node-count 2

# Savings: ~$40/month
```

#### 4. Aurora Serverless v2 Auto-Pause (Dev/Staging)

```typescript
database: {
  aurora: {
    minCapacity: 0.5,
    maxCapacity: 2,
    autoPause: true, // Pause after 5 minutes of inactivity
  },
}

// Dev environment cost: ~$10/month (vs $87 always-on)
```

#### 5. CloudWatch Logs Retention

```typescript
// Reduce retention for non-critical logs
logRetention: logs.RetentionDays.THREE_DAYS, // dev
logRetention: logs.RetentionDays.ONE_WEEK, // production (non-critical)
logRetention: logs.RetentionDays.ONE_MONTH, // production (critical)

// Savings: ~$15/month
```

#### 6. S3 Lifecycle Policies

```typescript
bucket.addLifecycleRule({
  id: 'ArchiveOldAssets',
  enabled: true,
  transitions: [
    {
      storageClass: s3.StorageClass.INTELLIGENT_TIERING,
      transitionAfter: cdk.Duration.days(30),
    },
    {
      storageClass: s3.StorageClass.GLACIER,
      transitionAfter: cdk.Duration.days(90),
    },
  ],
  expirations: [
    {
      expiredObjectDeleteMarker: true,
    },
  ],
});

// Savings: ~$5-10/month
```

### 12.3 Cost Monitoring

```typescript
// CloudWatch Alarm for cost anomalies
const costAlarm = new cloudwatch.Alarm(this, 'CostAnomaly', {
  alarmName: 'high-cost-anomaly',
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Billing',
    metricName: 'EstimatedCharges',
    dimensions: {
      Currency: 'USD',
    },
    statistic: 'Maximum',
    period: cdk.Duration.hours(6),
  }),
  threshold: 1000, // Alert if daily cost > $1000
  evaluationPeriods: 1,
});

costAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
```

```bash
# Weekly cost report
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-08 \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

---

## 13. Deployment Process

### 13.1 Deployment Checklist

**Pre-Deployment:**
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review approved
- [ ] Security scan completed (Snyk, npm audit)
- [ ] Database migrations reviewed
- [ ] Rollback plan documented
- [ ] Stakeholders notified

**Deployment:**
- [ ] Deploy infrastructure changes (CDK)
- [ ] Run database migrations
- [ ] Deploy backend (Lambda)
- [ ] Deploy frontend (S3 + CloudFront)
- [ ] Run smoke tests
- [ ] Monitor for 15 minutes

**Post-Deployment:**
- [ ] Verify key metrics (error rate, latency)
- [ ] Check logs for errors
- [ ] Test critical user flows
- [ ] Update documentation
- [ ] Close deployment ticket

### 13.2 Database Migration Strategy

```bash
# Use Prisma migrations
cd backend/packages/shared/database

# Create migration
npx prisma migrate dev --name add_chat_sessions

# Review migration SQL
cat prisma/migrations/20260313_add_chat_sessions/migration.sql

# Apply to staging
npx prisma migrate deploy --schema ./prisma/schema.prisma

# Verify
npx prisma migrate status

# Apply to production (during maintenance window)
npx prisma migrate deploy
```

### 13.3 Rollback Procedure

```bash
# Rollback backend (Lambda)
aws lambda update-alias \
  --function-name prod-edulens-api \
  --name live \
  --function-version <previous-version>

# Rollback frontend (CloudFront)
aws s3 sync s3://prod-edulens-frontend-backup s3://prod-edulens-frontend --delete
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"

# Rollback database (restore from backup)
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier prod-edulens-db \
  --db-cluster-identifier prod-edulens-db-rollback \
  --restore-to-time 2026-03-13T10:00:00Z

# Rollback infrastructure (CDK)
cd infrastructure
git checkout <previous-commit>
cdk deploy --all --context environment=production
```

---

## 14. Runbooks & Operations

### 14.1 Common Operations

#### Scaling ElastiCache

```bash
# Scale up Redis node type
aws elasticache modify-cache-cluster \
  --cache-cluster-id prod-edulens-redis \
  --cache-node-type cache.r7g.xlarge \
  --apply-immediately

# Add read replica
aws elasticache increase-replica-count \
  --replication-group-id prod-edulens-redis \
  --new-replica-count 3 \
  --apply-immediately
```

#### Scaling Aurora

```typescript
// Update CDK config
database: {
  aurora: {
    minCapacity: 4, // Was 2
    maxCapacity: 32, // Was 16
  },
}

// Deploy
cdk deploy EduLens-Database-production
```

#### Clearing Redis Cache

```bash
# Connect to Redis via bastion host
aws ssm start-session --target <bastion-instance-id>

# Inside bastion
redis-cli -h prod-edulens-redis.xxxxxx.cache.amazonaws.com

# Clear all keys (DANGER!)
FLUSHALL

# Clear specific pattern
SCAN 0 MATCH session:* COUNT 100
# Then delete individually
```

#### Deploying Hotfix

```bash
# Create hotfix branch
git checkout -b hotfix/critical-bug main

# Make fix
git commit -m "fix: resolve critical bug"

# Deploy directly to production (skip staging)
git push origin hotfix/critical-bug
gh workflow run deploy-production.yml --ref hotfix/critical-bug

# After verification, merge to main
git checkout main
git merge hotfix/critical-bug
git push origin main
```

### 14.2 Troubleshooting Guide

#### High Lambda Error Rate

1. Check CloudWatch Logs:
   ```bash
   aws logs tail /aws/lambda/prod-edulens-api --follow
   ```

2. Check X-Ray traces:
   ```bash
   aws xray get-trace-summaries \
     --start-time $(date -u -d '1 hour ago' +%s) \
     --end-time $(date -u +%s) \
     --filter-expression 'error = true'
   ```

3. Check environment variables and secrets
4. Verify database connectivity
5. Check IAM permissions

#### Database Connection Issues

1. Check security group rules
2. Verify RDS cluster status:
   ```bash
   aws rds describe-db-clusters \
     --db-cluster-identifier prod-edulens-db
   ```
3. Check connection count:
   ```bash
   # In psql
   SELECT count(*) FROM pg_stat_activity;
   ```
4. Increase max connections if needed

#### High Latency

1. Check API Gateway metrics
2. Check Lambda cold starts (provision concurrency)
3. Check database query performance:
   ```sql
   -- Slow queries
   SELECT * FROM pg_stat_statements
   ORDER BY total_time DESC
   LIMIT 10;
   ```
4. Check Redis hit rate
5. Enable X-Ray tracing to identify bottlenecks

---

## Summary

This deployment architecture provides:

✅ **Infrastructure as Code**: AWS CDK (TypeScript) for reproducible deployments
✅ **Multi-Environment**: Dev/Staging/Production with consistent structure
✅ **CI/CD**: GitHub Actions with automated testing and deployment
✅ **Security**: VPC, encryption, secrets management, WAF, IAM least privilege
✅ **Observability**: CloudWatch (logs, metrics, dashboards), X-Ray tracing, alarms
✅ **Cost Optimization**: VPC endpoints, auto-scaling, right-sizing, monitoring
✅ **Disaster Recovery**: Automated backups, point-in-time recovery, runbooks
✅ **Compliance**: CloudTrail, AWS Config, audit logging

**Estimated Costs:**
- Development: ~$80/month
- Staging: ~$200/month
- Production (100 users): ~$566/month
- Production (1,000 users): ~$1,200/month

**Deployment Time:**
- Infrastructure: ~15 minutes
- Backend: ~5 minutes
- Frontend: ~3 minutes
- Total: ~25 minutes

**Next Steps:**
1. Review deployment architecture
2. Set up AWS accounts (dev, staging, production)
3. Configure GitHub Actions secrets
4. Deploy infrastructure to dev environment
5. Test deployment pipeline
6. Document custom runbooks

---

**Document Version:** 1.0
**Last Updated:** March 2026