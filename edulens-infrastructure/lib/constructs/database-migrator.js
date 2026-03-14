"use strict";
/**
 * Database Migrator Custom Resource
 *
 * Runs database migrations automatically during CDK deployment
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
exports.DatabaseMigrator = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class DatabaseMigrator extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Lambda function to run migrations
        const migrationFunction = new lambda.Function(this, 'MigrationFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(props.migrationScriptPath),
            timeout: cdk.Duration.minutes(5),
            memorySize: 512,
            vpc: props.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            securityGroups: [props.securityGroup],
            environment: {
                DB_SECRET_ARN: props.databaseSecret.secretArn,
            },
        });
        // Grant read access to database secret
        props.databaseSecret.grantRead(migrationFunction);
        // Custom resource provider
        const provider = new cr.Provider(this, 'MigrationProvider', {
            onEventHandler: migrationFunction,
            logRetention: logs.RetentionDays.ONE_DAY,
        });
        // Custom resource that triggers migration
        this.customResource = new cdk.CustomResource(this, 'MigrationResource', {
            serviceToken: provider.serviceToken,
            properties: {
                // Change this version to trigger re-run of migrations
                Version: '1.0.0',
            },
        });
    }
}
exports.DatabaseMigrator = DatabaseMigrator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2UtbWlncmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhYmFzZS1taWdyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFFM0MsaUVBQW1EO0FBQ25ELDJEQUE2QztBQUM3QywyQ0FBdUM7QUFVdkMsTUFBYSxnQkFBaUIsU0FBUSxzQkFBUztJQUc3QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTRCO1FBQ3BFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsb0NBQW9DO1FBQ3BDLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN2RSxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLENBQUM7WUFDdEQsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNoQyxVQUFVLEVBQUUsR0FBRztZQUNmLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztZQUNkLFVBQVUsRUFBRSxFQUFFLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQixFQUFFO1lBQzlELGNBQWMsRUFBRSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUM7WUFDckMsV0FBVyxFQUFFO2dCQUNYLGFBQWEsRUFBRSxLQUFLLENBQUMsY0FBYyxDQUFDLFNBQVM7YUFDOUM7U0FDRixDQUFDLENBQUM7UUFFSCx1Q0FBdUM7UUFDdkMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUVsRCwyQkFBMkI7UUFDM0IsTUFBTSxRQUFRLEdBQUcsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMxRCxjQUFjLEVBQUUsaUJBQWlCO1lBQ2pDLFlBQVksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsMENBQTBDO1FBQzFDLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN0RSxZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVk7WUFDbkMsVUFBVSxFQUFFO2dCQUNWLHNEQUFzRDtnQkFDdEQsT0FBTyxFQUFFLE9BQU87YUFDakI7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF2Q0QsNENBdUNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEYXRhYmFzZSBNaWdyYXRvciBDdXN0b20gUmVzb3VyY2VcbiAqXG4gKiBSdW5zIGRhdGFiYXNlIG1pZ3JhdGlvbnMgYXV0b21hdGljYWxseSBkdXJpbmcgQ0RLIGRlcGxveW1lbnRcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGNyIGZyb20gJ2F3cy1jZGstbGliL2N1c3RvbS1yZXNvdXJjZXMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGF0YWJhc2VNaWdyYXRvclByb3BzIHtcbiAgdnBjOiBlYzIuSVZwYztcbiAgc2VjdXJpdHlHcm91cDogZWMyLklTZWN1cml0eUdyb3VwO1xuICBkYXRhYmFzZVNlY3JldDogc2VjcmV0c21hbmFnZXIuSVNlY3JldDtcbiAgbWlncmF0aW9uU2NyaXB0UGF0aDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRGF0YWJhc2VNaWdyYXRvciBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21SZXNvdXJjZTogY2RrLkN1c3RvbVJlc291cmNlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBEYXRhYmFzZU1pZ3JhdG9yUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIHRvIHJ1biBtaWdyYXRpb25zXG4gICAgY29uc3QgbWlncmF0aW9uRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdNaWdyYXRpb25GdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHByb3BzLm1pZ3JhdGlvblNjcmlwdFBhdGgpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICB2cGM6IHByb3BzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtwcm9wcy5zZWN1cml0eUdyb3VwXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERCX1NFQ1JFVF9BUk46IHByb3BzLmRhdGFiYXNlU2VjcmV0LnNlY3JldEFybixcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCByZWFkIGFjY2VzcyB0byBkYXRhYmFzZSBzZWNyZXRcbiAgICBwcm9wcy5kYXRhYmFzZVNlY3JldC5ncmFudFJlYWQobWlncmF0aW9uRnVuY3Rpb24pO1xuXG4gICAgLy8gQ3VzdG9tIHJlc291cmNlIHByb3ZpZGVyXG4gICAgY29uc3QgcHJvdmlkZXIgPSBuZXcgY3IuUHJvdmlkZXIodGhpcywgJ01pZ3JhdGlvblByb3ZpZGVyJywge1xuICAgICAgb25FdmVudEhhbmRsZXI6IG1pZ3JhdGlvbkZ1bmN0aW9uLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX0RBWSxcbiAgICB9KTtcblxuICAgIC8vIEN1c3RvbSByZXNvdXJjZSB0aGF0IHRyaWdnZXJzIG1pZ3JhdGlvblxuICAgIHRoaXMuY3VzdG9tUmVzb3VyY2UgPSBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHRoaXMsICdNaWdyYXRpb25SZXNvdXJjZScsIHtcbiAgICAgIHNlcnZpY2VUb2tlbjogcHJvdmlkZXIuc2VydmljZVRva2VuLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAvLyBDaGFuZ2UgdGhpcyB2ZXJzaW9uIHRvIHRyaWdnZXIgcmUtcnVuIG9mIG1pZ3JhdGlvbnNcbiAgICAgICAgVmVyc2lvbjogJzEuMC4wJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==