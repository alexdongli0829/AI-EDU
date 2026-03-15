'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  Search, Filter, Upload, Download, X, Check, AlertCircle, HelpCircle,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
const adminHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['x-api-key'] = API_KEY;
  return h;
};

const STAGES = [
  { value: 'oc_prep',   label: 'OC Preparation' },
  { value: 'selective', label: 'Selective High School' },
  { value: 'hsc',       label: 'HSC Preparation' },
  { value: 'lifelong',  label: 'University & Beyond' },
];

const SUBJECTS_BY_STAGE: Record<string, { value: string; label: string }[]> = {
  oc_prep:   [{ value: 'math', label: 'Mathematical Reasoning' }, { value: 'general_ability', label: 'Thinking Skills' }, { value: 'english', label: 'English Reading' }],
  selective: [{ value: 'math', label: 'Mathematical Reasoning' }, { value: 'general_ability', label: 'Thinking Skills' }, { value: 'english', label: 'English Reading' }, { value: 'writing', label: 'Writing' }],
  hsc:       [{ value: 'math', label: 'Mathematics' }, { value: 'general_ability', label: 'Sciences' }, { value: 'english', label: 'English' }],
  lifelong:  [{ value: 'math', label: 'Quantitative Reasoning' }, { value: 'general_ability', label: 'Critical Thinking' }, { value: 'english', label: 'Literacy' }],
};
const ALL_SUBJECTS = [
  { value: 'math', label: 'Math' },
  { value: 'general_ability', label: 'Thinking Skills' },
  { value: 'english', label: 'English' },
  { value: 'writing', label: 'Writing' },
];

const SKILL_OPTIONS: Record<string, string[]> = {
  math: ['Number & Algebra', 'Fractions & Decimals', 'Measurement & Geometry', 'Statistics & Probability', 'Problem Solving', 'Working Mathematically'],
  general_ability: ['Logical Reasoning', 'Pattern Recognition', 'Spatial Reasoning', 'Verbal Reasoning', 'Abstract Reasoning', 'Critical Thinking'],
  english: ['Reading Comprehension', 'Vocabulary', 'Inference & Interpretation', 'Grammar & Language', 'Text Structure', 'Language & Expression'],
  writing: ['Text Structure', 'Language & Expression', 'Grammar & Language', 'Vocabulary', 'Persuasive Writing', 'Creative Writing'],
};

const STAGE_LABEL: Record<string, string> = { oc_prep: 'OC Prep', selective: 'Selective', hsc: 'HSC', lifelong: 'Lifelong' };

interface QuestionOption { text: string; isCorrect: boolean }
interface Question {
  id: string;
  text: string;
  type: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
  difficulty: number;
  estimatedTime: number;
  skillTags: string[];
  subject: string;
  stageId: string;
  gradeLevel: number;
  isActive: boolean;
  createdAt: string;
}

const EMPTY_Q: Omit<Question, 'id' | 'createdAt'> = {
  text: '', type: 'multiple_choice', options: [
    { text: '', isCorrect: true }, { text: '', isCorrect: false },
    { text: '', isCorrect: false }, { text: '', isCorrect: false },
  ],
  correctAnswer: '', explanation: '', difficulty: 0.5, estimatedTime: 30,
  skillTags: [], subject: 'math', stageId: 'oc_prep', gradeLevel: 4, isActive: true,
};

export default function AdminQuestionsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full min-h-[400px]"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>}>
      <AdminQuestionsPage />
    </Suspense>
  );
}

function AdminQuestionsPage() {
  const searchParams = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [searchText, setSearchText] = useState('');

  // Editor state
  const [editing, setEditing] = useState<Question | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY_Q });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Import/Export
  const [importing, setImporting] = useState(false);

  const LIMIT = 20;

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String((page - 1) * LIMIT) });
      if (filterSubject) params.set('subject', filterSubject);
      if (filterStage) params.set('stageId', filterStage);
      const res = await fetch(`${API}/admin/questions?${params}`, { headers: adminHeaders() });
      const data = await res.json();
      if (data.success !== false) {
        const questions = data.data?.questions || data.questions || [];
        const total = data.data?.pagination?.total ?? data.data?.questions?.length ?? data.total ?? questions.length;
        setQuestions(questions);
        setTotal(total);
      }
    } catch {
      showToast('err', 'Failed to load questions');
    } finally { setLoading(false); }
  }, [page, filterSubject, filterStage]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => {
    if (searchParams.get('action') === 'create') startCreate();
  }, [searchParams]);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_Q, options: EMPTY_Q.options.map(o => ({ ...o })) });
    setCreating(true);
  };

  const startEdit = (q: Question) => {
    setCreating(false);
    setEditing(q);
    setForm({
      text: q.text, type: q.type,
      options: (q.options || []).map((o: any) =>
        typeof o === 'string' ? { text: o, isCorrect: o === q.correctAnswer } : { ...o }
      ),
      correctAnswer: q.correctAnswer, explanation: q.explanation || '',
      difficulty: q.difficulty, estimatedTime: q.estimatedTime || 30,
      skillTags: [...(q.skillTags || [])], subject: q.subject,
      stageId: q.stageId || 'oc_prep', gradeLevel: q.gradeLevel, isActive: q.isActive !== false,
    });
  };

  const cancelEdit = () => { setEditing(null); setCreating(false); };

  const handleSave = async () => {
    if (!form.text.trim()) { showToast('err', 'Question text is required'); return; }
    setSaving(true);
    try {
      // Set correctAnswer from whichever option is marked correct
      const correctOpt = form.options.find((o: QuestionOption) => o.isCorrect);
      const payload = {
        ...form,
        correctAnswer: correctOpt?.text || form.correctAnswer,
        options: form.options.map((o: QuestionOption) => ({ text: o.text, isCorrect: o.isCorrect })),
      };

      const url = editing ? `${API}/admin/questions/${editing.id}` : `${API}/admin/questions`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: adminHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success !== false && res.ok) {
        showToast('ok', editing ? 'Question updated' : 'Question created');
        cancelEdit();
        fetchQuestions();
      } else {
        showToast('err', data.error || 'Save failed');
      }
    } catch { showToast('err', 'Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/admin/questions/${id}`, { method: 'DELETE', headers: adminHeaders() });
      if (res.ok) { showToast('ok', 'Question deleted'); fetchQuestions(); }
      else showToast('err', 'Delete failed');
    } catch { showToast('err', 'Network error'); }
    finally { setDeleting(null); }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${API}/admin/bulk/export`, { headers: adminHeaders() });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `edulens-questions-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      showToast('ok', 'Export downloaded');
    } catch { showToast('err', 'Export failed'); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch(`${API}/admin/bulk/import`, {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ok', `Imported ${data.imported || data.count || '?'} questions`);
        fetchQuestions();
      } else showToast('err', data.error || 'Import failed');
    } catch { showToast('err', 'Invalid JSON file'); }
    finally { setImporting(false); e.target.value = ''; }
  };

  const updateOption = (idx: number, field: string, value: any) => {
    setForm((prev: any) => {
      const opts = [...prev.options];
      if (field === 'isCorrect') {
        opts.forEach((o: QuestionOption, i: number) => { o.isCorrect = i === idx; });
      } else {
        opts[idx] = { ...opts[idx], [field]: value };
      }
      return { ...prev, options: opts };
    });
  };

  const addOption = () => setForm((p: any) => ({ ...p, options: [...p.options, { text: '', isCorrect: false }] }));
  const removeOption = (idx: number) => setForm((p: any) => ({ ...p, options: p.options.filter((_: any, i: number) => i !== idx) }));

  const toggleSkillTag = (tag: string) => {
    setForm((p: any) => ({
      ...p,
      skillTags: p.skillTags.includes(tag) ? p.skillTags.filter((t: string) => t !== tag) : [...p.skillTags, tag],
    }));
  };

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const showEditor = editing || creating;

  const filteredQuestions = searchText
    ? questions.filter(q => q.text.toLowerCase().includes(searchText.toLowerCase()))
    : questions;

  // ─── Editor Panel ───
  if (showEditor) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={cancelEdit} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to list
        </button>
        <h1 className="text-lg font-bold text-gray-900 mb-5">
          {creating ? 'Create Question' : 'Edit Question'}
        </h1>

        <div className="space-y-5">
          {/* Question text */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Question Text</label>
            <textarea
              value={form.text}
              onChange={e => setForm((p: any) => ({ ...p, text: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Enter the question text..."
            />
          </div>

          {/* Stage + Subject row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Stage</label>
              <select
                value={form.stageId || 'oc_prep'}
                onChange={e => setForm((p: any) => ({ ...p, stageId: e.target.value, subject: SUBJECTS_BY_STAGE[e.target.value]?.[0]?.value || 'math', skillTags: [] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Subject</label>
              <select
                value={form.subject}
                onChange={e => setForm((p: any) => ({ ...p, subject: e.target.value, skillTags: [] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {(SUBJECTS_BY_STAGE[form.stageId || 'oc_prep'] || ALL_SUBJECTS).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Grade + Difficulty row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Grade Level</label>
              <select
                value={form.gradeLevel}
                onChange={e => setForm((p: any) => ({ ...p, gradeLevel: parseInt(e.target.value) }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => <option key={g} value={g}>Year {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Difficulty (0-1)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range" min="0.1" max="1" step="0.1" value={form.difficulty}
                  onChange={e => setForm((p: any) => ({ ...p, difficulty: parseFloat(e.target.value) }))}
                  className="flex-1 accent-teal-600"
                />
                <span className="text-sm font-bold text-teal-700 w-8 text-right">{form.difficulty}</span>
              </div>
            </div>
          </div>

          {/* Answer Options */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Answer Options <span className="text-gray-400 font-normal">(click radio to mark correct)</span>
            </label>
            <div className="space-y-2">
              {form.options.map((opt: QuestionOption, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateOption(idx, 'isCorrect', true)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {opt.isCorrect && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <Input
                    value={opt.text}
                    onChange={e => updateOption(idx, 'text', e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    className="flex-1 text-sm"
                  />
                  {form.options.length > 2 && (
                    <button onClick={() => removeOption(idx)} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.options.length < 6 && (
              <button onClick={addOption} className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-medium">
                + Add option
              </button>
            )}
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Explanation (optional)</label>
            <textarea
              value={form.explanation}
              onChange={e => setForm((p: any) => ({ ...p, explanation: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Explain the correct answer..."
            />
          </div>

          {/* Skill Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Skill Tags</label>
            <div className="flex flex-wrap gap-2">
              {(SKILL_OPTIONS[form.subject] || []).map((tag: string) => {
                const active = form.skillTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleSkillTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-teal-50 border-teal-300 text-teal-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estimated time + Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Estimated Time (seconds)</label>
              <Input
                type="number" min={5} max={300}
                value={form.estimatedTime}
                onChange={e => setForm((p: any) => ({ ...p, estimatedTime: parseInt(e.target.value) || 30 }))}
                className="text-sm"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.isActive}
                  onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-teal-600"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : creating ? 'Create Question' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Question List ───
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {toast.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Questions</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} question{total !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {importing ? 'Importing...' : 'Import'}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Question
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search questions..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <select
          value={filterStage}
          onChange={e => { setFilterStage(e.target.value); setFilterSubject(''); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={filterSubject}
          onChange={e => { setFilterSubject(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All Subjects</option>
          {(filterStage ? SUBJECTS_BY_STAGE[filterStage] : ALL_SUBJECTS).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      ) : filteredQuestions.length === 0 ? (
        <Card className="border border-gray-200">
          <CardContent className="p-12 text-center">
            <HelpCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">No questions found.</p>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={startCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create First Question
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-[40%]">Question</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Stage</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Subject</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Diff</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Grade</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Active</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.map(q => (
                  <tr key={q.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-gray-800 line-clamp-2">{q.text}</p>
                      {q.skillTags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {q.skillTags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {STAGE_LABEL[q.stageId] || q.stageId || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {ALL_SUBJECTS.find(s => s.value === q.subject)?.label || q.subject}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-8 text-center text-xs font-bold rounded-full py-0.5 ${
                        q.difficulty >= 0.7 ? 'bg-red-50 text-red-600' :
                        q.difficulty >= 0.4 ? 'bg-amber-50 text-amber-600' :
                        'bg-green-50 text-green-600'
                      }`}>{q.difficulty}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{q.gradeLevel}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${q.isActive !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(q)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={deleting === q.id}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          {deleting === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
