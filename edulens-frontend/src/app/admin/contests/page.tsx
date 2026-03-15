'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Plus, Trophy, Check, AlertCircle, X, ChevronDown,
  Play, Flag, RefreshCw, Search, BookOpen, ChevronRight, Pencil, Layers,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
const adminHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
});

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

const STAGE_LABEL: Record<string, string> = { oc_prep: 'OC Prep', selective: 'Selective', hsc: 'HSC', lifelong: 'Lifelong' };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: 'text-gray-600',  bg: 'bg-gray-100'   },
  open:      { label: 'Open',      color: 'text-blue-700',  bg: 'bg-blue-100'   },
  active:    { label: 'Active',    color: 'text-green-700', bg: 'bg-green-100'  },
  scoring:   { label: 'Scoring',   color: 'text-amber-700', bg: 'bg-amber-100'  },
  finalized: { label: 'Finalized', color: 'text-purple-700',bg: 'bg-purple-100' },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:   ['open'],
  open:    ['active', 'draft'],
  active:  ['scoring'],
  scoring: ['finalized'],
};

const INITIAL_STATUSES = ['draft', 'open'] as const;

interface Contest {
  id: string;
  title: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  registered_count: number;
  total_participants: number;
  avg_score: number | null;
  series_name: string;
  stage_id: string;
  subject?: string;
  question_count?: number;
}

interface Series {
  id: string;
  title: string;
  stage_id: string;
  description?: string;
}

interface QuestionItem {
  id: string;
  text: string;
  subject: string;
  stageId: string;
  type: string;
  difficulty?: number;
}

interface SeriesForm {
  title: string;
  stageId: string;
  description: string;
}

interface ContestForm {
  seriesId: string;
  title: string;
  stageId: string;
  subject: string;
  status: string;
  questionIds: string[];
  windowStartAt: string;
  windowEndAt: string;
}

const EMPTY_SERIES: SeriesForm = { title: '', stageId: 'oc_prep', description: '' };
const EMPTY_CONTEST: ContestForm = {
  seriesId: '', title: '', stageId: 'oc_prep', subject: 'math',
  status: 'draft', questionIds: [], windowStartAt: '', windowEndAt: '',
};

function toISO(local: string) {
  if (!local) return '';
  return new Date(local).toISOString();
}

function toLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncate(text: string, max = 80) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ─── Question Picker ─────────────────────────────────────────────────────────
function QuestionPicker({
  stageId, subject, selectedIds, onChange,
}: {
  stageId: string;
  subject: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!stageId || !subject) return;
    setLoading(true);
    const params = new URLSearchParams({ stageId, subject, limit: '100' });
    fetch(`${API}/admin/questions?${params}`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(data => {
        const qs: QuestionItem[] = (data.data?.questions || data.questions || []).map((q: any) => ({
          id: q.id,
          text: q.text || q.questionText || '',
          subject: q.subject,
          stageId: q.stageId,
          type: q.type,
          difficulty: q.difficulty,
        }));
        setQuestions(qs);
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [stageId, subject]);

  const filtered = search.trim()
    ? questions.filter(q => q.text.toLowerCase().includes(search.toLowerCase()))
    : questions;

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const toggleAll = () => {
    const allFiltered = filtered.map(q => q.id);
    const allSelected = allFiltered.every(id => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter(id => !allFiltered.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedIds, ...allFiltered]));
      onChange(combined);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search questions…"
          className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
        />
        <span className="text-xs text-gray-400 flex-shrink-0">{selectedIds.length} selected</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400">
          {questions.length === 0 ? 'No questions found for this stage/subject.' : 'No questions match your search.'}
        </div>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {/* Select-all row */}
          <div
            className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100"
            onClick={toggleAll}
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
              filtered.length > 0 && filtered.every(q => selectedIds.includes(q.id))
                ? 'bg-teal-600 border-teal-600' : 'border-gray-300'
            }`}>
              {filtered.length > 0 && filtered.every(q => selectedIds.includes(q.id)) && (
                <Check className="h-2.5 w-2.5 text-white" />
              )}
            </div>
            <span className="text-xs font-semibold text-gray-500">Select all ({filtered.length})</span>
          </div>
          {filtered.map(q => (
            <div
              key={q.id}
              onClick={() => toggle(q.id)}
              className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0"
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                selectedIds.includes(q.id) ? 'bg-teal-600 border-teal-600' : 'border-gray-300'
              }`}>
                {selectedIds.includes(q.id) && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 leading-snug">{truncate(q.text)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{q.type}{q.difficulty != null ? ` · diff ${q.difficulty}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminContestsPage() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [showContestModal, setShowContestModal] = useState(false);
  const [seriesForm, setSeriesForm] = useState<SeriesForm>({ ...EMPTY_SERIES });
  const [contestForm, setContestForm] = useState<ContestForm>({ ...EMPTY_CONTEST });
  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Tab
  const [tab, setTab] = useState<'contests' | 'series'>('contests');

  // Edit contest modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContestId, setEditingContestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ContestForm>({ ...EMPTY_CONTEST });
  const [editLoading, setEditLoading] = useState(false);

  // Edit series modal
  const [showEditSeriesModal, setShowEditSeriesModal] = useState(false);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [editSeriesForm, setEditSeriesForm] = useState<SeriesForm>({ ...EMPTY_SERIES });

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchContests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/contests?status=all`, { headers: adminHeaders() });
      const data = await res.json();
      setContests(data.contests || []);
    } catch {
      showToast('err', 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSeries = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/contest-series`, { headers: adminHeaders() });
      const data = await res.json();
      setSeriesList(data.series || data.data || []);
    } catch {
      setSeriesList([]);
    }
  }, []);

  useEffect(() => {
    fetchContests();
    fetchSeries();
  }, [fetchContests, fetchSeries]);

  useEffect(() => {
    const handler = () => setOpenDropdown(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // When stage changes in contest form, reset subject to first available
  const handleContestStageChange = (stageId: string) => {
    const firstSubject = SUBJECTS_BY_STAGE[stageId]?.[0]?.value || 'math';
    setContestForm(p => ({ ...p, stageId, subject: firstSubject, questionIds: [] }));
  };

  const handleContestSubjectChange = (subject: string) => {
    setContestForm(p => ({ ...p, subject, questionIds: [] }));
  };

  const handleCreateSeries = async () => {
    if (!seriesForm.title.trim()) { showToast('err', 'Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/contest-series`, {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify(seriesForm),
      });
      const data = await res.json();
      if (data.success !== false && res.ok) {
        showToast('ok', `Series "${seriesForm.title}" created`);
        setShowSeriesModal(false);
        setSeriesForm({ ...EMPTY_SERIES });
        fetchSeries();
      } else {
        showToast('err', data.error || 'Failed to create series');
      }
    } catch { showToast('err', 'Network error'); }
    finally { setSaving(false); }
  };

  const handleUpdateSeries = async () => {
    if (!editingSeriesId) return;
    if (!editSeriesForm.title.trim()) { showToast('err', 'Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/contest-series/${editingSeriesId}`, {
        method: 'PUT', headers: adminHeaders(),
        body: JSON.stringify({ title: editSeriesForm.title, stageId: editSeriesForm.stageId }),
      });
      const data = await res.json();
      if (data.success !== false && res.ok) {
        showToast('ok', 'Series updated');
        setShowEditSeriesModal(false);
        setEditingSeriesId(null);
        fetchSeries();
      } else {
        showToast('err', data.error || 'Update failed');
      }
    } catch { showToast('err', 'Network error'); }
    finally { setSaving(false); }
  };

  const handleCreateContest = async () => {
    const { seriesId, title, stageId, subject, status, questionIds, windowStartAt, windowEndAt } = contestForm;
    if (!seriesId.trim()) { showToast('err', 'Series is required'); return; }
    if (!title.trim()) { showToast('err', 'Title is required'); return; }
    if (!windowStartAt || !windowEndAt) { showToast('err', 'Start and end times are required'); return; }
    if (new Date(windowStartAt) >= new Date(windowEndAt)) { showToast('err', 'End must be after start'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/contests`, {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({
          seriesId, title, stageId, subject, status,
          questionIds,
          windowStartAt: toISO(windowStartAt),
          windowEndAt: toISO(windowEndAt),
        }),
      });
      const data = await res.json();
      if (data.success !== false && res.ok) {
        showToast('ok', `Contest "${title}" created`);
        setShowContestModal(false);
        setContestForm({ ...EMPTY_CONTEST });
        fetchContests();
      } else {
        showToast('err', data.error || 'Failed to create contest');
      }
    } catch { showToast('err', 'Network error'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (contestId: string, newStatus: string) => {
    setUpdatingId(contestId);
    setOpenDropdown(null);
    try {
      const res = await fetch(`${API}/admin/contests/${contestId}/status`, {
        method: 'PATCH', headers: adminHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success !== false && res.ok) {
        showToast('ok', `Status → ${newStatus}`);
        fetchContests();
      } else {
        showToast('err', data.error || 'Status update failed');
      }
    } catch { showToast('err', 'Network error'); }
    finally { setUpdatingId(null); }
  };

  const handleFinalize = async (contestId: string) => {
    if (!confirm('Finalize this contest? This will calculate final rankings.')) return;
    setUpdatingId(contestId);
    try {
      const res = await fetch(`${API}/admin/contests/${contestId}/finalize`, {
        method: 'POST', headers: adminHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success !== false && res.ok) {
        showToast('ok', 'Contest finalized');
        fetchContests();
      } else {
        showToast('err', data.error || 'Finalize failed');
      }
    } catch { showToast('err', 'Network error'); }
    finally { setUpdatingId(null); }
  };

  const openEditModal = async (c: Contest) => {
    setEditingContestId(c.id);
    setEditLoading(true);
    setShowEditModal(true);
    // Seed form from list data immediately
    setEditForm({
      seriesId: '',
      title: c.title,
      stageId: c.stage_id || 'oc_prep',
      subject: c.subject || SUBJECTS_BY_STAGE[c.stage_id || 'oc_prep']?.[0]?.value || 'math',
      status: c.status,
      questionIds: [],
      windowStartAt: toLocal(c.scheduled_start),
      windowEndAt: toLocal(c.scheduled_end),
    });
    // Fetch full contest detail to get questionIds
    try {
      const res = await fetch(`${API}/admin/contests/${c.id}`, { headers: adminHeaders() });
      const data = await res.json();
      const detail = data.contest || data.data || data;
      setEditForm(p => ({
        ...p,
        seriesId: detail.series_id || detail.seriesId || '',
        title: detail.title || c.title,
        stageId: detail.stage_id || c.stage_id || 'oc_prep',
        subject: detail.subject || c.subject || p.subject,
        status: detail.status || c.status,
        questionIds: (detail.question_ids || detail.questionIds || []),
        windowStartAt: toLocal(detail.scheduled_start || detail.window_start_at || c.scheduled_start),
        windowEndAt: toLocal(detail.scheduled_end || detail.window_end_at || c.scheduled_end),
      }));
    } catch { /* keep seeded values */ }
    finally { setEditLoading(false); }
  };

  const handleUpdateContest = async () => {
    if (!editingContestId) return;
    const { title, stageId, subject, status, questionIds, windowStartAt, windowEndAt } = editForm;
    if (!title.trim()) { showToast('err', 'Title is required'); return; }
    if (!windowStartAt || !windowEndAt) { showToast('err', 'Start and end times are required'); return; }
    if (new Date(windowStartAt) >= new Date(windowEndAt)) { showToast('err', 'End must be after start'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/contests/${editingContestId}`, {
        method: 'PUT', headers: adminHeaders(),
        body: JSON.stringify({
          title, stageId, subject, status, questionIds,
          windowStartAt: toISO(windowStartAt),
          windowEndAt: toISO(windowEndAt),
        }),
      });
      const data = await res.json();
      if (data.success !== false && res.ok) {
        showToast('ok', 'Contest updated');
        setShowEditModal(false);
        setEditingContestId(null);
        fetchContests();
      } else {
        showToast('err', data.error || 'Update failed');
      }
    } catch { showToast('err', 'Network error'); }
    finally { setSaving(false); }
  };

  const subjectsForForm = SUBJECTS_BY_STAGE[contestForm.stageId] || SUBJECTS_BY_STAGE.oc_prep;

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contests</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {tab === 'contests'
              ? `${contests.length} contest${contests.length !== 1 ? 's' : ''}`
              : `${seriesList.length} series`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchContests(); fetchSeries(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSeriesForm({ ...EMPTY_SERIES }); setShowSeriesModal(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Series
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={() => { setContestForm({ ...EMPTY_CONTEST }); setShowContestModal(true); }}>
            <Trophy className="h-3.5 w-3.5 mr-1.5" /> New Contest
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {([
          { key: 'contests', label: 'Contests', icon: Trophy, count: contests.length },
          { key: 'series',   label: 'Series',   icon: Layers,  count: seriesList.length },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              tab === t.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ── Series tab ───────────────────────────────────────────────── */}
      {tab === 'series' && (
        <Card className="border border-gray-200 shadow-sm overflow-hidden">
          {seriesList.length === 0 ? (
            <CardContent className="py-12 text-center">
              <Layers className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">No series yet.</p>
              <Button variant="outline" size="sm" onClick={() => { setSeriesForm({ ...EMPTY_SERIES }); setShowSeriesModal(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Series
              </Button>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Title</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Stage</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Contests</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Active</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Created</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-600 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {seriesList.map(s => (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{s.title}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {STAGE_LABEL[s.stage_id] || s.stage_id}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">
                        {(s as any).contest_count ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(s as any).is_active !== false ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {(s as any).created_at ? fmtDate((s as any).created_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingSeriesId(s.id);
                            setEditSeriesForm({ title: s.title, stageId: s.stage_id, description: '' });
                            setShowEditSeriesModal(true);
                          }}
                          className="flex items-center px-2 py-1 text-xs rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-500 hover:text-blue-600 ml-auto"
                          title="Edit series"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Contests tab ─────────────────────────────────────────────── */}
      {tab === 'contests' && (loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      ) : contests.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <Trophy className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">No contests yet. Create a series first, then add contests.</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setShowSeriesModal(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Series
              </Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={() => setShowContestModal(true)}>
                <Trophy className="h-3.5 w-3.5 mr-1.5" /> Create Contest
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="w-6 px-3 py-2.5" />
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Title</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Series</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Stage / Subject</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Window</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Qs</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Registered</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Participated</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-600 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contests.map(c => {
                  const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
                  const transitions = STATUS_TRANSITIONS[c.status] || [];
                  const isUpdating = updatingId === c.id;
                  const isExpanded = expandedId === c.id;
                  const subjectLabel = SUBJECTS_BY_STAGE[c.stage_id]?.find(s => s.value === c.subject)?.label || c.subject;
                  return (
                    <>
                      <tr key={c.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50' : ''}`}>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{c.series_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 mr-1">
                            {STAGE_LABEL[c.stage_id] || c.stage_id}
                          </span>
                          {c.subject && (
                            <span className="text-xs text-gray-500">{subjectLabel || c.subject}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          <div>{fmtDate(c.scheduled_start)}</div>
                          <div className="text-gray-400">→ {fmtDate(c.scheduled_end)}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">
                          {c.question_count != null ? c.question_count : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          <span className="font-semibold">{c.registered_count ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          <span className="font-semibold">{c.total_participants ?? '—'}</span>
                          {c.registered_count > 0 && c.total_participants != null && (
                            <span className="text-[10px] text-gray-400 block">
                              {Math.round((c.total_participants / c.registered_count) * 100)}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400 ml-auto" />
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {/* Edit button */}
                              <button
                                onClick={() => openEditModal(c)}
                                className="flex items-center px-2 py-1 text-xs rounded border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-500 hover:text-blue-600"
                                title="Edit contest"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              {transitions.length > 0 && (
                                <div className="relative" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => setOpenDropdown(openDropdown === c.id ? null : c.id)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-100 text-gray-600"
                                  >
                                    <Play className="h-3 w-3" />
                                    <ChevronDown className="h-3 w-3" />
                                  </button>
                                  {openDropdown === c.id && (
                                    <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                      {transitions.map(t => (
                                        <button
                                          key={t}
                                          onClick={() => handleStatusChange(c.id, t)}
                                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 capitalize"
                                        >
                                          → {t}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              {c.status === 'scoring' && (
                                <button
                                  onClick={() => handleFinalize(c.id)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-purple-200 hover:bg-purple-50 text-purple-600"
                                  title="Finalize contest"
                                >
                                  <Flag className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${c.id}-detail`} className="border-b border-gray-100 bg-gray-50">
                          <td colSpan={10} className="px-8 py-3">
                            <div className="grid grid-cols-3 gap-6 text-xs text-gray-600">
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">Details</p>
                                <p><span className="text-gray-400">ID:</span> <span className="font-mono">{c.id}</span></p>
                                <p><span className="text-gray-400">Stage:</span> {STAGE_LABEL[c.stage_id] || c.stage_id}</p>
                                <p><span className="text-gray-400">Subject:</span> {subjectLabel || c.subject || '—'}</p>
                                <p><span className="text-gray-400">Status:</span> {c.status}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">Window</p>
                                <p><span className="text-gray-400">Start:</span> {fmtDate(c.scheduled_start)}</p>
                                <p><span className="text-gray-400">End:</span> {fmtDate(c.scheduled_end)}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">Results</p>
                                <p><span className="text-gray-400">Registered:</span> {c.registered_count ?? '—'}</p>
                                <p><span className="text-gray-400">Participated:</span> {c.total_participants ?? '—'}</p>
                                <p><span className="text-gray-400">Avg score:</span> {c.avg_score != null ? c.avg_score.toFixed(1) : '—'}</p>
                                <p><span className="text-gray-400">Questions:</span> {c.question_count ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* ── Create Series Modal ─────────────────────────────────────────── */}
      {showSeriesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-bold text-gray-900">New Contest Series</h2>
              <button onClick={() => setShowSeriesModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Series Title <span className="text-red-500">*</span></label>
                <Input
                  value={seriesForm.title}
                  onChange={e => setSeriesForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. OC Weekly Challenge"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Stage <span className="text-red-500">*</span></label>
                <select
                  value={seriesForm.stageId}
                  onChange={e => setSeriesForm(p => ({ ...p, stageId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={seriesForm.description}
                  onChange={e => setSeriesForm(p => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Optional description…"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => setShowSeriesModal(false)} className="flex-1">Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white flex-1" onClick={handleCreateSeries} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Series
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Contest Modal ────────────────────────────────────────── */}
      {showContestModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-bold text-gray-900">New Contest</h2>
              <button onClick={() => setShowContestModal(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

              {/* Series */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Series <span className="text-red-500">*</span></label>
                {seriesList.length > 0 ? (
                  <select
                    value={contestForm.seriesId}
                    onChange={e => setContestForm(p => ({ ...p, seriesId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Select a series —</option>
                    {seriesList.map(s => (
                      <option key={s.id} value={s.id}>{s.title} ({STAGE_LABEL[s.stage_id] || s.stage_id})</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={contestForm.seriesId}
                    onChange={e => setContestForm(p => ({ ...p, seriesId: e.target.value }))}
                    placeholder="Paste series ID (create a series first)"
                    className="text-sm font-mono"
                  />
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contest Title <span className="text-red-500">*</span></label>
                <Input
                  value={contestForm.title}
                  onChange={e => setContestForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. OC Weekly Challenge #3"
                  className="text-sm"
                />
              </div>

              {/* Stage + Subject */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Stage <span className="text-red-500">*</span></label>
                  <select
                    value={contestForm.stageId}
                    onChange={e => handleContestStageChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
                  <select
                    value={contestForm.subject}
                    onChange={e => handleContestSubjectChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {subjectsForForm.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Initial Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Status</label>
                <div className="flex gap-2">
                  {INITIAL_STATUSES.map(s => {
                    const sc = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setContestForm(p => ({ ...p, status: s }))}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          contestForm.status === s
                            ? `${sc.bg} ${sc.color} border-current`
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {sc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Window */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={contestForm.windowStartAt}
                    onChange={e => setContestForm(p => ({ ...p, windowStartAt: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={contestForm.windowEndAt}
                    onChange={e => setContestForm(p => ({ ...p, windowEndAt: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Question picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" />
                    Questions
                    {contestForm.questionIds.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold">
                        {contestForm.questionIds.length} selected
                      </span>
                    )}
                  </label>
                  {contestForm.questionIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setContestForm(p => ({ ...p, questionIds: [] }))}
                      className="text-[10px] text-gray-400 hover:text-red-500"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <QuestionPicker
                  stageId={contestForm.stageId}
                  subject={contestForm.subject}
                  selectedIds={contestForm.questionIds}
                  onChange={ids => setContestForm(p => ({ ...p, questionIds: ids }))}
                />
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => setShowContestModal(false)} className="flex-1">Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white flex-1" onClick={handleCreateContest} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Contest
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Contest Modal ──────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-bold text-gray-900">Edit Contest</h2>
              <button onClick={() => { setShowEditModal(false); setEditingContestId(null); }} className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {editLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
              </div>
            ) : (
              <>
                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

                  {/* Title */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contest Title <span className="text-red-500">*</span></label>
                    <Input
                      value={editForm.title}
                      onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Contest title"
                      className="text-sm"
                    />
                  </div>

                  {/* Stage + Subject */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Stage <span className="text-red-500">*</span></label>
                      <select
                        value={editForm.stageId}
                        onChange={e => {
                          const stageId = e.target.value;
                          const firstSubject = SUBJECTS_BY_STAGE[stageId]?.[0]?.value || 'math';
                          setEditForm(p => ({ ...p, stageId, subject: firstSubject, questionIds: [] }));
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Subject <span className="text-red-500">*</span></label>
                      <select
                        value={editForm.subject}
                        onChange={e => setEditForm(p => ({ ...p, subject: e.target.value, questionIds: [] }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        {(SUBJECTS_BY_STAGE[editForm.stageId] || SUBJECTS_BY_STAGE.oc_prep).map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(STATUS_CONFIG).map(([value, sc]) => {
                        const isCurrent = editForm.status === value;
                        const allowedNext = STATUS_TRANSITIONS[editForm.status] || [];
                        const isSelectable = isCurrent || allowedNext.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            disabled={!isSelectable}
                            onClick={() => isSelectable && setEditForm(p => ({ ...p, status: value }))}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                              isCurrent
                                ? `${sc.bg} ${sc.color} border-current ring-2 ring-offset-1 ring-current`
                                : isSelectable
                                  ? 'border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer'
                                  : 'border-gray-100 text-gray-300 cursor-not-allowed'
                            }`}
                          >
                            {sc.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">Only valid next statuses are selectable.</p>
                  </div>

                  {/* Window */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
                      <input
                        type="datetime-local"
                        value={editForm.windowStartAt}
                        onChange={e => setEditForm(p => ({ ...p, windowStartAt: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
                      <input
                        type="datetime-local"
                        value={editForm.windowEndAt}
                        onChange={e => setEditForm(p => ({ ...p, windowEndAt: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {/* Question picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" />
                        Questions
                        {editForm.questionIds.length > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold">
                            {editForm.questionIds.length} selected
                          </span>
                        )}
                      </label>
                      {editForm.questionIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setEditForm(p => ({ ...p, questionIds: [] }))}
                          className="text-[10px] text-gray-400 hover:text-red-500"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <QuestionPicker
                      stageId={editForm.stageId}
                      subject={editForm.subject}
                      selectedIds={editForm.questionIds}
                      onChange={ids => setEditForm(p => ({ ...p, questionIds: ids }))}
                    />
                  </div>
                </div>

                <div className="flex gap-3 px-5 py-4 border-t">
                  <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingContestId(null); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white flex-1" onClick={handleUpdateContest} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Series Modal ───────────────────────────────────────── */}
      {showEditSeriesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-base font-bold text-gray-900">Edit Series</h2>
              <button onClick={() => { setShowEditSeriesModal(false); setEditingSeriesId(null); }} className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Series Title <span className="text-red-500">*</span></label>
                <Input
                  value={editSeriesForm.title}
                  onChange={e => setEditSeriesForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Series title"
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Stage <span className="text-red-500">*</span></label>
                <select
                  value={editSeriesForm.stageId}
                  onChange={e => setEditSeriesForm(p => ({ ...p, stageId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {editingSeriesId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Series ID</label>
                  <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 select-all">{editingSeriesId}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => { setShowEditSeriesModal(false); setEditingSeriesId(null); }} className="flex-1">Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white flex-1" onClick={handleUpdateSeries} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
