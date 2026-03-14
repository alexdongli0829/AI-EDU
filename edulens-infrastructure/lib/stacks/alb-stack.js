"use strict";
/**
 * Application Load Balancer Stack
 *
 * Creates ALB for SSE streaming endpoints (Conversation Engine)
 * API Gateway doesn't support long-lived connections well, so we use ALB
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
exports.AlbStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class AlbStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config, vpc, albSecurityGroup } = props;
        // ============================================================
        // Application Load Balancer
        // ============================================================
        this.alb = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
            vpc,
            internetFacing: true,
            loadBalancerName: `edulens-alb-${config.stage}`,
            securityGroup: albSecurityGroup,
            // Use public subnets
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            // Deletion protection (production only)
            deletionProtection: config.stage === 'prod',
            // Enable HTTP/2 (for SSE streaming)
            http2Enabled: true,
            // Idle timeout (important for SSE - default is 60s, increase for streaming)
            idleTimeout: cdk.Duration.seconds(300), // 5 minutes
        });
        // Access logs (production only)
        if (config.stage === 'prod') {
            const logGroup = new logs.LogGroup(this, 'AlbAccessLogs', {
                logGroupName: `/aws/alb/edulens-${config.stage}`,
                retention: config.logRetentionDays,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            // Note: ALB access logs typically go to S3, not CloudWatch
            // For production, you'd want to create an S3 bucket for ALB logs
        }
        // ============================================================
        // HTTP Listener (Port 80)
        // ============================================================
        this.httpListener = this.alb.addListener('HttpListener', {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            // Default action: return 404
            defaultAction: elbv2.ListenerAction.fixedResponse(404, {
                contentType: 'application/json',
                messageBody: JSON.stringify({
                    error: 'Not Found',
                    message: 'The requested resource was not found',
                }),
            }),
        });
        // ============================================================
        // HTTPS Listener (Port 443) - Production only
        // ============================================================
        // For production, you would add an HTTPS listener with a certificate
        // This requires a domain name and ACM certificate
        //
        // if (config.stage === 'prod') {
        //   const certificate = acm.Certificate.fromCertificateArn(
        //     this,
        //     'Certificate',
        //     'arn:aws:acm:...'
        //   );
        //
        //   this.httpsListener = this.alb.addListener('HttpsListener', {
        //     port: 443,
        //     protocol: elbv2.ApplicationProtocol.HTTPS,
        //     certificates: [certificate],
        //     defaultAction: elbv2.ListenerAction.fixedResponse(404),
        //   });
        // }
        // ============================================================
        // Target Groups (for Lambda targets - created in Lambda stack)
        // ============================================================
        // Target groups will be created in the Lambda stack and registered here
        // We'll create them for:
        // 1. Parent chat streaming endpoint
        // 2. Student chat streaming endpoint
        // ============================================================
        // Connection Draining
        // ============================================================
        // Set connection draining timeout (for graceful shutdowns)
        // This will be set on target groups in the Lambda stack
        // ============================================================
        // Health Checks
        // ============================================================
        // Health checks will be configured on target groups in Lambda stack
        // ============================================================
        // Outputs
        // ============================================================
        new cdk.CfnOutput(this, 'AlbDnsName', {
            value: this.alb.loadBalancerDnsName,
            description: 'ALB DNS name',
            exportName: `edulens-alb-dns-${config.stage}`,
        });
        new cdk.CfnOutput(this, 'AlbArn', {
            value: this.alb.loadBalancerArn,
            description: 'ALB ARN',
        });
        new cdk.CfnOutput(this, 'AlbUrl', {
            value: `http://${this.alb.loadBalancerDnsName}`,
            description: 'ALB URL (HTTP)',
        });
        // Add tags
        cdk.Tags.of(this.alb).add('Name', `edulens-alb-${config.stage}`);
    }
}
exports.AlbStack = AlbStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxiLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWxiLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyw4RUFBZ0U7QUFDaEUsMkRBQTZDO0FBVTdDLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBS3JDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFaEQsK0RBQStEO1FBQy9ELDRCQUE0QjtRQUM1QiwrREFBK0Q7UUFFL0QsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ2pFLEdBQUc7WUFDSCxjQUFjLEVBQUUsSUFBSTtZQUNwQixnQkFBZ0IsRUFBRSxlQUFlLE1BQU0sQ0FBQyxLQUFLLEVBQUU7WUFDL0MsYUFBYSxFQUFFLGdCQUFnQjtZQUUvQixxQkFBcUI7WUFDckIsVUFBVSxFQUFFO2dCQUNWLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07YUFDbEM7WUFFRCx3Q0FBd0M7WUFDeEMsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLEtBQUssS0FBSyxNQUFNO1lBRTNDLG9DQUFvQztZQUNwQyxZQUFZLEVBQUUsSUFBSTtZQUVsQiw0RUFBNEU7WUFDNUUsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLFlBQVk7U0FDckQsQ0FBQyxDQUFDO1FBRUgsZ0NBQWdDO1FBQ2hDLElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUM1QixNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtnQkFDeEQsWUFBWSxFQUFFLG9CQUFvQixNQUFNLENBQUMsS0FBSyxFQUFFO2dCQUNoRCxTQUFTLEVBQUUsTUFBTSxDQUFDLGdCQUFnQjtnQkFDbEMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTzthQUN6QyxDQUFDLENBQUM7WUFFSCwyREFBMkQ7WUFDM0QsaUVBQWlFO1FBQ25FLENBQUM7UUFFRCwrREFBK0Q7UUFDL0QsMEJBQTBCO1FBQzFCLCtEQUErRDtRQUUvRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRTtZQUN2RCxJQUFJLEVBQUUsRUFBRTtZQUNSLFFBQVEsRUFBRSxLQUFLLENBQUMsbUJBQW1CLENBQUMsSUFBSTtZQUV4Qyw2QkFBNkI7WUFDN0IsYUFBYSxFQUFFLEtBQUssQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRTtnQkFDckQsV0FBVyxFQUFFLGtCQUFrQjtnQkFDL0IsV0FBVyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQzFCLEtBQUssRUFBRSxXQUFXO29CQUNsQixPQUFPLEVBQUUsc0NBQXNDO2lCQUNoRCxDQUFDO2FBQ0gsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILCtEQUErRDtRQUMvRCw4Q0FBOEM7UUFDOUMsK0RBQStEO1FBRS9ELHFFQUFxRTtRQUNyRSxrREFBa0Q7UUFDbEQsRUFBRTtRQUNGLGlDQUFpQztRQUNqQyw0REFBNEQ7UUFDNUQsWUFBWTtRQUNaLHFCQUFxQjtRQUNyQix3QkFBd0I7UUFDeEIsT0FBTztRQUNQLEVBQUU7UUFDRixpRUFBaUU7UUFDakUsaUJBQWlCO1FBQ2pCLGlEQUFpRDtRQUNqRCxtQ0FBbUM7UUFDbkMsOERBQThEO1FBQzlELFFBQVE7UUFDUixJQUFJO1FBRUosK0RBQStEO1FBQy9ELCtEQUErRDtRQUMvRCwrREFBK0Q7UUFFL0Qsd0VBQXdFO1FBQ3hFLHlCQUF5QjtRQUN6QixvQ0FBb0M7UUFDcEMscUNBQXFDO1FBRXJDLCtEQUErRDtRQUMvRCxzQkFBc0I7UUFDdEIsK0RBQStEO1FBRS9ELDJEQUEyRDtRQUMzRCx3REFBd0Q7UUFFeEQsK0RBQStEO1FBQy9ELGdCQUFnQjtRQUNoQiwrREFBK0Q7UUFFL0Qsb0VBQW9FO1FBRXBFLCtEQUErRDtRQUMvRCxVQUFVO1FBQ1YsK0RBQStEO1FBRS9ELElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtZQUNuQyxXQUFXLEVBQUUsY0FBYztZQUMzQixVQUFVLEVBQUUsbUJBQW1CLE1BQU0sQ0FBQyxLQUFLLEVBQUU7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDaEMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsZUFBZTtZQUMvQixXQUFXLEVBQUUsU0FBUztTQUN2QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUNoQyxLQUFLLEVBQUUsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFO1lBQy9DLFdBQVcsRUFBRSxnQkFBZ0I7U0FDOUIsQ0FBQyxDQUFDO1FBRUgsV0FBVztRQUNYLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLGVBQWUsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDbkUsQ0FBQztDQUNGO0FBcElELDRCQW9JQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQXBwbGljYXRpb24gTG9hZCBCYWxhbmNlciBTdGFja1xuICpcbiAqIENyZWF0ZXMgQUxCIGZvciBTU0Ugc3RyZWFtaW5nIGVuZHBvaW50cyAoQ29udmVyc2F0aW9uIEVuZ2luZSlcbiAqIEFQSSBHYXRld2F5IGRvZXNuJ3Qgc3VwcG9ydCBsb25nLWxpdmVkIGNvbm5lY3Rpb25zIHdlbGwsIHNvIHdlIHVzZSBBTEJcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgZWxidjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEVudmlyb25tZW50Q29uZmlnIH0gZnJvbSAnLi4vLi4vY29uZmlnL2Vudmlyb25tZW50cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQWxiU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgY29uZmlnOiBFbnZpcm9ubWVudENvbmZpZztcbiAgdnBjOiBlYzIuVnBjO1xuICBhbGJTZWN1cml0eUdyb3VwOiBlYzIuU2VjdXJpdHlHcm91cDtcbn1cblxuZXhwb3J0IGNsYXNzIEFsYlN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGFsYjogZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXI7XG4gIHB1YmxpYyByZWFkb25seSBodHRwTGlzdGVuZXI6IGVsYnYyLkFwcGxpY2F0aW9uTGlzdGVuZXI7XG4gIHB1YmxpYyByZWFkb25seSBodHRwc0xpc3RlbmVyPzogZWxidjIuQXBwbGljYXRpb25MaXN0ZW5lcjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQWxiU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBjb25maWcsIHZwYywgYWxiU2VjdXJpdHlHcm91cCB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICB0aGlzLmFsYiA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcih0aGlzLCAnTG9hZEJhbGFuY2VyJywge1xuICAgICAgdnBjLFxuICAgICAgaW50ZXJuZXRGYWNpbmc6IHRydWUsXG4gICAgICBsb2FkQmFsYW5jZXJOYW1lOiBgZWR1bGVucy1hbGItJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IGFsYlNlY3VyaXR5R3JvdXAsXG5cbiAgICAgIC8vIFVzZSBwdWJsaWMgc3VibmV0c1xuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICB9LFxuXG4gICAgICAvLyBEZWxldGlvbiBwcm90ZWN0aW9uIChwcm9kdWN0aW9uIG9ubHkpXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnLFxuXG4gICAgICAvLyBFbmFibGUgSFRUUC8yIChmb3IgU1NFIHN0cmVhbWluZylcbiAgICAgIGh0dHAyRW5hYmxlZDogdHJ1ZSxcblxuICAgICAgLy8gSWRsZSB0aW1lb3V0IChpbXBvcnRhbnQgZm9yIFNTRSAtIGRlZmF1bHQgaXMgNjBzLCBpbmNyZWFzZSBmb3Igc3RyZWFtaW5nKVxuICAgICAgaWRsZVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksIC8vIDUgbWludXRlc1xuICAgIH0pO1xuXG4gICAgLy8gQWNjZXNzIGxvZ3MgKHByb2R1Y3Rpb24gb25seSlcbiAgICBpZiAoY29uZmlnLnN0YWdlID09PSAncHJvZCcpIHtcbiAgICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FsYkFjY2Vzc0xvZ3MnLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYWxiL2VkdWxlbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgICAgcmV0ZW50aW9uOiBjb25maWcubG9nUmV0ZW50aW9uRGF5cyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBOb3RlOiBBTEIgYWNjZXNzIGxvZ3MgdHlwaWNhbGx5IGdvIHRvIFMzLCBub3QgQ2xvdWRXYXRjaFxuICAgICAgLy8gRm9yIHByb2R1Y3Rpb24sIHlvdSdkIHdhbnQgdG8gY3JlYXRlIGFuIFMzIGJ1Y2tldCBmb3IgQUxCIGxvZ3NcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBIVFRQIExpc3RlbmVyIChQb3J0IDgwKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdGhpcy5odHRwTGlzdGVuZXIgPSB0aGlzLmFsYi5hZGRMaXN0ZW5lcignSHR0cExpc3RlbmVyJywge1xuICAgICAgcG9ydDogODAsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuXG4gICAgICAvLyBEZWZhdWx0IGFjdGlvbjogcmV0dXJuIDQwNFxuICAgICAgZGVmYXVsdEFjdGlvbjogZWxidjIuTGlzdGVuZXJBY3Rpb24uZml4ZWRSZXNwb25zZSg0MDQsIHtcbiAgICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgbWVzc2FnZUJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBlcnJvcjogJ05vdCBGb3VuZCcsXG4gICAgICAgICAgbWVzc2FnZTogJ1RoZSByZXF1ZXN0ZWQgcmVzb3VyY2Ugd2FzIG5vdCBmb3VuZCcsXG4gICAgICAgIH0pLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBIVFRQUyBMaXN0ZW5lciAoUG9ydCA0NDMpIC0gUHJvZHVjdGlvbiBvbmx5XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBGb3IgcHJvZHVjdGlvbiwgeW91IHdvdWxkIGFkZCBhbiBIVFRQUyBsaXN0ZW5lciB3aXRoIGEgY2VydGlmaWNhdGVcbiAgICAvLyBUaGlzIHJlcXVpcmVzIGEgZG9tYWluIG5hbWUgYW5kIEFDTSBjZXJ0aWZpY2F0ZVxuICAgIC8vXG4gICAgLy8gaWYgKGNvbmZpZy5zdGFnZSA9PT0gJ3Byb2QnKSB7XG4gICAgLy8gICBjb25zdCBjZXJ0aWZpY2F0ZSA9IGFjbS5DZXJ0aWZpY2F0ZS5mcm9tQ2VydGlmaWNhdGVBcm4oXG4gICAgLy8gICAgIHRoaXMsXG4gICAgLy8gICAgICdDZXJ0aWZpY2F0ZScsXG4gICAgLy8gICAgICdhcm46YXdzOmFjbTouLi4nXG4gICAgLy8gICApO1xuICAgIC8vXG4gICAgLy8gICB0aGlzLmh0dHBzTGlzdGVuZXIgPSB0aGlzLmFsYi5hZGRMaXN0ZW5lcignSHR0cHNMaXN0ZW5lcicsIHtcbiAgICAvLyAgICAgcG9ydDogNDQzLFxuICAgIC8vICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQUyxcbiAgICAvLyAgICAgY2VydGlmaWNhdGVzOiBbY2VydGlmaWNhdGVdLFxuICAgIC8vICAgICBkZWZhdWx0QWN0aW9uOiBlbGJ2Mi5MaXN0ZW5lckFjdGlvbi5maXhlZFJlc3BvbnNlKDQwNCksXG4gICAgLy8gICB9KTtcbiAgICAvLyB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBUYXJnZXQgR3JvdXBzIChmb3IgTGFtYmRhIHRhcmdldHMgLSBjcmVhdGVkIGluIExhbWJkYSBzdGFjaylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIFRhcmdldCBncm91cHMgd2lsbCBiZSBjcmVhdGVkIGluIHRoZSBMYW1iZGEgc3RhY2sgYW5kIHJlZ2lzdGVyZWQgaGVyZVxuICAgIC8vIFdlJ2xsIGNyZWF0ZSB0aGVtIGZvcjpcbiAgICAvLyAxLiBQYXJlbnQgY2hhdCBzdHJlYW1pbmcgZW5kcG9pbnRcbiAgICAvLyAyLiBTdHVkZW50IGNoYXQgc3RyZWFtaW5nIGVuZHBvaW50XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDb25uZWN0aW9uIERyYWluaW5nXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBTZXQgY29ubmVjdGlvbiBkcmFpbmluZyB0aW1lb3V0IChmb3IgZ3JhY2VmdWwgc2h1dGRvd25zKVxuICAgIC8vIFRoaXMgd2lsbCBiZSBzZXQgb24gdGFyZ2V0IGdyb3VwcyBpbiB0aGUgTGFtYmRhIHN0YWNrXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBIZWFsdGggQ2hlY2tzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBIZWFsdGggY2hlY2tzIHdpbGwgYmUgY29uZmlndXJlZCBvbiB0YXJnZXQgZ3JvdXBzIGluIExhbWJkYSBzdGFja1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FsYkRuc05hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hbGIubG9hZEJhbGFuY2VyRG5zTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUxCIEROUyBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBlZHVsZW5zLWFsYi1kbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGJBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hbGIubG9hZEJhbGFuY2VyQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBTEIgQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGJVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHA6Ly8ke3RoaXMuYWxiLmxvYWRCYWxhbmNlckRuc05hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUxCIFVSTCAoSFRUUCknLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIHRhZ3NcbiAgICBjZGsuVGFncy5vZih0aGlzLmFsYikuYWRkKCdOYW1lJywgYGVkdWxlbnMtYWxiLSR7Y29uZmlnLnN0YWdlfWApO1xuICB9XG59XG4iXX0=