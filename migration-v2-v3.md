  ---
  Migration Plan: v2 → v3

  Summary of the v3 Shift

  v3 transforms EduLens from an OC-specific exam prep tool into a multi-stage, lifelong learning platform. The three main additions are:

  1. Stage Model — Stages (OC, Selective, HSC, Lifelong) as data-driven config, not code forks
  2. Layered Learning DNA — Split flat student_profiles into a permanent Core Layer + per-stage Stage Layers
  3. Contest System — Peer-ranked, timed contests with leaderboards, built on top of the existing Test Engine

  Everything else (SSE streaming, agent state machine, 3-tier memory, timer, model routing, AWS infra) is unchanged.

  ---
  What Stays Unchanged

  These components require zero modification in v3:

  ┌─────────────────────────────────┬───────────────────────────────────────────────────────┐
  │            Component            │                     Why untouched                     │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 3-tier memory system            │ Student-scoped, not stage-scoped — works as-is        │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ Agent state machine             │ Stage-agnostic lifecycle                              │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ SSE streaming (ALB)             │ Transport layer, indifferent to stage                 │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ WebSocket timer                 │ Parameterized by duration, not stage                  │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ Token budget management         │ Same allocation strategy                              │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ Prompt caching                  │ Same cache_control strategy, different prompt content │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ Model routing                   │ Sonnet for chat, Haiku for background — unchanged     │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ Error classification heuristics │ Same logic, different skill taxonomies                │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ AWS infrastructure              │ No Lambda, RDS, ElastiCache, or networking changes    │
  ├─────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ Privacy/APP compliance          │ Same requirements across all stages                   │
  └─────────────────────────────────┴───────────────────────────────────────────────────────┘

  ---
  Phase 1 — Database Schema Migration

  Goal: Add all v3 tables and modify existing ones with backward-compatible additions.

  1.1 New Tables

  stages                   — stage definitions (id, display_name, test_formats JSONB, ...)
  skill_taxonomies         — per-stage skill trees (categories JSONB, version, extends FK)
  skill_bridges            — cross-stage skill mappings (from_stage, from_skill → to_stage, to_skill)
  student_stages           — enrollment record linking students to stages (stage_profile JSONB)
  contest_series           — recurring contest templates
  contests                 — individual contest instances (lifecycle state machine)
  contest_registrations    — student registrations per contest
  contest_results          — final scores, ranks, percentiles after scoring

  1.2 Modified Tables

  ┌──────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
  │                Table                 │                                                  Change                                                  │                          Risk                          │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ students                             │ Rename learning_dna → core_profile (if column exists); core_profile now holds only stage-agnostic traits │ Medium — requires data migration and all query updates │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ questions                            │ Add stage_id TEXT REFERENCES stages(id) + index                                                          │ Low — nullable, backward compatible                    │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ test_sessions                        │ Add student_stage_id UUID REFERENCES student_stages(id) and contest_id UUID REFERENCES contests(id)      │ Low — nullable FKs                                     │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ chat_sessions                        │ Add stage_id TEXT REFERENCES stages(id)                                                                  │ Low — nullable                                         │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ events                               │ Add stage_id TEXT                                                                                        │ Low — nullable                                         │
  ├──────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ parent_links (or students.parent_id) │ Add permissions JSONB DEFAULT '{"view_profile":true,...}'                                                │ Low — new column with default                          │
  └──────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┘

  ▎ Note: student_profiles table (the flat Learning DNA) is effectively replaced by student_stages.stage_profile (Stage Layer) + students.core_profile (Core Layer). The existing student_profiles rows need to be migrated — the skill_graph moves to the OC stage layer,
  error_patterns and time_behavior move to core_profile.

  1.3 Seed Data

  After schema migration, seed the first stage:
  - Insert oc_prep into stages with the OC test format config (35Q, 30min, 4 sections)
  - Insert oc_skills_v1 into skill_taxonomies with the OC skill tree
  - Backfill questions.stage_id = 'oc_prep' for all existing questions
  - Create student_stages rows for all existing students enrolling them in oc_prep and migrating their current student_profiles data into stage_profile

  ---
  Phase 2 — New Service: Stage Registry

  Goal: Create a lightweight new Lambda service that owns stage configuration.

  2.1 New Lambda Handlers

  GET  /stages                           → list all stages
  GET  /stages/:id                       → full stage config (taxonomy, formats)
  GET  /stages/:id/skill-taxonomy        → the skill tree for a stage
  GET  /stages/:from_id/bridges/:to_id   → skill bridges between two stages
  POST /students/:id/stages/:stage_id    → activate a stage for a student
  GET  /students/:id/stages              → list a student's stages (active/completed)

  2.2 Stage Transition / Bridge Engine

  When a student activates a new stage, a bridge-bootstrapping function:
  1. Reads skill_bridges from from_stage → to_stage
  2. Reads the student's mastery values from the source student_stages.stage_profile
  3. Applies prior_weight to each bridge
  4. Writes bootstrapped initial priors into the new student_stages.stage_profile

  This is called as part of POST /students/:id/stages/:stage_id.

  2.3 CDK Changes

  Add a new StageRegistryLambda Node.js function group to lambda-stack.ts and wire its routes to API Gateway.

  ---
  Phase 3 — Profile Engine: Dual-Layer Updates

  Goal: Update the Profile Engine (Python) to write to both Core Layer and Stage Layer on every test completion.

  3.1 get_error_patterns_aggregate.py + get_error_patterns_trends.py

  Currently read from session_responses and student_profiles. Change to:
  - Accept optional stage_id query param
  - If stage_id provided: query student_stages.stage_profile for stage-specific error stats
  - Always also read/update students.core_profile for lifetime error distribution

  3.2 Bayesian Mastery Updates

  The existing mastery calculation writes to student_profiles.skill_graph. Change to:
  - Write skill mastery to student_stages.stage_profile.skill_graph for the active stage
  - Update students.core_profile.error_profile.lifetime_distribution (aggregate across all stages)

  3.3 New: Competitive Performance in Core Layer

  After contest scoring, add competitive_performance block to students.core_profile:
  { "contests_participated": N, "avg_percentile": X, "percentile_trend": "...", "history": [...] }

  ---
  Phase 4 — Test Engine: Stage Parameterization

  Goal: Make test session creation accept stageId and load format from stage config.

  4.1 startTestSession handler

  Before: POST /sessions { testId, studentId } — hardcoded 35Q, 30min

  After: POST /sessions { testId, studentId, stageId } — loads format from stages.test_formats

  Changes:
  - Look up student_stages to get student_stage_id
  - Load timer duration and question count from stages.test_formats config
  - Filter question selection by questions.stage_id = stageId
  - Write student_stage_id to test_sessions

  4.2 Contest Test Sessions

  Add contest_id support to startTestSession:
  - If contest_id provided, validate contest is ACTIVE and within window
  - Use fixed contests.question_ids instead of random selection
  - Write contest_id to test_sessions

  4.3 No changes needed to

  - Timer state machine (duration already parametrized)
  - Answer tracking / signal extraction
  - Scoring logic

  ---
  Phase 5 — Conversation Engine: Stage-Aware Context

  Goal: Inject stage-specific system prompts and both profile layers into context.

  5.1 Context Builder Changes

  Before:
  Context = system_prompt + profile_data + conversation_history

  After:
  Context = stage_system_prompt        (loaded from stages table or config)
          + core_profile               (from students.core_profile)
          + stage_profile              (from student_stages.stage_profile for active stage)
          + conversation_history
          + cross_stage_insights       (if student has multiple stages, bridge data)

  5.2 Stage-Specific System Prompts

  Each stage defines student_agent_prompt and parent_agent_prompt stored in the stages table or a config file. The context builder loads the appropriate prompt based on chat_sessions.stage_id.

  5.3 Chat Session Creation

  POST /parent-chat and POST /student-chat accept optional stageId. If not provided, default to the student's active stage.

  5.4 Cross-Stage Narrative

  When a student has completed ≥2 stages, the context builder can include a brief cross-stage summary (e.g., "In OC prep, reading was 72%; now 78% in Selective") sourced from the Core Layer and skill bridges.

  ---
  Phase 6 — Contest System (New Bounded Context)

  Goal: Build the full contest lifecycle on top of the existing Test Engine.

  6.1 New Lambda Handlers

  Admin:
  POST   /contest-series                 → create recurring series
  PUT    /contest-series/:id             → update series
  POST   /contests                       → create one-off contest
  PUT    /contests/:id                   → edit draft
  POST   /contests/:id/publish           → DRAFT → OPEN
  POST   /contests/:id/finalize          → manual trigger scoring
  GET    /contests/:id/admin-stats

  Student/Parent:
  GET    /stages/:stage_id/contests      → list upcoming & recent contests
  GET    /contests/:id                   → details + own registration
  POST   /contests/:id/register          → register
  DELETE /contests/:id/register          → withdraw
  POST   /contests/:id/start             → start test (validates window, creates TestSession)
  GET    /contests/:id/results           → own result (after FINALIZED)
  GET    /contests/:id/leaderboard       → anonymized public leaderboard
  GET    /contests/:id/score-distribution → histogram
  GET    /students/:id/contest-history   → all results + percentile trend

  6.2 Contest State Manager (EventBridge)

  Two EventBridge rules at 1-minute intervals:
  - contest-window-open: Finds OPEN contests where window_start_at <= now(), transitions to ACTIVE
  - contest-window-close: Finds ACTIVE contests where window_end_at <= now(), auto-submits in-progress tests, transitions to SCORING, enqueues scoring job

  One daily EventBridge rule:
  - contest-generation: Iterates all active contest_series, creates instances for upcoming dates

  6.3 Scoring Lambda

  A new Python Lambda (fits alongside existing profile-engine pattern) that:
  1. Dequeues from contest-scoring.fifo SQS
  2. Runs calculate_rankings() algorithm
  3. Bulk-inserts contest_results
  4. Updates contests.total_participants, avg_score, etc.
  5. Updates students.core_profile.competitive_performance

  6.4 CDK Changes

  - Add ContestLambda handlers to lambda-stack.ts
  - New contest-scoring.fifo SQS queue
  - New EventBridge rules for contest lifecycle

  ---
  Phase 7 — Frontend Changes

  Goal: Add Stage Selector, Learning Journey view, and Contest UI.

  7.1 New/Modified Pages

  ┌─────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │                    Page                     │                                                               Change                                                               │
  ├─────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ /parent/dashboard                           │ Add Stage Selector at top; show active stage's skill data; show Core Traits section (persistent patterns); link to contest results │
  ├─────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ /parent/students/[studentId]/error-analysis │ Add stageId filter; show stage vs. lifetime view toggle                                                                            │
  ├─────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ /parent/analytics/[studentId]               │ Add cross-stage journey visualization; Core Layer traits                                                                           │
  ├─────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ New: /parent/contests                       │ Contest list, registration, leaderboard, history                                                                                   │
  ├─────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ New: /parent/students/[studentId]/journey   │ Visual timeline of stages completed/active/upcoming                                                                                │
  ├─────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Signup/onboarding                           │ Add "What are you preparing for?" stage selection step                                                                             │
  └─────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  7.2 API Client Updates (api-client.ts)

  New methods to add:
  // Stage Registry
  getStages()
  getStage(stageId)
  activateStudentStage(studentId, stageId)
  getStudentStages(studentId)

  // Contests
  getContests(stageId)
  getContest(contestId)
  registerContest(contestId)
  startContest(contestId)
  getContestResults(contestId)
  getContestLeaderboard(contestId)
  getContestHistory(studentId)

  Modified methods:
  - startTestSession — add optional stageId parameter
  - createParentChatSession / createStudentChatSession — add optional stageId
  - getStudentProfile — response shape changes (core_profile + stage_profile instead of flat learning_dna)

  ---
  Phase 8 — Auth & Permissions

  Goal: Add the permissions JSONB to parent-student links for the relationship model evolution.

  - Add permissions column to parent link (defaults to full parent-driven access)
  - When activating a hybrid stage (HSC), the system can grant the student override rights
  - This is low-risk for Phase 1 since only OC (parent_driven) will be live at launch

  ---
  Migration Order & Dependencies

  Phase 1 (Schema)
    └─► Phase 2 (Stage Registry)  ← required by everything else
          ├─► Phase 3 (Profile Engine updates)
          ├─► Phase 4 (Test Engine updates)
          ├─► Phase 5 (Conversation Engine updates)
          └─► Phase 6 (Contest System)
                └─► Phase 7 (Frontend)  ← needs all backend APIs ready
                      └─► Phase 8 (Permissions)  ← lower priority, mostly for HSC later

  ---
  Effort Estimate (aligned with v3 doc)

  ┌──────────────────────────────────────────────────┬───────────────────────────────────────────┐
  │                      Phase                       │                  Effort                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 1 — Schema migration + seed data                 │ ~3 days                                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 2 — Stage Registry service                       │ ~4 days                                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 3 — Profile Engine dual-layer                    │ ~3 days                                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 4 — Test Engine parameterization                 │ ~2 days                                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 5 — Conversation Engine stage-aware context      │ ~3 days                                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 6 — Contest system (new bounded context)         │ ~7 days                                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 7 — Frontend (stage selector, contests, journey) │ ~5 days                                   │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ 8 — Auth permissions model                       │ ~1 day                                    │
  ├──────────────────────────────────────────────────┼───────────────────────────────────────────┤
  │ Total delta from v2                              │ ~28 days (~4 weeks extra beyond v2 scope) │
  └──────────────────────────────────────────────────┴───────────────────────────────────────────┘

  This aligns with the v3 doc's "+2–4 weeks" estimate (they were conservative; contests add meaningful scope).

  ---
  Key Risks

  1. Data migration for student_profiles → core_profile + stage_profile — existing students' flat Learning DNA needs to be split correctly. The skill_graph goes to student_stages.stage_profile; error_patterns and time_behavior go to students.core_profile. Must be done
  with a migration script and validated before deploying new code.
  2. Backward compatibility during rollout — while migrating, the frontend and old API routes still expect the flat profile shape. Need a feature-flag or versioned API approach during the transition window.
  3. Contest scoring at scale — the ranking algorithm runs after the window closes. At high participation, this needs the SQS FIFO queue to sequence properly and the Lambda timeout to be set high enough.
  4. student_stages as the new primary reference — test_sessions.student_stage_id replaces test_sessions.student_id as the authoritative reference. Queries that join on student_id directly need to be updated.
