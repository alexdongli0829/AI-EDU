"use strict";
/**
 * API Gateway Stack
 *
 * Creates REST API and WebSocket API for EduLens services
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
exports.ApiGatewayStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ApiGatewayStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        // ============================================================
        // REST API Gateway
        // ============================================================
        // CloudWatch log group for API Gateway
        const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
            logGroupName: `/aws/apigateway/edulens-${config.stage}`,
            retention: config.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create REST API
        this.restApi = new apigateway.RestApi(this, 'RestApi', {
            restApiName: `edulens-api-${config.stage}`,
            description: `EduLens REST API (${config.stage})`,
            // Deploy configuration
            deploy: true,
            deployOptions: {
                stageName: config.stage,
                metricsEnabled: true,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: config.stage !== 'prod', // Disable data trace in prod
                accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    caller: true,
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    user: true,
                }),
            },
            // CORS configuration
            defaultCorsPreflightOptions: {
                allowOrigins: config.stage === 'prod'
                    ? ['https://app.edulens.com'] // Replace with actual domain
                    : apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
                allowCredentials: true,
            },
            // CloudWatch role
            cloudWatchRole: true,
            // Endpoint type
            endpointTypes: [apigateway.EndpointType.REGIONAL],
        });
        // API Key and Usage Plan (for admin endpoints)
        const apiKey = new apigateway.ApiKey(this, 'ApiKey', {
            apiKeyName: `edulens-admin-key-${config.stage}`,
            description: 'API Key for admin endpoints',
        });
        const usagePlan = this.restApi.addUsagePlan('UsagePlan', {
            name: `edulens-usage-plan-${config.stage}`,
            throttle: {
                rateLimit: config.stage === 'prod' ? 500 : 50,
                burstLimit: config.stage === 'prod' ? 1000 : 100,
            },
            quota: {
                limit: config.stage === 'prod' ? 100000 : 10000,
                period: apigateway.Period.DAY,
            },
        });
        usagePlan.addApiKey(apiKey);
        usagePlan.addApiStage({
            stage: this.restApi.deploymentStage,
        });
        // Note: API Gateway resources and methods are created in the Lambda stack
        // to avoid cyclic dependencies
        // ============================================================
        // WebSocket API
        // ============================================================
        // Create WebSocket API
        this.websocketApi = new apigatewayv2.CfnApi(this, 'WebSocketApi', {
            name: `edulens-ws-${config.stage}`,
            protocolType: 'WEBSOCKET',
            routeSelectionExpression: '$request.body.action',
            description: `EduLens WebSocket API for timer sync (${config.stage})`,
        });
        // WebSocket Stage
        this.websocketStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', {
            apiId: this.websocketApi.ref,
            stageName: config.stage,
            description: `WebSocket stage for ${config.stage}`,
            autoDeploy: true,
            defaultRouteSettings: {
                throttlingRateLimit: 100,
                throttlingBurstLimit: 200,
            },
        });
        // CloudWatch logs for WebSocket
        const wsLogGroup = new logs.LogGroup(this, 'WebSocketLogs', {
            logGroupName: `/aws/apigateway/websocket-${config.stage}`,
            retention: config.logRetentionDays,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // ============================================================
        // Outputs
        // ============================================================
        new cdk.CfnOutput(this, 'RestApiUrl', {
            value: this.restApi.url,
            description: 'REST API endpoint URL',
            exportName: `edulens-api-url-${config.stage}`,
        });
        new cdk.CfnOutput(this, 'RestApiId', {
            value: this.restApi.restApiId,
            description: 'REST API ID',
        });
        new cdk.CfnOutput(this, 'WebSocketApiUrl', {
            value: `wss://${this.websocketApi.ref}.execute-api.${this.region}.amazonaws.com/${config.stage}`,
            description: 'WebSocket API endpoint URL',
            exportName: `edulens-ws-url-${config.stage}`,
        });
        new cdk.CfnOutput(this, 'WebSocketApiId', {
            value: this.websocketApi.ref,
            description: 'WebSocket API ID',
            exportName: `edulens-ws-api-id-${config.stage}`,
        });
        new cdk.CfnOutput(this, 'ApiKeyId', {
            value: apiKey.keyId,
            description: 'API Key ID (for admin endpoints)',
        });
    }
}
exports.ApiGatewayStack = ApiGatewayStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWdhdGV3YXktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcGktZ2F0ZXdheS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUN6RCwyRUFBNkQ7QUFDN0QsMkRBQTZDO0FBUTdDLE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUs1QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFekIsK0RBQStEO1FBQy9ELG1CQUFtQjtRQUNuQiwrREFBK0Q7UUFFL0QsdUNBQXVDO1FBQ3ZDLE1BQU0sV0FBVyxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDNUQsWUFBWSxFQUFFLDJCQUEyQixNQUFNLENBQUMsS0FBSyxFQUFFO1lBQ3ZELFNBQVMsRUFBRSxNQUFNLENBQUMsZ0JBQWdCO1lBQ2xDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsa0JBQWtCO1FBQ2xCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUU7WUFDckQsV0FBVyxFQUFFLGVBQWUsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUMxQyxXQUFXLEVBQUUscUJBQXFCLE1BQU0sQ0FBQyxLQUFLLEdBQUc7WUFFakQsdUJBQXVCO1lBQ3ZCLE1BQU0sRUFBRSxJQUFJO1lBQ1osYUFBYSxFQUFFO2dCQUNiLFNBQVMsRUFBRSxNQUFNLENBQUMsS0FBSztnQkFDdkIsY0FBYyxFQUFF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RUFBRSxhQUFhO1NBQzNCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDekMsS0FBSyxFQUFFLFNBQVMsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLGdCQUFnQixJQUFJLENBQUMsTUFBTSxrQkFBa0IsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUNoRyxXQUFXLEVBQUUsNEJBQTRCO1lBQ3pDLFVBQVUsRUFBRSxrQkFBa0IsTUFBTSxDQUFDLEtBQUssRUFBRTtTQUM3QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3hDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUc7WUFDNUIsV0FBVyxFQUFFLGtCQUFrQjtZQUMvQixVQUFVLEVBQUUscUJBQXFCLE1BQU0sQ0FBQyxLQUFLLEVBQUU7U0FDaEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDbEMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLO1lBQ25CLFdBQVcsRUFBRSxrQ0FBa0M7U0FDaEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBL0pELDBDQStKQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQVBJIEdhdGV3YXkgU3RhY2tcbiAqXG4gKiBDcmVhdGVzIFJFU1QgQVBJIGFuZCBXZWJTb2NrZXQgQVBJIGZvciBFZHVMZW5zIHNlcnZpY2VzXG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBpR2F0ZXdheVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG59XG5cbmV4cG9ydCBjbGFzcyBBcGlHYXRld2F5U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgcmVzdEFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic29ja2V0QXBpOiBhcGlnYXRld2F5djIuQ2ZuQXBpO1xuICBwdWJsaWMgcmVhZG9ubHkgd2Vic29ja2V0U3RhZ2U6IGFwaWdhdGV3YXl2Mi5DZm5TdGFnZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBpR2F0ZXdheVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgY29uZmlnIH0gPSBwcm9wcztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFJFU1QgQVBJIEdhdGV3YXlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIENsb3VkV2F0Y2ggbG9nIGdyb3VwIGZvciBBUEkgR2F0ZXdheVxuICAgIGNvbnN0IGFwaUxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FwaUdhdGV3YXlMb2dzJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9hcGlnYXRld2F5L2VkdWxlbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIHJldGVudGlvbjogY29uZmlnLmxvZ1JldGVudGlvbkRheXMsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIFJFU1QgQVBJXG4gICAgdGhpcy5yZXN0QXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnUmVzdEFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgZWR1bGVucy1hcGktJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBSRVNUIEFQSSAoJHtjb25maWcuc3RhZ2V9KWAsXG5cbiAgICAgIC8vIERlcGxveSBjb25maWd1cmF0aW9uXG4gICAgICBkZXBsb3k6IHRydWUsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogY29uZmlnLnN0YWdlLFxuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiBjb25maWcuc3RhZ2UgIT09ICdwcm9kJywgLy8gRGlzYWJsZSBkYXRhIHRyYWNlIGluIHByb2RcbiAgICAgICAgYWNjZXNzTG9nRGVzdGluYXRpb246IG5ldyBhcGlnYXRld2F5LkxvZ0dyb3VwTG9nRGVzdGluYXRpb24oYXBpTG9nR3JvdXApLFxuICAgICAgICBhY2Nlc3NMb2dGb3JtYXQ6IGFwaWdhdGV3YXkuQWNjZXNzTG9nRm9ybWF0Lmpzb25XaXRoU3RhbmRhcmRGaWVsZHMoe1xuICAgICAgICAgIGNhbGxlcjogdHJ1ZSxcbiAgICAgICAgICBodHRwTWV0aG9kOiB0cnVlLFxuICAgICAgICAgIGlwOiB0cnVlLFxuICAgICAgICAgIHByb3RvY29sOiB0cnVlLFxuICAgICAgICAgIHJlcXVlc3RUaW1lOiB0cnVlLFxuICAgICAgICAgIHJlc291cmNlUGF0aDogdHJ1ZSxcbiAgICAgICAgICByZXNwb25zZUxlbmd0aDogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgdXNlcjogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuXG4gICAgICAvLyBDT1JTIGNvbmZpZ3VyYXRpb25cbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBbJ2h0dHBzOi8vYXBwLmVkdWxlbnMuY29tJ10gLy8gUmVwbGFjZSB3aXRoIGFjdHVhbCBkb21haW5cbiAgICAgICAgICA6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdYLUFtei1EYXRlJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG5cbiAgICAgIC8vIENsb3VkV2F0Y2ggcm9sZVxuICAgICAgY2xvdWRXYXRjaFJvbGU6IHRydWUsXG5cbiAgICAgIC8vIEVuZHBvaW50IHR5cGVcbiAgICAgIGVuZHBvaW50VHlwZXM6IFthcGlnYXRld2F5LkVuZHBvaW50VHlwZS5SRUdJT05BTF0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgS2V5IGFuZCBVc2FnZSBQbGFuIChmb3IgYWRtaW4gZW5kcG9pbnRzKVxuICAgIGNvbnN0IGFwaUtleSA9IG5ldyBhcGlnYXRld2F5LkFwaUtleSh0aGlzLCAnQXBpS2V5Jywge1xuICAgICAgYXBpS2V5TmFtZTogYGVkdWxlbnMtYWRtaW4ta2V5LSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBLZXkgZm9yIGFkbWluIGVuZHBvaW50cycsXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2FnZVBsYW4gPSB0aGlzLnJlc3RBcGkuYWRkVXNhZ2VQbGFuKCdVc2FnZVBsYW4nLCB7XG4gICAgICBuYW1lOiBgZWR1bGVucy11c2FnZS1wbGFuLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB0aHJvdHRsZToge1xuICAgICAgICByYXRlTGltaXQ6IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnID8gNTAwIDogNTAsXG4gICAgICAgIGJ1cnN0TGltaXQ6IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnID8gMTAwMCA6IDEwMCxcbiAgICAgIH0sXG4gICAgICBxdW90YToge1xuICAgICAgICBsaW1pdDogY29uZmlnLnN0YWdlID09PSAncHJvZCcgPyAxMDAwMDAgOiAxMDAwMCxcbiAgICAgICAgcGVyaW9kOiBhcGlnYXRld2F5LlBlcmlvZC5EQVksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdXNhZ2VQbGFuLmFkZEFwaUtleShhcGlLZXkpO1xuICAgIHVzYWdlUGxhbi5hZGRBcGlTdGFnZSh7XG4gICAgICBzdGFnZTogdGhpcy5yZXN0QXBpLmRlcGxveW1lbnRTdGFnZSxcbiAgICB9KTtcblxuICAgIC8vIE5vdGU6IEFQSSBHYXRld2F5IHJlc291cmNlcyBhbmQgbWV0aG9kcyBhcmUgY3JlYXRlZCBpbiB0aGUgTGFtYmRhIHN0YWNrXG4gICAgLy8gdG8gYXZvaWQgY3ljbGljIGRlcGVuZGVuY2llc1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gV2ViU29ja2V0IEFQSVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gQ3JlYXRlIFdlYlNvY2tldCBBUElcbiAgICB0aGlzLndlYnNvY2tldEFwaSA9IG5ldyBhcGlnYXRld2F5djIuQ2ZuQXBpKHRoaXMsICdXZWJTb2NrZXRBcGknLCB7XG4gICAgICBuYW1lOiBgZWR1bGVucy13cy0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgcHJvdG9jb2xUeXBlOiAnV0VCU09DS0VUJyxcbiAgICAgIHJvdXRlU2VsZWN0aW9uRXhwcmVzc2lvbjogJyRyZXF1ZXN0LmJvZHkuYWN0aW9uJyxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRWR1TGVucyBXZWJTb2NrZXQgQVBJIGZvciB0aW1lciBzeW5jICgke2NvbmZpZy5zdGFnZX0pYCxcbiAgICB9KTtcblxuICAgIC8vIFdlYlNvY2tldCBTdGFnZVxuICAgIHRoaXMud2Vic29ja2V0U3RhZ2UgPSBuZXcgYXBpZ2F0ZXdheXYyLkNmblN0YWdlKHRoaXMsICdXZWJTb2NrZXRTdGFnZScsIHtcbiAgICAgIGFwaUlkOiB0aGlzLndlYnNvY2tldEFwaS5yZWYsXG4gICAgICBzdGFnZU5hbWU6IGNvbmZpZy5zdGFnZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgV2ViU29ja2V0IHN0YWdlIGZvciAke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgYXV0b0RlcGxveTogdHJ1ZSxcbiAgICAgIGRlZmF1bHRSb3V0ZVNldHRpbmdzOiB7XG4gICAgICAgIHRocm90dGxpbmdSYXRlTGltaXQ6IDEwMCxcbiAgICAgICAgdGhyb3R0bGluZ0J1cnN0TGltaXQ6IDIwMCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZFdhdGNoIGxvZ3MgZm9yIFdlYlNvY2tldFxuICAgIGNvbnN0IHdzTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnV2ViU29ja2V0TG9ncycsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYXBpZ2F0ZXdheS93ZWJzb2NrZXQtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIHJldGVudGlvbjogY29uZmlnLmxvZ1JldGVudGlvbkRheXMsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1Jlc3RBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXN0QXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgZW5kcG9pbnQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLWFwaS11cmwtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZXN0QXBpSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZXN0QXBpLnJlc3RBcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYlNvY2tldEFwaVVybCcsIHtcbiAgICAgIHZhbHVlOiBgd3NzOi8vJHt0aGlzLndlYnNvY2tldEFwaS5yZWZ9LmV4ZWN1dGUtYXBpLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBlbmRwb2ludCBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYGVkdWxlbnMtd3MtdXJsLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0QXBpSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy53ZWJzb2NrZXRBcGkucmVmLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgQVBJIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLXdzLWFwaS1pZC0ke2NvbmZpZy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUtleUlkJywge1xuICAgICAgdmFsdWU6IGFwaUtleS5rZXlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEtleSBJRCAoZm9yIGFkbWluIGVuZHBvaW50cyknLFxuICAgIH0pO1xuICB9XG59XG4iXX0=