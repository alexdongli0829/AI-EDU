-- ================================
-- Stage Mapping Implementation SQL
-- ================================

-- 1. 添加skill bridges基础数据
INSERT INTO skill_bridges (from_stage_id, from_skill, to_stage_id, to_skill, prior_weight) VALUES

-- OC to Selective mappings
('oc_prep', 'reading.inference', 'selective', 'reading.inference', 0.85),
('oc_prep', 'reading.vocabulary', 'selective', 'reading.vocabulary', 0.80),
('oc_prep', 'reading.main_idea', 'selective', 'reading.comprehension', 0.75),
('oc_prep', 'math.number_patterns', 'selective', 'math.algebra_basics', 0.70),
('oc_prep', 'math.fractions', 'selective', 'math.fractions_advanced', 0.85),
('oc_prep', 'math.word_problems', 'selective', 'math.multi_step_problems', 0.80),
('oc_prep', 'thinking.spatial', 'selective', 'thinking.spatial_advanced', 0.85),
('oc_prep', 'thinking.analogies', 'selective', 'thinking.verbal_reasoning', 0.75),

-- Selective to HSC mappings  
('selective', 'reading.inference', 'hsc', 'english.text_analysis', 0.70),
('selective', 'reading.comprehension', 'hsc', 'english.critical_reading', 0.75),
('selective', 'math.algebra_basics', 'hsc', 'math_advanced.algebra', 0.85),
('selective', 'math.fractions_advanced', 'hsc', 'math_advanced.functions', 0.70),
('selective', 'math.multi_step_problems', 'hsc', 'math_advanced.calculus_intro', 0.60),
('selective', 'writing.persuasive', 'hsc', 'english.essay_writing', 0.80),
('selective', 'writing.structure', 'hsc', 'english.text_construction', 0.85),

-- HSC to Lifelong mappings
('hsc', 'english.text_analysis', 'lifelong', 'critical_thinking.analysis', 0.75),
('hsc', 'math_advanced.calculus', 'lifelong', 'quantitative.advanced_math', 0.85),
('hsc', 'english.essay_writing', 'lifelong', 'communication.academic_writing', 0.80);

-- 2. 创建stage transition helper table
CREATE TABLE IF NOT EXISTS stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage_id TEXT NOT NULL,
  to_stage_id TEXT NOT NULL,
  typical_age_range INT[] NOT NULL, -- e.g., [10,11] for Year 5-6
  prerequisites JSONB, -- conditions that must be met
  auto_activate BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO stage_transitions (from_stage_id, to_stage_id, typical_age_range, prerequisites, auto_activate) VALUES
('oc_prep', 'selective', ARRAY[10,11], '{"min_mastery": 0.65, "required_skills": ["reading.inference", "math.fractions"]}', false),
('selective', 'hsc', ARRAY[15,16], '{"min_mastery": 0.70, "required_skills": ["math.algebra_basics", "reading.comprehension"]}', false),
('hsc', 'lifelong', ARRAY[17,18], '{"min_mastery": 0.60, "stage_completed": true}', false);

-- 3. 创建Core Layer profile template
CREATE TABLE IF NOT EXISTS core_profile_templates (
  version INT PRIMARY KEY,
  schema_definition JSONB NOT NULL,
  migration_rules JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO core_profile_templates (version, schema_definition) VALUES (3, '{
  "error_profile": {
    "lifetime_distribution": {
      "concept_gap": 0.0,
      "careless_error": 0.0, 
      "time_pressure": 0.0,
      "misread_question": 0.0,
      "elimination_failure": 0.0
    },
    "trend": "baseline",
    "notable_patterns": []
  },
  "time_behavior": {
    "pacing_style": "unknown",
    "rush_tendency": 0.5,
    "stamina_pattern": "unknown", 
    "completion_rate_avg": 1.0,
    "evolution": []
  },
  "confidence_estimate": {
    "calibration": "unknown",
    "answer_change_rate": 0.15,
    "risk_appetite": "moderate"
  },
  "learning_style": {
    "prefers_worked_examples": null,
    "responds_to_socratic": null,
    "persistence_on_hard_questions": "unknown",
    "derived_from_sessions": 0
  },
  "stage_evolution": {}
}');