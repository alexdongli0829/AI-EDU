# Diagnostic Skill Pack

> **Skill ID:** `diagnostic`
> **Version:** 1.0
> **Trigger:** Test results are being analysed, error patterns are being classified, or Learning DNA is being updated
> **Agent:** Student Agent (simplified insights), Parent Agent (detailed analysis)
> **Model:** Haiku (per-question classification), Sonnet (summary generation), Opus (deep diagnostic reports)

---

## Description

This skill pack powers EduLens's core analytical capability: transforming raw test results into actionable learning insights. It takes test session data — questions, responses, time data — and produces error classifications, skill gap analyses, trend reports, and Learning DNA updates.

This is the engine that differentiates EduLens from "test-and-score" platforms. While competitors tell parents "your child got 72%," we tell them "your child understands fractions but makes careless arithmetic errors under time pressure, and their inference skills have improved by 12% over the last 3 sessions."

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- A test session has been completed and results are available for analysis
- A parent or student asks about test performance, strengths, or weaknesses
- Error patterns or skill gaps are being discussed
- Learning DNA is being referenced or updated
- Cross-session trend analysis is requested
- The phrase "analyse," "diagnose," "what went wrong," or "how did I/they do" appears

---

## Core Function: The Diagnostic Pipeline

### Input

```json
{
  "session_id": "sess_xyz789",
  "student_id": "stu_abc123",
  "stage": "oc_prep",
  "sections": [
    {
      "subject": "reading",
      "responses": [
        {
          "question_id": "q_001",
          "question_text": "What is the author's main purpose in paragraph 2?",
          "skill": "authors_purpose",
          "cognitive_depth": 3,
          "correct_answer": "B",
          "student_answer": "D",
          "time_spent_seconds": 95,
          "answer_changed": false,
          "is_correct": false
        }
      ],
      "total_questions": 14,
      "correct_count": 9,
      "time_limit_seconds": 2400,
      "time_used_seconds": 2250
    }
  ]
}
```

### Processing Steps

```
Step 1: Per-Question Error Classification
  │  Model: Haiku (batched)
  │  Input: question text, skill, correct answer, student answer, time data
  │  Output: error_type + confidence score
  │
  ▼
Step 2: Skill-Level Aggregation
  │  For each sub-skill: count correct/incorrect, compute mastery %
  │  Compare against Learning DNA baseline
  │  Flag significant changes (±10% or more)
  │
  ▼
Step 3: Error Pattern Distribution
  │  Calculate: what % of errors are concept_gap, careless, time_pressure, etc.
  │  Compare against historical distribution
  │  Identify shifts (e.g., careless errors increasing)
  │
  ▼
Step 4: Behavioural Analysis
  │  Compute: avg time per question, skip rate, answer change rate
  │  Identify: time distribution pattern (front-loaded, even, back-loaded)
  │  Detect: section fatigue (performance drop in later questions)
  │
  ▼
Step 5: Trend Analysis (if 3+ sessions)
  │  Compare current session against previous sessions
  │  Compute trend per sub-skill (improving / stable / declining)
  │  Identify breakthrough moments and concern flags
  │
  ▼
Step 6: Generate Structured Output
  │  Produce: session report, skill gap analysis, recommendations
  │  Write insights to LTM with full metadata
  │  Queue Learning DNA update if significant changes detected
```

### Output

```json
{
  "session_report": {
    "session_id": "sess_xyz789",
    "overall_score": 0.72,
    "section_scores": {
      "reading": { "score": 0.78, "change_from_baseline": "+0.06" },
      "math": { "score": 0.63, "change_from_baseline": "-0.02" },
      "thinking": { "score": 0.53, "change_from_baseline": "-0.05" }
    },
    "highlights": [
      { "type": "improvement", "detail": "Reading inference improved from 58% to 71%" },
      { "type": "concern", "detail": "Thinking spatial_reasoning dropped to 33% (3rd consecutive decline)" }
    ]
  },

  "error_analysis": {
    "total_errors": 22,
    "distribution": {
      "concept_gap": { "count": 4, "pct": 0.18, "subjects": ["math", "thinking"] },
      "careless_error": { "count": 7, "pct": 0.32, "subjects": ["math"] },
      "time_pressure": { "count": 5, "pct": 0.23, "subjects": ["thinking"] },
      "misread_question": { "count": 3, "pct": 0.14, "subjects": ["reading", "math"] },
      "elimination_failure": { "count": 3, "pct": 0.14, "subjects": ["reading", "thinking"] }
    },
    "actionable_insight": "32% of errors are careless — introducing a checking routine could recover 5-7 marks"
  },

  "skill_gaps": [
    {
      "subject": "thinking",
      "skill": "spatial_reasoning",
      "mastery": 0.33,
      "trend": "declining",
      "priority": "critical",
      "recommended_action": "Targeted spatial transformation exercises, 10 min/day, start with 2D rotations before advancing to 3D"
    },
    {
      "subject": "reading",
      "skill": "authors_purpose",
      "mastery": 0.50,
      "trend": "declining",
      "priority": "high",
      "recommended_action": "Practice identifying purpose across different text types — persuasive vs informative vs entertaining"
    },
    {
      "subject": "math",
      "skill": "multi_step_reasoning",
      "mastery": 0.48,
      "trend": "stable",
      "priority": "high",
      "recommended_action": "Break multi-step problems into sub-problems; practice 'what do I need to find first?' strategy"
    }
  ],

  "behavioral_insights": {
    "time_management": "Student uses 94% of available time in Reading but only 78% in Thinking — suggests rushing or giving up on hard Thinking questions",
    "skip_pattern": "Skipped 5 questions in Thinking (last 5) — time pressure pattern confirmed",
    "answer_changes": "Changed answers on 4 questions, 3 of which changed from correct to incorrect — suggest NOT changing answers unless confident"
  },

  "recommendations": {
    "immediate_priority": "Reduce careless errors through post-solve checking routine (potential +5-7 marks)",
    "weekly_focus": "Spatial reasoning targeted practice (10 min/day)",
    "maintain": "Reading inference — on a positive trajectory, keep current practice approach",
    "next_diagnostic": "Recommend full mock test in 2 weeks to reassess spatial reasoning and careless error rate"
  }
}
```

---

## Error Classification Guide

### Classification Decision Tree

```
Student got question wrong
  │
  ├── Did the student skip/leave blank?
  │     └── YES → Check time usage
  │           ├── Ran out of time → time_pressure
  │           └── Had time remaining → concept_gap (didn't attempt)
  │
  ├── Does the student's answer suggest a fundamental misunderstanding?
  │     └── YES → concept_gap
  │           Evidence: answer reflects a known misconception,
  │           student can't explain reasoning, similar questions
  │           are consistently wrong
  │
  ├── Was the student's working/reasoning correct but the final answer wrong?
  │     └── YES → careless_error
  │           Evidence: arithmetic slip, miscopied number,
  │           selected wrong option despite correct working
  │
  ├── Did the student misinterpret what the question was asking?
  │     └── YES → misread_question
  │           Evidence: answer would be correct for a different
  │           interpretation; working shows they solved a different problem
  │
  ├── Was the student stuck between 2-3 options and chose wrong?
  │     └── YES → elimination_failure
  │           Evidence: most common distractor chosen;
  │           student reported uncertainty; answer changed multiple times
  │
  └── Did the student appear to rush (very fast response time)?
        └── YES → time_pressure
              Evidence: response time significantly below average;
              question was in the latter half of the section
```

### Classification Prompt (for Haiku batch call)

```
Classify each incorrect response into exactly one error type.

Error types:
- concept_gap: Student doesn't understand the underlying concept
- careless_error: Correct reasoning but execution mistake
- time_pressure: Ran out of time or rushed
- misread_question: Misinterpreted the question stem
- elimination_failure: Couldn't narrow down from remaining options

For each question, provide:
{
  "question_id": "...",
  "error_type": "...",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}

Consider these signals:
- Time spent vs section average
- Whether the answer matches a common misconception
- Position in the section (later questions → higher time_pressure likelihood)
- Whether the answer changed
- Whether similar skill questions were correct elsewhere
```

---

## Webb's Cognitive Depth Tagging

Every question should be tagged with its Webb's Depth of Knowledge level:

| Level | Name | Diagnostic Interpretation |
|-------|------|--------------------------|
| **1** | Recall | If wrong → likely `careless_error` or `time_pressure` (these should be easy) |
| **2** | Skill/Concept | If wrong → could be any error type; most common classification target |
| **3** | Strategic | If wrong → more likely `concept_gap` or `elimination_failure` (requires deeper thinking) |
| **4** | Extended | If wrong → expected for developing students; not a concern unless mastery > 80% in the sub-skill |

**Depth ceiling analysis:**
For each sub-skill, track the highest DOK level the student consistently handles. This reveals not just WHAT they know, but HOW DEEPLY they understand it.

Example:
```
Student: Ethan
Skill: Math — Number & Algebra
  Level 1 accuracy: 95%  ← Strong recall
  Level 2 accuracy: 78%  ← Good application
  Level 3 accuracy: 45%  ← Struggles with strategic problems
  Level 4 accuracy: 20%  ← Not yet ready

Depth ceiling: Level 2 (can consistently handle application questions)
Growth target: Level 3 (develop strategic reasoning in this area)
```

---

## Cross-Session Trend Analysis

### When to Perform

Trend analysis is meaningful with 3+ sessions. Below 3, report as "insufficient data for trend analysis."

### What to Track

| Metric | Trend Meaning |
|--------|---------------|
| Overall score per section | Is the student improving, flat, or declining in each subject? |
| Sub-skill mastery | Which specific skills are growing vs stagnating? |
| Error type distribution | Are careless errors decreasing? Is time pressure getting worse? |
| Time per question | Is the student getting faster (efficiency) or slower (deliberation)? |
| Skip rate | Declining skip rate = better time management or improved confidence |
| Depth ceiling | Is the student handling harder questions over time? |

### Trend Report Format (for Parent Agent)

```
## Progress Report: [Student Name] — [Date Range]
### Sessions Analysed: [N]

**Overall Trajectory:** [Improving / Mixed / Needs Attention]

### Section Trends
| Section | 3 Sessions Ago | Latest | Trend |
|---------|---------------|--------|-------|
| Reading | 68% | 78% | ↑ Improving |
| Math | 65% | 63% | → Stable |
| Thinking | 62% | 53% | ↓ Declining |

### Key Developments
1. ✅ [Positive development with data]
2. ⚠️ [Concern with data and recommended action]
3. 📊 [Interesting pattern or behavioural insight]

### Recommended Focus for Next 2 Weeks
1. [Priority 1 with specific daily action]
2. [Priority 2 with specific daily action]
3. [Maintain area — no change needed]
```

---

## Student-Facing Diagnostic Communication

When sharing diagnostic results WITH the student (not just the parent), adapt the language:

**DO:**
- Use concrete language: "You got 9 out of 14 in reading — that's 64%"
- Celebrate improvements: "Your inference score went up! That practice paid off."
- Frame gaps as challenges: "Spatial reasoning is your trickiest area — let's level it up"
- Give one clear action: "This week, try 5 spatial questions a day. Just 5."

**DON'T:**
- Share the raw error classification taxonomy ("Your concept_gap rate is 18%")
- Use decline/declining language ("Your thinking skills are declining")
- Overwhelm with data ("Here are 15 metrics about your performance")
- Compare to benchmarks ("Most students at your level score higher")

**Student-friendly summary template:**
```
"Here's how your last test went:

📖 Reading: [X]/[Y] — [strength comment]
🔢 Math: [X]/[Y] — [observation]
🧩 Thinking: [X]/[Y] — [encouragement + focus area]

Your superpower right now: [best sub-skill]
Your challenge quest: [weakest sub-skill] — let's work on this!

One thing to try: [single actionable tip]"
```

---

## Integration Points

- **Learning DNA updates:** This skill generates the data that feeds into Learning DNA (see [MEMORY-DESIGN.md](../../MEMORY-DESIGN.md))
- **Study planning:** Diagnostic output is the primary input for `study-planner` skill pack
- **Parent communication:** Diagnostic results are delivered through `parent-advisor` skill pack
- **OC/Selective context:** Error classification adapts to the active stage (OC = 3 sections, Selective = 4 sections including Writing)
- **LTM writes:** All diagnostic insights are tagged with metadata and written to the student's learning namespace
