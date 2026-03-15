# EduLens Platform Architecture — v3 (Lifelong Learning)

> **Version:** 3.0 | **Status:** Design Phase
> **Previous:** v2.1 (OC-focused single-stage)
> **Key Change:** From OC exam prep tool → Multi-stage lifelong learning intelligence platform

---

## 1. Vision Shift

### v2 Vision (Previous)
> AI-powered NSW OC exam prep with conversational intelligence.

### v3 Vision (New)
> A lifelong learning intelligence platform that tracks, understands, and guides a learner from primary school through career — with OC prep as the first stage, not the only stage.

### Why This Matters

The core insight from v2 remains true: **the test is not the product — the understanding is.** But that insight applies far beyond OC exams:

- A Year 4 student preparing for OC has skill gaps in number patterns
- That same student in Year 6 preparing for Selective still has patterns in how they learn
- In Year 12 preparing for HSC, their time management tendencies persist
- In university studying engineering, their reasoning patterns are still recognizable
- In their career, their learning style is still fundamentally *them*

**The Learning DNA doesn't expire when an exam is over.** It evolves across stages. EduLens is the platform that tracks that evolution.

### What Changes vs What Stays

| Aspect | v2 (OC-Only) | v3 (Platform) | Change Type |
|---|---|---|---|
| Learning DNA engine | OC skill taxonomy | Stage-agnostic + stage-specific skills | **Generalize** |
| Test Engine | OC timed test (30Q/30min) | Pluggable test formats per stage | **Abstract** |
| Conversation Engine | 2 agents (student/parent) | Same 2 agents, stage-aware context | **Extend** |
| Question Bank | OC questions only | Stage-partitioned question banks | **Partition** |
| Profile Engine | Single flat profile | Layered: core traits + stage-specific skills | **Layer** |
| User model | Parent + child (primary school) | Parent + child → self-directed learner (grows up) | **Evolve** |
| Pricing | Single tier | Stage-based or bundled | **Restructure** |

---

## 2. Stage Model

### Stage Definition

A **Stage** is a bounded learning context with its own:
- Skill taxonomy (what competencies matter)
- Test formats (how we assess)
- Question bank (the content)
- Success criteria (what "good" looks like)
- Age/relationship model (parent-driven vs self-directed)

### Initial Stages

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LEARNER TIMELINE                             │
│                                                                     │
│  Stage 1        Stage 2         Stage 3        Stage 4+             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐    │
│  │ OC Prep  │──▶│Selective │──▶│ HSC      │──▶│ Lifelong     │    │
│  │ (Yr 3-4) │   │(Yr 5-6)  │   │(Yr 11-12)│   │ Learning     │    │
│  │          │   │          │   │          │   │ (Uni/Career) │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────┘    │
│                                                                     │
│  Parent-driven ──────────────────────────▶ Self-directed            │
│  Narrow skills ──────────────────────────▶ Broad competencies       │
│  Timed MCQ     ──────────────────────────▶ Diverse formats          │
└─────────────────────────────────────────────────────────────────────┘
```

### Stage Configuration (Data-Driven, Not Code-Driven)

Each stage is a **configuration**, not a codebase fork. The platform reads stage definitions from the database:

```yaml
# Stage definition — stored in DB, shown here as YAML for readability
stage:
  id: "oc_prep"
  display_name: "OC Preparation"
  description: "NSW Opportunity Class placement test preparation"
  target_years: [3, 4]
  age_range: [8, 10]

  relationship_model: "parent_driven"  # parent is primary user
  # Options: parent_driven | hybrid | self_directed

  test_formats:
    - id: "oc_timed_test"
      question_count: 35
      duration_minutes: 30
      question_types: ["multiple_choice"]
      sections:
        - { id: "reading", name: "Reading", question_count: 10 }
        - { id: "math", name: "Mathematical Reasoning", question_count: 10 }
        - { id: "thinking", name: "Thinking Skills", question_count: 10 }
        - { id: "writing", name: "Writing", question_count: 5 }

  skill_taxonomy:
    id: "oc_skills_v1"
    categories:
      - id: "reading"
        name: "Reading"
        skills:
          - { id: "reading.inference", name: "Inference & Deduction" }
          - { id: "reading.vocabulary", name: "Vocabulary in Context" }
          - { id: "reading.main_idea", name: "Main Idea & Theme" }
          - { id: "reading.detail", name: "Detail Retrieval" }
          # ...
      - id: "math"
        name: "Mathematical Reasoning"
        skills:
          - { id: "math.number_patterns", name: "Number Patterns" }
          - { id: "math.fractions", name: "Fractions & Decimals" }
          - { id: "math.word_problems", name: "Word Problems" }
          # ...
      - id: "thinking"
        name: "Thinking Skills"
        skills:
          - { id: "thinking.spatial", name: "Spatial Reasoning" }
          - { id: "thinking.analogies", name: "Analogies" }
          # ...

---
stage:
  id: "selective_prep"
  display_name: "Selective School Preparation"
  description: "NSW Selective High School placement test preparation"
  target_years: [5, 6]
  age_range: [10, 12]

  relationship_model: "parent_driven"

  test_formats:
    - id: "selective_timed_test"
      question_count: 40
      duration_minutes: 40
      question_types: ["multiple_choice"]
      sections:
        - { id: "reading", name: "Reading", question_count: 10 }
        - { id: "math", name: "Mathematics", question_count: 10 }
        - { id: "thinking", name: "Thinking Skills", question_count: 10 }
        - { id: "writing", name: "Writing", question_count: 10 }

  skill_taxonomy:
    id: "selective_skills_v1"
    # Extends OC taxonomy with deeper skills
    extends: "oc_skills_v1"
    additional_categories:
      - id: "writing"
        name: "Written Expression"
        skills:
          - { id: "writing.persuasive", name: "Persuasive Writing" }
          - { id: "writing.narrative", name: "Narrative Writing" }
          - { id: "writing.structure", name: "Essay Structure" }

---
stage:
  id: "hsc_prep"
  display_name: "HSC Preparation"
  description: "NSW Higher School Certificate exam preparation"
  target_years: [11, 12]
  age_range: [16, 18]

  relationship_model: "hybrid"  # student primary, parent has view access

  test_formats:
    - id: "hsc_subject_test"
      question_count: null  # varies by subject
      duration_minutes: null  # varies by subject
      question_types: ["multiple_choice", "short_answer", "extended_response"]
      subject_specific: true  # format varies per HSC subject

  skill_taxonomy:
    id: "hsc_skills_v1"
    # Subject-based, not cross-cutting like OC
    subject_taxonomies:
      - subject: "Mathematics Advanced"
        categories:
          - { id: "hsc_math.calculus", name: "Calculus" }
          - { id: "hsc_math.statistics", name: "Statistics" }
          # ...
      - subject: "English Advanced"
        categories:
          - { id: "hsc_eng.text_analysis", name: "Text Analysis" }
          - { id: "hsc_eng.essay_writing", name: "Essay Writing" }
          # ...
```

### Adding a New Stage

Adding a new stage (e.g., NAPLAN, IB, university entrance) requires:

1. **Define stage config** — skill taxonomy, test formats, relationship model
2. **Import question bank** — questions tagged with the new taxonomy
3. **Map skill bridges** — connect new stage skills to core competencies (see Section 3)
4. **Configure AI prompts** — stage-specific system prompts for conversation agents

No code changes required. The platform is stage-agnostic by design.

---

## 3. Layered Learning DNA

### The Key Architectural Insight

The current Learning DNA (v2) is a flat structure tied to OC skills. The v3 architecture **layers** the profile into:

1. **Core Layer** — Stage-agnostic traits that persist across a learner's lifetime
2. **Stage Layer** — Stage-specific skill mastery (OC skills, Selective skills, HSC skills, etc.)

```
┌─────────────────────────────────────────────────────────────────┐
│                     LEARNING DNA v3                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   CORE LAYER (Permanent)                   │  │
│  │  Persists across ALL stages. Updated by every interaction. │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │ Error Patterns  │  │ Time Behavior   │                │  │
│  │  │                 │  │                 │                │  │
│  │  │ • concept_gap   │  │ • pacing style  │                │  │
│  │  │ • careless_error│  │ • rush tendency │                │  │
│  │  │ • time_pressure │  │ • stamina curve │                │  │
│  │  │ • misread       │  │ • completion %  │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  │                                                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │ Confidence      │  │ Learning Style  │                │  │
│  │  │ Estimator       │  │ Indicators      │                │  │
│  │  │                 │  │                 │                │  │
│  │  │ • calibration   │  │ • visual/verbal │                │  │
│  │  │ • change rate   │  │ • reflective vs │                │  │
│  │  │ • risk appetite │  │   impulsive     │                │  │
│  │  └─────────────────┘  │ • persistence   │                │  │
│  │                        └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              STAGE LAYERS (Stage-Specific)                 │  │
│  │                                                            │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │  │
│  │  │  OC Layer   │ │ Selective   │ │  HSC Layer  │  ...    │  │
│  │  │             │ │ Layer       │ │             │         │  │
│  │  │ Skill graph │ │ Skill graph │ │ Skill graph │         │  │
│  │  │ (OC skills) │ │ (Sel skills)│ │ (per subject)│        │  │
│  │  │             │ │             │ │             │         │  │
│  │  │ Mastery per │ │ Mastery per │ │ Mastery per │         │  │
│  │  │ skill node  │ │ skill node  │ │ skill node  │         │  │
│  │  │             │ │             │ │             │         │  │
│  │  │ Stage-      │ │ Stage-      │ │ Stage-      │         │  │
│  │  │ specific    │ │ specific    │ │ specific    │         │  │
│  │  │ error stats │ │ error stats │ │ error stats │         │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              SKILL BRIDGES (Cross-Stage)                   │  │
│  │                                                            │  │
│  │  OC reading.inference ←——→ Selective reading.inference     │  │
│  │  OC math.fractions ———→ Selective math.algebra             │  │
│  │  Selective math.algebra ——→ HSC math.calculus              │  │
│  │                                                            │  │
│  │  Bridges allow the system to:                              │  │
│  │  • Bootstrap new stage with priors from previous stage     │  │
│  │  • Show cross-stage progression ("reading has improved     │  │
│  │    consistently from OC through Selective")                │  │
│  │  • Identify persistent vs stage-specific weaknesses        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Core Layer Schema

```json
{
  "student_id": "uuid",
  "core_version": 3,
  "last_updated": "2026-03-15T10:00:00Z",

  "error_profile": {
    "lifetime_distribution": {
      "concept_gap": 0.35,
      "careless_error": 0.30,
      "time_pressure": 0.20,
      "misread_question": 0.10,
      "elimination_failure": 0.05
    },
    "trend": "careless_errors_decreasing",
    "notable_patterns": [
      {
        "pattern": "Misreads negation words ('not', 'except')",
        "first_seen": "2026-01-15",
        "last_seen": "2026-03-10",
        "frequency": 12,
        "stages_observed": ["oc_prep", "selective_prep"]
      }
    ]
  },

  "time_behavior": {
    "pacing_style": "front_loaded",
    "rush_tendency": 0.65,
    "stamina_pattern": "declining_after_70pct",
    "completion_rate_avg": 0.88,
    "evolution": [
      { "stage": "oc_prep", "completion_rate": 0.82, "measured_at": "2025-09" },
      { "stage": "selective_prep", "completion_rate": 0.91, "measured_at": "2026-03" }
    ]
  },

  "confidence_estimate": {
    "calibration": "slightly_overconfident",
    "answer_change_rate": 0.15,
    "risk_appetite": "moderate"
  },

  "learning_style": {
    "prefers_worked_examples": true,
    "responds_to_socratic": true,
    "persistence_on_hard_questions": "low",
    "derived_from_sessions": 47
  }
}
```

### Stage Layer Schema

```json
{
  "student_id": "uuid",
  "stage_id": "selective_prep",
  "stage_version": 2,
  "activated_at": "2026-01-01T00:00:00Z",
  "last_updated": "2026-03-15T10:00:00Z",

  "skill_graph": {
    "taxonomy_id": "selective_skills_v1",
    "nodes": [
      {
        "skill_id": "reading.inference",
        "mastery": 0.78,
        "confidence": 0.80,
        "trend": "improving",
        "sample_size": 35,
        "last_updated": "2026-03-10T14:30:00Z",
        "bridged_from": {
          "stage": "oc_prep",
          "skill_id": "reading.inference",
          "mastery_at_transition": 0.72
        }
      }
    ],
    "edges": [
      {
        "from": "reading.comprehension",
        "to": "math.word_problems",
        "relationship": "prerequisite",
        "strength": 0.6
      }
    ]
  },

  "stage_error_stats": {
    "total_questions": 280,
    "error_distribution": {
      "concept_gap": 0.30,
      "careless_error": 0.35,
      "time_pressure": 0.15,
      "misread_question": 0.12,
      "elimination_failure": 0.08
    }
  },

  "stage_milestones": [
    {
      "type": "mastery_achieved",
      "skill_id": "reading.vocabulary",
      "threshold": 0.85,
      "achieved_at": "2026-02-20"
    }
  ]
}
```

### Skill Bridges

Skill bridges define how competencies map across stages. They are stored as data, not code:

```json
{
  "bridges": [
    {
      "from_stage": "oc_prep",
      "from_skill": "reading.inference",
      "to_stage": "selective_prep",
      "to_skill": "reading.inference",
      "transfer_type": "direct",
      "prior_weight": 0.7
    },
    {
      "from_stage": "oc_prep",
      "from_skill": "math.fractions",
      "to_stage": "selective_prep",
      "to_skill": "math.algebra_basics",
      "transfer_type": "prerequisite",
      "prior_weight": 0.4
    },
    {
      "from_stage": "selective_prep",
      "from_skill": "math.algebra_basics",
      "to_stage": "hsc_prep",
      "to_skill": "hsc_math.calculus",
      "transfer_type": "foundation",
      "prior_weight": 0.3
    }
  ]
}
```

**How bridges are used:**

1. **Cold start bootstrapping** — When a student activates a new stage, the system uses bridges to set initial mastery priors instead of starting from zero
2. **Cross-stage narrative** — AI can say "Your reading inference has improved from 72% in OC to 85% in Selective prep"
3. **Persistent weakness detection** — If a pattern appears across stages, it's a core trait, not a stage-specific gap

---

## 4. Revised System Architecture

### What Changes

The four bounded contexts from v2 remain, but are **parameterized by stage**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Stage Selector                             │   │
│  │  ┌────────┐  ┌────────────┐  ┌──────┐  ┌───────────────┐   │   │
│  │  │OC Prep │  │Selective   │  │ HSC  │  │ + Add Stage   │   │   │
│  │  │        │  │Prep        │  │      │  │               │   │   │
│  │  │(active)│  │(upcoming)  │  │(lock)│  │               │   │   │
│  │  └────────┘  └────────────┘  └──────┘  └───────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Landing  │  │ Test         │  │ Student   │  │ Parent/Self  │  │
│  │ Page     │  │ Interface    │  │ Chat UI   │  │ Dashboard +  │  │
│  │          │  │ (per stage)  │  │           │  │ AI Chat      │  │
│  └──────────┘  └──────────────┘  └───────────┘  └──────────────┘  │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│                      API LAYER                                        │
│  All APIs accept stage_id as context parameter                        │
│  • API Gateway REST   • API Gateway WebSocket   • ALB (SSE)          │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│                   APPLICATION LAYER                                    │
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   Test Engine    │  │  Profile Engine  │  │ Conversation     │   │
│  │                  │  │                  │  │ Engine           │   │
│  │ Stage-aware:     │  │ Stage-aware:     │  │ Stage-aware:     │   │
│  │ • Loads test     │  │ • Updates core   │  │ • Loads stage-   │   │
│  │   format from    │  │   layer always   │  │   specific       │   │
│  │   stage config   │  │ • Updates stage  │  │   system prompt  │   │
│  │ • Loads question │  │   layer for      │  │ • Grounds in     │   │
│  │   bank filtered  │  │   active stage   │  │   stage skills   │   │
│  │   by stage       │  │ • Manages skill  │  │ • Cross-stage    │   │
│  │ • Timer rules    │  │   bridges on     │  │   recall via     │   │
│  │   per stage      │  │   stage          │  │   core layer     │   │
│  │                  │  │   transition     │  │                  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                        │
│  ┌──────────────────┐                                                 │
│  │  Stage Registry  │  ← NEW: Manages stage definitions,             │
│  │                  │    skill taxonomies, test formats,              │
│  │                  │    skill bridges                                │
│  └──────────────────┘                                                 │
│                                                                        │
│  ┌──────────────────┐                                                 │
│  │  Admin System    │  Extended: per-stage question management        │
│  └──────────────────┘                                                 │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────────────────┐
│                       DATA LAYER (unchanged infra)                    │
│  • RDS Aurora Serverless v2 (PostgreSQL)                              │
│  • ElastiCache (Redis)                                                │
│  • S3, DynamoDB, SQS                                                  │
└───────────────────────────────────────────────────────────────────────┘
```

### New Component: Stage Registry

The Stage Registry is a lightweight service that:

1. Stores stage definitions (skill taxonomy, test formats, relationship model)
2. Stores skill bridges between stages
3. Validates stage transitions (e.g., can't activate HSC before Selective)
4. Provides stage config to all other engines at runtime

```
Stage Registry API:
  GET  /stages                          → list all available stages
  GET  /stages/:id                      → full stage config (taxonomy, formats)
  GET  /stages/:id/skill-taxonomy       → skill tree for a stage
  GET  /stages/:from_id/bridges/:to_id  → skill bridges between two stages
  POST /students/:id/stages/:stage_id   → activate a stage for a student
  GET  /students/:id/stages             → list student's active/completed stages
```

---

## 5. Revised Data Model

### New Entities

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  Stage   │     │ SkillTaxonomy│     │  SkillBridge     │
│          │     │              │     │                  │
│ id       │────▶│ stage_id     │     │ from_stage_id    │
│ name     │     │ categories[] │     │ from_skill_id    │
│ config   │     │ skills[]     │     │ to_stage_id      │
│ status   │     │ version      │     │ to_skill_id      │
└──────────┘     └──────────────┘     │ transfer_type    │
                                       │ prior_weight     │
                                       └──────────────────┘

┌──────────────────┐
│ StudentStage     │  ← NEW: tracks which stages a student has activated
│                  │
│ student_id       │
│ stage_id         │
│ status           │  (active | completed | paused)
│ activated_at     │
│ completed_at     │
│ stage_profile    │  (JSONB — the stage layer of Learning DNA)
└──────────────────┘
```

### Revised Entity Relationships

```
┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  User    │────▶│  Student     │────▶│  StudentStage    │
│          │     │              │     │                  │
│ id       │     │ core_profile │     │ student_id       │
│ email    │     │ (JSONB)      │     │ stage_id         │
│ role     │     │              │     │ stage_profile    │
│ name     │     │              │     │ (JSONB)          │
└──────────┘     └──────────────┘     └────────┬─────────┘
     │                                          │
     │ (parent)                                 │
     ▼                                          ▼
┌──────────────┐                    ┌──────────────────┐
│ ParentLink   │                    │  TestSession     │
│              │                    │                  │
│ parent_id    │                    │ student_stage_id │  ← links to stage, not just student
│ student_id   │                    │ test_format_id   │
│ relationship │                    │ started_at       │
│ permissions  │  ← NEW            │ completed_at     │
└──────────────┘                    │ total_score      │
                                    └───────┬──────────┘
                                            │
┌──────────┐                       ┌────────▼─────────┐
│  Stage   │                       │ SessionResponse  │
│          │                       │                  │
│ id       │                       │ session_id       │
│ name     │                       │ question_id      │
│ config   │                       │ selected_answer  │
└──────────┘                       │ is_correct       │
     │                             │ time_spent_ms    │
     ▼                             │ answer_changes[] │
┌──────────────┐                   │ error_type       │
│  Question    │                   └──────────────────┘
│              │
│ id           │
│ stage_id     │  ← questions belong to a stage
│ stem         │
│ options[]    │
│ correct_ans  │
│ skill_tags[] │
│ difficulty   │
└──────────────┘
```

### Key Schema Changes

```sql
-- NEW: Stage definition table
CREATE TABLE stages (
  id              TEXT PRIMARY KEY,           -- e.g., 'oc_prep', 'selective_prep'
  display_name    TEXT NOT NULL,
  description     TEXT,
  target_years    INTEGER[] NOT NULL,
  age_range       INT4RANGE,
  relationship_model TEXT NOT NULL DEFAULT 'parent_driven'
    CHECK (relationship_model IN ('parent_driven', 'hybrid', 'self_directed')),
  test_formats    JSONB NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'coming_soon', 'deprecated')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NEW: Skill taxonomy per stage
CREATE TABLE skill_taxonomies (
  id              TEXT PRIMARY KEY,           -- e.g., 'oc_skills_v1'
  stage_id        TEXT NOT NULL REFERENCES stages(id),
  version         INTEGER NOT NULL DEFAULT 1,
  categories      JSONB NOT NULL,             -- hierarchical skill tree
  extends         TEXT REFERENCES skill_taxonomies(id),  -- inheritance
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stage_id, version)
);

-- NEW: Skill bridges between stages
CREATE TABLE skill_bridges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage_id   TEXT NOT NULL REFERENCES stages(id),
  from_skill_id   TEXT NOT NULL,
  to_stage_id     TEXT NOT NULL REFERENCES stages(id),
  to_skill_id     TEXT NOT NULL,
  transfer_type   TEXT NOT NULL CHECK (transfer_type IN ('direct', 'prerequisite', 'foundation')),
  prior_weight    DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (prior_weight BETWEEN 0 AND 1),
  UNIQUE(from_stage_id, from_skill_id, to_stage_id, to_skill_id)
);

-- NEW: Student-stage enrollment
CREATE TABLE student_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  stage_id        TEXT NOT NULL REFERENCES stages(id),
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused')),
  stage_profile   JSONB NOT NULL DEFAULT '{}',  -- stage-specific Learning DNA layer
  activated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  UNIQUE(student_id, stage_id)
);

CREATE INDEX idx_student_stages_student ON student_stages(student_id);
CREATE INDEX idx_student_stages_active ON student_stages(student_id, status) WHERE status = 'active';

-- MODIFIED: Students table — core_profile replaces learning_dna
ALTER TABLE students RENAME COLUMN learning_dna TO core_profile;
-- core_profile now only contains stage-agnostic traits (error patterns, time behavior, etc.)
-- Stage-specific skills live in student_stages.stage_profile

-- MODIFIED: Questions — add stage_id
ALTER TABLE questions ADD COLUMN stage_id TEXT REFERENCES stages(id);
CREATE INDEX idx_question_stage ON questions(stage_id);

-- MODIFIED: Test sessions — link to student_stage instead of just student
ALTER TABLE test_sessions ADD COLUMN student_stage_id UUID REFERENCES student_stages(id);
-- student_id remains for backward compat, but student_stage_id is the primary reference

-- MODIFIED: Chat sessions — add stage context
ALTER TABLE chat_sessions ADD COLUMN stage_id TEXT REFERENCES stages(id);

-- MODIFIED: Events — add stage context
ALTER TABLE events ADD COLUMN stage_id TEXT;

-- MODIFIED: ParentLink — add permissions for relationship model evolution
ALTER TABLE parent_links ADD COLUMN permissions JSONB NOT NULL DEFAULT '{"view_profile": true, "view_tests": true, "chat": true}';
```

---

## 6. How Each Engine Adapts

### Test Engine — Stage-Parameterized

The Test Engine doesn't change structurally. It becomes **parameterized**:

```
Before (v2):
  createTestSession(studentId) → always OC format (35Q, 30min)

After (v3):
  createTestSession(studentId, stageId) → loads format from stage config
```

| Behavior | v2 | v3 |
|---|---|---|
| Question selection | All from one pool | Filtered by `stage_id` |
| Timer duration | Hardcoded 30 min | From `stage.test_formats[].duration_minutes` |
| Question count | Hardcoded 35 | From `stage.test_formats[].question_count` |
| Sections | Hardcoded 4 | From `stage.test_formats[].sections` |
| Question types | MCQ only | From `stage.test_formats[].question_types` |

The timer state machine, answer change tracking, and signal extraction are **unchanged** — they work the same regardless of stage.

### Profile Engine — Dual-Layer Updates

Every test completion now triggers two updates:

```
test_completed event
    │
    ├──► Update CORE LAYER (always)
    │    • Error pattern distribution (lifetime)
    │    • Time behavior model (lifetime)
    │    • Confidence estimator (lifetime)
    │
    └──► Update STAGE LAYER (for active stage)
         • Skill graph mastery (stage-specific skills)
         • Stage error stats
         • Stage milestones
```

**Stage Transition Flow:**

When a student activates a new stage:

```
1. Student activates "selective_prep"
2. System loads skill bridges: oc_prep → selective_prep
3. For each bridge:
   - Get mastery from OC stage layer
   - Apply transfer weight
   - Set as initial prior in Selective stage layer
4. Core layer carries over unchanged (it's stage-agnostic)
5. Student starts Selective with informed priors, not cold start
```

### Conversation Engine — Stage-Aware Context

The Conversation Engine's core architecture (3-tier memory, state machine, SSE streaming) is **unchanged**. What changes is the **context building**:

```
Before (v2):
  Context = system_prompt + profile_data + conversation_history

After (v3):
  Context = stage_system_prompt + core_profile + stage_profile
            + conversation_history + cross_stage_insights
```

**Stage-specific system prompts:**

```yaml
oc_prep:
  student_agent_prompt: |
    You are helping a Year 3-4 student prepare for the NSW OC placement test.
    Use simple language. Be encouraging. Use the Socratic method.
    The student is 8-10 years old.

  parent_agent_prompt: |
    You are advising a parent whose child is preparing for the NSW OC test.
    Ground all responses in the child's Learning DNA profile data.
    Reference specific skills from the OC curriculum.

selective_prep:
  student_agent_prompt: |
    You are helping a Year 5-6 student prepare for the NSW Selective School test.
    The student is more mature. You can use more complex explanations.
    The test is harder and has writing components.

  parent_agent_prompt: |
    You are advising a parent whose child is preparing for the NSW Selective test.
    You can reference their OC journey if data exists.
    The stakes feel higher — be empathetic but data-grounded.

hsc_prep:
  student_agent_prompt: |
    You are helping a Year 11-12 student prepare for HSC exams.
    Treat them as a young adult. Be direct and analytical.
    Focus on subject-specific depth.

  parent_agent_prompt: |
    You are advising a parent of a HSC student.
    The student is more independent. Respect their autonomy.
    Focus on trends, well-being signals, and strategic advice.
```

**Cross-stage narrative in conversations:**

The AI can now reference data across stages. Example:

```
Parent: "Is she ready for Selective?"
AI: "Based on her OC prep data and the first 3 Selective practice tests:
     - Her reading inference transferred well — 72% in OC, now 78% in Selective
     - Math word problems are harder at Selective level — she dropped from 68% to 52%
     - Her rushing pattern from OC is persisting — she still loses accuracy after Q30

     The core skills are there. The gap is difficulty adjustment, not fundamentals."
```

This is possible because:
1. Core layer has the rushing pattern (cross-stage)
2. Skill bridges connect OC reading.inference → Selective reading.inference
3. Stage layers have the mastery numbers for each stage

---

## 7. User Model Evolution

### Relationship Model Progression

A key design challenge: the platform spans ages 8 to adult. The user relationship model must evolve:

```
┌────────────────────────────────────────────────────────────────┐
│                 RELATIONSHIP MODEL BY STAGE                     │
│                                                                 │
│  PARENT-DRIVEN (OC, Selective)                                 │
│  ├── Parent is primary account holder                          │
│  ├── Parent creates student profile                            │
│  ├── Parent has full access to all data + AI chat              │
│  ├── Student has guided access (test + explanation chat)       │
│  └── Parent receives all notifications                         │
│                                                                 │
│  HYBRID (HSC)                                                  │
│  ├── Student becomes primary user                              │
│  ├── Student has own login and full dashboard access            │
│  ├── Parent has VIEW access (configurable by student)          │
│  ├── Parent AI chat still works but respects student privacy    │
│  └── Student controls notification preferences                 │
│                                                                 │
│  SELF-DIRECTED (University, Career)                            │
│  ├── Student is sole account holder                            │
│  ├── No parent access (unless explicitly shared)               │
│  ├── Focus shifts from parent-insight to self-insight          │
│  └── AI chat becomes personal learning coach                   │
└────────────────────────────────────────────────────────────────┘
```

### Account Lifecycle

```
Year 3: Parent signs up → creates student profile → activates OC stage
Year 5: Parent activates Selective stage → OC data carries over
Year 11: Student gets own login → hybrid mode → activates HSC stage
Year 13: Student transitions to self-directed → university stage
Year 22+: Student continues as lifelong learner → career learning
```

**Key principle:** The data belongs to the learner. As they grow up, they gain control over it. The parent's role diminishes naturally, mirroring real life.

### Permissions Model

```json
{
  "parent_link": {
    "parent_id": "uuid",
    "student_id": "uuid",
    "permissions": {
      "view_profile": true,
      "view_tests": true,
      "view_chat_history": false,
      "chat_with_ai": true,
      "manage_stages": true,
      "receive_notifications": true
    },
    "granted_by": "system",
    "overridable_by_student": true,
    "override_min_age": 14
  }
}
```

When the student turns 14 (or activates a `hybrid` stage), they can override parent permissions — e.g., disable `view_chat_history` while keeping `view_profile`.

---

## 8. Stage Selector UX

### Dashboard with Stage Context

The main dashboard shows the learner's **active stage** prominently, with the ability to switch:

```
┌─────────────────────────────────────────────────────────────┐
│  EduLens                                    Mia Chen ▾      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  📚 Learning Journey                                  │   │
│  │                                                       │   │
│  │  [OC Prep ✓]───▶[Selective Prep ●]───▶[HSC 🔒]      │   │
│  │   completed       active                locked        │   │
│  │   2024-2025       since Jan 2026                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Active: Selective Prep ─────────────────────────────┐   │
│  │                                                       │   │
│  │  [Take Test]    [Review Mistakes]    [Ask AI]         │   │
│  │                                                       │   │
│  │  Recent Performance          Learning DNA             │   │
│  │  ┌─────────────────┐        ┌─────────────────┐      │   │
│  │  │ Test #12: 78%   │        │ ▲ Reading: 0.82 │      │   │
│  │  │ Test #11: 72%   │        │ ► Math:    0.65 │      │   │
│  │  │ Test #10: 75%   │        │ ▼ Writing: 0.55 │      │   │
│  │  └─────────────────┘        └─────────────────┘      │   │
│  │                                                       │   │
│  │  Core Traits (across all stages)                      │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │ ⏱ Rushes after Q30  │  ✎ Misreads negations │    │   │
│  │  │ (persistent since OC) (improving)             │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Stage Selection Flow

```
New user signup:
  1. "What are you preparing for?" → [OC Test] [Selective Test] [HSC] [Other]
  2. Stage activated → skill taxonomy loaded → first test available

Existing user adds stage:
  1. Profile → Learning Journey → [+ Add Stage]
  2. System shows available stages based on age/year
  3. If bridges exist from current stage → shows "Your OC data will carry over"
  4. Stage activated → bootstrapped with bridge priors
```

---

## 9. Contest System

### Why Contests

Practice tests measure a student against themselves. Contests measure a student **against peers** — providing the one signal self-paced practice can never give: *where do I actually stand?*

For the NSW OC/Selective market, this is especially powerful. Parents desperately want to know: "Is my child in the top 10%? Top 5%?" Currently they guess based on tutoring center mock exams with small sample sizes. EduLens contests provide this at platform scale with statistical rigor.

### Design Principles

1. **Contests reuse the Test Engine** — A contest is a test with a shared window and ranking. Not a separate system.
2. **Stage-scoped** — Each contest belongs to a stage. OC contests use OC questions, Selective contests use Selective questions.
3. **Admin-defined cadence** — Weekly, monthly, or custom schedule. Not hardcoded.
4. **Fair comparison** — All participants get the same questions, same duration, same rules.
5. **Privacy-safe ranking** — Leaderboards show anonymized handles, not real names. Parents see their child's exact rank and percentile.
6. **Feeds Learning DNA** — Contest results are just another test event. They update the profile like any other test.

### Contest Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                     CONTEST LIFECYCLE                              │
│                                                                    │
│  DRAFT ──publish──▶ OPEN ──window starts──▶ ACTIVE                │
│  (admin creates)    (registration open)      (students can take)  │
│                                                                    │
│  ACTIVE ──window ends──▶ SCORING ──complete──▶ FINALIZED          │
│  (test window open)      (calculate ranks)     (results visible)  │
│                                                                    │
│  FINALIZED ──after retention──▶ ARCHIVED                          │
│  (leaderboard live)              (data retained, UI hidden)       │
└──────────────────────────────────────────────────────────────────┘
```

**States:**

| State | Duration | What Happens |
|---|---|---|
| **DRAFT** | Until admin publishes | Admin configures contest. Not visible to users. |
| **OPEN** | Registration period (e.g., Mon-Fri before contest) | Users see contest, register. Question set is locked. |
| **ACTIVE** | Contest window (e.g., Saturday 9am-6pm) | Registered students can start the test anytime within the window. Once started, normal timer rules apply. |
| **SCORING** | Seconds to minutes after window closes | System calculates scores, ranks, percentiles. Late submissions auto-submitted. |
| **FINALIZED** | Until next contest or admin archives | Leaderboard visible. Students can review wrong answers. AI chat available for contest questions. |
| **ARCHIVED** | Permanent | Data retained for historical analysis. UI no longer shows leaderboard. |

### Contest vs Practice Test — Key Differences

| Aspect | Practice Test | Contest |
|---|---|---|
| When | Anytime | Within a defined time window |
| Questions | Random from pool | Fixed set, same for all participants |
| Ranking | None (self-comparison only) | Rank + percentile among all participants |
| Registration | Not needed | Required (capacity planning, fairness) |
| Results timing | Immediate | After contest window closes (everyone finishes) |
| Review | Immediate | After FINALIZED (prevents question leaking during window) |
| Profile impact | Updates Learning DNA | Updates Learning DNA (same as practice) |

### Contest Configuration (Admin-Defined)

```yaml
contest:
  id: "oc-weekly-2026-w12"
  stage_id: "oc_prep"
  title: "OC Weekly Challenge #12"
  description: "35-question timed OC practice under contest conditions"

  # Schedule
  schedule:
    type: "recurring"              # recurring | one_time
    recurrence: "weekly"           # weekly | monthly | custom
    day_of_week: "saturday"        # for weekly
    registration_opens: "monday"   # relative to contest day
    registration_closes: "friday 23:59"

  # Contest window — when students can actually take the test
  window:
    date: "2026-03-21"
    start_time: "09:00"            # AEST
    end_time: "18:00"              # AEST
    timezone: "Australia/Sydney"
    # Student can START anytime in window. Timer begins on start.

  # Test configuration — reuses stage test format
  test_config:
    test_format_id: "oc_timed_test"   # from stage definition
    question_count: 35
    duration_minutes: 30
    question_selection: "curated"      # curated | random_fixed_seed
    # curated: admin hand-picks questions
    # random_fixed_seed: system selects randomly but same set for all

    question_ids: [...]               # if curated, specific question IDs
    # OR
    selection_rules:                   # if random_fixed_seed
      difficulty_distribution:
        easy: 10
        medium: 15
        hard: 10
      skill_coverage:                  # ensure balanced skill representation
        min_per_category: 3

  # Capacity
  capacity:
    max_participants: null             # null = unlimited
    min_participants: 5                # cancel if fewer register

  # Ranking
  ranking:
    method: "score_then_time"
    # Options:
    #   score_only:       rank by score descending
    #   score_then_time:  rank by score desc, then total_time asc (tiebreaker)
    #   weighted:         custom formula

    tiebreaker: "total_time_asc"       # faster completion wins ties
    show_percentile: true
    show_rank: true
    show_total_participants: true

  # Display
  display:
    leaderboard_size: 100              # top N shown on public leaderboard
    anonymized: true                   # show handles, not real names
    show_score_distribution: true      # histogram of scores
    show_skill_breakdown: false        # per-skill only visible to self

  # Rewards (future, not MVP)
  rewards:
    badges: ["top_10_pct", "perfect_score", "fastest_finish"]
```

### Recurring Contest Automation

Admins don't manually create each weekly contest. They define a **contest series**:

```yaml
contest_series:
  id: "oc-weekly-challenge"
  stage_id: "oc_prep"
  title_template: "OC Weekly Challenge #{sequence_number}"
  recurrence: "weekly"
  day_of_week: "saturday"
  window_start: "09:00"
  window_end: "18:00"
  timezone: "Australia/Sydney"
  registration_opens_offset: "-5d"    # 5 days before contest
  auto_publish: true                  # automatically publish or require admin review
  question_selection: "random_fixed_seed"
  selection_rules:
    difficulty_distribution: { easy: 10, medium: 15, hard: 10 }
    exclude_recent_questions: 4       # don't reuse questions from last 4 contests
  status: "active"                    # active | paused | ended
```

The system auto-generates contest instances from the series:
```
EventBridge (weekly cron) → Lambda → creates next contest instance
  → status: DRAFT (if auto_publish: false)
  → status: OPEN  (if auto_publish: true)
  → selects questions (excluding recently used)
  → opens registration
```

### Data Model

```sql
-- Contest series (recurring template)
CREATE TABLE contest_series (
  id              TEXT PRIMARY KEY,
  stage_id        TEXT NOT NULL REFERENCES stages(id),
  title_template  TEXT NOT NULL,
  description     TEXT,
  recurrence      TEXT NOT NULL CHECK (recurrence IN ('weekly', 'monthly', 'custom')),
  schedule_config JSONB NOT NULL,          -- day_of_week, time, timezone, offsets
  test_config     JSONB NOT NULL,          -- question selection rules, format
  ranking_config  JSONB NOT NULL,          -- ranking method, display options
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'ended')),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual contest instance
CREATE TABLE contests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id         TEXT REFERENCES contest_series(id),  -- NULL for one-off contests
  stage_id          TEXT NOT NULL REFERENCES stages(id),
  title             TEXT NOT NULL,
  description       TEXT,
  sequence_number   INTEGER,                  -- #12 in "Weekly Challenge #12"

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'active', 'scoring', 'finalized', 'archived')),

  -- Schedule
  registration_opens_at  TIMESTAMPTZ NOT NULL,
  registration_closes_at TIMESTAMPTZ NOT NULL,
  window_start_at        TIMESTAMPTZ NOT NULL,
  window_end_at          TIMESTAMPTZ NOT NULL,
  timezone               TEXT NOT NULL DEFAULT 'Australia/Sydney',

  -- Test configuration
  test_format_id    TEXT NOT NULL,            -- references stage test format
  question_ids      UUID[] NOT NULL,          -- locked question set
  duration_minutes  INTEGER NOT NULL,
  question_count    INTEGER NOT NULL,

  -- Ranking
  ranking_config    JSONB NOT NULL DEFAULT '{}',

  -- Stats (populated after scoring)
  total_participants  INTEGER,
  avg_score           DECIMAL(5,2),
  median_score        DECIMAL(5,2),
  score_stddev        DECIMAL(5,2),
  top_score           INTEGER,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at      TIMESTAMPTZ
);

CREATE INDEX idx_contests_stage ON contests(stage_id, window_start_at DESC);
CREATE INDEX idx_contests_status ON contests(status);
CREATE INDEX idx_contests_series ON contests(series_id, sequence_number DESC);
CREATE INDEX idx_contests_window ON contests(window_start_at, window_end_at)
  WHERE status IN ('open', 'active');

-- Contest registration
CREATE TABLE contest_registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id      UUID NOT NULL REFERENCES contests(id),
  student_id      UUID NOT NULL REFERENCES students(id),
  student_stage_id UUID NOT NULL REFERENCES student_stages(id),
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_by   UUID NOT NULL REFERENCES users(id),  -- parent or student
  status          TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'started', 'completed', 'no_show', 'withdrawn')),
  UNIQUE(contest_id, student_id)
);

CREATE INDEX idx_registrations_contest ON contest_registrations(contest_id);
CREATE INDEX idx_registrations_student ON contest_registrations(student_id);

-- Contest results (populated after scoring)
CREATE TABLE contest_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id          UUID NOT NULL REFERENCES contests(id),
  student_id          UUID NOT NULL REFERENCES students(id),
  test_session_id     UUID NOT NULL REFERENCES test_sessions(id),

  -- Scoring
  score               INTEGER NOT NULL,
  total_questions     INTEGER NOT NULL,
  score_pct           DECIMAL(5,2) NOT NULL,     -- 78.57
  total_time_ms       BIGINT NOT NULL,            -- for tiebreaker

  -- Ranking
  rank                INTEGER NOT NULL,
  total_participants  INTEGER NOT NULL,
  percentile          DECIMAL(5,2) NOT NULL,      -- 85.50 = top 14.5%

  -- Skill breakdown (private to student)
  skill_scores        JSONB NOT NULL DEFAULT '{}',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(contest_id, student_id)
);

CREATE INDEX idx_results_contest_rank ON contest_results(contest_id, rank);
CREATE INDEX idx_results_student ON contest_results(student_id, created_at DESC);
CREATE INDEX idx_results_percentile ON contest_results(contest_id, percentile DESC);
```

### Ranking Algorithm

```python
def calculate_rankings(contest_id: str) -> list[ContestResult]:
    """
    Calculate rankings after contest window closes.
    Called by scoring Lambda when contest transitions to SCORING state.
    """
    # Get all completed test sessions for this contest
    submissions = db.query("""
        SELECT
          cr.student_id,
          ts.id as test_session_id,
          ts.total_score as score,
          ts.total_questions,
          ts.total_time_ms,
          -- per-skill breakdown
          jsonb_agg(jsonb_build_object(
            'skill', sr.skill_tag,
            'correct', sr.is_correct
          )) as skill_detail
        FROM contest_registrations cr
        JOIN test_sessions ts ON ts.contest_id = :contest_id
          AND ts.student_id = cr.student_id
          AND ts.status = 'completed'
        JOIN session_responses sr ON sr.session_id = ts.id
        WHERE cr.contest_id = :contest_id
          AND cr.status = 'completed'
        GROUP BY cr.student_id, ts.id
    """, contest_id=contest_id)

    # Sort by ranking method
    contest = db.get_contest(contest_id)
    ranking_method = contest.ranking_config.get('method', 'score_then_time')

    if ranking_method == 'score_then_time':
        submissions.sort(key=lambda s: (-s.score, s.total_time_ms))
    elif ranking_method == 'score_only':
        submissions.sort(key=lambda s: -s.score)

    total = len(submissions)

    results = []
    for i, sub in enumerate(submissions):
        rank = i + 1
        # Percentile: % of participants this student scored better than
        percentile = ((total - rank) / total) * 100

        results.append(ContestResult(
            contest_id=contest_id,
            student_id=sub.student_id,
            test_session_id=sub.test_session_id,
            score=sub.score,
            total_questions=sub.total_questions,
            score_pct=(sub.score / sub.total_questions) * 100,
            total_time_ms=sub.total_time_ms,
            rank=rank,
            total_participants=total,
            percentile=round(percentile, 2),
            skill_scores=aggregate_skills(sub.skill_detail),
        ))

    # Bulk insert results
    db.bulk_insert_contest_results(results)

    # Update contest stats
    scores = [r.score for r in results]
    db.update_contest(contest_id, {
        'status': 'finalized',
        'total_participants': total,
        'avg_score': statistics.mean(scores),
        'median_score': statistics.median(scores),
        'score_stddev': statistics.stdev(scores) if len(scores) > 1 else 0,
        'top_score': max(scores),
        'finalized_at': datetime.now(UTC),
    })

    return results
```

### Contest ↔ Test Engine Integration

A contest test session is a **regular test session** with extra metadata. The Test Engine doesn't need special contest logic:

```
Contest Registration
    │
    ├── Student clicks "Start Contest"
    │
    ├── System validates:
    │   ├── Contest status == ACTIVE
    │   ├── Current time within contest window
    │   ├── Student is registered
    │   └── Student hasn't already started
    │
    ├── Creates normal TestSession with:
    │   ├── student_stage_id (from registration)
    │   ├── contest_id (NEW field on test_sessions)
    │   ├── question_ids (from contest.question_ids — fixed, not random)
    │   └── duration_minutes (from contest config)
    │
    └── Test Engine runs exactly as normal
        ├── Timer, answer tracking, signal extraction — all the same
        ├── On submit: score immediately (student sees own score)
        └── Rankings NOT visible until contest FINALIZED
```

```sql
-- Add contest reference to test_sessions
ALTER TABLE test_sessions ADD COLUMN contest_id UUID REFERENCES contests(id);
CREATE INDEX idx_test_sessions_contest ON test_sessions(contest_id) WHERE contest_id IS NOT NULL;
```

### Contest ↔ Profile Engine Integration

Contest results feed the Learning DNA like any other test:

```
Contest test_completed event
    │
    ├──► Profile Engine (same as practice test)
    │    ├── Core layer: error patterns, time behavior
    │    └── Stage layer: skill mastery
    │
    └──► Contest Engine (additional)
         ├── Ranking calculation (after window closes)
         └── Percentile history (new core trait signal)
```

**New signal for Core Layer — Competitive Performance:**

```json
{
  "competitive_performance": {
    "contests_participated": 12,
    "avg_percentile": 72.5,
    "percentile_trend": "improving",
    "best_percentile": 92.0,
    "consistency": 0.78,
    "history": [
      { "contest_id": "...", "stage": "oc_prep", "percentile": 68.0, "date": "2026-01-18" },
      { "contest_id": "...", "stage": "oc_prep", "percentile": 75.0, "date": "2026-01-25" },
      { "contest_id": "...", "stage": "oc_prep", "percentile": 72.5, "date": "2026-02-01" }
    ]
  }
}
```

This gives the AI conversation engine a powerful new data source:

```
Parent: "How does she compare to other students?"
AI: "Over the last 8 weekly contests, Mia has averaged in the 73rd percentile
     — meaning she's outperforming about 73% of participants. Her trend is
     improving: she started at 68th percentile in January and hit 82nd
     last week. Her Reading consistently ranks higher (85th percentile)
     than Math (62nd percentile), which aligns with the skill gaps
     we've been discussing."
```

### Privacy & Fairness

**Leaderboard anonymization:**

```
Public leaderboard shows:
  Rank | Handle          | Score | Time
  #1   | SpeedyReader42  | 34/35 | 22:15
  #2   | MathWiz2026     | 34/35 | 24:30
  #3   | ThinkingCap     | 33/35 | 21:45

Private view (student/parent sees):
  Your rank: #15 out of 127 participants
  Your percentile: 88.2% (top 12%)
  Your score: 30/35 (85.7%)
  Your time: 26:42
```

**Rules:**
- Handles are auto-generated or student-chosen (admin-approved)
- No real names, school names, or identifying information on leaderboard
- Parents can opt out of public leaderboard entirely (child still gets private rank)
- Minimum 5 participants for meaningful ranking (otherwise show "not enough data")

**Anti-cheating (basic, not MVP-critical):**
- Each student can only submit once per contest
- Test window is wide (e.g., 9am-6pm) but test duration is fixed — can't pause
- Answer change tracking detects suspicious patterns (future: flag for review)
- No question review until contest is FINALIZED (prevents sharing answers)

### Contest UI Flow

```
┌─────────────────────────────────────────────────────────────┐
│  EduLens > Selective Prep                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🏆 Upcoming Contest                                  │   │
│  │                                                       │   │
│  │  Selective Weekly Challenge #12                        │   │
│  │  Saturday, 21 March 2026 | 9:00 AM - 6:00 PM AEST   │   │
│  │  40 questions · 40 minutes · 89 registered            │   │
│  │                                                       │   │
│  │  Status: REGISTERED ✓                                 │   │
│  │                                                       │   │
│  │  [Start Contest]  (available when window opens)       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  📊 Last Contest Result                               │   │
│  │                                                       │   │
│  │  Weekly Challenge #11 — 14 March 2026                 │   │
│  │                                                       │   │
│  │  Score: 32/40 (80%)     Rank: #18 of 94              │   │
│  │  Percentile: 81.9%      Time: 34:22                   │   │
│  │                                                       │   │
│  │  ┌─ Score Distribution ──────────────────────┐       │   │
│  │  │     ▓                                      │       │   │
│  │  │     ▓ ▓                                    │       │   │
│  │  │   ▓ ▓ ▓ ▓                                  │       │   │
│  │  │ ▓ ▓ ▓ ▓ ▓ ▓ ▓                  YOU ↑      │       │   │
│  │  │ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓ ▓                      │       │   │
│  │  │ 10  15  20  25  30  35  40                 │       │   │
│  │  └────────────────────────────────────────────┘       │   │
│  │                                                       │   │
│  │  [View Leaderboard]  [Review My Answers]  [Ask AI]   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  📈 Contest History                                   │   │
│  │                                                       │   │
│  │  Percentile trend:  68 → 71 → 75 → 72 → 79 → 82 ↑  │   │
│  │                                                       │   │
│  │  Contests entered: 8                                  │   │
│  │  Avg percentile: 73.5                                 │   │
│  │  Best finish: #8 of 102 (92.2%)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Contest Admin UI

```
┌─────────────────────────────────────────────────────────────┐
│  Admin > Contests > OC Prep                                  │
│                                                              │
│  ┌── Contest Series ────────────────────────────────────┐   │
│  │                                                       │   │
│  │  OC Weekly Challenge (weekly, Saturdays)              │   │
│  │  Status: Active | 12 contests run | Avg 87 participants│  │
│  │                                                       │   │
│  │  [Edit Series]  [Pause]  [View History]               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── Next Instance ─────────────────────────────────────┐   │
│  │                                                       │   │
│  │  #13 — Saturday, 28 March 2026                        │   │
│  │  Status: DRAFT (auto-generated)                       │   │
│  │                                                       │   │
│  │  Questions: 35 (auto-selected)                        │   │
│  │  [Preview Questions]  [Swap Questions]  [Publish]     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  [+ Create One-Off Contest]  [+ Create New Series]          │
└─────────────────────────────────────────────────────────────┘
```

### Contest APIs

```
Contest Management (Admin):
  POST   /api/contest-series                    → create recurring series
  PUT    /api/contest-series/:id                → update series config
  POST   /api/contests                          → create one-off contest
  PUT    /api/contests/:id                      → edit draft contest
  POST   /api/contests/:id/publish              → DRAFT → OPEN
  POST   /api/contests/:id/finalize             → trigger scoring (manual override)
  GET    /api/contests/:id/admin-stats          → detailed admin analytics

Contest Participation (Student/Parent):
  GET    /api/stages/:stage_id/contests         → list upcoming & recent contests
  GET    /api/contests/:id                      → contest details + own registration status
  POST   /api/contests/:id/register             → register for contest
  DELETE /api/contests/:id/register             → withdraw registration
  POST   /api/contests/:id/start                → start contest (creates test session)
  GET    /api/contests/:id/results              → own result (after finalized)
  GET    /api/contests/:id/leaderboard          → public anonymized leaderboard
  GET    /api/contests/:id/score-distribution   → histogram data

Contest History (Student/Parent):
  GET    /api/students/:id/contest-history      → all contest results with percentile trend
```

### Infrastructure

The contest system reuses existing infrastructure with minimal additions:

| Component | Usage | New? |
|---|---|---|
| Lambda | Contest lifecycle transitions, scoring | Reuse existing + 2 new functions |
| EventBridge | Cron for recurring contest generation, window open/close triggers | Reuse existing |
| SQS | Scoring job queue (contest_id → calculate rankings) | New queue: `contest-scoring.fifo` |
| RDS | Contest tables (above) | Schema additions only |
| Redis | Contest registration counts (fast reads for "89 registered" display) | Reuse existing |

**EventBridge Rules:**
```yaml
# Auto-generate next contest instance from series
contest-generation:
  schedule: "cron(0 0 * * ? *)"    # daily at midnight
  target: lambda/contest-generator
  # Checks all active series, creates instances for upcoming dates

# Transition contest to ACTIVE when window opens
contest-window-open:
  schedule: "rate(1 minute)"        # check every minute
  target: lambda/contest-state-manager
  # Finds OPEN contests where window_start_at <= now, transitions to ACTIVE

# Transition contest to SCORING when window closes
contest-window-close:
  schedule: "rate(1 minute)"
  target: lambda/contest-state-manager
  # Finds ACTIVE contests where window_end_at <= now
  # Auto-submits any in-progress tests
  # Transitions to SCORING, enqueues ranking job
```

---

## 10. Impact on Existing v2 Components (including Contest)

### What Stays Unchanged

| Component | Why |
|---|---|
| 3-tier memory system | Memory is already student-scoped, not stage-scoped. Works as-is. |
| Agent state machine | State lifecycle is stage-agnostic. |
| SSE streaming | Transport layer doesn't care about stage. |
| Token budget management | Budget allocation is the same per request. |
| Timer state machine | Timer logic is parameterized by duration, not by stage. |
| Error classification logic | Same heuristics, just different skill taxonomies. |
| Prompt caching | Same strategy, different system prompt content per stage. |
| Model routing | Same routing rules (Sonnet for chat, Haiku for background). |
| Privacy/compliance | Same APP requirements regardless of stage. |
| Infrastructure (AWS) | No infra changes needed. Same Lambda, RDS, ElastiCache, etc. |

### What Changes

| Component | Change | Effort |
|---|---|---|
| Student profile schema | Split into core + stage layers | Medium |
| Question bank | Add `stage_id` column, stage-filtered queries | Low |
| Test session creation | Accept `stage_id`, load format from config | Low |
| Context builder | Load stage-specific system prompt + both profile layers | Medium |
| Admin system | Stage-scoped question management | Low |
| Dashboard UI | Stage selector, cross-stage journey view | Medium |
| Onboarding flow | Stage selection during signup | Low |
| **New: Stage Registry** | New service for stage/taxonomy/bridge management | Medium |
| **New: Bridge engine** | Bootstrap new stage with priors from previous | Medium |
| **New: Contest system** | Contest lifecycle, registration, scoring, leaderboard | Medium |
| **New: Contest admin** | Series management, question curation, scheduling | Medium |

---

## 10. MVP Strategy (Revised)

### Phase 1: OC + Stage Foundation + Contests (Weeks 1-20)

Build everything from v2 MVP, but with the stage abstraction and contest system in place from day one:

- Stage registry exists (with only `oc_prep` stage)
- Student profile has core + stage layer separation
- Questions have `stage_id` (all set to `oc_prep`)
- Test sessions reference `student_stage_id`
- All APIs accept `stage_id` parameter
- Contest system: series creation, registration, lifecycle, scoring, leaderboard
- First OC Weekly Challenge series running by launch

**Why build contests in Phase 1:** Contests are a major engagement and retention driver. Weekly contests give users a reason to return. The leaderboard creates social proof and word-of-mouth. For the NSW parent market, "where does my child rank?" is the #1 question — contests answer it directly.

**Why build the stage abstraction now:** Retrofitting stage support later means migrating data, changing APIs, and reworking the profile schema. Building it in from the start costs ~2 extra weeks but avoids months of migration later.

### Phase 2: Add Selective (Weeks 21-24, ~4 weeks)

With the foundation in place, adding Selective is primarily a **content and configuration** task:

- Define `selective_prep` stage config
- Define skill taxonomy for Selective
- Define skill bridges (OC → Selective)
- Import Selective question bank
- Write Selective-specific AI system prompts
- Build stage transition UX ("Congratulations on OC! Ready for Selective?")

**No core engine changes.** This validates the platform thesis.

### Phase 3: Add HSC (Weeks 23-28, ~6 weeks)

HSC is harder because:
- Multiple subjects (each is essentially its own skill taxonomy)
- New question types (short answer, extended response) — requires Test Engine extension
- Hybrid relationship model — requires permission changes
- Student-as-primary-user flow — requires auth changes

### Phase 4+: Lifelong Learning

- University entrance exams
- Professional certifications
- Self-directed learning goals
- Career skills assessment

Each subsequent stage is faster to add because the platform abstracts grow richer.

---

## 11. Revised Cost Estimate

### Stage support adds minimal cost

| Cost Component | v2 (OC only) | v3 (Multi-stage + Contests) | Delta |
|---|---|---|---|
| Infrastructure (100 users) | $159/mo | $170/mo | +$11 (DB storage, EventBridge, SQS) |
| AI costs (100 users) | $162/mo | $175/mo | +$13 (stage prompts + contest review chat) |
| Development (MVP) | 16-18 weeks | 18-20 weeks | +2-4 weeks for stage + contest |
| Adding each new stage | N/A | ~4-6 weeks | Content + config, minimal code |

**Key insight:** The marginal cost of adding a new stage is almost entirely **content** (questions, skill taxonomy, AI prompts), not **engineering**. This is the platform leverage.

---

## 12. Competitive Moat — Strengthened

### v2 Moat: Single-stage depth
> "We know your child's OC performance better than anyone."

### v3 Moat: Longitudinal intelligence
> "We've been tracking your child's learning journey for 8 years. No one else has this data."

The compounding effect is now **exponential**:

```
Year 1 (OC):       50 tests × 35 questions = 1,750 data points
Year 3 (Selective): + 40 tests × 40 questions = + 1,600 data points
                    + cross-stage bridge data
                    + 3 years of core trait evolution
Year 7 (HSC):      + subject-specific depth
                    + 7 years of core trait data
                    + cross-stage progression narrative

Switching cost: Losing 7+ years of accumulated learning intelligence
```

**This is the real moat.** Any competitor can build an OC test app. No one can replicate years of accumulated, cross-stage learning data.

---

## Summary of Key Decisions

| Decision | Rationale |
|---|---|
| Stage as configuration, not code | Platform scales to N stages without engineering per stage |
| Two-layer Learning DNA (core + stage) | Core traits persist for life; stage skills are transient |
| Skill bridges as data | Cross-stage intelligence without hardcoded mappings |
| Relationship model per stage | Naturally evolves from parent-driven to self-directed |
| Build abstraction in Phase 1 | 2 weeks extra now saves months of migration later |
| Stage Registry as new bounded context | Clean separation of stage config from business logic |
| Contests reuse Test Engine | No parallel test infrastructure; contest is a test with ranking |
| Contest series (recurring templates) | Admin defines once, system auto-generates weekly/monthly |
| Competitive performance in Core Layer | Percentile trend is a lifelong trait, not per-stage throwaway |
| Privacy-safe leaderboards | Anonymized handles protect children; opt-out available |

---

**Next Steps:**
1. Review this architecture — does the stage abstraction feel right?
2. Validate skill bridge concept — how do we define meaningful bridges?
3. Decide: build stage abstraction in Phase 1 MVP or defer?
4. Define the Selective skill taxonomy (first stage after OC)
5. Define first OC Weekly Challenge series configuration
6. Decide leaderboard anonymization policy (auto-generated vs student-chosen handles)
