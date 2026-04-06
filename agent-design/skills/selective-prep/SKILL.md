---
name: selective-prep
description: Helps students prepare for the NSW Selective High School Placement Test, including Writing assessment
version: 1.0
trigger:
  - Student is in selective_prep stage
  - Student requests Selective test practice
  - Writing feedback requested
metadata:
  stage: selective_prep
  target_age: 11-12 (Year 6)
  sections: [reading, math, thinking, writing]
  test_format: 4 sections, MCQ + Writing, ~155 minutes
depends_on:
  - skills/oc-prep/SKILL.md (inherits all MCQ strategies)
  - SOUL.md (teaching philosophy)
  - KNOWLEDGE.md §C (Selective format), §F (skill taxonomy), §M (writing guide)
  - MEMORY-DESIGN.md §6 (Learning DNA)
---

# Selective Test Preparation Skill

## Overview

This skill builds on everything in [oc-prep/SKILL.md](../oc-prep/SKILL.md) and adds preparation for the NSW Selective High School Placement Test. The Selective test is longer (155 min vs 110 min), harder, and adds a Writing section worth 25%.

**Key differences from OC:**
- 4 sections instead of 3 (adds Writing at 25% weight)
- Each section weighted 25% (not 33.3%)
- Reading: 17Q/45min (more questions, more time, harder passages)
- Thinking: 40Q/40min (10 more questions, more complex items)
- Writing: 1 extended response/30min (entirely new section)
- Target students are Year 6 (11-12 years old) — more sophisticated reasoning

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- Student's `active_stage == "selective_prep"`
- Conversation involves Selective test preparation or review
- Writing practice or feedback is requested
- Test results from a Selective-format test are being discussed

---

## Section Adjustments from OC

### Reading (17Q / 45 min / 25%)

**Time budget:** ~2.6 minutes per question (3 have multiple parts).

Selective Reading adds:
- Longer, more complex passages approaching high school level
- Greater emphasis on critical evaluation and synthesis
- Multi-paragraph arguments requiring sustained comprehension
- Academic and literary vocabulary

**Additional strategies for Year 6:**
- Teach skimming: first/last sentence of each paragraph to get the gist
- Annotation: mentally tag arguments, turning points, and author's technique
- Cross-passage comparison: identify agreement, disagreement, complementary views
- Tone analysis: recognise irony, bias, objectivity, sympathy

**Socratic prompts (advanced):**
- "This passage uses irony. Find a sentence where the author says one thing but means another."
- "Compare how Passage A and B discuss the same topic. Where do they diverge?"
- "The author structures this as problem-solution. What's the problem? What solution is proposed?"

### Mathematical Reasoning (35Q / 40 min / 25%)

**Time budget:** ~1.14 minutes per question. Same pace as OC.

Selective Math adds:
- More Level 3-4 questions requiring strategic thinking
- Questions combining multiple mathematical domains
- Greater emphasis on algebraic reasoning and ratio/proportion
- Harder multi-step problems

**Additional strategies for Year 6:**
- Two-pass strategy: first pass = answer everything solvable in <60 seconds; second pass = harder problems
- Algebraic thinking: "Let the number of apples be x..."
- Ratio and proportion mastery (appears heavily at Selective level)
- Back-solving: substitute each answer option to check

### Thinking Skills (40Q / 40 min / 25%)

**Time budget:** 1 minute per question. Same per-question pace, 10 more questions.

Selective Thinking adds:
- Complex spatial transformations (multiple rotations/reflections combined)
- Harder logical reasoning with more constraints
- Level 4 questions requiring synthesis across data sources
- Greater working memory demands
- Section fatigue is a real issue at 40 questions

**Additional strategies for Year 6:**
- Spatial: track TWO reference points, not just one; break compound transformations into steps
- Logic: use elimination grids for scheduling/ordering; write ALL constraints before starting
- Patterns: examine 3+ items; verify rule against ALL items
- Fatigue management: questions 1-15 (fresh), 16-30 (steady), 31-40 (push through)

---

## Section 4: Writing (1Q / 30 min / 25%)

Writing is the critical new section. At 25% weight, it equals any MCQ section. For borderline candidates, Writing is often the deciding factor.

### The Four Writing Types

Students must be prepared for any prompt type:

#### Narrative Writing
- **Goal:** Tell a compelling story with characters, setting, conflict, resolution
- **Structure:** Hook → Rising action → Climax → Resolution
- **Key techniques:** Show-don't-tell, dialogue, sensory detail, figurative language
- **Common pitfall:** "And then... and then..." flat narration without tension
- **Coaching:**
  ```
  "Instead of 'She was scared,' SHOW me what scared looks like.
   What does her body do? What does she hear? How does her stomach feel?"
  ```

#### Persuasive Writing
- **Goal:** Argue a position convincingly with evidence and logic
- **Structure:** Thesis → Argument 1 (strongest) → Argument 2 → Counterargument & rebuttal → Conclusion
- **Key techniques:** Rhetorical questions, evidence/statistics, emotive language, expert opinion
- **Common pitfall:** Stating opinions without supporting evidence
- **Coaching:**
  ```
  "You said 'homework should be banned.' That's your opinion. Now CONVINCE me.
   Give me a reason. Then give me evidence for that reason."
  ```

#### Descriptive Writing
- **Goal:** Create a vivid, immersive picture using sensory language
- **Structure:** Opening image → Layers of detail → Mood/atmosphere → Closing image
- **Key techniques:** Five senses, figurative language (simile, metaphor, personification), precise word choice
- **Common pitfall:** Telling instead of describing ("It was pretty" vs "Sunlight fractured through the stained glass...")
- **Coaching:**
  ```
  "Close your eyes and imagine the scene. What do you see first?
   What do you hear? What does the air smell like?
   Write what your senses tell you."
  ```

#### Reflective Writing
- **Goal:** Explore personal thoughts and connect experience to broader themes
- **Structure:** Experience → Thoughts/feelings → Deeper insight → What was learned
- **Key techniques:** Honest introspection, universal themes, showing vulnerability
- **Common pitfall:** Recounting events without reflecting on their significance
- **Coaching:**
  ```
  "You told me WHAT happened. Now tell me what it MEANT to you.
   How did it change the way you think?"
  ```

### Writing Assessment Rubric (6 Criteria)

| # | Criterion | What Markers Look For | Common Issues | Feedback Focus |
|---|---|---|---|---|
| 1 | **Ideas & Content** | Depth of thinking, originality, relevance, development of ideas | Surface-level ideas, lack of detail | "Your idea is interesting — now go deeper. What happens if we explore this?" |
| 2 | **Structure** | Logical organisation, paragraphing, cohesion, effective transitions | No paragraphs, random ordering, abrupt ending | "Let's plan before writing. 3 dot points: beginning, middle, end." |
| 3 | **Language** | Vocabulary range, sentence variety, literary techniques | Simple repetitive sentences, overused words | "You wrote 'nice' three times. What other words could describe this?" |
| 4 | **Conventions** | Spelling accuracy, grammar, punctuation | Spelling errors, run-on sentences, missing commas | "Read this sentence aloud. Does it sound right? Where would you pause?" |
| 5 | **Audience & Purpose** | Reader awareness, appropriate voice, consistent register | Inconsistent tone, forgetting the reader | "Who is reading this? How do you want them to feel?" |
| 6 | **Engagement** | Compelling hook, sustained interest, satisfying ending | Flat opening, trailing off | "Your first sentence is the most important. It needs to grab the reader." |

### Writing Feedback Approach

Use the **2+1+1 pattern** — structured and encouraging:

```
1. TWO specific strengths (with quotes from the student's writing)
   "Your opening line — 'The door groaned like an old man' — is brilliant
    personification. And your dialogue in paragraph 3 feels natural."

2. ONE priority area for improvement (with a specific suggestion)
   "The ending feels rushed — only one sentence. Can you add 2-3 more
    sentences showing how the character felt after everything that happened?"

3. ONE stretch challenge (for next time)
   "Next time, try varying your sentence lengths. Mix short punchy sentences
    with longer flowing ones. It creates rhythm."
```

**Never do:**
- List every spelling mistake (focus on patterns, not individual errors)
- Rewrite the student's work for them
- Compare to other students' writing
- Say "this is wrong" without explaining why or how to improve

### Writing Time Management (30 Minutes)

```
Minutes 1-3:   READ the prompt carefully. Decide writing type.
               PLAN: 5-6 dot points for structure.
               Note 3-5 strong vocabulary words to use.

Minutes 3-25:  WRITE the piece following the plan.
               Don't stop to edit — keep moving forward.
               Aim for 350-500 words.

Minutes 25-30: RE-READ and edit:
               - Fix spelling mistakes
               - Check paragraph breaks
               - Strengthen one weak sentence
               - Make sure the ending is complete and satisfying
```

**Planning template (teach students to use this):**

```
Prompt: [what the question asks]
Type: [narrative / persuasive / descriptive / reflective]
Main idea: [one sentence]
Beginning: [what happens first / opening hook]
Middle: [key events / arguments / details]
End: [resolution / conclusion / final image]
Key words: [3-5 strong vocabulary words to use]
```

**The single biggest Writing mistake:** Diving in without planning, writing freely until time runs out, submitting with no ending. **ALWAYS plan. ALWAYS leave time for an ending.**

---

## Test Stamina (155 Minutes)

### Stamina Strategies

1. **Break utilisation:** Use breaks between sections to reset — deep breaths, stretch, refocus
2. **Energy management:** Reading and Writing are the most cognitively demanding
3. **Practice full-length:** Experience the full 155 minutes at least 3-4 times before the real test
4. **Build up gradually:** 90 min → 120 min → 155 min mock tests

### Performance Fade Detection

```
IF accuracy_first_half > accuracy_second_half by > 15%:
  → Student shows significant fatigue
  → Strategies:
    - Practise back-half sections in isolation
    - Build up duration gradually
    - Ensure good sleep, nutrition, hydration
    - Teach mental reset technique between sections
```

---

## OC → Selective Transition

### What Carries Over
- All MCQ strategies from Reading, Math, and Thinking
- Error pattern awareness and self-correction habits
- Time management fundamentals
- Test-taking confidence

### What Changes
- Section weighting: 33.3% → 25% per section
- New section: Writing (25%)
- Higher difficulty across all MCQ sections
- Longer test: 110 → 155 minutes
- More Thinking questions: 30 → 40

### Transition Coaching

```
"You already know how to do well on Reading, Math, and Thinking from OC.
 Those skills carry over directly. The biggest change is Writing — it's
 brand new and worth 25% of your score. We'll start building Writing skills
 alongside maintaining everything you've already learned."
```

### Recommended Transition Schedule

```
First 4 weeks:
  40% Writing (intensive ramp-up from scratch)
  20% Reading (adapt to harder passages)
  20% Math (level up to harder problems)
  20% Thinking (adjust to 40-question pace)

Weeks 5-12:
  30% Writing (continued development)
  25% weakest MCQ section
  25% second weakest MCQ section
  20% strongest MCQ section (maintenance)

Final 4 weeks before test:
  25% each section (balanced)
  Full-length timed mock tests weekly
  Writing under timed conditions every session
```

---

## Writing Practice Variations

| Exercise | Duration | Focus |
|---|---|---|
| Full piece (plan → write → review) | 30 min | Complete writing under test conditions |
| Opening paragraph only | 10 min | Hook writing, first impressions |
| Planning drill | 5 min | Speed planning from prompt to dot points |
| Vocabulary building | 10 min | Collect strong words for specific themes |
| Editing exercise | 15 min | Improve a draft piece (own or provided) |
| Prompt type identification | 5 min | Read 5 prompts, identify the writing type required |

---

## Adapting to the Student (Selective)

```
IF writing.mastery is null (new to Writing):
  → Start with basics: What is a paragraph? What makes a good opening?
  → Focus on Structure first — ideas and language come after
  → Use 2+1+1 feedback very gently

IF writing.mastery < 0.40:
  → Focus on Structure and Conventions (most teachable)
  → Provide templates and planning frameworks
  → Celebrate any complete piece with beginning, middle, and end

IF writing.mastery 0.40-0.65:
  → Push on Language and Ideas (higher-order criteria)
  → Introduce literary techniques: simile, metaphor, personification
  → Challenge: "Rewrite this paragraph using more vivid language"

IF writing.mastery > 0.65:
  → Focus on Engagement and Audience (polish criteria)
  → Work on voice consistency and stylistic choices
  → Introduce time pressure — write to the 30-minute clock
```

---

## Integration Points

- **Error classification:** Use `diagnostic` skill for per-question analysis
- **Study planning:** Use `study-planner` — must include Writing time allocation
- **Parent communication:** Use `parent-advisor` for Selective strategy discussions
- **Writing feedback:** Route to Opus model for detailed multi-criteria assessment
- **OC foundation:** Reference `oc-prep` skill for base strategies that carry over

---

## Input Validation & Safety

### Max Input Sizes

| Input | Limit | Rejection Behaviour |
|-------|-------|---------------------|
| Student message length | 2,000 chars | Truncate to 2,000; warn student to shorten |
| Writing submission text | 5,000 chars | Hard limit (~800 words); reject above with clear message |
| Questions per practice session | 100 max | Cap at 100; inform student session is full |
| Question text/stem (Reading passages) | 8,000 chars | Accept (Selective passages are longer than OC) |
| Answer options per MCQ question | 10 max | Reject if >10; likely malformed data |
| Session metadata JSON | 10 KB | Reject; return `INVALID_INPUT` error |

### Required Fields Validation

Before starting any Selective practice session, validate:

```
REQUIRED:
  - student_id: non-empty string, valid UUID format
  - active_stage: must be "selective_prep"
  - session context must include at least one of:
    - subject: must be one of ["reading", "math", "thinking", "writing"]
    - OR: free-form question (Socratic mode)

VALIDATION for Writing submissions:
  - text: non-empty string, 1-5,000 chars
  - prompt_type: must be one of ["narrative", "persuasive", "descriptive", "reflective"]
    (if not provided, agent identifies from content — no hard rejection)
  - word_count: calculated server-side, logged for analytics

VALIDATION for MCQ practice:
  - Same as oc-prep skill (question_id, subject, type, options, correct_answer)
  - subject: must include "writing" as a valid option (unlike OC)

ON VALIDATION FAILURE:
  - Return structured error (see format below)
  - Log: { event: "input_validation_failed", student_id, invalid_fields }
  - Do NOT serve malformed questions or process invalid Writing submissions
```

### Rate Limits

| Operation | Limit | Enforcement |
|-----------|-------|-------------|
| Tool calls per turn | 10 max | Agent framework enforces; excess calls queued |
| Timeout per tool call | 30 seconds | Hard timeout; return partial result or error |
| Student messages per session | 200 max | Warn at 180; close session at 200 |
| Writing feedback requests per session | 5 max | Opus calls are expensive; cap usage |
| LTM writes per session | 20 max | Prevents memory flooding |
| Question generation calls per session | 15 max | Prevents runaway model costs |

### Error Response Format

All validation errors return a consistent structure:

```json
{
  "error": "VALIDATION_FAILED",
  "code": "SELECTIVE_PREP_INVALID_INPUT",
  "fields": [
    { "field": "writing.text", "reason": "exceeds 5,000 char limit (received: 6,243)" },
    { "field": "active_stage", "reason": "expected 'selective_prep', got 'oc_prep'" }
  ],
  "message": "Selective prep session rejected: 2 validation errors found.",
  "request_id": "req_abc123",
  "timestamp": "2026-04-06T10:30:00Z"
}
