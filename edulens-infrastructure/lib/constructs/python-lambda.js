"use strict";
/**
 * Python Lambda Construct
 *
 * Reusable construct for creating Python Lambda functions with common configuration
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
exports.PythonLambda = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class PythonLambda extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const { config, functionName, handler, codePath, description, vpc, securityGroup, auroraSecret, redisEndpoint, environment = {}, timeout, memorySize, } = props;
        // Create log group
        const logGroup = new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/lambda/${functionName}`,
            retention: config.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create Lambda function
        this.function = new lambda.Function(this, 'Function', {
            functionName,
            runtime: lambda.Runtime.PYTHON_3_12,
            handler,
            code: lambda.Code.fromAsset(codePath, {
                exclude: [
                    'venv',
                    '.venv',
                    '__pycache__',
                    '*.pyc',
                    '.pytest_cache',
                    'tests',
                    '*.md',
                    'requirements-dev.txt',
                    '.git',
                    '.env',
                    '.env.local',
                ],
            }),
            description,
            // VPC configuration
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [securityGroup],
            // Resource configuration
            timeout: timeout || cdk.Duration.seconds(config.lambda.timeout),
            memorySize: memorySize || config.lambda.memorySize,
            // Environment variables
            environment: {
                PYTHONPATH: '/var/task:/var/runtime',
                STAGE: config.stage,
                DB_SECRET_ARN: auroraSecret.secretArn, // Lambda will read secret and construct connection string
                ...(redisEndpoint && {
                    REDIS_URL: `redis://${redisEndpoint}:6379`,
                }),
                LOG_LEVEL: 'info',
                ...environment,
            },
            // X-Ray tracing
            tracing: config.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
            // Reserved concurrency (production only)
            ...(config.stage === 'prod' && {
                reservedConcurrentExecutions: 50,
            }),
            // Log group
            logGroup,
        });
        // Note: Database secret access is granted in the Lambda stack to avoid cyclic dependencies
        // Add tags
        cdk.Tags.of(this.function).add('Service', functionName.split('-')[1] || 'unknown');
    }
}
exports.PythonLambda = PythonLambda;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHl0aG9uLWxhbWJkYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInB5dGhvbi1sYW1iZGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLDJEQUE2QztBQUU3QywyQ0FBdUM7QUFrQnZDLE1BQWEsWUFBYSxTQUFRLHNCQUFTO0lBR3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQ0osTUFBTSxFQUNOLFlBQVksRUFDWixPQUFPLEVBQ1AsUUFBUSxFQUNSLFdBQVcsRUFDWCxHQUFHLEVBQ0gsYUFBYSxFQUNiLFlBQVksRUFDWixhQUFhLEVBQ2IsV0FBVyxHQUFHLEVBQUUsRUFDaEIsT0FBTyxFQUNQLFVBQVUsR0FDWCxHQUFHLEtBQUssQ0FBQztRQUVWLG1CQUFtQjtRQUNuQixNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNuRCxZQUFZLEVBQUUsZUFBZSxZQUFZLEVBQUU7WUFDM0MsU0FBUyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7WUFDbEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNwRCxZQUFZO1lBQ1osT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPO1lBQ1AsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRTtnQkFDcEMsT0FBTyxFQUFFO29CQUNQLE1BQU07b0JBQ04sT0FBTztvQkFDUCxhQUFhO29CQUNiLE9BQU87b0JBQ1AsZUFBZTtvQkFDZixPQUFPO29CQUNQLE1BQU07b0JBQ04sc0JBQXNCO29CQUN0QixNQUFNO29CQUNOLE1BQU07b0JBQ04sWUFBWTtpQkFDYjthQUNGLENBQUM7WUFDRixXQUFXO1lBRVgsb0JBQW9CO1lBQ3BCLEdBQUc7WUFDSCxVQUFVLEVBQUU7Z0JBQ1YsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CO2FBQy9DO1lBQ0QsY0FBYyxFQUFFLENBQUMsYUFBYSxDQUFDO1lBRS9CLHlCQUF5QjtZQUN6QixPQUFPLEVBQUUsT0FBTyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQy9ELFVBQVUsRUFBRSxVQUFVLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVO1lBRWxELHdCQUF3QjtZQUN4QixXQUFXLEVBQUU7Z0JBQ1gsVUFBVSxFQUFFLHdCQUF3QjtnQkFDcEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLO2dCQUNuQixhQUFhLEVBQUUsWUFBWSxDQUFDLFNBQVMsRUFBRSwwREFBMEQ7Z0JBQ2pHLEdBQUcsQ0FBQyxhQUFhLElBQUk7b0JBQ25CLFNBQVMsRUFBRSxXQUFXLGFBQWEsT0FBTztpQkFDM0MsQ0FBQztnQkFDRixTQUFTLEVBQUUsTUFBTTtnQkFDakIsR0FBRyxXQUFXO2FBQ2Y7WUFFRCxnQkFBZ0I7WUFDaEIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVE7WUFFNUUseUNBQXlDO1lBQ3pDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxLQUFLLE1BQU0sSUFBSTtnQkFDN0IsNEJBQTRCLEVBQUUsRUFBRTthQUNqQyxDQUFDO1lBRUYsWUFBWTtZQUNaLFFBQVE7U0FDVCxDQUFDLENBQUM7UUFFSCwyRkFBMkY7UUFFM0YsV0FBVztRQUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLENBQUM7SUFDckYsQ0FBQztDQUNGO0FBMUZELG9DQTBGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHl0aG9uIExhbWJkYSBDb25zdHJ1Y3RcbiAqXG4gKiBSZXVzYWJsZSBjb25zdHJ1Y3QgZm9yIGNyZWF0aW5nIFB5dGhvbiBMYW1iZGEgZnVuY3Rpb25zIHdpdGggY29tbW9uIGNvbmZpZ3VyYXRpb25cbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFB5dGhvbkxhbWJkYVByb3BzIHtcbiAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgZnVuY3Rpb25OYW1lOiBzdHJpbmc7XG4gIGhhbmRsZXI6IHN0cmluZztcbiAgY29kZVBhdGg6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgdnBjOiBlYzIuVnBjO1xuICBzZWN1cml0eUdyb3VwOiBlYzIuU2VjdXJpdHlHcm91cDtcbiAgYXVyb3JhU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0O1xuICByZWRpc0VuZHBvaW50Pzogc3RyaW5nO1xuICBlbnZpcm9ubWVudD86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIHRpbWVvdXQ/OiBjZGsuRHVyYXRpb247XG4gIG1lbW9yeVNpemU/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBQeXRob25MYW1iZGEgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgZnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUHl0aG9uTGFtYmRhUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgY29uc3Qge1xuICAgICAgY29uZmlnLFxuICAgICAgZnVuY3Rpb25OYW1lLFxuICAgICAgaGFuZGxlcixcbiAgICAgIGNvZGVQYXRoLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwLFxuICAgICAgYXVyb3JhU2VjcmV0LFxuICAgICAgcmVkaXNFbmRwb2ludCxcbiAgICAgIGVudmlyb25tZW50ID0ge30sXG4gICAgICB0aW1lb3V0LFxuICAgICAgbWVtb3J5U2l6ZSxcbiAgICB9ID0gcHJvcHM7XG5cbiAgICAvLyBDcmVhdGUgbG9nIGdyb3VwXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2xhbWJkYS8ke2Z1bmN0aW9uTmFtZX1gLFxuICAgICAgcmV0ZW50aW9uOiBjb25maWcubG9nUmV0ZW50aW9uRGF5cyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9uXG4gICAgdGhpcy5mdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0Z1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTIsXG4gICAgICBoYW5kbGVyLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KGNvZGVQYXRoLCB7XG4gICAgICAgIGV4Y2x1ZGU6IFtcbiAgICAgICAgICAndmVudicsXG4gICAgICAgICAgJy52ZW52JyxcbiAgICAgICAgICAnX19weWNhY2hlX18nLFxuICAgICAgICAgICcqLnB5YycsXG4gICAgICAgICAgJy5weXRlc3RfY2FjaGUnLFxuICAgICAgICAgICd0ZXN0cycsXG4gICAgICAgICAgJyoubWQnLFxuICAgICAgICAgICdyZXF1aXJlbWVudHMtZGV2LnR4dCcsXG4gICAgICAgICAgJy5naXQnLFxuICAgICAgICAgICcuZW52JyxcbiAgICAgICAgICAnLmVudi5sb2NhbCcsXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uLFxuXG4gICAgICAvLyBWUEMgY29uZmlndXJhdGlvblxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbc2VjdXJpdHlHcm91cF0sXG5cbiAgICAgIC8vIFJlc291cmNlIGNvbmZpZ3VyYXRpb25cbiAgICAgIHRpbWVvdXQ6IHRpbWVvdXQgfHwgY2RrLkR1cmF0aW9uLnNlY29uZHMoY29uZmlnLmxhbWJkYS50aW1lb3V0KSxcbiAgICAgIG1lbW9yeVNpemU6IG1lbW9yeVNpemUgfHwgY29uZmlnLmxhbWJkYS5tZW1vcnlTaXplLFxuXG4gICAgICAvLyBFbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFBZVEhPTlBBVEg6ICcvdmFyL3Rhc2s6L3Zhci9ydW50aW1lJyxcbiAgICAgICAgU1RBR0U6IGNvbmZpZy5zdGFnZSxcbiAgICAgICAgREJfU0VDUkVUX0FSTjogYXVyb3JhU2VjcmV0LnNlY3JldEFybiwgLy8gTGFtYmRhIHdpbGwgcmVhZCBzZWNyZXQgYW5kIGNvbnN0cnVjdCBjb25uZWN0aW9uIHN0cmluZ1xuICAgICAgICAuLi4ocmVkaXNFbmRwb2ludCAmJiB7XG4gICAgICAgICAgUkVESVNfVVJMOiBgcmVkaXM6Ly8ke3JlZGlzRW5kcG9pbnR9OjYzNzlgLFxuICAgICAgICB9KSxcbiAgICAgICAgTE9HX0xFVkVMOiAnaW5mbycsXG4gICAgICAgIC4uLmVudmlyb25tZW50LFxuICAgICAgfSxcblxuICAgICAgLy8gWC1SYXkgdHJhY2luZ1xuICAgICAgdHJhY2luZzogY29uZmlnLmVuYWJsZVhSYXkgPyBsYW1iZGEuVHJhY2luZy5BQ1RJVkUgOiBsYW1iZGEuVHJhY2luZy5ESVNBQkxFRCxcblxuICAgICAgLy8gUmVzZXJ2ZWQgY29uY3VycmVuY3kgKHByb2R1Y3Rpb24gb25seSlcbiAgICAgIC4uLihjb25maWcuc3RhZ2UgPT09ICdwcm9kJyAmJiB7XG4gICAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDUwLFxuICAgICAgfSksXG5cbiAgICAgIC8vIExvZyBncm91cFxuICAgICAgbG9nR3JvdXAsXG4gICAgfSk7XG5cbiAgICAvLyBOb3RlOiBEYXRhYmFzZSBzZWNyZXQgYWNjZXNzIGlzIGdyYW50ZWQgaW4gdGhlIExhbWJkYSBzdGFjayB0byBhdm9pZCBjeWNsaWMgZGVwZW5kZW5jaWVzXG5cbiAgICAvLyBBZGQgdGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMuZnVuY3Rpb24pLmFkZCgnU2VydmljZScsIGZ1bmN0aW9uTmFtZS5zcGxpdCgnLScpWzFdIHx8ICd1bmtub3duJyk7XG4gIH1cbn1cbiJdfQ==