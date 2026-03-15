"use strict";
/**
 * Node.js Lambda Construct
 *
 * Uses NodejsFunction (esbuild) to bundle only imported code, eliminating the
 * need to ship the entire node_modules directory. Packages listed in
 * `externalModules` are excluded from the bundle (available in the Lambda
 * runtime).
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
const path = __importStar(require("path"));
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const constructs_1 = require("constructs");
class NodejsLambda extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const { config, functionName, handler, codePath, description, vpc, securityGroup, auroraSecret, redisEndpoint, environment = {}, timeout, memorySize, } = props;
        // ── Derive TypeScript entry from handler string ───────────────────────────
        // 'dist/handlers/login.handler'               → src/handlers/login.ts
        // 'dist/handlers/parent-chat/stream.handler'  → src/handlers/parent-chat/stream.ts
        const parts = handler.split('.');
        const exportedFn = parts[parts.length - 1]; // 'handler'
        const filePart = parts.slice(0, -1).join('.'); // 'dist/handlers/login'
        const srcRelPath = filePart.replace(/^dist\//, 'src/') + '.ts';
        const entry = path.resolve(__dirname, '../../', codePath, srcRelPath);
        // ── Log group ─────────────────────────────────────────────────────────────
        const logGroup = new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/aws/lambda/${functionName}`,
            retention: config.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // ── Lambda function (esbuild-bundled) ─────────────────────────────────────
        this.function = new aws_lambda_nodejs_1.NodejsFunction(this, 'Function', {
            functionName,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry,
            handler: exportedFn,
            description,
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [securityGroup],
            timeout: timeout || cdk.Duration.seconds(config.lambda.timeout),
            memorySize: memorySize || config.lambda.memorySize,
            environment: {
                NODE_ENV: config.stage,
                STAGE: config.stage,
                DB_SECRET_ARN: auroraSecret.secretArn,
                REDIS_URL: `redis://${redisEndpoint}:6379`,
                LOG_LEVEL: 'info',
                ...environment,
            },
            tracing: config.enableXRay ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
            ...(config.stage === 'prod' && {
                reservedConcurrentExecutions: 100,
            }),
            logGroup,
            bundling: {
                // @aws-sdk/* is built into the Node 20 managed runtime — no need to bundle it.
                externalModules: ['@aws-sdk/*'],
                // Prefer TypeScript source for workspace packages (e.g. @edulens/common,
                // @edulens/database) that have a "source" field pointing to src/index.ts.
                // This lets esbuild bundle them directly without requiring a pre-built dist/.
                mainFields: ['source', 'module', 'main'],
                minify: true,
                sourceMap: false,
                target: 'node20',
            },
        });
        cdk.Tags.of(this.function).add('Service', functionName.split('-')[1] || 'unknown');
    }
}
exports.NodejsLambda = NodejsLambda;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9kZWpzLWxhbWJkYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm5vZGVqcy1sYW1iZGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7O0dBT0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDJDQUE2QjtBQUM3QixpREFBbUM7QUFDbkMsK0RBQWlEO0FBQ2pELHlEQUEyQztBQUMzQywyREFBNkM7QUFFN0MscUVBQStEO0FBQy9ELDJDQUF1QztBQXdCdkMsTUFBYSxZQUFhLFNBQVEsc0JBQVM7SUFHekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sRUFDSixNQUFNLEVBQ04sWUFBWSxFQUNaLE9BQU8sRUFDUCxRQUFRLEVBQ1IsV0FBVyxFQUNYLEdBQUcsRUFDSCxhQUFhLEVBQ2IsWUFBWSxFQUNaLGFBQWEsRUFDYixXQUFXLEdBQUcsRUFBRSxFQUNoQixPQUFPLEVBQ1AsVUFBVSxHQUNYLEdBQUcsS0FBSyxDQUFDO1FBRVYsNkVBQTZFO1FBQzdFLHNFQUFzRTtRQUN0RSxtRkFBbUY7UUFDbkYsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFVLFlBQVk7UUFDakUsTUFBTSxRQUFRLEdBQUssS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBSyx3QkFBd0I7UUFDN0UsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBQy9ELE1BQU0sS0FBSyxHQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFM0UsNkVBQTZFO1FBQzdFLE1BQU0sUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ25ELFlBQVksRUFBRSxlQUFlLFlBQVksRUFBRTtZQUMzQyxTQUFTLEVBQUssTUFBTSxDQUFDLGdCQUFnQjtZQUNyQyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILDZFQUE2RTtRQUM3RSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksa0NBQWMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFO1lBQ25ELFlBQVk7WUFDWixPQUFPLEVBQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ3ZDLEtBQUs7WUFDTCxPQUFPLEVBQU0sVUFBVTtZQUN2QixXQUFXO1lBRVgsR0FBRztZQUNILFVBQVUsRUFBSyxFQUFFLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQixFQUFFO1lBQ2pFLGNBQWMsRUFBRSxDQUFDLGFBQWEsQ0FBQztZQUUvQixPQUFPLEVBQUssT0FBTyxJQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQ3JFLFVBQVUsRUFBRSxVQUFVLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVO1lBRWxELFdBQVcsRUFBRTtnQkFDWCxRQUFRLEVBQU8sTUFBTSxDQUFDLEtBQUs7Z0JBQzNCLEtBQUssRUFBVSxNQUFNLENBQUMsS0FBSztnQkFDM0IsYUFBYSxFQUFFLFlBQVksQ0FBQyxTQUFTO2dCQUNyQyxTQUFTLEVBQU0sV0FBVyxhQUFhLE9BQU87Z0JBQzlDLFNBQVMsRUFBTSxNQUFNO2dCQUNyQixHQUFHLFdBQVc7YUFDZjtZQUVELE9BQU8sRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRO1lBRTVFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxLQUFLLE1BQU0sSUFBSTtnQkFDN0IsNEJBQTRCLEVBQUUsR0FBRzthQUNsQyxDQUFDO1lBRUYsUUFBUTtZQUVSLFFBQVEsRUFBRTtnQkFDUiwrRUFBK0U7Z0JBQy9FLGVBQWUsRUFBRSxDQUFDLFlBQVksQ0FBQztnQkFFL0IseUVBQXlFO2dCQUN6RSwwRUFBMEU7Z0JBQzFFLDhFQUE4RTtnQkFDOUUsVUFBVSxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUM7Z0JBRXhDLE1BQU0sRUFBSyxJQUFJO2dCQUNmLFNBQVMsRUFBRSxLQUFLO2dCQUNoQixNQUFNLEVBQUssUUFBUTthQUNwQjtTQUNGLENBQUMsQ0FBQztRQUVILEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksU0FBUyxDQUFDLENBQUM7SUFDckYsQ0FBQztDQUNGO0FBdEZELG9DQXNGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTm9kZS5qcyBMYW1iZGEgQ29uc3RydWN0XG4gKlxuICogVXNlcyBOb2RlanNGdW5jdGlvbiAoZXNidWlsZCkgdG8gYnVuZGxlIG9ubHkgaW1wb3J0ZWQgY29kZSwgZWxpbWluYXRpbmcgdGhlXG4gKiBuZWVkIHRvIHNoaXAgdGhlIGVudGlyZSBub2RlX21vZHVsZXMgZGlyZWN0b3J5LiBQYWNrYWdlcyBsaXN0ZWQgaW5cbiAqIGBleHRlcm5hbE1vZHVsZXNgIGFyZSBleGNsdWRlZCBmcm9tIHRoZSBidW5kbGUgKGF2YWlsYWJsZSBpbiB0aGUgTGFtYmRhXG4gKiBydW50aW1lKS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE5vZGVqc0xhbWJkYVByb3BzIHtcbiAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgZnVuY3Rpb25OYW1lOiBzdHJpbmc7XG4gIC8qKlxuICAgKiBMYW1iZGEgaGFuZGxlciBpbiB0aGUgZm9ybSB1c2VkIGJ5IENESzogYGRpc3QvaGFuZGxlcnMvbG9naW4uaGFuZGxlcmBcbiAgICogVGhlIGNvbnN0cnVjdCBjb252ZXJ0cyB0aGlzIHRvIGEgVHlwZVNjcmlwdCBlbnRyeSBwYXRoOlxuICAgKiAgIGRpc3QvaGFuZGxlcnMvbG9naW4uaGFuZGxlciAg4oaSICA8Y29kZVBhdGg+L3NyYy9oYW5kbGVycy9sb2dpbi50c1xuICAgKi9cbiAgaGFuZGxlcjogc3RyaW5nO1xuICAvKiogUmVsYXRpdmUgcGF0aCBmcm9tIHRoZSBpbmZyYSByb290IHRvIHRoZSBzZXJ2aWNlIGRpcmVjdG9yeSAqL1xuICBjb2RlUGF0aDogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICB2cGM6IGVjMi5WcGM7XG4gIHNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuICBhdXJvcmFTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XG4gIHJlZGlzRW5kcG9pbnQ6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICB0aW1lb3V0PzogY2RrLkR1cmF0aW9uO1xuICBtZW1vcnlTaXplPzogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTm9kZWpzTGFtYmRhIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE5vZGVqc0xhbWJkYVByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IHtcbiAgICAgIGNvbmZpZyxcbiAgICAgIGZ1bmN0aW9uTmFtZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICBjb2RlUGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cCxcbiAgICAgIGF1cm9yYVNlY3JldCxcbiAgICAgIHJlZGlzRW5kcG9pbnQsXG4gICAgICBlbnZpcm9ubWVudCA9IHt9LFxuICAgICAgdGltZW91dCxcbiAgICAgIG1lbW9yeVNpemUsXG4gICAgfSA9IHByb3BzO1xuXG4gICAgLy8g4pSA4pSAIERlcml2ZSBUeXBlU2NyaXB0IGVudHJ5IGZyb20gaGFuZGxlciBzdHJpbmcg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gICAgLy8gJ2Rpc3QvaGFuZGxlcnMvbG9naW4uaGFuZGxlcicgICAgICAgICAgICAgICDihpIgc3JjL2hhbmRsZXJzL2xvZ2luLnRzXG4gICAgLy8gJ2Rpc3QvaGFuZGxlcnMvcGFyZW50LWNoYXQvc3RyZWFtLmhhbmRsZXInICDihpIgc3JjL2hhbmRsZXJzL3BhcmVudC1jaGF0L3N0cmVhbS50c1xuICAgIGNvbnN0IHBhcnRzID0gaGFuZGxlci5zcGxpdCgnLicpO1xuICAgIGNvbnN0IGV4cG9ydGVkRm4gPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXTsgICAgICAgICAgLy8gJ2hhbmRsZXInXG4gICAgY29uc3QgZmlsZVBhcnQgICA9IHBhcnRzLnNsaWNlKDAsIC0xKS5qb2luKCcuJyk7ICAgICAvLyAnZGlzdC9oYW5kbGVycy9sb2dpbidcbiAgICBjb25zdCBzcmNSZWxQYXRoID0gZmlsZVBhcnQucmVwbGFjZSgvXmRpc3RcXC8vLCAnc3JjLycpICsgJy50cyc7XG4gICAgY29uc3QgZW50cnkgICAgICA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLi8uLi8nLCBjb2RlUGF0aCwgc3JjUmVsUGF0aCk7XG5cbiAgICAvLyDilIDilIAgTG9nIGdyb3VwIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvJHtmdW5jdGlvbk5hbWV9YCxcbiAgICAgIHJldGVudGlvbjogICAgY29uZmlnLmxvZ1JldGVudGlvbkRheXMsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8g4pSA4pSAIExhbWJkYSBmdW5jdGlvbiAoZXNidWlsZC1idW5kbGVkKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAgICB0aGlzLmZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsICdGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZSxcbiAgICAgIHJ1bnRpbWU6ICAgICBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWCxcbiAgICAgIGVudHJ5LFxuICAgICAgaGFuZGxlcjogICAgIGV4cG9ydGVkRm4sXG4gICAgICBkZXNjcmlwdGlvbixcblxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czogICAgeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW3NlY3VyaXR5R3JvdXBdLFxuXG4gICAgICB0aW1lb3V0OiAgICB0aW1lb3V0ICAgIHx8IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5sYW1iZGEudGltZW91dCksXG4gICAgICBtZW1vcnlTaXplOiBtZW1vcnlTaXplIHx8IGNvbmZpZy5sYW1iZGEubWVtb3J5U2l6ZSxcblxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTk9ERV9FTlY6ICAgICAgY29uZmlnLnN0YWdlLFxuICAgICAgICBTVEFHRTogICAgICAgICBjb25maWcuc3RhZ2UsXG4gICAgICAgIERCX1NFQ1JFVF9BUk46IGF1cm9yYVNlY3JldC5zZWNyZXRBcm4sXG4gICAgICAgIFJFRElTX1VSTDogICAgIGByZWRpczovLyR7cmVkaXNFbmRwb2ludH06NjM3OWAsXG4gICAgICAgIExPR19MRVZFTDogICAgICdpbmZvJyxcbiAgICAgICAgLi4uZW52aXJvbm1lbnQsXG4gICAgICB9LFxuXG4gICAgICB0cmFjaW5nOiBjb25maWcuZW5hYmxlWFJheSA/IGxhbWJkYS5UcmFjaW5nLkFDVElWRSA6IGxhbWJkYS5UcmFjaW5nLkRJU0FCTEVELFxuXG4gICAgICAuLi4oY29uZmlnLnN0YWdlID09PSAncHJvZCcgJiYge1xuICAgICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxMDAsXG4gICAgICB9KSxcblxuICAgICAgbG9nR3JvdXAsXG5cbiAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgIC8vIEBhd3Mtc2RrLyogaXMgYnVpbHQgaW50byB0aGUgTm9kZSAyMCBtYW5hZ2VkIHJ1bnRpbWUg4oCUIG5vIG5lZWQgdG8gYnVuZGxlIGl0LlxuICAgICAgICBleHRlcm5hbE1vZHVsZXM6IFsnQGF3cy1zZGsvKiddLFxuXG4gICAgICAgIC8vIFByZWZlciBUeXBlU2NyaXB0IHNvdXJjZSBmb3Igd29ya3NwYWNlIHBhY2thZ2VzIChlLmcuIEBlZHVsZW5zL2NvbW1vbixcbiAgICAgICAgLy8gQGVkdWxlbnMvZGF0YWJhc2UpIHRoYXQgaGF2ZSBhIFwic291cmNlXCIgZmllbGQgcG9pbnRpbmcgdG8gc3JjL2luZGV4LnRzLlxuICAgICAgICAvLyBUaGlzIGxldHMgZXNidWlsZCBidW5kbGUgdGhlbSBkaXJlY3RseSB3aXRob3V0IHJlcXVpcmluZyBhIHByZS1idWlsdCBkaXN0Ly5cbiAgICAgICAgbWFpbkZpZWxkczogWydzb3VyY2UnLCAnbW9kdWxlJywgJ21haW4nXSxcblxuICAgICAgICBtaW5pZnk6ICAgIHRydWUsXG4gICAgICAgIHNvdXJjZU1hcDogZmFsc2UsXG4gICAgICAgIHRhcmdldDogICAgJ25vZGUyMCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY2RrLlRhZ3Mub2YodGhpcy5mdW5jdGlvbikuYWRkKCdTZXJ2aWNlJywgZnVuY3Rpb25OYW1lLnNwbGl0KCctJylbMV0gfHwgJ3Vua25vd24nKTtcbiAgfVxufVxuIl19