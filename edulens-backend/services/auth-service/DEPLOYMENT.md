# Auth Service Deployment Guide

## Prerequisites

1. AWS infrastructure deployed (Aurora PostgreSQL, Lambda, API Gateway)
2. Database credentials stored in AWS Secrets Manager
3. Node.js 18+ installed

## Step 1: Install Dependencies

```bash
cd /Volumes/workplace/AI-EDU/edulens-backend/services/auth-service
npm install
```

## Step 2: Generate Prisma Client

```bash
npx prisma generate
```

## Step 3: Build TypeScript Code

```bash
npm run build
```

## Step 4: Initialize Database Schema

### Option A: Using psql (Recommended)

1. Get database credentials from Secrets Manager:

```bash
aws secretsmanager get-secret-value \
  --secret-id $(aws cloudformation describe-stacks \
    --stack-name EduLensDatabaseStack-dev \
    --query 'Stacks[0].Outputs[?OutputKey==`AuroraSecretArn`].OutputValue' \
    --output text) \
  --query 'SecretString' \
  --output text | jq .
```

2. Connect to database and run migration:

```bash
# Save the connection details from step 1
DB_HOST="your-aurora-cluster-endpoint"
DB_PORT="5432"
DB_NAME="edulens"
DB_USER="your-username"
DB_PASS="your-password"

# Run migration
PGPASSWORD=$DB_PASS psql \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  -f prisma/migrations/001_init.sql
```

### Option B: Using Prisma Migrate (Alternative)

```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:pass@host:5432/edulens?sslmode=require"

# Run migration
npx prisma db push
```

## Step 5: Deploy Lambda Functions

From the infrastructure directory:

```bash
cd /Volumes/workplace/AI-EDU/edulens-infrastructure

# Deploy Lambda stack (includes auth functions)
./deploy.sh dev deploy
```

This will:
- Package the auth service code
- Deploy login and register Lambda functions
- Create API Gateway routes:
  - `POST /auth/login`
  - `POST /auth/register`

## Step 6: Test Auth Endpoints

Get the API URL:

```bash
API_URL=$(aws cloudformation describe-stacks \
  --stack-name EduLensApiGatewayStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`RestApiUrl`].OutputValue' \
  --output text)

echo "API URL: $API_URL"
```

### Test Registration

```bash
curl -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@test.com",
    "password": "Test1234",
    "name": "Test Student",
    "role": "student",
    "gradeLevel": 8,
    "dateOfBirth": "2010-01-01"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "User registered successfully. Please log in.",
  "userId": "uuid"
}
```

### Test Login

```bash
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@test.com",
    "password": "Test1234"
  }'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "student@test.com",
    "name": "Test Student",
    "role": "student",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "student": {
    "id": "uuid",
    "userId": "uuid",
    "gradeLevel": 8,
    "dateOfBirth": "2010-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Step 7: Update Frontend

The frontend should now be able to authenticate! Test by:

1. Go to http://localhost:3000/register
2. Create a new account
3. Go to http://localhost:3000/login
4. Log in with your credentials
5. You should be redirected to the dashboard

## Environment Variables

The Lambda functions automatically receive these environment variables:

- `DB_SECRET_ARN` - Aurora database secret ARN
- `REDIS_URL` - Redis connection URL
- `NODE_ENV` - Environment (dev/prod)
- `STAGE` - Deployment stage
- `JWT_SECRET` - JWT signing secret (should be in Secrets Manager for production)

## Security Considerations

### Production Deployment

1. **JWT Secret**: Move JWT_SECRET to AWS Secrets Manager:

```bash
# Create secret for JWT
aws secretsmanager create-secret \
  --name edulens/jwt-secret-prod \
  --secret-string "your-secure-random-string"

# Update Lambda environment to read from Secrets Manager
```

2. **Password Policy**: Current policy requires:
   - Minimum 8 characters
   - At least one letter
   - At least one number
   - Consider adding: special character, uppercase requirement

3. **Rate Limiting**: Add API Gateway throttling:
   - Login: 5 requests per minute per IP
   - Register: 3 requests per minute per IP

4. **Email Verification**: Add email verification flow (future enhancement)

## Troubleshooting

### Error: "DB_SECRET_ARN environment variable is not set"

Check Lambda configuration:
```bash
aws lambda get-function-configuration \
  --function-name edulens-login-dev \
  --query 'Environment.Variables'
```

### Error: "Failed to retrieve database credentials"

Verify Secrets Manager permissions:
```bash
aws lambda get-policy \
  --function-name edulens-login-dev
```

### Error: "Invalid email or password"

Check database:
```bash
# Connect to Aurora
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Query users
SELECT id, email, name, role FROM users;
```

### Error: "User with this email already exists"

This is expected if trying to register duplicate email. Use login instead.

## Next Steps

After auth is working:

1. ✅ Implement protected routes (middleware to verify JWT tokens)
2. ✅ Add password reset functionality
3. ✅ Add email verification
4. ✅ Implement refresh tokens
5. ✅ Add OAuth integration (Google, Facebook)
6. ✅ Implement rate limiting
7. ✅ Add audit logging

## Database Schema

See `prisma/schema.prisma` for full schema definition.

Tables created:
- `users` - User accounts with email, password hash, role
- `students` - Student profiles with grade level, DOB, parent link
