'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, ArrowLeft, CheckCircle2, Clock, Lock, ChevronRight, Trophy,
  TrendingUp, AlertTriangle, BarChart2,
} from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────

interface StageProfile {
  overall_mastery?: number;
  strengths?: string[];
  weaknesses?: string[];
}

interface StageRow {
  id: string;
  stage_id: string;
  student_id: string;
  status: 'active' | 'completed' | 'paused';
  display_name: string;
  sort_order: number;
  activated_at: string | null;
  completed_at: string | null;
  stage_profile: StageProfile | string | null;
}

interface ErrorSummary {
  totalResponses: number;
  incorrectResponses: number;
  topPatterns: Array<{ errorType: string; count: number; severity: string }>;
}

// ─── canonical stage metadata ─────────────────────────────────────────────────

const CANONICAL_STAGES = [
  {
    id: 'oc_prep', label: 'OC Preparation', sublabel: 'Year 4–5',
    description: 'NSW Opportunity Class entrance exam preparation. Builds foundation skills in Mathematics, English comprehension, and General Ability.',
    color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE',
    targetExam: 'OC Placement Test',
  },
  {
    id: 'selective', label: 'Selective High School', sublabel: 'Year 6–7',
    description: 'Selective Schools placement test preparation. Deeper analytical and reasoning skills beyond OC level.',
    color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE',
    targetExam: 'Selective Schools Test',
  },
  {
    id: 'hsc', label: 'HSC Preparation', sublabel: 'Year 11–12',
    description: 'Higher School Certificate preparation across all subject areas. ATAR-focused skill development.',
    color: '#0D9488', light: '#F0FDFA', border: '#99F6E4',
    targetExam: 'HSC Examinations',
  },
  {
    id: 'lifelong', label: 'University & Beyond', sublabel: 'Tertiary',
    description: 'Tertiary study preparation and ongoing academic excellence. Learning DNA adapts to higher-order thinking.',
    color: '#D97706', light: '#FFFBEB', border: '#FDE68A',
    targetExam: 'Tertiary Entrance',
  },
];

function parseStageProfile(raw: StageProfile | string | null): StageProfile | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

// ─── inner component ──────────────────────────────────────────────────────────

function JourneyPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightStage = searchParams.get('stage');
  const stageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const studentId = params.studentId as string;
  const { user } = useAuthStore();

  const [studentName, setStudentName] = useState('');
  const [enrolledStages, setEnrolledStages] = useState<StageRow[]>([]);
  const [contestStats, setContestStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  // Stage performance panel
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [errorCache, setErrorCache] = useState<Record<string, ErrorSummary | null>>({});
  const [loadingErrorStage, setLoadingErrorStage] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) { router.replace('/login'); return; }
    loadData();
  }, [studentId]);

  useEffect(() => {
    if (highlightStage && stageRefs.current[highlightStage]) {
      setTimeout(() => {
        stageRefs.current[highlightStage]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
    }
  }, [highlightStage, enrolledStages]);

  // Auto-select the active stage as the performance view
  useEffect(() => {
    if (enrolledStages.length > 0 && !selectedStageId) {
      const active = enrolledStages.find(s => s.status === 'active');
      const first = enrolledStages[0];
      const autoSelect = active ?? first;
      if (autoSelect) {
        setSelectedStageId(autoSelect.stage_id);
        loadErrorsForStage(autoSelect.stage_id);
      }
    }
  }, [enrolledStages]);

  const loadData = async () => {
    try {
      setError(null);
      const [studentRes, stagesRes, historyRes] = await Promise.all([
        user?.id ? apiClient.listStudents(user.id) : Promise.resolve({ success: false }),
        apiClient.listStudentStages(studentId),
        apiClient.getStudentContestHistory(studentId).catch(() => ({ success: false })),
      ]);
      if (studentRes.success) {
        const found = studentRes.students?.find((s: any) => s.id === studentId);
        if (found) setStudentName(found.name);
      }
      if (stagesRes.success) setEnrolledStages(stagesRes.stages || []);
      if ((historyRes as any).success && (historyRes as any).stats?.contestsParticipated > 0) {
        setContestStats((historyRes as any).stats);
      }
    } catch { setError('Failed to load learning journey'); }
    finally { setLoading(false); }
  };

  const loadErrorsForStage = useCallback(async (stageId: string) => {
    if (errorCache[stageId] !== undefined) return; // already cached (null = no data)
    setLoadingErrorStage(stageId);
    try {
      const res = await apiClient.getErrorPatternsAggregate(studentId, 90, stageId);
      if (res.success && res.data) {
        setErrorCache(prev => ({
          ...prev,
          [stageId]: {
            totalResponses: res.data.totalResponses ?? 0,
            incorrectResponses: res.data.incorrectResponses ?? 0,
            topPatterns: (res.data.errorPatterns ?? []).slice(0, 3),
          },
        }));
      } else {
        setErrorCache(prev => ({ ...prev, [stageId]: null }));
      }
    } catch {
      setErrorCache(prev => ({ ...prev, [stageId]: null }));
    } finally {
      setLoadingErrorStage(null);
    }
  }, [studentId, errorCache]);

  const handleSelectStage = (stageId: string) => {
    setSelectedStageId(stageId);
    loadErrorsForStage(stageId);
    // scroll roadmap card into view
    setTimeout(() => {
      stageRefs.current[stageId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const handleActivateStage = async (stageId: string) => {
    const currentActive = enrolledStages.find(s => s.status === 'active');
    if (currentActive && currentActive.stage_id !== stageId) {
      const meta = CANONICAL_STAGES.find(c => c.id === stageId);
      const ok = window.confirm(
        `Switch active stage to "${meta?.label ?? stageId}"? This will deactivate "${currentActive.display_name}". Only one stage can be active at a time.`
      );
      if (!ok) return;
    }
    setActivating(stageId);
    try {
      await apiClient.activateStudentStage(studentId, stageId);
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to activate stage');
    } finally {
      setActivating(null);
    }
  };

  const enrolledMap = Object.fromEntries(enrolledStages.map(s => [s.stage_id, s]));
  const activeStage = enrolledStages.find(s => s.status === 'active');
  const completedCount = enrolledStages.filter(s => s.status === 'completed').length;

  // Only show tabs for enrolled stages, ordered by sort_order
  const tabStages = [...enrolledStages].sort((a, b) => a.sort_order - b.sort_order);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Button size="sm" variant="ghost" onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-bold text-gray-900">
              {studentName ? `${studentName}'s` : ''} Learning Journey
            </h1>
            <p className="text-xs text-gray-400">
              {completedCount > 0 ? `${completedCount} stage${completedCount !== 1 ? 's' : ''} completed · ` : ''}
              {activeStage ? `Active: ${activeStage.display_name}` : 'No active stage yet'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* Contest Performance Banner */}
        {contestStats.contestsParticipated > 0 && (
          <div className="mb-5 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Contest Performance</p>
                <p className="text-xs text-amber-600">
                  {contestStats.contestsParticipated} contests · avg {Math.round(contestStats.avgPercentile)}th percentile
                  {contestStats.bestPercentile >= 90 && <span className="ml-1">· Top 10% achieved!</span>}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline"
              className="border-amber-200 text-amber-700 hover:bg-amber-100"
              onClick={() => router.push(`/parent/contests?studentId=${studentId}`)}>
              View <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Stage Performance Section ─────────────────────────────────────────── */}
        {tabStages.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Stage Performance</p>

            {/* Stage tabs */}
            <div className="flex gap-2 flex-wrap mb-4">
              {tabStages.map(s => {
                const meta = CANONICAL_STAGES.find(c => c.id === s.stage_id);
                const isSelected = selectedStageId === s.stage_id;
                const isActive = s.status === 'active';
                return (
                  <button
                    key={s.stage_id}
                    onClick={() => handleSelectStage(s.stage_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={isSelected ? {
                      backgroundColor: meta?.color ?? '#6B7280',
                      borderColor: meta?.color ?? '#6B7280',
                      color: '#fff',
                    } : {
                      backgroundColor: '#fff',
                      borderColor: meta?.border ?? '#E5E7EB',
                      color: meta?.color ?? '#6B7280',
                    }}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                    {meta?.label ?? s.display_name}
                    {isActive && <span className="text-[8px] opacity-70 ml-0.5">Active</span>}
                  </button>
                );
              })}
            </div>

            {/* Performance panel for selected stage */}
            {selectedStageId && enrolledMap[selectedStageId] && (() => {
              const enrolled = enrolledMap[selectedStageId];
              const meta = CANONICAL_STAGES.find(c => c.id === selectedStageId)!;
              const profile = parseStageProfile(enrolled.stage_profile);
              const mastery = profile?.overall_mastery;
              const strengths = profile?.strengths ?? [];
              const weaknesses = profile?.weaknesses ?? [];
              const isActive = enrolled.status === 'active';
              const isCompleted = enrolled.status === 'completed';
              const errorData = errorCache[selectedStageId];
              const loadingErrors = loadingErrorStage === selectedStageId;
              const errorRate = errorData && errorData.totalResponses > 0
                ? Math.round((errorData.incorrectResponses / errorData.totalResponses) * 100)
                : null;

              return (
                <Card className="border shadow-sm" style={{ borderColor: meta?.border ?? '#E5E7EB' }}>
                  <CardContent className="p-4">
                    {/* Stage header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold" style={{ color: meta?.color }}>
                          {meta?.label ?? enrolled.display_name}
                        </p>
                        <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{meta?.sublabel}</span>
                        {isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: meta?.color }}>
                            Active
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Completed
                          </span>
                        )}
                      </div>
                      {enrolled.activated_at && (
                        <span className="text-[9px] text-gray-400">
                          Since {new Date(enrolled.activated_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                        </span>
                      )}
                    </div>

                    {/* Mastery bar */}
                    {mastery != null ? (
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500 font-medium">Stage Mastery</span>
                          <span className="font-bold" style={{ color: meta?.color }}>{Math.round(mastery * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all"
                            style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: meta?.color }} />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 text-xs text-gray-400">No mastery data yet — complete some tests to build your profile.</div>
                    )}

                    {/* Strengths & weaknesses */}
                    {(strengths.length > 0 || weaknesses.length > 0) && (
                      <div className="grid grid-cols-2 gap-3 mb-4 text-[11px]">
                        {strengths.length > 0 && (
                          <div>
                            <p className="font-bold text-emerald-600 mb-1">Strengths</p>
                            <ul className="text-gray-600 space-y-0.5">
                              {strengths.slice(0, 4).map(s => <li key={s}>· {s}</li>)}
                            </ul>
                          </div>
                        )}
                        {weaknesses.length > 0 && (
                          <div>
                            <p className="font-bold text-orange-500 mb-1">Focus Areas</p>
                            <ul className="text-gray-600 space-y-0.5">
                              {weaknesses.slice(0, 4).map(w => <li key={w}>· {w}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Error summary */}
                    <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Error Summary · Last 90 days</p>
                      </div>
                      {loadingErrors ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading error data…
                        </div>
                      ) : errorData ? (
                        <div>
                          <div className="flex gap-4 text-xs mb-2">
                            <div>
                              <span className="font-bold text-gray-800">{errorData.incorrectResponses}</span>
                              <span className="text-gray-400 ml-1">errors</span>
                              {errorRate !== null && (
                                <span className={`ml-1.5 text-[10px] font-semibold ${errorRate > 40 ? 'text-red-500' : errorRate > 20 ? 'text-amber-500' : 'text-green-600'}`}>
                                  ({errorRate}% error rate)
                                </span>
                              )}
                            </div>
                          </div>
                          {errorData.topPatterns.length > 0 && (
                            <div className="space-y-1">
                              {errorData.topPatterns.map((p, i) => (
                                <div key={i} className="flex items-center justify-between text-[10px]">
                                  <span className="text-gray-600">{p.errorType.replace(/_/g, ' ')}</span>
                                  <span className={`font-semibold ${p.severity === 'high' ? 'text-red-500' : p.severity === 'medium' ? 'text-amber-500' : 'text-gray-500'}`}>
                                    {p.count}× · {p.severity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No error data yet for this stage.</p>
                      )}
                    </div>

                    {/* Action links */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="text-xs h-7 px-3"
                        style={{ backgroundColor: meta?.color, color: '#fff' }}
                        onClick={() => router.push(`/parent/analytics/${studentId}`)}
                      >
                        <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                        Performance Analysis
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-3"
                        style={{ borderColor: meta?.color, color: meta?.color }}
                        onClick={() => router.push(`/parent/students/${studentId}/error-analysis?stage=${selectedStageId}`)}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                        Error Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}

        {/* No enrolled stages prompt */}
        {tabStages.length === 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
            No stage enrolled yet. Activate a stage below to start tracking performance.
          </div>
        )}

        {/* ── Learning Pathway Roadmap ───────────────────────────────────────────── */}
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Learning Pathway</p>
        <div className="space-y-0">
          {CANONICAL_STAGES.map((canonical, idx) => {
            const enrolled = enrolledMap[canonical.id];
            const isActive = enrolled?.status === 'active';
            const isCompleted = enrolled?.status === 'completed';
            const isLocked = !enrolled;
            const isLast = idx === CANONICAL_STAGES.length - 1;
            const isHighlighted = highlightStage === canonical.id || selectedStageId === canonical.id;

            return (
              <div
                key={canonical.id}
                ref={el => { stageRefs.current[canonical.id] = el; }}
                className={`flex gap-4 ${isHighlighted ? 'rounded-xl ring-2 ring-offset-1' : ''}`}
                style={isHighlighted ? { boxShadow: `0 0 0 2px ${canonical.color}60` } : {}}
              >
                {/* Timeline column */}
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 font-bold text-sm ${
                    isCompleted ? 'bg-emerald-100 border-emerald-400 text-emerald-700' :
                    isActive    ? 'border-current bg-white shadow-md' :
                                  'bg-gray-100 border-gray-200 text-gray-300'
                  }`} style={isActive ? { borderColor: canonical.color, color: canonical.color } : {}}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
                     isActive    ? <Clock className="h-4 w-4" /> :
                                   <Lock className="h-3.5 w-3.5" />}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 my-1 rounded-full ${
                      isCompleted ? 'bg-emerald-300' : isActive ? 'bg-gray-200' : 'bg-gray-100'
                    }`} style={{ minHeight: 32 }} />
                  )}
                </div>

                {/* Stage card */}
                <div className="flex-1 pb-5">
                  <Card
                    className={`border transition-all cursor-pointer hover:shadow-sm ${
                      isActive    ? 'shadow-md' :
                      isCompleted ? 'border-emerald-100' :
                                    'border-gray-100 opacity-60'
                    }`}
                    style={isActive ? { borderColor: canonical.color } : {}}
                    onClick={() => enrolled && handleSelectStage(canonical.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm" style={{ color: isLocked ? '#9CA3AF' : canonical.color }}>
                            {canonical.label}
                          </p>
                          <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {canonical.sublabel}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: canonical.color }}>Active</span>
                          )}
                          {isCompleted && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Completed
                            </span>
                          )}
                        </div>
                        {enrolled && (
                          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        )}
                      </div>

                      <p className="text-[9px] text-gray-400 mb-1">{canonical.targetExam}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{canonical.description}</p>

                      {enrolled?.activated_at && (
                        <p className="text-[9px] text-gray-400 mt-1.5">
                          Started {new Date(enrolled.activated_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                          {enrolled.completed_at && ` · Completed ${new Date(enrolled.completed_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}`}
                        </p>
                      )}

                      {/* Quick mastery indicator for enrolled stages */}
                      {enrolled && (() => {
                        const profile = parseStageProfile(enrolled.stage_profile);
                        const mastery = profile?.overall_mastery;
                        if (mastery == null) return null;
                        return (
                          <div className="mt-2">
                            <div className="flex justify-between text-[9px] mb-0.5">
                              <span className="text-gray-400">Mastery</span>
                              <span className="font-semibold" style={{ color: canonical.color }}>{Math.round(mastery * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1">
                              <div className="h-1 rounded-full" style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: canonical.color }} />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Activate / switch buttons */}
                      {isLocked && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                            <Lock className="h-3 w-3" />
                            <span>Learning DNA carries forward from previous stages</span>
                          </div>
                          <Button
                            size="sm" variant="outline"
                            className="text-[10px] h-6 px-2 shrink-0"
                            style={{ borderColor: canonical.color, color: canonical.color }}
                            disabled={activating === canonical.id}
                            onClick={e => { e.stopPropagation(); handleActivateStage(canonical.id); }}
                          >
                            {activating === canonical.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Set as Active'}
                          </Button>
                        </div>
                      )}
                      {!isLocked && !isActive && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm" variant="outline"
                            className="text-[10px] h-6 px-2"
                            style={{ borderColor: canonical.color, color: canonical.color }}
                            disabled={activating === canonical.id}
                            onClick={e => { e.stopPropagation(); handleActivateStage(canonical.id); }}
                          >
                            {activating === canonical.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Switch to this Stage'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>

        {/* DNA Carry-over note */}
        <div className="mt-4 p-4 bg-gray-50 border border-gray-100 rounded-xl">
          <p className="text-xs font-semibold text-gray-700 mb-1">About Learning DNA</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            EduLens tracks skill patterns, error tendencies, and time behaviour across every stage.
            When {studentName || 'your child'} moves from OC Prep to Selective, their learning profile carries forward —
            so the new stage starts with deep context, not from zero.
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── export ───────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    }>
      <JourneyPageInner />
    </Suspense>
  );
}
