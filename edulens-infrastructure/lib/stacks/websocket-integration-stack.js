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
        // Import WebSocket API by name
        const websocketApi = apigatewayv2.CfnApi.fromCloudFormation(this, 'WebSocketApi', {
            ref: cdk.Fn.importValue(`edulens-ws-api-id-${config.stage}`),
        });
        // Import Lambda functions by name
        const websocketConnectFunction = lambda.Function.fromFunctionName(this, 'WebsocketConnectFunction', `edulens-websocket-connect-${config.stage}`);
        const websocketDisconnectFunction = lambda.Function.fromFunctionName(this, 'WebsocketDisconnectFunction', `edulens-websocket-disconnect-${config.stage}`);
        // ============================================================
        // Create WebSocket Integrations
        // ============================================================
        // $connect Integration
        const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
            apiId: websocketApi.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${websocketConnectFunction.functionArn}/invocations`,
        });
        // $disconnect Integration
        const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
            apiId: websocketApi.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: `arn:aws:apigateway:${cdk.Aws.REGION}:lambda:path/2015-03-31/functions/${websocketDisconnectFunction.functionArn}/invocations`,
        });
        // ============================================================
        // Create WebSocket Routes
        // ============================================================
        new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
            apiId: websocketApi.ref,
            routeKey: '$connect',
            authorizationType: 'NONE',
            target: `integrations/${connectIntegration.ref}`,
        });
        new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
            apiId: websocketApi.ref,
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
            sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${websocketApi.ref}/*`,
        });
        websocketDisconnectFunction.addPermission('AllowApiGatewayInvoke', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${websocketApi.ref}/*`,
        });
        // ============================================================
        // Outputs
        // ============================================================
        new cdk.CfnOutput(this, 'WebSocketIntegrationsCreated', {
            value: 'WebSocket $connect and $disconnect routes configured',
            description: 'WebSocket integration status',
        });
        new cdk.CfnOutput(this, 'WebSocketUrl', {
            value: `wss://${websocketApi.ref}.execute-api.${cdk.Aws.REGION}.amazonaws.com/${config.stage}`,
            description: 'WebSocket API URL',
        });
    }
}
exports.WebSocketIntegrationStack = WebSocketIntegrationStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vic29ja2V0LWludGVncmF0aW9uLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsid2Vic29ja2V0LWludGVncmF0aW9uLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7R0FRRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLDJFQUE2RDtBQUM3RCwrREFBaUQ7QUFDakQseURBQTJDO0FBUTNDLE1BQWEseUJBQTBCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQztRQUM3RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXpCLCtEQUErRDtRQUMvRCw0QkFBNEI7UUFDNUIsK0RBQStEO1FBRS9ELCtCQUErQjtRQUMvQixNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUN6RCxJQUFJLEVBQ0osY0FBYyxFQUNkO1lBQ0UsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLHFCQUFxQixNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDN0QsQ0FDRixDQUFDO1FBRUYsa0NBQWtDO1FBQ2xDLE1BQU0sd0JBQXdCLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FDL0QsSUFBSSxFQUNKLDBCQUEwQixFQUMxQiw2QkFBNkIsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUM1QyxDQUFDO1FBRUYsTUFBTSwyQkFBMkIsR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUNsRSxJQUFJLEVBQ0osNkJBQTZCLEVBQzdCLGdDQUFnQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQy9DLENBQUM7UUFFRiwrREFBK0Q7UUFDL0QsZ0NBQWdDO1FBQ2hDLCtEQUErRDtRQUUvRCx1QkFBdUI7UUFDdkIsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQ3JGLEtBQUssRUFBRSxZQUFZLENBQUMsR0FBRztZQUN2QixlQUFlLEVBQUUsV0FBVztZQUM1QixjQUFjLEVBQUUsc0JBQXNCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxxQ0FBcUMsd0JBQXdCLENBQUMsV0FBVyxjQUFjO1NBQzVJLENBQUMsQ0FBQztRQUVILDBCQUEwQjtRQUMxQixNQUFNLHFCQUFxQixHQUFHLElBQUksWUFBWSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDM0YsS0FBSyxFQUFFLFlBQVksQ0FBQyxHQUFHO1lBQ3ZCLGVBQWUsRUFBRSxXQUFXO1lBQzVCLGNBQWMsRUFBRSxzQkFBc0IsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLHFDQUFxQywyQkFBMkIsQ0FBQyxXQUFXLGNBQWM7U0FDL0ksQ0FBQyxDQUFDO1FBRUgsK0RBQStEO1FBQy9ELDBCQUEwQjtRQUMxQiwrREFBK0Q7UUFFL0QsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDOUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxHQUFHO1lBQ3ZCLFFBQVEsRUFBRSxVQUFVO1lBQ3BCLGlCQUFpQixFQUFFLE1BQU07WUFDekIsTUFBTSxFQUFFLGdCQUFnQixrQkFBa0IsQ0FBQyxHQUFHLEVBQUU7U0FDakQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUNqRCxLQUFLLEVBQUUsWUFBWSxDQUFDLEdBQUc7WUFDdkIsUUFBUSxFQUFFLGFBQWE7WUFDdkIsaUJBQWlCLEVBQUUsTUFBTTtZQUN6QixNQUFNLEVBQUUsZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtTQUNwRCxDQUFDLENBQUM7UUFFSCwrREFBK0Q7UUFDL0Qsb0JBQW9CO1FBQ3BCLCtEQUErRDtRQUUvRCwwREFBMEQ7UUFDMUQsd0JBQXdCLENBQUMsYUFBYSxDQUFDLHVCQUF1QixFQUFFO1lBQzlELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywwQkFBMEIsQ0FBQztZQUMvRCxTQUFTLEVBQUUsdUJBQXVCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLFlBQVksQ0FBQyxHQUFHLElBQUk7U0FDL0YsQ0FBQyxDQUFDO1FBRUgsMkJBQTJCLENBQUMsYUFBYSxDQUFDLHVCQUF1QixFQUFFO1lBQ2pFLFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywwQkFBMEIsQ0FBQztZQUMvRCxTQUFTLEVBQUUsdUJBQXVCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLFlBQVksQ0FBQyxHQUFHLElBQUk7U0FDL0YsQ0FBQyxDQUFDO1FBRUgsK0RBQStEO1FBQy9ELFVBQVU7UUFDViwrREFBK0Q7UUFFL0QsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSw4QkFBOEIsRUFBRTtZQUN0RCxLQUFLLEVBQUUsc0RBQXNEO1lBQzdELFdBQVcsRUFBRSw4QkFBOEI7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLFNBQVMsWUFBWSxDQUFDLEdBQUcsZ0JBQWdCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxrQkFBa0IsTUFBTSxDQUFDLEtBQUssRUFBRTtZQUM5RixXQUFXLEVBQUUsbUJBQW1CO1NBQ2pDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWpHRCw4REFpR0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdlYlNvY2tldCBJbnRlZ3JhdGlvbiBTdGFja1xuICpcbiAqIFRoaXMgc3RhY2sgY29ubmVjdHMgV2ViU29ja2V0IEFQSSByb3V0ZXMgdG8gTGFtYmRhIGZ1bmN0aW9ucy5cbiAqIERlcGxveSB0aGlzIEFGVEVSIHRoZSBtYWluIHN0YWNrcyB0byBhdm9pZCBjeWNsaWMgZGVwZW5kZW5jaWVzLlxuICpcbiAqIFVzYWdlOlxuICogICBucHggY2RrIGRlcGxveSBFZHVMZW5zV2ViU29ja2V0SW50ZWdyYXRpb25TdGFjay1kZXYgLS1jb250ZXh0IHN0YWdlPWRldlxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgV2ViU29ja2V0SW50ZWdyYXRpb25TdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgV2ViU29ja2V0SW50ZWdyYXRpb25TdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBXZWJTb2NrZXRJbnRlZ3JhdGlvblN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgY29uZmlnIH0gPSBwcm9wcztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEltcG9ydCBFeGlzdGluZyBSZXNvdXJjZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIEltcG9ydCBXZWJTb2NrZXQgQVBJIGJ5IG5hbWVcbiAgICBjb25zdCB3ZWJzb2NrZXRBcGkgPSBhcGlnYXRld2F5djIuQ2ZuQXBpLmZyb21DbG91ZEZvcm1hdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICAnV2ViU29ja2V0QXBpJyxcbiAgICAgIHtcbiAgICAgICAgcmVmOiBjZGsuRm4uaW1wb3J0VmFsdWUoYGVkdWxlbnMtd3MtYXBpLWlkLSR7Y29uZmlnLnN0YWdlfWApLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBJbXBvcnQgTGFtYmRhIGZ1bmN0aW9ucyBieSBuYW1lXG4gICAgY29uc3Qgd2Vic29ja2V0Q29ubmVjdEZ1bmN0aW9uID0gbGFtYmRhLkZ1bmN0aW9uLmZyb21GdW5jdGlvbk5hbWUoXG4gICAgICB0aGlzLFxuICAgICAgJ1dlYnNvY2tldENvbm5lY3RGdW5jdGlvbicsXG4gICAgICBgZWR1bGVucy13ZWJzb2NrZXQtY29ubmVjdC0ke2NvbmZpZy5zdGFnZX1gXG4gICAgKTtcblxuICAgIGNvbnN0IHdlYnNvY2tldERpc2Nvbm5lY3RGdW5jdGlvbiA9IGxhbWJkYS5GdW5jdGlvbi5mcm9tRnVuY3Rpb25OYW1lKFxuICAgICAgdGhpcyxcbiAgICAgICdXZWJzb2NrZXREaXNjb25uZWN0RnVuY3Rpb24nLFxuICAgICAgYGVkdWxlbnMtd2Vic29ja2V0LWRpc2Nvbm5lY3QtJHtjb25maWcuc3RhZ2V9YFxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDcmVhdGUgV2ViU29ja2V0IEludGVncmF0aW9uc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gJGNvbm5lY3QgSW50ZWdyYXRpb25cbiAgICBjb25zdCBjb25uZWN0SW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYyLkNmbkludGVncmF0aW9uKHRoaXMsICdDb25uZWN0SW50ZWdyYXRpb24nLCB7XG4gICAgICBhcGlJZDogd2Vic29ja2V0QXBpLnJlZixcbiAgICAgIGludGVncmF0aW9uVHlwZTogJ0FXU19QUk9YWScsXG4gICAgICBpbnRlZ3JhdGlvblVyaTogYGFybjphd3M6YXBpZ2F0ZXdheToke2Nkay5Bd3MuUkVHSU9OfTpsYW1iZGE6cGF0aC8yMDE1LTAzLTMxL2Z1bmN0aW9ucy8ke3dlYnNvY2tldENvbm5lY3RGdW5jdGlvbi5mdW5jdGlvbkFybn0vaW52b2NhdGlvbnNgLFxuICAgIH0pO1xuXG4gICAgLy8gJGRpc2Nvbm5lY3QgSW50ZWdyYXRpb25cbiAgICBjb25zdCBkaXNjb25uZWN0SW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheXYyLkNmbkludGVncmF0aW9uKHRoaXMsICdEaXNjb25uZWN0SW50ZWdyYXRpb24nLCB7XG4gICAgICBhcGlJZDogd2Vic29ja2V0QXBpLnJlZixcbiAgICAgIGludGVncmF0aW9uVHlwZTogJ0FXU19QUk9YWScsXG4gICAgICBpbnRlZ3JhdGlvblVyaTogYGFybjphd3M6YXBpZ2F0ZXdheToke2Nkay5Bd3MuUkVHSU9OfTpsYW1iZGE6cGF0aC8yMDE1LTAzLTMxL2Z1bmN0aW9ucy8ke3dlYnNvY2tldERpc2Nvbm5lY3RGdW5jdGlvbi5mdW5jdGlvbkFybn0vaW52b2NhdGlvbnNgLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ3JlYXRlIFdlYlNvY2tldCBSb3V0ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBhcGlnYXRld2F5djIuQ2ZuUm91dGUodGhpcywgJ0Nvbm5lY3RSb3V0ZScsIHtcbiAgICAgIGFwaUlkOiB3ZWJzb2NrZXRBcGkucmVmLFxuICAgICAgcm91dGVLZXk6ICckY29ubmVjdCcsXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogJ05PTkUnLFxuICAgICAgdGFyZ2V0OiBgaW50ZWdyYXRpb25zLyR7Y29ubmVjdEludGVncmF0aW9uLnJlZn1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGFwaWdhdGV3YXl2Mi5DZm5Sb3V0ZSh0aGlzLCAnRGlzY29ubmVjdFJvdXRlJywge1xuICAgICAgYXBpSWQ6IHdlYnNvY2tldEFwaS5yZWYsXG4gICAgICByb3V0ZUtleTogJyRkaXNjb25uZWN0JyxcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiAnTk9ORScsXG4gICAgICB0YXJnZXQ6IGBpbnRlZ3JhdGlvbnMvJHtkaXNjb25uZWN0SW50ZWdyYXRpb24ucmVmfWAsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBHcmFudCBQZXJtaXNzaW9uc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gR3JhbnQgQVBJIEdhdGV3YXkgcGVybWlzc2lvbiB0byBpbnZva2UgTGFtYmRhIGZ1bmN0aW9uc1xuICAgIHdlYnNvY2tldENvbm5lY3RGdW5jdGlvbi5hZGRQZXJtaXNzaW9uKCdBbGxvd0FwaUdhdGV3YXlJbnZva2UnLCB7XG4gICAgICBwcmluY2lwYWw6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJyksXG4gICAgICBzb3VyY2VBcm46IGBhcm46YXdzOmV4ZWN1dGUtYXBpOiR7Y2RrLkF3cy5SRUdJT059OiR7Y2RrLkF3cy5BQ0NPVU5UX0lEfToke3dlYnNvY2tldEFwaS5yZWZ9LypgLFxuICAgIH0pO1xuXG4gICAgd2Vic29ja2V0RGlzY29ubmVjdEZ1bmN0aW9uLmFkZFBlcm1pc3Npb24oJ0FsbG93QXBpR2F0ZXdheUludm9rZScsIHtcbiAgICAgIHByaW5jaXBhbDogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHNvdXJjZUFybjogYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OiR7d2Vic29ja2V0QXBpLnJlZn0vKmAsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBPdXRwdXRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0SW50ZWdyYXRpb25zQ3JlYXRlZCcsIHtcbiAgICAgIHZhbHVlOiAnV2ViU29ja2V0ICRjb25uZWN0IGFuZCAkZGlzY29ubmVjdCByb3V0ZXMgY29uZmlndXJlZCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBpbnRlZ3JhdGlvbiBzdGF0dXMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1dlYlNvY2tldFVybCcsIHtcbiAgICAgIHZhbHVlOiBgd3NzOi8vJHt3ZWJzb2NrZXRBcGkucmVmfS5leGVjdXRlLWFwaS4ke2Nkay5Bd3MuUkVHSU9OfS5hbWF6b25hd3MuY29tLyR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBBUEkgVVJMJyxcbiAgICB9KTtcbiAgfVxufVxuIl19