# Implementation Plan: Phase 3 — Update Agent Code with New Design

## Requirements Restatement

Update `edulens-agents-ts/` source code to align with the new agent-design specs. Five files to modify, no deployment.

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking Fastify server structure | LOW | Keep HTTP layer, Zod schemas, and streaming loop untouched |
| Breaking tool interfaces | LOW | Only change memory-tools internals; keep tool name/schema compatible |
| TypeScript compile errors | MEDIUM | Run `npx tsc --noEmit` after all changes; fix before committing |
| System prompt too large for context window | LOW | Keep prompts focused; domain knowledge is injected via tools, not prompt |

## Implementation Phases

### Phase 1: Update `src/shared/types.ts` — Add stage & family types

Add `stage` field to `ChildInfo`, add `chineseName`/`nickname` fields, and add a `MemoryMetadata` interface for typed metadata filtering.

**Changes:**
- Add `stage?: 'oc_prep' | 'selective_prep'` to `ChildInfo`
- Add `chineseName?: string` and `nickname?: string` to `ChildInfo`
- Add `stage?: 'oc_prep' | 'selective_prep'` to `AgentPayload`
- Add `familyId?: string` to `AgentPayload`
- Add `MemoryMetadata` interface with `stage`, `subject`, `skill`, `error_type`, `cognitive_depth`, `session_id`, `timestamp`, `confidence` fields
- Update `MemoryRecord.metadata` type from `Record<string, any>` to `MemoryMetadata`

### Phase 2: Update `src/agents/parent-advisor.ts` — New system prompt + stage awareness

**Changes to system prompt (`PARENT_ADVISOR_SYSTEM_PROMPT`):**
Replace the entire prompt with content derived from SOUL.md Parent Agent Persona section. Include:
- Core identity paragraph from SOUL.md §Core Identity
- Teaching philosophy (Evidence-Based + Growth Mindset from §Teaching Philosophy)
- Parent Agent Persona (tone, signature behaviours, bilingual communication from §Dual Role Architecture)
- Communication style (language matching, response length, jargon policy from §Communication Style)
- Guardrails red lines (all prohibitions from §Guardrails)
- Edge case handling (admission prediction deflection, sibling comparison deflection from §Edge Cases)
- Key domain context from KNOWLEDGE.md (OC = 3 sections / Selective = 4 sections with Writing, skill taxonomy summary, error pattern types)
- Multi-child family child resolution rules from AGENTS.md §3
- Stage-awareness instructions from AGENTS.md §5

**Changes to request schema:**
- Add `stage` field (optional, `'oc_prep' | 'selective_prep'`)
- Add `familyId` field (optional string)
- Add `chineseName` and `nickname` fields to children array

**Changes to enriched prompt building:**
- Include `stage` and `chineseName`/`nickname` in family context injection
- Include stage-specific context: if `oc_prep`, mention "3 sections: Reading, Math, Thinking Skills"; if `selective_prep`, mention "4 sections: Reading, Math, Thinking Skills, Writing (25%)"
- Include child resolution rules: auto-select for single child, name matching (full/first/chinese/nickname) for multi-child, ask when ambiguous, context carryover
- Never expose `student_id` in responses — use names only

### Phase 3: Update `src/agents/student-tutor.ts` — New system prompt + stage + age-appropriate rules

**Changes to system prompt (`STUDENT_TUTOR_SYSTEM_PROMPT`):**
Replace the entire prompt with content derived from SOUL.md Student Agent Persona section. Include:
- Student Agent Persona (warm, patient, curious, encouraging — "like a favourite older sibling")
- Socratic Method rules (from §Teaching Philosophy): guide via questions, break pattern after 2+ failed attempts, use direct instruction when needed, then return to guided discovery
- Growth Mindset reinforcement ("not yet" > "wrong", celebrate effort, progress over perfection)
- Age-appropriate communication rules from §Age-Appropriate Communication:
  - Year 4 (OC Prep): short sentences, concrete examples, 2-3 step explanations, celebrate small wins, visual language
  - Year 6 (Selective Prep): slightly more sophisticated, abstract reasoning, meta-cognitive strategies, test strategy discussion, literary techniques for Writing
- Emotional intelligence: frustration detection and response (acknowledge → reduce stakes → scaffold → explain if still stuck)
- Meta-cognitive strategies (STAR method, elimination, time check, re-read rule, confidence marking, 30-second rule, visual anchoring)
- Stage-aware section knowledge:
  - OC: Reading (14Q/40min), Math (35Q/40min), Thinking (30Q/30min)
  - Selective: same + Writing (1Q/30min)
- Guardrails: only discuss loaded question, no off-topic, redirect if student goes off-track, never expose student IDs

**Changes to request schema:**
- Add `stage` field (optional, `'oc_prep' | 'selective_prep'`, default `'oc_prep'`)
- Add `studentName` field (optional string)

**Changes to enriched prompt building:**
- Include `stage` in context line
- If `stage === 'selective_prep'`, include Writing section awareness in context
- Include student name (if available) so agent uses it naturally
- Include age-appropriate mode based on stage (OC = Year 4, Selective = Year 6)

### Phase 4: Update `src/tools/memory-tools.ts` — New namespace patterns + metadata filtering

**Changes:**
- Update namespace patterns: replace flat `"parent-conversations"` / `"tutoring-sessions"` with hierarchical `/students/{studentId}/learning/` and `/families/{familyId}/insights/`
- Add a `filterByMetadata` helper function: takes an array of memory records and a metadata filter object, returns filtered records. Implements client-side post-retrieval filtering per MEMORY-DESIGN.md §5 note about AgentCore limitations.
- Update `retrieveMemories()` function to:
  1. Accept an optional `metadataFilter` parameter (stage, subject, skill, error_type)
  2. First filter by namespace (prefix match using new hierarchical patterns)
  3. Then apply `filterByMetadata()` on results
  4. Return results with metadata preserved
- Update `retrieveMemoriesTool` tool definition schema to include `metadataFilter` input
- Update mock data namespaces in `mock-data.ts` to use new patterns
- Update retrieval defaults: parent agent gets 20 max results (over-fetch for post-filter), student agent gets 15

### Phase 5: Update `src/guardrails/input-guardrail.ts` — Add off-topic + admission prediction blocking

**Changes:**
- Add admission prediction input detection: catch messages like "Will my child get in?", "What are the chances?", "Can she pass the OC test?" → redirect with the approved response from SOUL.md edge cases
- Add more educational keywords to improve off-topic detection accuracy (reduce false positives): add `'writing'`, `'oc test'`, `'selective test'`, `'spatial'`, `'inference'`, `'number pattern'`, `'comprehension'`, `'vocabulary'`, `'strategy'`, `'plan'`, `'week'`
- Add bilingual greeting support: messages like `'你好'`, `'hi'`, `'hello'` should NOT be blocked as off-topic

### Phase 6: Update `src/guardrails/output-guardrail.ts` — Add sibling comparison + student ID exposure

**Changes:**
- Add sibling comparison detection patterns: "your sister/brother", "compared to [name]", "{name} does better/worse than {name}", "unlike {name}" → violation type: `'sibling_comparison'`
- Add student ID exposure detection: regex for `student_id=`, `stu_`, `mock-student-`, any UUID-like pattern in response → violation type: `'student_id_exposure'`
- Add discouragement detection: "not ready for", "too difficult for", "won't be able to", "no chance" → violation type: `'discouragement'`
- Add data fabrication indicator: "I estimate", "approximately" without tool data context (lightweight heuristic) — defer to output review rather than hard-block

### Phase 7: Update mock-data.ts namespaces

- Change `"parent-conversations"` → `"/families/mock-family-001/insights/"`
- Change `"tutoring-sessions"` → `"/students/mock-student-001/learning/"`
- Add `stage` metadata to all records (e.g., `stage: "oc_prep"`)
- Add `subject` and `skill` metadata where applicable

### Phase 8: Verification

- Run `npx tsc --noEmit` in `edulens-agents-ts/`
- Verify all imports resolve
- Verify no new TypeScript errors
- Commit with descriptive message

## Dependencies Between Phases

```
Phase 1 (types) ← Phase 2, 3, 4 (all depend on new types)
Phase 4 (memory-tools) → Phase 7 (mock-data namespaces)
Phase 5, 6 (guardrails) are independent of each other
Phase 8 (verify) depends on all prior phases
```

## Estimated Complexity: MEDIUM-HIGH
- 5 files to modify, 1 file for type updates
- Most changes are prompt engineering + schema additions
- Memory tools need structural changes for metadata filtering
- Guardrails are additive (no breaking changes)
