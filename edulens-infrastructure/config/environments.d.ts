/**
 * Environment configurations for different deployment stages
 */
export interface EnvironmentConfig {
    account: string;
    region: string;
    stage: 'dev' | 'staging' | 'prod';
    vpcCidr: string;
    maxAzs: number;
    natGateways: number;
    rds: {
        minCapacity: number;
        maxCapacity: number;
        autoPauseMinutes?: number;
    };
    redis: {
        nodeType: string;
        numCacheNodes: number;
    };
    lambda: {
        timeout: number;
        memorySize: number;
    };
    enableXRay: boolean;
    logRetentionDays: number;
    tags: Record<string, string>;
}
export declare const devConfig: EnvironmentConfig;
export declare const stagingConfig: EnvironmentConfig;
export declare const prodConfig: EnvironmentConfig;
export declare function getConfig(stage: string): EnvironmentConfig;
