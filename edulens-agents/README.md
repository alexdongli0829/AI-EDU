# EduLens AI Agents (Strands + AgentCore)

Python-based AI agents for the EduLens education platform, built with [Strands Agents SDK](https://strandsagents.com/) and deployed to [Amazon Bedrock AgentCore Runtime](https://aws.amazon.com/bedrock/agentcore/) via Direct Code Deployment.

## Agents

| Agent | Role | System Prompt Style |
|-------|------|-------------------|
| **Parent Advisor** | Educational consultant for parents | Warm, data-grounded, recommends actions |
| **Student Tutor** | Socratic tutor for students (age 9-12) | Patient, encouraging, never gives answers directly |

## Architecture

```
edulens-agents/
├── agents/
│   ├── parent_advisor.py      # BedrockAgentCoreApp entry point
│   └── student_tutor.py       # BedrockAgentCoreApp entry point
├── tools/
│   ├── parent_advisor_tools.py # @tool: profile, tests, skills, time, errors
│   ├── student_tutor_tools.py  # @tool: question context, student level, record
│   ├── memory_tools.py         # @tool: retrieve_memories (mock → AgentCore Memory)
│   └── mock_data.py            # Mock student/question data (replace with Aurora)
├── guardrails/
│   ├── input_guardrail.py      # Block medical, inappropriate, off-topic, long messages
│   ├── output_guardrail.py     # Catch predictions, comparisons, medical advice
│   └── signal_extraction.py    # Extract educational signals for analytics
├── tests/
│   └── test_agents.py          # 34 unit tests (no Bedrock access required)
└── requirements.txt
```

## Quick Start

```bash
# Setup
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run tests (no AWS credentials needed)
pytest tests/test_agents.py -v

# Local test (requires AWS credentials with Bedrock access)
python agents/parent_advisor.py
```

## Deployment to AgentCore Runtime

Uses Direct Code Deployment (zip to S3, no Docker needed):

```bash
# Package
cd edulens-agents
pip install -r requirements.txt -t package/
cp -r agents/ tools/ guardrails/ package/
cd package && zip -r ../parent-advisor.zip . && cd ..

# Upload to S3
aws s3 cp parent-advisor.zip s3://edulens-agent-code-dev-534409838809/parent-advisor/code.zip

# Create/Update Runtime via CDK or CLI
```

## Guardrails

- **Input**: Medical keyword redirect, inappropriate language block, message length limit, off-topic detection
- **Output**: Prediction language, student comparison, medical advice detection
- **Signals**: Skill mention tracking, concern detection, language preference, understanding/confusion indicators

## Tech Stack

- Python 3.12
- Strands Agents SDK (Bedrock model provider)
- Bedrock AgentCore (Runtime + Memory)
- pytest for testing
