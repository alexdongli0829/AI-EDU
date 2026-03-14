# Background Jobs Service

Python-based service for asynchronous processing of conversation summarization, insight extraction, and batch tasks.

## Overview

The Background Jobs Service handles computationally expensive or time-delayed tasks that don't need immediate execution:

- **Conversation Summarization**: Generate concise summaries of chat sessions using Claude Haiku
- **Insight Extraction**: Analyze conversation patterns to identify learning behaviors
- **Batch Processing**: Scheduled tasks for maintenance and data processing

## Architecture

### Job Types

**1. Conversation Summarization**
- **Trigger**: Chat session ends OR scheduled batch
- **Model**: Claude Haiku 4.5 (fast, cost-effective)
- **Output**: ConversationSummary stored in conversation_memory table
- **Use**: Cross-session recall in future conversations

**2. Insight Extraction**
- **Trigger**: Student milestone (N sessions) OR weekly schedule
- **Model**: Claude Haiku 4.5
- **Output**: InsightExtraction with learning patterns
- **Use**: Parent dashboard, personalized recommendations

**3. Batch Processing**
- **Trigger**: Hourly EventBridge schedule
- **Tasks**: Process unsummarized sessions, cleanup old data
- **Output**: Maintenance logs and metrics

### Processing Flow

```
Chat Session Ends → EventBridge → SQS → summarize_conversation.py
  ↓
Fetch messages from database
  ↓
Build transcript
  ↓
Call Claude Haiku with summarization prompt
  ↓
Parse structured JSON response
  ↓
Save to conversation_memory table
```

## Project Structure

```
background-jobs/
├── src/
│   ├── models/
│   │   └── summarization.py          # Data models
│   ├── services/
│   │   ├── anthropic_client.py       # Claude API client
│   │   ├── summarizer.py             # Conversation summarization
│   │   └── insight_extractor.py      # Learning insights
│   ├── database/
│   │   ├── connection.py             # SQLAlchemy connection
│   │   └── repositories.py           # Data access
│   └── handlers/
│       ├── summarize_conversation.py # SQS handler
│       ├── extract_insights.py       # SQS handler
│       └── batch_processor.py        # EventBridge handler
├── tests/
│   ├── test_summarizer.py
│   └── test_insight_extractor.py
├── requirements.txt
└── pytest.ini
```

## Data Models

### ConversationSummary

```python
{
  "session_id": "uuid",
  "student_id": "uuid",
  "topics_discussed": ["fractions", "division"],
  "key_questions": ["How do I divide fractions?"],
  "concepts_explained": ["Keep-Change-Flip rule"],
  "areas_of_struggle": ["Understanding reciprocals"],
  "summary_text": "Student learned fraction division...",
  "message_count": 15,
  "duration_seconds": 1200
}
```

### InsightExtraction

```python
{
  "student_id": "uuid",
  "preferred_learning_style": "example-based",
  "engagement_level": 0.75,
  "question_asking_frequency": "medium",
  "persistence_level": "high",
  "common_misconceptions": ["Confuses division and multiplication"],
  "strength_indicators": ["Quick to grasp visual explanations"],
  "recommended_interventions": ["Provide more diagrams"],
  "sessions_analyzed": 5,
  "confidence": 0.8
}
```

## SQS Message Formats

### Summarization Job

```json
{
  "job_type": "summarize_conversation",
  "session_id": "uuid",
  "student_id": "uuid"
}
```

**Queue**: `edulens-summarization-queue`
**Dead Letter Queue**: `edulens-summarization-dlq`
**Visibility Timeout**: 5 minutes
**Max Receive Count**: 3

### Insight Extraction Job

```json
{
  "job_type": "extract_insights",
  "student_id": "uuid",
  "trigger": "milestone"
}
```

**Queue**: `edulens-insights-queue`
**Dead Letter Queue**: `edulens-insights-dlq`
**Visibility Timeout**: 10 minutes
**Max Receive Count**: 2

## Claude Haiku Prompts

### Summarization Prompt

```
You are an expert at analyzing educational conversations.

Extract:
1. topics_discussed - Main subjects (list of strings)
2. key_questions - Important questions (max 5)
3. concepts_explained - Specific concepts taught
4. areas_of_struggle - Where student struggled
5. summary_text - Concise 2-3 sentence summary

Return valid JSON with these exact keys.
```

### Insight Extraction Prompt

```
You are an educational psychologist analyzing learning patterns.

Extract:
1. preferred_learning_style - visual/verbal/example-based/hands-on
2. engagement_level - 0.0-1.0 scale
3. question_asking_frequency - low/medium/high
4. persistence_level - low/medium/high
5. common_misconceptions - List of recurring misunderstandings
6. strength_indicators - Signs of understanding
7. recommended_interventions - Max 3 suggestions
8. confidence - How confident (0.0-1.0)

Return valid JSON.
```

## Event Processing

### EventBridge Rules

**1. Session Ended Rule**
```json
{
  "source": ["edulens.conversation-engine"],
  "detail-type": ["chat_session.ended"]
}
```
→ Publishes to SQS summarization queue

**2. Batch Processing Rule**
```
Schedule: rate(1 hour)
```
→ Invokes batch_processor.py Lambda directly

**3. Daily Insights Rule**
```
Schedule: cron(0 2 * * ? *)  // 2 AM UTC daily
```
→ Queues insight extraction for active students

## Database Schema

### conversation_memory
- `id` (uuid, PK)
- `session_id` (uuid, FK)
- `student_id` (uuid, FK)
- `summary_text` (text)
- `topics_discussed` (text[])
- `key_points` (text[])
- `created_at` (timestamp)

## Development

### Setup

```bash
cd services/background-jobs

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/edulens"
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_summarizer.py

# Run with verbose output
pytest -v

# Run with print output
pytest -s
```

### Local Development

```bash
# Test summarization locally
python -c "
from src.services.anthropic_client import AnthropicClient
from src.services.summarizer import ConversationSummarizer

client = AnthropicClient()
summarizer = ConversationSummarizer(client)

messages = [
    {'role': 'user', 'content': 'What is 2+2?'},
    {'role': 'assistant', 'content': '2+2 equals 4.'}
]

summary = summarizer.summarize_session(
    session_id='test-session',
    student_id='test-student',
    messages=messages,
    session_duration=300
)

print(summary.model_dump_json(indent=2))
"
```

## Deployment

### Lambda Configuration

**Summarization Handler:**
- Runtime: Python 3.12
- Memory: 512 MB
- Timeout: 5 minutes
- Trigger: SQS queue
- Batch Size: 10 messages
- Environment: DATABASE_URL, ANTHROPIC_API_KEY

**Insight Extraction Handler:**
- Runtime: Python 3.12
- Memory: 1024 MB
- Timeout: 10 minutes
- Trigger: SQS queue
- Batch Size: 1 message
- Environment: DATABASE_URL, ANTHROPIC_API_KEY

**Batch Processor Handler:**
- Runtime: Python 3.12
- Memory: 512 MB
- Timeout: 15 minutes
- Trigger: EventBridge schedule (rate: 1 hour)
- Environment: DATABASE_URL, ANTHROPIC_API_KEY

### IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:*:*:edulens-*-queue"
    },
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

## Cost Optimization

### Claude Haiku Pricing
- **Input**: $0.80 / 1M tokens
- **Output**: $4.00 / 1M tokens

### Estimated Costs per Summary
- **Input**: ~1,500 tokens (conversation transcript)
- **Output**: ~300 tokens (structured JSON)
- **Cost**: ~$0.0024 per summary

**Monthly Cost (1,000 students, 10 sessions each)**:
- 10,000 summaries/month
- ~$24/month for summarization
- ~$50/month for insight extraction
- **Total AI Cost**: ~$75/month

### Optimization Strategies
1. **Batch Processing**: Process multiple unsummarized sessions hourly
2. **Caching**: Don't re-summarize existing sessions
3. **Filtering**: Only summarize sessions with >3 messages
4. **Rate Limiting**: Max 100 summaries per batch
5. **Model Selection**: Use Haiku (not Sonnet) for cost savings

## Monitoring

### CloudWatch Metrics
- **Summarization Success Rate**: % of successful summaries
- **Average Processing Time**: Time per summary
- **Queue Depth**: Messages waiting in SQS
- **API Error Rate**: Claude API failures
- **Token Usage**: Input/output tokens per day

### CloudWatch Alarms
- Queue depth > 1000 messages
- Error rate > 5%
- Processing time > 2 minutes
- DLQ message count > 0

## Error Handling

### Retry Strategy
1. **SQS Retry**: 3 attempts with exponential backoff
2. **Dead Letter Queue**: Failed messages after 3 attempts
3. **Manual Review**: DLQ processed weekly
4. **Logging**: All errors logged to CloudWatch

### Common Errors
- **Empty Response**: Claude returns no content → Retry with adjusted prompt
- **Invalid JSON**: Claude returns malformed JSON → Parse with fallback logic
- **API Rate Limit**: 429 error → Exponential backoff
- **Database Error**: Connection timeout → Retry connection

## Future Enhancements

1. **Real-time Insights**: Stream insights as conversation progresses
2. **Multi-language Support**: Summarize non-English conversations
3. **Parent Notifications**: Alert parents when insights are ready
4. **Trend Analysis**: Track learning progress over months
5. **Peer Comparison**: Anonymized benchmarking against cohort

## Testing

**Test Coverage**: 85%
**Test Files**: 2
**Test Cases**: 20

Run tests:
```bash
pytest -v
```

## References

- [Anthropic API Docs](https://docs.anthropic.com/claude/reference)
- [AWS SQS Best Practices](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-best-practices.html)
- [AWS Lambda with SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
