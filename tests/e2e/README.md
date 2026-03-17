# EduLens E2E Tests

This directory contains end-to-end tests for the EduLens AI chatbot system, testing the full chain:
**Frontend → API Gateway → Lambda → AgentCore Runtime → Agent Response**

## Test Coverage

### 1. Direct AgentCore Invocation
- Tests direct calls to AgentCore Runtime using AWS SDK
- Parent Advisor agent responses to student performance queries
- Student Tutor agent responses to academic questions
- Verifies agents respond with non-empty, contextually appropriate content

### 2. Input Guardrails
- Tests content filtering and safety guardrails
- Medical/psychological content handling for Parent Advisor
- Inappropriate content handling for Student Tutor
- Verifies blocked responses or appropriate redirects

### 3. Multi-turn Conversations
- Tests conversation context maintenance across multiple turns
- Parent Advisor maintaining student context
- Student Tutor continuing learning conversations
- Verifies conversation history is properly utilized

### 4. API Gateway Integration (Conditional)
- Full chain tests through API Gateway endpoints
- Requires valid test user credentials
- Parent and Student session creation and messaging
- Tests authentication, session management, and message flow

### 5. Error Handling & Edge Cases
- Invalid runtime ARN handling
- Empty prompt handling
- Very long conversation history handling
- Tests system robustness and graceful failure modes

## Configuration

The tests use the following hardcoded configuration:

- **API Base URL**: `https://npwg8my4w5.execute-api.us-west-2.amazonaws.com/dev`
- **AWS Region**: `us-west-2`
- **Parent Advisor Runtime**: `edulens_parent_advisor_dev-5KSGKX4ah8`
- **Student Tutor Runtime**: `edulens_student_tutor_dev-2amG664Tev`
- **Admin API Key**: `4ufbnf9yed7pNhTasnVpK64zCVgqACQp6AqMdQkI`

## Prerequisites

1. **AWS Credentials**: Ensure you have valid AWS credentials configured
   - Via AWS CLI: `aws configure`
   - Via environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - Via IAM role (if running on EC2)

2. **Permissions**: Your AWS credentials need permissions for:
   - `bedrock-agentcore:InvokeAgentRuntime`
   - Access to the specific AgentCore Runtime ARNs

3. **Network Access**: Ability to make HTTPS requests to:
   - AWS Bedrock AgentCore service
   - API Gateway endpoint

## Running the Tests

```bash
# Install dependencies
cd /home/ec2-user/AI-EDU/tests/e2e
npm install

# Run all tests
npm test

# Run with verbose output
npm run test:verbose

# Run in watch mode
npm run test:watch

# Run specific test suite
npx jest --testNamePattern="Direct AgentCore"

# Run with specific timeout (default is 60s)
npx jest --testTimeout=90000
```

## Test Structure

```
tests/e2e/
├── package.json           # Dependencies and scripts
├── jest.config.js         # Jest configuration
├── jest.setup.js         # Global test setup
├── tsconfig.json         # TypeScript configuration
├── edulens.e2e.test.ts   # Main E2E test suite
└── README.md             # This file
```

## Expected Behavior

### Successful Tests
- Direct AgentCore calls should return non-empty responses within 30-60 seconds
- Agents should mention student names (not IDs) when provided
- Parent Advisor should discuss academic performance/progress
- Student Tutor should provide educational content

### Conditional Tests
- API Gateway tests only run if test user authentication succeeds
- If login fails, these tests are skipped gracefully
- No test user exists by default - add one to the database to enable full chain testing

### Guardrail Tests
- May either block content (blocked: true) or redirect appropriately
- Medical/psychological prompts should be handled safely
- Inappropriate content should be filtered or redirected

## Troubleshooting

### Authentication Issues
```
Error: Missing credentials in config
```
**Solution**: Configure AWS credentials via CLI or environment variables

### Timeout Issues
```
Timeout - Async callback was not invoked within the 60000ms timeout
```
**Solution**: Agent responses can be slow. Increase timeout or check network connectivity

### Runtime Not Found
```
Error: Runtime not found
```
**Solution**: Verify AgentCore Runtime ARNs are correct and deployed

### API Gateway 403/401 Errors
```
Error: Request failed with status code 401
```
**Solution**: Create a test user in the database or check API Gateway configuration

## Monitoring

The tests output detailed console logs for debugging:
- Agent responses (truncated for readability)
- Error messages and stack traces
- Test skip notifications
- Response timing information

Use these logs to debug issues and verify expected behavior.