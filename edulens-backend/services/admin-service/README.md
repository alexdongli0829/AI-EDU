# Admin Service

Node.js/TypeScript service for administrative operations including question management, bulk operations, and system analytics.

## Overview

The Admin Service provides administrative functionality for:

- **Question Management**: CRUD operations for test questions
- **Bulk Operations**: Import/export questions in CSV and JSON formats
- **System Analytics**: Platform-wide metrics and student analytics
- **System Health**: Database and cache monitoring

## API Endpoints

### Question Management

#### Create Question
```http
POST /admin/questions
```

**Request Body:**
```json
{
  "testId": "uuid",
  "questionType": "multiple_choice",
  "subject": "math",
  "questionText": "What is 2 + 2?",
  "options": ["2", "3", "4", "5"],
  "correctAnswer": "4",
  "explanation": "2 + 2 equals 4",
  "skillTags": ["math.arithmetic", "math.addition"],
  "difficultyLevel": 1,
  "estimatedTimeSeconds": 30,
  "orderIndex": 0
}
```

#### Update Question
```http
PUT /admin/questions/:id
```

#### Delete Question
```http
DELETE /admin/questions/:id
```

**Note:** Questions with existing student responses cannot be deleted (returns 409 Conflict)

#### List Questions
```http
GET /admin/questions?testId=uuid&subject=math&skillTag=math.algebra&limit=50&offset=0
```

### Bulk Operations

#### Import Questions
```http
POST /admin/bulk/import
```

**JSON Format:**
```json
{
  "format": "json",
  "data": [
    {
      "testId": "uuid",
      "questionType": "multiple_choice",
      "subject": "math",
      "questionText": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "skillTags": ["math.algebra"],
      "difficultyLevel": 2,
      "estimatedTimeSeconds": 60,
      "orderIndex": 0
    }
  ]
}
```

**CSV Format:**
```json
{
  "format": "csv",
  "data": "testId,questionType,subject,questionText,options,correctAnswer,skillTags,difficultyLevel,estimatedTimeSeconds,orderIndex\n..."
}
```

#### Export Questions
```http
GET /admin/bulk/export?testId=uuid&format=json
GET /admin/bulk/export?testId=uuid&format=csv
```

### Analytics

#### System Metrics
```http
GET /admin/analytics/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "totalStudents": 1000,
    "totalTests": 50,
    "totalQuestions": 2500,
    "testSessions": {
      "active": 15,
      "completed": 8520,
      "avgScore": 78.5
    },
    "chatSessions": {
      "total": 3200,
      "totalMessages": 48000,
      "avgMessagesPerSession": 15
    },
    "profiles": {
      "total": 950,
      "coverage": 95
    },
    "recentActivity": {
      "testSessions": 120,
      "chatSessions": 85,
      "profilesUpdated": 95
    },
    "health": {
      "database": "connected",
      "redis": "connected",
      "cacheHitRate": 87.5
    }
  }
}
```

#### Student Analytics
```http
GET /admin/analytics/students/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "student": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "gradeLevel": 8
    },
    "testPerformance": {
      "totalTests": 15,
      "averageScore": 82.5,
      "completionRate": 93.8,
      "recentSessions": [...]
    },
    "chatActivity": {
      "totalSessions": 25,
      "totalMessages": 380,
      "avgMessagesPerSession": 15.2
    },
    "learningProfile": {
      "overallMastery": 75,
      "strengths": ["reading.vocabulary", "math.arithmetic"],
      "weaknesses": ["math.word-problems"]
    },
    "subjectPerformance": [
      { "subject": "math", "accuracy": 78.5, "questionCount": 150 },
      { "subject": "reading", "accuracy": 85.2, "questionCount": 120 }
    ]
  }
}
```

## Project Structure

```
admin-service/
├── src/
│   ├── handlers/
│   │   ├── questions/
│   │   │   ├── create-question.ts
│   │   │   ├── update-question.ts
│   │   │   ├── delete-question.ts
│   │   │   └── list-questions.ts
│   │   ├── bulk-operations/
│   │   │   ├── import-questions.ts
│   │   │   └── export-questions.ts
│   │   └── analytics/
│   │       ├── system-metrics.ts
│   │       └── student-analytics.ts
│   └── utils/
│       └── logger.ts
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

## Features

### Question Management
- ✅ Full CRUD operations
- ✅ Validation with Zod schemas
- ✅ Filtering by test, subject, skill tag
- ✅ Pagination support
- ✅ Safety checks (prevent deletion of used questions)

### Bulk Operations
- ✅ Import from JSON and CSV
- ✅ Export to JSON and CSV
- ✅ Batch validation
- ✅ Transaction support (all-or-nothing)
- ✅ Detailed error messages

### Analytics
- ✅ System-wide metrics
- ✅ Per-student analytics
- ✅ Subject performance breakdown
- ✅ Recent activity tracking
- ✅ Health monitoring (DB + Redis)
- ✅ Cache hit rate tracking

## CSV Format

**Import/Export CSV Columns:**
- `testId` - UUID of the test
- `questionType` - multiple_choice | short_answer | essay
- `subject` - math | reading | science | writing
- `questionText` - The question text
- `options` - JSON array of options (for multiple choice)
- `correctAnswer` - The correct answer
- `explanation` - Optional explanation
- `skillTags` - JSON array of skill tags
- `difficultyLevel` - 1-5
- `estimatedTimeSeconds` - Expected time to complete
- `orderIndex` - Position in test

**Example CSV:**
```csv
testId,questionType,subject,questionText,options,correctAnswer,explanation,skillTags,difficultyLevel,estimatedTimeSeconds,orderIndex
550e8400-e29b-41d4-a716-446655440000,multiple_choice,math,"What is 2 + 2?","[\"2\",\"3\",\"4\",\"5\"]",4,"Basic addition",["math.arithmetic"],1,30,0
```

## Development

### Setup
```bash
cd services/admin-service
npm install
```

### Build
```bash
npm run build
```

### Local Testing
```bash
# Set environment variables
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."

# Build and test
npm run build
npm test
```

## Deployment

### Lambda Configuration
**Memory:** 512 MB
**Timeout:** 30 seconds (60 seconds for bulk operations)
**Runtime:** Node.js 20

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `LOG_LEVEL` - Logging level (default: info)

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## Security

### Authentication
All admin endpoints require authentication. Implement API Gateway authorizer or Lambda authorizer.

**Example authorizer check:**
```typescript
const adminId = event.requestContext.authorizer?.userId;
const isAdmin = event.requestContext.authorizer?.role === 'admin';

if (!isAdmin) {
  return {
    statusCode: 403,
    body: JSON.stringify({ error: 'Forbidden: Admin access required' })
  };
}
```

### Authorization
- Only users with `admin` role can access these endpoints
- Audit log all admin actions
- Rate limit admin API calls

## Error Handling

### Common Error Codes
- `VALIDATION_ERROR` - Invalid request data
- `MISSING_PARAMETERS` - Required parameters missing
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Operation conflicts with current state
- `INTERNAL_ERROR` - Server error

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional details
  }
}
```

## Monitoring

### CloudWatch Metrics
- Import/export operation counts
- Analytics query latency
- Error rates by endpoint
- Active admin sessions

### CloudWatch Logs
All requests and errors are logged in structured JSON format:
```json
{
  "level": "info",
  "message": "Question created",
  "questionId": "uuid",
  "testId": "uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Future Enhancements

1. **User Management**: CRUD for users and students
2. **Test Templates**: Pre-built test templates
3. **Content Recommendations**: Suggest questions based on skill gaps
4. **Scheduled Reports**: Automated analytics reports
5. **Audit Logging**: Track all admin actions
6. **Role-Based Access**: Granular permissions
7. **Data Export**: Export all platform data
8. **Backup/Restore**: Database backup management

## API Rate Limits

**Recommended limits:**
- Question CRUD: 100 requests/minute
- Bulk operations: 10 requests/minute
- Analytics: 60 requests/minute

## Cost Optimization

- Cache analytics queries (5 min TTL)
- Use pagination for large datasets
- Batch bulk operations
- Archive old data periodically

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- questions.test
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/edulens-backend/issues
- Email: support@edulens.com
