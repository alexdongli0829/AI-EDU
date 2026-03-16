'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BookOpen,
  Zap,
  Award,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface SkillProgression {
  skillCategory: string;
  masteryEvolution: Array<{
    stage: string;
    mastery: number;
    date: string;
  }>;
}

interface StageInfo {
  stageId: string;
  activatedAt: string;
  completedAt?: string;
  skillProgression: SkillProgression[];
}

interface ProgressionReport {
  summary: {
    totalStages: number;
    completedStages: number;
    currentStage: string | null;
    overallTrend: 'improving' | 'stable' | 'declining';
    persistentStrengths: string[];
    persistentWeaknesses: string[];
  };
  detailed: {
    stages: StageInfo[];
    persistentStrengths: string[];
    persistentWeaknesses: string[];
    overallTrend: 'improving' | 'stable' | 'declining';
  };
}

const STAGE_META: Record<string, { 
  label: string; 
  color: string; 
  description: string;
  icon: React.ComponentType<any>;
}> = {
  oc_prep: {
    label: 'OC Preparation',
    color: '#2563EB',
    description: 'Foundation skills for Opportunity Class entrance',
    icon: BookOpen,
  },
  selective: {
    label: 'Selective High School',
    color: '#7C3AED', 
    description: 'Advanced reasoning and analytical skills',
    icon: Target,
  },
  hsc: {
    label: 'HSC Preparation',
    color: '#0D9488',
    description: 'University entrance and subject mastery',
    icon: Award,
  },
  lifelong: {
    label: 'Lifelong Learning',
    color: '#D97706',
    description: 'Continuous skill development and growth',
    icon: Zap,
  },
};

interface StageTransitionProps {
  studentId: string;
}

export default function StageTransitionView({ studentId }: StageTransitionProps) {
  const { user } = useAuthStore();
  const [progressionReport, setProgressionReport] = useState<ProgressionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProgressionReport();
  }, [studentId]);

  const loadProgressionReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/students/${studentId}/stage-progression`);
      const data = await response.json();
      
      if (data.success) {
        setProgressionReport(data);
      } else {
        setError(data.error || 'Failed to load progression report');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load progression report');
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
          <p className="text-gray-600">Loading stage progression...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={loadProgressionReport} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (!progressionReport) {
    return (
      <div className="p-6 text-center">
        <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No progression data available</p>
      </div>
    );
  }

  const { summary, detailed } = progressionReport;

  return (
    <div className="space-y-6">
      
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-teal-600" />
            Learning Journey Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Progress Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{summary.completedStages}</p>
              <p className="text-sm text-gray-600">Completed Stages</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{summary.totalStages}</p>
              <p className="text-sm text-gray-600">Total Stages</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-center gap-1">
                {getTrendIcon(summary.overallTrend)}
                <p className={`text-2xl font-bold ${getTrendColor(summary.overallTrend)}`}>
                  {summary.overallTrend}
                </p>
              </div>
              <p className="text-sm text-gray-600">Overall Trend</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-lg font-bold text-amber-600">
                {summary.currentStage ? STAGE_META[summary.currentStage]?.label : 'None'}
              </p>
              <p className="text-sm text-gray-600">Current Stage</p>
            </div>
          </div>

          {/* Persistent Patterns */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Persistent Strengths
              </h4>
              <div className="flex flex-wrap gap-1">
                {summary.persistentStrengths.map((strength, index) => (
                  <Badge key={index} className="bg-green-100 text-green-800 text-xs">
                    {strength}
                  </Badge>
                ))}
                {summary.persistentStrengths.length === 0 && (
                  <p className="text-sm text-gray-500">Still identifying patterns...</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Areas for Growth
              </h4>
              <div className="flex flex-wrap gap-1">
                {summary.persistentWeaknesses.map((weakness, index) => (
                  <Badge key={index} className="bg-red-100 text-red-800 text-xs">
                    {weakness}
                  </Badge>
                ))}
                {summary.persistentWeaknesses.length === 0 && (
                  <p className="text-sm text-gray-500">No persistent weaknesses identified</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            Stage Progression Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {detailed.stages.map((stage, index) => {
              const stageMeta = STAGE_META[stage.stageId] || {
                label: stage.stageId,
                color: '#6B7280',
                description: 'Unknown stage',
                icon: BookOpen,
              };
              
              const Icon = stageMeta.icon;
              const isCompleted = !!stage.completedAt;
              const isActive = !isCompleted && index === detailed.stages.length - 1;

              return (
                <div key={stage.stageId} className="relative">
                  
                  {/* Connection Line */}
                  {index < detailed.stages.length - 1 && (
                    <div 
                      className="absolute left-6 top-12 w-0.5 h-8 bg-gray-200"
                      style={{ marginLeft: '1px' }}
                    />
                  )}

                  <div className="flex items-start gap-4">
                    
                    {/* Stage Icon */}
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted 
                          ? 'bg-green-100 border-2 border-green-500'
                          : isActive
                          ? 'border-2 animate-pulse'
                          : 'bg-gray-100 border-2 border-gray-300'
                      }`}
                      style={{
                        borderColor: isActive ? stageMeta.color : undefined,
                        backgroundColor: isActive ? `${stageMeta.color}20` : undefined,
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      ) : (
                        <Icon 
                          className="h-6 w-6" 
                          style={{ color: isActive ? stageMeta.color : '#9CA3AF' }}
                        />
                      )}
                    </div>

                    {/* Stage Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-lg font-semibold" style={{ color: stageMeta.color }}>
                          {stageMeta.label}
                        </h3>
                        <div className="text-sm text-gray-500">
                          {formatDate(stage.activatedAt)}
                          {isCompleted && stage.completedAt && (
                            <span> → {formatDate(stage.completedAt)}</span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-2">{stageMeta.description}</p>

                      {/* Stage Status */}
                      <div className="flex items-center gap-2 mb-3">
                        {isCompleted ? (
                          <Badge className="bg-green-100 text-green-800">Completed</Badge>
                        ) : isActive ? (
                          <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Future</Badge>
                        )}
                      </div>

                      {/* Skill Progression Preview */}
                      {stage.skillProgression.length > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Key Skill Development:
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            {stage.skillProgression.slice(0, 6).map((skill, idx) => {
                              const latestMastery = skill.masteryEvolution[skill.masteryEvolution.length - 1];
                              const masteryPercent = Math.round(latestMastery.mastery * 100);
                              
                              return (
                                <div key={idx} className="flex items-center justify-between">
                                  <span className="text-gray-600 truncate">
                                    {skill.skillCategory.split('.').pop()}
                                  </span>
                                  <span className={`font-medium ${
                                    masteryPercent >= 75 ? 'text-green-600' :
                                    masteryPercent >= 50 ? 'text-blue-600' : 'text-amber-600'
                                  }`}>
                                    {masteryPercent}%
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cross-Stage Insights */}
      {detailed.stages.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-teal-600" />
              Cross-Stage Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Skill Transfer Success</h4>
                <p className="text-blue-700 text-sm">
                  Skills learned in earlier stages have successfully transferred to more advanced contexts. 
                  This shows strong foundational learning and adaptability.
                </p>
              </div>
              
              {detailed.persistentStrengths.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Consistent Strengths</h4>
                  <p className="text-green-700 text-sm">
                    These skills remain strong across multiple stages, indicating natural aptitude 
                    and effective learning strategies.
                  </p>
                </div>
              )}

              {detailed.persistentWeaknesses.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg">
                  <h4 className="font-semibold text-amber-800 mb-2">Growth Opportunities</h4>
                  <p className="text-amber-700 text-sm">
                    These areas appear consistently across stages. Focused practice and 
                    targeted strategies could help strengthen these skills.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}