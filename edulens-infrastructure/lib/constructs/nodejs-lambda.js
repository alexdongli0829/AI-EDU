"use strict";
/**
 * Node.js Lambda Construct
 *
 * Reusable construct for creating Node.js Lambda functions with common configuration
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
exports.NodejsLambda = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class NodejsLambda extends constructs_1.Construct {
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
            runtime: lambda.Runtime.NODEJS_20_X,
            handler,
            code: lambda.Code.fromAsset(codePath, {
                exclude: [
                    'test',
                    'tests',
                    '__tests__',
                    '*.test.ts',
                    '*.test.js',
                    '*.spec.ts',
                    '*.spec.js',
                    '*.md',
                    '.git',
                    '.env',
                    '.env.local',
                    'tsconfig.json',
                    'jest.config.js',
                    'coverage',
                    'node_modules/@types',
                    'node_modules/typescript',
                    'node_modules/prisma',
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
                NODE_ENV: config.stage,
                STAGE: config.stage,
                DB_SECRET_ARN: auroraSecret.secretArn, // Lambda will read secret and construct connection string
                REDIS_URL: `redis://${redisEndpoint}:6379`,
                LOG_LEVEL: 'info',
                ...environment,
            },
            // X-Ray tracing
            tracing: config.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
            // Reserved concurrency (production only)
            ...(config.stage === 'prod' && {
                reservedConcurrentExecutions: 100,
            }),
            // Log group
            logGroup,
        });
        // Note: Database secret access is granted in the Lambda stack to avoid cyclic dependencies
        // Add tags
        cdk.Tags.of(this.function).add('Service', functionName.split('-')[1] || 'unknown');
    }
}
exports.NodejsLambda = NodejsLambda;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzLWxhbWJkYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5vZGVqcy1sYW1iZGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQseURBQTJDO0FBQzNDLDJEQUE2QztBQUU3QywyQ0FBdUM7QUFrQnZDLE1BQWEsWUFBYSxTQUFRLHNCQUFTO0lBR3pDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQ0osTUFBTSxFQUNOLFlBQVksRUFDWixPQUFPLEVBQ1AsUUFBUSxFQUNSLFdBQVcsRUFDWCxHQUFHLEVBQ0gsYUFBYSxFQUNiLFlBQVksRUFDWixhQUFhLEVBQ2IsV0FBVyxHQUFHLEVBQUUsRUFDaEIsT0FBTyxFQUNQLFVBQVUsR0FDWCxHQUFHLEtBQUssQ0FBQztRQUVWLG1CQUFtQjtRQUNuQixNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNuRCxZQUFZLEVBQUUsZUFBZSxZQUFZLEVBQUU7WUFDM0MsU0FBUyxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7WUFDbEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCx5QkFBeUI7UUFDekIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNwRCxZQUFZO1lBQ1osT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPO1lBQ1AsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRTtnQkFDcEMsT0FBTyxFQUFFO29CQUNQLE1BQU07b0JBQ04sT0FBTztvQkFDUCxXQUFXO29CQUNYLFdBQVc7b0JBQ1gsV0FBVztvQkFDWCxXQUFXO29CQUNYLFdBQVc7b0JBQ1gsTUFBTTtvQkFDTixNQUFNO29CQUNOLE1BQU07b0JBQ04sWUFBWTtvQkFDWixlQUFlO29CQUNmLGdCQUFnQjtvQkFDaEIsVUFBVTtvQkFDVixxQkFBcUI7b0JBQ3JCLHlCQUF5QjtvQkFDekIscUJBQXFCO2lCQUN0QjthQUNGLENBQUM7WUFDRixXQUFXO1lBRVgsb0JBQW9CO1lBQ3BCLEdBQUc7WUFDSCxVQUFVLEVBQUU7Z0JBQ1YsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CO2FBQy9DO1lBQ0QsY0FBYyxFQUFFLENBQUMsYUFBYSxDQUFDO1lBRS9CLHlCQUF5QjtZQUN6QixPQUFPLEVBQUUsT0FBTyxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQy9ELFVBQVUsRUFBRSxVQUFVLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVO1lBRWxELHdCQUF3QjtZQUN4QixXQUFXLEVBQUU7Z0JBQ1gsUUFBUSxFQUFFLE1BQU0sQ0FBQyxLQUFLO2dCQUN0QixLQUFLLEVBQUUsTUFBTSxDQUFDLEtBQUs7Z0JBQ25CLGFBQWEsRUFBRSxZQUFZLENBQUMsU0FBUyxFQUFFLDBEQUEwRDtnQkFDakcsU0FBUyxFQUFFLFdBQVcsYUFBYSxPQUFPO2dCQUMxQyxTQUFTLEVBQUUsTUFBTTtnQkFDakIsR0FBRyxXQUFXO2FBQ2Y7WUFFRCxnQkFBZ0I7WUFDaEIsT0FBTyxFQUFFLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFFBQVE7WUFFNUUseUNBQXlDO1lBQ3pDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxLQUFLLE1BQU0sSUFBSTtnQkFDN0IsNEJBQTRCLEVBQUUsR0FBRzthQUNsQyxDQUFDO1lBRUYsWUFBWTtZQUNaLFFBQVE7U0FDVCxDQUFDLENBQUM7UUFFSCwyRkFBMkY7UUFFM0YsV0FBVztRQUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLENBQUM7SUFDckYsQ0FBQztDQUNGO0FBOUZELG9DQThGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTm9kZS5qcyBMYW1iZGEgQ29uc3RydWN0XG4gKlxuICogUmV1c2FibGUgY29uc3RydWN0IGZvciBjcmVhdGluZyBOb2RlLmpzIExhbWJkYSBmdW5jdGlvbnMgd2l0aCBjb21tb24gY29uZmlndXJhdGlvblxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTm9kZWpzTGFtYmRhUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuICBmdW5jdGlvbk5hbWU6IHN0cmluZztcbiAgaGFuZGxlcjogc3RyaW5nO1xuICBjb2RlUGF0aDogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICB2cGM6IGVjMi5WcGM7XG4gIHNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBhdXJvcmFTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XG4gIHJlZGlzRW5kcG9pbnQ6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICB0aW1lb3V0PzogY2RrLkR1cmF0aW9uO1xuICBtZW1vcnlTaXplPzogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTm9kZWpzTGFtYmRhIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE5vZGVqc0xhbWJkYVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICBjb2RlUGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICBlbnZpcm9ubWVudCA9IHt9LFxuICAgICAgdGltZW91dCxcbiAgICAgIG1lbW9yeVNpemUsXG4gICAgfSA9IHByb3BzO1xuXG4gICAgLy8gQ3JlYXRlIGxvZyBncm91cFxuICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvJHtmdW5jdGlvbk5hbWV9YCxcbiAgICAgIHJldGVudGlvbjogY29uZmlnLmxvZ1JldGVudGlvbkRheXMsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIExhbWJkYSBmdW5jdGlvblxuICAgIHRoaXMuZnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZSxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgaGFuZGxlcixcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChjb2RlUGF0aCwge1xuICAgICAgICBleGNsdWRlOiBbXG4gICAgICAgICAgJ3Rlc3QnLFxuICAgICAgICAgICd0ZXN0cycsXG4gICAgICAgICAgJ19fdGVzdHNfXycsXG4gICAgICAgICAgJyoudGVzdC50cycsXG4gICAgICAgICAgJyoudGVzdC5qcycsXG4gICAgICAgICAgJyouc3BlYy50cycsXG4gICAgICAgICAgJyouc3BlYy5qcycsXG4gICAgICAgICAgJyoubWQnLFxuICAgICAgICAgICcuZ2l0JyxcbiAgICAgICAgICAnLmVudicsXG4gICAgICAgICAgJy5lbnYubG9jYWwnLFxuICAgICAgICAgICd0c2NvbmZpZy5qc29uJyxcbiAgICAgICAgICAnamVzdC5jb25maWcuanMnLFxuICAgICAgICAgICdjb3ZlcmFnZScsXG4gICAgICAgICAgJ25vZGVfbW9kdWxlcy9AdHlwZXMnLFxuICAgICAgICAgICdub2RlX21vZHVsZXMvdHlwZXNjcmlwdCcsXG4gICAgICAgICAgJ25vZGVfbW9kdWxlcy9wcmlzbWEnLFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgICBkZXNjcmlwdGlvbixcblxuICAgICAgLy8gVlBDIGNvbmZpZ3VyYXRpb25cbiAgICAgIHZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW3NlY3VyaXR5R3JvdXBdLFxuXG4gICAgICAvLyBSZXNvdXJjZSBjb25maWd1cmF0aW9uXG4gICAgICB0aW1lb3V0OiB0aW1lb3V0IHx8IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5sYW1iZGEudGltZW91dCksXG4gICAgICBtZW1vcnlTaXplOiBtZW1vcnlTaXplIHx8IGNvbmZpZy5sYW1iZGEubWVtb3J5U2l6ZSxcblxuICAgICAgLy8gRW52aXJvbm1lbnQgdmFyaWFibGVzXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogY29uZmlnLnN0YWdlLFxuICAgICAgICBTVEFHRTogY29uZmlnLnN0YWdlLFxuICAgICAgICBEQl9TRUNSRVRfQVJOOiBhdXJvcmFTZWNyZXQuc2VjcmV0QXJuLCAvLyBMYW1iZGEgd2lsbCByZWFkIHNlY3JldCBhbmQgY29uc3RydWN0IGNvbm5lY3Rpb24gc3RyaW5nXG4gICAgICAgIFJFRElTX1VSTDogYHJlZGlzOi8vJHtyZWRpc0VuZHBvaW50fTo2Mzc5YCxcbiAgICAgICAgTE9HX0xFVkVMOiAnaW5mbycsXG4gICAgICAgIC4uLmVudmlyb25tZW50LFxuICAgICAgfSxcblxuICAgICAgLy8gWC1SYXkgdHJhY2luZ1xuICAgICAgdHJhY2luZzogY29uZmlnLmVuYWJsZVhSYXkgPyBsYW1iZGEuVHJhY2luZy5BQ1RJVkUgOiBsYW1iZGEuVHJhY2luZy5ESVNBQkxFRCxcblxuICAgICAgLy8gUmVzZXJ2ZWQgY29uY3VycmVuY3kgKHByb2R1Y3Rpb24gb25seSlcbiAgICAgIC4uLihjb25maWcuc3RhZ2UgPT09ICdwcm9kJyAmJiB7XG4gICAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDEwMCxcbiAgICAgIH0pLFxuXG4gICAgICAvLyBMb2cgZ3JvdXBcbiAgICAgIGxvZ0dyb3VwLFxuICAgIH0pO1xuXG4gICAgLy8gTm90ZTogRGF0YWJhc2Ugc2VjcmV0IGFjY2VzcyBpcyBncmFudGVkIGluIHRoZSBMYW1iZGEgc3RhY2sgdG8gYXZvaWQgY3ljbGljIGRlcGVuZGVuY2llc1xuXG4gICAgLy8gQWRkIHRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzLmZ1bmN0aW9uKS5hZGQoJ1NlcnZpY2UnLCBmdW5jdGlvbk5hbWUuc3BsaXQoJy0nKVsxXSB8fCAndW5rbm93bicpO1xuICB9XG59XG4iXX0=