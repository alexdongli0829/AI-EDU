'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { studentAnalyticsService, StudentAnalytics, SkillEntry } from '@/services/student-analytics';
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
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

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

const SUBJECT_UI = {
  math:             { label: 'Mathematical Reasoning', color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE', icon: Calculator },
  general_ability:  { label: 'Thinking Skills',        color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE', icon: Lightbulb },
  english:          { label: 'English Reading',         color: '#0D9488', light: '#F0FDFA', border: '#99F6E4', icon: BookOpen },
} as const;

interface StudentInfo {
  id: string;
  name: string;
  gradeLevel: number;
  dateOfBirth: string;
  username: string;
  testsCompleted: number;
}

export default function ParentStudentAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const { user } = useAuthStore();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [insights, setInsights] = useState<StudentInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsRegenerating, setInsightsRegenerating] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  const loadStudentData = async () => {
    try {
      if (user?.id) {
        const response = await apiClient.listStudents(user.id);
        if (response.success) {
          const foundStudent = response.students.find((s: any) => s.id === studentId);
          if (!foundStudent) { router.push('/parent/dashboard'); return; }
          setStudent(foundStudent);
        }
      }
      const studentAnalytics = await studentAnalyticsService.getStudentAnalytics(studentId);
      setAnalytics(studentAnalytics);

      // Auto-generate insights if student has test data
      // Use forceRefresh=false: backend returns cached if fresh, otherwise generates
      loadInsights(false);
    } catch (error) {
      console.error('Failed to load student analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async (forceRefresh: boolean) => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = forceRefresh
        ? await apiClient.regenerateStudentInsights(studentId)
        : await apiClient.getStudentInsights(studentId);
      if (res.success && res.insights) {
        setInsights(res.insights);
      } else if (res.reason === 'no_tests') {
        // no sessions yet — not an error
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

  if (!student) return null;

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{
        backgroundColor: '#FAFAF9',
        fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Page title row */}
      <div className="max-w-6xl mx-auto px-4 pt-5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">{student.name}'s Learning Analytics</h1>
            <p className="text-xs text-gray-500">
              Grade {student.gradeLevel} · Parent view · {analytics?.totalTests || 0} tests completed
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/parent/chat?studentId=${studentId}`)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          AI Advisor
        </Button>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-teal-600" />
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.totalTests || 0}
              </div>
              <p className="text-sm text-gray-500">Tests Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.averageScore || 0}%
              </div>
              <p className="text-sm text-gray-500">Average Score</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold text-gray-900">
                {analytics?.lastTestDate || 'Never'}
              </div>
              <p className="text-sm text-gray-500">Last Activity</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Brain className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold text-gray-900">
                {analytics
                  ? [analytics.skillBreakdown.math, analytics.skillBreakdown.thinking, analytics.skillBreakdown.reading]
                      .flat().filter(s => s.total > 0).length
                  : 0}
              </div>
              <p className="text-sm text-gray-500">Skills Assessed</p>
            </CardContent>
          </Card>
        </div>

        {/* ── AI Performance Insights ── */}
        <div className="mb-6">
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-bold text-gray-800">AI Performance Insights</h2>
              {insights && (
                <span className="text-[10px] text-gray-400">
                  · Updated {new Date(insights.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerateInsights}
              disabled={insightsRegenerating || insightsLoading}
              className="h-7 text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${insightsRegenerating ? 'animate-spin' : ''}`} />
              {insightsRegenerating ? 'Analysing…' : 'Refresh'}
            </Button>
          </div>

          {insightsLoading ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-teal-600" />
                <p className="text-sm text-gray-500">
                  {insightsRegenerating ? 'Regenerating analysis with Claude…' : 'Generating AI insights with Claude…'}
                </p>
                <p className="text-xs text-gray-400 mt-1">This takes 20–40 seconds</p>
              </CardContent>
            </Card>
          ) : !insights ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-10 text-center">
                <Brain className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                {insightsError ? (
                  <>
                    <p className="text-sm text-red-500 mb-1">Generation failed</p>
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
                <div className="px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
                  {insights.overallSummary}
                </div>
              )}

              {/* Per-subject cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {insights.subjects.map(sub => {
                  const ui = SUBJECT_UI[sub.subject as keyof typeof SUBJECT_UI];
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
        </div>

        {/* Detailed Skill Analysis — OC-aligned 3-subject breakdown */}
        {analytics && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detailed Skill Analysis</CardTitle>
                <span className="text-xs text-gray-400 font-normal">Last 3 months</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {([
                { key: 'math' as const,     label: 'Mathematical Reasoning', color: '#2563EB', bg: 'bg-blue-50' },
                { key: 'thinking' as const, label: 'Thinking Skills',        color: '#7C3AED', bg: 'bg-purple-50' },
                { key: 'reading' as const,  label: 'English Reading',        color: '#0D9488', bg: 'bg-teal-50' },
              ] as const).map(({ key, label, color, bg }) => {
                const skills: SkillEntry[] = analytics.skillBreakdown[key];
                const practiced = skills.filter(s => s.total > 0);
                const trendData = analytics.monthTrend[key];
                return (
                  <div key={key}>
                    <div className={`flex items-center justify-between px-3 py-2 rounded-md mb-3 ${bg}`}>
                      <span className="text-sm font-bold" style={{ color }}>{label}</span>
                      {practiced.length === 0 && (
                        <span className="text-xs text-gray-400">No tests completed yet</span>
                      )}
                    </div>
                    {/* 30-day subject trend line */}
                    {trendData.length >= 2 ? (
                      <div className="mb-4">
                        <div className="text-xs text-gray-400 mb-1">Score trend — recent sessions</div>
                        <div className="h-28">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                              <Tooltip
                                contentStyle={{ fontSize: 11, padding: '3px 8px', borderRadius: 4 }}
                                formatter={(v: number) => [`${v}%`, 'Score']}
                              />
                              <ReferenceLine y={70} stroke="#d1d5db" strokeDasharray="4 2" label={{ value: '70%', fontSize: 9, fill: '#9ca3af', position: 'right' }} />
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
                        <div className="text-xs text-gray-400 mb-1">Skill profile</div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={skills.map(s => ({ skill: s.skill, value: s.total > 0 ? s.percentage : 0 }))}>
                              <PolarGrid stroke="#e5e7eb" />
                              <PolarAngleAxis
                                dataKey="skill"
                                tick={{ fontSize: 10, fill: '#6b7280' }}
                              />
                              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                              <Radar
                                dataKey="value"
                                stroke={color}
                                fill={color}
                                fillOpacity={0.15}
                                strokeWidth={2}
                                isAnimationActive={false}
                              />
                              <Tooltip
                                contentStyle={{ fontSize: 11, padding: '3px 8px', borderRadius: 4 }}
                                formatter={(v: number) => [`${v}%`, 'Score']}
                              />
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
                        const trendLabel  = trendUp ? 'Improving'       : trendDown ? 'Declining'     : 'Stable';
                        const lineColor   = trendUp ? '#16a34a'         : trendDown ? '#ef4444'       : '#9ca3af';
                        return (
                          <div key={i} className={`p-3 border rounded-lg ${trendBorder} ${skill.total === 0 ? 'opacity-50' : ''}`}>
                            {/* Trend badge — primary indicator */}
                            <div className="flex items-center justify-between mb-2">
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${trendBg}`}>
                                <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                                <span className={`text-xs font-semibold ${trendColor}`}>{trendLabel}</span>
                              </div>
                              <span className={`text-sm font-bold ${skill.total === 0 ? 'text-gray-300' : skill.percentage >= 70 ? 'text-green-600' : skill.percentage >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
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
                                    <Tooltip
                                      contentStyle={{ fontSize: 11, padding: '2px 6px', borderRadius: 4 }}
                                      formatter={(v: number) => [`${v}%`, 'Score']}
                                      labelFormatter={(l: string) => l}
                                    />
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
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              {skill.total > 0 && (
                                <div
                                  className={`h-full rounded-full ${
                                    skill.percentage >= 70 ? 'bg-green-500' : skill.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${skill.percentage}%` }}
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
        {analytics && (analytics.errorAnalysis.math.total > 0 || analytics.errorAnalysis.thinking.total > 0 || analytics.errorAnalysis.reading.total > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                Breakdown of incorrect answers by error type across all completed tests
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {([
                  { key: 'math' as const,     label: 'Mathematical Reasoning', color: '#2563EB', bg: 'bg-blue-50' },
                  { key: 'thinking' as const, label: 'Thinking Skills',        color: '#7C3AED', bg: 'bg-purple-50' },
                  { key: 'reading' as const,  label: 'English Reading',        color: '#0D9488', bg: 'bg-teal-50' },
                ] as const).map(({ key, label, color, bg }) => {
                  const err = analytics.errorAnalysis[key];
                  if (err.total === 0) return (
                    <div key={key}>
                      <div className={`px-3 py-1.5 rounded-md mb-3 ${bg}`}>
                        <span className="text-xs font-bold" style={{ color }}>{label}</span>
                      </div>
                      <p className="text-xs text-gray-400 px-1">No errors recorded yet</p>
                    </div>
                  );
                  const items = [
                    { label: 'Careless Error', count: err.careless, color: '#F59E0B', bg: 'bg-amber-50', desc: 'Answered too quickly (<5s)' },
                    { label: 'Time Pressure',  count: err.timePressure, color: '#EF4444', bg: 'bg-red-50', desc: 'Running out of time' },
                    { label: 'Concept Gap',    count: err.conceptGap, color: '#8B5CF6', bg: 'bg-purple-50', desc: 'Spent >2min but still wrong' },
                    { label: 'Other',          count: err.other, color: '#6B7280', bg: 'bg-gray-50', desc: 'Standard errors' },
                  ];
                  return (
                    <div key={key}>
                      <div className={`px-3 py-1.5 rounded-md mb-3 ${bg}`}>
                        <span className="text-xs font-bold" style={{ color }}>{label}</span>
                        <span className="text-xs text-gray-400 ml-2">{err.total} wrong answer{err.total !== 1 ? 's' : ''}</span>
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
              <CardTitle>Recent Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {([
                  { subjectKey: 'math',            label: 'Mathematical Reasoning', color: '#2563EB', bg: 'bg-blue-50' },
                  { subjectKey: 'general_ability', label: 'Thinking Skills',        color: '#7C3AED', bg: 'bg-purple-50' },
                  { subjectKey: 'english',         label: 'English Reading',        color: '#0D9488', bg: 'bg-teal-50' },
                ] as const).map(({ subjectKey, label, color, bg }) => {
                  const tests = analytics.recentResults.filter(t => t.subject === subjectKey);
                  return (
                    <div key={subjectKey}>
                      <div className={`px-3 py-1.5 rounded-md mb-2 ${bg}`}>
                        <span className="text-xs font-bold" style={{ color }}>{label}</span>
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
                              <span className={`text-sm font-extrabold flex-shrink-0 ${
                                test.status === 'good' ? 'text-green-600' :
                                test.status === 'ok'   ? 'text-amber-600' : 'text-red-600'
                              }`}>{test.score}%</span>
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
