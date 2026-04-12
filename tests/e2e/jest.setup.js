// Jest setup for E2E tests
process.env.AWS_DEFAULT_REGION = 'us-west-2';
process.env.AWS_REGION = 'us-west-2';

// DO NOT override AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
// The EC2 instance role provides credentials via IMDS automatically.
// Setting mock creds breaks the real IAM auth.

// Set test timeout to handle slow agent responses
jest.setTimeout(60000);
