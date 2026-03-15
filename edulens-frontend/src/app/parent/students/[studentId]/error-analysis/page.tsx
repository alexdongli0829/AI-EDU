'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Target
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

export default function ErrorAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const { user } = useAuthStore();

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [analytics, setAnalytics] = useState<ErrorPatternAnalytics | null>(null);
  const [trendData, setTrendData] = useState<ErrorTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState(30); // days
  const [stageMode, setStageMode] = useState<'active' | 'all'>('active');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [studentId, timeRange, stageMode]);

  const loadData = async () => {
    try {
      setError(null);

      // Load student info
      if (user?.id) {
        const response = await apiClient.listStudents(user.id);
        if (response.success) {
          const foundStudent = response.students.find((s: any) => s.id === studentId);
          if (!foundStudent) {
            router.push('/parent/dashboard');
            return;
          }
          setStudent(foundStudent);
        }
      }

      const stageId = stageMode === 'active' ? 'active' : undefined;

      // Load error pattern analytics
      const [analyticsData, trendsData] = await Promise.all([
        apiClient.getErrorPatternsAggregate(studentId, timeRange, stageId),
        apiClient.getErrorPatternsTrends(studentId, Math.max(timeRange * 2, 90), 'weekly', stageId)
      ]);

      if (analyticsData.success) {
        setAnalytics(analyticsData.data);
      } else {
        throw new Error(analyticsData.error?.message || 'Failed to load analytics');
      }

      if (trendsData.success) {
        setTrendData(trendsData.data);
      } else {
        console.warn('Failed to load trends data:', trendsData.error);
        setTrendData(null);
      }

    } catch (err: any) {
      console.error('Error loading error analysis:', err);
      setError(err.message || 'Failed to load error analysis data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleTimeRangeChange = (days: number) => {
    setTimeRange(days);
    setLoading(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
          <h3 className="text-lg font-semibold mb-2">Loading Error Analysis</h3>
          <p className="text-muted-foreground">Analyzing error patterns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Data</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!student || !analytics) return null;

  return (
    <div 
      className="min-h-screen bg-gray-50"
      style={{
        backgroundColor: '#FAFAF9',
        fontFamily: "'Source Sans 3', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 pt-5 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {student.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">
                Error Pattern Analysis - {student.name}
              </h1>
              <p className="text-xs text-gray-500">
                Grade {student.gradeLevel} • Comprehensive Error Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stage Scope Selector */}
            <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
              {(['active', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => { setStageMode(mode); setLoading(true); }}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    stageMode === mode
                      ? 'bg-violet-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {mode === 'active' ? 'Current Stage' : 'All Stages'}
                </button>
              ))}
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2 bg-white rounded-lg border p-1">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => handleTimeRangeChange(days)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    timeRange === days
                      ? 'bg-teal-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>

            <Button 
              size="sm" 
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
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
            onClick={() => router.push(`/parent/students/${studentId}/error-analysis`)}
            className="px-4 py-2 text-sm font-medium rounded-md bg-orange-600 text-white transition-colors"
          >
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Error Analysis
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold text-gray-900">
                {analytics.totalResponses}
              </div>
              <p className="text-sm text-gray-500">Total Responses</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-600" />
              <div className="text-2xl font-bold text-gray-900">
                {analytics.incorrectResponses}
              </div>
              <p className="text-sm text-gray-500">Incorrect Answers</p>
              <p className="text-xs text-gray-400 mt-1">
                {analytics.totalResponses > 0 
                  ? Math.round((analytics.incorrectResponses / analytics.totalResponses) * 100)
                  : 0
                }% error rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-gray-900">
                {analytics.errorPatterns.length}
              </div>
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
          {/* Error Patterns Overview */}
          <div className="lg:col-span-2">
            <ErrorPatternsOverview 
              patterns={analytics.errorPatterns}
              timeAnalysis={analytics.timeAnalysis}
            />
          </div>

          {/* Timeline Analysis */}
          <div className="lg:col-span-2">
            <ErrorTimelineAnalysis 
              trendData={trendData}
              dateRange={analytics.dateRange}
            />
          </div>

          {/* Skill-Error Correlation */}
          <SkillErrorCorrelation 
            skillErrorMapping={analytics.skillErrorMapping}
            errorPatterns={analytics.errorPatterns}
          />

          {/* Actionable Insights */}
          <ActionableInsights 
            recommendations={analytics.recommendations}
            improvementIndicators={trendData?.improvement_indicators || []}
            studentId={studentId}
          />
        </div>
      </div>
    </div>
  );
}