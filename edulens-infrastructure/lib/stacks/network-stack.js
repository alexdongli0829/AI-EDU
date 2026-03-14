"use strict";
/**
 * Network Stack
 *
 * Creates VPC with public and private subnets, NAT Gateway, and security groups
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
exports.NetworkStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
class NetworkStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        // Create VPC
        this.vpc = new ec2.Vpc(this, 'EduLensVpc', {
            ipAddresses: ec2.IpAddresses.cidr(config.vpcCidr),
            maxAzs: config.maxAzs,
            natGateways: config.natGateways,
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
            // Enable DNS
            enableDnsHostnames: true,
            enableDnsSupport: true,
        });
        // Tag subnets
        cdk.Tags.of(this.vpc).add('Name', `edulens-vpc-${config.stage}`);
        // VPC Flow Logs (production only)
        if (config.stage === 'prod') {
            this.vpc.addFlowLog('FlowLog', {
                destination: ec2.FlowLogDestination.toCloudWatchLogs(),
                trafficType: ec2.FlowLogTrafficType.ALL,
            });
        }
        // Security Group for Lambda functions
        this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for Lambda functions',
            allowAllOutbound: true,
        });
        cdk.Tags.of(this.lambdaSecurityGroup).add('Name', `edulens-lambda-sg-${config.stage}`);
        // Security Group for RDS Aurora
        this.rdsSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for RDS Aurora',
            allowAllOutbound: false,
        });
        // Allow Lambda to access RDS
        this.rdsSecurityGroup.addIngressRule(this.lambdaSecurityGroup, ec2.Port.tcp(5432), 'Allow PostgreSQL access from Lambda');
        cdk.Tags.of(this.rdsSecurityGroup).add('Name', `edulens-rds-sg-${config.stage}`);
        // Security Group for ElastiCache Redis
        this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for ElastiCache Redis',
            allowAllOutbound: false,
        });
        // Allow Lambda to access Redis
        this.redisSecurityGroup.addIngressRule(this.lambdaSecurityGroup, ec2.Port.tcp(6379), 'Allow Redis access from Lambda');
        cdk.Tags.of(this.redisSecurityGroup).add('Name', `edulens-redis-sg-${config.stage}`);
        // Security Group for Application Load Balancer
        this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for ALB (SSE streaming)',
            allowAllOutbound: true,
        });
        // Allow HTTP and HTTPS from anywhere
        this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from internet');
        this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS from internet');
        cdk.Tags.of(this.albSecurityGroup).add('Name', `edulens-alb-sg-${config.stage}`);
        // Allow ALB to invoke Lambda
        this.lambdaSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.allTraffic(), 'Allow traffic from ALB');
        // VPC Endpoints for AWS services (cost optimization - avoid NAT charges)
        if (config.stage === 'prod') {
            // S3 Gateway Endpoint (free)
            this.vpc.addGatewayEndpoint('S3Endpoint', {
                service: ec2.GatewayVpcEndpointAwsService.S3,
            });
            // DynamoDB Gateway Endpoint (free)
            this.vpc.addGatewayEndpoint('DynamoDbEndpoint', {
                service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
            });
            // Secrets Manager Interface Endpoint
            this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
                service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
                privateDnsEnabled: true,
            });
        }
        // Outputs
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID',
            exportName: `edulens-vpc-id-${config.stage}`,
        });
        new cdk.CfnOutput(this, 'VpcCidr', {
            value: this.vpc.vpcCidrBlock,
            description: 'VPC CIDR Block',
        });
        new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
            value: this.lambdaSecurityGroup.securityGroupId,
            description: 'Lambda Security Group ID',
            exportName: `edulens-lambda-sg-${config.stage}`,
        });
    }
}
exports.NetworkStack = NetworkStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29yay1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5ldHdvcmstc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx5REFBMkM7QUFRM0MsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFPekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXpCLGFBQWE7UUFDYixJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3pDLFdBQVcsRUFBRSxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQ2pELE1BQU0sRUFBRSxNQUFNLENBQUMsTUFBTTtZQUNyQixXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7WUFFL0IsbUJBQW1CLEVBQUU7Z0JBQ25CO29CQUNFLElBQUksRUFBRSxRQUFRO29CQUNkLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07b0JBQ2pDLFFBQVEsRUFBRSxFQUFFO2lCQUNiO2dCQUNEO29CQUNFLElBQUksRUFBRSxTQUFTO29CQUNmLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtvQkFDOUMsUUFBUSxFQUFFLEVBQUU7aUJBQ2I7Z0JBQ0Q7b0JBQ0UsSUFBSSxFQUFFLFVBQVU7b0JBQ2hCLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLGdCQUFnQjtvQkFDM0MsUUFBUSxFQUFFLEVBQUU7aUJBQ2I7YUFDRjtZQUVELGFBQWE7WUFDYixrQkFBa0IsRUFB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aUJBQWlCLEVBQUUsSUFBSTthQUN4QixDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQy9CLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUs7WUFDckIsV0FBVyxFQUFFLFFBQVE7WUFDckIsVUFBVSxFQUFFLGtCQUFrQixNQUFNLENBQUMsS0FBSyxFQUFFO1NBQzdDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ2pDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVk7WUFDNUIsV0FBVyxFQUFFLGdCQUFnQjtTQUM5QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsZUFBZTtZQUMvQyxXQUFXLEVBQUUsMEJBQTBCO1lBQ3ZDLFVBQVUsRUFBRSxxQkFBcUIsTUFBTSxDQUFDLEtBQUssRUFBRTtTQUNoRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEvSkQsb0NBK0pDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBOZXR3b3JrIFN0YWNrXG4gKlxuICogQ3JlYXRlcyBWUEMgd2l0aCBwdWJsaWMgYW5kIHByaXZhdGUgc3VibmV0cywgTkFUIEdhdGV3YXksIGFuZCBzZWN1cml0eSBncm91cHNcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE5ldHdvcmtTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgTmV0d29ya1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHZwYzogZWMyLlZwYztcbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYVNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBwdWJsaWMgcmVhZG9ubHkgcmRzU2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXA7XG4gIHB1YmxpYyByZWFkb25seSByZWRpc1NlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBwdWJsaWMgcmVhZG9ubHkgYWxiU2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE5ldHdvcmtTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IGNvbmZpZyB9ID0gcHJvcHM7XG5cbiAgICAvLyBDcmVhdGUgVlBDXG4gICAgdGhpcy52cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnRWR1TGVuc1ZwYycsIHtcbiAgICAgIGlwQWRkcmVzc2VzOiBlYzIuSXBBZGRyZXNzZXMuY2lkcihjb25maWcudnBjQ2lkciksXG4gICAgICBtYXhBenM6IGNvbmZpZy5tYXhBenMsXG4gICAgICBuYXRHYXRld2F5czogY29uZmlnLm5hdEdhdGV3YXlzLFxuXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnUHVibGljJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ0lzb2xhdGVkJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG5cbiAgICAgIC8vIEVuYWJsZSBETlNcbiAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBUYWcgc3VibmV0c1xuICAgIGNkay5UYWdzLm9mKHRoaXMudnBjKS5hZGQoJ05hbWUnLCBgZWR1bGVucy12cGMtJHtjb25maWcuc3RhZ2V9YCk7XG5cbiAgICAvLyBWUEMgRmxvdyBMb2dzIChwcm9kdWN0aW9uIG9ubHkpXG4gICAgaWYgKGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgICB0aGlzLnZwYy5hZGRGbG93TG9nKCdGbG93TG9nJywge1xuICAgICAgICBkZXN0aW5hdGlvbjogZWMyLkZsb3dMb2dEZXN0aW5hdGlvbi50b0Nsb3VkV2F0Y2hMb2dzKCksXG4gICAgICAgIHRyYWZmaWNUeXBlOiBlYzIuRmxvd0xvZ1RyYWZmaWNUeXBlLkFMTCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zXG4gICAgdGhpcy5sYW1iZGFTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdMYW1iZGFTZWN1cml0eUdyb3VwJywge1xuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIExhbWJkYSBmdW5jdGlvbnMnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMubGFtYmRhU2VjdXJpdHlHcm91cCkuYWRkKCdOYW1lJywgYGVkdWxlbnMtbGFtYmRhLXNnLSR7Y29uZmlnLnN0YWdlfWApO1xuXG4gICAgLy8gU2VjdXJpdHkgR3JvdXAgZm9yIFJEUyBBdXJvcmFcbiAgICB0aGlzLnJkc1NlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1Jkc1NlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgUkRTIEF1cm9yYScsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIEFsbG93IExhbWJkYSB0byBhY2Nlc3MgUkRTXG4gICAgdGhpcy5yZHNTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgdGhpcy5sYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgZWMyLlBvcnQudGNwKDU0MzIpLFxuICAgICAgJ0FsbG93IFBvc3RncmVTUUwgYWNjZXNzIGZyb20gTGFtYmRhJ1xuICAgICk7XG5cbiAgICBjZGsuVGFncy5vZih0aGlzLnJkc1NlY3VyaXR5R3JvdXApLmFkZCgnTmFtZScsIGBlZHVsZW5zLXJkcy1zZy0ke2NvbmZpZy5zdGFnZX1gKTtcblxuICAgIC8vIFNlY3VyaXR5IEdyb3VwIGZvciBFbGFzdGlDYWNoZSBSZWRpc1xuICAgIHRoaXMucmVkaXNTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdSZWRpc1NlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgRWxhc3RpQ2FjaGUgUmVkaXMnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBMYW1iZGEgdG8gYWNjZXNzIFJlZGlzXG4gICAgdGhpcy5yZWRpc1NlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICB0aGlzLmxhbWJkYVNlY3VyaXR5R3JvdXAsXG4gICAgICBlYzIuUG9ydC50Y3AoNjM3OSksXG4gICAgICAnQWxsb3cgUmVkaXMgYWNjZXNzIGZyb20gTGFtYmRhJ1xuICAgICk7XG5cbiAgICBjZGsuVGFncy5vZih0aGlzLnJlZGlzU2VjdXJpdHlHcm91cCkuYWRkKCdOYW1lJywgYGVkdWxlbnMtcmVkaXMtc2ctJHtjb25maWcuc3RhZ2V9YCk7XG5cbiAgICAvLyBTZWN1cml0eSBHcm91cCBmb3IgQXBwbGljYXRpb24gTG9hZCBCYWxhbmNlclxuICAgIHRoaXMuYWxiU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnQWxiU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBBTEIgKFNTRSBzdHJlYW1pbmcpJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBIVFRQIGFuZCBIVFRQUyBmcm9tIGFueXdoZXJlXG4gICAgdGhpcy5hbGJTZWN1cml0eUdyb3VwLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgZWMyLlBvcnQudGNwKDgwKSxcbiAgICAgICdBbGxvdyBIVFRQIGZyb20gaW50ZXJuZXQnXG4gICAgKTtcblxuICAgIHRoaXMuYWxiU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmFueUlwdjQoKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg0NDMpLFxuICAgICAgJ0FsbG93IEhUVFBTIGZyb20gaW50ZXJuZXQnXG4gICAgKTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMuYWxiU2VjdXJpdHlHcm91cCkuYWRkKCdOYW1lJywgYGVkdWxlbnMtYWxiLXNnLSR7Y29uZmlnLnN0YWdlfWApO1xuXG4gICAgLy8gQWxsb3cgQUxCIHRvIGludm9rZSBMYW1iZGFcbiAgICB0aGlzLmxhbWJkYVNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICB0aGlzLmFsYlNlY3VyaXR5R3JvdXAsXG4gICAgICBlYzIuUG9ydC5hbGxUcmFmZmljKCksXG4gICAgICAnQWxsb3cgdHJhZmZpYyBmcm9tIEFMQidcbiAgICApO1xuXG4gICAgLy8gVlBDIEVuZHBvaW50cyBmb3IgQVdTIHNlcnZpY2VzIChjb3N0IG9wdGltaXphdGlvbiAtIGF2b2lkIE5BVCBjaGFyZ2VzKVxuICAgIGlmIChjb25maWcuc3RhZ2UgPT09ICdwcm9kJykge1xuICAgICAgLy8gUzMgR2F0ZXdheSBFbmRwb2ludCAoZnJlZSlcbiAgICAgIHRoaXMudnBjLmFkZEdhdGV3YXlFbmRwb2ludCgnUzNFbmRwb2ludCcsIHtcbiAgICAgICAgc2VydmljZTogZWMyLkdhdGV3YXlWcGNFbmRwb2ludEF3c1NlcnZpY2UuUzMsXG4gICAgICB9KTtcblxuICAgICAgLy8gRHluYW1vREIgR2F0ZXdheSBFbmRwb2ludCAoZnJlZSlcbiAgICAgIHRoaXMudnBjLmFkZEdhdGV3YXlFbmRwb2ludCgnRHluYW1vRGJFbmRwb2ludCcsIHtcbiAgICAgICAgc2VydmljZTogZWMyLkdhdGV3YXlWcGNFbmRwb2ludEF3c1NlcnZpY2UuRFlOQU1PREIsXG4gICAgICB9KTtcblxuICAgICAgLy8gU2VjcmV0cyBNYW5hZ2VyIEludGVyZmFjZSBFbmRwb2ludFxuICAgICAgdGhpcy52cGMuYWRkSW50ZXJmYWNlRW5kcG9pbnQoJ1NlY3JldHNNYW5hZ2VyRW5kcG9pbnQnLCB7XG4gICAgICAgIHNlcnZpY2U6IGVjMi5JbnRlcmZhY2VWcGNFbmRwb2ludEF3c1NlcnZpY2UuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgICBwcml2YXRlRG5zRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMudnBjSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBJRCcsXG4gICAgICBleHBvcnROYW1lOiBgZWR1bGVucy12cGMtaWQtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWcGNDaWRyJywge1xuICAgICAgdmFsdWU6IHRoaXMudnBjLnZwY0NpZHJCbG9jayxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVlBDIENJRFIgQmxvY2snLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0xhbWJkYVNlY3VyaXR5R3JvdXBJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmxhbWJkYVNlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkLFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgU2VjdXJpdHkgR3JvdXAgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYGVkdWxlbnMtbGFtYmRhLXNnLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==