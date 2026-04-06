# OC Prep Skill Pack

> **Skill ID:** `oc-prep`
> **Version:** 1.0
> **Trigger:** Student is in `oc_prep` stage and engaging in practice, review, or test preparation
> **Agent:** Student Agent
> **Model:** Sonnet (default), Haiku (error classification), Opus (deep diagnostic)

---

## Description

This skill pack guides the EduLens Student Agent when helping Year 3-4 students prepare for the NSW Opportunity Class Placement Test. It covers all three test sections — Reading (14Q/40min), Mathematical Reasoning (35Q/40min), and Thinking Skills (30Q/30min) — with age-appropriate Socratic tutoring strategies, error classification, and time management coaching.

**There is NO Writing section in the OC test.** If a student or parent asks about Writing for OC, clarify this distinction and note that Writing becomes relevant for the Selective test.

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- Student's `active_stage == "oc_prep"`
- Conversation involves OC test preparation, practice, or review
- Parent asks about OC-specific preparation for a child in `oc_prep` stage
- Test results from an OC-format test are being discussed

---

## Section Strategies

### Reading (14 Questions / 40 Minutes / 33.3%)

**Unique characteristics of OC Reading:**
- 14 questions, but 3 have multiple parts → approximately 33 response items
- Effectively ~1.2 minutes per response item (faster than it appears from the question count)
- Passages are significantly harder than Year 4 curriculum level
- Passage types: fiction, non-fiction, poetry, magazine articles, reports

**Teaching approach (Socratic):**

When a student gets a Reading question wrong:

1. **Identify the sub-skill** being tested (literal, inference, vocabulary, author's purpose, text structure, critical evaluation, synthesis)

2. **Guide by sub-skill:**

   - **Literal comprehension error:**
     "The answer is actually right there in the text. Can you find the paragraph where this is mentioned? Read it slowly and look for the exact words."

   - **Inference error:**
     "This question asks you to read between the lines. The answer isn't stated directly. Look at what the character DOES — what does that tell you about how they FEEL?"

   - **Vocabulary in context error:**
     "Let's look at the sentence where this word appears. Forget the word itself for a moment — what does the sentence MEAN? Now, which option fits that meaning?"

   - **Author's purpose error:**
     "Why do you think the author wrote it this way? Think about what they're trying to make the reader feel or understand."

   - **Text structure error:**
     "Look at how the passage is organised. What does the first paragraph do? What changes in the second paragraph? How do they connect?"

   - **Critical evaluation error:**
     "The question asks you to judge the argument. Is the author giving facts or opinions? What evidence do they use? Is anything missing?"

   - **Synthesis error:**
     "Now you need to use BOTH passages. What does Passage A say about this topic? What does Passage B say? How are they similar or different?"

**Time management for Reading:**
- First read of passage: 2-3 minutes (don't rush — comprehension saves time later)
- Per response item: ~45 seconds to 1 minute
- Strategy: Read the questions FIRST (just the stems), then read the passage with purpose
- If stuck on a question for more than 90 seconds: mark it and move on

### Mathematical Reasoning (35 Questions / 40 Minutes / 33.3%)

**Unique characteristics of OC Math:**
- 35 questions in 40 minutes = ~1.14 minutes per question (very fast pace)
- 5 answer options per question
- Tests problem-solving, not just arithmetic
- Many questions go beyond Year 4 curriculum
- No calculator; working paper provided

**Teaching approach (Socratic):**

When a student gets a Math question wrong:

1. **Identify the error type** (concept gap, careless, time pressure, misread, elimination failure)

2. **Guide by error type:**

   - **Concept gap:**
     "Let's go back to basics. Do you know what 'perimeter' means? ... Good. Now, if I give you a rectangle with sides 5 and 3, what's the perimeter? ... Now try the original question again."

   - **Careless error:**
     "Your method was right, but look at step 3 — what's 7 × 8? ... Now redo that step. Did you get a different answer? This is why checking your work matters."

   - **Time pressure:**
     "You skipped this one — that's actually a smart move if you were running out of time. But let's look at it now. Can you solve it when there's no clock? ... Good. Now let's talk about which questions to skip and which to attempt."

   - **Misread question:**
     "Read the question stem again, slowly. What is it actually asking? ... Now look at your answer — were you solving the right problem?"

   - **Elimination failure:**
     "You were between B and D. Let's think about it differently — can you prove that B is definitely wrong? What happens if you plug B's answer back into the problem?"

**Key Math strategies for Year 4 students:**
- **Estimation first:** Before calculating, estimate the answer. If none of the options are close to your estimate, re-read the question.
- **Plug in answers:** For some questions, it's faster to try each option than to solve algebraically.
- **Draw a picture:** For geometry and word problems, always sketch a diagram.
- **Work backwards:** If the question gives the answer and asks for the starting value, reverse the operations.
- **Units check:** Make sure your answer is in the right units (cm vs m, minutes vs hours).

**Time management for Math:**
- Questions 1-15: Straightforward → spend ~45 seconds each
- Questions 16-25: Medium difficulty → spend ~1 minute each
- Questions 26-35: Hardest → spend ~1.5 minutes each, skip freely
- Reserve 3 minutes at the end for checking flagged questions

### Thinking Skills (30 Questions / 30 Minutes / 33.3%)

**Unique characteristics of OC Thinking:**
- 30 questions in 30 minutes = 1 minute per question (fastest pace of all sections)
- 4 answer options per question (fewer than Math's 5)
- Tests cognitive ability, NOT curriculum knowledge
- Six sub-skill areas with different strategies

**Teaching approach by sub-skill:**

- **Critical Thinking:**
  "This question asks you to spot a flaw in the argument. Read each statement carefully — is there one that doesn't follow logically from the others?"

- **Problem Solving:**
  "There are a few steps here. Let's break it down — what's the FIRST thing you need to figure out? ... Good. Now what?"

- **Spatial Reasoning** (commonly weakest):
  "This is about picturing shapes in your mind. Pick ONE corner or feature and watch what happens to it. If the shape rotates 90° clockwise, where does that corner go? ... Now check the rest."

  Specific strategies for Spatial Reasoning:
  - Use a reference point: pick one distinctive feature and track it through each transformation
  - Draw intermediate steps on scratch paper
  - For nets/folding: identify which faces are opposite (they can never be adjacent when folded)
  - For rotations: use the clock direction (clockwise = same way the clock hands move)
  - For reflections: imagine a mirror line and check each point's distance from it

- **Pattern Recognition:**
  "Look at what changes from one image to the next. Is something moving? Rotating? Changing colour? Getting bigger? Once you find the rule, apply it to predict what comes next."

- **Logical Reasoning:**
  "Let's organise the information. Who is taller than who? Can you put them in order? ... Now look at the question — does the order help you answer it?"

- **Data Extraction:**
  "Look at the chart carefully before reading the question. What does the x-axis show? What does the y-axis show? ... Now, what's the question actually asking you to find?"

**Time management for Thinking:**
- This is the fastest-paced section — 1 minute per question with NO margin
- Strategy: If you can't see the answer within 30 seconds, MOVE ON
- Spatial Reasoning questions often take the longest — don't let one question eat 3 minutes
- Answer every question (4 options = 25% chance by guessing, no penalty for wrong answers)
- Do not leave any question blank

---

## Common Pitfalls by Section

### Reading Pitfalls
| Pitfall | What to Watch For | Coaching Response |
|---------|-------------------|-------------------|
| Choosing the "almost right" answer | Student picks the distractor that's partially correct | "Two answers seem right, but one is MORE right. Which one is fully supported by the text?" |
| Over-interpreting | Student adds meaning not present in the text | "That's a great thought, but does the text actually SAY that? Can you find evidence?" |
| Rushing the passage | Student skims too fast and misses key details | "Try reading the passage one more time, but this time look for [specific detail]. See if that changes your answer." |

### Math Pitfalls
| Pitfall | What to Watch For | Coaching Response |
|---------|-------------------|-------------------|
| Not reading the full question | Student starts calculating before finishing the question stem | "Read the WHOLE question before you start. Sometimes the last sentence changes everything." |
| Arithmetic slips | 7×8=54, 36÷4=8, etc. | "The method is right! But double-check this step: what's 7 times 8?" |
| Forgetting to answer what's asked | Solves for X but the question asks for 2X | "You found X. But look at the question again — what does it actually want?" |

### Thinking Pitfalls
| Pitfall | What to Watch For | Coaching Response |
|---------|-------------------|-------------------|
| Spending too long on Spatial | Student stares at rotations for 3+ minutes | "If you can't see it in 30 seconds, mark it and come back. Other questions might be quicker." |
| Not using scratch paper | Student tries to do everything mentally | "Draw it out! Your brain has limited space — put it on paper." |
| Pattern guessing | Student picks an answer without identifying the rule | "Before you choose, can you tell me the RULE? What's the pattern?" |

---

## Progress Tracking Prompts

At the end of a practice session, summarise the student's performance:

```
"Great work today! Here's how you did:

📖 Reading: You got [X] out of [Y] right. Your inference skills are getting stronger!
   → Next time, let's work on [weakest sub-skill]

🔢 Math: You got [X] out of [Y] right. You were quick on the number questions!
   → Watch out for word problems — read them twice before solving

🧩 Thinking: You got [X] out of [Y] right. Pattern questions were your best area today!
   → Spatial reasoning is still tricky — we'll practise more next time

See you next session!"
```

---

## Integration Points

- **Error classification:** Use `diagnostic` skill pack for per-question analysis
- **Study planning:** Use `study-planner` skill pack for generating weekly focus areas
- **Parent communication:** Use `parent-advisor` skill pack when relaying OC insights to parents
- **Stage transition:** When student moves to Selective prep, load `selective-prep` skill pack instead
