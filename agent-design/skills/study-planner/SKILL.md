# Study Planner Skill Pack

> **Skill ID:** `study-planner`
> **Version:** 1.0
> **Trigger:** Study plan generation, schedule adjustment, or practice prioritisation is requested
> **Agent:** Parent Agent (primary), Student Agent (simplified view)
> **Model:** Sonnet (plan generation), Haiku (schedule formatting)

---

## Description

This skill pack generates personalised study plans based on the student's Learning DNA profile, target test date, and available study time. It produces weekly and daily schedules that target weak areas using the Zone of Proximal Development principle, adapt intensity based on proximity to the test date, and include built-in review cycles.

Study plans are NOT static documents — they evolve as the student's Learning DNA updates. After each diagnostic test, the plan should be reassessed and adjusted.

---

## Trigger Conditions

Load this skill when ANY of the following are true:
- A parent or student asks for a study plan, schedule, or practice recommendation
- A parent asks "What should we focus on this week?"
- After a diagnostic analysis, the agent recommends a focus area
- The phrase "plan," "schedule," "what to practise," or "how to prepare" appears
- A parent mentions available study time or days-until-test

---

## Input Requirements

To generate a study plan, the agent needs:

| Input | Source | Required? |
|-------|--------|-----------|
| Learning DNA profile | AgentCore LTM | Yes |
| Active stage | Student profile | Yes |
| Target test date | System config or parent input | Yes |
| Available study time per day | Parent input | Yes (ask if not known) |
| Available study days per week | Parent input | Recommended (default: 5) |
| Current study routine (if any) | Parent input or memory | Optional |
| Specific parent preferences | Family insights LTM | Optional |

**If inputs are missing, ask:**
- "How many minutes per day can [child name] dedicate to practice?"
- "How many days per week are available for structured practice?"
- "Is there a specific area you'd like me to prioritise, or should I base it on the diagnostic data?"

---

## Plan Generation Algorithm

### Step 1: Determine Preparation Phase

```
months_until_test = (test_date - today).months

IF months_until_test > 6:
  phase = "foundation"
  intensity = "low"
  mock_test_frequency = "monthly"

ELIF months_until_test > 3:
  phase = "intensification"
  intensity = "medium"
  mock_test_frequency = "biweekly"

ELIF months_until_test > 1:
  phase = "sharpening"
  intensity = "high"
  mock_test_frequency = "weekly"

ELIF months_until_test > 0.5:
  phase = "taper"
  intensity = "light"
  mock_test_frequency = "one_final"

ELSE:
  phase = "test_week"
  intensity = "rest"
  mock_test_frequency = "none"
```

### Step 2: Prioritise Skill Areas

Using the Learning DNA, rank skills by priority:

```
priority_score = (1 - mastery) × weight_by_trend × weight_by_improvement_potential

where:
  weight_by_trend:
    declining  = 1.5  (urgent — getting worse)
    stable     = 1.0  (expected baseline)
    improving  = 0.7  (already moving in right direction)

  weight_by_improvement_potential:
    mastery < 0.4  = 1.2  (significant room to grow)
    mastery 0.4-0.7 = 1.0  (sweet spot for improvement)
    mastery > 0.7  = 0.6  (diminishing returns)
    mastery > 0.85 = 0.3  (maintenance only)
```

Sort by `priority_score` descending. Top 2-3 become the primary focus areas.

### Step 3: Allocate Time

```
Total weekly time = daily_minutes × days_per_week

Allocation:
  Primary focus areas (top 2-3):  60% of time
  Secondary skills:               25% of time
  Maintenance (strong areas):     10% of time
  Review/mock tests:               5% of time
```

Adjust by phase:
- **Foundation:** More even distribution across all areas (50/30/15/5)
- **Intensification:** Concentrated on weak areas (65/20/10/5)
- **Sharpening:** Heavy focus on weak + timed practice (55/20/10/15)
- **Taper:** Light review only (20/20/30/30)

### Step 4: Build Weekly Schedule

Distribute across available days, considering:
- **No subject on consecutive days** (interleaving promotes retention)
- **Harder subjects when fresh** (earlier in the week or at the start of a session)
- **Review day** at the end of the week (revisit what was practised)
- **Mock test day** on weekends if possible (simulate real conditions)

### Step 5: Add Review Cycles

Apply spaced repetition:
- Concepts practised today → revisit in 2-3 days
- Concepts revisited → revisit again in 1 week
- If still solid after 2 reviews → move to maintenance

---

## Output Format

### Weekly Plan (Parent-Facing)

```
## Weekly Study Plan: [Student Name]
### Week of [Date] | Phase: [Foundation/Intensification/Sharpening/Taper]
### Available: [X] minutes/day, [Y] days/week

---

**Priority Focus Areas This Week:**
1. 🎯 Thinking — Spatial Reasoning (mastery: 38% ↓)
2. 🎯 Reading — Author's Purpose (mastery: 50% ↓)
3. 📈 Math — Multi-Step Reasoning (mastery: 48% →)

**Maintenance:** Reading Literal Comprehension, Math Number & Algebra

---

| Day | Subject | Focus | Activity | Duration |
|-----|---------|-------|----------|----------|
| Mon | Thinking | Spatial Reasoning | 2D rotation exercises — identify transformed shapes | 25 min |
| Tue | Reading | Author's Purpose | Read 2 passages, identify purpose for each paragraph | 25 min |
| Wed | Math | Multi-Step Reasoning | 10 word problems requiring 2+ steps | 25 min |
| Thu | Thinking | Spatial Reasoning | 3D nets and folding — which face is opposite? | 25 min |
| Fri | Reading | Review | Re-do 5 questions from Tuesday that were incorrect | 20 min |
| Sat | Mock | Full mock test | Timed, simulating real conditions | 110 min |
| Sun | Review | Error analysis | Review mock test results, classify errors | 20 min |

---

**This Week's Goal:** Improve spatial reasoning accuracy from 38% to 45%+
**Check-in:** After Saturday's mock test, we'll assess if the focus areas need adjusting.
```

### Daily Plan (Student-Facing, Simplified)

```
## Today's Practice: Monday

🧩 **Thinking Skills — Spatial Reasoning** (25 minutes)

What to do:
1. Start with 5 easy rotation questions (warm-up)
2. Then try 5 harder ones with reflections
3. For each one: pick ONE corner, track where it goes
4. If you get stuck for 30 seconds, draw it on paper!

Goal: Get 7 out of 10 right ✨

When you're done, tell me how it went!
```

---

## Plan Adaptation Rules

### After Each Diagnostic Test

```
1. Compare new Learning DNA against the plan's assumptions
2. IF a priority area has improved significantly (mastery +10%):
   → Reduce its time allocation
   → Promote next priority area
3. IF a priority area has NOT improved after 2 weeks:
   → Check: is the practice type appropriate for the error pattern?
   → Adjust: maybe the student needs concept teaching, not more practice
4. IF a new weakness has emerged:
   → Add to priority list
   → Rebalance time allocation
```

### Phase Transitions

When the preparation phase changes (e.g., intensification → sharpening):

"We're entering the sharpening phase — the test is [X] weeks away. I'm adjusting the plan:
- Weekly timed mock tests start now (every Saturday)
- Practice sessions shift from learning new strategies to applying them under time pressure
- Careless error reduction becomes a priority (currently 30% of errors)
- No new concepts — we consolidate what you've learned"

---

## Stage-Specific Adjustments

### OC Prep Plans

- 3 sections only: Reading, Math, Thinking
- Equal time distribution (33.3% each) adjusted by priority
- No Writing component
- Emphasise Thinking Skills (often the weakest section)
- Total daily practice: 20-30 minutes recommended

### Selective Prep Plans

- 4 sections: Reading, Math, Thinking, Writing
- Writing MUST be included at least once per week
- For students transitioning from OC: Writing gets priority time initially
- Writing practice format: one full piece per week + editing practice
- Total daily practice: 25-40 minutes recommended (older students can sustain longer)

**Writing integration example:**

```
| Day | Subject | Focus | Duration |
|-----|---------|-------|----------|
| Mon | Thinking | Spatial Reasoning | 30 min |
| Tue | Reading | Inference + Synthesis | 30 min |
| Wed | Writing | Narrative writing — plan + draft | 35 min |
| Thu | Math | Multi-step + Word problems | 30 min |
| Fri | Review | Revisit Wed's writing — edit + improve | 25 min |
| Sat | Mock | Full Selective mock test (timed) | 155 min |
| Sun | Review | Error analysis + Writing feedback review | 25 min |
```

---

## Special Scenarios

### "We only have 15 minutes a day"

Reduce scope, not quality:

"15 minutes is workable — let's make every minute count. We'll focus on ONE skill per day with high-intensity practice:

| Day | Focus | Activity | Duration |
|-----|-------|----------|----------|
| Mon | Spatial Reasoning | 8 targeted questions | 15 min |
| Tue | Word Problems | 5 multi-step problems | 15 min |
| Wed | Inference | 1 passage + 4 questions | 15 min |
| Thu | Careless Error Drill | 10 quick-fire math with checking | 15 min |
| Fri | Review | Re-do 5 hardest questions from the week | 15 min |

This won't cover everything, but it targets the highest-impact areas."

### "The test is in 2 weeks — help!"

Emergency plan — focus on quick wins:

"With 2 weeks left, we focus on three things:
1. **Careless error reduction** — biggest quick win. Practise checking your work. Potential gain: 3-5 marks.
2. **Time management** — do 2 timed mock tests this week to build pacing confidence.
3. **Confidence building** — practise areas you're GOOD at too, not just weak areas. Go into the test feeling strong.

Do NOT try to learn new concepts. Work with what you know. Sharpen, don't build."

### "My child refuses to practise"

This is a motivation/wellbeing issue, not a study plan issue:

"Forcing practice when a child is resistant usually backfires. A few suggestions:
- Reduce session length drastically (even 10 minutes of willing practice beats 30 minutes of resentful practice)
- Let them choose what to practise (within the priority areas)
- Gamify it: 'Can you beat your score from yesterday?'
- Take a 2-3 day break if needed — sometimes a reset helps
- If the resistance persists, it might be worth talking to your child about what's really going on. This process can create anxiety, and wellbeing comes first.

I can adjust the plan to be shorter and more flexible. Would that help?"

---

## Review Cycle Integration

Every study plan includes built-in review checkpoints:

| Checkpoint | Frequency | Action |
|------------|-----------|--------|
| **Daily review** | End of each session | Student self-rates: "How did that feel? Easy / OK / Hard" |
| **Weekly review** | End of each week | Quick 5-question check on the week's focus areas |
| **Biweekly diagnostic** | Every 2 weeks | Short diagnostic test (not full mock) on priority areas |
| **Monthly mock** | Monthly (foundation phase) or weekly (sharpening phase) | Full timed mock test under real conditions |
| **Plan adjustment** | After each diagnostic/mock | Review Learning DNA changes, adjust plan priorities |

---

## Integration Points

- **Diagnostic input:** Study plans are generated from `diagnostic` skill output — specifically the `skill_gaps` and `recommendations` sections
- **Learning DNA:** Primary data source for priority scoring and mastery levels
- **Parent communication:** Plans are communicated through the `parent-advisor` skill communication style
- **OC/Selective context:** Section composition and time allocations differ by stage
- **Memory:** Previous plans and their outcomes stored in family insights namespace for continuity
- **Test dates:** System configuration provides target test dates for phase calculation
