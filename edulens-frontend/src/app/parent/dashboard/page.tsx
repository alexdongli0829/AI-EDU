'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { studentAnalyticsService, StudentAnalytics } from '@/services/student-analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus, MessageCircle, Trash2, GraduationCap, Loader2,
  ChevronRight, AlertTriangle, Route, Trophy, ArrowRight,
  Target, TrendingUp, Lock,
} from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface StudentProfile {
  id: string; userId: string; name: string; username: string;
  gradeLevel: number; dateOfBirth: string; parentId: string;
  createdAt: string; testsCompleted: number;
}

interface StageEnrollment {
  stage_id: string; status: string; display_name: string; sort_order: number;
}

// The canonical learning pathway
const PATHWAY = [
  { id: 'oc_prep',        label: 'OC Prep',    sublabel: 'Yr 4–5', color: '#2563EB' },
  { id: 'selective_prep', label: 'Selective',  sublabel: 'Yr 6–7', color: '#7C3AED' },
  { id: 'hsc_prep',       label: 'HSC',        sublabel: 'Yr 11+', color: '#0D9488' },
  { id: 'university',     label: 'University', sublabel: 'Beyond', color: '#D97706' },
];

const SUBJECTS = [
  { key: 'math' as const, label: 'Math', color: '#2563EB' },
  { key: 'thinking' as const, label: 'Thinking', color: '#7C3AED' },
  { key: 'reading' as const, label: 'English', color: '#0D9488' },
];

function ScoreChip({ score }: { score: number }) {
  const color = score >= 75 ? 'text-green-600' : score >= 55 ? 'text-amber-600' : 'text-red-500';
  return <span className={`text-lg font-extrabold tabular-nums ${color}`}>{score}%</span>;
}

// Journey strip for a single student
function JourneyStrip({ stages, activeStageId }: { stages: StageEnrollment[]; activeStageId?: string }) {
  const enrolledMap = Object.fromEntries(stages.map(s => [s.stage_id, s]));
  return (
    <div className="flex items-center gap-1 py-2">
      {PATHWAY.map((p, idx) => {
        const enrolled = enrolledMap[p.id];
        const isActive = enrolled?.status === 'active';
        const isCompleted = enrolled?.status === 'completed';
        const isLocked = !enrolled;
        return (
          <div key={p.id} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold border transition-all ${
              isActive    ? 'bg-white border-current shadow-sm' :
              isCompleted ? 'border-transparent opacity-70' :
                            'border-transparent opacity-35'
            }`} style={{ color: isLocked ? '#9CA3AF' : p.color, borderColor: isActive ? p.color : undefined }}>
              {isLocked && <Lock className="h-2.5 w-2.5" />}
              {isCompleted && <span className="text-emerald-500 mr-0.5">✓</span>}
              <span>{p.label}</span>
              <span className="opacity-60 ml-0.5">{p.sublabel}</span>
            </div>
            {idx < PATHWAY.length - 1 && (
              <ArrowRight className="h-2.5 w-2.5 text-gray-200 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ParentDashboard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, StudentAnalytics>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState<Record<string, boolean>>({});
  const [stageMap, setStageMap] = useState<Record<string, StageEnrollment[]>>({});
  const [contestMap, setContestMap] = useState<Record<string, any>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', gradeLevel: 4, dateOfBirth: '', username: '', password: '' });

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'parent') { router.push('/login'); return; }
    loadStudents();
  }, [isAuthenticated, user, router]);

  const loadStudents = async () => {
    if (!user?.id) return;
    setLoading(true); setError(null);
    try {
      const response = await apiClient.listStudents(user.id);
      if (response.success) {
        const list: StudentProfile[] = response.students;
        setStudents(list);
        const loadingState: Record<string, boolean> = {};
        list.forEach(s => { loadingState[s.id] = true; });
        setAnalyticsLoading(loadingState);

        list.forEach(s => {
          // Analytics
          studentAnalyticsService.getStudentAnalytics(s.id)
            .then(a => setAnalyticsMap(prev => ({ ...prev, [s.id]: a })))
            .catch(() => {})
            .finally(() => setAnalyticsLoading(prev => ({ ...prev, [s.id]: false })));

          // Stage enrollments
          apiClient.listStudentStages(s.id)
            .then((res: any) => {
              if (res.success) setStageMap(prev => ({ ...prev, [s.id]: res.stages || [] }));
            })
            .catch(() => {});

          // Contest history (stats only)
          apiClient.getStudentContestHistory(s.id)
            .then((res: any) => {
              if (res.success && res.stats?.contestsParticipated > 0) {
                setContestMap(prev => ({ ...prev, [s.id]: res.stats }));
              }
            })
            .catch(() => {});
        });
      }
    } catch {
      setError('Failed to load student profiles. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setCreating(true); setError(null);
    try {
      const response = await apiClient.createStudent({
        parentId: user.id, name: formData.name,
        username: formData.username.toLowerCase().replace(/\s/g, ''),
        password: formData.password, gradeLevel: formData.gradeLevel, dateOfBirth: formData.dateOfBirth,
      });
      if (response.success) {
        await loadStudents();
        setFormData({ name: '', gradeLevel: 4, dateOfBirth: '', username: '', password: '' });
        setShowCreateForm(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create student profile.');
    } finally {
      setCreating(false);
    }
  };

  const calculateAge = (dob: string) => {
    const today = new Date(), birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() - birth.getMonth() < 0 || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-bold text-gray-900">Children's Overview</h1>
            <p className="text-xs text-gray-400">
              {students.length} profile{students.length !== 1 ? 's' : ''} · OC, Selective & HSC preparation
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push('/parent/contests')}
              className="border-amber-200 text-amber-700 hover:bg-amber-50">
              <Trophy className="h-4 w-4 mr-1.5" />Contests
            </Button>
            <Button size="sm" onClick={() => router.push('/parent/chat')} className="bg-teal-600 hover:bg-teal-700">
              <MessageCircle className="h-4 w-4 mr-1.5" />AI Advisor
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Add Child
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
            {error}<button onClick={() => setError(null)} className="underline ml-4">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        ) : students.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-base font-semibold text-gray-700 mb-1">No student profiles yet</h3>
              <p className="text-sm text-gray-400 mb-5">Create a profile for your child to start their learning journey — OC, Selective, or HSC.</p>
              <Button onClick={() => setShowCreateForm(true)}><Plus className="h-4 w-4 mr-2" />Add First Child</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {students.map(student => {
              const a = analyticsMap[student.id];
              const isLoading = analyticsLoading[student.id];
              const hasData = a && a.totalTests > 0;
              const stages = stageMap[student.id] || [];
              const activeStage = stages.find(s => s.status === 'active');
              const contestStats = contestMap[student.id];

              return (
                <Card key={student.id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    {/* Card header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900">{student.name}</p>
                            {activeStage && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                                {activeStage.display_name || activeStage.stage_id}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            Grade {student.gradeLevel}
                            {student.dateOfBirth ? ` · Age ${calculateAge(student.dateOfBirth)}` : ''}
                          </p>
                        </div>
                      </div>
                      <button onClick={async () => {
                        if (!user?.id) return;
                        if (!confirm('Delete this profile? This cannot be undone.')) return;
                        try { await apiClient.deleteStudent(student.id, user.id); await loadStudents(); }
                        catch (err: any) { setError(err.response?.data?.error || 'Failed to delete.'); }
                      }} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Learning Journey strip */}
                    <div className="mb-3 bg-gray-50 rounded-lg px-2">
                      <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wide pt-2">Learning Journey</p>
                      <JourneyStrip stages={stages} activeStageId={activeStage?.stage_id} />
                    </div>

                    {/* Analytics */}
                    {isLoading ? (
                      <div className="flex items-center gap-2 py-3 text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Loading performance data…</span>
                      </div>
                    ) : !hasData ? (
                      <div className="py-3 px-3 bg-gray-50 rounded-lg mb-3">
                        <p className="text-xs text-gray-400 text-center">No tests completed yet · Start a practice session</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-lg font-extrabold text-teal-600">{a.totalTests}</p>
                            <p className="text-[9px] text-gray-400">Tests Done</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <ScoreChip score={a.averageScore} />
                            <p className="text-[9px] text-gray-400">Avg Score</p>
                          </div>
                          {contestStats ? (
                            <div className="bg-amber-50 rounded-lg p-2 text-center border border-amber-100">
                              <p className="text-lg font-extrabold text-amber-600">{contestStats.avgPercentile}%</p>
                              <p className="text-[9px] text-amber-500">Avg Percentile</p>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-xs font-bold text-gray-500 mt-1 leading-tight">{a.lastTestDate}</p>
                              <p className="text-[9px] text-gray-400">Last Active</p>
                            </div>
                          )}
                        </div>

                        {/* Radar chart */}
                        <div className="h-40 mb-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={[
                              { subject: 'Math', value: a.learningDNA.math },
                              { subject: 'Thinking', value: a.learningDNA.thinking },
                              { subject: 'English', value: a.learningDNA.reading },
                            ]}>
                              <PolarGrid stroke="#e5e7eb" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                              <Radar dataKey="value" stroke="#0D9488" fill="#0D9488" fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Score trends */}
                        <div className="space-y-2 mb-3">
                          {SUBJECTS.map(({ key, label, color }) => {
                            const pts = a.scoreTrend[key];
                            if (pts.length === 0) return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold w-14" style={{ color }}>{label}</span>
                                <span className="text-[10px] text-gray-300">No tests yet</span>
                              </div>
                            );
                            const n = pts.length;
                            const xS = 4, xE = 296, yT = 4, yB = 28;
                            const xOf = (i: number) => n === 1 ? (xS + xE) / 2 : xS + i * (xE - xS) / (n - 1);
                            const yOf = (s: number) => yB - (Math.min(100, Math.max(0, s)) / 100) * (yB - yT);
                            const poly = pts.map((p, i) => `${xOf(i)},${yOf(p.score)}`).join(' ');
                            const latest = pts[pts.length - 1].score;
                            return (
                              <div key={key}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[10px] font-semibold w-14" style={{ color }}>{label}</span>
                                  <span className="text-[10px] font-extrabold" style={{ color }}>{latest}%</span>
                                </div>
                                <svg viewBox="0 0 300 32" className="w-full h-7">
                                  <line x1="0" y1={yOf(70)} x2="300" y2={yOf(70)} stroke="#F3F4F6" strokeWidth="1" />
                                  {n > 1 && <polyline points={poly} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                                  {pts.map((p, i) => <circle key={i} cx={xOf(i)} cy={yOf(p.score)} r="2" fill={color} />)}
                                </svg>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700"
                        onClick={() => router.push(`/parent/analytics/${student.id}`)}>
                        Performance Overview <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <div className="grid grid-cols-3 gap-2">
                        <Button size="sm" variant="outline"
                          className="border-orange-200 text-orange-700 hover:bg-orange-50"
                          onClick={() => router.push(`/parent/students/${student.id}/error-analysis`)}>
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />Errors
                        </Button>
                        <Button size="sm" variant="outline"
                          className="border-violet-200 text-violet-700 hover:bg-violet-50"
                          onClick={() => router.push(`/parent/students/${student.id}/journey`)}>
                          <Route className="h-3.5 w-3.5 mr-1" />Journey
                        </Button>
                        <Button size="sm" variant="outline"
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                          onClick={() => router.push(`/parent/contests?studentId=${student.id}`)}>
                          <Trophy className="h-3.5 w-3.5 mr-1" />Contests
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Student Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h2 className="text-base font-bold text-gray-900 mb-1">Add Child Profile</h2>
              <p className="text-xs text-gray-400 mb-4">Create a learning profile for your child. They can log in with their username and password.</p>
              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Student Name</label>
                  <Input required placeholder="Full name" value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Grade</label>
                    <select value={formData.gradeLevel}
                      onChange={e => setFormData({ ...formData, gradeLevel: parseInt(e.target.value) })}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                      {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1}>Grade {i + 1}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Date of Birth</label>
                    <Input type="date" required value={formData.dateOfBirth}
                      onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Username</label>
                  <Input required placeholder="Student login username" value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Password</label>
                  <Input type="password" required placeholder="Student password" value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1"
                    onClick={() => { setShowCreateForm(false); setError(null); }}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={creating}>
                    {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Profile'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
