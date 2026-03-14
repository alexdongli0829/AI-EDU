'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Loader2, ArrowLeft, Users } from 'lucide-react';

const CONVERSATION_API = process.env.NEXT_PUBLIC_CONVERSATION_API || 'http://localhost:3001';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface StudentOption {
  id: string;
  name: string;
  gradeLevel: number;
}

export default function ParentChatPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ParentChatPage />
    </Suspense>
  );
}

function ParentChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    searchParams.get('studentId')
  );
  const [loadingStudents, setLoadingStudents] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load student list for parent
  useEffect(() => {
    const loadStudents = async () => {
      if (!user?.id) return;
      try {
        const response = await apiClient.listStudents(user.id);
        if (response.success) {
          setStudents(
            response.students.map((s: any) => ({
              id: s.id,
              name: s.name,
              gradeLevel: s.gradeLevel,
            }))
          );
          // Auto-select if only one student or if provided via URL
          if (response.students.length === 1 && !selectedStudentId) {
            setSelectedStudentId(response.students[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load students:', error);
      } finally {
        setLoadingStudents(false);
      }
    };

    loadStudents();
  }, [user?.id]);

  // Create session when student is selected
  useEffect(() => {
    if (user?.id && selectedStudentId) {
      createSession();
    }
  }, [user?.id, selectedStudentId]);

  const createSession = async () => {
    try {
      const response = await fetch(`${CONVERSATION_API}/parent-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: user?.id || '',
          studentId: selectedStudentId || '',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSessionId(data.session?.id || data.sessionId);
        setMessages([]);

        const studentName =
          students.find((s) => s.id === selectedStudentId)?.name || 'your child';
        const welcomeMessage: Message = {
          id: 'welcome',
          role: 'assistant',
          content: `Hello! I'm your AI educational advisor. I have access to ${studentName}'s learning profile, test history, and performance analytics. Ask me anything about their progress, strengths, areas for improvement, or how to support their learning.`,
          timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
      } else {
        console.error('Failed to create chat session:', data.error);
      }
    } catch (error) {
      console.error('Failed to create chat session:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `${CONVERSATION_API}/parent-chat/${sessionId}/message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: currentInput }),
        }
      );

      const data = await response.json();

      if (data.success) {
        const aiMessage: Message = {
          id: data.assistantMessageId || (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/parent/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Bot className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Parent AI Advisor</h1>
              <p className="text-sm text-muted-foreground">
                {selectedStudent
                  ? `Discussing ${selectedStudent.name}'s learning progress`
                  : 'Select a student to get personalized insights'}
              </p>
            </div>

            {/* Student Selector */}
            {students.length > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedStudentId || ''}
                  onChange={(e) => setSelectedStudentId(e.target.value || null)}
                  className="text-sm border rounded-md px-2 py-1"
                >
                  <option value="">Select student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Grade {s.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>

        {/* Student Selection Prompt */}
        {!selectedStudentId && !loadingStudents && (
          <Card className="p-8 text-center flex-1 flex items-center justify-center">
            <div>
              <Users className="h-16 w-16 mx-auto mb-4 text-primary/50" />
              <h2 className="text-lg font-semibold mb-2">Select a Student</h2>
              <p className="text-muted-foreground mb-6">
                Choose which child you'd like to discuss with the AI advisor.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {students.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    onClick={() => setSelectedStudentId(s.id)}
                  >
                    {s.name} (Grade {s.gradeLevel})
                  </Button>
                ))}
              </div>
              {students.length === 0 && (
                <p className="text-sm text-muted-foreground mt-4">
                  No student profiles found. Create one in the Parent Dashboard first.
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Messages */}
        {selectedStudentId && (
          <Card className="flex-1 p-4 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium">Welcome to Parent AI Advisor</p>
                  <p className="text-sm mt-2">
                    Ask me anything about your child's learning progress, strengths, areas for
                    improvement, or how to support their education.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <User className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions */}
            {messages.length <= 1 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Try asking:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'How is my child performing overall?',
                    'What are their strongest areas?',
                    'Where do they need the most help?',
                    'Are they rushing through questions?',
                    'How can I support their learning at home?',
                  ].map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(q)}
                      className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your child's progress..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || !sessionId}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={isLoading || !input.trim() || !sessionId}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
