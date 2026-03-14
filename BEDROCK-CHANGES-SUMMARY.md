# AWS Bedrock Integration - Changes Summary

## Overview

The EduLens infrastructure has been updated to use **AWS Bedrock** instead of the Anthropic API directly. This provides better AWS integration and eliminates the need to manage API keys.

---

## What Changed

### ✅ Infrastructure (CDK)

**File:** `edulens-infrastructure/lib/stacks/lambda-stack.ts`

**Changes:**
1. **Removed:** Anthropic API key from Secrets Manager
2. **Added:** IAM permissions for Bedrock model invocation
3. **Updated:** Environment variables to use `AI_PROVIDER=bedrock`

**IAM Permissions Added:**
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

**Affected Lambda Functions:**
- ✅ Parent Chat Create
- ✅ Parent Chat Send Stream (SSE)
- ✅ Student Chat Create
- ✅ Student Chat Send Stream (SSE)
- ✅ Summarization Worker
- ✅ Insights Worker

---

### ✅ Service Code (New Bedrock Clients)

**Node.js Client (TypeScript):**
- **File:** `services/conversation-engine/src/clients/bedrock-client.ts`
- **Lines:** ~350 lines
- **Features:**
  - Streaming support (for SSE)
  - Non-streaming support
  - Token estimation
  - Token budget validation
  - Error handling

**Python Client:**
- **File:** `services/background-jobs/src/clients/bedrock_client.py`
- **Lines:** ~250 lines
- **Features:**
  - Non-streaming invocation
  - JSON response parsing
  - Token estimation
  - Token budget validation
  - Boto3 with retry logic

---

### ✅ Documentation Updates

**1. Deployment Guide**
- **File:** `edulens-infrastructure/DEPLOYMENT-GUIDE.md`
- **Changes:**
  - Replaced "Store Anthropic API Key" with "Enable AWS Bedrock"
  - Added Bedrock model access instructions
  - Updated troubleshooting section
  - Added regional availability notes

**2. Infrastructure README**
- **File:** `edulens-infrastructure/README.md`
- **Changes:**
  - Updated prerequisites to include Bedrock
  - Replaced secrets section with Bedrock setup
  - Added benefits of using Bedrock

**3. Migration Guide** (NEW)
- **File:** `edulens-backend/BEDROCK-MIGRATION.md`
- **Contents:**
  - Why use Bedrock
  - Code migration examples
  - Model mapping
  - Deployment steps
  - Troubleshooting
  - Rollback plan

---

## What You Need to Do

### 1. Enable Bedrock Model Access (REQUIRED)

Before deploying, enable Claude models in AWS Bedrock:

```bash
# Via AWS Console (5 minutes)
1. Go to https://console.aws.amazon.com/bedrock
2. Click "Model access" in left sidebar
3. Click "Manage model access"
4. Enable:
   ✅ Anthropic Claude 3.5 Sonnet v2
   ✅ Anthropic Claude 3.5 Haiku v1
5. Click "Save changes"
6. Wait 5-10 minutes for access to be granted
```

### 2. Verify Model Access

```bash
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?starts_with(modelId, `anthropic.claude-3-5`)].{ModelId:modelId,Status:modelLifecycle.status}' \
  --output table
```

**Expected output:**
```
------------------------------------------------------------
|                 ListFoundationModels                     |
+------------------------------------------------------+---+
|                       ModelId                    |Status|
+------------------------------------------------------+---+
|  anthropic.claude-3-5-sonnet-20241022-v2:0       |ACTIVE|
|  anthropic.claude-3-5-haiku-20241022-v1:0        |ACTIVE|
+------------------------------------------------------+---+
```

### 3. Deploy Infrastructure

```bash
cd edulens-infrastructure
cdk deploy --all --context stage=dev
```

The Lambda functions will automatically receive Bedrock IAM permissions.

### 4. (Optional) Delete Old Secrets

If you previously created Anthropic API key secrets, you can delete them:

```bash
aws secretsmanager delete-secret \
  --secret-id edulens-anthropic-api-key-dev \
  --force-delete-without-recovery
```

---

## Benefits of AWS Bedrock

### ✅ Better Security
- **No API keys to manage** - Uses IAM roles
- **No secrets to leak** - No keys stored in Secrets Manager
- **No key rotation needed** - IAM handles authentication

### ✅ Better AWS Integration
- **Native CloudWatch logging** - All logs in one place
- **VPC endpoints available** - Can use private endpoints
- **Consolidated billing** - Same AWS bill as other services
- **IAM permissions** - Fine-grained access control

### ✅ Same Performance & Pricing
- **Identical models** - Same Claude 3.5 Sonnet and Haiku
- **Same pricing** - $3/$15 for Sonnet, $0.25/$1.25 for Haiku
- **No markup** - AWS doesn't add extra cost
- **Same latency** - Similar response times

### ✅ Regional Flexibility
- Available in multiple regions:
  - us-east-1 (N. Virginia)
  - us-west-2 (Oregon)
  - eu-west-1 (Ireland)
  - ap-southeast-1 (Singapore)
  - ap-northeast-1 (Tokyo)

---

## What Stays the Same

### ✅ No Service Code Changes Needed

The Bedrock clients provide the same interface as the Anthropic SDK:
- Same method signatures
- Same streaming support
- Same token counting
- Same error handling

**Your existing service handlers don't need to change!**

### ✅ Same Models

- **Claude 3.5 Sonnet** - For interactive chat (parent/student)
- **Claude 3.5 Haiku** - For background summarization

### ✅ Same Cost

- **$0.33-0.36 per student/month** for AI
- No change to overall platform cost

---

## Regional Availability

**Bedrock is available in:**
- ✅ us-east-1 (N. Virginia) - **Recommended**
- ✅ us-west-2 (Oregon)
- ✅ eu-west-1 (Ireland)
- ✅ ap-southeast-1 (Singapore)
- ✅ ap-northeast-1 (Tokyo)

**If you're deploying to a different region:**
1. Choose a supported region (e.g., us-east-1)
2. Update `config/environments.ts`:
   ```typescript
   export const devConfig: EnvironmentConfig = {
     // ...
     region: 'us-east-1',
   };
   ```
3. Deploy infrastructure

---

## Troubleshooting

### Error: AccessDeniedException

**Problem:** Lambda function can't access Bedrock

**Solution:**
1. Enable model access in Bedrock console (see Step 1 above)
2. Wait 5-10 minutes for permissions to propagate
3. Verify Lambda execution role has Bedrock permissions

### Error: Bedrock not available in region

**Problem:** Bedrock doesn't support your region

**Solution:**
1. Choose a supported region (us-east-1, us-west-2, eu-west-1)
2. Update `config/environments.ts`
3. Redeploy

### Lambda timeout with Bedrock

**Problem:** Lambda times out before getting response

**Solution:**
1. Check CloudWatch logs for errors
2. Verify model ID is correct
3. Increase Lambda timeout if needed (already set to 120s for streaming)

---

## Files Modified

### Infrastructure
- ✅ `lib/stacks/lambda-stack.ts` - Added Bedrock IAM permissions
- ✅ `DEPLOYMENT-GUIDE.md` - Updated deployment steps
- ✅ `README.md` - Updated prerequisites and setup

### Service Code (New Files)
- ✅ `services/conversation-engine/src/clients/bedrock-client.ts` - TypeScript client
- ✅ `services/background-jobs/src/clients/bedrock_client.py` - Python client

### Documentation (New Files)
- ✅ `edulens-backend/BEDROCK-MIGRATION.md` - Complete migration guide
- ✅ `BEDROCK-CHANGES-SUMMARY.md` - This file

---

## Summary

**What changed:**
- Infrastructure now uses IAM permissions instead of API keys
- New Bedrock clients for TypeScript and Python
- Updated deployment guide

**What you need to do:**
1. Enable Bedrock model access in AWS Console (5 minutes)
2. Deploy infrastructure: `cdk deploy --all --context stage=dev`
3. Verify in CloudWatch logs

**Benefits:**
- ✅ No API key management
- ✅ Better AWS integration
- ✅ Same models and pricing
- ✅ More secure (IAM-based auth)

**Everything else stays the same!**

---

## Next Steps

1. **Enable Bedrock** (see instructions above)
2. **Deploy infrastructure**
3. **Test endpoints** to verify Bedrock integration
4. **Monitor CloudWatch logs** for successful API calls

For detailed migration instructions, see:
- `edulens-backend/BEDROCK-MIGRATION.md` - Complete guide
- `edulens-infrastructure/DEPLOYMENT-GUIDE.md` - Deployment steps

---

**Ready to deploy! 🚀**
