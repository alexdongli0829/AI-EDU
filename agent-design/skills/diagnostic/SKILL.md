---
name: diagnostic
description: Analyses test results to classify errors, identify patterns, tag cognitive depth, and update the Learning DNA profile
version: 1.0
trigger:
  - Test results are being discussed
  - Parent or student asks about test performance
  - New test session data available for analysis
metadata:
  output: structured JSON + natural language explanation
  models:
    classification: Haiku (batch)
    analysis: Sonnet (standard) or Opus (deep reports)
depends_on:
  - KNOWLEDGE.md §F (skill taxonomy), §G (error patterns), §H (Webb's DOK)
  - MEMORY-DESIGN.md §4 (Learning DNA schema), §5 (retrieval config)
  - AGENTS.md §5 (model routing)
---

# Learning Diagnostic Skill

## Overview

This skill transforms raw test results into actionable learning insights. The core pipeline:

```
Test Results → Error Classification → Pattern Identification → Skill Gap Analysis → Insights + DNA Update
```

Outputs both structured data (for Learning DNA and system processing) and natural language (for parent/student communication).

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- A test session has been completed and results are available
- Parent or student asks about performance, strengths, or weaknesses
- Error patterns or skill gaps are being discussed
- Cross-session trend analysis is requested
- Learning DNA is being referenced or updated

---

## 1. Error Pattern Classification

### The Five Error Types

Every incorrect response must be classified into exactly one type:

| Error Type | Code | Description | Detection Criteria |
|---|---|---|---|
| **Concept Gap** | `concept_gap` | Doesn't understand the underlying concept | Wrong answer reflects fundamental misunderstanding; similar questions consistently wrong; student cannot explain reasoning |
| **Careless Error** | `careless_error` | Knows concept, makes execution mistakes | Can solve similar questions correctly; error is arithmetic/copying; "oh, I see!" reaction when shown the mistake |
| **Time Pressure** | `time_pressure` | Correct reasoning but ran out of time or rushed | Questions at end of section wrong at higher rate; question skipped; per-question time far exceeds average |
| **Misread Question** | `misread_question` | Comprehension failure on the question stem | Answer would be correct for a different interpretation; student's working shows they solved a different problem |
| **Elimination Failure** | `elimination_failure` | Can't narrow to correct option despite partial understanding | Chose between last two options and picked wrong; answer is the most common distractor |

### Classification Decision Tree

```
Question answered incorrectly
  │
  ├── Was the question skipped or answered in final 10% of time?
  │     YES → Check time usage
  │           ├── Ran out of time → time_pressure
  │           └── Had time remaining → concept_gap (didn't attempt)
  │
  ├── Does the answer suggest a fundamental misunderstanding?
  │     YES → concept_gap
  │           Evidence: reflects known misconception,
  │           student can't explain reasoning,
  │           similar questions consistently wrong
  │
  ├── Was working/reasoning correct but final answer wrong?
  │     YES → careless_error
  │           Evidence: arithmetic slip, miscopied number,
  │           selected wrong option despite correct working
  │
  ├── Did the student misinterpret the question?
  │     YES → misread_question
  │           Evidence: answer correct for different interpretation,
  │           working shows they solved a different problem
  │
  ├── Was the student stuck between 2-3 options?
  │     YES → elimination_failure
  │           Evidence: most common distractor chosen,
  │           answer changed multiple times
  │
  └── Default → concept_gap (if none of the above match clearly)
```

### Confidence Scoring

| Confidence | Meaning | When to Assign |
|---|---|---|
| 0.9-1.0 | Very confident | 3+ signals consistently point to one type |
| 0.7-0.89 | Confident | 2 signals agree, 1 neutral |
| 0.5-0.69 | Moderate | Signals partially contradict |
| Below 0.5 | Low | Insufficient evidence — flag for Socratic clarification |

When confidence is below 0.5, ask the student:
```
"You chose B for this one. Can you tell me what you were thinking?
 Were you running out of time, or did you think B was right?"
```

### Batch Classification Prompt (Haiku)

For efficiency, classify all incorrect responses in one call:

```
Classify each incorrect response into exactly one error type.
For each, provide: error_type, confidence (0.0-1.0), and brief reasoning.

Error types:
- concept_gap: doesn't understand the concept
- careless_error: knows concept, execution mistake
- time_pressure: ran out of time or rushed
- misread_question: misinterpreted what was asked
- elimination_failure: couldn't narrow to correct option

Consider signals:
- Time spent vs section average
- Whether the answer matches a common misconception
- Position in section (later = higher time_pressure likelihood)
- Whether the answer was changed
- Whether similar skill questions were correct elsewhere

Session data: [array of responses]

Output: [{question_id, error_type, confidence, reasoning}]
```

---

## 2. Webb's Cognitive Depth Tagging

Every question (correct or incorrect) is tagged with its Webb's DOK level:

| Level | Name | Description | Diagnostic Interpretation |
|---|---|---|---|
| **1** | Recall | Basic facts, simple procedures | If wrong → likely careless_error or time_pressure |
| **2** | Skill/Concept | Application, requires approach selection | Most common classification target |
| **3** | Strategic Thinking | Reasoning, planning, justifying | If wrong → more likely concept_gap or elimination_failure |
| **4** | Extended Thinking | Synthesis across concepts/sources | Expected difficulty for developing students |

### Depth Distribution Analysis

```json
{
  "depth_distribution": {
    "level_1": { "total": 8, "correct": 7, "accuracy": 0.875 },
    "level_2": { "total": 15, "correct": 10, "accuracy": 0.667 },
    "level_3": { "total": 10, "correct": 5, "accuracy": 0.500 },
    "level_4": { "total": 2, "correct": 0, "accuracy": 0.000 }
  },
  "depth_ceiling": 2,
  "interpretation": "Comfortable at Level 2, struggles at Level 3+. Focus on Level 2-3 transition."
}
```

The `depth_ceiling` is the highest level where accuracy exceeds 60%.

---

## 3. Skill Gap Analysis Output Format

The diagnostic produces structured output:

```json
{
  "session_id": "sess_xyz789",
  "student_id": "stu_abc123",
  "stage": "oc_prep",
  "test_date": "2026-04-06",
  "overall_score": 0.68,

  "section_breakdown": {
    "reading": {
      "score": 0.72,
      "questions_total": 14,
      "questions_correct": 10,
      "time_used_minutes": 38,
      "sub_skill_analysis": [
        {
          "skill": "literal_comprehension",
          "questions": 3,
          "correct": 3,
          "accuracy": 1.00,
          "status": "mastered",
          "depth_range": "1-2"
        },
        {
          "skill": "inference",
          "questions": 4,
          "correct": 2,
          "accuracy": 0.50,
          "status": "developing",
          "depth_range": "2-3",
          "error_breakdown": {
            "concept_gap": 1,
            "elimination_failure": 1
          },
          "recommendation": "Focus on text evidence identification for inference questions"
        }
      ]
    },
    "math": { "...same structure..." },
    "thinking": { "...same structure..." }
  },

  "error_pattern_summary": {
    "concept_gap": { "count": 3, "percentage": 0.27, "subjects": ["math", "thinking"] },
    "careless_error": { "count": 4, "percentage": 0.36, "subjects": ["math"] },
    "time_pressure": { "count": 2, "percentage": 0.18, "subjects": ["thinking"] },
    "misread_question": { "count": 1, "percentage": 0.09, "subjects": ["reading"] },
    "elimination_failure": { "count": 1, "percentage": 0.09, "subjects": ["reading"] }
  },

  "behavioral_observations": {
    "avg_time_per_question": { "reading": 2.7, "math": 1.1, "thinking": 0.9 },
    "skip_rate": 0.03,
    "time_distribution": "front_loaded",
    "completion_rate": { "reading": 1.0, "math": 0.91, "thinking": 0.87 },
    "fatigue_indicator": "moderate — accuracy drops 15% in second half of thinking"
  },

  "trend_comparison": {
    "vs_previous_session": {
      "reading": "+0.05 (improving)",
      "math": "-0.02 (stable)",
      "thinking": "-0.08 (declining)"
    },
    "vs_baseline": {
      "reading": "+0.17 (significant improvement)",
      "math": "+0.08 (moderate improvement)",
      "thinking": "+0.03 (minimal improvement)"
    }
  },

  "priority_recommendations": [
    {
      "rank": 1,
      "area": "thinking.spatial_reasoning",
      "reason": "Lowest accuracy (30%), declining trend, concept_gap dominant",
      "action": "Single-transformation exercises first, build to compound"
    },
    {
      "rank": 2,
      "area": "math.careless_errors",
      "reason": "36% of all errors — highest error type",
      "action": "Introduce checking: re-read question + verify answer"
    },
    {
      "rank": 3,
      "area": "reading.inference",
      "reason": "50% accuracy, below overall reading average",
      "action": "Identify text evidence before selecting inference answers"
    }
  ]
}
```

### Status Labels

| Accuracy | Status | Meaning |
|---|---|---|
| 85-100% | `mastered` | Maintain with occasional practice |
| 65-84% | `confident` | Solid foundation, push difficulty |
| 40-64% | `developing` | Active learning zone — primary focus |
| Below 40% | `emerging` | Needs foundational work before complexity |

---

## 4. Cross-Test Trend Analysis

### Methodology

When 3+ sessions exist, compare recent performance to prior performance:

```
For each sub-skill:
  1. Collect accuracy scores from all sessions
  2. recent_avg = mean(last 3 sessions)
  3. prior_avg = mean(preceding 3 sessions)
  4. delta = recent_avg - prior_avg
  5. Classify:
     - delta > +0.05 → "improving"
     - delta < -0.05 → "declining"
     - else → "stable"

Special: fewer than 6 sessions → compare last 2 vs prior 2
         fewer than 4 sessions → "insufficient_data"
```

### Trend Output

```json
{
  "trend_analysis": {
    "period": "2026-02-15 to 2026-04-06",
    "sessions_analysed": 8,
    "overall_trajectory": "improving (net +0.13 from baseline)",
    "by_subject": {
      "reading": { "trend": "improving", "delta": "+0.07",
                   "notable": "inference improved significantly (+0.15)" },
      "math": { "trend": "stable", "delta": "+0.02",
                "notable": "careless errors declining (positive)" },
      "thinking": { "trend": "declining", "delta": "-0.05",
                    "notable": "spatial reasoning driving decline (-0.12)" }
    },
    "alerts": [
      { "type": "concern", "area": "thinking.spatial_reasoning",
        "message": "Declining for 3 consecutive sessions. Intervention recommended." }
    ],
    "celebrations": [
      { "type": "milestone", "area": "reading.inference",
        "message": "Crossed 65% threshold — moved from 'developing' to 'confident'." }
    ]
  }
}
```

---

## 5. Learning DNA Update Procedures

After diagnostic analysis, the DNA is updated asynchronously.

### Update Rules

```
FOR EACH sub-skill:
  1. new_mastery = weighted_average(
       old_mastery × 0.6,         # Historical weight
       session_accuracy × 0.4     # New data weight
     )
  2. Recalculate trend (recent 3 vs prior 3)
  3. Update depth_ceiling if student demonstrated new capability
  4. Increment sessions_analysed

FOR error_patterns:
  1. Recalculate distribution from last 5 sessions (rolling window)
  2. Update both overall and by_subject distributions
  3. Note trend: "careless_error declining, time_pressure stable"

FOR behavior:
  1. Update avg_time_per_question (rolling average, last 5 sessions)
  2. Recalculate skip_rate, completion_rate, change_answer_rate
  3. Assess stamina (first-half vs second-half accuracy)

FOR milestones:
  1. Check threshold crossings (mastery crossing 40%, 65%, 85%)
  2. Check error pattern shifts (any type changing by > 10%)
  3. Check concerns (3 consecutive declining sessions in any area)
  4. Append new milestones if detected

FOR recommendations:
  1. Score = (1 - mastery) × trend_weight × improvement_potential
     where: declining=1.5, stable=1.0, improving=0.7
  2. Top 2-3 become priority_focus
  3. Above 85% mastery → maintenance list
```

### Update Frequency Guards

- Maximum 5 Learning DNA updates per student per day
- Version number incremented on each update for conflict detection
- Previous version preserved as milestone snapshot before overwrite

---

## 6. Natural Language Output

### For Students

Keep it simple, positive, and actionable:

```
"Here's how your test went today:

 Reading: 10 out of 14 — That's your best Reading score yet!
 Math: 24 out of 35 — Solid, especially on number patterns.
 Thinking: 17 out of 30 — Tough today. Spatial Reasoning was the tricky part.

 The thing that will help most right now: when you get to a Spatial
 Reasoning question, pick ONE corner and follow where it goes.
 We'll practise that next time."
```

### For Parents (English)

Data-first, then interpretation, then action:

```
"Here's the analysis from Ethan's latest test session (6 April 2026):

 Scores: Reading 72% (up from 67%), Math 69% (stable), Thinking 57% (down from 62%)

 Key findings:
 - Reading inference has improved significantly — targeted practice is working
 - 40% of Math errors are careless mistakes — a checking strategy would help immediately
 - Thinking declined due to Spatial Reasoning (30% accuracy, 3rd consecutive drop)

 Priority this week: 10 minutes of Spatial Reasoning exercises daily.
 What's working: Inference practice has paid off. Maintain while redirecting to Spatial."
```

### For Parents (Chinese)

```
"以下是Ethan最新测试分析（2026年4月6日）：

 成绩：阅读72%（从67%上升），数学69%（稳定），思维能力57%（从62%下降）

 主要发现：
 - 阅读推理能力明显提升——有针对性的练习正在起作用
 - 数学错误中40%是粗心错误——养成检查习惯可立即见效
 - 思维能力下降主要由空间推理导致（正确率30%，连续第三次下降）

 本周重点：每天10分钟空间推理练习。
 值得肯定：推理练习已产生效果。保持的同时转向空间推理。"
```

---

## 7. Diagnostic Triggers and Model Routing

| Trigger | Scope | Model |
|---|---|---|
| New test session completed | Full session analysis | Haiku (classification) + Sonnet (analysis) |
| Parent asks "how is [child] doing?" | Trend summary from existing data | Sonnet |
| 3+ sessions without deep analysis | Comprehensive cross-session report | Opus |
| Stage transition (OC → Selective) | Full historical summary + transition recommendations | Opus |
| Student asks "what should I practice?" | Quick skill gap from DNA | Sonnet |
| Writing assessment (Selective) | Nuanced multi-criteria feedback | Opus |

---

## Integration Points

- **Learning DNA:** This skill generates data that feeds into the DNA (see [MEMORY-DESIGN.md](../../MEMORY-DESIGN.md))
- **Study planning:** Output is the primary input for `study-planner`
- **Parent communication:** Results delivered through `parent-advisor` skill
- **OC/Selective context:** Adapts to active stage (3 sections vs 4 including Writing)
- **LTM writes:** All insights tagged with metadata and written to student learning namespace

---

## Input Validation & Safety

### Max Input Sizes

| Input | Limit | Rejection Behaviour |
|-------|-------|---------------------|
| Questions per session | 100 max | Reject sessions with >100 questions; log warning |
| Response data per question | 2,000 chars | Truncate; flag for review |
| Session metadata JSON | 10 KB | Reject; return `INVALID_INPUT` error |
| Batch classification payload | 100 items | Split into batches of 100; process sequentially |
| Learning DNA input for update | 50 KB | Reject; likely corrupt data — flag for investigation |

### Required Fields Validation

Before processing any diagnostic request, validate:

```
REQUIRED for error classification:
  - session_id: non-empty string, valid UUID format
  - student_id: non-empty string, valid UUID format
  - stage: must be "oc_prep" or "selective_prep"
  - responses[]: non-empty array, each element must have:
    - question_id: non-empty string
    - answer: non-empty string
    - is_correct: boolean
    - time_spent: integer >= 0

OPTIONAL but validated if present:
  - subject: must be one of ["reading", "math", "thinking", "writing"]
  - skill: must match known skill taxonomy (KNOWLEDGE.md §F)
  - cognitive_depth: integer 1-4
  - confidence: float 0.0-1.0

ON VALIDATION FAILURE:
  - Return structured error: { "error": "VALIDATION_FAILED", "fields": [...], "message": "..." }
  - Log: { event: "input_validation_failed", session_id, invalid_fields }
  - Do NOT process partial data — reject the entire request
```

### Rate Limits

| Operation | Limit | Enforcement |
|-----------|-------|-------------|
| Tool calls per turn | 10 max | Agent framework enforces; excess calls queued |
| Timeout per tool call | 30 seconds | Hard timeout; return partial result or error |
| Batch classification calls per session | 5 max | Prevents runaway Haiku costs |
| Learning DNA updates per student per day | 5 max | Prevents profile thrashing |
| LTM writes per session | 20 max | Prevents memory flooding |

### Error Response Format

All validation errors return a consistent structure:

```json
{
  "error": "VALIDATION_FAILED",
  "code": "DIAGNOSTIC_INVALID_INPUT",
  "fields": [
    { "field": "responses[3].question_id", "reason": "missing required field" },
    { "field": "stage", "reason": "invalid value: 'oc_test' — must be 'oc_prep' or 'selective_prep'" }
  ],
  "message": "Diagnostic request rejected: 2 validation errors found.",
  "request_id": "req_abc123",
  "timestamp": "2026-04-06T10:30:00Z"
}
