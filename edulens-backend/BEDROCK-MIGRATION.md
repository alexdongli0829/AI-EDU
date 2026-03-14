# AWS Bedrock Migration Guide

This guide explains how to use AWS Bedrock instead of the Anthropic API for the EduLens platform.

## Why AWS Bedrock?

**Benefits:**
- ✅ **Better AWS Integration** - Native AWS service with IAM authentication
- ✅ **No API Key Management** - Uses IAM roles instead of secrets
- ✅ **Same Claude Models** - Access to Claude 3.5 Sonnet and Haiku
- ✅ **AWS Billing** - Consolidated billing with other AWS services
- ✅ **VPC Endpoints** - Can use private VPC endpoints for security
- ✅ **CloudWatch Integration** - Native logging and monitoring

**Pricing:** Same as Anthropic API (no markup for Bedrock)

---

## Infrastructure Changes

### Lambda Stack Updates

The CDK infrastructure has been updated to use Bedrock:

1. **Removed:** Anthropic API key from Secrets Manager
2. **Added:** IAM permissions for `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream`
3. **Updated:** Environment variables to use `AI_PROVIDER=bedrock`

**Lambda IAM Policy:**
```typescript
function.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
    resources: [
      'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0',
      'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0',
    ],
  })
);
```

---

## Service Code Changes

### Node.js Services (Conversation Engine)

**New Bedrock Client:**
- Location: `services/conversation-engine/src/clients/bedrock-client.ts`
- Replaces: `@anthropic-ai/sdk`

**Key Methods:**
```typescript
import { getBedrockClient, BedrockMessage } from '../clients/bedrock-client';

const client = getBedrockClient();

// Streaming (for SSE)
await client.streamMessage(
  messages,
  systemPrompt,
  {
    onText: (text) => console.log(text),
    onComplete: () => console.log('Done'),
    onError: (err) => console.error(err),
  },
  'sonnet' // or 'haiku'
);

// Non-streaming
const response = await client.invokeMessage(
  messages,
  systemPrompt,
  'haiku'
);
```

**Migration Steps:**
1. Replace `@anthropic-ai/sdk` imports with `bedrock-client`
2. Update message format to `BedrockMessage[]`
3. Change model names: `claude-sonnet-4.5-20250929` → `sonnet`
4. Remove `ANTHROPIC_API_KEY` environment variable checks

**Example:**
```typescript
// BEFORE (Anthropic SDK)
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4.5-20250929',
  max_tokens: 4096,
  system: systemPrompt,
  messages: messages,
});

// AFTER (Bedrock)
import { getBedrockClient } from '../clients/bedrock-client';

const client = getBedrockClient();

await client.streamMessage(
  messages,
  systemPrompt,
  {
    onText: (text) => handleText(text),
    onComplete: () => handleComplete(),
  },
  'sonnet'
);
```

---

### Python Services (Background Jobs)

**New Bedrock Client:**
- Location: `services/background-jobs/src/clients/bedrock_client.py`
- Replaces: `anthropic` library

**Key Methods:**
```python
from src.clients.bedrock_client import get_bedrock_client, BedrockMessage

client = get_bedrock_client()

# Non-streaming
response = client.invoke_message(
    messages=[
        BedrockMessage(role='user', content='Hello'),
    ],
    system_prompt='You are a helpful assistant',
    model='haiku',  # or 'sonnet'
    max_tokens=4096,
)

# With JSON response
data = client.invoke_with_json_response(
    messages=messages,
    system_prompt='Return JSON only...',
    model='haiku',
)
```

**Migration Steps:**
1. Replace `import anthropic` with `from src.clients.bedrock_client import get_bedrock_client`
2. Update message format to `BedrockMessage` objects
3. Change model names: `claude-haiku-4.5-20241022` → `haiku`
4. Remove `ANTHROPIC_API_KEY` environment variable checks

**Example:**
```python
# BEFORE (Anthropic SDK)
import anthropic

client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

message = client.messages.create(
    model='claude-haiku-4.5-20241022',
    max_tokens=4096,
    system=system_prompt,
    messages=messages,
)

response_text = message.content[0].text

# AFTER (Bedrock)
from src.clients.bedrock_client import get_bedrock_client, BedrockMessage

client = get_bedrock_client()

response_text = client.invoke_message(
    messages=[BedrockMessage(role='user', content=user_msg)],
    system_prompt=system_prompt,
    model='haiku',
    max_tokens=4096,
)
```

---

## Model Mapping

| Anthropic API Model | Bedrock Model ID | Shorthand |
|---------------------|------------------|-----------|
| claude-sonnet-4.5-20250929 | anthropic.claude-3-5-sonnet-20241022-v2:0 | `sonnet` |
| claude-haiku-4.5-20241022 | anthropic.claude-3-5-haiku-20241022-v1:0 | `haiku` |

**Note:** Use the shorthand in your code. The Bedrock client handles the full model ID.

---

## Deployment Changes

### Step 1: Enable Bedrock Model Access

Before deploying, enable model access in AWS Bedrock:

```bash
# Via AWS Console
1. Go to https://console.aws.amazon.com/bedrock
2. Click "Model access" in left sidebar
3. Click "Manage model access"
4. Enable:
   - Anthropic Claude 3.5 Sonnet v2
   - Anthropic Claude 3.5 Haiku v1
5. Click "Save changes"
6. Wait 5-10 minutes for access to be granted
```

### Step 2: Remove Anthropic API Key Secret

If you previously created an Anthropic API key secret, you can delete it:

```bash
aws secretsmanager delete-secret \
  --secret-id edulens-anthropic-api-key-dev \
  --force-delete-without-recovery
```

### Step 3: Deploy Infrastructure

```bash
cd edulens-infrastructure
cdk deploy --all --context stage=dev
```

The Lambda functions will automatically receive IAM permissions for Bedrock.

### Step 4: Verify Bedrock Access

Check CloudWatch logs for successful Bedrock invocations:

```bash
aws logs tail /aws/lambda/edulens-parent-chat-send-stream-dev --follow
```

Look for log messages like:
```
BedrockClient initialized with region: us-east-1
Bedrock streaming request: modelId=anthropic.claude-3-5-sonnet-20241022-v2:0
Bedrock streaming complete: totalLength=1234
```

---

## Cost Comparison

**Pricing is identical** between Anthropic API and AWS Bedrock:

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| Claude 3.5 Haiku | $0.25 | $1.25 |

**No markup** - AWS Bedrock charges the same as Anthropic API.

**Per-Student Cost:**
- Interactive chat (Sonnet): ~$0.30/student/month
- Background summarization (Haiku): ~$0.03/student/month
- **Total:** ~$0.33/student/month

---

## Regional Availability

AWS Bedrock with Claude models is available in:
- ✅ `us-east-1` (N. Virginia) - **Recommended**
- ✅ `us-west-2` (Oregon)
- ✅ `eu-west-1` (Ireland)
- ✅ `ap-southeast-1` (Singapore)
- ✅ `ap-northeast-1` (Tokyo)

**If your region is not supported:**
1. Choose a supported region (e.g., us-east-1)
2. Update `config/environments.ts`:
   ```typescript
   export const devConfig: EnvironmentConfig = {
     // ...
     region: 'us-east-1',
   };
   ```
3. Redeploy infrastructure

---

## Troubleshooting

### Error: AccessDeniedException

**Message:** `User is not authorized to perform: bedrock:InvokeModel`

**Solution:**
1. Verify model access is enabled in Bedrock console
2. Wait 5-10 minutes for permissions to propagate
3. Check Lambda execution role has correct IAM policy
4. Verify model ID is correct

### Error: ValidationException

**Message:** `The provided model identifier is invalid`

**Solution:**
1. Check model ID format:
   - Correct: `anthropic.claude-3-5-sonnet-20241022-v2:0`
   - Incorrect: `claude-sonnet-4.5-20250929`
2. Verify model is available in your region
3. Ensure model access is enabled

### Error: ThrottlingException

**Message:** `Rate exceeded`

**Solution:**
1. Bedrock has rate limits (default: 1000 requests/min)
2. Implement exponential backoff
3. Request quota increase in Service Quotas console
4. Consider caching frequent responses

### CloudWatch Logs Show No Bedrock Calls

**Check:**
1. Environment variable `AI_PROVIDER` is set to `bedrock`
2. Lambda function has IAM permissions for Bedrock
3. Code is using `bedrock-client` instead of Anthropic SDK
4. Lambda is being invoked correctly

---

## Testing Locally

To test Bedrock locally (outside Lambda):

```bash
# Configure AWS credentials
export AWS_PROFILE=your-profile
export AWS_REGION=us-east-1

# Verify Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Run your service locally
cd services/conversation-engine
npm run dev
```

**Note:** Your local AWS credentials must have `bedrock:InvokeModel` permissions.

---

## Rollback Plan

If you need to rollback to Anthropic API:

1. **Revert Lambda stack:**
   - Remove Bedrock IAM permissions
   - Add back Anthropic API key secret
   - Update environment variables

2. **Revert service code:**
   - Change imports back to `@anthropic-ai/sdk`
   - Update message formats
   - Change model names back to Anthropic format

3. **Redeploy:**
   ```bash
   cdk deploy --all --context stage=dev
   ```

---

## Benefits Summary

✅ **No Secret Management** - IAM roles instead of API keys
✅ **Better Security** - No secrets to leak or rotate
✅ **AWS Integration** - CloudWatch, VPC endpoints, billing
✅ **Same Performance** - Identical Claude models and pricing
✅ **Easy Migration** - Drop-in replacement with our Bedrock clients

---

## Support

For issues with Bedrock:
- AWS Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- CloudWatch Logs: `/aws/lambda/edulens-*`
- Model Access: https://console.aws.amazon.com/bedrock/home#/modelaccess

For issues with EduLens services:
- Check service README files
- Review CloudWatch logs
- See DEPLOYMENT-GUIDE.md
