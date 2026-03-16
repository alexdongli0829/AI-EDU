'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Target,
  ChevronDown,
  Lock,
} from 'lucide-react';

import { ErrorPatternAnalytics, ErrorTrendData } from '@/types/error-analysis';
import { ErrorPatternsOverview } from '@/components/analytics/ErrorPatternsOverview';
import { ErrorTimelineAnalysis } from '@/components/analytics/ErrorTimelineAnalysis';
import { SkillErrorCorrelation } from '@/components/analytics/SkillErrorCorrelation';
import { ActionableInsights } from '@/components/analytics/ActionableInsights';

interface StudentInfo {
  id: string;
  name: string;
  gradeLevel: number;
  username: string;
}

interface EnrolledStage {
  stage_id: string;
  display_name: string;
  status: 'active' | 'completed' | 'paused';
}

const STAGE_COLORS: Record<string, string> = {
  oc_prep: '#2563EB',
  selective: '#7C3AED',
  hsc: '#0D9488',
  lifelong: '#D97706',
};

function ErrorAnalysisInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = params.studentId as string;
  const { user } = useAuthStore();

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [enrolledStages, setEnrolledStages] = useState<EnrolledStage[]>([]);
  const [analytics, setAnalytics] = useState<ErrorPatternAnalytics | null>(null);
  const [trendData, setTrendData] = useState<ErrorTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState(30);
  // 'active' | 'all' | specific stageId
  const [stageFilter, setStageFilter] = useState<string>(() => searchParams.get('stage') ?? 'active');
  const [error, setError] = useState<string | null>(null);
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);

  useEffect(() => {
    // Load enrolled stages for the stage picker
    const loadStages = async () => {
      try {
        const res = await apiClient.listStudentStages(studentId);
        if (res.success) setEnrolledStages(res.stages ?? []);
      } catch {}
    };
    loadStages();
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [studentId, timeRange, stageFilter]);

  const loadData = async () => {
    try {
      setError(null);
      if (user?.id) {
        const response = await apiClient.listStudents(user.id);
        if (response.success) {
          const found = response.students.find((s: any) => s.id === studentId);
          if (!found) { router.push('/parent/dashboard'); return; }
          setStudent(found);
        }
      }

      // Skip data fetch for a specific inactive stage — nothing to show
      const selectedStageStatus = stageFilter !== 'active' && stageFilter !== 'all'
        ? enrolledStages.find(s => s.stage_id === stageFilter)?.status
        : 'active';
      if (selectedStageStatus && selectedStageStatus !== 'active') {
        setAnalytics(null);
        setTrendData(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Resolve the stageId to pass to the API
      // 'active' → pass 'active' (backend resolves to current active stage)
      // 'all' → pass undefined
      // specific id → pass that id
      const stageId = stageFilter === 'all' ? undefined : stageFilter;

      const [analyticsData, trendsData] = await Promise.all([
        apiClient.getErrorPatternsAggregate(studentId, timeRange, stageId),
        apiClient.getErrorPatternsTrends(studentId, Math.max(timeRange * 2, 90), 'weekly', stageId),
      ]);

      if (analyticsData.success) {
        setAnalytics(analyticsData.data);
      } else {
        throw new Error(analyticsData.error?.message || 'Failed to load analytics');
      }

      if (trendsData.success) {
        setTrendData(trendsData.data);
      } else {
        setTrendData(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load error analysis data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => { setRefreshing(true); loadData(); };
  const handleTimeRangeChange = (days: number) => { setTimeRange(days); setLoading(true); };
  const handleStageChange = (filter: string) => {
    setStageFilter(filter);
    setLoading(true);
    setStageDropdownOpen(false);
  };

  const stageFilterLabel = () => {
    if (stageFilter === 'active') return 'Active Stage';
    if (stageFilter === 'all') return 'All Stages';
    const found = enrolledStages.find(s => s.stage_id === stageFilter);
    return found?.display_name ?? stageFilter;
  };

  const activeStage = enrolledStages.find(s => s.status === 'active');

  // 'active' and 'all' filters are always allowed; a specific stageId is only
  // allowed when that stage is currently active.
  const isFilteredStageActive =
    stageFilter === 'active' ||
    stageFilter === 'all' ||
    enrolledStages.find(s => s.stage_id === stageFilter)?.status === 'active';

  const filteredStageMeta = stageFilter !== 'active' && stageFilter !== 'all'
    ? enrolledStages.find(s => s.stage_id === stageFilter)
    : null;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
        <h3 className="text-lg font-semibold mb-2">Loading Error Analysis</h3>
        <p className="text-muted-foreground">Analyzing error patterns…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Data</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" /> Try Again
        </Button>
      </div>
    </div>
  );

  if (!student) return null;
  if (!analytics && isFilteredStageActive) return null;

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif" }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 pt-5 pb-1">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {student.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Error Pattern Analysis — {student.name}</h1>
              <p className="text-xs text-gray-500">
                Grade {student.gradeLevel}
                {activeStage && stageFilter === 'active' && (
                  <span className="ml-1">· {activeStage.display_name} (active)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Stage selector dropdown */}
            <div className="relative">
              <button
                onClick={() => setStageDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border rounded-lg hover:bg-gray-50 transition-colors"
                style={stageFilter !== 'active' && stageFilter !== 'all'
                  ? { borderColor: STAGE_COLORS[stageFilter] ?? '#6B7280', color: STAGE_COLORS[stageFilter] ?? '#6B7280' }
                  : { borderColor: '#E5E7EB', color: '#374151' }
                }
              >
                <span>{stageFilterLabel()}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {stageDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                  <button
                    onClick={() => handleStageChange('active')}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${stageFilter === 'active' ? 'font-semibold text-teal-700' : 'text-gray-700'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    Active Stage
                    {activeStage && <span className="text-gray-400 ml-auto">{activeStage.display_name}</span>}
                  </button>
                  {enrolledStages.map(s => (
                    <button
                      key={s.stage_id}
                      onClick={() => handleStageChange(s.stage_id)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${stageFilter === s.stage_id ? 'font-semibold' : 'text-gray-700'}`}
                      style={stageFilter === s.stage_id ? { color: STAGE_COLORS[s.stage_id] ?? '#6B7280' } : {}}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STAGE_COLORS[s.stage_id] ?? '#6B7280' }}
                      />
                      {s.display_name}
                      {s.status === 'active' && <span className="ml-auto text-[9px] text-teal-600 font-semibold">Active</span>}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => handleStageChange('all')}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${stageFilter === 'all' ? 'font-semibold text-purple-700' : 'text-gray-700'}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      All Stages Combined
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Time range */}
            <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
              {[7, 30, 90].map(days => (
                <button
                  key={days}
                  onClick={() => handleTimeRangeChange(days)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    timeRange === days ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>

            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
          <button
            onClick={() => router.push(`/parent/analytics/${studentId}`)}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <TrendingUp className="h-4 w-4 inline mr-2" />
            Performance Overview
          </button>
          <button
            className="px-4 py-2 text-sm font-medium rounded-md bg-orange-600 text-white transition-colors"
          >
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Error Analysis
          </button>
        </div>
      </div>

      {/* Scope banner */}
      {stageFilter !== 'all' && (
        <div className="max-w-7xl mx-auto px-4 mb-2">
          <div
            className="text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5"
            style={stageFilter !== 'active'
              ? { backgroundColor: `${STAGE_COLORS[stageFilter]}10`, borderColor: `${STAGE_COLORS[stageFilter]}30`, color: STAGE_COLORS[stageFilter] ?? '#374151' }
              : { backgroundColor: '#F0FDFA', borderColor: '#99F6E4', color: '#0D9488' }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Showing errors for: <strong className="ml-0.5">{stageFilterLabel()}</strong>
            <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => handleStageChange('all')}>
              (show all)
            </button>
          </div>
        </div>
      )}

      {/* Summary Stats / Locked state */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        {!isFilteredStageActive ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center max-w-sm">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#F5EDD0' }}
              >
                <Lock className="h-7 w-7" style={{ color: '#9CA3AF' }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: '#1C3557' }}>
                Stage Not Active
              </h3>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
                Error Analysis is only available for the student's currently active stage.
                {filteredStageMeta && (
                  <> Activate <strong>{filteredStageMeta.display_name}</strong> on the dashboard to unlock this view.</>
                )}
              </p>
              <button
                onClick={() => handleStageChange('active')}
                className="px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ background: '#1C3557', color: '#D4A017' }}
              >
                Switch to Active Stage
              </button>
            </div>
          </div>
        ) : analytics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardContent className="p-4 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold text-gray-900">{analytics.totalResponses}</div>
                  <p className="text-sm text-gray-500">Total Responses</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                  <div className="text-2xl font-bold text-gray-900">{analytics.incorrectResponses}</div>
                  <p className="text-sm text-gray-500">Incorrect Answers</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {analytics.totalResponses > 0
                      ? Math.round((analytics.incorrectResponses / analytics.totalResponses) * 100)
                      : 0}% error rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold text-gray-900">{analytics.errorPatterns.length}</div>
                  <p className="text-sm text-gray-500">Error Patterns</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {analytics.errorPatterns.filter(p => p.severity === 'high').length} high priority
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  {trendData?.improvement_indicators?.some(i => i.type === 'improvement') ? (
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  ) : trendData?.improvement_indicators?.some(i => i.type === 'concern') ? (
                    <TrendingDown className="h-8 w-8 mx-auto mb-2 text-red-600" />
                  ) : (
                    <Minus className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                  )}
                  <div className="text-2xl font-bold text-gray-900">
                    {Math.round(analytics.timeAnalysis.averageTimePerQuestion)}s
                  </div>
                  <p className="text-sm text-gray-500">Avg Time/Question</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round(analytics.timeAnalysis.rushingIndicator * 100)}% rushed
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="lg:col-span-2">
                <ErrorPatternsOverview patterns={analytics.errorPatterns} timeAnalysis={analytics.timeAnalysis} />
              </div>
              <div className="lg:col-span-2">
                <ErrorTimelineAnalysis trendData={trendData} dateRange={analytics.dateRange} />
              </div>
              <SkillErrorCorrelation
                skillErrorMapping={analytics.skillErrorMapping}
                errorPatterns={analytics.errorPatterns}
              />
              <ActionableInsights
                recommendations={analytics.recommendations}
                improvementIndicators={trendData?.improvement_indicators || []}
                studentId={studentId}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function ErrorAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    }>
      <ErrorAnalysisInner />
    </Suspense>
  );
}
