/**
 * API Gateway Stack
 *
 * Creates REST API and WebSocket API for EduLens services
 */
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environments';
export interface ApiGatewayStackProps extends cdk.StackProps {
    config: EnvironmentConfig;
}
export declare class ApiGatewayStack extends cdk.Stack {
    readonly restApi: apigateway.RestApi;
    readonly websocketApi: apigatewayv2.CfnApi;
    readonly websocketStage: apigatewayv2.CfnStage;
    constructor(scope: Construct, id: string, props: ApiGatewayStackProps);
}
