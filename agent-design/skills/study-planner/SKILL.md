---
name: study-planner
description: Generates personalised study plans based on Learning DNA, target test date, and available study time
version: 1.0
trigger:
  - Parent or student requests a study plan
  - Agent detects planning intent ("what should I practice?", "make me a plan")
  - Diagnostic results suggest a new focus area
metadata:
  input: Learning DNA + test_date + available_hours_per_week
  output: weekly study plan with daily session templates
depends_on:
  - MEMORY-DESIGN.md §6 (Learning DNA schema)
  - KNOWLEDGE.md §L (preparation strategy), §F (skill taxonomy)
  - skills/diagnostic/SKILL.md (identifying priority areas)
  - SOUL.md (age-appropriate communication, ZPD principle)
---

# Study Plan Generation Skill

## Overview

This skill generates personalised, time-aware study plans by combining three inputs:

```
Learning DNA (where the student IS)
     +
Target Test Date (how much TIME remains)
     +
Available Study Time (how many HOURS per week)
     ↓
Weekly Study Plan (what to DO each day)
```

Plans follow the Zone of Proximal Development: practice at the edge of current ability.

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- Parent or student asks for a study plan or schedule
- Parent asks "What should we focus on this week?"
- After a diagnostic, the agent recommends a focus area
- Parent mentions available study time or days-until-test

---

## 1. Input Requirements

### Required Inputs

| Input | Source | Example |
|---|---|---|
| **Learning DNA** | Retrieved from LTM | See MEMORY-DESIGN.md §6 |
| **Target test date** | Student profile or parent input | "8 May 2026" (OC) or "1 May 2026" (Selective) |
| **Available study time** | Asked from parent/student | "30 min/day, 5 days/week" |

### When Inputs Are Missing

```
IF Learning DNA is null (new student):
  → "I don't have diagnostic data yet. Let's start with a baseline test.
     In the meantime, here's a balanced general plan."
  → Generate default balanced plan

IF test date unknown:
  → Ask: "When is the test? OC is 8-9 May 2026, Selective is 1-2 May 2026."

IF available hours not specified:
  → Default: 30 min/day, 5 days/week
  → Note: "This plan assumes ~30 min/day. Let me know to adjust."
```

---

## 2. Time-Based Intensity Scaling

| Phase | Time to Test | Daily Practice | Focus | Mock Tests |
|---|---|---|---|---|
| **Foundation** | 6-12 months | 20-30 min | Concepts, broad coverage | Monthly |
| **Building** | 3-6 months | 25-35 min | Target weak areas, timed practice | Biweekly |
| **Sharpening** | 1-3 months | 30-45 min | Consolidate, reduce errors, pacing | Weekly |
| **Taper** | Final 2 weeks | 15-20 min | Light review, confidence, rest | One final, then stop |

### Scaling Rules

```
months_remaining = (test_date - today).days / 30

Foundation (6-12 months):
  weak_area: 40%  |  strength: 30%  |  mixed: 30%

Building (3-6 months):
  weak_area: 55%  |  strength: 20%  |  mixed: 25%

Sharpening (1-3 months):
  weak_area: 45%  |  strength: 15%  |  timed: 25%  |  error_reduction: 15%

Taper (final 2 weeks):
  light_review: 40%  |  confidence: 40%  |  rest: 20%
```

---

## 3. Zone of Proximal Development

### Difficulty Selection

| Mastery Level | Practice Difficulty | Target Accuracy |
|---|---|---|
| Below 40% (emerging) | Level 1-2 questions | Build to 50% |
| 40-65% (developing) | Level 2-3 questions | Build to 70% |
| 65-85% (confident) | Level 3-4 questions | Build to 85% |
| Above 85% (mastered) | Occasional Level 3-4; shift time elsewhere | Maintain |

### The 70% Success Rate Target

Sessions should aim for ~70% accuracy — the optimal learning zone:

- Below 50%: Questions too hard → step down difficulty
- 50-70%: Optimal learning zone → maintain difficulty
- Above 85%: Questions too easy → step up or shift to weaker skill

---

## 4. Weekly Plan Output Format

### Structured Output (JSON)

```json
{
  "plan_id": "plan_20260406",
  "student_name": "Ethan",
  "stage": "oc_prep",
  "phase": "sharpening",
  "test_date": "2026-05-08",
  "days_remaining": 32,
  "weekly_hours": 2.5,

  "priority_areas": [
    { "area": "thinking.spatial_reasoning", "mastery": 0.38, "weight": 0.30 },
    { "area": "math.multi_step_reasoning", "mastery": 0.50, "weight": 0.25 },
    { "area": "reading.inference", "mastery": 0.65, "weight": 0.20 },
    { "area": "maintenance", "weight": 0.15 },
    { "area": "mock_test_review", "weight": 0.10 }
  ],

  "weekly_schedule": {
    "monday": {
      "duration": 30,
      "focus": "thinking.spatial_reasoning",
      "session": {
        "warmup": "3 min — 3 single-rotation questions (Level 1)",
        "core": "20 min — 8 mixed rotation/reflection (Level 2)",
        "review": "7 min — Error review with visual anchoring"
      },
      "zpd_level": "1-2",
      "target_accuracy": "60-70%"
    },
    "tuesday": {
      "duration": 30,
      "focus": "math.multi_step_reasoning",
      "session": {
        "warmup": "3 min — 3 single-step problems",
        "core": "20 min — 6 multi-step word problems (Level 2-3)",
        "review": "7 min — Check-your-work practice"
      }
    },
    "wednesday": {
      "duration": 30,
      "focus": "reading.inference",
      "session": {
        "warmup": "3 min — 2 literal comprehension questions",
        "core": "20 min — 1 passage with 5 inference questions",
        "review": "7 min — Evidence identification practice"
      }
    },
    "thursday": {
      "duration": 30,
      "focus": "mixed_maintenance",
      "session": {
        "warmup": "3 min — Quick mental math drill",
        "core": "20 min — 10 mixed questions across strong areas",
        "review": "7 min — Timed pacing practice"
      }
    },
    "friday": {
      "duration": 30,
      "focus": "spatial_reasoning + weekly_review",
      "session": {
        "warmup": "3 min — Review Monday's errors",
        "core": "15 min — 6 new spatial questions (Level 2)",
        "review": "12 min — Review all week's errors"
      }
    }
  },

  "diagnostic_checkpoint": {
    "frequency": "every 2 weeks",
    "next": "2026-04-20"
  }
}
```

### Natural Language Plan (For Parents)

```
"Here's Ethan's study plan for this week (6-12 April):

Sharpening Phase — 32 days until the test. Focus on three priority areas.

Monday: Spatial Reasoning (30 min)
  8 rotation/reflection questions. Visual anchoring technique. Target: 60-70%.

Tuesday: Math Multi-Step Problems (30 min)
  6 word problems requiring 2-3 steps. 'Break it into pieces' strategy.

Wednesday: Reading Inference (30 min)
  One passage with 5 inference questions. Find text evidence first.

Thursday: Mixed Maintenance (30 min)
  10 questions across strong areas. Timed pacing practice.

Friday: Spatial Reasoning + Weekly Review (30 min)
  Review Monday's errors + new spatial questions + week's error review.

Diagnostic check: April 20 — we'll reassess and adjust.

Tip: 30 focused minutes > 60 unfocused minutes. If Ethan is tired, stop early."
```

---

## 5. Built-In Diagnostic Review Cycles

| Phase | Checkpoint Frequency | What Happens |
|---|---|---|
| Foundation | Every 4 weeks | Full diagnostic + DNA update + plan revision |
| Building | Every 2-3 weeks | Full diagnostic + plan revision |
| Sharpening | Every 1-2 weeks | Timed mock + error review + minor adjustment |
| Taper | No checkpoints | Light review only; preserve confidence |

### Plan Adjustment Rules

```
After each diagnostic:

IF mastery improved > 10%:
  → Reduce area's weight, promote next weakest
  → Celebrate improvement with student

IF mastery declined > 5%:
  → Increase area's weight immediately
  → Investigate: bad day or real decline?
  → Consider stepping DOWN difficulty

IF error pattern shifted:
  → Adjust practice type (more checking if careless rose)

IF plateau for 2+ checkpoints:
  → Change practice format (different question styles)
  → Consider that student may need a break
  → Discuss with parent
```

---

## 6. Practice Session Templates

### 15-Minute Quick Session

```
- 2 min warm-up (2-3 recall questions)
- 10 min core (5 focused questions on one skill)
- 3 min review (check errors, one takeaway)
Best for: Short on time, maintaining momentum
```

### 30-Minute Standard Session

```
- 3 min warm-up (activate prior knowledge)
- 20 min core (8-10 questions, Socratic review on errors)
- 7 min review (summarise, preview next session)
Best for: Regular daily practice
```

### 45-Minute Deep Session

```
- 3 min warm-up
- 30 min core (full section practice OR Writing exercise)
- 12 min review (detailed error analysis, strategy discussion)
Best for: Weekend or intensive, Selective Writing practice
```

### 90-Minute Mock Test Session

```
OC: Reading (40 min) + Math (40 min) + Thinking (30 min) = 110 min
  OR: OC mini-mock — 2 sections at half length (~50 min)

Selective: All 4 sections = 155 min (full mock)
  OR: Selective mini-mock — 2-3 sections (~75-100 min)

+ 15-30 min review session (can be next day)
```

---

## 7. Example Plans for Different Profiles

### Profile A: Strong Reader, Weak Math + Thinking

```
Student: Year 4, OC Prep, 4 months to test
DNA: Reading 78%, Math 52%, Thinking 48%
Error pattern: concept_gap dominant in Math

Plan:
  Math: 35% (concept building, Level 1-2 → 2-3)
  Thinking: 30% (Spatial Reasoning emphasis)
  Reading: 20% (maintain + push critical evaluation)
  Mixed/mock: 15%

Mon=Math, Tue=Thinking, Wed=Reading, Thu=Math, Fri=Thinking+review
```

### Profile B: Balanced but Careless

```
Student: Year 4, OC Prep, 2 months to test
DNA: Reading 68%, Math 70%, Thinking 65%
Error pattern: 40% careless errors across all sections

Plan:
  Accuracy drills: 40% (checking strategies)
  Weakest (Thinking): 25%
  Timed practice: 20%
  Mock tests: 15%

Mon=Accuracy(Math), Tue=Thinking, Wed=Accuracy(Reading),
Thu=Timed mixed, Fri=Review+mock section
```

### Profile C: OC → Selective Transition, Writing Beginner

```
Student: Year 6, Selective Prep, 6 months to test
DNA: Reading 75%, Math 72%, Thinking 68%, Writing null
Error pattern: time_pressure in Thinking

Plan:
  Writing: 35% (intensive ramp-up from scratch)
  Thinking: 25% (pacing strategies + spatial)
  Reading: 20% (adapt to harder passages)
  Math: 10% (maintain)
  Mock: 10%

Mon=Writing, Tue=Thinking, Wed=Writing, Thu=Reading, Fri=Mixed+review
Writing focus: Structure first (wks 1-4) → Language (5-8) → Ideas+Engagement (9-12)
```

### Profile D: Final Month, Performance Dip

```
Student: Year 4, OC Prep, 3 weeks to test
DNA: Reading 70%, Math 65%, Thinking 55% (was 62%)
Error pattern: time_pressure + careless rising (possible anxiety)

Plan:
  Confidence building: 30% (comfortable level to rebuild)
  Thinking consolidation: 25% (familiar question types)
  Test strategy: 25% (pacing, elimination, skip-and-return)
  Light mock: 20% (shorter mocks, process over score)

Mon=Confidence(mix), Tue=Thinking(familiar), Wed=Strategy drills,
Thu=Mini-mock, Fri=Light review + rest

PARENT NOTE: "Scores often dip before stabilising. Keep practice light,
ensure good sleep, and remind [child] they've prepared well."
```

### Profile E: Top Performer Maintaining Edge

```
Student: Year 6, Selective Prep, 2 months to test
DNA: Reading 88%, Math 85%, Thinking 82%, Writing 75%
Error pattern: elimination_failure on hardest questions

Plan:
  Writing (polish): 30% (Engagement + Audience focus)
  Level 4 challenge questions: 30% (push ceiling)
  Timed full mocks: 25% (stamina + consistency)
  Light maintenance: 15%

Mon=Writing, Tue=Level 4 Math+Thinking, Wed=Full mock,
Thu=Writing, Fri=Mock review + strategy
```

---

## 8. Plan Communication

### To Students

```
"Here's your practice plan for this week:

Monday: Math puzzles (the multi-step ones we've been working on)
Tuesday: Thinking Skills — Spatial Reasoning practice
Wednesday: Reading — a new passage to explore together
Thursday: Mixed questions — a bit of everything
Friday: Review + retry the tricky ones from this week

You're doing great. Let's keep building on last week!"
```

### To Parents

```
"Based on [child]'s Learning DNA and 32 days until the test:

Priority areas (from diagnostic):
1. Spatial Reasoning (38% → target 50%)
2. Multi-step Math (50% → target 65%)
3. Reading inference (65% → maintain)

[Detailed daily schedule]

Diagnostic checkpoint: April 20 — we'll reassess.
Let me know if daily time needs adjusting."
```

---

## Integration Points

- **Diagnostic input:** Plans generated from `diagnostic` output (skill_gaps + recommendations)
- **Learning DNA:** Primary data source for priority scoring and mastery levels
- **Parent communication:** Plans delivered through `parent-advisor` style
- **OC/Selective context:** Section composition differs by stage (3 vs 4 sections)
- **Memory:** Previous plans stored in family insights namespace for continuity
- **Test dates:** System config provides target dates for phase calculation

---

## Input Validation & Safety

### Max Input Sizes

| Input | Limit | Rejection Behaviour |
|-------|-------|---------------------|
| Parent/student message length | 3,000 chars | Truncate to 3,000; inform user message was shortened |
| Learning DNA input | 50 KB | Reject; likely corrupt — flag for investigation |
| Priority areas list | 10 max | Cap at 10; focus on top priorities |
| Weekly schedule days | 7 max | Reject >7; invalid calendar data |
| Session templates per day | 3 max | Cap at 3; warn against over-scheduling |
| Session metadata JSON | 10 KB | Reject; return `INVALID_INPUT` error |

### Required Fields Validation

Before generating any study plan, validate:

```
REQUIRED:
  - student_id: non-empty string, valid UUID format
  - active_stage: must be "oc_prep" or "selective_prep"
  - Learning DNA or indication that DNA is unavailable (triggers default plan)

REQUIRED if user-specified:
  - test_date: valid ISO 8601 date, must be in the future
  - available_hours_per_week: float > 0, max 40 (sanity check)
  - days_per_week: integer 1-7

VALIDATION for generated plans:
  - Total weekly hours must not exceed available_hours_per_week
  - Each session duration: 10-90 minutes (reject outside range)
  - Priority area weights must sum to ~1.0 (±0.05 tolerance)
  - ZPD levels must be consistent with mastery levels in DNA
  - Selective plans MUST include Writing allocation if stage = selective_prep

ON VALIDATION FAILURE:
  - Return structured error (see format below)
  - Log: { event: "input_validation_failed", student_id, invalid_fields }
  - For missing optional inputs: use defaults and note assumptions
```

### Rate Limits

| Operation | Limit | Enforcement |
|-----------|-------|-------------|
| Tool calls per turn | 10 max | Agent framework enforces; excess calls queued |
| Timeout per tool call | 30 seconds | Hard timeout; return partial result or error |
| Plan generation requests per session | 5 max | Prevents regeneration loops |
| LTM retrieval calls per plan | 3 max | Prevents over-fetching |
| LTM writes per session | 20 max | Prevents memory flooding |

### Error Response Format

All validation errors return a consistent structure:

```json
{
  "error": "VALIDATION_FAILED",
  "code": "STUDY_PLANNER_INVALID_INPUT",
  "fields": [
    { "field": "test_date", "reason": "date is in the past: 2025-01-15" },
    { "field": "available_hours_per_week", "reason": "exceeds maximum of 40 (received: 60)" }
  ],
  "message": "Study plan request rejected: 2 validation errors found.",
  "request_id": "req_abc123",
  "timestamp": "2026-04-06T10:30:00Z"
}
