# Selective Prep Skill Pack

> **Skill ID:** `selective-prep`
> **Version:** 1.0
> **Trigger:** Student is in `selective_prep` stage and engaging in practice, review, or test preparation
> **Agent:** Student Agent (primary), Parent Agent (when discussing Selective preparation)
> **Model:** Sonnet (default), Haiku (error classification), Opus (Writing feedback, deep diagnostic)

---

## Description

This skill pack guides the EduLens Student Agent when helping Year 5-6 students prepare for the NSW Selective High School Placement Test. It covers all four test sections — Reading (17Q/45min), Mathematical Reasoning (35Q/40min), Thinking Skills (40Q/40min), and Writing (1Q/30min) — with age-appropriate Socratic tutoring strategies.

This skill extends everything in the `oc-prep` skill pack with:
- **Writing section** preparation and structured feedback (the major addition)
- Harder question types and longer test format strategies
- More sophisticated meta-cognitive strategies (Year 6 students = 11-12 years old)
- Explicit preparation for the four Writing genres

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- Student's `active_stage == "selective_prep"`
- Conversation involves Selective test preparation, practice, or review
- Parent asks about Selective-specific preparation for a child in `selective_prep` stage
- Test results from a Selective-format test are being discussed
- Writing practice or feedback is requested

---

## Section Strategies

### Reading (17 Questions / 45 Minutes / 25%)

**Differences from OC Reading:**
- 17 questions (vs 14 in OC), with 3 having multiple parts
- 45 minutes (vs 40 in OC) — slightly more time per question
- Passages are more complex — approaching high school level
- Greater emphasis on critical evaluation and synthesis across passages
- 25% weighting (vs 33.3% in OC)

**Advanced reading strategies for Year 6:**
- **Annotation:** Mentally note or mark key arguments, turning points, and author's technique
- **Cross-passage comparison:** For synthesis questions, identify where passages agree, disagree, or complement each other
- **Tone analysis:** Pay attention to the author's attitude — is the writing objective, biased, ironic, sympathetic?
- **Structure as meaning:** How the text is organised IS part of the message (chronological = narrative, problem-solution = persuasive, etc.)

**Socratic approach for advanced reading:**
- "This passage uses irony. Can you find a sentence where the author says one thing but means another?"
- "Compare how Passage A and Passage B discuss the same topic. Do they agree? Where do they diverge?"
- "The author structures this as a problem-solution text. What's the problem? What solution is proposed? Does the author think it will work?"

### Mathematical Reasoning (35 Questions / 40 Minutes / 25%)

**Differences from OC Math:**
- Same number of questions and time (35Q/40min)
- Significantly harder content — more multi-step problems, algebraic reasoning
- Questions may combine multiple mathematical concepts in a single problem
- Greater emphasis on strategic problem selection under time pressure

**Advanced math strategies for Year 6:**
- **Two-pass strategy:** First pass — answer every question you can solve in under 60 seconds. Second pass — tackle the harder problems with remaining time.
- **Algebraic thinking:** Start building the habit of using variables: "Let the number of apples be x..."
- **Ratio and proportion mastery:** These appear heavily at the Selective level
- **Back-solving:** When stuck, substitute each answer option into the problem to check

**Socratic approach for harder math:**
- "This problem has three steps hidden in it. Can you find the first one?"
- "If you called the unknown number 'x', how would you write this problem as an equation?"
- "The question gives you a ratio. What does that ratio actually mean in this situation?"

### Thinking Skills (40 Questions / 40 Minutes / 25%)

**Differences from OC Thinking:**
- 40 questions (vs 30 in OC) — 1 minute per question (same pace)
- 10 more questions means more opportunity but also more fatigue
- Questions are more complex — deeper spatial transformations, more constraints in logic problems
- Section fatigue is a real issue at this length

**Advanced Thinking strategies for Year 6:**
- **Spatial Reasoning — systematic approach:**
  - For 3D nets: Count faces, identify opposite faces, check edge connections
  - For rotations: Track TWO reference points, not just one
  - For complex transformations: Break into steps (rotate, THEN reflect)
  - Draw intermediate states on scratch paper

- **Logical Reasoning — constraint management:**
  - Write down ALL given constraints before starting
  - Use elimination grids for scheduling/ordering problems
  - Check: does your answer satisfy EVERY constraint?

- **Pattern Recognition — rule extraction:**
  - Examine at least 3 consecutive items before proposing a rule
  - Check: does your rule work for ALL given items, not just the last two?
  - Beware of red herrings — not every visible change is part of the rule

**Fatigue management (unique to Selective Thinking):**
- "You're 25 questions in — this is where most students slow down. Take one deep breath before the next question."
- Plan your energy: questions 1-15 (fresh), 16-30 (steady), 31-40 (push through)
- If you feel stuck, skip immediately — don't waste energy on one question when fresh thinking could get you 3 easier ones

### Writing (1 Question / 30 Minutes / 25%)

**This section does not exist in OC and is the major differentiator.**

**Writing is assessed on 6 criteria:**

| Criterion | Weight | What Markers Look For |
|-----------|--------|----------------------|
| **Ideas & Content** | High | Depth, originality, relevance to prompt, development |
| **Structure** | High | Organisation, paragraphing, cohesion, transitions |
| **Language** | Medium-High | Vocabulary range, sentence variety, literary techniques |
| **Conventions** | Medium | Spelling, grammar, punctuation |
| **Audience & Purpose** | Medium | Reader awareness, appropriate voice and register |
| **Engagement** | Medium | Compelling opening, sustained interest, satisfying ending |

**The Four Writing Types:**

#### Narrative Writing
- Tells a story with characters, setting, conflict, resolution
- Structure: orientation → complication → climax → resolution
- Key techniques: show-don't-tell, dialogue, sensory detail, figurative language
- Common weakness: "and then... and then..." flat narration without tension

**Coaching prompts:**
- "Your story needs a PROBLEM. What goes wrong for your character? That's what makes it interesting."
- "Instead of saying 'She was scared,' can you SHOW me she was scared? What does her body do? What does she see and hear?"
- "Your ending resolves the problem, but does it feel satisfying? Does the character learn or change?"

#### Persuasive Writing
- Argues a position with evidence and reasoning
- Structure: thesis → argument 1 → argument 2 → counterargument → rebuttal → conclusion
- Key techniques: rhetorical questions, statistics/evidence, emotive language, expert opinion
- Common weakness: stating opinions without supporting evidence

**Coaching prompts:**
- "You've said [X] is important. But WHY? Give me a reason. Now give me another one."
- "A strong argument also addresses the other side. What would someone who disagrees say? How would you respond?"
- "Your conclusion should do more than repeat your introduction. What's the strongest single sentence you can end with?"

#### Descriptive Writing
- Creates a vivid picture using sensory language
- Structure: establish setting → zoom in on details → create atmosphere → leave an impression
- Key techniques: five senses, figurative language (simile, metaphor, personification), precise word choice
- Common weakness: telling instead of describing ("It was pretty" vs. "Sunlight fractured through the stained glass...")

**Coaching prompts:**
- "You've described what you can SEE. What about the other senses? What would you HEAR? SMELL?"
- "The word 'nice' doesn't paint a picture. Can you find a more specific, interesting word?"
- "Read your first sentence. Does it make me want to keep reading? A great description hooks you immediately."

#### Reflective Writing
- Explores personal thoughts, feelings, and meaning from experiences
- Structure: describe the experience → explore feelings → draw broader insight → conclude with what was learned
- Key techniques: honest introspection, connection to universal themes, showing vulnerability
- Common weakness: recounting events without reflecting on their significance

**Coaching prompts:**
- "You've told me WHAT happened. Now tell me what it MEANT to you. How did it change how you think?"
- "Can you connect your personal experience to something bigger? Does it say something about friendship, growing up, or overcoming fear?"
- "The most powerful reflective writing is honest. You don't have to have a perfect lesson — sometimes the learning is still happening."

**Writing Time Management (30 minutes):**

```
Minutes 1-3:   READ the prompt carefully. Decide the writing type.
               PLAN: 5-6 dot points for your structure.

Minutes 3-5:   Write your OPENING — make it strong. Hook the reader.

Minutes 5-23:  Write the body. Follow your plan. Don't stop to edit.
               Aim for 350-500 words.

Minutes 23-27: Write your ENDING — don't rush it.
               The ending is what markers remember.

Minutes 27-30: RE-READ and edit:
               - Fix spelling mistakes
               - Check paragraph breaks
               - Strengthen one weak sentence
               - Make sure the ending works
```

**The single biggest Writing mistake:** Diving in without a plan, writing freely until time runs out, and submitting a piece with no ending. **ALWAYS plan. ALWAYS leave time for an ending.**

---

## Writing Feedback Framework

When reviewing a student's writing, provide structured feedback across all 6 criteria. Use this format:

```
## Writing Feedback: [Prompt topic]

**Overall impression:** [1-2 sentences on the piece as a whole]

### Strengths ✓
- [Specific strength with a quote from the text]
- [Another specific strength]

### Growth Areas →
1. **[Criterion]:** [Specific, actionable feedback]
   - Current: "[Quote from their writing]"
   - Suggestion: "[How it could be improved]"

2. **[Criterion]:** [Specific, actionable feedback]
   - Current: "[Quote from their writing]"
   - Suggestion: "[How it could be improved]"

### One Thing to Focus On Next Time
[Single, clear, memorable takeaway]
```

**Writing feedback principles:**
- Always find at least 2 genuine strengths before discussing improvements
- Quote directly from the student's writing (shows you actually read it)
- Limit growth areas to 2-3 (not overwhelming — improvement is incremental)
- Provide concrete "before and after" examples
- End with ONE actionable focus point for next time
- Use Opus model for Writing feedback (requires nuanced analysis)

---

## Selective-Specific Test Strategy

### Score Optimisation Across 4 Sections

With 4 sections at 25% each, students should think strategically about where to invest preparation effort:

```
If current scores are:
  Reading: 75%   Math: 80%   Thinking: 55%   Writing: 60%

The highest-ROI investment is:
  1. Thinking Skills (lowest score, most room to gain)
  2. Writing (undertrained area, high improvement potential)
  3. Reading (solid foundation, targeted sub-skill work)
  4. Math (already strong, maintain with light practice)
```

### The Writing Advantage

Many students preparing for Selective neglect Writing because:
- OC test doesn't have it (so Writing practice starts late)
- It's harder to practise alone (needs feedback)
- MCQ prep feels more "productive" (immediate right/wrong feedback)

This creates an opportunity: students who invest in Writing can gain a significant competitive edge because the field is weaker in this area overall.

---

## OC → Selective Transition Guidance

When a student transitions from OC Prep:

1. **Acknowledge what carries over:**
   "Great news — everything you learned for the OC test still applies. Reading, Math, and Thinking Skills are all part of the Selective test too. You have a strong foundation."

2. **Introduce what's new:**
   "The big change is WRITING — it counts for 25% of your Selective score. We'll need to start building that skill. The other sections are also a bit harder and longer."

3. **Adjust expectations:**
   "The Selective test is designed for Year 6 students who have had 2 more years of learning. Your OC-level scores are a starting point — they'll improve as we work through harder material."

4. **Start Writing early:**
   "Let's not wait to start Writing practice. Even one piece per week will build your confidence. We'll try different types — narrative, persuasive, descriptive, reflective."

---

## Common Pitfalls — Selective Specific

| Pitfall | Section | Coaching Response |
|---------|---------|-------------------|
| Ignoring Writing prep | Writing | "Writing is 25% of your score — the same as Math. Would you skip Math practice? Let's treat Writing the same way." |
| OC-level time expectations | All | "The Selective test is longer — 155 minutes total. We need to build your stamina. Let's practise sitting through a full mock test." |
| Same difficulty level as OC | All | "These questions are harder than what you saw in OC. That's expected — you've grown as a learner. Let's tackle the challenge." |
| Writing without planning | Writing | "I noticed you started writing immediately. Next time, spend 3 minutes making a plan. It saves time overall and makes your writing much stronger." |
| Incomplete Writing piece | Writing | "Running out of time is the #1 Writing mistake. Always plan your ending BEFORE you start writing. A complete short piece beats an incomplete long one." |

---

## Integration Points

- **Error classification:** Use `diagnostic` skill pack for per-question analysis
- **Study planning:** Use `study-planner` skill pack — must include Writing time allocation
- **Parent communication:** Use `parent-advisor` skill pack when discussing Selective strategy with parents
- **Writing feedback:** Route to Opus model for detailed Writing assessment
- **OC foundation:** Reference `oc-prep` skill pack for base strategies that carry over
