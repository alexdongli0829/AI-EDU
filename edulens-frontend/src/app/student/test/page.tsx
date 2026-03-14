'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTestStore } from '@/store/test-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, BookOpen, ArrowRight } from 'lucide-react';


const OC_SUBJECTS = [
  {
    key: 'math',
    title: 'Mathematical Reasoning',
    icon: '🔢',
    description: 'Number patterns, arithmetic, fractions, geometry, measurement and problem solving.',
    timeLabel: '40 min',
    color: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-800',
    button: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    key: 'general_ability',
    title: 'Thinking Skills',
    icon: '🧠',
    description: 'Logical reasoning, spatial thinking, analogies, sequences and critical thinking.',
    timeLabel: '30 min',
    color: 'border-purple-200 bg-purple-50',
    badge: 'bg-purple-100 text-purple-800',
    button: 'bg-purple-600 hover:bg-purple-700',
  },
  {
    key: 'english',
    title: 'English Reading',
    icon: '📚',
    description: 'Reading comprehension, vocabulary, text interpretation and language conventions.',
    timeLabel: '30 min',
    color: 'border-teal-200 bg-teal-50',
    badge: 'bg-teal-100 text-teal-800',
    button: 'bg-teal-600 hover:bg-teal-700',
  },
];

export default function TestSelectPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { tests, loading, loadTests } = useTestStore();

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const getTestForSubject = (subjectKey: string) =>
    tests.find(t => t.subject === subjectKey);

  const handleStartTest = (testId: string) => {
    router.push(`/student/test/take/${testId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#FAFAF9' }}>
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-1">
        <h1 className="text-xl font-bold text-gray-900">OC Practice Tests</h1>
        <p className="text-sm text-gray-500 mt-0.5">NSW Opportunity Class placement exam preparation</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">
        {/* Info bar */}
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Exam format:</strong> The OC test has 3 separate papers — Mathematical Reasoning, Thinking Skills and English Reading.
          Each paper is independently timed. Attempt them one at a time.
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
            <span className="text-gray-500">Loading tests...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {OC_SUBJECTS.map((subject) => {
              const test = getTestForSubject(subject.key);
              return (
                <Card
                  key={subject.key}
                  className={`border-2 ${subject.color} shadow-sm`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <span className="text-4xl">{subject.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-lg font-bold text-gray-900">{subject.title}</h2>
                            <Badge className={subject.badge}>
                              {subject.key.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{subject.description}</p>
                          <div className="flex items-center gap-5 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {test ? `${Math.round(test.timeLimit / 60)} min` : subject.timeLabel}
                            </span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              {test ? `${test.questionCount} questions` : 'Questions vary'}
                            </span>
                            {test && (
                              <span className="text-gray-400">
                                Grade {test.gradeLevel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="ml-6 flex-shrink-0">
                        {test ? (
                          <Button
                            className={`${subject.button} text-white min-w-32`}
                            onClick={() => handleStartTest(test.id)}
                          >
                            Start Test
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="outline" disabled className="min-w-32">
                            Coming Soon
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && tests.length === 0 && (
          <div className="mt-6 p-6 bg-white border border-gray-200 rounded-lg text-center text-gray-500">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No tests available yet.</p>
            <p className="text-sm mt-1">Tests for your grade level haven't been set up yet. Check back soon.</p>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          {user && <>Logged in as <strong>{user.name}</strong> · Results are saved automatically</>}
        </div>
      </div>
    </div>
  );
}
