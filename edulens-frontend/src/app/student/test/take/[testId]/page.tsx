'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTestStore } from '@/store/test-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Clock,
  CheckCircle,
  ArrowRight,
  Trophy,
  Target,
  BarChart3,
  Brain,
} from 'lucide-react';

export default function TestTakePage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;

  const { user, student } = useAuthStore();
  const {
    currentSession,
    currentQuestion,
    loading,
    testCompleted,
    finalResults,
    answers,
    startTest,
    submitAnswer,
    resetTest,
  } = useTestStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Parse route param:
  //   "contest--{contestId}"  → contest mode
  //   "stageId--subject"      → stage/subject mode
  //   UUID                    → legacy testId mode
  const isContest = testId?.startsWith('contest--');
  const parsedContestId = isContest ? testId.slice('contest--'.length) : undefined;
  const isStageSubject = !isContest && testId?.includes('--');
  const [parsedStageId, parsedSubject] = isStageSubject ? testId.split('--') : [undefined, undefined];
  const sessionKey = testId; // used to detect navigation to a different test

  // Initialize test — reset if navigating to a different test
  useEffect(() => {
    if (!testId) return;
    const studentId = student?.id || user?.id;
    if (!studentId) return;

    // If there's an existing session for a different test/subject, reset it
    const sessionMatchesRoute = isContest
      ? (currentSession as any)?.contestId === parsedContestId
      : isStageSubject
        ? currentSession?.stageId === parsedStageId && currentSession?.subject === parsedSubject
        : currentSession?.testId === testId;
    if (currentSession && !sessionMatchesRoute) {
      resetTest();
      return; // useEffect will re-run after reset clears currentSession
    }

    if (!currentSession) {
      const opts = isContest
        ? { contestId: parsedContestId }
        : isStageSubject
          ? { stageId: parsedStageId, subject: parsedSubject }
          : { testId };
      startTest(studentId, opts).catch(() => {
        router.push('/student/contests');
      });
    }
  }, [user?.id, student?.id, testId, currentSession, startTest, resetTest, router]);

  // Timer countdown
  useEffect(() => {
    if (!currentSession) return;
    setTimeRemaining(currentSession.timeRemaining);

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentSession]);

  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) return;

    setSubmitting(true);
    try {
      await submitAnswer(selectedAnswer);
      setSelectedAnswer('');
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Fire-and-forget skill analysis after test completion
  const triggerAnalysis = (sid: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_TEST_API || 'http://localhost:3002';
    fetch(`${baseUrl}/sessions/${sid}/analyze`, { method: 'POST' }).catch(() => {});
  };

  const handleRetakeTest = () => {
    resetTest();
    router.push('/student/test');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPerformanceLevel = (score: number) => {
    if (score >= 90) return { label: 'Excellent', icon: Trophy, color: 'text-yellow-500' };
    if (score >= 75) return { label: 'Proficient', icon: Target, color: 'text-green-500' };
    if (score >= 55) return { label: 'Developing', icon: BarChart3, color: 'text-blue-500' };
    return { label: 'Beginning', icon: Brain, color: 'text-purple-500' };
  };

  // Loading state
  if (loading && !currentSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-teal-600" />
            <h3 className="text-lg font-semibold mb-2">Preparing Your Test</h3>
            <p className="text-muted-foreground">Loading your questions...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Test completed — show results
  if (testCompleted && finalResults) {
    const sessionIdForAnalysis = currentSession?.sessionId;
    if (sessionIdForAnalysis) triggerAnalysis(sessionIdForAnalysis);

    const performance = getPerformanceLevel(finalResults.scaledScore);
    const PerformanceIcon = performance.icon;

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <Card className="mb-6">
            <CardContent className="p-8 text-center">
              <div className={`mx-auto p-4 rounded-full bg-gray-100 mb-4 inline-flex ${performance.color}`}>
                <PerformanceIcon className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Test Complete!</h2>
              <p className="text-gray-500">{currentSession?.testTitle || 'OC Practice Test'}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className={`text-3xl font-extrabold mb-1 ${getScoreColor(finalResults.scaledScore)}`}>
                  {finalResults.scaledScore}%
                </div>
                <div className="text-xs text-gray-500">Score</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-extrabold mb-1 text-gray-800">
                  {finalResults.correctCount}/{finalResults.totalItems}
                </div>
                <div className="text-xs text-gray-500">Correct</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold mb-1 ${performance.color}`}>
                  {performance.label}
                </div>
                <div className="text-xs text-gray-500">Performance</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" onClick={handleRetakeTest}>
              Take Another Test
            </Button>
            {currentSession?.sessionId && (
              <Button
                variant="outline"
                onClick={() => router.push(`/student/test/results/${currentSession.sessionId}`)}
              >
                View Question Review
              </Button>
            )}
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => router.push('/student/dashboard')}
            >
              View Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading next question
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-72">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-teal-600" />
            <p className="text-sm text-gray-500">Loading question...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalQuestions = currentSession?.totalQuestions || 0;
  const answeredCount = answers.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-base font-semibold text-gray-900">{currentSession?.testTitle}</h1>
                <p className="text-sm text-gray-500">
                  Question {answeredCount + 1} of {totalQuestions}
                </p>
              </div>
              <div className="flex items-center gap-2 text-base font-mono text-gray-700">
                <Clock className="h-4 w-4 text-gray-400" />
                {formatTime(timeRemaining)}
              </div>
            </div>
            <Progress value={progress} className="h-1.5" />
          </CardContent>
        </Card>

        {/* Question */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium text-gray-900 leading-relaxed">
              {currentQuestion.text}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                  selectedAnswer === option
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedAnswer === option
                      ? 'border-teal-500 bg-teal-500'
                      : 'border-gray-300'
                  }`}>
                    {selectedAnswer === option && (
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || submitting}
            className="bg-teal-600 hover:bg-teal-700 text-white min-w-36"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {answeredCount + 1 === totalQuestions ? 'Finish Test' : 'Next Question'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
