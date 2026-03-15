'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, CheckCircle2, Clock, Lock, ChevronRight } from 'lucide-react';

interface StageRow {
  id: string;
  stage_id: string;
  student_id: string;
  status: 'active' | 'completed' | 'paused';
  display_name: string;
  sort_order: number;
  activated_at: string | null;
  completed_at: string | null;
  stage_profile: {
    overall_mastery?: number;
    strengths?: string[];
    weaknesses?: string[];
    skill_graph?: Record<string, any>;
  } | null;
}

function StageBadge({ status }: { status: string }) {
  if (status === 'completed') return (
    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-3 w-3" /> Completed
    </span>
  );
  if (status === 'active') return (
    <span className="flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
      <Clock className="h-3 w-3" /> Active
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
      <Lock className="h-3 w-3" /> Not started
    </span>
  );
}

export default function StudentJourneyPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;
  const { user } = useAuthStore();

  const [studentName, setStudentName] = useState('');
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = async () => {
    try {
      setError(null);

      const [studentRes, stagesRes] = await Promise.all([
        user?.id ? apiClient.listStudents(user.id) : Promise.resolve({ success: false }),
        apiClient.listStudentStages(studentId),
      ]);

      if (studentRes.success) {
        const found = studentRes.students?.find((s: any) => s.id === studentId);
        if (found) setStudentName(found.name);
      }

      if (stagesRes.success) {
        setStages(stagesRes.stages || []);
      }
    } catch (err: any) {
      setError('Failed to load learning journey');
    } finally {
      setLoading(false);
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
        <div className="flex items-center gap-3 mb-6">
          <Button size="sm" variant="ghost" onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-bold text-gray-900">
              {studentName ? `${studentName}'s` : ''} Learning Journey
            </h1>
            <p className="text-xs text-gray-400">Stage progression across the EduLens pathway</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Stage timeline */}
        <div className="space-y-3">
          {stages.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <Lock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">No stages enrolled yet.</p>
                <p className="text-xs text-gray-400 mt-1">Contact support to activate a learning stage.</p>
              </CardContent>
            </Card>
          ) : (
            stages.map((stage, idx) => {
              const mastery = stage.stage_profile?.overall_mastery;
              const strengths = stage.stage_profile?.strengths || [];
              const weaknesses = stage.stage_profile?.weaknesses || [];

              return (
                <Card key={stage.id} className={`border ${stage.status === 'active' ? 'border-teal-200 shadow-sm' : 'border-gray-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          stage.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          stage.status === 'active'    ? 'bg-teal-100 text-teal-700' :
                                                         'bg-gray-100 text-gray-400'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{stage.display_name}</p>
                          {stage.activated_at && (
                            <p className="text-[10px] text-gray-400">
                              Started {new Date(stage.activated_at).toLocaleDateString()}
                              {stage.completed_at ? ` · Completed ${new Date(stage.completed_at).toLocaleDateString()}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <StageBadge status={stage.status} />
                    </div>

                    {mastery != null && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-400 font-medium">Stage Mastery</span>
                          <span className="text-xs font-bold text-gray-700">{Math.round(mastery * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-teal-500 transition-all"
                            style={{ width: `${Math.round(mastery * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {(strengths.length > 0 || weaknesses.length > 0) && (
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                        {strengths.length > 0 && (
                          <div>
                            <p className="font-semibold text-emerald-700 mb-0.5">Strengths</p>
                            <ul className="text-gray-500 space-y-0.5">
                              {strengths.slice(0, 3).map((s: string) => <li key={s}>· {s}</li>)}
                            </ul>
                          </div>
                        )}
                        {weaknesses.length > 0 && (
                          <div>
                            <p className="font-semibold text-orange-600 mb-0.5">Focus Areas</p>
                            <ul className="text-gray-500 space-y-0.5">
                              {weaknesses.slice(0, 3).map((w: string) => <li key={w}>· {w}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
