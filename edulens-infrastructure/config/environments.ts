/**
 * Environment configurations for different deployment stages
 */

export interface EnvironmentConfig {
  account: string;
  region: string;
  stage: 'dev' | 'staging' | 'prod';

  // VPC Configuration
  vpcCidr: string;
  maxAzs: number;
  natGateways: number;

  // Database Configuration
  rds: {
    minCapacity: number;
    maxCapacity: number;
    autoPauseMinutes?: number;
  };

  redis: {
    nodeType: string;
    numCacheNodes: number;
  };

  // Lambda Configuration
  lambda: {
    timeout: number;
    memorySize: number;
  };

  // Monitoring
  enableXRay: boolean;
  logRetentionDays: number;

  // Tags
  tags: Record<string, string>;
}

// Development environment
export const devConfig: EnvironmentConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '163629398585',
  // TARGET_REGION allows cross-region deployments from a server in a different region.
  // On a server in ap-southeast-2, CDK_DEFAULT_REGION is used automatically.
  region: process.env.TARGET_REGION || process.env.CDK_DEFAULT_REGION || 'us-west-2',
  stage: 'dev',

  vpcCidr: '10.0.0.0/16',
  maxAzs: 2,
  natGateways: 1, // Single NAT for cost savings in dev

  rds: {
    minCapacity: 0.5,
    maxCapacity: 2,
    autoPauseMinutes: 10, // Auto-pause after 10 minutes of inactivity
  },

  redis: {
    nodeType: 'cache.t4g.micro',
    numCacheNodes: 1,
  },

  lambda: {
    timeout: 30,
    memorySize: 512,
  },

  enableXRay: true,
  logRetentionDays: 7,

  tags: {
    Environment: 'dev',
    Project: 'EduLens',
    ManagedBy: 'CDK',
  },
};

// Staging environment
export const stagingConfig: EnvironmentConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '',
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  stage: 'staging',

  vpcCidr: '10.1.0.0/16',
  maxAzs: 2,
  natGateways: 2, // One NAT per AZ for HA

  rds: {
    minCapacity: 1,
    maxCapacity: 4,
    // No auto-pause in staging
  },

  redis: {
    nodeType: 'cache.t4g.small',
    numCacheNodes: 1,
  },

  lambda: {
    timeout: 30,
    memorySize: 512,
  },

  enableXRay: true,
  logRetentionDays: 30,

  tags: {
    Environment: 'staging',
    Project: 'EduLens',
    ManagedBy: 'CDK',
  },
};

// Production environment
export const prodConfig: EnvironmentConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '',
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  stage: 'prod',

  vpcCidr: '10.2.0.0/16',
  maxAzs: 3, // Three AZs for HA
  natGateways: 3, // One NAT per AZ

  rds: {
    minCapacity: 2,
    maxCapacity: 16,
    // No auto-pause in production
  },

  redis: {
    nodeType: 'cache.r7g.large',
    numCacheNodes: 2, // Multi-node for HA
  },

  lambda: {
    timeout: 30,
    memorySize: 1024,
  },

  enableXRay: true,
  logRetentionDays: 90,

  tags: {
    Environment: 'prod',
    Project: 'EduLens',
    ManagedBy: 'CDK',
    CostCenter: 'Engineering',
  },
};

// Get config based on stage
export function getConfig(stage: string): EnvironmentConfig {
  switch (stage) {
    case 'dev':
      return devConfig;
    case 'staging':
      return stagingConfig;
    case 'prod':
      return prodConfig;
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}
