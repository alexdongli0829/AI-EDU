// =============================================================================
// EduLens — Student Isolation Cedar Policy
//
// Three-layer defence model, Layer 3 (defence in depth).
// Blocks cross-student and cross-family retrieve operations at the AgentCore
// policy layer, even if application-level config is misconfigured.
//
// Reference: agent-design/AGENTS.md §7, agent-design/MEMORY-DESIGN.md §9
// =============================================================================

// ---------------------------------------------------------------------------
// Rule 1: Students can only access their own learning namespace
// ---------------------------------------------------------------------------
permit (
  principal == AgentCore::Agent::"student_agent",
  action == AgentCore::Action::"Retrieve",
  resource
)
when {
  resource.namespace == "/students/" + context.actor_id.student_id + "/learning/"
};

// ---------------------------------------------------------------------------
// Rule 2: Parents can access their family's insights namespace
// ---------------------------------------------------------------------------
permit (
  principal == AgentCore::Agent::"parent_agent",
  action == AgentCore::Action::"Retrieve",
  resource
)
when {
  resource.namespace == "/families/" + context.actor_id.family_id + "/insights/"
};

// ---------------------------------------------------------------------------
// Rule 3: Parents can access their children's learning data
//         (child must be in the family roster)
// ---------------------------------------------------------------------------
permit (
  principal == AgentCore::Agent::"parent_agent",
  action == AgentCore::Action::"Retrieve",
  resource
)
when {
  resource.namespace.startsWith("/students/") &&
  context.family_roster.contains(resource.namespace.extractStudentId())
};

// ---------------------------------------------------------------------------
// Rule 4: Students can write events to their own session memory
// ---------------------------------------------------------------------------
permit (
  principal == AgentCore::Agent::"student_agent",
  action == AgentCore::Action::"CreateEvent",
  resource
)
when {
  resource.sessionActorId == context.actor_id.student_id
};

// ---------------------------------------------------------------------------
// Rule 5: Parents can write events to their own session memory
// ---------------------------------------------------------------------------
permit (
  principal == AgentCore::Agent::"parent_agent",
  action == AgentCore::Action::"CreateEvent",
  resource
)
when {
  resource.sessionActorId == context.actor_id.parent_id
};

// ---------------------------------------------------------------------------
// Default deny: block everything not explicitly permitted
// ---------------------------------------------------------------------------
forbid (principal, action, resource);
