"use strict";
/**
 * Application Load Balancer Stack
 *
 * Creates ALB for SSE streaming endpoints (Conversation Engine).
 * Call addTargetGroups() from app.ts after LambdaStack is created.
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
const elbv2_targets = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2-targets"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class AlbStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { config, vpc, albSecurityGroup } = props;
        this.config = config;
        // ============================================================
        // Application Load Balancer
        // ============================================================
        this.alb = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
            vpc,
            internetFacing: true,
            loadBalancerName: `edulens-alb-${config.stage}`,
            securityGroup: albSecurityGroup,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
            },
            deletionProtection: config.stage === 'prod',
            http2Enabled: true,
            idleTimeout: cdk.Duration.seconds(300),
        });
        if (config.stage === 'prod') {
            new logs.LogGroup(this, 'AlbAccessLogs', {
                logGroupName: `/aws/alb/edulens-${config.stage}`,
                retention: config.logRetentionDays,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
        }
        // ============================================================
        // HTTP Listener (Port 80)
        // ============================================================
        this.httpListener = this.alb.addListener('HttpListener', {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            defaultAction: elbv2.ListenerAction.fixedResponse(404, {
                contentType: 'application/json',
                messageBody: JSON.stringify({
                    error: 'Not Found',
                    message: 'The requested resource was not found',
                }),
            }),
        });
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
        cdk.Tags.of(this.alb).add('Name', `edulens-alb-${config.stage}`);
    }
    // ============================================================
    // Wire SSE streaming Lambda targets (called from app.ts)
    // ============================================================
    addTargetGroups(parentChatSendStreamFunction, studentChatSendStreamFunction) {
        const { config } = this;
        const parentStreamTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ParentStreamTargetGroup', {
            targetGroupName: `edulens-parent-stream-${config.stage}`,
            targetType: elbv2.TargetType.LAMBDA,
            targets: [new elbv2_targets.LambdaTarget(parentChatSendStreamFunction)],
            healthCheck: {
                enabled: false,
            },
        });
        const studentStreamTargetGroup = new elbv2.ApplicationTargetGroup(this, 'StudentStreamTargetGroup', {
            targetGroupName: `edulens-student-stream-${config.stage}`,
            targetType: elbv2.TargetType.LAMBDA,
            targets: [new elbv2_targets.LambdaTarget(studentChatSendStreamFunction)],
            healthCheck: {
                enabled: false,
            },
        });
        this.httpListener.addTargetGroups('ParentStreamRule', {
            priority: 10,
            conditions: [
                elbv2.ListenerCondition.pathPatterns(['/parent-chat/*/send']),
            ],
            targetGroups: [parentStreamTargetGroup],
        });
        this.httpListener.addTargetGroups('StudentStreamRule', {
            priority: 20,
            conditions: [
                elbv2.ListenerCondition.pathPatterns(['/student-chat/*/send']),
            ],
            targetGroups: [studentStreamTargetGroup],
        });
    }
}
exports.AlbStack = AlbStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxiLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWxiLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7R0FLRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyw4RUFBZ0U7QUFDaEUsOEZBQWdGO0FBRWhGLDJEQUE2QztBQVU3QyxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsS0FBSztJQU9yQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW9CO1FBQzVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLGdCQUFnQixFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQ2hELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBRXJCLCtEQUErRDtRQUMvRCw0QkFBNEI7UUFDNUIsK0RBQStEO1FBRS9ELElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUNqRSxHQUFHO1lBQ0gsY0FBYyxFQUFFLElBQUk7WUFDcEIsZ0JBQWdCLEVBQUUsZUFBZSxNQUFNLENBQUMsS0FBSyxFQUFFO1lBQy9DLGFBQWEsRUFBRSxnQkFBZ0I7WUFDL0IsVUFBVSxFQUFFO2dCQUNWLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU07YUFDbEM7WUFDRCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsS0FBSyxLQUFLLE1BQU07WUFDM0MsWUFBWSxFQUFFLElBQUk7WUFDbEIsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQztTQUN2QyxDQUFDLENBQUM7UUFFSCxJQUFJLE1BQU0sQ0FBQyxLQUFLLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDNUIsSUFB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LEtBQUs7YUFDZjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFFO1lBQ3BELFFBQVEsRUFBRSxFQUFFO1lBQ1osVUFBVSxFQUFFO2dCQUNWLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO2FBQzlEO1lBQ0QsWUFBWSxFQUFFLENBQUMsdUJBQXVCLENBQUM7U0FDeEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUMsbUJBQW1CLEVBQUU7WUFDckQsUUFBUSxFQUFFLEVBQUU7WUFDWixVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxDQUFDLHNCQUFzQixDQUFDLENBQUM7YUFDL0Q7WUFDRCxZQUFZLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQztTQUN6QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6SEQsNEJBeUhDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyIFN0YWNrXG4gKlxuICogQ3JlYXRlcyBBTEIgZm9yIFNTRSBzdHJlYW1pbmcgZW5kcG9pbnRzIChDb252ZXJzYXRpb24gRW5naW5lKS5cbiAqIENhbGwgYWRkVGFyZ2V0R3JvdXBzKCkgZnJvbSBhcHAudHMgYWZ0ZXIgTGFtYmRhU3RhY2sgaXMgY3JlYXRlZC5cbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgZWxidjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjInO1xuaW1wb3J0ICogYXMgZWxidjJfdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mi10YXJnZXRzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4uLy4uL2NvbmZpZy9lbnZpcm9ubWVudHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEFsYlN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGNvbmZpZzogRW52aXJvbm1lbnRDb25maWc7XG4gIHZwYzogZWMyLlZwYztcbiAgYWxiU2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXA7XG59XG5cbmV4cG9ydCBjbGFzcyBBbGJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBhbGI6IGVsYnYyLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VyO1xuICBwdWJsaWMgcmVhZG9ubHkgaHR0cExpc3RlbmVyOiBlbGJ2Mi5BcHBsaWNhdGlvbkxpc3RlbmVyO1xuICBwdWJsaWMgcmVhZG9ubHkgaHR0cHNMaXN0ZW5lcj86IGVsYnYyLkFwcGxpY2F0aW9uTGlzdGVuZXI7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBjb25maWc6IEVudmlyb25tZW50Q29uZmlnO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBbGJTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IGNvbmZpZywgdnBjLCBhbGJTZWN1cml0eUdyb3VwIH0gPSBwcm9wcztcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMuYWxiID0gbmV3IGVsYnYyLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VyKHRoaXMsICdMb2FkQmFsYW5jZXInLCB7XG4gICAgICB2cGMsXG4gICAgICBpbnRlcm5ldEZhY2luZzogdHJ1ZSxcbiAgICAgIGxvYWRCYWxhbmNlck5hbWU6IGBlZHVsZW5zLWFsYi0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgc2VjdXJpdHlHcm91cDogYWxiU2VjdXJpdHlHcm91cCxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgfSxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogY29uZmlnLnN0YWdlID09PSAncHJvZCcsXG4gICAgICBodHRwMkVuYWJsZWQ6IHRydWUsXG4gICAgICBpZGxlVGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSxcbiAgICB9KTtcblxuICAgIGlmIChjb25maWcuc3RhZ2UgPT09ICdwcm9kJykge1xuICAgICAgbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FsYkFjY2Vzc0xvZ3MnLCB7XG4gICAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYWxiL2VkdWxlbnMtJHtjb25maWcuc3RhZ2V9YCxcbiAgICAgICAgcmV0ZW50aW9uOiBjb25maWcubG9nUmV0ZW50aW9uRGF5cyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEhUVFAgTGlzdGVuZXIgKFBvcnQgODApXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICB0aGlzLmh0dHBMaXN0ZW5lciA9IHRoaXMuYWxiLmFkZExpc3RlbmVyKCdIdHRwTGlzdGVuZXInLCB7XG4gICAgICBwb3J0OiA4MCxcbiAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFAsXG4gICAgICBkZWZhdWx0QWN0aW9uOiBlbGJ2Mi5MaXN0ZW5lckFjdGlvbi5maXhlZFJlc3BvbnNlKDQwNCwge1xuICAgICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBtZXNzYWdlQm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiAnTm90IEZvdW5kJyxcbiAgICAgICAgICBtZXNzYWdlOiAnVGhlIHJlcXVlc3RlZCByZXNvdXJjZSB3YXMgbm90IGZvdW5kJyxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE91dHB1dHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBbGJEbnNOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuYWxiLmxvYWRCYWxhbmNlckRuc05hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FMQiBETlMgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgZWR1bGVucy1hbGItZG5zLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxiQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYWxiLmxvYWRCYWxhbmNlckFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUxCIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxiVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwOi8vJHt0aGlzLmFsYi5sb2FkQmFsYW5jZXJEbnNOYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FMQiBVUkwgKEhUVFApJyxcbiAgICB9KTtcblxuICAgIGNkay5UYWdzLm9mKHRoaXMuYWxiKS5hZGQoJ05hbWUnLCBgZWR1bGVucy1hbGItJHtjb25maWcuc3RhZ2V9YCk7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgLy8gV2lyZSBTU0Ugc3RyZWFtaW5nIExhbWJkYSB0YXJnZXRzIChjYWxsZWQgZnJvbSBhcHAudHMpXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gIGFkZFRhcmdldEdyb3VwcyhcbiAgICBwYXJlbnRDaGF0U2VuZFN0cmVhbUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24sXG4gICAgc3R1ZGVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbixcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb25maWcgfSA9IHRoaXM7XG5cbiAgICBjb25zdCBwYXJlbnRTdHJlYW1UYXJnZXRHcm91cCA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvblRhcmdldEdyb3VwKHRoaXMsICdQYXJlbnRTdHJlYW1UYXJnZXRHcm91cCcsIHtcbiAgICAgIHRhcmdldEdyb3VwTmFtZTogYGVkdWxlbnMtcGFyZW50LXN0cmVhbS0ke2NvbmZpZy5zdGFnZX1gLFxuICAgICAgdGFyZ2V0VHlwZTogZWxidjIuVGFyZ2V0VHlwZS5MQU1CREEsXG4gICAgICB0YXJnZXRzOiBbbmV3IGVsYnYyX3RhcmdldHMuTGFtYmRhVGFyZ2V0KHBhcmVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24pXSxcbiAgICAgIGhlYWx0aENoZWNrOiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHN0dWRlbnRTdHJlYW1UYXJnZXRHcm91cCA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvblRhcmdldEdyb3VwKHRoaXMsICdTdHVkZW50U3RyZWFtVGFyZ2V0R3JvdXAnLCB7XG4gICAgICB0YXJnZXRHcm91cE5hbWU6IGBlZHVsZW5zLXN0dWRlbnQtc3RyZWFtLSR7Y29uZmlnLnN0YWdlfWAsXG4gICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLkxBTUJEQSxcbiAgICAgIHRhcmdldHM6IFtuZXcgZWxidjJfdGFyZ2V0cy5MYW1iZGFUYXJnZXQoc3R1ZGVudENoYXRTZW5kU3RyZWFtRnVuY3Rpb24pXSxcbiAgICAgIGhlYWx0aENoZWNrOiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuaHR0cExpc3RlbmVyLmFkZFRhcmdldEdyb3VwcygnUGFyZW50U3RyZWFtUnVsZScsIHtcbiAgICAgIHByaW9yaXR5OiAxMCxcbiAgICAgIGNvbmRpdGlvbnM6IFtcbiAgICAgICAgZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFsnL3BhcmVudC1jaGF0Lyovc2VuZCddKSxcbiAgICAgIF0sXG4gICAgICB0YXJnZXRHcm91cHM6IFtwYXJlbnRTdHJlYW1UYXJnZXRHcm91cF0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmh0dHBMaXN0ZW5lci5hZGRUYXJnZXRHcm91cHMoJ1N0dWRlbnRTdHJlYW1SdWxlJywge1xuICAgICAgcHJpb3JpdHk6IDIwLFxuICAgICAgY29uZGl0aW9uczogW1xuICAgICAgICBlbGJ2Mi5MaXN0ZW5lckNvbmRpdGlvbi5wYXRoUGF0dGVybnMoWycvc3R1ZGVudC1jaGF0Lyovc2VuZCddKSxcbiAgICAgIF0sXG4gICAgICB0YXJnZXRHcm91cHM6IFtzdHVkZW50U3RyZWFtVGFyZ2V0R3JvdXBdLFxuICAgIH0pO1xuICB9XG59XG4iXX0=