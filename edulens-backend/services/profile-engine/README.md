# Profile Engine Service

Python-based service for calculating and managing student Learning DNA using Bayesian inference and statistical analysis.

## Overview

The Profile Engine analyzes student test performance to generate a comprehensive Learning DNA profile including:

- **Skill Mastery**: Bayesian inference with Beta-Binomial conjugate prior
- **Error Patterns**: Classification of 7 error types with severity tracking
- **Time Behavior**: Rushing/hesitation detection and optimal time range
- **Strengths & Weaknesses**: Statistical identification with confidence scores

## Architecture

### Mathematical Model

**Bayesian Mastery Calculation:**
- Prior: Beta(α=1, β=1) - uniform prior
- Likelihood: Binomial(correct | total, mastery)
- Posterior: Beta(α + correct, β + incorrect)
- Point Estimate: E[mastery] = α / (α + β)
- Confidence: Based on Beta distribution variance + attempt count

**Mastery Threshold:** 0.7 (70% probability)
**Confidence Threshold:** 0.6 (60% statistical confidence)

### Error Types

1. **misread_question** - Student misunderstood the question
2. **calculation_error** - Mathematical calculation mistake
3. **careless_mistake** - Simple oversight or typo
4. **conceptual_gap** - Missing fundamental understanding
5. **time_pressure** - Rushed answer due to time constraint
6. **partial_understanding** - Got partway but incomplete
7. **unknown** - Cannot classify

### Time Behavior Metrics

- **Average Speed**: Mean seconds per question
- **Rushing Indicator**: 0-1 score (1 = rushing, 0 = not rushing)
- **Hesitation Pattern**: Skills where response time > 2x estimated
- **Optimal Time Range**: 25th-75th percentile of correct responses

## Project Structure

```
profile-engine/
├── src/
│   ├── algorithms/
│   │   └── bayesian_mastery.py      # Bayesian mastery calculator
│   ├── services/
│   │   ├── error_classifier.py      # Error pattern classification
│   │   └── time_analyzer.py         # Time behavior analysis
│   ├── models/
│   │   └── skill_node.py            # Pydantic data models
│   ├── database/
│   │   ├── connection.py            # SQLAlchemy connection
│   │   └── repositories.py          # Data access layer
│   └── handlers/
│       ├── calculate_profile.py     # EventBridge handler
│       ├── get_profile.py           # GET /students/:id/profile
│       └── get_skill_detail.py      # GET /students/:id/skills/:skillId
├── tests/
│   ├── test_bayesian_mastery.py
│   ├── test_error_classifier.py
│   └── test_time_analyzer.py
├── requirements.txt
└── pytest.ini
```

## API Endpoints

### 1. Get Student Profile

```http
GET /api/students/:id/profile
```

**Response:**
```json
{
  "success": true,
  "data": {
    "studentId": "uuid",
    "skillGraph": [
      {
        "skillId": "reading.inference",
        "skillName": "Reading Inference",
        "subject": "reading",
        "masteryLevel": 0.75,
        "confidence": 0.82,
        "attempts": 10,
        "correctAttempts": 8,
        "alpha": 9.0,
        "beta": 3.0,
        "lastUpdated": "2024-01-15T10:30:00Z"
      }
    ],
    "errorPatterns": [
      {
        "errorType": "misread_question",
        "frequency": 5,
        "skillsAffected": ["reading.inference", "reading.main-idea"],
        "examples": ["q1", "q5", "q12"],
        "severity": "medium"
      }
    ],
    "timeBehavior": {
      "averageSpeed": 68.5,
      "rushingIndicator": 0.3,
      "hesitationPattern": ["math.word-problems"],
      "optimalTimeRange": {"min": 50, "max": 120}
    },
    "overallMastery": 0.72,
    "strengths": ["reading.vocabulary", "math.arithmetic"],
    "weaknesses": ["math.word-problems"],
    "lastCalculated": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Get Skill Detail

```http
GET /api/students/:id/skills/:skillId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "skill": {
      "skillId": "reading.inference",
      "masteryLevel": 0.75,
      "confidence": 0.82,
      "isMastered": true
    },
    "statistics": {
      "credibleInterval": {
        "lower": 0.485,
        "upper": 0.935,
        "level": 0.95
      },
      "betaParameters": {"alpha": 9.0, "beta": 3.0},
      "successRate": 0.800
    },
    "recentPerformance": {
      "responses": [...],
      "trend": "improving"
    },
    "recommendations": [
      "Great work! You've mastered Reading Inference.",
      "Great progress! Your performance is improving."
    ]
  }
}
```

## Event Processing

### EventBridge Event: test.completed

**Trigger:** Test session is completed
**Handler:** `calculate_profile.py`

**Event Structure:**
```json
{
  "detail-type": "test.completed",
  "detail": {
    "sessionId": "uuid",
    "studentId": "uuid",
    "testId": "uuid",
    "score": 85,
    "completedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Processing Steps:**
1. Fetch all historical responses for student
2. Group by skill and calculate Bayesian mastery
3. Classify error patterns
4. Analyze time behavior
5. Identify strengths and weaknesses
6. Update student_profiles table
7. Create profile_snapshot

## Database Schema

### student_profiles
- `student_id` (uuid, PK)
- `skill_graph` (jsonb) - Array of SkillNode objects
- `error_patterns` (jsonb) - Array of ErrorPattern objects
- `time_behavior` (jsonb) - TimeBehavior object
- `overall_mastery` (float)
- `strengths` (text[])
- `weaknesses` (text[])
- `last_calculated` (timestamp)

### profile_snapshots
- `id` (uuid, PK)
- `student_id` (uuid)
- `session_id` (uuid)
- `snapshot_data` (jsonb) - Complete LearningDNA at point in time
- `created_at` (timestamp)

## Development

### Setup

```bash
cd services/profile-engine

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/edulens"
```

### Running Tests

```bash
# Run all tests with coverage
pytest

# Run specific test file
pytest tests/test_bayesian_mastery.py

# Run with verbose output
pytest -v

# Generate HTML coverage report
pytest --cov-report=html
open htmlcov/index.html
```

**Coverage Target:** 70% minimum

### Example Usage

```python
from src.algorithms.bayesian_mastery import BayesianMasteryCalculator

calculator = BayesianMasteryCalculator()

# Calculate mastery
mastery, confidence, alpha, beta = calculator.calculate_mastery(
    correct_attempts=7,
    total_attempts=10
)

print(f"Mastery: {mastery:.2f} (Confidence: {confidence:.2f})")
# Output: Mastery: 0.67 (Confidence: 0.75)

# Check if mastered
is_mastered = calculator.is_mastered(mastery, confidence, min_confidence=0.6)
print(f"Mastered: {is_mastered}")
# Output: Mastered: False (below 0.7 threshold)
```

## Dependencies

- **numpy** (1.26.4) - Numerical computing
- **scipy** (1.12.0) - Statistical functions (Beta distribution)
- **pydantic** (2.6.1) - Data validation
- **sqlalchemy** (2.0.25) - Database ORM
- **psycopg2-binary** (2.9.9) - PostgreSQL driver
- **pytest** (8.0.0) - Testing framework

## Deployment

### Lambda Configuration

**Runtime:** Python 3.12
**Memory:** 512 MB
**Timeout:** 30 seconds (calculate_profile), 10 seconds (GET endpoints)
**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `SQL_ECHO` - Set to "true" for SQL query logging (optional)

### EventBridge Rule

```json
{
  "source": ["edulens.test-engine"],
  "detail-type": ["test.completed"]
}
```

### IAM Permissions

- Read from RDS PostgreSQL
- Write to CloudWatch Logs

## Performance

**Profile Calculation:**
- Average time: 500-800ms for 100 historical responses
- Scales linearly with number of responses
- Dominated by database queries (95% of time)

**Optimization:**
- Use database connection pooling (NullPool for Lambda)
- Batch fetch all responses in single query
- Calculate all skills in-memory (no per-skill queries)

## Monitoring

**Key Metrics:**
- Profile calculation duration
- Error classification distribution
- Mastery level distribution
- Confidence score distribution

**CloudWatch Logs:**
- Profile calculation started/completed
- Number of skills/errors processed
- Database query times

## Future Enhancements

1. **Skill Dependency Graph** - Model prerequisite relationships
2. **Personalized Recommendations** - ML-based suggestion engine
3. **Peer Comparison** - Anonymized cohort analysis
4. **Learning Velocity** - Track improvement rate over time
5. **Adaptive Testing** - Use mastery to adjust question difficulty

## References

- **Beta-Binomial Conjugate Prior**: [Wikipedia](https://en.wikipedia.org/wiki/Conjugate_prior#Discrete_likelihood)
- **Bayesian Knowledge Tracing**: Chen et al. (2018)
- **Item Response Theory**: Baker & Kim (2004)
