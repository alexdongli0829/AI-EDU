'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Trophy, Calendar, Users, CheckCircle2, Clock,
  ArrowLeft, TrendingUp, Star, ChevronRight, Target,
} from 'lucide-react';

interface ContestRow {
  id: string; title: string; status: string;
  scheduled_start: string | null; scheduled_end: string | null;
  series_name: string; stage_id: string; total_participants: number | null; avg_score: number | null;
}

interface ContestHistoryRow {
  contestId: string; contestTitle: string; stageId: string;
  date: string; score: number; totalQuestions: number;
  rank: number; totalParticipants: number; percentile: number;
}

interface Student { id: string; name: string; }

type Tab = 'upcoming' | 'history';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open:      { label: 'Open for Registration', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    active:    { label: 'In Progress',            cls: 'bg-teal-50 text-teal-700 border-teal-200' },
    finalized: { label: 'Results Available',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    scoring:   { label: 'Calculating Results',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    draft:     { label: 'Draft',                  cls: 'bg-gray-100 text-gray-400 border-gray-200' },
  };
  const ui = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ui.cls}`}>{ui.label}</span>;
}

function PercentileBar({ percentile }: { percentile: number }) {
  const color = percentile >= 80 ? '#10B981' : percentile >= 60 ? '#0D9488' : percentile >= 40 ? '#D97706' : '#EF4444';
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-400">Percentile</span>
        <span className="font-bold" style={{ color }}>Top {Math.round(100 - percentile)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${percentile}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function PercentileTrend({ trend }: { trend: number[] }) {
  if (trend.length < 2) return null;
  const n = trend.length;
  const xS = 4, xE = 196, yT = 2, yB = 22;
  const xOf = (i: number) => xS + i * (xE - xS) / (n - 1);
  const yOf = (v: number) => yB - (Math.max(0, Math.min(100, v)) / 100) * (yB - yT);
  const poly = trend.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  const latest = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta = latest - prev;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 200 24" className="flex-1 h-6">
        <polyline points={poly} fill="none" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {trend.map((v, i) => <circle key={i} cx={xOf(i)} cy={yOf(v)} r="2" fill="#0D9488" />)}
      </svg>
      <span className={`text-xs font-bold ${delta >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
        {delta >= 0 ? '↑' : '↓'}{Math.abs(Math.round(delta))}%
      </span>
    </div>
  );
}

function ContestsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<Tab>('upcoming');
  const [contests, setContests] = useState<ContestRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [history, setHistory] = useState<ContestHistoryRow[]>([]);
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [registeringMap, setRegisteringMap] = useState<Record<string, boolean>>({});
  const [registeredMap, setRegisteredMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    const preselect = searchParams.get('studentId');
    loadData(preselect || undefined);
  }, [user]);

  useEffect(() => {
    if (selectedStudentId) loadHistory(selectedStudentId);
  }, [selectedStudentId]);

  const loadData = async (preselectStudentId?: string) => {
    try {
      setError(null);
      const [contestsRes, studentsRes] = await Promise.all([
        apiClient.listContests({ status: 'open,active,finalized,scoring' }),
        user?.id ? apiClient.listStudents(user.id) : Promise.resolve({ success: false }),
      ]);
      if (contestsRes.success) setContests(contestsRes.contests || []);
      if (studentsRes.success) {
        const list = studentsRes.students || [];
        setStudents(list);
        const sid = preselectStudentId || list[0]?.id || '';
        setSelectedStudentId(sid);
      }
    } catch { setError('Failed to load contests'); }
    finally { setLoading(false); }
  };

  const loadHistory = async (studentId: string) => {
    setHistoryLoading(true);
    try {
      const res = await apiClient.getStudentContestHistory(studentId);
      if (res.success) {
        setHistory(res.history || []);
        setHistoryStats(res.stats || null);
      }
    } catch {}
    finally { setHistoryLoading(false); }
  };

  const handleRegister = async (contestId: string) => {
    if (!selectedStudentId) return;
    setRegisteringMap(prev => ({ ...prev, [contestId]: true }));
    try {
      await apiClient.registerContest(contestId, selectedStudentId);
      setRegisteredMap(prev => ({ ...prev, [contestId]: true }));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Registration failed');
    } finally {
      setRegisteringMap(prev => ({ ...prev, [contestId]: false }));
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => router.push('/parent/dashboard')} className="p-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Contests
              </h1>
              <p className="text-xs text-gray-400">Weekly competitions · Real peer ranking</p>
            </div>
          </div>
          {students.length > 0 && (
            <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500">
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* Contest History Stats Banner */}
        {historyStats && historyStats.contestsParticipated > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-amber-800">
                {selectedStudent?.name}'s Contest Performance
              </p>
              <button onClick={() => setTab('history')}
                className="text-[10px] text-amber-600 font-semibold hover:underline flex items-center gap-0.5">
                View history <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-amber-700">{historyStats.contestsParticipated}</p>
                <p className="text-[9px] text-amber-500">Contests</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-700">{Math.round(historyStats.avgPercentile)}%</p>
                <p className="text-[9px] text-amber-500">Avg Percentile</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-700">{Math.round(historyStats.bestPercentile)}%</p>
                <p className="text-[9px] text-amber-500">Best Percentile</p>
              </div>
            </div>
            {historyStats.percentileTrend?.length >= 2 && (
              <div className="mt-3">
                <p className="text-[9px] text-amber-500 mb-1">Percentile trend (recent)</p>
                <PercentileTrend trend={historyStats.percentileTrend} />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-5">
          {([
            { key: 'upcoming', label: 'Upcoming & Open' },
            { key: 'history',  label: `History${historyStats?.contestsParticipated ? ` (${historyStats.contestsParticipated})` : ''}` },
          ] as { key: Tab; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* UPCOMING TAB */}
        {tab === 'upcoming' && (
          <>
            {contests.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-14 text-center">
                  <Trophy className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500">No contests available right now.</p>
                  <p className="text-xs text-gray-400 mt-1">Check back soon — weekly contests are added every week.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {contests.map(contest => {
                  const isRegistered = registeredMap[contest.id];
                  const isRegistering = registeringMap[contest.id];
                  const canRegister = contest.status === 'open' && !isRegistered;
                  return (
                    <Card key={contest.id} className={`border transition-shadow hover:shadow-sm ${
                      contest.status === 'open' ? 'border-emerald-200' :
                      contest.status === 'active' ? 'border-teal-200' : 'border-gray-200'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-sm text-gray-900">{contest.title}</p>
                              <StatusBadge status={contest.status} />
                            </div>
                            <p className="text-[10px] text-gray-400">{contest.series_name} · {contest.stage_id}</p>
                          </div>
                        </div>

                        <div className="flex gap-3 text-[10px] text-gray-500 mb-3 flex-wrap">
                          {contest.scheduled_start && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(contest.scheduled_start).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                              {contest.scheduled_end && ` → ${new Date(contest.scheduled_end).toLocaleTimeString('en-AU', { timeStyle: 'short' })}`}
                            </span>
                          )}
                          {contest.total_participants != null && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {contest.total_participants} registered
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isRegistered ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Registered ✓
                            </span>
                          ) : canRegister ? (
                            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white h-7 text-xs"
                              onClick={() => handleRegister(contest.id)}
                              disabled={isRegistering || !selectedStudentId}>
                              {isRegistering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Trophy className="h-3 w-3 mr-1" />Register {selectedStudent?.name}</>}
                            </Button>
                          ) : contest.status === 'active' ? (
                            <span className="flex items-center gap-1 text-xs text-teal-600 font-semibold">
                              <Clock className="h-3.5 w-3.5 animate-pulse" /> Contest is live now
                            </span>
                          ) : null}
                          {contest.status === 'finalized' && selectedStudentId && (
                            <Button size="sm" variant="outline"
                              className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                              onClick={() => router.push(`/parent/contests/${contest.id}/results?studentId=${selectedStudentId}`)}>
                              <Star className="h-3 w-3 mr-1" />View My Results
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <>
            {historyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : history.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="py-14 text-center">
                  <Target className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500">{selectedStudent?.name} hasn't entered any contests yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Register for an upcoming contest to see results here.</p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={() => setTab('upcoming')}>
                    View Upcoming Contests
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map(r => {
                  const scorePct = r.totalQuestions > 0 ? Math.round((r.score / r.totalQuestions) * 100) : 0;
                  return (
                    <Card key={r.contestId} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{r.contestTitle}</p>
                            <p className="text-[10px] text-gray-400">
                              {r.stageId} · {new Date(r.date).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{r.score}/{r.totalQuestions}</p>
                            <p className="text-[10px] text-gray-400">{scorePct}%</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-gray-50 rounded-lg p-2.5">
                            <p className="text-[9px] text-gray-400 mb-0.5">Rank</p>
                            <p className="text-base font-bold text-gray-900">
                              #{r.rank} <span className="text-xs font-normal text-gray-400">of {r.totalParticipants}</span>
                            </p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                            <p className="text-[9px] text-amber-500 mb-0.5">Percentile</p>
                            <p className="text-base font-bold text-amber-700">
                              {Math.round(r.percentile)}th
                              <span className="text-[9px] font-normal text-amber-400 ml-1">
                                Top {Math.round(100 - r.percentile)}%
                              </span>
                            </p>
                          </div>
                        </div>
                        <PercentileBar percentile={r.percentile} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ContestsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" /></div>}>
      <ContestsPageInner />
    </Suspense>
  );
}
