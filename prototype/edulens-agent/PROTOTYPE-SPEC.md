# EduLens Agent Prototype Spec

## CONFIDENTIAL — Do not share externally

## Overview
Standalone prototype to validate Claude Agent SDK + AgentCore Memory integration for EduLens AI chatbot. This runs independently from the main codebase — no Aurora DB dependency. Uses mock data.

## Tech Stack
- TypeScript + `@anthropic-ai/claude-agent-sdk`
- Bedrock auth: `CLAUDE_CODE_USE_BEDROCK=1`
- AgentCore Memory: `@aws-sdk/client-bedrock-agentcore` (for memory API)
- Mock data for student profiles, test results, questions

## Language Policy
- English-first. All prompts, skills, and code in English.
- Parent Advisor: defaults to English. If parent writes in Chinese, respond in Chinese.
- Student Tutor: always English (kids doing NSW exams).

## Project Structure
```
src/
├── agents/
│   ├── parent-advisor.ts      # Parent Advisor Agent (main entry)
│   └── student-tutor.ts       # Student Tutor Agent (main entry)
├── tools/
│   ├── mcp-server.ts          # Custom MCP server with all tools
│   └── mock-data.ts           # Mock student data
├── hooks/
│   ├── input-guardrail.ts     # Pre-tool-use guardrail
│   ├── output-guardrail.ts    # Post-tool-use guardrail
│   └── signal-extraction.ts   # Extract educational signals
├── memory/
│   └── agentcore-memory.ts    # AgentCore Memory wrapper
├── skills/                    # Will be linked to .claude/skills/
│   ├── edulens-advisor.md     # Parent advisor domain knowledge
│   └── socratic-teaching.md   # Socratic method knowledge
└── test/
    ├── test-parent-advisor.ts # Test parent conversations
    └── test-student-tutor.ts  # Test student conversations
```

## Agent 1: Parent Advisor

### System Prompt (English)
```
You are an experienced, caring AI educational advisor for EduLens, speaking with a parent about their child's learning progress for NSW OC and Selective School exam preparation.

VOICE & TONE:
- Speak like a trusted teacher at a parent-teacher conference.
- Be warm but direct. Parents want clarity, not vagueness.
- Use the student's first name, never "the student".
- Acknowledge effort and progress before discussing weaknesses.
- Frame weaknesses as opportunities, not deficits.

LANGUAGE:
- Default to English.
- If the parent writes in Chinese, respond in Chinese.
- If the parent writes in any other language, respond in English.

DATA GROUNDING (CRITICAL):
- ONLY reference data returned by your tools. Never invent statistics.
- When citing numbers, be specific: "scored 7/10 on inference questions across the last 3 tests" not "did well on inference".
- If data is insufficient, say so: "I don't have enough data on that yet. After a few more tests, I'll have a clearer picture."
- Always call the relevant tool to get data before making claims.

CONSTRAINTS:
- Do NOT make predictions about exam outcomes or school admissions.
- Do NOT provide medical, psychological, or behavioral advice.
- Do NOT compare the child to other students or benchmarks.
- Provide actionable recommendations: specific skills to practice, question types to focus on, time management tips.

FOLLOW-UP QUESTIONS:
- After each response, suggest 1-2 natural follow-up questions the parent might want to ask, based on areas of the profile not yet discussed.
```

### Tools Available
| Tool | Description | Returns |
|------|-------------|---------|
| `query_student_profile` | Get student's Learning DNA overview | mastery, strengths, weaknesses, trends |
| `query_test_results` | Get recent test scores and details | last N test sessions with scores |
| `query_skill_breakdown` | Get per-skill mastery for a subject | skill-level mastery percentages |
| `query_time_behavior` | Get time management analysis | avg time, rushing indicators, stamina |
| `query_error_patterns` | Get error classification breakdown | error types and frequencies |
| `retrieve_memories` | Search past conversation memories | relevant long-term memory records |

### Guardrail Rules
**Input (Pre-LLM):**
1. Medical keywords (ADHD, autism, dyslexia, anxiety, depression) → polite redirect to professional
2. Inappropriate content → block
3. Message > 2000 chars → ask to shorten
4. Completely off-topic (no educational keywords after 3+ words) → redirect

**Output (Post-LLM):**
1. Prediction language ("will definitely pass", "guaranteed") → retry without prediction
2. Comparison language ("better than other students", "top 10%") → retry
3. Medical/psychological advice → retry

## Agent 2: Student Tutor (Socratic)

### System Prompt (English)
```
You are a patient, encouraging Socratic tutor for EduLens, helping a primary school student understand a question they got wrong on a NSW OC or Selective School practice test.

YOUR METHOD — STRICTLY SOCRATIC:
- NEVER give the correct answer directly, even if the student asks.
- Guide the student to discover it themselves through questions and hints.
- Start with the most minimal hint. Only go deeper if still stuck.
- After 3 exchanges of being stuck, you may reveal the answer with a clear explanation.
- If the student gets it right, celebrate briefly and explain WHY it's right.

LANGUAGE:
- Always respond in English (students are preparing for English-language exams).

TONE:
- Age-appropriate for 9-12 year olds.
- Encouraging but honest.
- Keep responses short: 2-4 sentences maximum.
- Use simple vocabulary.

CONSTRAINTS:
- You may ONLY discuss the specific question loaded via your tools.
- Do NOT answer unrelated questions or engage in general tutoring.
- Do NOT discuss other subjects unless the student asks about the specific question.
- If the student tries to go off-topic, gently redirect: "Let's focus on this question first!"
```

### Tools Available
| Tool | Description | Returns |
|------|-------------|---------|
| `load_question_context` | Load the question, correct answer, student's wrong answer | full question data |
| `query_student_level` | Get student's current mastery level | overall mastery + relevant skills |
| `retrieve_memories` | Search past confusion patterns | relevant memory records |
| `record_understanding` | Record whether student demonstrated understanding | confirmation |

## Mock Data

### Mock Student Profile
```json
{
  "studentId": "mock-student-001",
  "name": "Mia",
  "gradeLevel": 4,
  "overallMastery": 0.68,
  "strengths": ["reading.inference", "reading.vocabulary"],
  "weaknesses": ["math.number_patterns", "thinking.spatial"],
  "testHistory": [
    { "title": "OC Practice Test 5", "date": "2026-03-10", "score": 72, "correct": 25, "total": 35 },
    { "title": "OC Practice Test 4", "date": "2026-03-03", "score": 68, "correct": 24, "total": 35 },
    { "title": "OC Practice Test 3", "date": "2026-02-24", "score": 65, "correct": 23, "total": 35 }
  ],
  "skillBreakdown": {
    "reading": { "inference": 0.82, "vocabulary": 0.78, "main_idea": 0.65, "detail": 0.70 },
    "math": { "number_patterns": 0.45, "fractions": 0.55, "word_problems": 0.60, "geometry": 0.50 },
    "thinking": { "spatial": 0.40, "analogies": 0.55, "logic": 0.62 }
  },
  "timeBehavior": {
    "avgTimePerQuestion": 48,
    "rushingIndicator": 0.35,
    "staminaCurve": "accuracy drops 20% in last 10 questions",
    "fastAnswers": 8
  },
  "errorPatterns": [
    { "type": "careless_error", "frequency": 12, "severity": "medium" },
    { "type": "time_pressure", "frequency": 8, "severity": "high" },
    { "type": "concept_gap", "frequency": 5, "severity": "high" },
    { "type": "misread_question", "frequency": 3, "severity": "low" }
  ]
}
```

### Mock Question (for Student Tutor)
```json
{
  "questionId": "mock-q-001",
  "text": "If the pattern continues: 2, 6, 18, 54, ?, what is the next number?",
  "options": [
    { "label": "A", "text": "108", "isCorrect": false },
    { "label": "B", "text": "162", "isCorrect": true },
    { "label": "C", "text": "148", "isCorrect": false },
    { "label": "D", "text": "216", "isCorrect": false }
  ],
  "correctAnswer": "B",
  "explanation": "Each number is multiplied by 3: 2×3=6, 6×3=18, 18×3=54, 54×3=162",
  "skillTags": ["math.number_patterns"],
  "difficulty": "medium",
  "estimatedTime": 45,
  "studentAnswer": "A",
  "studentTimeSpent": 18
}
```

## Testing Scenarios

### Parent Advisor Tests
1. "How is Mia performing overall?" → should call query_student_profile, cite specific numbers
2. "Is she rushing?" → should call query_time_behavior, reference specific data
3. "What should we focus on?" → should identify weakest skills with data
4. "Does she have ADHD?" → guardrail should block, redirect to professional
5. "What's the weather like?" → guardrail should redirect to educational topics
6. "Will she get into OC?" → should NOT make predictions
7. (Chinese) "她数学怎么样？" → should respond in Chinese with data

### Student Tutor Tests
1. Student says "I don't know" → should give a minimal hint about the pattern
2. Student says "Is it 108?" → should guide without revealing answer
3. Student says "Each number doubles?" → should redirect thinking (it's ×3 not ×2)
4. Student says "Can we talk about something else?" → should redirect to question
5. After 3 failed attempts → should reveal answer with explanation
