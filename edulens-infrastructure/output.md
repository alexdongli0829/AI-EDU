Outputs:
EduLensNetworkStack-dev.ExportsOutputFnGetAttAlbSecurityGroup86A59E99GroupIdE3A37BC7 = sg-040a35253998ecabb
EduLensNetworkStack-dev.ExportsOutputFnGetAttLambdaSecurityGroup0BD9FC99GroupId34A98CFB = sg-01a02ed9d5f88559b
EduLensNetworkStack-dev.ExportsOutputFnGetAttRdsSecurityGroup632A77E4GroupId9D343172 = sg-0934731ed1a829974
EduLensNetworkStack-dev.ExportsOutputFnGetAttRedisSecurityGroupB05951F6GroupIdECA64B37 = sg-0a6c3773615820628
EduLensNetworkStack-dev.ExportsOutputRefEduLensVpcIsolatedSubnet1Subnet552F580EB9C31932 = subnet-0c01f4945b03a0ba2
EduLensNetworkStack-dev.ExportsOutputRefEduLensVpcIsolatedSubnet2SubnetEF9AD25F9AB4F1FC = subnet-0316eedc7d435aa2b
EduLensNetworkStack-dev.ExportsOutputRefEduLensVpcPrivateSubnet1Subnet930754E88F2E6D0A = subnet-096c323babb1f5ff8
EduLensNetworkStack-dev.ExportsOutputRefEduLensVpcPrivateSubnet2Subnet100756684A49E0FC = subnet-009d07ab624bca25c
EduLensNetworkStack-dev.ExportsOutputRefEduLensVpcPublicSubnet1Subnet703163237D6AA035 = subnet-051c4c32d9e811d77
EduLensNetworkStack-dev.ExportsOutputRefEduLensVpcPublicSubnet2SubnetAEB3040895E5F72D = subnet-0a25456dcaad75836
EduLensNetworkStack-dev.LambdaSecurityGroupId = sg-01a02ed9d5f88559b
EduLensNetworkStack-dev.VpcCidr = 10.0.0.0/16
EduLensNetworkStack-dev.VpcId = vpc-04fb391c3e9df6702
Stack ARN:
arn:aws:cloudformation:us-east-1:163629398585:stack/EduLensNetworkStack-dev/785f9450-1e9b-11f1-94c1-12724fc59751

✨  Total time: 13.37s

EduLensJobsStack-dev
EduLensJobsStack-dev: deploying... [5/7]

 ✅  EduLensJobsStack-dev (no changes)

✨  Deployment time: 2.16s

Outputs:
EduLensJobsStack-dev.EventBusName = default
EduLensJobsStack-dev.ExportsOutputFnGetAttInsightsDLQAE053DA2QueueName1019B5F6 = edulens-insights-dlq-dev
EduLensJobsStack-dev.ExportsOutputFnGetAttInsightsQueueA6C46F56Arn73EFE3C6 = arn:aws:sqs:us-east-1:163629398585:edulens-insights-queue-dev
EduLensJobsStack-dev.ExportsOutputFnGetAttInsightsQueueA6C46F56QueueName74D3A2F1 = edulens-insights-queue-dev
EduLensJobsStack-dev.ExportsOutputFnGetAttSummarizationDLQEEC2E352QueueName70882B36 = edulens-summarization-dlq-dev
EduLensJobsStack-dev.ExportsOutputFnGetAttSummarizationQueue0AF3CA17ArnCC036F95 = arn:aws:sqs:us-east-1:163629398585:edulens-summarization-queue-dev
EduLensJobsStack-dev.ExportsOutputFnGetAttSummarizationQueue0AF3CA17QueueName5FC8DA82 = edulens-summarization-queue-dev
EduLensJobsStack-dev.ExportsOutputRefTestCompletedRule98856688B69468DB = edulens-test-completed-dev
EduLensJobsStack-dev.ExportsOutputRefTimerSyncRuleB3B78E810A8F3091 = edulens-timer-sync-dev
EduLensJobsStack-dev.InsightsQueueArn = arn:aws:sqs:us-east-1:163629398585:edulens-insights-queue-dev
EduLensJobsStack-dev.InsightsQueueUrl = https://sqs.us-east-1.amazonaws.com/163629398585/edulens-insights-queue-dev
EduLensJobsStack-dev.SummarizationQueueArn = arn:aws:sqs:us-east-1:163629398585:edulens-summarization-queue-dev
EduLensJobsStack-dev.SummarizationQueueUrl = https://sqs.us-east-1.amazonaws.com/163629398585/edulens-summarization-queue-dev
Stack ARN:
arn:aws:cloudformation:us-east-1:163629398585:stack/EduLensJobsStack-dev/314118f0-1e9b-11f1-8c8f-12ab72d647b7

✨  Total time: 10.92s

EduLensDatabaseStack-dev
EduLensDatabaseStack-dev: deploying... [2/7]

 ✅  EduLensDatabaseStack-dev (no changes)

✨  Deployment time: 2.04s

Outputs:
EduLensDatabaseStack-dev.AuroraClusterEndpoint = edulensdatabasestack-dev-auroracluster23d869c0-2uoa2nvebjnd.cluster-cqgesvmh6jqc.us-east-1.rds.amazonaws.com
EduLensDatabaseStack-dev.AuroraSecretArn = arn:aws:secretsmanager:us-east-1:163629398585:secret:edulens-db-credentials-dev-LIIr5l
EduLensDatabaseStack-dev.ExportsOutputFnGetAttRedisClusterRedisEndpointAddress2C712DA2 = edu-re-1kdsm6l3uy6pt.zlgexd.0001.use1.cache.amazonaws.com
EduLensDatabaseStack-dev.ExportsOutputFnGetAttWebSocketConnectionsTable7F0028CCArn489CA596 = arn:aws:dynamodb:us-east-1:163629398585:table/edulens-websocket-connections-dev
EduLensDatabaseStack-dev.ExportsOutputRefAuroraCluster23D869C0CA1C7DB5 = edulensdatabasestack-dev-auroracluster23d869c0-2uoa2nvebjnd
EduLensDatabaseStack-dev.ExportsOutputRefAuroraClusterSecretAttachmentDB8032DAFDEEBE73 = arn:aws:secretsmanager:us-east-1:163629398585:secret:edulens-db-credentials-dev-LIIr5l
EduLensDatabaseStack-dev.RedisEndpoint = edu-re-1kdsm6l3uy6pt.zlgexd.0001.use1.cache.amazonaws.com
EduLensDatabaseStack-dev.RedisPort = 6379
EduLensDatabaseStack-dev.WebSocketTableName = edulens-websocket-connections-dev
Stack ARN:
arn:aws:cloudformation:us-east-1:163629398585:stack/EduLensDatabaseStack-dev/66c69640-1e9f-11f1-8f80-0affecae193f

✨  Total time: 10.81s

EduLensLambdaStack-dev: start: Publishing EduLensLambdaStack-dev Template (163629398585-us-east-1-abdd0de3)
EduLensLambdaStack-dev: success: Published EduLensLambdaStack-dev Template (163629398585-us-east-1-abdd0de3)
EduLensLambdaStack-dev
EduLensLambdaStack-dev: deploying... [6/7]
EduLensLambdaStack-dev: creating CloudFormation changeset...

 ✅  EduLensApiGatewayStack-dev

✨  Deployment time: 61.95s

Outputs:
EduLensApiGatewayStack-dev.ApiKeyId = 7eprmp9j32
EduLensApiGatewayStack-dev.RestApiEndpoint0551178A = https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev/
EduLensApiGatewayStack-dev.RestApiId = z5hb4iztaj
EduLensApiGatewayStack-dev.RestApiUrl = https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev/
EduLensApiGatewayStack-dev.WebSocketApiId = rdtva58ibf
EduLensApiGatewayStack-dev.WebSocketApiUrl = wss://rdtva58ibf.execute-api.us-east-1.amazonaws.com/dev
