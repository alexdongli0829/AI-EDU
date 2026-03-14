# Auth Service

Authentication service for EduLens platform.

## Features

- ✅ User registration with email and password
- ✅ Secure password hashing using bcrypt
- ✅ JWT token generation and verification
- ✅ Role-based authentication (student, parent, admin)
- ✅ Database connection via AWS Secrets Manager
- ✅ Student profile creation for student users

## API Endpoints

### POST /auth/login

Authenticate user and return JWT token.

**Request:**
```json
{
  "email": "student@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "student@example.com",
    "name": "John Doe",
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

### POST /auth/register

Create a new user account.

**Request (Student):**
```json
{
  "email": "student@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "student",
  "gradeLevel": 8,
  "dateOfBirth": "2010-01-01"
}
```

**Request (Parent):**
```json
{
  "email": "parent@example.com",
  "password": "password123",
  "name": "Jane Doe",
  "role": "parent"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please log in.",
  "userId": "uuid"
}
```

## Environment Variables

- `DB_SECRET_ARN` - ARN of AWS Secrets Manager secret containing database credentials
- `AWS_REGION` - AWS region (default: us-east-1)
- `JWT_SECRET` - Secret key for JWT token signing (should be in Secrets Manager in production)
- `NODE_ENV` - Environment (development, production)

## Development

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Generate Prisma Client

```bash
npx prisma generate
```

## Deployment

This service is deployed as AWS Lambda functions via CDK. See `edulens-infrastructure` for deployment instructions.

## Security

- Passwords are hashed using bcrypt with 10 salt rounds
- JWT tokens expire after 7 days
- Email validation and password strength requirements enforced
- Database credentials stored in AWS Secrets Manager
- CORS enabled for frontend access

## Database Schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  role VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE students (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  grade_level INTEGER NOT NULL,
  date_of_birth DATE NOT NULL,
  parent_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```
