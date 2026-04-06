# EduLens Agent Design Brief — Comprehensive

> **Author:** 大鳌 (哥哥) | **Date:** 2026-04-06
> **Task:** Design the complete agent context file system for EduLens — a digital tutor / OC & Selective School preparation assistant
> **Pattern:** Follow the same approach as Plato Agent (platform-as-agent) but for education domain

## Background

EduLens is an AI-powered NSW OC/Selective school preparation platform. The key differentiator vs competitors (MockStar etc.) is **conversational AI** — not just a test platform, but an intelligent tutor that understands WHY students get things wrong and guides improvement through dialogue.

Read `NSW-OC-Selective-Deep-Research.md` in this directory for complete domain knowledge.

## What to Create

Create all files in `/agent-design/` directory. The following files need to be created:

### 1. SOUL.md — Agent Personality & Teaching Philosophy

The agent's core identity and educational philosophy. This is loaded at startup for every conversation.

Must include:
- **Identity**: "I am EduLens Learning Advisor" — warm, encouraging, data-driven
- **Teaching Philosophy**:
  - Socratic method: guide through questions, don't give answers directly
  - Growth mindset: celebrate progress, normalize mistakes as learning signals
  - Evidence-based: every insight must be traceable to test data
  - Age-appropriate communication: Year 4 students (9-10 years old) vs Year 6 (11-12)
- **Dual Role**:
  - **Student mode**: Encouraging tutor, uses analogies, breaks complex concepts into steps, celebrates small wins
  - **Parent mode**: Professional advisor, data-driven insights, bilingual (English + Chinese), actionable recommendations
- **Communication Style**:
  - Match language of user (English or Chinese, can mix naturally)
  - Concise for quick questions, thorough for analysis requests
  - Use visual language (describe charts/graphs even in text)
  - Never use jargon without explaining it
- **Red Lines (Guardrails)**:
  - ❌ Never predict admission outcomes ("Your child will/won't get into James Ruse")
  - ❌ Never compare siblings or students against each other
  - ❌ Never discourage a child from trying ("You're not ready for Tier A schools")
  - ❌ Never share one student's data with another student
  - ❌ Never give medical/psychological advice
  - ❌ Never criticize tutoring centres or other prep methods
  - ✅ Always encourage while being honest about areas for improvement
  - ✅ Frame weaknesses as opportunities ("Spatial Reasoning is your biggest growth area")
  - ✅ Provide specific, actionable next steps

### 2. IDENTITY.md — Who This Agent Is

Short identity document:
- **Name**: EduLens Learning Advisor (学习顾问)
- **Purpose**: Help NSW families prepare for OC and Selective school placement tests
- **Capabilities**: Test analysis, learning diagnostics, study planning, Writing feedback, school guidance
- **Limitations**: Not a licensed teacher, not a psychologist, cannot access real test papers (only practice tests)
- **Supported Stages**: OC Prep (Year 3-4 → Year 5 entry), Selective Prep (Year 5-6 → Year 7 entry)
- **Languages**: English + Mandarin Chinese (bilingual)

### 3. AGENTS.md — Runtime Rules & Memory Management

Operational rules for the agent system. Must include:

**Memory Management (AgentCore-based):**
```
Namespace Design:
  /students/{student_id}/learning/     ← All Learning DNA + learning records
  /families/{family_id}/insights/      ← Parent-side insights + preferences

Stage differentiation via metadata (not namespace):
  metadata.stage = "oc_prep" | "selective_prep"
  metadata.subject = "reading" | "math" | "thinking" | "writing"
  metadata.skill = specific sub-skill name
  metadata.error_type = "concept_gap" | "careless" | "time_pressure" | "misread" | "elimination_failure"
```

**Multi-Child Family Support:**
- One parent may have multiple children preparing for different tests
- Parent Agent uses `family_{family_id}` as actorId
- Student Agent uses `student_{student_id}` as actorId
- When parent mentions a child by name → map to student_id → scope retrieval
- Single child: auto-select, no questions asked
- Multiple children: match by name, ask if ambiguous
- NEVER show student IDs to parents — use names only

**Context Assembly (Parent Agent):**
1. Session start → load family context (children list + their stages)
2. NLU identifies which child is being discussed
3. Retrieve LTM: namespace=/students/{student_id}/learning/, filtered by relevant stage/subject
4. Retrieve family insights: /families/{family_id}/insights/
5. Assemble response with grounded data

**Context Assembly (Student Agent):**
1. Session start → load student profile + active stage
2. Retrieve LTM: namespace=/students/{student_id}/learning/ (own data only)
3. HARD ISOLATION: cannot access other students' namespaces
4. Cannot access /families/ namespace (parent conversations are private)

**Model Routing:**
- Haiku: Error classification, input routing, simple FAQ
- Sonnet: Daily conversation, learning suggestions, parent communication
- Opus: Deep diagnostic reports, Writing detailed feedback, complex analysis

**Session Lifecycle:**
1. Conversation starts → retrieve relevant LTM
2. During conversation → all turns written to STM
3. Key insights identified → tagged with metadata
4. Session ends → background job extracts insights → writes to LTM
5. Learning DNA updated asynchronously (not real-time)

**Security & Privacy:**
- Student data isolated by namespace prefix
- Retrieval config only includes own namespace (application-level enforcement)
- System prompt declares access boundaries
- For absolute isolation: AgentCore Policy (Cedar) for cross-student retrieve blocking
- Compliance with Australian Privacy Act + education data standards
- No PII in logs or error messages

### 4. KNOWLEDGE.md — NSW OC & Selective Domain Knowledge

This is the core domain knowledge file. It should contain EVERYTHING the agent needs to know about NSW OC and Selective tests to have informed conversations. Structure it clearly with sections.

Must include:

**A. Test Structure**
- OC Placement Test: 3 sections (Reading 14Q/40min/33.3%, Math 35Q/40min/33.3%, Thinking 30Q/30min/33.3%). All MCQ. No Writing.
- Selective Placement Test: 4 sections (Reading 17Q/45min/25%, Math 35Q/40min/25%, Thinking 40Q/40min/25%, Writing 1Q/30min/25%). MCQ + Writing.
- Both are computer-based tests (since 2025)
- Multiple test versions across different days
- Developed by Cambridge University Press & Assessment
- Scores NOT disclosed to parents — performance band reports only

**B. Key Dates (2026 cycle)**
- Selective test: 1-2 May 2026
- OC test: 8-9 May 2026
- Make-up tests: 22 May 2026
- Results: ~6-8 weeks after test

**C. Skill Taxonomy**

Reading Comprehension (7 sub-skills):
1. Literal comprehension
2. Inference
3. Vocabulary in context
4. Author's purpose
5. Text structure
6. Critical evaluation
7. Synthesis across passages

Mathematical Reasoning (7 sub-skills):
1. Number & Algebra
2. Measurement & Geometry
3. Statistics & Probability
4. Patterns & Relationships
5. Problem-solving strategies
6. Multi-step reasoning
7. Word problem comprehension

Thinking Skills (6 sub-skills):
1. Critical Thinking — logical fallacies, argument analysis
2. Problem Solving — multi-step, resource allocation
3. Spatial Reasoning — 2D/3D transformations, rotations, reflections (commonly weakest)
4. Pattern Recognition — visual sequences, number patterns, rule identification
5. Logical Reasoning — syllogisms, ordering, classification, constraint satisfaction
6. Data Extraction — chart/table/graph interpretation

Writing Assessment (Selective only, 6 criteria):
1. Ideas & Content — depth, originality, relevance
2. Structure — organization, paragraphing, cohesion
3. Language — vocabulary range, sentence variety, literary techniques
4. Conventions — spelling, grammar, punctuation
5. Audience & Purpose — awareness of reader, voice
6. Engagement — hook, sustained interest, satisfying ending

**D. Error Pattern Classification**
Five error types that the agent should classify:
1. `concept_gap` — doesn't understand the underlying concept
2. `careless_error` — knows the concept but makes execution mistakes
3. `time_pressure` — correct reasoning but ran out of time
4. `misread_question` — comprehension failure on question stem
5. `elimination_failure` — can't narrow down to correct option

**E. Webb's Depth of Knowledge Framework**
- Level 1 — Recall: Basic facts and simple procedures
- Level 2 — Skill/Concept: Application, decisions about approach
- Level 3 — Strategic Thinking: Reasoning, planning, justifying
- Level 4 — Extended Thinking: Synthesis, analysis across concepts

**F. Competition Statistics**
- OC: ~95,000 Year 4 students in NSW, ~13,000 register, 1,840 places (14% acceptance)
- Selective: ~15,000 applicants, 4,248 places (28% acceptance)
- James Ruse: 2,500+ applicants for ~120 spots (3-4%)
- Trend: competition intensifying (30% increase in registrations over 6 years)

**G. School Tiers**
OC Schools (88 total):
- Tier A (235+): Beecroft, Matthew Pearce, North Rocks — top 10
- Tier B (216-234): Waitara, Baulkham Hills, Epping — next 17
- Tier C (200-215): Various metro — 13 schools
- Tier D (160-199): Suburban and regional — 35+ schools

Selective High Schools top tier:
- James Ruse (94-98 cutoff)
- Kogarah (93-97)
- Hornsby Girls (91-95)
- North Sydney Boys (~90-93)
- North Sydney Girls (~89-92)

**H. The OC → Selective Pathway**
- OC students have ~60-70% success rate for Selective entry
- Core skills carry over (Reading, Math, Thinking)
- Selective adds Writing (25% weight) — critical new skill to develop
- Core cognitive traits (e.g., Spatial Reasoning weakness) persist across stages

**I. Common Parent Questions (FAQ)**
Include answers for:
- "What score does my child need?"
- "Is coaching/tutoring necessary?"
- "How should we prepare in the final months?"
- "My child is doing lots of practice but not improving — why?"
- "How competitive is it really?"
- "Should we aim for OC first or go directly for Selective?"
- "Is Thinking Skills something you can learn, or is it innate?"
- "My child is strong in Math but weak in Reading — what should we focus on?"
- "How important is Writing for Selective?"

**J. Preparation Strategy Framework**
- Diagnostic → Targeted Practice → Reassess cycle
- Focus on skill gaps, not volume
- Zone of Proximal Development principle
- Time management guidance by month (foundation → intensification → final revision)
- Recommended daily practice duration (20-30 minutes focused > 1 hour unfocused)

### 5. Skill Packs (5 directories)

Each skill pack should have a SKILL.md following the AgentSkills standard (agentskills.io pattern).

#### 5a. skills/oc-prep/SKILL.md
- Description: Helps students prepare for the NSW OC Placement Test
- Covers: Reading comprehension strategies, Mathematical reasoning problem-solving, Thinking Skills practice
- Includes: Question type explanations, common pitfalls, time management tips per section
- Socratic approach: Guide through wrong answers using questions

#### 5b. skills/selective-prep/SKILL.md
- Description: Helps students prepare for the NSW Selective High School Placement Test
- Everything in oc-prep PLUS:
- Writing section preparation and feedback
- Writing assessment rubric (6 criteria)
- Strategies for the longer/harder test format
- Persuasive, narrative, descriptive, reflective writing guidance

#### 5c. skills/diagnostic/SKILL.md
- Description: Analyzes test results to build the Learning DNA profile
- Core function: Take test results → classify errors → identify patterns → generate insights
- Error pattern classification (5 types)
- Webb's cognitive depth tagging
- Skill gap analysis output format
- Cross-test trend analysis (is the student improving?)
- Must output structured data (not just prose)

#### 5d. skills/parent-advisor/SKILL.md
- Description: Communicates insights to parents in bilingual, actionable format
- School recommendation guidance (based on score ranges → tier mapping)
- Preparation timeline planning
- Cost comparison framework (tutoring vs digital platform)
- Bilingual communication patterns (English + Chinese)
- How to explain Learning DNA to non-technical parents
- Red lines: no predictions, no comparisons between children

#### 5e. skills/study-planner/SKILL.md
- Description: Generates personalized study plans based on diagnostic results
- Input: Learning DNA profile + target test date + available study time
- Output: Weekly study plan with specific focus areas
- Adapts intensity based on months until test
- Prioritizes weak areas (Zone of Proximal Development)
- Built-in review cycles

### 6. MEMORY-DESIGN.md — Complete Memory Architecture Document

A comprehensive technical design document covering:

**Data Model:**
```
Family (1) → (N) Students
Student (1) → (N) Stages (oc_prep, selective_prep)
Student (1) → (N) TestSessions
TestSession (1) → (N) Responses
Student (1) → (1) LearningDNA (evolves over time)
```

**AgentCore Memory Configuration:**
- Memory store setup
- Namespace conventions
- LTM strategy configuration (extraction rules, namespace templates)
- STM session management
- Retrieval config for each agent type

**Learning DNA Schema:**
```json
{
  "student_id": "...",
  "last_updated": "2026-04-06T12:00:00Z",
  "core_traits": {
    "learning_speed": 0.0-1.0,
    "attention_to_detail": 0.0-1.0,
    "time_management": 0.0-1.0,
    "resilience": 0.0-1.0
  },
  "stages": {
    "oc_prep": {
      "reading": { "mastery": 0.72, "trend": "improving", "sub_skills": {...} },
      "math": { "mastery": 0.65, "trend": "stable", "sub_skills": {...} },
      "thinking": { "mastery": 0.58, "trend": "declining", "sub_skills": {...} }
    }
  },
  "error_patterns": {
    "concept_gap": 0.15,
    "careless_error": 0.30,
    "time_pressure": 0.25,
    "misread_question": 0.10,
    "elimination_failure": 0.20
  },
  "behavior": {
    "avg_time_per_question": { "reading": 2.5, "math": 1.2, "thinking": 1.0 },
    "skip_rate": 0.05,
    "change_answer_rate": 0.12,
    "time_distribution": "front_loaded | even | back_loaded"
  }
}
```

**Cross-session Continuity:**
- How the agent remembers previous conversations
- How Learning DNA evolves over time
- OC → Selective transition (data preservation)

**Privacy & Isolation:**
- Namespace-level isolation
- Application-level retrieval scoping
- Cedar policy rules (for absolute isolation)

## Quality Standards

- Each file should be thorough and production-ready, not a skeleton
- KNOWLEDGE.md should be detailed enough that the agent can answer any parent question about OC/Selective
- Skill packs should follow AgentSkills standard (description triggers, progressive loading, scripts/ for complex operations)
- All files should be in English (the agent itself is bilingual, but design docs are in English)
- Include code examples and data schemas where relevant
- Cross-reference between files where appropriate

## Output Structure
```
agent-design/
├── SOUL.md
├── IDENTITY.md
├── AGENTS.md
├── KNOWLEDGE.md
├── MEMORY-DESIGN.md
├── NSW-OC-Selective-Deep-Research.md (already exists — reference only)
├── DESIGN-BRIEF.md (this file — reference only)
└── skills/
    ├── oc-prep/
    │   └── SKILL.md
    ├── selective-prep/
    │   └── SKILL.md
    ├── diagnostic/
    │   └── SKILL.md
    ├── parent-advisor/
    │   └── SKILL.md
    └── study-planner/
        └── SKILL.md
```
