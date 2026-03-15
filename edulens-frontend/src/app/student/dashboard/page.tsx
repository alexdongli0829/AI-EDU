'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTestStore } from '@/store/test-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { studentAnalyticsService, StudentAnalytics } from '@/services/student-analytics';
import { useI18n } from '@/lib/i18n';
import {
  Target,
  Loader2,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Calculator,
  Lightbulb,
  TrendingUp,
  PenLine,
} from 'lucide-react';

// Stage metadata — maps stage_id to display info and per-subject labels/descriptions
const STAGE_META: Record<string, {
  label: string; color: string; light: string;
  subjects: { key: 'math' | 'thinking' | 'reading' | 'writing'; label: string; testSubject: string; description: string }[];
}> = {
  oc_prep: {
    label: 'OC Preparation', color: '#2563EB', light: '#EFF6FF',
    subjects: [
      { key: 'math',     label: 'Mathematical Reasoning', testSubject: 'math',            description: 'Number & algebra, fractions, measurement, geometry, statistics & problem solving' },
      { key: 'thinking', label: 'Thinking Skills',        testSubject: 'general_ability', description: 'Logical reasoning, pattern recognition, spatial thinking & verbal analogies' },
      { key: 'reading',  label: 'English Reading',        testSubject: 'english',         description: 'Reading comprehension, vocabulary, inference, grammar & text interpretation' },
    ],
  },
  selective: {
    label: 'Selective High School', color: '#7C3AED', light: '#F5F3FF',
    subjects: [
      { key: 'math',     label: 'Mathematical Reasoning', testSubject: 'math',            description: 'Number & algebra, measurement & space, statistics, financial maths & multi-step problem solving. 35 questions / 40 min, no calculator.' },
      { key: 'thinking', label: 'Thinking Skills',        testSubject: 'general_ability', description: 'Abstract reasoning, logical deduction, pattern recognition, spatial & verbal reasoning. No prior knowledge required. 40 questions / 40 min.' },
      { key: 'reading',  label: 'Reading',                testSubject: 'english',         description: 'Non-fiction, fiction, poetry & articles — comprehension, inference, vocabulary in context & literary techniques. 17 questions / 45 min.' },
      { key: 'writing',  label: 'Writing',                testSubject: 'writing',         description: 'One open-response creative or persuasive writing task. Assessed on ideas, structure, language features, grammar, punctuation & vocabulary. 30 min.' },
    ],
  },
  hsc: {
    label: 'HSC Preparation', color: '#0D9488', light: '#F0FDFA',
    subjects: [
      { key: 'math',     label: 'Mathematics', testSubject: 'math',            description: 'Functions & graphs, calculus, financial maths, statistics, algebra & measurement' },
      { key: 'thinking', label: 'Sciences',    testSubject: 'general_ability', description: 'Scientific reasoning, data analysis & experiment design across Physics, Chemistry & Biology' },
      { key: 'reading',  label: 'English',     testSubject: 'english',         description: 'Textual analysis, essay writing, creative writing, literary techniques & text in context' },
    ],
  },
  lifelong: {
    label: 'University & Beyond', color: '#D97706', light: '#FFFBEB',
    subjects: [
      { key: 'math',     label: 'Quantitative Reasoning', testSubject: 'math',            description: 'Statistical analysis, mathematical modelling, data interpretation & financial literacy' },
      { key: 'thinking', label: 'Critical Thinking',      testSubject: 'general_ability', description: 'Argumentation, evidence evaluation, logical fallacies, analytical reasoning & synthesis' },
      { key: 'reading',  label: 'Literacy',               testSubject: 'english',         description: 'Academic reading & writing, rhetorical analysis, vocabulary & text critique' },
    ],
  },
};

// Style constants per subject slot (index 0=math, 1=thinking, 2=reading, 3=writing)
const SUBJECT_STYLES = [
  { icon: Calculator, color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE' },
  { icon: Lightbulb,  color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE' },
  { icon: BookOpen,   color: '#0D9488', light: '#F0FDFA', border: '#99F6E4' },
  { icon: PenLine,    color: '#EA580C', light: '#FFF7ED', border: '#FED7AA' },
] as const;

const DEFAULT_SUBJECTS = STAGE_META.oc_prep.subjects.map((s, i) => ({
  ...s,
  ...SUBJECT_STYLES[i],
}));

function scoreStatusColor(status: 'good' | 'ok' | 'low') {
  if (status === 'good') return 'text-green-600';
  if (status === 'ok') return 'text-amber-600';
  return 'text-red-500';
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user, student, isAuthenticated } = useAuthStore();
  const { tests, loadTests } = useTestStore();
  const { t } = useI18n();
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!student) {
      if (user?.role === 'parent') return;
      router.push('/login'); return;
    }
    loadAnalytics();
    loadTests();
  }, [isAuthenticated, student, user, router]);

  const startTestForSubject = (testSubject: string) => {
    const test = tests.find(t => t.subject === testSubject);
    if (test) router.push(`/student/test/take/${test.id}`);
    else router.push('/student/test');
  };

  const loadAnalytics = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      // Fetch active stage first, then filter analytics to that stage
      const stagesRes = await apiClient.listStudentStages(student.id).catch(() => ({ success: false, stages: [] }));
      const activeStage = stagesRes.success ? (stagesRes.stages ?? []).find((s: any) => s.status === 'active') : null;
      const stageId = activeStage?.stage_id ?? undefined;
      setActiveStageId(stageId ?? null);
      setAnalytics(await studentAnalyticsService.getStudentAnalytics(student.id, stageId));
    } catch {
      setError('Unable to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !student) return null;

  const stageMeta = activeStageId ? STAGE_META[activeStageId] : null;
  // Merge stage-specific labels/descriptions with fixed style constants
  const subjects = (stageMeta ? stageMeta.subjects : DEFAULT_SUBJECTS).map((s, i) => ({
    ...s,
    ...SUBJECT_STYLES[i],
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--parchment)' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: 'var(--oxford-navy)' }} />
          <p className="text-sm" style={{ color: '#6b7280', fontFamily: 'var(--font-body)' }}>Loading your analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--parchment)' }}>
        <Card className="w-80">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={loadAnalytics} variant="outline" size="sm">Try Again</Button>
              <Button onClick={() => router.push('/student/test')} size="sm" style={{ background: 'var(--oxford-navy)', color: '#fff' }}>Take Test</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Welcome state (no tests yet) ─────────────────────────────────────────
  if (!analytics || analytics.totalTests === 0) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--parchment)' }}>
        <div className="max-w-3xl mx-auto px-4 py-14 text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
            style={{ background: 'var(--oxford-navy)', border: '2px solid var(--gold)' }}
          >
            <Target className="h-10 w-10" style={{ color: 'var(--gold-bright)' }} />
          </div>
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}>{t.studentDash.readyToLearn(user.name.split(' ')[0])}</h2>
          <p className="text-base mb-10 max-w-md mx-auto" style={{ color: '#6b7280', fontFamily: 'var(--font-serif)' }}>
            {t.studentDash.pickSubject}
          </p>

          {stageMeta && (
            <div
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-6"
              style={{ background: 'var(--oxford-navy)', color: 'var(--gold-bright)', border: '1px solid var(--gold)', fontFamily: 'var(--font-body)', letterSpacing: '0.05em' }}
            >
              {stageMeta.label}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subjects.map(({ label, description, color, light, border, icon: Icon, key, testSubject }) => (
              <button
                key={key}
                onClick={() => startTestForSubject(testSubject)}
                className="text-left p-6 rounded-2xl border-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                style={{ backgroundColor: light, borderColor: border }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: color }}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="font-bold text-gray-900 text-sm mb-1">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </button>
            ))}
          </div>

          <p className="mt-10 text-xs text-gray-400">
            {t.studentDash.afterTest}
          </p>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--parchment)' }}>

      {/* Page header strip */}
      <div style={{ background: 'var(--oxford-navy)', borderBottom: '2px solid var(--gold)' }}>
        <div className="max-w-6xl mx-auto px-5 py-5">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#e8edf4' }}>
              {t.studentDash.myDashboard}
            </h1>
            {stageMeta && (
              <span
                className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(184,134,11,0.2)', color: 'var(--gold-bright)', border: '1px solid var(--gold)', fontFamily: 'var(--font-body)' }}
              >
                {stageMeta.label}
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: 'rgba(232,237,244,0.6)', fontFamily: 'var(--font-body)' }}>
            Year {student.gradeLevel} · {analytics.totalTests} test{analytics.totalTests !== 1 ? 's' : ''} completed · Last activity: {analytics.lastTestDate}
            {!stageMeta && <span className="ml-1" style={{ color: 'var(--gold)' }}>(all stages)</span>}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">

        {/* ── Row 1: Summary stat chips ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t.common.testsCompleted, value: analytics.totalTests, navyAccent: true },
            { label: t.common.averageScore, value: `${analytics.averageScore}%`, navyAccent: false, scoreVal: analytics.averageScore },
            { label: t.common.lastActivity, value: analytics.lastTestDate, navyAccent: false },
          ].map(({ label, value, navyAccent, scoreVal }) => {
            const scoreColor = scoreVal != null
              ? (scoreVal >= 70 ? '#16a34a' : scoreVal >= 50 ? '#d97706' : '#dc2626')
              : 'var(--oxford-navy)';
            return (
              <Card key={label} className="shadow-sm overflow-hidden" style={{ border: '1px solid var(--parchment-mid)', background: '#fff' }}>
                <CardContent className="p-5 text-center">
                  <p
                    className="text-2xl font-bold"
                    style={{ fontFamily: 'var(--font-heading)', color: navyAccent ? 'var(--oxford-navy)' : scoreColor }}
                  >
                    {value}
                  </p>
                  <p className="text-xs mt-1 font-medium" style={{ color: '#9ca3af', fontFamily: 'var(--font-body)' }}>{label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Score Trend by Subject ── */}
        <Card className="shadow-sm" style={{ border: '1px solid var(--parchment-mid)', background: '#fff' }}>
          <CardHeader className="pb-2" style={{ borderBottom: '1px solid var(--parchment-mid)' }}>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}>{t.studentDash.scoreTrend}</CardTitle>
              {stageMeta && <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>· {stageMeta.label}</span>}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {subjects.map(({ key, label, color }) => {
              const pts = (analytics.scoreTrend as any)[key] ?? [];
              if (pts.length === 0) return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs font-semibold w-36 flex-shrink-0" style={{ color }}>{label}</span>
                  <span className="text-xs text-gray-400">No tests yet</span>
                </div>
              );
              const n = pts.length;
              const xS = 8, xE = 492, yT = 8, yB = 42;
              const xOf = (i: number) => n === 1 ? (xS + xE) / 2 : xS + i * (xE - xS) / (n - 1);
              const yOf = (s: number) => yB - (Math.min(100, Math.max(0, s)) / 100) * (yB - yT);
              const poly = pts.map((p, i) => `${xOf(i)},${yOf(p.score)}`).join(' ');
              const latest = pts[pts.length - 1].score;
              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                    <span className="text-sm font-extrabold tabular-nums" style={{ color }}>{latest}%</span>
                  </div>
                  <svg viewBox="0 0 500 52" className="w-full h-11">
                    {[25, 50, 75].map(p => (
                      <line key={p} x1="0" y1={yOf(p)} x2="500" y2={yOf(p)} stroke="#F3F4F6" strokeWidth="1" />
                    ))}
                    {n > 1 && <polyline points={poly} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                    {pts.map((p, i) => {
                      const x = xOf(i), y = yOf(p.score);
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="3" fill={color} />
                          <text x={x} y={y > yT + 14 ? y - 5 : y + 13} textAnchor="middle" fontSize="8" fontWeight="600" fill="#9CA3AF">{p.score}%</text>
                          <text x={x} y="51" textAnchor="middle" fontSize="7" fill="#C4B5A0">{p.date}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Take a Test ── */}
        <div>
          <h2 className="text-lg font-bold mb-3 heading-rule" style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}>{t.studentDash.takeATest}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subjects.map(({ label, description, color, light, border, icon: Icon, key, testSubject }) => (
              <button
                key={key}
                onClick={() => startTestForSubject(testSubject)}
                className="text-left p-6 rounded-2xl border-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
                style={{ backgroundColor: light, borderColor: border }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: color }}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <TrendingUp className="h-4 w-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color }} />
                </div>
                <p className="font-bold text-gray-900 text-base mb-1">{label}</p>
                <p className="text-sm text-gray-500">{description}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color }}>
                  {t.studentDash.startTest} <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Previous Tests ── */}
        {analytics.recentResults.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-3 heading-rule" style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}>{t.studentDash.previousTests}</h2>
            <Card className="shadow-sm" style={{ border: '1px solid var(--parchment-mid)', background: '#fff' }}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {analytics.recentResults.map((test, i) => (
                    <button
                      key={i}
                      onClick={() => router.push(`/student/test/results/${test.sessionId}`)}
                      className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
                    >
                      <span className="text-xs text-gray-400 w-14 flex-shrink-0">{test.date}</span>
                      <span className="text-sm font-semibold text-gray-800 flex-1">{test.title}</span>
                      <span className={`text-base font-extrabold tabular-nums ${scoreStatusColor(test.status)}`}>
                        {test.score}%
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
