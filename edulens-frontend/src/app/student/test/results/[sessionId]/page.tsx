'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { studentAnalyticsService, SessionDetail } from '@/services/student-analytics';
import { getThresholds, DEFAULT_THRESHOLDS, ErrorClassificationThresholds } from '@/services/system-config';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, CheckCircle, XCircle, Clock,
  Bot, Send, X, Lightbulb, RotateCcw, MessageSquare,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONVERSATION_API = process.env.NEXT_PUBLIC_CONVERSATION_API || '';
const TEST_API = process.env.NEXT_PUBLIC_TEST_API || '';

const SUBJECT_META: Record<string, { label: string; color: string; bg: string }> = {
  math:            { label: 'Mathematical Reasoning', color: '#2563EB', bg: '#EFF6FF' },
  general_ability: { label: 'Thinking Skills',        color: '#7C3AED', bg: '#F5F3FF' },
  english:         { label: 'English Reading',        color: '#0D9488', bg: '#F0FDFA' },
};

const ERROR_LABELS: Record<string, { label: string; color: string }> = {
  concept_gap:      { label: 'Concept Gap',      color: '#EF4444' },
  careless_error:   { label: 'Careless Error',   color: '#F59E0B' },
  misread_question: { label: 'Misread Question', color: '#8B5CF6' },
  time_pressure:    { label: 'Time Pressure',    color: '#6366F1' },
  other:            { label: 'Other',            color: '#6B7280' },
};

const CLASSIFICATION_KEYWORDS = Object.keys(ERROR_LABELS);

// ─── Types ────────────────────────────────────────────────────────────────────

type AnswerItem = SessionDetail['answers'][number];
type ReviewMode = 'choose' | 'reattempt' | 'ai';

interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; }

// ─── Review API helper ────────────────────────────────────────────────────────

async function recordReview(
  sessionId: string,
  questionId: string,
  opts: { reattemptAnswer?: string; incrementAi?: boolean; errorClassification?: string },
): Promise<{ success: boolean; isCorrect?: boolean }> {
  try {
    const res = await fetch(`${TEST_API}/sessions/${sessionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, ...opts }),
    });
    return res.ok ? res.json() : { success: false };
  } catch { return { success: false }; }
}

// ─── AI-based classification ──────────────────────────────────────────────────

async function classifyError(chatSessionId: string): Promise<string | null> {
  try {
    const res = await fetch(`${CONVERSATION_API}/student-chat/${chatSessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message:
          'SYSTEM: Based on the student\'s mistake in this conversation, classify the root cause as EXACTLY one of these words (nothing else): ' +
          'concept_gap, careless_error, misread_question, time_pressure, other.',
      }),
    });
    const data = await res.json();
    if (!data.success) return null;
    const reply: string = (data.response || '').toLowerCase();
    return CLASSIFICATION_KEYWORDS.find(k => reply.includes(k)) || 'other';
  } catch { return null; }
}

// ─── Question Review Modal ────────────────────────────────────────────────────

function ReviewModal({
  answer,
  index,
  sessionId,
  studentId,
  onClose,
  onUpdated,
}: {
  answer: AnswerItem;
  index: number;
  sessionId: string;
  studentId: string;
  onClose: () => void;
  onUpdated: (questionId: string, patch: Partial<AnswerItem>) => void;
}) {
  const [mode, setMode] = useState<ReviewMode>('choose');

  // Reattempt state
  const [selected, setSelected] = useState('');
  const [reattemptResult, setReattemptResult] = useState<'correct' | 'wrong' | null>(null);
  const [attempts, setAttempts] = useState(answer.reattemptCount);

  // AI state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInitialising, setAiInitialising] = useState(false);
  const [aiMsgCount, setAiMsgCount] = useState(answer.aiInteractions);

  // Classification badge shown after AI interaction
  const [classification, setClassification] = useState<string | null>(answer.errorClassification);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Initialise AI session on first switch to AI mode ──
  useEffect(() => {
    if (mode !== 'ai' || chatSessionId) return;
    let cancelled = false;

    async function init() {
      setAiInitialising(true);
      try {
        const sesRes = await fetch(`${CONVERSATION_API}/student-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId }),
        });
        const sesData = await sesRes.json();
        if (!sesData.success || cancelled) return;
        const sid = sesData.sessionId;
        setChatSessionId(sid);

        const context =
          `I got this question wrong and want to understand why.\n\n` +
          `Question: ${answer.questionText}\n` +
          `Options: ${answer.options.join(' / ')}\n` +
          `My answer: "${answer.studentAnswer}"\n` +
          `Correct answer: "${answer.correctAnswer}"\n\n` +
          `Please help me think through this using questions — don't just give me the answer.`;

        const msgRes = await fetch(`${CONVERSATION_API}/student-chat/${sid}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: context }),
        });
        const msgData = await msgRes.json();
        if (cancelled) return;

        if (msgData.success) {
          setMessages([{ id: 'intro', role: 'assistant', content: msgData.response }]);
        }

        // Silent classification after initial analysis
        const cls = await classifyError(sid);
        if (cls && !cancelled) {
          setClassification(cls);
          onUpdated(answer.questionId, { errorClassification: cls });
          await recordReview(sessionId, answer.questionId, { errorClassification: cls });
        }
      } catch {
        if (!cancelled) setMessages([{ id: 'err', role: 'assistant', content: "Couldn't connect to AI tutor. Please try again." }]);
      } finally {
        if (!cancelled) setAiInitialising(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [mode]);

  // ── Submit reattempt ──
  const submitReattempt = async () => {
    if (!selected) return;
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const result = await recordReview(sessionId, answer.questionId, { reattemptAnswer: selected });
    const correct = result.isCorrect ?? (selected.toLowerCase().trim() === answer.correctAnswer.toLowerCase().trim());
    setReattemptResult(correct ? 'correct' : 'wrong');
    onUpdated(answer.questionId, { reattemptCount: newAttempts });

    // Classify as careless if they got it right on first reattempt and original was fast
    if (correct && newAttempts === 1 && !classification) {
      const cls = answer.timeSpent < 20 ? 'careless_error' : 'other';
      setClassification(cls);
      onUpdated(answer.questionId, { errorClassification: cls });
      await recordReview(sessionId, answer.questionId, { errorClassification: cls });
    }
  };

  // ── Send AI message ──
  const sendAiMessage = async () => {
    if (!aiInput.trim() || !chatSessionId || aiLoading) return;
    const text = aiInput.trim();
    setAiInput('');
    const newCount = aiMsgCount + 1;
    setAiMsgCount(newCount);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    setAiLoading(true);
    await recordReview(sessionId, answer.questionId, { incrementAi: true });
    onUpdated(answer.questionId, { aiInteractions: newCount });

    try {
      const res = await fetch(`${CONVERSATION_API}/student-chat/${chatSessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { id: data.assistantMessageId || Date.now().toString() + 'a', role: 'assistant', content: data.response }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString() + 'e', role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally { setAiLoading(false); }
  };

  const handleAiKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } };

  const QUICK_PROMPTS = ['Give me a hint', 'Why is my answer wrong?', 'Explain the concept', 'Show a similar example'];

  const errMeta = classification ? ERROR_LABELS[classification] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="font-semibold text-gray-900 text-sm">Q{index + 1} — Review</span>
            {errMeta && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: errMeta.color }}>
                {errMeta.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {attempts > 0 && <span>{attempts} reattempt{attempts > 1 ? 's' : ''}</span>}
            {aiMsgCount > 0 && <span>{aiMsgCount} AI msg{aiMsgCount > 1 ? 's' : ''}</span>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Split body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: question + answer reveal */}
          <div className="w-[42%] flex-shrink-0 overflow-y-auto p-5 border-r border-gray-200 space-y-4">
            <p className="text-sm font-medium text-gray-900 leading-relaxed">
              {answer.questionText || 'Question text unavailable.'}
            </p>

            {/* Show only the student's wrong answer — correct answer hidden until reattempt */}
            <div className="space-y-1.5">
              {answer.options.map((opt, i) => {
                const wasWrong = opt.toLowerCase().trim() === answer.studentAnswer.toLowerCase().trim() && !answer.isCorrect;
                return (
                  <div key={i} className={`px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${
                    wasWrong ? 'border-red-300 bg-red-50 text-red-700 line-through opacity-70'
                    : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}>
                    {wasWrong && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                    {!wasWrong && <span className="w-3 flex-shrink-0" />}
                    {opt}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">Try answering again on the right, or use the AI tutor to understand the concept.</p>
            </div>
          </div>

          {/* Right: mode selector + content */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Mode tabs */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setMode('reattempt')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  mode === 'reattempt' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Try Again
                {attempts > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{attempts}</span>}
              </button>
              <button
                onClick={() => setMode('ai')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  mode === 'ai' ? 'border-teal-500 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Bot className="h-3.5 w-3.5" />
                AI Tutor
                {aiMsgCount > 0 && <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">{aiMsgCount}</span>}
              </button>
            </div>

            {/* Choose prompt (initial state) */}
            {mode === 'choose' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 text-center">
                <p className="text-sm text-gray-500">How would you like to review this question?</p>
                <div className="flex gap-4">
                  <button onClick={() => setMode('reattempt')}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all w-36">
                    <RotateCcw className="h-7 w-7 text-blue-500" />
                    <span className="text-sm font-semibold text-blue-700">Try Again</span>
                    <span className="text-xs text-gray-400">Answer the question</span>
                  </button>
                  <button onClick={() => setMode('ai')}
                    className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-teal-200 hover:border-teal-400 hover:bg-teal-50 transition-all w-36">
                    <Bot className="h-7 w-7 text-teal-500" />
                    <span className="text-sm font-semibold text-teal-700">AI Tutor</span>
                    <span className="text-xs text-gray-400">Get guided help</span>
                  </button>
                </div>
              </div>
            )}

            {/* Try Again panel */}
            {mode === 'reattempt' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Choose your answer</p>
                <div className="space-y-2">
                  {answer.options.map((opt, i) => {
                    const isResult = reattemptResult !== null;
                    const isCorrect = opt.toLowerCase().trim() === answer.correctAnswer.toLowerCase().trim();
                    const isSelected = selected === opt;
                    let cls = 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer';
                    if (isResult) {
                      if (isCorrect) cls = 'border-green-400 bg-green-50 cursor-default';
                      else if (isSelected) cls = 'border-red-300 bg-red-50 cursor-default';
                      else cls = 'border-gray-100 bg-gray-50 opacity-50 cursor-default';
                    } else if (isSelected) {
                      cls = 'border-blue-400 bg-blue-50';
                    }
                    return (
                      <button key={i} disabled={isResult}
                        onClick={() => !isResult && setSelected(opt)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border-2 text-sm flex items-center gap-2 transition-all ${cls}`}
                      >
                        {isResult && isCorrect && <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                        {isResult && isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                        {(!isResult || (!isCorrect && !isSelected)) && (
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${isSelected ? 'border-blue-400 bg-blue-400' : 'border-gray-300'}`} />
                        )}
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {reattemptResult === 'correct' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Correct! Well done — you got it this time.
                  </div>
                )}
                {reattemptResult === 'wrong' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                    <p className="text-sm text-red-800 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Not quite. Try again or ask the AI tutor for help.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => { setSelected(''); setReattemptResult(null); }}
                        className="text-xs">
                        Try Again
                      </Button>
                      <Button size="sm" onClick={() => setMode('ai')}
                        className="text-xs bg-teal-600 hover:bg-teal-700 text-white">
                        Ask AI Tutor
                      </Button>
                    </div>
                  </div>
                )}

                {reattemptResult === null && (
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!selected} onClick={submitReattempt}>
                    Submit Answer
                  </Button>
                )}

                {attempts > 1 && (
                  <p className="text-xs text-gray-400 text-center">Attempt {attempts} of this question</p>
                )}
              </div>
            )}

            {/* AI Tutor panel */}
            {mode === 'ai' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {aiInitialising ? (
                    <div className="flex items-center gap-2 justify-center py-10 text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Analysing your answer...</span>
                    </div>
                  ) : (
                    <>
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                          {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Bot className="h-3 w-3 text-teal-600" />
                            </div>
                          )}
                          <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                            msg.role === 'user' ? 'bg-teal-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {aiLoading && (
                        <div className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-3 w-3 text-teal-600" />
                          </div>
                          <div className="bg-white border border-gray-200 px-3 py-2 rounded-xl rounded-tl-sm">
                            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                          </div>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </>
                  )}
                </div>

                {!aiInitialising && messages.length > 0 && aiMsgCount < 3 && (
                  <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-gray-100 bg-white flex-shrink-0">
                    {QUICK_PROMPTS.map(p => (
                      <button key={p} onClick={() => setAiInput(p)}
                        className="text-xs px-2 py-1 rounded-full border border-teal-200 text-teal-700 hover:bg-teal-50">
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-3 border-t border-gray-200 bg-white flex gap-2 flex-shrink-0">
                  <Input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={handleAiKey}
                    placeholder="Ask a question..." disabled={aiInitialising || aiLoading} className="text-sm" />
                  <Button size="sm" onClick={sendAiMessage}
                    disabled={!aiInput.trim() || aiInitialising || aiLoading}
                    className="bg-teal-600 hover:bg-teal-700 text-white flex-shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function TimePerQuestionChart({ answers }: { answers: SessionDetail['answers'] }) {
  if (answers.length === 0) return null;
  const times = answers.map(a => a.timeSpent);
  const maxTime = Math.max(...times, 1);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  return (
    <div>
      <div className="flex items-end gap-1 h-24 mb-3">
        {answers.map((a, i) => {
          const h = (a.timeSpent / maxTime) * 100;
          const color = a.timeSpent < 15 ? '#FCA5A5' : a.timeSpent > 90 ? '#6EE7B7' : '#99F6E4';
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`Q${i + 1}: ${a.timeSpent}s`}>
              <div className="w-full rounded-t" style={{ height: `${h}%`, backgroundColor: color, minHeight: '4px' }} />
              <div className="text-xs">
                {a.isCorrect ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Q1</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-200 inline-block" /> Quick</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-teal-200 inline-block" /> Normal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-200 inline-block" /> Slow</span>
        </div>
        <span>Q{answers.length}</span>
      </div>
      <p className="text-xs text-gray-400 text-center">Average: {avg}s per question</p>
    </div>
  );
}

function ErrorPatternSummary({ answers, timeLimit, thresholds }: {
  answers: SessionDetail['answers'];
  timeLimit: number;
  thresholds: ErrorClassificationThresholds;
}) {
  const wrong = answers.filter(a => !a.isCorrect);
  if (wrong.length === 0) return <p className="text-sm text-gray-400">No incorrect answers — perfect score!</p>;

  // Build cumulative elapsed time at the start of each question
  const cumulativeAtStart: number[] = [];
  let elapsed = 0;
  answers.forEach(a => { cumulativeAtStart.push(elapsed); elapsed += a.timeSpent; });

  const counts: Record<string, number> = {};
  wrong.forEach(a => {
    if (a.errorClassification) { counts[a.errorClassification] = (counts[a.errorClassification] || 0) + 1; return; }
    const idx = answers.indexOf(a);
    const timeRemainingAtStart = timeLimit - cumulativeAtStart[idx];
    const pctRemaining = timeRemainingAtStart / timeLimit;
    const cls =
      a.timeSpent < thresholds.carelessErrorMaxSeconds     ? 'careless_error' :
      pctRemaining < thresholds.timePressureMinPctRemaining ? 'time_pressure'  :
      a.timeSpent > thresholds.conceptGapMinSeconds         ? 'concept_gap'    : 'other';
    counts[cls] = (counts[cls] || 0) + 1;
  });

  const total = wrong.length;
  const aiClassifiedCount = wrong.filter(a => a.errorClassification).length;
  return (
    <div className="space-y-3">
      {Object.entries(counts).map(([key, count]) => {
        const meta = ERROR_LABELS[key] || ERROR_LABELS.other;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-sm text-gray-600 w-32 flex-shrink-0">{meta.label}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <div className="h-full flex items-center px-2 text-xs font-bold text-white"
                style={{ width: `${pct}%`, backgroundColor: meta.color, minWidth: pct > 0 ? '4px' : '0' }}>
                {pct > 15 && `${pct}%`}
              </div>
            </div>
            <span className="text-sm font-bold text-gray-600 w-6 text-right">{count}</span>
          </div>
        );
      })}
      <p className="text-xs text-gray-400 mt-1">
        {aiClassifiedCount} of {wrong.length} confirmed by AI tutor · rest estimated from time spent
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const { student, user } = useAuthStore();

  const { t } = useI18n();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  const [thresholds, setThresholds] = useState<ErrorClassificationThresholds>(DEFAULT_THRESHOLDS);

  // Parent can pass studentId as query param; fall back to auth store
  const studentId = searchParams.get('studentId') || student?.id || user?.id || '';

  useEffect(() => {
    if (!studentId || !sessionId) return;
    Promise.all([
      studentAnalyticsService.getSessionDetail(studentId, sessionId),
      getThresholds(),
    ]).then(([d, t]) => {
      if (!d) setError('Test result not found.'); else setDetail(d);
      setThresholds(t);
    }).catch(() => setError('Failed to load result.'))
      .finally(() => setLoading(false));
  }, [studentId, sessionId]);

  // Patch individual answer in local state after modal updates
  const handleAnswerUpdated = useCallback((questionId: string, patch: Partial<AnswerItem>) => {
    setDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        answers: prev.answers.map(a => a.questionId === questionId ? { ...a, ...patch } : a),
      };
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600 mr-2" />
        <span className="text-gray-500">{t.common.loading}</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-80 text-center"><CardContent className="p-8">
          <p className="text-gray-500 mb-4">{error || t.results.resultNotFound}</p>
          <Button variant="outline" onClick={() => router.push('/student/dashboard')}>{t.results.goBack}</Button>
        </CardContent></Card>
      </div>
    );
  }

  const meta = SUBJECT_META[detail.subject] || { label: detail.testTitle, color: '#6B7280', bg: '#F9FAFB' };
  const scoreColor = detail.scaledScore >= 75 ? '#16A34A' : detail.scaledScore >= 55 ? '#D97706' : '#DC2626';
  const date = new Date(detail.completedAt).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const wrongAnswers = detail.answers.filter(a => !a.isCorrect);
  const totalReattempts = detail.answers.reduce((s, a) => s + a.reattemptCount, 0);
  const totalAiMessages = detail.answers.reduce((s, a) => s + a.aiInteractions, 0);

  const reviewAnswer = reviewIdx !== null ? detail.answers[reviewIdx] : null;

  return (
    <>
      {reviewAnswer !== null && reviewIdx !== null && (
        <ReviewModal
          answer={reviewAnswer}
          index={reviewIdx}
          sessionId={sessionId}
          studentId={studentId}
          onClose={() => setReviewIdx(null)}
          onUpdated={handleAnswerUpdated}
        />
      )}

      <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#FAFAF9' }}>
        {/* Page title row */}
        <div className="max-w-3xl mx-auto px-4 pt-5 pb-1 flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">{detail.testTitle}</h1>
            <p className="text-xs text-gray-500">{date}</p>
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ color: meta.color, backgroundColor: meta.bg }}>
            {meta.label}
          </span>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

          {/* Score + Review Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-extrabold mb-1" style={{ color: scoreColor }}>{detail.scaledScore}%</div>
                <div className="text-xs text-gray-500">{t.results.score}</div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-extrabold mb-1 text-gray-800">{detail.correctCount}/{detail.totalItems}</div>
                <div className="text-xs text-gray-500">{t.results.correct}</div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-extrabold mb-1 text-blue-600">{totalReattempts}</div>
                <div className="text-xs text-gray-500">{t.results.reattempt}</div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-extrabold mb-1 text-teal-600">{totalAiMessages}</div>
                <div className="text-xs text-gray-500">{t.results.aiTutor}</div>
              </CardContent>
            </Card>
          </div>

          {/* Question Grid */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-gray-800">
                Question Breakdown
                {wrongAnswers.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-red-500">— click red questions to review</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {detail.answers.map((a, idx) => {
                  const canReview = !a.isCorrect;
                  const errMeta = a.errorClassification ? ERROR_LABELS[a.errorClassification] : null;
                  return (
                    <button key={idx} disabled={!canReview}
                      onClick={() => canReview && setReviewIdx(idx)}
                      title={canReview ? `Q${idx + 1} — click to review` : `Q${idx + 1} — correct`}
                      className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold border-2 transition-all ${
                        a.isCorrect
                          ? 'bg-green-50 border-green-200 text-green-700 cursor-default'
                          : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-400 hover:shadow-md cursor-pointer'
                      }`}
                    >
                      <span>Q{idx + 1}</span>
                      {canReview && <Bot className="h-2.5 w-2.5 text-red-400" />}
                      {/* Badges */}
                      {a.reattemptCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] flex items-center justify-center leading-none">
                          {a.reattemptCount}
                        </span>
                      )}
                      {/* Error classification dot */}
                      {errMeta && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border border-white"
                          style={{ backgroundColor: errMeta.color }} title={errMeta.label} />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                <span>{detail.correctCount} correct · {wrongAnswers.length} incorrect</span>
                {wrongAnswers.length > 0 && <span>· Numbers = reattempt count · Coloured dot = AI error classification</span>}
              </div>
            </CardContent>
          </Card>

          {/* Time per Question */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" /> Time per Question
              </CardTitle>
            </CardHeader>
            <CardContent><TimePerQuestionChart answers={detail.answers} /></CardContent>
          </Card>

          {/* Error Analysis */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-400" /> Error Analysis
              </CardTitle>
            </CardHeader>
            <CardContent><ErrorPatternSummary answers={detail.answers} timeLimit={detail.timeLimit} thresholds={thresholds} /></CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-center pb-6">
            <Button variant="outline" onClick={() => router.push('/student/test')}>Take Another Test</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => router.push('/student/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
