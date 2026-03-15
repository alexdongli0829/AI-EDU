'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Clock, Check, X } from 'lucide-react';
import { formatTime } from '@/lib/utils';

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const { student } = useAuthStore();
  const testId = params.testId as string;

  const [test, setTest] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const questionStartTime = useRef<number>(Date.now());

  // Load test and start session
  useEffect(() => {
    if (!student) return;

    const initTest = async () => {
      try {
        // Get test details
        const testData = await apiClient.getTest(testId);
        setTest(testData);
        setQuestions(testData.questions || []);

        // Start test session
        const sessionData = await apiClient.startTestSession(student.id, { testId });
        setSession(sessionData);
        setTimeRemaining(sessionData.timeRemaining);

        // Connect WebSocket for timer sync
        const ws = apiClient.createWebSocketConnection(student.id, sessionData.id);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'timer_sync') {
            setTimeRemaining(data.timeRemaining);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to start test:', error);
        alert('Failed to start test');
        router.push('/student/dashboard');
      }
    };

    initTest();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [testId, student, router]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeRemaining <= 0 && session) {
      handleSubmitTest();
    }
  }, [timeRemaining]);

  const handleAnswerChange = (value: string) => {
    const currentQuestion = questions[currentIndex];
    setAnswers({
      ...answers,
      [currentQuestion.id]: value,
    });
  };

  const handleNextQuestion = async () => {
    const currentQuestion = questions[currentIndex];
    const timeSpent = Math.floor((Date.now() - questionStartTime.current) / 1000);

    if (answers[currentQuestion.id]) {
      try {
        await apiClient.submitAnswer(
          session.id,
          currentQuestion.id,
          answers[currentQuestion.id],
          timeSpent
        );
      } catch (error) {
        console.error('Failed to submit answer:', error);
      }
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      questionStartTime.current = Date.now();
    } else {
      handleSubmitTest();
    }
  };

  const handleSubmitTest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const result = await apiClient.endTestSession(session.id);
      router.push(`/student/results/${session.id}`);
    } catch (error) {
      console.error('Failed to submit test:', error);
      setIsSubmitting(false);
    }
  };

  if (!test || questions.length === 0) {
    return <div className="flex items-center justify-center min-h-screen">Loading test...</div>;
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header with Timer */}
      <div className="max-w-3xl mx-auto mb-6">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-xl font-semibold">{test.title}</h1>
              <p className="text-sm text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Clock className={`h-5 w-5 ${timeRemaining < 60 ? 'text-red-600' : ''}`} />
              <span className={timeRemaining < 60 ? 'text-red-600' : ''}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question Card */}
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Question {currentIndex + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-lg">{currentQuestion.questionText}</div>

            {/* Multiple Choice */}
            {currentQuestion.questionType === 'multiple_choice' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswerChange(option)}
                    className={`w-full p-4 text-left border-2 rounded-lg transition-colors ${
                      answers[currentQuestion.id] === option
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {currentQuestion.questionType === 'short_answer' && (
              <Input
                placeholder="Type your answer here..."
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="text-lg"
              />
            )}

            {/* Essay */}
            {currentQuestion.questionType === 'essay' && (
              <textarea
                placeholder="Write your essay here..."
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(e.target.value)}
                className="w-full min-h-[200px] p-3 border rounded-md"
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                Previous
              </Button>
              <Button
                onClick={handleNextQuestion}
                disabled={!answers[currentQuestion.id] || isSubmitting}
              >
                {currentIndex === questions.length - 1 ? 'Submit Test' : 'Next Question'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
