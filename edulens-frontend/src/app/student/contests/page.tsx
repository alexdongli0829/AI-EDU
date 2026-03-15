'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import {
  Trophy, Loader2, Calendar, Clock, CheckCircle2, AlertCircle,
  ChevronRight, BarChart2, Medal, TrendingUp, Lock,
} from 'lucide-react';

// ─── types ────────────────────────────────────────────────────────────────────

interface Contest {
  id: string;
  title: string;
  status: 'draft' | 'open' | 'active' | 'scoring' | 'finalized';
  scheduled_start: string | null;
  scheduled_end: string | null;
  question_count: number;
  series_name: string;
  stage_id: string;
  series_id: string;
  is_registered: boolean;
}

interface ContestResult {
  contestId: string;
  contestTitle: string;
  stageId: string;
  date: string | null;
  score: number;
  totalQuestions: number;
  rank: number | null;
  totalParticipants: number;
  percentile: number;
  scoredAt: string | null;
}

interface HistoryStats {
  contestsParticipated: number;
  avgPercentile: number;
  bestPercentile: number;
  percentileTrend: number[];
}

// ─── constants ────────────────────────────────────────────────────────────────

const STAGE_META: Record<string, { label: string; color: string; light: string; border: string }> = {
  oc_prep:   { label: 'OC Prep',        color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE' },
  selective: { label: 'Selective',      color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE' },
  hsc:       { label: 'HSC',            color: '#0D9488', light: '#F0FDFA', border: '#99F6E4' },
  lifelong:  { label: 'University',     color: '#D97706', light: '#FFFBEB', border: '#FDE68A' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:      { label: 'Open',       color: '#16a34a', bg: '#f0fdf4' },
  active:    { label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  scoring:   { label: 'Scoring',    color: '#7C3AED', bg: '#f5f3ff' },
  finalized: { label: 'Results Out', color: '#0D9488', bg: '#f0fdfa' },
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function percentileLabel(p: number) {
  if (p >= 90) return { text: `Top 10%`, color: '#16a34a' };
  if (p >= 75) return { text: `Top 25%`, color: '#0D9488' };
  if (p >= 50) return { text: `Top 50%`, color: '#d97706' };
  return { text: `${Math.round(p)}th pctile`, color: '#ef4444' };
}

// ─── Mini trend sparkline ─────────────────────────────────────────────────────

function TrendLine({ pts }: { pts: number[] }) {
  if (pts.length < 2) return null;
  const n = pts.length;
  const xS = 2, xE = 60, yT = 2, yB = 18;
  const xOf = (i: number) => xS + i * (xE - xS) / (n - 1);
  const yOf = (v: number) => yB - (Math.min(100, Math.max(0, v)) / 100) * (yB - yT);
  const poly = pts.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 62 20`} className="w-12 h-4">
      <polyline points={poly} fill="none" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((v, i) => <circle key={i} cx={xOf(i)} cy={yOf(v)} r="1.5" fill="#0D9488" />)}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentContestsPage() {
  const router = useRouter();
  const { user, student, isAuthenticated } = useAuthStore();

  const [contests, setContests] = useState<Contest[]>([]);
  const [history, setHistory] = useState<ContestResult[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentId = student?.id ?? null;

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!studentId) return;
    loadAll();
  }, [isAuthenticated, studentId]);

  const loadAll = async () => {
    if (!studentId) return;
    setLoading(true); setError(null);
    try {
      // 1. Get active stage
      const stagesRes = await apiClient.listStudentStages(studentId).catch(() => ({ success: false, stages: [] }));
      const activeStage = stagesRes.success
        ? (stagesRes.stages ?? []).find((s: any) => s.status === 'active')
        : null;
      const stageId = activeStage?.stage_id ?? undefined;
      setActiveStageId(stageId ?? null);

      // 2. Parallel: upcoming contests for their stage + history
      const [contestsRes, historyRes] = await Promise.all([
        apiClient.listContests({
          stageId,
          status: 'open,active,scoring,finalized',
          studentId,
        }).catch(() => ({ success: false, contests: [] })),
        apiClient.getStudentContestHistory(studentId).catch(() => ({ success: false })),
      ]);

      if (contestsRes.success) setContests(contestsRes.contests ?? []);
      if ((historyRes as any).success) {
        setHistory((historyRes as any).history ?? []);
        setStats((historyRes as any).stats ?? null);
      }
    } catch {
      setError('Failed to load contests.');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !student) return null;

  // Build a set of contest IDs the student already completed (only once rule)
  const historyIds = new Set(history.map(h => h.contestId));
  // Split contests: registered upcoming vs unregistered
  const registered = contests.filter(c => c.is_registered && (c.status === 'open' || c.status === 'active' || c.status === 'scoring'));
  const unregistered = contests.filter(c => !c.is_registered && (c.status === 'open' || c.status === 'active'));
  const finalizedRegistered = contests.filter(c => c.is_registered && c.status === 'finalized' && !historyIds.has(c.id));

  const stageMeta = activeStageId ? STAGE_META[activeStageId] : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--parchment)', fontFamily: 'var(--font-body)' }}>

      {/* Page header strip */}
      <div style={{ background: 'var(--oxford-navy)', borderBottom: '2px solid var(--gold)' }}>
        <div className="max-w-2xl mx-auto px-5 py-5">
          <div className="flex items-center gap-2.5 mb-1">
            <Trophy className="h-5 w-5" style={{ color: 'var(--gold-bright)' }} />
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#e8edf4' }}>My Contests</h1>
          </div>
          <p className="text-sm" style={{ color: 'rgba(232,237,244,0.6)' }}>
            {stageMeta
              ? <>Showing contests for <span className="font-semibold" style={{ color: 'var(--gold-bright)' }}>{stageMeta.label}</span></>
              : 'Contests across all stages'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6">

        {error && (
          <div className="mb-5 p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: 'var(--crimson)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--oxford-navy)' }} />
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Stats banner ────────────────────────────────────────────── */}
            {stats && stats.contestsParticipated > 0 && (
              <div className="rounded-xl p-4 border" style={{ background: 'var(--oxford-navy)', borderColor: 'var(--gold)', borderWidth: '1px' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)' }}>Contest Performance</p>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--gold-bright)' }}>{stats.contestsParticipated}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(232,237,244,0.6)' }}>Contests</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--gold-bright)' }}>{Math.round(stats.avgPercentile)}th</p>
                    <p className="text-[10px]" style={{ color: 'rgba(232,237,244,0.6)' }}>Avg Percentile</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: '#fcd34d' }}>{Math.round(stats.bestPercentile)}th</p>
                    <p className="text-[10px]" style={{ color: 'rgba(232,237,244,0.6)' }}>Best</p>
                  </div>
                  {stats.percentileTrend.length >= 2 && (
                    <div className="flex flex-col items-center gap-0.5">
                      <TrendLine pts={stats.percentileTrend} />
                      <p className="text-[10px]" style={{ color: 'rgba(232,237,244,0.5)' }}>Trend</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Registered / Upcoming ───────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)' }}>
                Registered Contests
              </p>
              {registered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                  <Trophy className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-500">No upcoming contests yet</p>
                  <p className="text-xs text-gray-400 mt-1">Your parent will register you when contests open.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {registered.map(c => {
                    const sm = STAGE_META[c.stage_id];
                    const sc = STATUS_CONFIG[c.status] ?? { label: c.status, color: '#6b7280', bg: '#f9fafb' };
                    return (
                      <div key={c.id} className="rounded-xl border p-4" style={{ borderColor: sm?.border ?? '#E5E7EB', backgroundColor: sm?.light ?? '#fff' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: sm?.color ?? '#6b7280' }}>
                                {sm?.label ?? c.stage_id}
                              </span>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: sc.color, backgroundColor: sc.bg }}>
                                {sc.label}
                              </span>
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5" />Registered
                              </span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 truncate">{c.title}</p>
                            <p className="text-[10px] text-gray-400">{c.series_name}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
                          {c.scheduled_start && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(c.scheduled_start)}
                            </span>
                          )}
                          {c.scheduled_end && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Closes {formatDateShort(c.scheduled_end)}
                            </span>
                          )}
                          <span>{c.question_count} questions</span>
                        </div>
                        <div className="mt-3">
                          {historyIds.has(c.id) ? (
                            // Already completed — only once rule
                            <div className="w-full py-2 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed
                            </div>
                          ) : c.status === 'active' || c.status === 'open' ? (
                            <button
                              onClick={() => router.push(`/student/test/take/contest--${c.id}`)}
                              className="w-full py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                              style={{ backgroundColor: sm?.color ?? '#0D9488' }}
                            >
                              {c.status === 'open' ? 'Start Contest' : 'Start Contest Now'}
                            </button>
                          ) : c.status === 'scoring' ? (
                            <div className="w-full py-2 rounded-lg text-xs font-semibold text-center bg-purple-50 text-purple-600 border border-purple-100">
                              Scoring in progress…
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Finalized registered contests waiting for results ─────────── */}
            {finalizedRegistered.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9ca3af', fontFamily: 'var(--font-body)' }}>
                  Awaiting Results
                </p>
                <div className="space-y-2">
                  {finalizedRegistered.map(c => {
                    const sm = STAGE_META[c.stage_id];
                    return (
                      <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                          <BarChart2 className="h-4 w-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{c.title}</p>
                          <p className="text-[10px] text-gray-400">{sm?.label ?? c.stage_id} · {c.series_name}</p>
                        </div>
                        <span className="text-[9px] text-purple-600 bg-purple-50 px-2 py-1 rounded-full font-semibold">Processing</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Contest History ─────────────────────────────────────────── */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)' }}>
                Contest History
              </p>
              {history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                  <Medal className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-500">No contests completed yet</p>
                  <p className="text-xs text-gray-400 mt-1">Results will appear here after contests are scored.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(r => {
                    const sm = STAGE_META[r.stageId];
                    const pct = percentileLabel(r.percentile);
                    const scorePercent = r.totalQuestions > 0
                      ? Math.round((r.score / r.totalQuestions) * 100)
                      : 0;
                    return (
                      <div key={r.contestId} className="rounded-xl border border-gray-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: sm?.color ?? '#6b7280' }}>
                                {sm?.label ?? r.stageId}
                              </span>
                              {r.scoredAt && (
                                <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {formatDate(r.scoredAt)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-gray-900">{r.contestTitle}</p>
                          </div>
                          {/* Percentile badge */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-base font-extrabold" style={{ color: pct.color }}>{pct.text}</p>
                            {r.rank && r.totalParticipants > 0 && (
                              <p className="text-[10px] text-gray-400">Rank {r.rank}/{r.totalParticipants}</p>
                            )}
                          </div>
                        </div>

                        {/* Score bar */}
                        <div className="mb-2">
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-gray-500">Score</span>
                            <span className="font-bold text-gray-700">{r.score}/{r.totalQuestions} <span className="text-gray-400">({scorePercent}%)</span></span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${scorePercent}%`,
                                backgroundColor: sm?.color ?? '#0D9488',
                              }}
                            />
                          </div>
                        </div>

                        {/* Percentile bar */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-gray-500 flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" />Percentile</span>
                            <span className="font-bold" style={{ color: pct.color }}>{Math.round(r.percentile)}th</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${r.percentile}%`, backgroundColor: pct.color }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Other open contests (not registered) ────────────────────── */}
            {unregistered.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#9ca3af', fontFamily: 'var(--font-body)' }}>
                  Other Available Contests
                </p>
                <div className="space-y-2">
                  {unregistered.map(c => {
                    const sm = STAGE_META[c.stage_id];
                    return (
                      <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4 flex items-center gap-3 opacity-60">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Lock className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-700 truncate">{c.title}</p>
                          <p className="text-[10px] text-gray-400">
                            {sm?.label ?? c.stage_id} · {formatDate(c.scheduled_start)}
                          </p>
                        </div>
                        <span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full font-medium flex-shrink-0">Ask parent</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
