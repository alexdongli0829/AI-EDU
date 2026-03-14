'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTestStore } from '@/store/test-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { studentAnalyticsService, StudentAnalytics } from '@/services/student-analytics';
import {
  Target,
  Loader2,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Calculator,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';

const SUBJECTS = [
  {
    key: 'math' as const,
    dnaKey: 'math' as const,
    testSubject: 'math',
    label: 'Mathematical Reasoning',
    short: 'Math',
    color: '#2563EB',
    light: '#EFF6FF',
    border: '#BFDBFE',
    icon: Calculator,
    description: 'Number, algebra, geometry & problem solving',
  },
  {
    key: 'thinking' as const,
    dnaKey: 'thinking' as const,
    testSubject: 'general_ability',
    label: 'Thinking Skills',
    short: 'Thinking',
    color: '#7C3AED',
    light: '#F5F3FF',
    border: '#DDD6FE',
    icon: Lightbulb,
    description: 'Logic, patterns, spatial & verbal reasoning',
  },
  {
    key: 'reading' as const,
    dnaKey: 'reading' as const,
    testSubject: 'english',
    label: 'English Reading',
    short: 'English',
    color: '#0D9488',
    light: '#F0FDFA',
    border: '#99F6E4',
    icon: BookOpen,
    description: 'Comprehension, vocabulary, grammar & inference',
  },
] as const;

function scoreStatusColor(status: 'good' | 'ok' | 'low') {
  if (status === 'good') return 'text-green-600';
  if (status === 'ok') return 'text-amber-600';
  return 'text-red-500';
}

export default function StudentDashboard() {
  const router = useRouter();
  const { user, student, isAuthenticated } = useAuthStore();
  const { tests, loadTests } = useTestStore();
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!student) {
      if (user?.role === 'parent') return;
      router.push('/login');
      return;
    }
    loadAnalytics();
    loadTests();
  }, [isAuthenticated, student, user, router]);

  const startTestForSubject = (testSubject: string) => {
    const test = tests.find(t => t.subject === testSubject);
    if (test) {
      router.push(`/student/test/take/${test.id}`);
    } else {
      router.push('/student/test');
    }
  };

  const loadAnalytics = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      setAnalytics(await studentAnalyticsService.getStudentAnalytics(student.id));
    } catch {
      setError('Unable to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !student) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-teal-600" />
          <p className="text-sm text-gray-500">Loading your analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-80">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={loadAnalytics} variant="outline" size="sm">Try Again</Button>
              <Button onClick={() => router.push('/student/test')} size="sm">Take Test</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Welcome state (no tests yet) ─────────────────────────────────────────
  if (!analytics || analytics.totalTests === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50/40 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 py-14 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-200/50">
            <Target className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3" style={{ fontFamily: 'var(--font-heading)' }}>Hey {user.name.split(' ')[0]}! Ready to learn?</h2>
          <p className="text-gray-500 text-base mb-10 max-w-md mx-auto">
            Pick a subject below to start your first practice test. Your progress and scores will show up here!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBJECTS.map(({ label, description, color, light, border, icon: Icon, key, testSubject }) => (
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
            After each test, your results and score history will appear here.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/40 via-white to-white">

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-1">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
          My Dashboard
        </h1>
        <p className="text-sm text-gray-400">
          Grade {student.gradeLevel} · {analytics.totalTests} test{analytics.totalTests !== 1 ? 's' : ''} completed · Last activity: {analytics.lastTestDate}
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 space-y-6">

        {/* ── Row 1: Summary stat chips ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tests Completed', value: analytics.totalTests, color: 'text-teal-600' },
            { label: 'Average Score', value: `${analytics.averageScore}%`, color: analytics.averageScore >= 70 ? 'text-green-600' : analytics.averageScore >= 50 ? 'text-amber-600' : 'text-red-500' },
            { label: 'Last Activity', value: analytics.lastTestDate, color: 'text-gray-800' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border border-gray-200/80 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-5 text-center">
                <p className={`text-2xl font-extrabold ${color}`} style={{ fontFamily: 'var(--font-heading)' }}>{value}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Score Trend by Subject ── */}
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-extrabold text-gray-800" style={{ fontFamily: 'var(--font-heading)' }}>Score Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {SUBJECTS.map(({ key, label, color }) => {
              const pts = analytics.scoreTrend[key];
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
          <h2 className="text-lg font-extrabold text-gray-800 mb-3" style={{ fontFamily: 'var(--font-heading)' }}>Take a Test</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUBJECTS.map(({ label, description, color, light, border, icon: Icon, key, testSubject }) => (
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
                  Start test <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Previous Tests ── */}
        {analytics.recentResults.length > 0 && (
          <div>
            <h2 className="text-lg font-extrabold text-gray-800 mb-3" style={{ fontFamily: 'var(--font-heading)' }}>Previous Tests</h2>
            <Card className="border border-gray-200 shadow-sm">
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
