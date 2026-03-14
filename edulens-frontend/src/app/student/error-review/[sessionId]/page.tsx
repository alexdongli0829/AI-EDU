'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  X,
  Check,
  Brain,
  ArrowRight,
  Lightbulb,
  Target,
  Loader2,
  Send
} from 'lucide-react';

const TEST_API = process.env.NEXT_PUBLIC_TEST_API || 'http://localhost:3002';
const CONVERSATION_API = process.env.NEXT_PUBLIC_CONVERSATION_API || 'http://localhost:3001';

interface ErrorQuestion {
  id: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  studentAnswer: string;
  correctAnswer: string;
  explanation: string;
  skillTags: string[];
  difficulty: number;
  sessionResponseId?: string;
}

interface SocraticMessage {
  id: string;
  role: 'student' | 'ai';
  content: string;
  timestamp: Date;
}

export default function ErrorReviewPage() {
  const params = useParams();
  const router = useRouter();
  const testSessionId = params.sessionId as string;

  const { user, student } = useAuthStore();
  const [errorQuestions, setErrorQuestions] = useState<ErrorQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [messages, setMessages] = useState<SocraticMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentQuestion = errorQuestions[currentQuestionIndex];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    loadErrorQuestions();
  }, [testSessionId]);

  const loadErrorQuestions = async () => {
    try {
      const response = await fetch(`${TEST_API}/sessions/${testSessionId}/results`);
      const results = await response.json();

      if (results.success) {
        const incorrectQuestions = results.data.answers
          .filter((answer: any) => !answer.isCorrect)
          .map((answer: any) => ({
            id: answer.questionId,
            question: answer.question.text,
            options: answer.question.options,
            studentAnswer: answer.selectedOption,
            correctAnswer: answer.question.options.find((opt: any) => opt.isCorrect)?.id,
            explanation: answer.question.explanation || '',
            skillTags: answer.question.skillTags || [],
            difficulty: answer.question.difficulty || 1,
            sessionResponseId: answer.responseId,
          }));

        setErrorQuestions(incorrectQuestions);
      }
    } catch (error) {
      console.error('Failed to load error questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSocraticConversation = async () => {
    setShowChat(true);
    setChatLoading(true);

    try {
      // Create a student chat session with question context
      const sessionResponse = await fetch(`${CONVERSATION_API}/student-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student?.id || user?.id,
          questionId: currentQuestion.id,
          sessionResponseId: currentQuestion.sessionResponseId,
        }),
      });

      const sessionData = await sessionResponse.json();

      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Failed to create chat session');
      }

      setChatSessionId(sessionData.sessionId);

      // Send the initial message describing the error
      const initialMessage = `I got this question wrong and I'd like help understanding it.`;

      const msgResponse = await fetch(
        `${CONVERSATION_API}/student-chat/${sessionData.sessionId}/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: initialMessage }),
        }
      );

      const msgData = await msgResponse.json();

      if (msgData.success) {
        setMessages([
          {
            id: 'init',
            role: 'student',
            content: initialMessage,
            timestamp: new Date(),
          },
          {
            id: msgData.assistantMessageId || 'ai-1',
            role: 'ai',
            content: msgData.response,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to start Socratic conversation:', error);
      setMessages([
        {
          id: 'error',
          role: 'ai',
          content: 'Sorry, I could not start the tutoring session. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatSessionId) return;

    const userMessage: SocraticMessage = {
      id: `msg-${Date.now()}`,
      role: 'student',
      content: newMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = newMessage.trim();
    setNewMessage('');
    setChatLoading(true);

    try {
      const response = await fetch(
        `${CONVERSATION_API}/student-chat/${chatSessionId}/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        }
      );

      const data = await response.json();

      if (data.success) {
        const aiMessage: SocraticMessage = {
          id: data.assistantMessageId || `ai-${Date.now()}`,
          role: 'ai',
          content: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const getOptionText = (optionId: string) => {
    return currentQuestion?.options.find((opt) => opt.id === optionId)?.text || '';
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < errorQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setShowChat(false);
      setMessages([]);
      setChatSessionId(null);
    } else {
      router.push('/student/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-12 w-12 animate-pulse mx-auto mb-4 text-teal-600" />
          <h3 className="text-lg font-semibold mb-2">Loading Error Review</h3>
          <p className="text-muted-foreground">Analyzing your incorrect answers...</p>
        </div>
      </div>
    );
  }

  if (!errorQuestions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Check className="h-16 w-16 mx-auto mb-4 text-green-600" />
            <h3 className="text-lg font-semibold mb-2">Perfect Score!</h3>
            <p className="text-muted-foreground mb-4">
              You got all questions correct. No errors to review!
            </p>
            <Button onClick={() => router.push('/student/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-teal-600" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Error Review & Learning</h1>
                <p className="text-sm text-gray-500">
                  Question {currentQuestionIndex + 1} of {errorQuestions.length} - Learn from mistakes
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => router.push('/student/dashboard')}>
              Skip Review
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Question Review */}
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-red-500" />
                  Question Review
                </CardTitle>
                <div className="flex gap-2">
                  {currentQuestion.skillTags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Question */}
              <div>
                <h3 className="font-semibold mb-3">{currentQuestion.question}</h3>
                <div className="space-y-2">
                  {currentQuestion.options.map((option) => (
                    <div
                      key={option.id}
                      className={`p-3 rounded-lg border-2 flex items-center justify-between ${
                        option.id === currentQuestion.correctAnswer
                          ? 'bg-green-50 border-green-500'
                          : option.id === currentQuestion.studentAnswer
                          ? 'bg-red-50 border-red-500'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="flex-1">{option.text}</span>
                      <div className="flex gap-2">
                        {option.id === currentQuestion.correctAnswer && (
                          <Badge className="bg-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            Correct
                          </Badge>
                        )}
                        {option.id === currentQuestion.studentAnswer && (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            Your Answer
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              {currentQuestion.explanation && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    Explanation
                  </h4>
                  <p className="text-sm text-gray-700">{currentQuestion.explanation}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={startSocraticConversation}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={showChat}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {showChat ? 'Chat Active' : 'Get AI Help'}
                </Button>
                <Button onClick={nextQuestion} variant="outline" className="flex-1">
                  Skip <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Socratic AI Chat */}
          <Card className="lg:sticky lg:top-24 h-fit max-h-[80vh] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-teal-600" />
                AI Socratic Tutor
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {!showChat ? (
                <div className="flex-1 flex items-center justify-center text-center py-12">
                  <div>
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-4">
                      Click "Get AI Help" to start a conversation about this question using the
                      Socratic method.
                    </p>
                    <p className="text-xs text-gray-400">
                      I'll ask you guiding questions to help you understand the concept.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div className="flex-1 space-y-4 mb-4 max-h-96 overflow-y-auto">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.role === 'student' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-xs p-3 rounded-lg ${
                            message.role === 'student'
                              ? 'bg-teal-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {message.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                            <span className="text-sm">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === 'Enter' && !chatLoading && sendMessage()
                      }
                      placeholder="Type your response or question..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      disabled={chatLoading}
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={chatLoading || !newMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 pt-3 border-t">
                    <Button onClick={nextQuestion} className="w-full">
                      {currentQuestionIndex < errorQuestions.length - 1
                        ? 'Next Question'
                        : 'Complete Review'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
