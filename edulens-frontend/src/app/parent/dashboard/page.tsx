'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { studentAnalyticsService, StudentAnalytics } from '@/services/student-analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus, MessageCircle, Trash2, GraduationCap, Loader2,
  ChevronRight, CheckCircle2, Lock, Clock, BarChart2, X, ChevronDown,
} from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

// ─── types ────────────────────────────────────────────────────────────────────

interface StudentProfile {
  id: string; name: string; username: string;
  gradeLevel: number; dateOfBirth: string;
  testsCompleted: number;
}

interface StageEnrollment {
  stage_id: string; status: 'active' | 'completed' | 'paused';
  display_name: string; sort_order: number;
  activated_at?: string | null; completed_at?: string | null;
  stage_profile?: any;
}

// ─── canonical pathway metadata (shared with student dashboard) ───────────────

export const STAGES = [
  {
    id: 'oc_prep', label: 'OC Preparation', sublabel: 'Year 4–5',
    description: 'NSW Opportunity Class entrance exam preparation. Builds foundation skills in Mathematics, English comprehension, and General Ability.',
    targetExam: 'OC Placement Test',
    color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE',
    subjects: [
      { key: 'math' as const,     label: 'Mathematics',    color: '#2563EB' },
      { key: 'thinking' as const, label: 'General Ability', color: '#7C3AED' },
      { key: 'reading' as const,  label: 'English',         color: '#0D9488' },
    ],
  },
  {
    id: 'selective', label: 'Selective High School', sublabel: 'Year 6–7',
    description: 'NSW Selective High School Placement Test preparation. 4 papers: Mathematical Reasoning, Thinking Skills, Reading and Writing.',
    targetExam: 'Selective High School Placement Test',
    color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE',
    subjects: [
      { key: 'math'    as const, label: 'Mathematical Reasoning', color: '#2563EB' },
      { key: 'thinking'as const, label: 'Thinking Skills',        color: '#7C3AED' },
      { key: 'reading' as const, label: 'Reading',                color: '#0D9488' },
      { key: 'writing' as const, label: 'Writing',                color: '#EA580C' },
    ],
  },
  {
    id: 'hsc', label: 'HSC Preparation', sublabel: 'Year 11–12',
    description: 'Higher School Certificate preparation across all subject areas. ATAR-focused skill development.',
    targetExam: 'HSC Examinations',
    color: '#0D9488', light: '#F0FDFA', border: '#99F6E4',
    subjects: [
      { key: 'math' as const,     label: 'Mathematics',  color: '#2563EB' },
      { key: 'thinking' as const, label: 'Sciences',      color: '#7C3AED' },
      { key: 'reading' as const,  label: 'English',       color: '#0D9488' },
    ],
  },
  {
    id: 'lifelong', label: 'University & Beyond', sublabel: 'Tertiary',
    description: 'Tertiary study preparation and ongoing academic excellence. Learning DNA adapts to higher-order thinking.',
    targetExam: 'Tertiary Entrance',
    color: '#D97706', light: '#FFFBEB', border: '#FDE68A',
    subjects: [
      { key: 'math' as const,     label: 'Quantitative',      color: '#2563EB' },
      { key: 'thinking' as const, label: 'Critical Thinking',  color: '#7C3AED' },
      { key: 'reading' as const,  label: 'Literacy',           color: '#0D9488' },
    ],
  },
];

function parseProfile(raw: any) {
  if (!raw) return null;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return raw as { overall_mastery?: number; strengths?: string[]; weaknesses?: string[] };
}

// ─── SparkLine ────────────────────────────────────────────────────────────────

function SparkLine({ pts, color }: { pts: { score: number }[]; color: string }) {
  if (!pts.length) return null;
  const n = pts.length;
  const xS = 4, xE = 100, yT = 2, yB = 16;
  const xOf = (i: number) => n === 1 ? (xS + xE) / 2 : xS + i * (xE - xS) / (n - 1);
  const yOf = (s: number) => yB - (Math.min(100, Math.max(0, s)) / 100) * (yB - yT);
  const poly = pts.map((p, i) => `${xOf(i)},${yOf(p.score)}`).join(' ');
  const latest = pts[pts.length - 1].score;
  const sc = latest >= 75 ? '#16a34a' : latest >= 55 ? '#d97706' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox={`0 0 ${xE + 4} 18`} className="w-14 h-3.5 flex-shrink-0">
        <line x1="0" y1={yOf(70)} x2={xE + 4} y2={yOf(70)} stroke="#F3F4F6" strokeWidth="1" />
        {n > 1 && <polyline points={poly} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.map((p, i) => <circle key={i} cx={xOf(i)} cy={yOf(p.score)} r="1.5" fill={color} />)}
      </svg>
      <span className="text-[10px] font-bold tabular-nums" style={{ color: sc }}>{latest}%</span>
    </div>
  );
}

// ─── Inline journey roadmap ───────────────────────────────────────────────────

function JourneyRoadmap({ studentId, stages, stageAnalytics, onViewAnalytics }: {
  studentId: string;
  stages: StageEnrollment[];
  stageAnalytics: Record<string, StudentAnalytics>;
  onViewAnalytics: (stageId: string) => void;
}) {
  const enrolledMap = Object.fromEntries(stages.map(s => [s.stage_id, s]));
  // Non-active stages are collapsed by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-1.5">
      {STAGES.map((stage, idx) => {
        const enrolled = enrolledMap[stage.id];
        const isActive = enrolled?.status === 'active';
        const isCompleted = enrolled?.status === 'completed';
        const isLocked = !enrolled;
        const isLast = idx === STAGES.length - 1;
        const isExpanded = isActive || !!expanded[stage.id];
        const profile = parseProfile(enrolled?.stage_profile);
        const strengths = profile?.strengths ?? [];
        const weaknesses = profile?.weaknesses ?? [];
        const stageA = stageAnalytics[stage.id];
        const mastery = stageA && stageA.totalTests > 0
          ? (() => {
              const vals = [stageA.learningDNA.math, stageA.learningDNA.thinking, stageA.learningDNA.reading, ...(stageA.learningDNA.writing !== undefined ? [stageA.learningDNA.writing] : [])];
              return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) / 100;
            })()
          : profile?.overall_mastery ?? null;

        // ── Active stage: prominent highlighted card ──────────────────────────
        if (isActive) {
          return (
            <div key={stage.id} className="relative rounded-xl border-2 p-3" style={{ borderColor: stage.color, backgroundColor: stage.light }}>
              {/* Accent bar */}
              <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full" style={{ backgroundColor: stage.color }} />
              <div className="pl-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" style={{ color: stage.color }} />
                    <span className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</span>
                    <span className="text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: stage.color }}>Active</span>
                    <span className="text-[9px] text-gray-400 bg-white/70 px-1.5 py-0.5 rounded">{stage.sublabel}</span>
                  </div>
                </div>

                {/* Target exam */}
                <p className="text-[9px] mb-2" style={{ color: stage.color, opacity: 0.7 }}>{stage.targetExam}</p>

                {/* Mastery bar */}
                {mastery != null && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[9px] mb-0.5">
                      <span className="text-gray-500">Stage Mastery</span>
                      <span className="font-bold" style={{ color: stage.color }}>{Math.round(mastery * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/60 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: stage.color }} />
                    </div>
                  </div>
                )}

                {/* Strengths / weaknesses */}
                {(strengths.length > 0 || weaknesses.length > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    {strengths.length > 0 && (
                      <div>
                        <p className="text-emerald-600 font-semibold mb-0.5">Strengths</p>
                        <ul className="text-gray-500 space-y-px">{strengths.slice(0, 3).map((s: string) => <li key={s}>· {s}</li>)}</ul>
                      </div>
                    )}
                    {weaknesses.length > 0 && (
                      <div>
                        <p className="text-orange-500 font-semibold mb-0.5">Focus Areas</p>
                        <ul className="text-gray-500 space-y-px">{weaknesses.slice(0, 3).map((w: string) => <li key={w}>· {w}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Sparklines */}
                {stageA && stageA.totalTests > 0 && (
                  <div className="space-y-0.5 mb-2">
                    {stage.subjects.map(({ key, label, color }) => {
                      const pts = (stageA.scoreTrend as any)[key] ?? [];
                      if (!pts.length) return null;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold w-20 flex-shrink-0" style={{ color }}>{label}</span>
                          <SparkLine pts={pts} color={color} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {(!stageA || stageA.totalTests === 0) && mastery == null && (
                  <p className="text-[9px] text-gray-400 mb-2">No tests yet — complete a practice session to build this profile</p>
                )}

                {/* Analytics link */}
                <button onClick={() => onViewAnalytics(stage.id)} className="flex items-center gap-1 text-[9px] font-semibold hover:underline" style={{ color: stage.color }}>
                  <BarChart2 className="h-2.5 w-2.5" />View Analytics →
                </button>
              </div>
            </div>
          );
        }

        // ── Non-active stage: collapsible compact row ─────────────────────────
        return (
          <div key={stage.id} className="flex gap-2.5">
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                isCompleted ? 'bg-emerald-50 border-emerald-300 text-emerald-500' : 'bg-gray-50 border-gray-200 text-gray-300'
              }`}>
                {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <Lock className="h-2.5 w-2.5" />}
              </div>
              {!isLast && <div className="w-px flex-1 my-1 bg-gray-100" style={{ minHeight: 16 }} />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-2">
              {/* Clickable header row */}
              <button
                className="w-full flex items-center justify-between group"
                onClick={() => setExpanded(prev => ({ ...prev, [stage.id]: !prev[stage.id] }))}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: isLocked ? '#9CA3AF' : stage.color }}>{stage.label}</span>
                  <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">{stage.sublabel}</span>
                  {isCompleted && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Done</span>}
                  {enrolled && !isCompleted && <span className="text-[8px] text-gray-400">Paused</span>}
                </div>
                <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-[9px] text-gray-400">{stage.targetExam}</p>

                  {isLocked && <p className="text-[9px] text-gray-400 leading-relaxed">{stage.description}</p>}

                  {enrolled && (
                    <>
                      {enrolled.activated_at && (
                        <p className="text-[9px] text-gray-400">
                          Started {new Date(enrolled.activated_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                          {enrolled.completed_at && ` · Completed ${new Date(enrolled.completed_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}`}
                        </p>
                      )}
                      {mastery != null && (
                        <div>
                          <div className="flex justify-between text-[9px] mb-0.5">
                            <span className="text-gray-400">Stage Mastery</span>
                            <span className="font-bold" style={{ color: stage.color }}>{Math.round(mastery * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full" style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: stage.color }} />
                          </div>
                        </div>
                      )}
                      {(strengths.length > 0 || weaknesses.length > 0) && (
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          {strengths.length > 0 && (
                            <div>
                              <p className="text-emerald-600 font-semibold mb-0.5">Strengths</p>
                              <ul className="text-gray-500 space-y-px">{strengths.slice(0, 3).map((s: string) => <li key={s}>· {s}</li>)}</ul>
                            </div>
                          )}
                          {weaknesses.length > 0 && (
                            <div>
                              <p className="text-orange-500 font-semibold mb-0.5">Focus Areas</p>
                              <ul className="text-gray-500 space-y-px">{weaknesses.slice(0, 3).map((w: string) => <li key={w}>· {w}</li>)}</ul>
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={() => onViewAnalytics(stage.id)} className="flex items-center gap-1 text-[9px] font-semibold hover:underline" style={{ color: stage.color }}>
                        <BarChart2 className="h-2.5 w-2.5" />View Analytics →
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, StudentAnalytics>>({});
  // per-stage analytics: key = `${studentId}__${stageId}`
  const [stageAnalyticsMap, setStageAnalyticsMap] = useState<Record<string, StudentAnalytics>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState<Record<string, boolean>>({});
  const [stageMap, setStageMap] = useState<Record<string, StageEnrollment[]>>({});
  const [activatingMap, setActivatingMap] = useState<Record<string, string | null>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', gradeLevel: 4, dateOfBirth: '', username: '', password: '', initialStage: 'selective',
  });

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'parent') { router.push('/login'); return; }
    loadStudents();
  }, [isAuthenticated, user, router]);

  const loadStudents = async () => {
    if (!user?.id) return;
    setLoading(true); setError(null);
    try {
      const response = await apiClient.listStudents(user.id);
      if (response.success) {
        const list: StudentProfile[] = response.students;
        setStudents(list);
        const loadingState: Record<string, boolean> = {};
        list.forEach(s => { loadingState[s.id] = true; });
        setAnalyticsLoading(loadingState);

        list.forEach(s => {
          // Global analytics (for header stats + radar fallback)
          studentAnalyticsService.getStudentAnalytics(s.id)
            .then(a => setAnalyticsMap(prev => ({ ...prev, [s.id]: a })))
            .catch(() => {})
            .finally(() => setAnalyticsLoading(prev => ({ ...prev, [s.id]: false })));

          // Stages + per-stage analytics
          apiClient.listStudentStages(s.id)
            .then((res: any) => {
              const stageList: StageEnrollment[] = res.success ? (res.stages || []) : [];
              setStageMap(prev => ({ ...prev, [s.id]: stageList }));
              // Load analytics for each enrolled stage
              stageList.forEach((enr: StageEnrollment) => {
                studentAnalyticsService.getStudentAnalytics(s.id, enr.stage_id)
                  .then(a => setStageAnalyticsMap(prev => ({ ...prev, [`${s.id}__${enr.stage_id}`]: a })))
                  .catch(() => {});
              });
            })
            .catch(() => {});
        });
      }
    } catch {
      setError('Failed to load student profiles.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateStage = async (studentId: string, stageId: string) => {
    const meta = STAGES.find(s => s.id === stageId);
    if (!window.confirm(`Deactivate "${meta?.label ?? stageId}"?\nThe student's progress is saved and can be re-activated later.`)) return;
    setActivatingMap(prev => ({ ...prev, [studentId]: stageId }));
    try {
      await apiClient.deactivateStudentStage(studentId, stageId);
      const res = await apiClient.listStudentStages(studentId);
      if (res.success) setStageMap(prev => ({ ...prev, [studentId]: res.stages || [] }));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to deactivate stage');
    } finally {
      setActivatingMap(prev => ({ ...prev, [studentId]: null }));
    }
  };

  const handleActivateStage = async (studentId: string, stageId: string) => {
    const stages = stageMap[studentId] ?? [];
    const currentActive = stages.find(s => s.status === 'active');
    const meta = STAGES.find(s => s.id === stageId);
    if (currentActive && currentActive.stage_id !== stageId) {
      if (!window.confirm(`Switch to "${meta?.label ?? stageId}"? "${currentActive.display_name}" will be paused.`)) return;
    }
    setActivatingMap(prev => ({ ...prev, [studentId]: stageId }));
    try {
      await apiClient.activateStudentStage(studentId, stageId);
      const res = await apiClient.listStudentStages(studentId);
      if (res.success) setStageMap(prev => ({ ...prev, [studentId]: res.stages || [] }));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to activate stage');
    } finally {
      setActivatingMap(prev => ({ ...prev, [studentId]: null }));
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setCreating(true); setError(null);
    try {
      const response = await apiClient.createStudent({
        parentId: user.id, name: formData.name,
        username: formData.username.toLowerCase().replace(/\s/g, ''),
        password: formData.password, gradeLevel: formData.gradeLevel, dateOfBirth: formData.dateOfBirth,
      });
      if (response.success) {
        if (formData.initialStage) {
          try { await apiClient.activateStudentStage(response.student.id, formData.initialStage); } catch {}
        }
        await loadStudents();
        setFormData({ name: '', gradeLevel: 4, dateOfBirth: '', username: '', password: '', initialStage: 'selective' });
        setShowCreateForm(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create student profile.');
    } finally {
      setCreating(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const today = new Date(), birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() - birth.getMonth() < 0 ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-bold text-gray-900">Children's Overview</h1>
            <p className="text-xs text-gray-400">
              {students.length} profile{students.length !== 1 ? 's' : ''} · OC, Selective & HSC preparation
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => router.push('/parent/chat')} className="bg-teal-600 hover:bg-teal-700">
              <MessageCircle className="h-4 w-4 mr-1.5" />AI Advisor
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Add Child
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
            {error}
            <button onClick={() => setError(null)} className="underline ml-4">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : students.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-base font-semibold text-gray-700 mb-1">No student profiles yet</h3>
              <p className="text-sm text-gray-400 mb-5">Create a profile for your child to start their learning journey.</p>
              <Button onClick={() => setShowCreateForm(true)}><Plus className="h-4 w-4 mr-2" />Add First Child</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {students.map(student => {
              const a = analyticsMap[student.id];
              const isLoading = analyticsLoading[student.id];
              const stages = stageMap[student.id] ?? [];
              const activeStage = stages.find(s => s.status === 'active');
              const age = calculateAge(student.dateOfBirth);

              return (
                <Card key={student.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">

                    {/* ── Header ── */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900">{student.name}</p>
                            {activeStage && (
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: STAGES.find(s => s.id === activeStage.stage_id)?.color ?? '#6B7280' }}
                              >
                                {activeStage.display_name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            Grade {student.gradeLevel}{age != null ? ` · Age ${age}` : ''}
                            {a && a.totalTests > 0 && (
                              <span className="ml-2 text-gray-500">{a.totalTests} tests · {a.averageScore}% avg</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!user?.id || !confirm('Delete this profile? This cannot be undone.')) return;
                          try { await apiClient.deleteStudent(student.id, user.id); await loadStudents(); }
                          catch (err: any) { setError(err.response?.data?.error || 'Failed to delete.'); }
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* ── Stage switcher ── */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {STAGES.map(stage => {
                          const enr = stages.find(e => e.stage_id === stage.id);
                          const isActive = enr?.status === 'active';
                          const isActivating = activatingMap[student.id] === stage.id;
                          return (
                            <div key={stage.id} className="flex items-center">
                              <button
                                disabled={isActive || isActivating}
                                onClick={() => handleActivateStage(student.id, stage.id)}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 border transition-all hover:shadow-sm disabled:cursor-default"
                                style={{
                                  borderRadius: isActive ? '999px 0 0 999px' : '999px',
                                  borderRight: isActive ? 'none' : undefined,
                                  ...(isActive
                                    ? { backgroundColor: stage.color, borderColor: stage.color, color: '#fff' }
                                    : { borderColor: stage.color, color: stage.color, backgroundColor: 'transparent' }),
                                }}
                              >
                                {isActivating && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                                {stage.label}
                                {isActive && <span className="opacity-75 text-[8px] ml-0.5">· Active</span>}
                              </button>
                              {isActive && (
                                <button
                                  onClick={() => handleDeactivateStage(student.id, stage.id)}
                                  disabled={isActivating}
                                  title="Deactivate stage"
                                  className="flex items-center justify-center h-full px-1.5 py-1 border border-l-0 rounded-r-full transition-all hover:bg-red-50 hover:border-red-400 hover:text-red-500 disabled:opacity-50"
                                  style={{ borderColor: stage.color, color: stage.color }}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    {/* ── Radar chart (stage-specific, falls back to global) ── */}
                    {(() => {
                      const stageMeta = activeStage ? STAGES.find(s => s.id === activeStage.stage_id) : null;
                      const stageKey = activeStage ? `${student.id}__${activeStage.stage_id}` : null;
                      const stageA = stageKey ? stageAnalyticsMap[stageKey] : undefined;
                      // Use stage-filtered analytics if it has data, otherwise fall back to global
                      const radarData = (stageA && stageA.totalTests > 0) ? stageA : a;
                      if (!radarData || radarData.totalTests === 0) return null;
                      const radarColor = stageMeta?.color ?? '#0D9488';
                      const radarLabel = stageMeta ? `${stageMeta.label} Profile` : 'Learning Profile';
                      const subjects = stageMeta?.subjects ?? [
                        { key: 'math' as const,     label: 'Math' },
                        { key: 'thinking' as const, label: 'Thinking' },
                        { key: 'reading' as const,  label: 'English' },
                      ];
                      return (
                        <div className="mb-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wider mb-1" style={{ color: radarColor }}>
                            {radarLabel}
                          </p>
                          <div className="h-36">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={subjects.map(({ key, label }) => ({ subject: label, value: (radarData.learningDNA as any)[key] ?? 0 }))}>
                                <PolarGrid stroke="#e5e7eb" />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar dataKey="value" stroke={radarColor} fill={radarColor} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Inline Journey Roadmap ── */}
                    <div className="mb-4">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Learning Journey</p>
                      {isLoading ? (
                        <div className="flex items-center gap-2 py-3 text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">Loading…</span>
                        </div>
                      ) : (
                        <JourneyRoadmap
                          studentId={student.id}
                          stages={stages}
                          stageAnalytics={Object.fromEntries(
                            stages.map(enr => [enr.stage_id, stageAnalyticsMap[`${student.id}__${enr.stage_id}`]])
                              .filter(([, v]) => v != null)
                          )}
                          onViewAnalytics={(stageId) => router.push(`/parent/analytics/${student.id}?stage=${stageId}`)}
                        />
                      )}
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Student Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">Add Child Profile</h2>
              <p className="text-xs text-gray-400 mb-4">Create a profile for your child. They log in with username and password.</p>
              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Student Name</label>
                  <Input required placeholder="Full name" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Grade</label>
                    <select value={formData.gradeLevel}
                      onChange={e => setFormData({ ...formData, gradeLevel: parseInt(e.target.value) })}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                      {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>Grade {i + 1}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date of Birth</label>
                    <Input type="date" required value={formData.dateOfBirth}
                      onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Current Stage</label>
                  <select value={formData.initialStage}
                    onChange={e => setFormData({ ...formData, initialStage: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                    <option value="oc_prep">OC Prep (Year 4–5)</option>
                    <option value="selective">Selective (Year 6–7)</option>
                    <option value="hsc">HSC (Year 11–12)</option>
                    <option value="lifelong">Lifelong Learning</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Which stage is your child currently preparing for?</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Username</label>
                  <Input required placeholder="Student login username" value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Password</label>
                  <Input type="password" required placeholder="Student password" value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1"
                    onClick={() => { setShowCreateForm(false); setError(null); }}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={creating}>
                    {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Profile'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
