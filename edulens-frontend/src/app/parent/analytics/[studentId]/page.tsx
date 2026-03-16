'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { studentAnalyticsService, StudentAnalytics, SkillEntry } from '@/services/student-analytics';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  Clock,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Calculator,
  Lightbulb,
  BookOpen,
  PenLine,
  Lock,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

// ─── Academic chart palette (Oxford Navy × Gold) ─────────────────────────────
const NAVY      = '#1C3557';
const NAVY_MID  = '#254773';
const GOLD      = '#B8860B';
const GOLD_BRIGHT = '#D4A017';
const PARCHMENT_MID = '#EDE7D9';

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: NAVY,
    border: `1px solid ${GOLD}`,
    borderRadius: '4px',
    fontSize: 11,
    color: GOLD_BRIGHT,
    fontFamily: "'Source Sans 3', sans-serif",
    padding: '4px 10px',
  },
  itemStyle:  { color: GOLD_BRIGHT },
  labelStyle: { color: '#e8edf4', fontWeight: 600 as const },
};

// ─── Insights types ───────────────────────────────────────────────────────────

interface SubjectInsight {
  subject: 'math' | 'general_ability' | 'english';
  trend: 'improving' | 'declining' | 'stable';
  trendDelta: number;
  currentStatus: string;
  strongSkills: string[];
  weakSkills: string[];
  dailyProgress: string;
  improvements: string[];
  nextSteps: string[];
}

interface StudentInsights {
  studentId: string;
  generatedAt: string;
  totalTests: number;
  overallSummary: string;
  subjects: SubjectInsight[];
}

// Stage-specific subject label mapping
const STAGE_SUBJECT_LABELS: Record<string, {
  math: string; general_ability: string; english: string; writing?: string;
}> = {
  oc_prep:   { math: 'Mathematical Reasoning', general_ability: 'Thinking Skills',   english: 'English Reading'                     },
  selective: { math: 'Mathematical Reasoning', general_ability: 'Thinking Skills',   english: 'Reading',         writing: 'Writing' },
  hsc:       { math: 'Mathematics',            general_ability: 'Sciences',          english: 'English'                             },
  lifelong:  { math: 'Quantitative Reasoning', general_ability: 'Critical Thinking', english: 'Literacy'                            },
};
const DEFAULT_SUBJECT_LABELS = STAGE_SUBJECT_LABELS.oc_prep;

function buildSubjectUI(stageId: string | null | undefined) {
  const labels = (stageId && STAGE_SUBJECT_LABELS[stageId]) ? STAGE_SUBJECT_LABELS[stageId] : DEFAULT_SUBJECT_LABELS;
  return {
    math:            { label: labels.math,            color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE', bg: 'bg-blue-50',    icon: Calculator },
    general_ability: { label: labels.general_ability, color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE', bg: 'bg-purple-50',  icon: Lightbulb  },
    english:         { label: labels.english,         color: '#0D9488', light: '#F0FDFA', border: '#99F6E4', bg: 'bg-teal-50',    icon: BookOpen   },
    ...(labels.writing ? {
      writing: { label: labels.writing, color: '#EA580C', light: '#FFF7ED', border: '#FED7AA', bg: 'bg-orange-50', icon: PenLine },
    } : {}),
  };
}

interface StudentInfo {
  id: string;
  name: string;
  gradeLevel: number;
  dateOfBirth: string;
  username: string;
  testsCompleted: number;
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  oc_prep:   { label: 'OC Preparation',      color: '#2563EB' },
  selective: { label: 'Selective High School',color: '#7C3AED' },
  hsc:       { label: 'HSC Preparation',      color: '#0D9488' },
  lifelong:  { label: 'University & Beyond',  color: '#D97706' },
};

function ParentStudentAnalyticsInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stageParam = searchParams.get('stage'); // stage focus passed from dashboard
  const { t } = useI18n();
  const studentId = params.studentId as string;

  const { user } = useAuthStore();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [insights, setInsights] = useState<StudentInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsRegenerating, setInsightsRegenerating] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<{ stage_id: string; display_name: string } | null>(null);
  // Maps stageId → enrollment status for the viewed student
  const [stageStatusMap, setStageStatusMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return; // wait for Zustand to hydrate from localStorage
    loadStudentData();
  }, [studentId, stageParam, user?.id]);

  // Load insights independently; skip entirely if the viewed stage is not active
  useEffect(() => {
    if (!user) return;
    setInsights(null);
    // If a specific stage is being viewed and it is not currently active, skip the fetch
    if (stageParam && stageStatusMap[stageParam] && stageStatusMap[stageParam] !== 'active') {
      setInsightsLoading(false);
      return;
    }
    loadInsights(false);
  }, [studentId, stageParam, stageStatusMap, user?.id]);

  const loadStudentData = async () => {
    setLoading(true);
    setAnalytics(null);
    setInsights(null);
    try {
      if (user?.id) {
        const response = await apiClient.listStudents(user.id);
        if (response.success) {
          const foundStudent = response.students.find((s: any) => s.id === studentId);
          if (!foundStudent) { router.push('/parent/dashboard'); return; }
          setStudent(foundStudent);
        }
      }
      // Load all enrolled stages and derive the active one
      const stagesRes = await apiClient.listStudentStages(studentId).catch(() => null);
      if (stagesRes?.success) {
        const stageList: any[] = stagesRes.stages ?? [];
        const active = stageList.find((s: any) => s.status === 'active') ?? null;
        setActiveStage(active);
        // Build a map of stageId → status for quick lookup
        const statusMap: Record<string, string> = {};
        stageList.forEach((s: any) => { statusMap[s.stage_id] = s.status; });
        setStageStatusMap(statusMap);
      }
      const studentAnalytics = await studentAnalyticsService.getStudentAnalytics(studentId, stageParam ?? undefined);
      setAnalytics(studentAnalytics);
    } catch (error) {
      console.error('Failed to load student analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async (forceRefresh: boolean) => {
    setInsightsLoading(true);
    setInsightsError(null);
    const stage = stageParam ?? undefined;
    try {
      const res = forceRefresh
        ? await apiClient.regenerateStudentInsights(studentId, stage)
        : await apiClient.getStudentInsights(studentId, stage);
      if (res.success && res.insights) {
        const insightsData = typeof res.insights === 'string' ? JSON.parse(res.insights) : res.insights;
        setInsights({ subjects: [], ...insightsData });
        // If stale, kick off background regeneration
        if (!forceRefresh && res.stale) {
          apiClient.regenerateStudentInsights(studentId, stage).then((fresh) => {
            if (fresh.success && fresh.insights) {
              const freshData = typeof fresh.insights === 'string' ? JSON.parse(fresh.insights) : fresh.insights;
              setInsights({ subjects: [], ...freshData });
            }
          }).catch(() => {});
        }
      } else if (res.reason === 'no_tests') {
        // no sessions for this stage yet — not an error
      } else if (!res.insights) {
        setInsightsError('Insights could not be generated. Please try again.');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to generate insights';
      setInsightsError(`Generation failed: ${msg}`);
    } finally {
      setInsightsLoading(false);
      setInsightsRegenerating(false);
    }
  };

  const handleRegenerateInsights = () => {
    if (stageParam && stageStatusMap[stageParam] && stageStatusMap[stageParam] !== 'active') return;
    setInsightsRegenerating(true);
    setInsightsLoading(true);
    loadInsights(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
          <h3 className="text-lg font-semibold mb-2">Loading Analytics</h3>
          <p className="text-muted-foreground">Analyzing your child's learning data...</p>
        </div>
      </div>
    );
  }

  if (!student) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    </div>
  );

  const effectiveStageId = stageParam ?? activeStage?.stage_id ?? null;
  // When viewing a specific stage, AI features are only available if that stage is active
  const isViewedStageActive = stageParam
    ? stageStatusMap[stageParam] === 'active'
    : true; // no stage filter = global view, always allow
  const subjectUI = buildSubjectUI(effectiveStageId);

  // Derived arrays used in Skill Analysis, Error Analysis, and Recent Tests
  const dnaSubjects = [
    { key: 'math'     as const, ...subjectUI.math     },
    { key: 'thinking' as const, ...subjectUI.general_ability },
    { key: 'reading'  as const, ...subjectUI.english  },
    ...(subjectUI.writing ? [{ key: 'writing' as const, ...subjectUI.writing }] : []),
  ];
  const backendSubjects = [
    { subjectKey: 'math'            as const, ...subjectUI.math            },
    { subjectKey: 'general_ability' as const, ...subjectUI.general_ability },
    { subjectKey: 'english'         as const, ...subjectUI.english         },
    ...(subjectUI.writing ? [{ subjectKey: 'writing' as const, ...subjectUI.writing }] : []),
  ];

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{
        backgroundColor: '#F6F2EB',
        fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Page title row */}
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
               style={{ backgroundColor: '#E8EDF4', color: NAVY, fontFamily: 'var(--font-heading)' }}>
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{t.analytics.learningAnalytics(student.name)}</h1>
            <p className="text-xs text-gray-500">
              {t.common.grade} {student.gradeLevel} · {t.analytics.parentView} · {analytics?.totalTests || 0} {t.common.testsCompleted.toLowerCase()}
              {(stageParam ? STAGE_META[stageParam] : activeStage ? STAGE_META[activeStage.stage_id] : null) && (
                <span className="ml-2 font-semibold" style={{ color: (stageParam ? STAGE_META[stageParam] : STAGE_META[activeStage!.stage_id])?.color }}>
                  · {(stageParam ? STAGE_META[stageParam] : STAGE_META[activeStage!.stage_id])?.label}
                </span>
              )}
            </p>
          </div>
        </div>
        {isViewedStageActive ? (
          <Button
            size="sm"
            onClick={() => router.push(`/parent/chat?studentId=${studentId}`)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            AI Advisor
          </Button>
        ) : (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
            style={{ background: '#F5EDD0', color: '#9CA3AF', border: '1px solid #EDE7D9' }}
            title="AI Advisor is only available for the active stage"
          >
            <Lock className="h-3.5 w-3.5" />
            AI Advisor
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
          <button
            onClick={() => router.push(`/parent/analytics/${studentId}`)}
            className="px-4 py-2 text-sm font-medium rounded-md bg-teal-600 text-white transition-colors"
          >
            <TrendingUp className="h-4 w-4 inline mr-2" />
            Performance Overview
          </button>
          <button
            onClick={() => {
              const stage = stageParam ?? activeStage?.stage_id;
              router.push(`/parent/students/${studentId}/error-analysis${stage ? `?stage=${stage}` : ''}`);
            }}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <AlertCircle className="h-4 w-4 inline mr-2" />
            Error Analysis
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Target,    value: analytics?.totalTests || 0,        label: t.common.testsCompleted, accent: NAVY },
            { icon: TrendingUp,value: `${analytics?.averageScore || 0}%`,label: t.common.averageScore,   accent: '#2A5C45' },
            { icon: Clock,     value: analytics?.lastTestDate || t.common.noDataYet, label: t.common.lastActivity, accent: NAVY_MID },
            { icon: Brain,     value: analytics
                ? [analytics.skillBreakdown.math, analytics.skillBreakdown.thinking, analytics.skillBreakdown.reading]
                    .flat().filter(s => s.total > 0).length
                : 0,                                                     label: t.common.skillsAssessed, accent: '#7C3AED' },
          ].map(({ icon: Icon, value, label, accent }) => (
            <Card key={label} style={{ borderTop: `3px solid ${accent}` }}>
              <CardContent className="p-4 text-center">
                <Icon className="h-7 w-7 mx-auto mb-2" style={{ color: accent }} />
                <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>
                  {value}
                </div>
                <p className="text-sm" style={{ color: NAVY_MID, opacity: 0.7 }}>{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── AI Performance Insights ── */}
        <div className="mb-6">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: isViewedStageActive ? GOLD : '#9CA3AF' }} />
              <h2 className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: isViewedStageActive ? NAVY : '#9CA3AF' }}>{t.analytics.aiInsights}</h2>
              {isViewedStageActive && insights && (
                <span className="text-[10px] text-gray-400">
                  · Updated {new Date(insights.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            {isViewedStageActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerateInsights}
                disabled={insightsRegenerating || insightsLoading}
                className="h-7 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${insightsRegenerating ? 'animate-spin' : ''}`} />
                {insightsRegenerating ? t.analytics.analysing : t.analytics.refresh}
              </Button>
            )}
          </div>

          {/* Inactive stage notice — replaces the whole insights body */}
          {!isViewedStageActive ? (
            <Card style={{ border: '1px solid #EDE7D9', background: '#FDFBF7' }}>
              <CardContent className="py-10 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#F5EDD0' }}>
                  <Lock className="h-5 w-5" style={{ color: '#9CA3AF' }} />
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: NAVY, fontFamily: 'var(--font-heading)' }}>
                  Stage Not Active
                </p>
                <p className="text-xs" style={{ color: '#6B7280', maxWidth: '320px', margin: '0 auto' }}>
                  AI Performance Insights and the AI Advisor are only available for the student's currently active stage.
                  {stageParam && STAGE_META[stageParam] && (
                    <> Activate <strong>{STAGE_META[stageParam].label}</strong> on the dashboard to unlock these features.</>
                  )}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {isViewedStageActive && (<>

          {insightsLoading ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-teal-600" />
                <p className="text-sm text-gray-500">
                  {insightsRegenerating ? t.analytics.regenerating : t.analytics.generatingInsights}
                </p>
                <p className="text-xs text-gray-400 mt-1">{t.analytics.takesTime}</p>
              </CardContent>
            </Card>
          ) : !insights ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-10 text-center">
                <Brain className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                {insightsError ? (
                  <>
                    <p className="text-sm text-red-500 mb-1">{t.analytics.generationFailed}</p>
                    <p className="text-xs text-gray-400 mb-4">{insightsError}</p>
                    <Button size="sm" onClick={handleRegenerateInsights} className="bg-teal-600 hover:bg-teal-700">
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Retry
                    </Button>
                  </>
                ) : analytics && analytics.totalTests > 0 ? (
                  <>
                    <p className="text-sm text-gray-500 mb-4">
                      No AI insights yet for this student.
                    </p>
                    <Button size="sm" onClick={handleRegenerateInsights} className="bg-teal-600 hover:bg-teal-700">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Generate Insights Now
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">
                    No test data yet. Insights will appear after the first practice test.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Overall summary */}
              {insights.overallSummary && (
                <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: '#F5EDD0', borderLeft: `4px solid ${GOLD}`, color: NAVY }}>
                  {insights.overallSummary}
                </div>
              )}

              {/* Per-subject cards */}
              <div className={`grid grid-cols-1 gap-4 ${(insights.subjects ?? []).length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                {(insights.subjects ?? []).map(sub => {
                  const ui = subjectUI[sub.subject as keyof typeof subjectUI];
                  if (!ui) return null;
                  const Icon = ui.icon;
                  const trendIcon =
                    sub.trend === 'improving' ? <TrendingUp className="h-3.5 w-3.5 text-green-600" /> :
                    sub.trend === 'declining' ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> :
                    <Minus className="h-3.5 w-3.5 text-gray-400" />;
                  const trendLabel =
                    sub.trend === 'improving' ? `+${sub.trendDelta}% improving` :
                    sub.trend === 'declining' ? `${sub.trendDelta}% declining` :
                    'Stable';
                  const trendColor =
                    sub.trend === 'improving' ? 'text-green-600' :
                    sub.trend === 'declining' ? 'text-red-500' : 'text-gray-500';

                  return (
                    <Card key={sub.subject} className="border shadow-sm" style={{ borderColor: ui.border }}>
                      <CardContent className="p-4">
                        {/* Subject header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: ui.color }}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-xs font-bold" style={{ color: ui.color }}>{ui.label}</span>
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-semibold ${trendColor}`}>
                            {trendIcon}
                            <span>{trendLabel}</span>
                          </div>
                        </div>

                        {/* Current status */}
                        <p className="text-xs text-gray-600 mb-3 leading-relaxed">{sub.currentStatus}</p>

                        {/* Day-by-day progress */}
                        {sub.dailyProgress && (
                          <div className="mb-3 px-2.5 py-2 rounded-md text-xs text-gray-600" style={{ backgroundColor: ui.light }}>
                            <span className="font-semibold" style={{ color: ui.color }}>Progress: </span>
                            {sub.dailyProgress}
                          </div>
                        )}

                        {/* Strong & Weak skills */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {sub.strongSkills.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Strong</p>
                              {sub.strongSkills.map(s => (
                                <div key={s} className="flex items-start gap-1 mb-0.5">
                                  <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-xs text-gray-700 leading-tight">{s}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {sub.weakSkills.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Needs Work</p>
                              {sub.weakSkills.map(s => (
                                <div key={s} className="flex items-start gap-1 mb-0.5">
                                  <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-xs text-gray-700 leading-tight">{s}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Improvements */}
                        {sub.improvements.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Improvement Areas</p>
                            {sub.improvements.map((imp, i) => (
                              <p key={i} className="text-xs text-gray-600 mb-0.5 pl-2 border-l-2" style={{ borderColor: ui.color }}>
                                {imp}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Next steps */}
                        {sub.nextSteps.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Next Steps</p>
                            {sub.nextSteps.map((step, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-1">
                                <ArrowRight className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: ui.color }} />
                                <span className="text-xs text-gray-700 leading-snug">{step}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Chat CTA */}
              <Button
                onClick={() => router.push(`/parent/chat?studentId=${studentId}`)}
                className="w-full bg-teal-600 hover:bg-teal-700"
                size="sm"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Discuss This Analysis with AI Advisor
              </Button>
            </div>
          )}
          </>)}
        </div>

        {/* Detailed Skill Analysis — OC-aligned 3-subject breakdown */}
        {analytics && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>{t.analytics.detailedSkill}</CardTitle>
                <span className="text-xs font-normal" style={{ color: NAVY_MID, opacity: 0.6 }}>{t.analytics.last3Months}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {dnaSubjects.map(({ key, label, color, bg }) => {
                const skills: SkillEntry[] = analytics.skillBreakdown[key] ?? [];
                const practiced = skills.filter(s => s.total > 0);
                const trendData = analytics.monthTrend[key] ?? [];
                return (
                  <div key={key}>
                    <div className={`flex items-center justify-between px-3 py-2 rounded-md mb-3 ${bg}`}
                         style={{ borderLeft: `3px solid ${color}` }}>
                      <span className="text-sm font-bold" style={{ color, fontFamily: 'var(--font-heading)' }}>{label}</span>
                      {practiced.length === 0 && (
                        <span className="text-xs text-gray-400">{t.analytics.noTestsCompleted}</span>
                      )}
                    </div>
                    {/* 30-day subject trend line */}
                    {trendData.length >= 2 ? (
                      <div className="mb-4">
                        <div className="text-xs text-gray-400 mb-1">{t.analytics.scoreTrendRecent}</div>
                        <div className="h-28">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={PARCHMENT_MID} />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: NAVY_MID }} tickLine={false} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: NAVY_MID }} tickLine={false} axisLine={false} />
                              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Score']} />
                              <ReferenceLine y={70} stroke={GOLD} strokeDasharray="4 2" label={{ value: '70%', fontSize: 9, fill: GOLD, position: 'right' }} />
                              <Line
                                type="monotone"
                                dataKey="score"
                                stroke={color}
                                strokeWidth={2}
                                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                                activeDot={{ r: 4 }}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : trendData.length === 1 ? (
                      <div className="mb-3 text-xs text-gray-400">
                        1 test recorded — {trendData[0].date}: {trendData[0].score}%
                      </div>
                    ) : (
                      <div className="mb-3 text-xs text-gray-400">No tests recorded yet</div>
                    )}
                    {/* Radar chart — skill profile for this subject */}
                    {practiced.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs text-gray-400 mb-1">{t.analytics.skillProfile}</div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={skills.map(s => ({ skill: s.skill, value: s.total > 0 ? s.percentage : 0 }))}>
                              <PolarGrid stroke={PARCHMENT_MID} />
                              <PolarAngleAxis
                                dataKey="skill"
                                tick={{ fontSize: 10, fill: NAVY }}
                              />
                              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                              <Radar
                                dataKey="value"
                                stroke={color}
                                fill={color}
                                fillOpacity={0.2}
                                strokeWidth={2}
                                isAnimationActive={false}
                              />
                              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Score']} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {skills.map((skill, i) => {
                        const trendUp   = skill.trend === 'up';
                        const trendDown = skill.trend === 'down';
                        const TrendIcon = trendUp ? TrendingUp : trendDown ? TrendingDown : Minus;
                        const trendColor  = trendUp ? 'text-green-600'  : trendDown ? 'text-red-500'  : 'text-gray-400';
                        const trendBg     = trendUp ? 'bg-green-50'     : trendDown ? 'bg-red-50'     : 'bg-gray-50';
                        const trendBorder = trendUp ? 'border-green-200': trendDown ? 'border-red-200': 'border-gray-200';
                        const trendLabel  = trendUp ? t.analytics.improving : trendDown ? t.analytics.declining : t.analytics.stable;
                        const lineColor   = trendUp ? '#16a34a'         : trendDown ? '#ef4444'       : '#9ca3af';
                        return (
                          <div key={i} className={`p-3 rounded-lg ${skill.total === 0 ? 'opacity-50' : ''}`}
                               style={{ border: `1px solid ${PARCHMENT_MID}`, backgroundColor: '#FDFBF7' }}>
                            {/* Trend badge — primary indicator */}
                            <div className="flex items-center justify-between mb-2">
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${trendBg}`}>
                                <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                                <span className={`text-xs font-semibold ${trendColor}`}>{trendLabel}</span>
                              </div>
                              <span className="text-sm font-bold" style={{
                                fontFamily: 'var(--font-heading)',
                                color: skill.total === 0 ? '#d1d5db' : skill.percentage >= 70 ? '#2A5C45' : skill.percentage >= 50 ? '#B8860B' : '#8B1A1A',
                              }}>
                                {skill.total > 0 ? `${skill.percentage}%` : '—'}
                              </span>
                            </div>
                            {/* Skill name */}
                            <div className="text-xs font-semibold text-gray-700 mb-1.5">{skill.skill}</div>
                            {/* Sparkline — history data points */}
                            {skill.history.length >= 2 ? (
                              <div className="h-10 mb-1.5">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={skill.history} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                    <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Score']} labelFormatter={(l: string) => l} />
                                    <Line
                                      type="monotone"
                                      dataKey="percentage"
                                      stroke={lineColor}
                                      strokeWidth={1.5}
                                      dot={{ r: 2, fill: lineColor }}
                                      activeDot={{ r: 3 }}
                                      isAnimationActive={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : skill.history.length === 1 ? (
                              <div className="text-xs text-gray-400 mb-1.5">1 session recorded</div>
                            ) : null}
                            {/* Progress bar — current score */}
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: PARCHMENT_MID }}>
                              {skill.total > 0 && (
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${skill.percentage}%`,
                                    backgroundColor: skill.percentage >= 70 ? '#2A5C45' : skill.percentage >= 50 ? GOLD : '#8B1A1A',
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* ── Error Analysis by Subject ── */}
        {analytics && (analytics.errorAnalysis.math.total > 0 || analytics.errorAnalysis.thinking.total > 0 || analytics.errorAnalysis.reading.total > 0 || (analytics.errorAnalysis.writing?.total ?? 0) > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>{t.analytics.errorAnalysis}</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                {t.analytics.errorAnalysisDesc}
              </p>
            </CardHeader>
            <CardContent>
              <div className={`grid grid-cols-1 gap-6 ${dnaSubjects.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
                {dnaSubjects.map(({ key, label, color, bg }) => {
                  const err = analytics.errorAnalysis[key] ?? { total: 0, careless: 0, timePressure: 0, conceptGap: 0, other: 0 };
                  if (err.total === 0) return (
                    <div key={key}>
                      <div className={`px-3 py-1.5 rounded-md mb-3 ${bg}`} style={{ borderLeft: `3px solid ${color}` }}>
                        <span className="text-xs font-bold" style={{ color, fontFamily: 'var(--font-heading)' }}>{label}</span>
                      </div>
                      <p className="text-xs px-1" style={{ color: NAVY_MID, opacity: 0.6 }}>{t.analytics.noErrorsYet}</p>
                    </div>
                  );
                  const items = [
                    { label: t.analytics.carelessError, count: err.careless, color: '#F59E0B', bg: 'bg-amber-50', desc: t.analytics.carelessDesc },
                    { label: t.analytics.timePressure,  count: err.timePressure, color: '#EF4444', bg: 'bg-red-50', desc: t.analytics.timePressureDesc },
                    { label: t.analytics.conceptGap,    count: err.conceptGap, color: '#8B5CF6', bg: 'bg-purple-50', desc: t.analytics.conceptGapDesc },
                    { label: t.analytics.otherError,    count: err.other, color: '#6B7280', bg: 'bg-gray-50', desc: t.analytics.otherErrorDesc },
                  ];
                  return (
                    <div key={key}>
                      <div className={`px-3 py-1.5 rounded-md mb-3 ${bg}`} style={{ borderLeft: `3px solid ${color}` }}>
                        <span className="text-xs font-bold" style={{ color, fontFamily: 'var(--font-heading)' }}>{label}</span>
                        <span className="text-xs ml-2" style={{ color: NAVY_MID, opacity: 0.6 }}>{err.total} wrong answer{err.total !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-2">
                        {items.filter(it => it.count > 0).map(it => {
                          const pct = Math.round((it.count / err.total) * 100);
                          return (
                            <div key={it.label}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-semibold text-gray-700">{it.label}</span>
                                <span className="text-xs font-bold" style={{ color: it.color }}>{it.count} ({pct}%)</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: it.color }}
                                />
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{it.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Tests — split by subject */}
        {analytics && analytics.recentResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontFamily: 'var(--font-heading)', color: NAVY }}>{t.analytics.recentTests}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid grid-cols-1 gap-6 ${backendSubjects.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
                {backendSubjects.map(({ subjectKey, label, color, bg }) => {
                  const tests = analytics.recentResults.filter(t => t.subject === subjectKey);
                  return (
                    <div key={subjectKey}>
                      <div className={`px-3 py-1.5 rounded-md mb-2 ${bg}`} style={{ borderLeft: `3px solid ${color}` }}>
                        <span className="text-xs font-bold" style={{ color, fontFamily: 'var(--font-heading)' }}>{label}</span>
                      </div>
                      {tests.length === 0 ? (
                        <p className="text-xs text-gray-400 px-1">No tests yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {tests.map((test, i) => (
                            <button
                              key={i}
                              onClick={() => router.push(`/student/test/results/${test.sessionId}?studentId=${studentId}`)}
                              className="w-full flex items-center gap-2 px-1 py-1.5 border border-gray-100 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
                            >
                              <span className="text-xs text-gray-400 w-14 flex-shrink-0">{test.date}</span>
                              <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{test.title}</span>
                              <span className="text-sm font-extrabold flex-shrink-0" style={{
                                fontFamily: 'var(--font-heading)',
                                color: test.status === 'good' ? '#2A5C45' : test.status === 'ok' ? GOLD : '#8B1A1A',
                              }}>{test.score}%</span>
                              <ChevronRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ParentStudentAnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    }>
      <ParentStudentAnalyticsInner />
    </Suspense>
  );
}
