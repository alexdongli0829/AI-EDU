"use strict";
/**
 * WebSocket Integration Stack
 *
 * This stack connects WebSocket API routes to Lambda functions.
 * Deploy this AFTER the main stacks to avoid cyclic dependencies.
 *
 * Usage:
 *   npx cdk deploy EduLensWebSocketIntegrationStack-dev --context stage=dev
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
exports.WebSocketIntegrationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class WebSocketIntegrationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config } = props;
        // ============================================================
        // Import Existing Resources
        // ============================================================
        // Import WebSocket API ID from stack exports
        const websocketApiId = cdk.Fn.importValue(`edulens-ws-api-id-${config.stage}`);
        // Import Lambda functions by name
        const websocketConnectFunction = lambda.Function.fromFunctionName(this, 'WebsocketConnectFunction', `edulens-websocket-connect-${config.stage}`);
        const websocketDisconnectFunction = lambda.Function.fromFunctionName(this, 'WebsocketDisconnectFunction', `edulens-websocket-disconnect-${config.stage}`);
        // ============================================================
        // Create WebSocket Integrations
        // ============================================================
        // $connect Integration
        const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
            apiId: websocketApiId,
            integrationType: 'AWS_PROXY',
            integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${websocketConnectFunction.functionArn}/invocations`,
        });
        // $disconnect Integration
        const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
            apiId: websocketApiId,
            integrationType: 'AWS_PROXY',
            integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${websocketDisconnectFunction.functionArn}/invocations`,
        });
        // ============================================================
        // Create WebSocket Routes
        // ============================================================
        new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
            apiId: websocketApiId,
            routeKey: '$connect',
            authorizationType: 'NONE',
            target: `integrations/${connectIntegration.ref}`,
        });
        new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
            apiId: websocketApiId,
            routeKey: '$disconnect',
            authorizationType: 'NONE',
            target: `integrations/${disconnectIntegration.ref}`,
        });
        // ============================================================
        // Grant Permissions
        // ============================================================
        // Grant API Gateway permission to invoke Lambda functions
        websocketConnectFunction.addPermission('AllowApiGatewayInvoke', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${websocketApiId}/*`,
        });
        websocketDisconnectFunction.addPermission('AllowApiGatewayInvoke', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${websocketApiId}/*`,
        });
        // ============================================================
        // Outputs
        // ============================================================
        new cdk.CfnOutput(this, 'WebSocketIntegrationsCreated', {
            value: 'WebSocket $connect and $disconnect routes configured',
            description: 'WebSocket integration status',
        });
        new cdk.CfnOutput(this, 'WebSocketUrl', {
            value: `wss://${websocketApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com/${config.stage}`,
            description: 'WebSocket API URL',
        });
    }
}
exports.WebSocketIntegrationStack = WebSocketIntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vic29ja2V0LWludGVncmF0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2Vic29ja2V0LWludGVncmF0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLDJFQUE2RDtBQUM3RCwrREFBaUQ7QUFDakQseURBQTJDO0FBUTNDLE1BQWEseUJBQTBCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQztRQUM3RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXpCLCtEQUErRDtRQUMvRCw0QkFBNEI7UUFDNUIsK0RBQStEO1FBRS9ELDZDQUE2QztRQUM3QyxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxxQkFBcUIsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFFL0Usa0NBQWtDO1FBQ2xDLE1BQU0sd0JBQXdCLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FDL0QsSUFBSSxFQUNKLDBCQUEwQixFQUMxQiw2QkFBNkIsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUM1QyxDQUFDO1FBRUYsTUFBTSwyQkFBMkIsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUNsRSxJQUFJLEVBQ0osNkJBQTZCLEVBQzdCLGdDQUFnQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQy9DLENBQUM7UUFFRiwrREFBK0Q7UUFDL0QsZ0NBQWdDO1FBQ2hDLCtEQUErRDtRQUUvRCx1QkFBdUI7UUFDdkIsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3JGLEtBQUssRUFBRSxjQUFjO1lBQ3JCLGVBQWUsRUFBRSxXQUFXO1lBQzVCLGNBQWMsRUFBRSxzQkFBc0IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLHFDQUFxQyx3QkFBd0IsQ0FBQyxXQUFXLGNBQWM7U0FDNUksQ0FBQyxDQUFDO1FBRUgsMEJBQTBCO1FBQzFCLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxZQUFZLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMzRixLQUFLLEVBQUUsY0FBYztZQUNyQixlQUFlLEVBQUUsV0FBVztZQUM1QixjQUFjLEVBQUUsc0JBQXNCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxxQ0FBcUMsMkJBQTJCLENBQUMsV0FBVyxjQUFjO1NBQy9JLENBQUMsQ0FBQztRQUVILCtEQUErRDtRQUMvRCwwQkFBMEI7UUFDMUIsK0RBQStEO1FBRS9ELElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQzlDLEtBQUssRUFBRSxjQUFjO1lBQ3JCLFFBQVEsRUFBRSxVQUFVO1lBQ3BCLGlCQUFpQixFQUFFLE1BQU07WUFDekIsTUFBTSxFQUFFLGdCQUFnQixrQkFBa0IsQ0FBQyxHQUFHLEVBQUU7U0FDakQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUNqRCxLQUFLLEVBQUUsY0FBYztZQUNyQixRQUFRLEVBQUUsYUFBYTtZQUN2QixpQkFBaUIsRUFBRSxNQUFNO1lBQ3pCLE1BQU0sRUFBRSxnQkFBZ0IscUJBQXFCLENBQUMsR0FBRyxFQUFFO1NBQ3BELENBQUMsQ0FBQztRQUVILCtEQUErRDtRQUMvRCxvQkFBb0I7UUFDcEIsK0RBQStEO1FBRS9ELDBEQUEwRDtRQUMxRCx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsdUJBQXVCLEVBQUU7WUFDOUQsU0FBUyxFQUFFLElBQUksR0FBRyxDQUFDLGdCQUFnQixDQUFDLDBCQUEwQixDQUFDO1lBQy9ELFNBQVMsRUFBRSx1QkFBdUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksY0FBYyxJQUFJO1NBQzdGLENBQUMsQ0FBQztRQUVILDJCQUEyQixDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsRUFBRTtZQUNqRSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsMEJBQTBCLENBQUM7WUFDL0QsU0FBUyxFQUFFLHVCQUF1QixHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxjQUFjLElBQUk7U0FDN0YsQ0FBQyxDQUFDO1FBRUgsK0RBQStEO1FBQy9ELFVBQVU7UUFDViwrREFBK0Q7UUFFL0QsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSw4QkFBOEIsRUFBRTtZQUN0RCxLQUFLLEVBQUUsc0RBQXNEO1lBQzdELFdBQVcsRUFBRSw4QkFBOEI7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLFNBQVMsY0FBYyxnQkFBZ0IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLGtCQUFrQixNQUFNLENBQUMsS0FBSyxFQUFFO1lBQzVGLFdBQVcsRUFBRSxtQkFBbUI7U0FDakMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBM0ZELDhEQTJGQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogV2ViU29ja2V0IEludGVncmF0aW9uIFN0YWNrXG4gKlxuICogVGhpcyBzdGFjayBjb25uZWN0cyBXZWJTb2NrZXQgQVBJIHJvdXRlcyB0byBMYW1iZGEgZnVuY3Rpb25zLlxuICogRGVwbG95IHRoaXMgQUZURVIgdGhlIG1haW4gc3RhY2tzIHRvIGF2b2lkIGN5Y2xpYyBkZXBlbmRlbmNpZXMuXG4gKlxuICogVXNhZ2U6XG4gKiAgIG5weCBjZGsgZGVwbG95IEVkdUxlbnNXZWJTb2NrZXRJbnRlZ3JhdGlvblN0YWNrLWRldiAtLWNvbnRleHQgc3RhZ2U9ZGV2XG4gKi9cblxuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXl2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRDb25maWcgfSBmcm9tICcuLi8uLi9jb25maWcvZW52aXJvbm1lbnRzJztcblxuZXhwb3J0IGludGVyZmFjZSBXZWJTb2NrZXRJbnRlZ3JhdGlvblN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG59XG5cbmV4cG9ydCBjbGFzcyBXZWJTb2NrZXRJbnRlZ3JhdGlvblN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFdlYlNvY2tldEludGVncmF0aW9uU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBjb25maWcgfSA9IHByb3BzO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gSW1wb3J0IEV4aXN0aW5nIFJlc291cmNlc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gSW1wb3J0IFdlYlNvY2tldCBBUEkgSUQgZnJvbSBzdGFjayBleHBvcnRzXG4gICAgY29uc3Qgd2Vic29ja2V0QXBpSWQgPSBjZGsuRm4uaW1wb3J0VmFsdWUoYGVkdWxlbnMtd3MtYXBpLWlkLSR7Y29uZmlnLnN0YWdlfWApO1xuXG4gICAgLy8gSW1wb3J0IExhbWJkYSBmdW5jdGlvbnMgYnkgbmFtZVxuICAgIGNvbnN0IHdlYnNvY2tldENvbm5lY3RGdW5jdGlvbiA9IGxhbWJkYS5GdW5jdGlvbi5mcm9tRnVuY3Rpb25OYW1lKFxuICAgICAgdGhpcyxcbiAgICAgICdXZWJzb2NrZXRDb25uZWN0RnVuY3Rpb24nLFxuICAgICAgYGVkdWxlbnMtd2Vic29ja2V0LWNvbm5lY3QtJHtjb25maWcuc3RhZ2V9YFxuICAgICk7XG5cbiAgICBjb25zdCB3ZWJzb2NrZXREaXNjb25uZWN0RnVuY3Rpb24gPSBsYW1iZGEuRnVuY3Rpb24uZnJvbUZ1bmN0aW9uTmFtZShcbiAgICAgIHRoaXMsXG4gICAgICAnV2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uJyxcbiAgICAgIGBlZHVsZW5zLXdlYnNvY2tldC1kaXNjb25uZWN0LSR7Y29uZmlnLnN0YWdlfWBcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ3JlYXRlIFdlYlNvY2tldCBJbnRlZ3JhdGlvbnNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vICRjb25uZWN0IEludGVncmF0aW9uXG4gICAgY29uc3QgY29ubmVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXl2Mi5DZm5JbnRlZ3JhdGlvbih0aGlzLCAnQ29ubmVjdEludGVncmF0aW9uJywge1xuICAgICAgYXBpSWQ6IHdlYnNvY2tldEFwaUlkLFxuICAgICAgaW50ZWdyYXRpb25UeXBlOiAnQVdTX1BST1hZJyxcbiAgICAgIGludGVncmF0aW9uVXJpOiBgYXJuOmF3czphcGlnYXRld2F5OiR7Y2RrLkF3cy5SRUdJT059OmxhbWJkYTpwYXRoLzIwMTUtMDMtMzEvZnVuY3Rpb25zLyR7d2Vic29ja2V0Q29ubmVjdEZ1bmN0aW9uLmZ1bmN0aW9uQXJufS9pbnZvY2F0aW9uc2AsXG4gICAgfSk7XG5cbiAgICAvLyAkZGlzY29ubmVjdCBJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGRpc2Nvbm5lY3RJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5djIuQ2ZuSW50ZWdyYXRpb24odGhpcywgJ0Rpc2Nvbm5lY3RJbnRlZ3JhdGlvbicsIHtcbiAgICAgIGFwaUlkOiB3ZWJzb2NrZXRBcGlJZCxcbiAgICAgIGludGVncmF0aW9uVHlwZTogJ0FXU19QUk9YWScsXG4gICAgICBpbnRlZ3JhdGlvblVyaTogYGFybjphd3M6YXBpZ2F0ZXdheToke2Nkay5Bd3MuUkVHSU9OfTpsYW1iZGE6cGF0aC8yMDE1LTAzLTMxL2Z1bmN0aW9ucy8ke3dlYnNvY2tldERpc2Nvbm5lY3RGdW5jdGlvbi5mdW5jdGlvbkFybn0vaW52b2NhdGlvbnNgLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ3JlYXRlIFdlYlNvY2tldCBSb3V0ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBhcGlnYXRld2F5djIuQ2ZuUm91dGUodGhpcywgJ0Nvbm5lY3RSb3V0ZScsIHtcbiAgICAgIGFwaUlkOiB3ZWJzb2NrZXRBcGlJZCxcbiAgICAgIHJvdXRlS2V5OiAnJGNvbm5lY3QnLFxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6ICdOT05FJyxcbiAgICAgIHRhcmdldDogYGludGVncmF0aW9ucy8ke2Nvbm5lY3RJbnRlZ3JhdGlvbi5yZWZ9YCxcbiAgICB9KTtcblxuICAgIG5ldyBhcGlnYXRld2F5djIuQ2ZuUm91dGUodGhpcywgJ0Rpc2Nvbm5lY3RSb3V0ZScsIHtcbiAgICAgIGFwaUlkOiB3ZWJzb2NrZXRBcGlJZCxcbiAgICAgIHJvdXRlS2V5OiAnJGRpc2Nvbm5lY3QnLFxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6ICdOT05FJyxcbiAgICAgIHRhcmdldDogYGludGVncmF0aW9ucy8ke2Rpc2Nvbm5lY3RJbnRlZ3JhdGlvbi5yZWZ9YCxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEdyYW50IFBlcm1pc3Npb25zXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBHcmFudCBBUEkgR2F0ZXdheSBwZXJtaXNzaW9uIHRvIGludm9rZSBMYW1iZGEgZnVuY3Rpb25zXG4gICAgd2Vic29ja2V0Q29ubmVjdEZ1bmN0aW9uLmFkZFBlcm1pc3Npb24oJ0FsbG93QXBpR2F0ZXdheUludm9rZScsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OiR7d2Vic29ja2V0QXBpSWR9LypgLFxuICAgIH0pO1xuXG4gICAgd2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uLmFkZFBlcm1pc3Npb24oJ0FsbG93QXBpR2F0ZXdheUludm9rZScsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OiR7d2Vic29ja2V0QXBpSWR9LypgLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYlNvY2tldEludGVncmF0aW9uc0NyZWF0ZWQnLCB7XG4gICAgICB2YWx1ZTogJ1dlYlNvY2tldCAkY29ubmVjdCBhbmQgJGRpc2Nvbm5lY3Qgcm91dGVzIGNvbmZpZ3VyZWQnLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgaW50ZWdyYXRpb24gc3RhdHVzJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRVcmwnLCB7XG4gICAgICB2YWx1ZTogYHdzczovLyR7d2Vic29ja2V0QXBpSWR9LmV4ZWN1dGUtYXBpLiR7Y2RrLkF3cy5SRUdJT059LmFtYXpvbmF3cy5jb20vJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBVUkwnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=