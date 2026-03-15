'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, BookOpen, ArrowRight } from 'lucide-react';

const STAGE_SUBJECTS: Record<string, {
  key: string; title: string; icon: string; description: string; timeLabel: string;
  color: string; badge: string; button: string;
}[]> = {
  oc_prep: [
    { key: 'math',           title: 'Mathematical Reasoning', icon: '🔢', description: 'Number & algebra, fractions, measurement, geometry, statistics and problem solving.', timeLabel: '40 min', color: 'border-blue-200 bg-blue-50',   badge: 'bg-blue-100 text-blue-800',   button: 'bg-blue-600 hover:bg-blue-700' },
    { key: 'general_ability',title: 'Thinking Skills',        icon: '🧠', description: 'Logical reasoning, spatial thinking, pattern recognition, sequences and analogies.',  timeLabel: '30 min', color: 'border-purple-200 bg-purple-50', badge: 'bg-purple-100 text-purple-800', button: 'bg-purple-600 hover:bg-purple-700' },
    { key: 'english',        title: 'English Reading',        icon: '📚', description: 'Reading comprehension, vocabulary, inference, grammar and text interpretation.',      timeLabel: '30 min', color: 'border-teal-200 bg-teal-50',     badge: 'bg-teal-100 text-teal-800',     button: 'bg-teal-600 hover:bg-teal-700' },
  ],
  selective: [
    { key: 'math',           title: 'Mathematical Reasoning', icon: '🔢', description: 'Number & algebra, measurement & space, statistics, financial maths and multi-step problem solving. 35 questions / 40 min.',               timeLabel: '40 min', color: 'border-blue-200 bg-blue-50',    badge: 'bg-blue-100 text-blue-800',    button: 'bg-blue-600 hover:bg-blue-700' },
    { key: 'general_ability',title: 'Thinking Skills',        icon: '🧠', description: 'Abstract reasoning, logical deduction, pattern recognition, spatial and verbal reasoning. 40 questions / 40 min.',                       timeLabel: '40 min', color: 'border-purple-200 bg-purple-50', badge: 'bg-purple-100 text-purple-800', button: 'bg-purple-600 hover:bg-purple-700' },
    { key: 'english',        title: 'Reading',                icon: '📚', description: 'Complex text comprehension, inference, vocabulary in context, literary techniques and author intent. 38 questions / 45 min.',              timeLabel: '45 min', color: 'border-teal-200 bg-teal-50',    badge: 'bg-teal-100 text-teal-800',    button: 'bg-teal-600 hover:bg-teal-700' },
    { key: 'writing',        title: 'Writing',                icon: '✍️', description: 'Open-response creative or persuasive writing task judged on ideas, structure, language features and grammar mechanics. 1 task / 30 min.', timeLabel: '30 min', color: 'border-orange-200 bg-orange-50', badge: 'bg-orange-100 text-orange-800', button: 'bg-orange-600 hover:bg-orange-700' },
  ],
  hsc: [
    { key: 'math',           title: 'Mathematics',            icon: '🔢', description: 'Functions & graphs, calculus, financial maths, statistics, algebra and measurement.',    timeLabel: '45 min', color: 'border-blue-200 bg-blue-50',   badge: 'bg-blue-100 text-blue-800',   button: 'bg-blue-600 hover:bg-blue-700' },
    { key: 'general_ability',title: 'Sciences',               icon: '🔬', description: 'Scientific reasoning, data analysis and experiment design across Physics, Chemistry and Biology.', timeLabel: '40 min', color: 'border-purple-200 bg-purple-50', badge: 'bg-purple-100 text-purple-800', button: 'bg-purple-600 hover:bg-purple-700' },
    { key: 'english',        title: 'English',                icon: '📚', description: 'Textual analysis, essay writing, creative writing, literary techniques and text & context.', timeLabel: '40 min', color: 'border-teal-200 bg-teal-50',     badge: 'bg-teal-100 text-teal-800',     button: 'bg-teal-600 hover:bg-teal-700' },
  ],
  lifelong: [
    { key: 'math',           title: 'Quantitative Reasoning', icon: '🔢', description: 'Statistical analysis, mathematical modelling, data interpretation and financial literacy.', timeLabel: '45 min', color: 'border-blue-200 bg-blue-50',   badge: 'bg-blue-100 text-blue-800',   button: 'bg-blue-600 hover:bg-blue-700' },
    { key: 'general_ability',title: 'Critical Thinking',      icon: '🧠', description: 'Argumentation, evidence evaluation, logical fallacies, analytical reasoning and synthesis.',  timeLabel: '40 min', color: 'border-purple-200 bg-purple-50', badge: 'bg-purple-100 text-purple-800', button: 'bg-purple-600 hover:bg-purple-700' },
    { key: 'english',        title: 'Literacy',               icon: '📚', description: 'Academic reading & writing, rhetorical analysis, vocabulary, text critique and communication.', timeLabel: '40 min', color: 'border-teal-200 bg-teal-50',     badge: 'bg-teal-100 text-teal-800',     button: 'bg-teal-600 hover:bg-teal-700' },
  ],
};

const STAGE_INFO: Record<string, { label: string; color: string; examNote: string }> = {
  oc_prep:   { label: 'OC Preparation',       color: '#2563EB', examNote: 'The OC Placement Test has 3 papers — Mathematical Reasoning, Thinking Skills and English Reading. Each paper is independently timed.' },
  selective: { label: 'Selective High School', color: '#7C3AED', examNote: 'The NSW Selective High School Placement Test has 4 papers — Mathematical Reasoning (35q/40min), Thinking Skills (40q/40min), Reading (38q/45min) and Writing (1 task/30min).' },
  hsc:       { label: 'HSC Preparation',       color: '#0D9488', examNote: 'HSC practice covers Mathematics, Sciences and English. Papers mirror the format and timing of NSW HSC exam papers.' },
  lifelong:  { label: 'University & Beyond',   color: '#D97706', examNote: 'University-level practice across Quantitative Reasoning, Critical Thinking and Literacy. Builds higher-order analytical and academic skills.' },
};

export default function TestSelectPage() {
  const router = useRouter();
  const { user, student } = useAuthStore();
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [stageLoading, setStageLoading] = useState(true);

  useEffect(() => {
    if (student?.id) {
      apiClient.listStudentStages(student.id)
        .then((res: any) => {
          const active = res.success ? (res.stages ?? []).find((s: any) => s.status === 'active') : null;
          setActiveStageId(active?.stage_id ?? null);
        })
        .catch(() => {})
        .finally(() => setStageLoading(false));
    } else {
      setStageLoading(false);
    }
  }, [student?.id]);

  const stageInfo = activeStageId ? STAGE_INFO[activeStageId] : null;
  const subjects = activeStageId ? (STAGE_SUBJECTS[activeStageId] ?? STAGE_SUBJECTS.oc_prep) : STAGE_SUBJECTS.oc_prep;

  const handleStartTest = (subjectKey: string) =>
    router.push(`/student/test/take/${activeStageId ?? 'oc_prep'}--${subjectKey}`);

  const loading = stageLoading;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF9' }}>
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-1">
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-xl font-bold text-gray-900">
            {stageInfo ? `${stageInfo.label} Tests` : 'Practice Tests'}
          </h1>
          {stageInfo && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: stageInfo.color }}>
              Active
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {stageInfo ? `Practise for the ${stageInfo.label} exam` : 'NSW exam preparation'}
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">
        {/* Info bar */}
        {stageInfo && (
          <div className="mb-8 p-4 rounded-lg text-sm border" style={{ backgroundColor: `${stageInfo.color}10`, borderColor: `${stageInfo.color}30`, color: stageInfo.color }}>
            <strong>Exam format:</strong> {stageInfo.examNote}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500">Loading tests…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {subjects.map((subject) => (
              <Card key={subject.key} className={`border-2 ${subject.color} shadow-sm`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <span className="text-4xl">{subject.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-lg font-bold text-gray-900">{subject.title}</h2>
                          <Badge className={subject.badge}>{subject.key.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{subject.description}</p>
                        <div className="flex items-center gap-5 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {subject.timeLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            Questions vary
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 flex-shrink-0">
                      <Button className={`${subject.button} text-white min-w-32`} onClick={() => handleStartTest(subject.key)}>
                        Start Test <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          {user && <>Logged in as <strong>{user.name}</strong> · Results are saved automatically</>}
        </div>
      </div>
    </div>
  );
}
