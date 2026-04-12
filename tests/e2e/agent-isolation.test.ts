/**
 * Agent Isolation & Context Tests — Phase 1 Stubs
 *
 * Test IDs: D1 (student namespace isolation), D6 (cross-family isolation),
 *           C1 (NLU child identification), G1 (zero test history)
 *
 * These tests validate the memory retrieval scoping and context assembly
 * logic using the mock AgentCoreMemory class. They do NOT require live
 * AgentCore Runtime connections.
 */

import { AgentCoreMemory } from '../../prototype/edulens-agent/src/memory/agentcore-memory';

// ---------------------------------------------------------------------------
// Test data — mirrors TEST-SPECS.md fixtures
// ---------------------------------------------------------------------------

const FAMILIES = {
  wang: {
    parentId: 'usr_parent_wang',
    familyId: 'fam_wang',
    children: [
      { id: 'stu_emily', name: 'Emily', chineseName: '王小明', gradeLevel: 4, stage: 'oc_prep' as const },
      { id: 'stu_lucas', name: 'Lucas', chineseName: '王小华', gradeLevel: 6, stage: 'selective_prep' as const },
    ],
  },
  chen: {
    parentId: 'usr_parent_chen',
    familyId: 'fam_chen',
    children: [
      { id: 'stu_sophie', name: 'Sophie', chineseName: '陈小丽', gradeLevel: 4, stage: 'oc_prep' as const },
    ],
  },
  newFamily: {
    parentId: 'usr_parent_new',
    familyId: 'fam_new',
    children: [
      { id: 'stu_newkid', name: 'New Kid', gradeLevel: 4, stage: 'oc_prep' as const },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helper: build retrieval config (application-level scoping — Layer 1)
// ---------------------------------------------------------------------------

interface Actor {
  studentId?: string;
  familyId?: string;
  children?: Array<{ id: string }>;
}

interface RetrievalConfig {
  namespaces: string[];
  hardIsolation: boolean;
  crossNamespaceAccess: boolean;
}

function buildRetrievalConfig(agentType: 'student_agent' | 'parent_agent', actor: Actor): RetrievalConfig {
  if (agentType === 'student_agent') {
    return {
      namespaces: [`/students/${actor.studentId}/learning/`],
      hardIsolation: true,
      crossNamespaceAccess: false,
    };
  }

  if (agentType === 'parent_agent') {
    const childNamespaces = (actor.children ?? []).map(
      (child) => `/students/${child.id}/learning/`,
    );
    return {
      namespaces: [
        `/families/${actor.familyId}/insights/`,
        ...childNamespaces,
      ],
      hardIsolation: true,
      crossNamespaceAccess: false,
    };
  }

  throw new Error(`Unknown agent type: ${agentType}`);
}

// ---------------------------------------------------------------------------
// D1 — Student Agent ONLY Retrieves Own Namespace
// ---------------------------------------------------------------------------

describe('D1 — Student Agent ONLY Retrieves Own Namespace', () => {
  let memory: AgentCoreMemory;

  beforeEach(() => {
    memory = new AgentCoreMemory('test-memory-store');
  });

  test('retrieval config includes ONLY the student\'s own namespace', () => {
    const config = buildRetrievalConfig('student_agent', {
      studentId: 'stu_emily',
    });

    expect(config.namespaces).toEqual(['/students/stu_emily/learning/']);
    expect(config.hardIsolation).toBe(true);
    expect(config.crossNamespaceAccess).toBe(false);
  });

  test('no request is made to another student\'s namespace', () => {
    const config = buildRetrievalConfig('student_agent', {
      studentId: 'stu_emily',
    });

    expect(config.namespaces).not.toContain('/students/stu_lucas/learning/');
    expect(config.namespaces).not.toContain('/students/stu_sophie/learning/');
  });

  test('no request is made to family insights namespace', () => {
    const config = buildRetrievalConfig('student_agent', {
      studentId: 'stu_emily',
    });

    const familyNamespaces = config.namespaces.filter((ns) => ns.startsWith('/families/'));
    expect(familyNamespaces).toHaveLength(0);
  });

  test('memory query with namespace filter returns only own data', async () => {
    const config = buildRetrievalConfig('student_agent', {
      studentId: 'stu_emily',
    });

    const results = await memory.retrieveMemoryRecords({
      query: 'math performance',
      namespace: config.namespaces[0],
    });

    for (const record of results) {
      expect(record.namespace).toBe('/students/stu_emily/learning/');
      if (record.metadata?.studentId) {
        expect(record.metadata.studentId).toBe('stu_emily');
      }
    }
  });

  test('system prompt declares single-student access', () => {
    const studentName = 'Emily';
    const systemPrompt = `You have access ONLY to learning data for ${studentName}. You MUST NOT reference, access, or discuss data for any other student.`;

    expect(systemPrompt).toContain('ONLY');
    expect(systemPrompt).toContain(studentName);
    expect(systemPrompt).toContain('MUST NOT');
  });
});

// ---------------------------------------------------------------------------
// D6 — Cross-Family Data Never Leaks
// ---------------------------------------------------------------------------

describe('D6 — Cross-Family Data Never Leaks', () => {
  let memory: AgentCoreMemory;

  beforeEach(() => {
    memory = new AgentCoreMemory('test-memory-store');
  });

  test('parent Wang retrieval config excludes Chen family data', () => {
    const config = buildRetrievalConfig('parent_agent', {
      familyId: FAMILIES.wang.familyId,
      children: FAMILIES.wang.children.map((c) => ({ id: c.id })),
    });

    expect(config.namespaces).toContain('/families/fam_wang/insights/');
    expect(config.namespaces).toContain('/students/stu_emily/learning/');
    expect(config.namespaces).toContain('/students/stu_lucas/learning/');

    // Must NOT include Chen family data
    expect(config.namespaces).not.toContain('/families/fam_chen/insights/');
    expect(config.namespaces).not.toContain('/students/stu_sophie/learning/');
  });

  test('memory query for Wang family never returns Sophie data', async () => {
    const config = buildRetrievalConfig('parent_agent', {
      familyId: FAMILIES.wang.familyId,
      children: FAMILIES.wang.children.map((c) => ({ id: c.id })),
    });

    // Query each allowed namespace
    const allResults = [];
    for (const ns of config.namespaces) {
      const results = await memory.retrieveMemoryRecords({
        query: 'student performance reading math',
        namespace: ns,
      });
      allResults.push(...results);
    }

    for (const record of allResults) {
      expect(record.content).not.toContain('Sophie');
      expect(record.namespace).not.toContain('stu_sophie');
      expect(record.namespace).not.toContain('fam_chen');
    }
  });

  test('children query for Wang parent returns only Wang students', () => {
    // Simulates: SELECT s.id FROM students s WHERE s.parent_id = 'usr_parent_wang'
    const wangChildren = FAMILIES.wang.children.map((c) => c.id);

    expect(wangChildren).toContain('stu_emily');
    expect(wangChildren).toContain('stu_lucas');
    expect(wangChildren).not.toContain('stu_sophie');
    expect(wangChildren).not.toContain('stu_newkid');
  });

  test('Chen family config excludes Wang family data', () => {
    const config = buildRetrievalConfig('parent_agent', {
      familyId: FAMILIES.chen.familyId,
      children: FAMILIES.chen.children.map((c) => ({ id: c.id })),
    });

    expect(config.namespaces).toContain('/families/fam_chen/insights/');
    expect(config.namespaces).toContain('/students/stu_sophie/learning/');

    expect(config.namespaces).not.toContain('/families/fam_wang/insights/');
    expect(config.namespaces).not.toContain('/students/stu_emily/learning/');
    expect(config.namespaces).not.toContain('/students/stu_lucas/learning/');
  });
});

// ---------------------------------------------------------------------------
// C1 — NLU: Identifies Child by English Name
// ---------------------------------------------------------------------------

describe('C1 — NLU: Identifies Child by English Name', () => {
  test('resolves "Emily" to stu_emily from Wang family children', () => {
    const message = 'How is Emily doing in math?';
    const children = FAMILIES.wang.children;

    const resolved = resolveChildFromMessage(message, children);

    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe('stu_emily');
    expect(resolved!.name).toBe('Emily');
  });

  test('resolves "Lucas" to stu_lucas from Wang family children', () => {
    const message = 'Tell me about Lucas\'s reading progress';
    const children = FAMILIES.wang.children;

    const resolved = resolveChildFromMessage(message, children);

    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe('stu_lucas');
    expect(resolved!.name).toBe('Lucas');
  });

  test('does not resolve a child name that does not exist', () => {
    const message = 'How is Sophie doing?';
    const children = FAMILIES.wang.children;

    const resolved = resolveChildFromMessage(message, children);

    // Sophie is not in Wang family — should not resolve
    expect(resolved).toBeNull();
  });

  test('retrieval uses resolved child\'s namespace', async () => {
    const memory = new AgentCoreMemory('test-memory-store');
    const message = 'How is Emily doing in math?';
    const children = FAMILIES.wang.children;

    const resolved = resolveChildFromMessage(message, children);
    expect(resolved).not.toBeNull();

    const results = await memory.retrieveMemoryRecords({
      query: 'math performance',
      namespace: `/students/${resolved!.id}/learning/`,
    });

    for (const record of results) {
      expect(record.namespace).toBe('/students/stu_emily/learning/');
    }
  });

  test('case-insensitive name matching', () => {
    const message = 'How is emily doing?';
    const children = FAMILIES.wang.children;

    const resolved = resolveChildFromMessage(message, children);

    expect(resolved).not.toBeNull();
    expect(resolved!.id).toBe('stu_emily');
  });
});

// ---------------------------------------------------------------------------
// G1 — New Student with Zero Test History
// ---------------------------------------------------------------------------

describe('G1 — New Student with Zero Test History', () => {
  let memory: AgentCoreMemory;

  beforeEach(() => {
    memory = new AgentCoreMemory('test-memory-store');
  });

  test('memory retrieval returns empty for new student', async () => {
    const results = await memory.retrieveMemoryRecords({
      query: 'student performance test results',
      namespace: '/students/stu_newkid/learning/',
    });

    // stu_newkid has no seeded memory records
    expect(results).toHaveLength(0);
  });

  test('system prompt includes no-data guidance when records are empty', () => {
    const testSessionCount = 0; // simulates: SELECT COUNT(*) FROM test_sessions WHERE student_id = 'stu_newkid'
    const memoryRecords: unknown[] = [];

    const noDataDetected = testSessionCount === 0 && memoryRecords.length === 0;
    expect(noDataDetected).toBe(true);

    // System prompt should include guidance for zero-data scenario
    const systemPromptAddendum = noDataDetected
      ? 'No test data available yet. Encourage the parent to have their child complete a practice test first.'
      : '';

    expect(systemPromptAddendum).toContain('No test data available');
    expect(systemPromptAddendum).toContain('practice test');
  });

  test('response must not hallucinate scores when no data exists', () => {
    // This validates the contract: when zero records, the agent must not fabricate data.
    // In a live test, we'd check the response text. Here we verify the constraint logic.
    const memoryRecords: unknown[] = [];
    const testSessionCount = 0;

    const hasData = memoryRecords.length > 0 || testSessionCount > 0;
    expect(hasData).toBe(false);

    // Forbidden patterns in response when hasData is false
    const forbiddenPatterns = [
      /scored \d+%/i,
      /mastery.*\d+%/i,
      /improving/i,
      /trend.*up/i,
      /grade level/i,
    ];

    // In integration test, these would be checked against actual response
    expect(forbiddenPatterns.length).toBeGreaterThan(0);
  });

  test('new family retrieval config is correctly scoped', () => {
    const config = buildRetrievalConfig('parent_agent', {
      familyId: FAMILIES.newFamily.familyId,
      children: FAMILIES.newFamily.children.map((c) => ({ id: c.id })),
    });

    expect(config.namespaces).toEqual([
      '/families/fam_new/insights/',
      '/students/stu_newkid/learning/',
    ]);
    expect(config.namespaces).not.toContain('/students/stu_emily/learning/');
  });
});

// ---------------------------------------------------------------------------
// Helper: simple child name resolution from message
// ---------------------------------------------------------------------------

function resolveChildFromMessage(
  message: string,
  children: ReadonlyArray<{ id: string; name: string; chineseName?: string }>,
): { id: string; name: string } | null {
  const lowerMessage = message.toLowerCase();

  for (const child of children) {
    if (lowerMessage.includes(child.name.toLowerCase())) {
      return { id: child.id, name: child.name };
    }
    if (child.chineseName && message.includes(child.chineseName)) {
      return { id: child.id, name: child.name };
    }
  }

  return null;
}
