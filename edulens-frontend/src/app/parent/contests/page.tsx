'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trophy, Calendar, Users, CheckCircle2, Clock, ArrowLeft } from 'lucide-react';

interface ContestRow {
  id: string;
  title: string;
  status: string;
  test_format: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  registration_deadline: string | null;
  max_participants: number | null;
  series_name: string;
  stage_id: string;
}

interface Student {
  id: string;
  name: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open:      { label: 'Open',      cls: 'bg-emerald-50 text-emerald-700' },
    active:    { label: 'Active',    cls: 'bg-teal-50 text-teal-700' },
    finalized: { label: 'Results',   cls: 'bg-blue-50 text-blue-700' },
    scoring:   { label: 'Scoring',   cls: 'bg-amber-50 text-amber-700' },
    draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-400' },
  };
  const ui = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ui.cls}`}>{ui.label}</span>;
}

export default function ContestsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [contests, setContests] = useState<ContestRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringMap, setRegisteringMap] = useState<Record<string, boolean>>({});
  const [registeredMap, setRegisteredMap] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setError(null);
      const [contestsRes, studentsRes] = await Promise.all([
        apiClient.listContests({ status: 'open,active,finalized' }),
        user?.id ? apiClient.listStudents(user.id) : Promise.resolve({ success: false }),
      ]);

      if (contestsRes.success) setContests(contestsRes.contests || []);
      if (studentsRes.success) {
        setStudents(studentsRes.students || []);
        if (studentsRes.students?.length) setSelectedStudentId(studentsRes.students[0].id);
      }
    } catch {
      setError('Failed to load contests');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (contestId: string) => {
    if (!selectedStudentId) return;
    setRegisteringMap(prev => ({ ...prev, [contestId]: true }));
    try {
      await apiClient.registerContest(contestId, selectedStudentId);
      setRegisteredMap(prev => ({ ...prev, [contestId]: true }));
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Registration failed';
      alert(msg);
    } finally {
      setRegisteringMap(prev => ({ ...prev, [contestId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" onClick={() => router.push('/parent/dashboard')} className="p-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Contests
              </h1>
              <p className="text-xs text-gray-400">Competitive assessments for your child</p>
            </div>
          </div>

          {/* Student selector */}
          {students.length > 1 && (
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {/* Contest cards */}
        {contests.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-14 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No contests available right now.</p>
              <p className="text-xs text-gray-400 mt-1">Check back soon for upcoming competitions.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {contests.map(contest => {
              const isRegistered = registeredMap[contest.id];
              const isRegistering = registeringMap[contest.id];
              const canRegister = contest.status === 'open' && !isRegistered;

              return (
                <Card key={contest.id} className="border border-gray-200 hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-sm text-gray-900">{contest.title}</p>
                          <StatusBadge status={contest.status} />
                        </div>
                        <p className="text-[10px] text-gray-400">{contest.series_name} · {contest.stage_id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3 text-[10px] text-gray-500">
                      {contest.scheduled_start && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(contest.scheduled_start).toLocaleDateString()}
                        </div>
                      )}
                      {contest.registration_deadline && contest.status === 'open' && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Reg. by {new Date(contest.registration_deadline).toLocaleDateString()}
                        </div>
                      )}
                      {contest.max_participants && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Max {contest.max_participants}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isRegistered ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Registered
                        </span>
                      ) : canRegister ? (
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-7"
                          onClick={() => handleRegister(contest.id)}
                          disabled={isRegistering || !selectedStudentId}
                        >
                          {isRegistering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Register'}
                        </Button>
                      ) : contest.status === 'finalized' && selectedStudentId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => router.push(`/parent/contests/${contest.id}/results/${selectedStudentId}`)}
                        >
                          View Results
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
