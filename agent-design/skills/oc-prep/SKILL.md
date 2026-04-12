---
name: oc-prep
description: Helps students prepare for the NSW OC Placement Test through guided practice in Reading, Math, and Thinking Skills
version: 1.0
trigger:
  - Student is in oc_prep stage
  - Student requests practice questions
  - Student agent detects OC test preparation context
metadata:
  stage: oc_prep
  target_age: 9-10 (Year 4)
  sections: [reading, math, thinking]
  test_format: 3 sections, all MCQ, ~110 minutes
depends_on:
  - SOUL.md (teaching philosophy, Socratic method)
  - KNOWLEDGE.md §B (OC test format), §F (skill taxonomy), §G (error patterns)
  - MEMORY-DESIGN.md §6 (Learning DNA for personalisation)
---

# OC Test Preparation Skill

## Overview

This skill guides students through preparation for the NSW Opportunity Class Placement Test. The OC test has three sections — Reading (14Q/40min), Mathematical Reasoning (35Q/40min), and Thinking Skills (30Q/30min) — all multiple-choice. The agent uses Socratic dialogue, adapts to the student's Learning DNA, and targets the Zone of Proximal Development.

**There is NO Writing section in the OC test.** If a student or parent asks about Writing for OC, clarify this distinction and note that Writing becomes relevant for the Selective test.

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- Student's `active_stage == "oc_prep"`
- Conversation involves OC test preparation, practice, or review
- Parent asks about OC-specific preparation for a child in `oc_prep` stage
- Test results from an OC-format test are being discussed

---

## Section 1: Reading Comprehension (14Q / 40 min / 33.3%)

### Time Budget

- 14 questions, but 3 have multiple parts → ~33 total response items
- Effectively ~1.2 minutes per response item (~2.9 min per question)
- Strategy: spend more time on multi-part questions, less on single-response
- Target pacing: single-response = 1.5-2 min, multi-part = 4-5 min
- First read of passage: 2-3 minutes (don't rush — comprehension saves time later)

### Passage Types

Students encounter fiction, non-fiction, poetry, magazine articles, and reports. Passages are significantly harder than standard Year 4 curriculum. Prepare for:
- Dense paragraphs requiring re-reading
- Unfamiliar vocabulary in context
- Multiple texts that must be compared

### Sub-Skill Strategies

**1. Literal Comprehension**
- Teach: "The answer is IN the text. You can point to it."
- Strategy: Underline key phrases while reading the passage
- Socratic prompt: "Can you find the exact sentence that answers this question?"
- Common pitfall: Students paraphrase incorrectly — train exact matching

**2. Inference**
- Teach: "The author is giving you clues, but not telling you directly. You're a detective."
- Strategy: Ask "What clue in the text makes you think that?"
- Socratic prompt: "The text says [X]. What does that tell us about [Y]?"
- Common pitfall: Students confuse what the text says with what they think — anchor every inference in specific text evidence

**3. Vocabulary in Context**
- Teach: "Read the sentence with a blank instead of the word. What word would fit?"
- Strategy: Substitute each answer option into the sentence and test for meaning
- Socratic prompt: "Forget the word for a moment — what does the sentence MEAN? Which option fits?"
- Common pitfall: Students choose a known definition that doesn't fit the context

**4. Author's Purpose**
- Teach: "Why did the author write this? To inform, persuade, entertain, or explain?"
- Strategy: Look at the overall text type first, then examine specific word choices
- Socratic prompt: "Why did the author use that word instead of a simpler one?"
- Common pitfall: Students identify WHAT the text says but not WHY

**5. Text Structure**
- Teach: "How is this text organised? What comes first, middle, last — and why?"
- Strategy: Identify paragraph roles (introduction, evidence, conclusion)
- Socratic prompt: "What does the first paragraph do? What changes in the second?"
- Common pitfall: Students focus on content, not organisation

**6. Critical Evaluation**
- Teach: "Is the author's argument strong? What evidence do they give?"
- Strategy: Look for opinions presented as facts, missing evidence, one-sided arguments
- Socratic prompt: "What would someone who disagrees with the author say?"
- Common pitfall: Students accept everything in the text as true

**7. Synthesis Across Passages**
- Teach: "How are these two texts similar? How are they different?"
- Strategy: Make a quick mental comparison before answering
- Socratic prompt: "What does Passage A say? Now what does Passage B say? Do they agree?"
- Common pitfall: Students only reference one passage in their answer

### Reading Error Review Approach

```
When a student gets a reading question wrong:

1. Ask: "Can you show me where in the text you found your answer?"

2. If they point to the wrong section:
   → "Good try. Let's look at paragraph [X] together —
      what does it say about [topic]?"

3. If they point to the right section but misinterpret:
   → "You found the right spot! Now, the question asks for [exact wording].
      Does your answer match what the question is really asking?"

4. If it's an inference question and they took it too literally:
   → "You're reading the exact words, which is great for some questions.
      But this one asks you to read between the lines.
      What clue does the author give us without saying it directly?"

5. If after 2 attempts they're still stuck:
   → Shift to direct instruction. Explain clearly and move on. No shame.
      "Here's how this works — next time you see one like this,
       you'll recognise the pattern."
```

---

## Section 2: Mathematical Reasoning (35Q / 40 min / 33.3%)

### Time Budget

- 35 questions in 40 minutes → approximately **1.14 minutes per question**
- This is a fast pace — students must decide quickly and move on
- The 30-second rule: if stuck for 30 seconds, mark it and move on
- No calculator permitted; working paper provided
- Reserve 3 minutes at the end for checking flagged questions

### Pacing Guide

```
Questions 1-15:  Straightforward → ~45 seconds each
Questions 16-25: Medium difficulty → ~1 minute each
Questions 26-35: Hardest → ~1.5 minutes each, skip freely
```

### Sub-Skill Strategies

**1. Number & Algebra**
- Focus: Fractions, decimals, percentages, order of operations, basic algebraic thinking
- Strategy: Estimate before calculating — eliminates obviously wrong options
- Key technique: BODMAS/BIDMAS for order of operations
- Common pitfall: Forgetting order of operations; fraction arithmetic errors

**2. Measurement & Geometry**
- Focus: Area, perimeter, volume, angles, 2D and 3D shapes
- Strategy: Draw a diagram when possible; label known values
- Key technique: "What formula do I need?" before calculating
- Common pitfall: Confusing area (square units) and perimeter (linear units)

**3. Statistics & Probability**
- Focus: Reading graphs, calculating averages, understanding probability as a fraction
- Strategy: Read axis labels carefully; check the scale
- Key technique: "What does each square/interval represent?"
- Common pitfall: Misreading graph scales (e.g., each square = 5, not 1)

**4. Patterns & Relationships**
- Focus: Number patterns, function machines, growing patterns
- Strategy: Find the rule by checking differences between consecutive terms
- Socratic prompt: "What happens each time you go to the next number?"
- Common pitfall: Identifying a pattern from just 2 terms (need 3+ to confirm)

**5. Problem-Solving Strategies**
- Teach the STAR method: **S**top → **T**hink → **A**ct → **R**eview
- Strategy: Read the ENTIRE question before starting any calculation
- Key techniques: work backwards, draw a picture, make a table, guess-and-check
- Common pitfall: Solving what they think the question asks instead of what it actually asks

**6. Multi-Step Reasoning**
- Focus: Problems requiring 2-3 operations in sequence
- Strategy: Break into steps — "What do I need to find first?"
- Socratic prompt: "You need the total cost. What information do you need to calculate that?"
- Common pitfall: Stopping after the first step

**7. Word Problem Comprehension**
- Focus: Translating English sentences into mathematical operations
- Strategy: Underline numbers and circle operation keywords ("each", "total", "remaining", "shared equally")
- Key insight: This is often a Reading problem showing up in Math — students who misread the question do the math correctly but answer the wrong question
- Common pitfall: Misinterpreting "how many MORE" as "how many in total"

### Math Error Review Approach

```
When a student gets a math question wrong:

1. Determine error type:

   a. Concept gap?
      → "Let's start with a simpler version. What is 1/4 of 20?"
      → Build up gradually to the original question

   b. Careless error?
      → "Your method is right! But look at step 2 —
         can you spot where something went wrong?"
      → Teach the check-by-substitution habit:
         "Put your answer back into the original problem. Does it work?"

   c. Misread question?
      → "Read the last sentence again. What is it ACTUALLY asking you to find?"

   d. Time pressure?
      → "Let's look at this without the clock. Can you solve it now?"
      → Discuss skip-and-return strategy

   e. Elimination failure?
      → "You were between B and D. Can you PROVE B is wrong?
         Plug it back in — does it work?"
```

---

## Section 3: Thinking Skills (30Q / 30 min / 33.3%)

### Time Budget

- 30 questions in 30 minutes → exactly **1 minute per question**
- Fastest-paced section — no time for extended deliberation
- Strategy: trust first instinct more often; use elimination aggressively
- Skip anything that takes more than 90 seconds
- Answer every question (4 options = 25% chance by guessing, no penalty)

### Sub-Skill Strategies (All 6)

**1. Critical Thinking**
- Focus: Identifying flaws in arguments, evaluating conclusions
- Strategy: Ask "Does the conclusion HAVE to follow from the evidence?"
- Socratic prompt: "If this statement is true, does that mean [conclusion] MUST be true?"
- Common pitfall: Accepting plausible-sounding but logically flawed conclusions

**2. Problem Solving**
- Focus: Multi-step logic puzzles, scheduling, resource allocation
- Strategy: Organise information visually (lists, tables, simple diagrams)
- Socratic prompt: "What's the FIRST thing you need to figure out?"
- Common pitfall: Trying to hold everything in memory instead of writing it down

**3. Spatial Reasoning (COMMONLY WEAKEST)**
- Focus: 2D/3D transformations — rotations, reflections, folding, nets
- Strategy: **Visual anchoring** — pick one fixed point on the shape and track how it moves through each transformation step
- Specific techniques:
  - For rotations: use the clock direction (clockwise = same way clock hands move)
  - For reflections: imagine a mirror line and check each point's distance from it
  - For nets/folding: identify which faces are opposite (they can never be adjacent when folded)
  - Draw intermediate steps on scratch paper
- Socratic prompt: "If I rotate this shape 90° clockwise, where does the top-right corner end up?"
- Common pitfall: Confusing rotation with reflection; losing track of orientation
- **For students below 50% mastery:** Start with single transformations before combining. Use physical objects (paper folding, blocks) before abstract exercises.

**4. Pattern Recognition**
- Focus: Visual sequences, number patterns, matrix completion, rule identification
- Strategy: Look for what changes AND what stays the same between consecutive items
- Socratic prompt: "What's different between picture 1 and picture 2? What's the same?"
- Key technique: Examine at least 3 items before proposing a rule; verify it works for ALL items
- Common pitfall: Identifying a rule that works for the last 2 items but not earlier ones

**5. Logical Reasoning**
- Focus: Syllogisms, ordering, classification, constraint satisfaction, truth tables
- Strategy: Convert word problems to diagrams ("A is taller than B, B is taller than C" → draw a height line)
- Socratic prompt: "Let's write down what we know for sure, and what we're NOT told."
- Key technique: Build answers from confirmed facts only — don't assume unstated information
- Common pitfall: Assuming information that isn't given

**6. Data Extraction**
- Focus: Reading charts, tables, and graphs to answer questions under time pressure
- Strategy: Read the question FIRST, then look at the data — not the other way around
- Socratic prompt: "What does the chart actually show? What are the labels?"
- Key technique: Read axis labels and legends before interpreting values
- Common pitfall: Being distracted by irrelevant data in complex tables

---

## General Test Strategies (All Sections)

### The STAR Method

Teach this as the default approach for every question:

1. **S**top — Read the entire question. Don't start answering immediately.
2. **T**hink — What type of question is this? What strategy fits?
3. **A**ct — Answer the question using the chosen strategy.
4. **R**eview — Check your answer. Does it make sense? Re-read the question.

### Elimination Strategy

```
Step 1: Read all options
Step 2: Cross out any that are DEFINITELY wrong
Step 3: Compare remaining options against the question
Step 4: Choose the BEST remaining answer

"You don't always need to know the right answer. Sometimes, knowing
 which answers are wrong is enough."
```

### Time Check Habit

- Glance at the clock after every 5 questions
- Reading: after Q5 (~14 min used), after Q10 (~29 min used)
- Math: after Q5 (~6 min), after Q15 (~17 min), after Q25 (~29 min)
- Thinking: after Q10 (~10 min), after Q20 (~20 min)

### Confidence Marking (Practice Only)

During practice sessions, have students rate each answer:
- **Sure** — "I know this is right"
- **Maybe** — "I think so but I'm not certain"
- **Guess** — "I don't really know"

Then review the "Maybe" answers first — this is where the most learning happens.

---

## Practice Session Structure

### Recommended Session Format (20-30 minutes)

```
1. Warm-up (3 min)
   - 2-3 quick recall questions to activate prior knowledge
   - "Remember last time we worked on [skill]? Let's start there."

2. Targeted Practice (15-20 min)
   - 5-10 questions focused on ONE sub-skill at the student's ZPD level
   - Socratic review after each incorrect answer
   - Celebrate correct answers on challenging questions

3. Mixed Review (5-7 min)
   - 3-5 questions mixing today's focus with previously learned skills
   - Reinforces spaced repetition

4. Session Wrap-up (2 min)
   - "Today you worked on [skill]. You got [X/Y] right."
   - Highlight one specific improvement
   - Preview next session: "Next time, we might try [related skill]."
```

### Difficulty Scaling (Zone of Proximal Development)

| Student Mastery | Question Difficulty | Rationale |
|---|---|---|
| Below 40% | Level 1-2 (Recall/Skill) | Build foundations; avoid frustration |
| 40-65% | Level 2-3 (Skill/Strategic) | Challenge without overwhelming |
| 65-85% | Level 3-4 (Strategic/Extended) | Push toward mastery |
| Above 85% | Occasional Level 3-4; shift focus to weaker areas | Maintain; don't over-practise |

---

## Common Pitfalls & Misconceptions

### Reading
| Pitfall | Coaching Response |
|---|---|
| Choosing "almost right" answer (distractor) | "Two answers seem right, but one is MORE right. Which is fully supported by the text?" |
| Over-interpreting the text | "That's a great thought, but does the text actually SAY that?" |
| Rushing the passage | "Read the passage one more time looking for [specific detail]." |
| Picking the first plausible option | "Did you read ALL the options before choosing?" |

### Math
| Pitfall | Coaching Response |
|---|---|
| Not reading the full question | "Read the WHOLE question before you start calculating." |
| Arithmetic slips (7×8=54) | "The method is right! Double-check: what's 7 times 8?" |
| Answering a sub-step instead of the question | "You found X. But what does the question actually want?" |
| Forgetting to convert units | "Check the units — are you working in cm or m?" |

### Thinking
| Pitfall | Coaching Response |
|---|---|
| 3+ minutes on one Spatial question | "If you can't see it in 30 seconds, mark and come back." |
| Not using scratch paper | "Draw it out! Your brain has limited space — put it on paper." |
| Guessing patterns without verifying | "Before you choose, tell me the RULE. Does it work for ALL items?" |
| Assuming unstated information | "That might be true, but does the question actually tell us that?" |

---

## Adapting to the Student

Before each session, check the Learning DNA and adapt:

```
IF spatial_reasoning.mastery < 0.40 AND trend = "declining":
  → Prioritise Spatial Reasoning with Level 1-2 questions
  → Use physical analogies: "Imagine folding a piece of paper..."
  → Spend 60% of session on this skill

IF careless_error rate > 0.30 in math:
  → Introduce checking strategies
  → After each answer: "Can you check that by putting your answer back in?"
  → Track whether checking reduces error rate across sessions

IF time_pressure errors > 0.25 in thinking:
  → Practice pacing drills (30-second decision exercises)
  → Teach the skip-and-return strategy
  → Build familiarity with question types to improve speed

IF student.sessions_analysed < 3:
  → More exploratory, less targeted
  → "Let's try different types of questions today to see what you find easy and hard."
```

---

## Integration Points

- **Error classification:** Use `diagnostic` skill for per-question analysis
- **Study planning:** Use `study-planner` skill for generating weekly focus areas
- **Parent communication:** Use `parent-advisor` skill when relaying OC insights to parents
- **Stage transition:** When student moves to Selective, load `selective-prep` skill instead

---

## Input Validation & Safety

### Max Input Sizes

| Input | Limit | Rejection Behaviour |
|-------|-------|---------------------|
| Student message length | 2,000 chars | Truncate to 2,000; warn student to shorten |
| Questions per practice session | 100 max | Cap at 100; inform student session is full |
| Question text/stem | 5,000 chars | Accept (long passages are normal for Reading) |
| Answer options per question | 10 max | Reject if >10; likely malformed data |
| Session metadata JSON | 10 KB | Reject; return `INVALID_INPUT` error |

### Required Fields Validation

Before starting any OC practice session, validate:

```
REQUIRED:
  - student_id: non-empty string, valid UUID format
  - active_stage: must be "oc_prep"
  - session context must include at least one of:
    - subject: must be one of ["reading", "math", "thinking"]
    - OR: free-form question (Socratic mode)

VALIDATION for practice questions served to student:
  - question_id: non-empty string
  - subject: must be one of ["reading", "math", "thinking"]
  - type: must be "mcq" (OC is all multiple-choice)
  - options: array of 4-5 items, each non-empty string
  - correct_answer: must match one of the options

ON VALIDATION FAILURE:
  - Return structured error (see format below)
  - Log: { event: "input_validation_failed", student_id, invalid_fields }
  - Do NOT serve malformed questions to students
```

### Rate Limits

| Operation | Limit | Enforcement |
|-----------|-------|-------------|
| Tool calls per turn | 10 max | Agent framework enforces; excess calls queued |
| Timeout per tool call | 30 seconds | Hard timeout; return partial result or error |
| Student messages per session | 200 max | Warn at 180; close session at 200 |
| LTM writes per session | 20 max | Prevents memory flooding |
| Question generation calls per session | 15 max | Prevents runaway model costs |

### Error Response Format

All validation errors return a consistent structure:

```json
{
  "error": "VALIDATION_FAILED",
  "code": "OC_PREP_INVALID_INPUT",
  "fields": [
    { "field": "active_stage", "reason": "expected 'oc_prep', got 'selective_prep'" }
  ],
  "message": "OC prep session rejected: 1 validation error found.",
  "request_id": "req_abc123",
  "timestamp": "2026-04-06T10:30:00Z"
}
