'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, CheckCircle2, Clock, Lock, ChevronRight, Trophy } from 'lucide-react';

interface StageRow {
  id: string; stage_id: string; student_id: string;
  status: 'active' | 'completed' | 'paused';
  display_name: string; sort_order: number;
  activated_at: string | null; completed_at: string | null;
  stage_profile: {
    overall_mastery?: number; strengths?: string[]; weaknesses?: string[];
  } | null;
}

// The full canonical pathway — all stages shown even if not enrolled
const CANONICAL_STAGES = [
  {
    id: 'oc_prep', label: 'OC Preparation', sublabel: 'Year 4–5',
    description: 'NSW Opportunity Class entrance exam preparation. Builds foundation skills in Mathematics, English comprehension, and General Ability.',
    color: '#2563EB', light: '#EFF6FF', border: '#BFDBFE',
    targetExam: 'OC Placement Test',
  },
  {
    id: 'selective_prep', label: 'Selective High School', sublabel: 'Year 6–7',
    description: 'Selective Schools placement test preparation. Deeper analytical and reasoning skills beyond OC level.',
    color: '#7C3AED', light: '#F5F3FF', border: '#DDD6FE',
    targetExam: 'Selective Schools Test',
  },
  {
    id: 'hsc_prep', label: 'HSC Preparation', sublabel: 'Year 11–12',
    description: 'Higher School Certificate preparation across all subject areas. ATAR-focused skill development.',
    color: '#0D9488', light: '#F0FDFA', border: '#99F6E4',
    targetExam: 'HSC Examinations',
  },
  {
    id: 'university', label: 'University & Beyond', sublabel: 'Tertiary',
    description: 'Tertiary study preparation and ongoing academic excellence. Learning DNA adapts to higher-order thinking.',
    color: '#D97706', light: '#FFFBEB', border: '#FDE68A',
    targetExam: 'Tertiary Entrance',
  },
];

export default function StudentJourneyPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const { user } = useAuthStore();

  const [studentName, setStudentName] = useState('');
  const [enrolledStages, setEnrolledStages] = useState<StageRow[]>([]);
  const [contestStats, setContestStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [studentId]);

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
      if (historyRes.success && historyRes.stats?.contestsParticipated > 0) {
        setContestStats(historyRes.stats);
      }
    } catch { setError('Failed to load learning journey'); }
    finally { setLoading(false); }
  };

  const enrolledMap = Object.fromEntries(enrolledStages.map(s => [s.stage_id, s]));
  const activeStage = enrolledStages.find(s => s.status === 'active');
  const completedCount = enrolledStages.filter(s => s.status === 'completed').length;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button size="sm" variant="ghost" onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-bold text-gray-900">
              {studentName ? `${studentName}'s` : ''} Learning Journey
            </h1>
            <p className="text-xs text-gray-400">
              {completedCount > 0 ? `${completedCount} stage${completedCount !== 1 ? 's' : ''} completed · ` : ''}
              {activeStage ? `Currently: ${activeStage.display_name}` : 'No active stage yet'}
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
                  {contestStats.bestPercentile >= 90 && <span className="ml-1">· 🏆 Top 10% achieved!</span>}
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

        {/* Visual Roadmap */}
        <div className="space-y-0">
          {CANONICAL_STAGES.map((canonical, idx) => {
            const enrolled = enrolledMap[canonical.id];
            const isActive = enrolled?.status === 'active';
            const isCompleted = enrolled?.status === 'completed';
            const isLocked = !enrolled;
            const mastery = enrolled?.stage_profile?.overall_mastery;
            const strengths = enrolled?.stage_profile?.strengths || [];
            const weaknesses = enrolled?.stage_profile?.weaknesses || [];
            const isLast = idx === CANONICAL_STAGES.length - 1;

            return (
              <div key={canonical.id} className="flex gap-4">
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
                <div className={`flex-1 pb-5 ${isLast ? '' : ''}`}>
                  <Card className={`border transition-all ${
                    isActive    ? 'shadow-md' :
                    isCompleted ? 'border-emerald-100' :
                                  'border-gray-100 opacity-60'
                  }`} style={isActive ? { borderColor: canonical.color } : {}}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="flex items-center gap-2">
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
                          <p className="text-[9px] text-gray-400 mt-0.5">{canonical.targetExam}</p>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500 leading-relaxed mb-3">{canonical.description}</p>

                      {/* Enrolled stage details */}
                      {enrolled && (
                        <>
                          {enrolled.activated_at && (
                            <p className="text-[9px] text-gray-400 mb-2">
                              Started {new Date(enrolled.activated_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                              {enrolled.completed_at && ` · Completed ${new Date(enrolled.completed_at).toLocaleDateString('en-AU', { dateStyle: 'medium' })}`}
                            </p>
                          )}

                          {mastery != null && (
                            <div className="mb-3">
                              <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-gray-400 font-medium">Stage Mastery</span>
                                <span className="font-bold" style={{ color: canonical.color }}>{Math.round(mastery * 100)}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.round(mastery * 100)}%`, backgroundColor: canonical.color }} />
                              </div>
                            </div>
                          )}

                          {(strengths.length > 0 || weaknesses.length > 0) && (
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              {strengths.length > 0 && (
                                <div>
                                  <p className="font-semibold text-emerald-600 mb-0.5">Strengths</p>
                                  <ul className="text-gray-500 space-y-0.5">
                                    {strengths.slice(0, 3).map((s: string) => <li key={s}>· {s}</li>)}
                                  </ul>
                                </div>
                              )}
                              {weaknesses.length > 0 && (
                                <div>
                                  <p className="font-semibold text-orange-500 mb-0.5">Focus Areas</p>
                                  <ul className="text-gray-500 space-y-0.5">
                                    {weaknesses.slice(0, 3).map((w: string) => <li key={w}>· {w}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {isLocked && (
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-1">
                          <Lock className="h-3 w-3" />
                          <span>Unlocks when ready · Learning DNA carries forward from previous stages</span>
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
