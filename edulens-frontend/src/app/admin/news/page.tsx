'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Plus, Pencil, Trash2, ChevronLeft, Check, AlertCircle, Eye, EyeOff,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
const headers = (): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['x-api-key'] = API_KEY;
  return h;
};

const CATEGORIES = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'update', label: 'Platform Update' },
  { value: 'tips', label: 'Tips & Advice' },
  { value: 'general', label: 'General' },
];

interface NewsPost {
  id: string; title: string; summary: string; content: string;
  category: string; is_published: boolean; published_at: string; created_at: string;
}

const EMPTY: Omit<NewsPost, 'id' | 'created_at'> = {
  title: '', summary: '', content: '', category: 'general',
  is_published: true, published_at: '',
};

export default function AdminNewsPage() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3500);
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/news?limit=50`, { headers: headers() });
      const data = await res.json();
      if (data.success) setPosts(data.posts || []);
    } catch { showToast('err', 'Failed to load posts'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const startCreate = () => {
    setEditing(null); setForm({ ...EMPTY }); setCreating(true);
  };
  const startEdit = (p: NewsPost) => {
    setCreating(false); setEditing(p);
    setForm({ title: p.title, summary: p.summary, content: p.content, category: p.category, is_published: p.is_published, published_at: '' });
  };
  const cancelEdit = () => { setEditing(null); setCreating(false); };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('err', 'Title is required'); return; }
    if (!form.content.trim()) { showToast('err', 'Content is required'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title, summary: form.summary, content: form.content,
        category: form.category, isPublished: form.is_published,
      };
      const url = editing ? `${API}/news/${editing.id}` : `${API}/news`;
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(payload) });
      if (res.ok) {
        showToast('ok', editing ? 'Post updated' : 'Post created');
        cancelEdit(); fetchPosts();
      } else showToast('err', 'Save failed');
    } catch { showToast('err', 'Network error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this news post?')) return;
    try {
      const res = await fetch(`${API}/news/${id}`, { method: 'DELETE', headers: headers() });
      if (res.ok) { showToast('ok', 'Post deleted'); fetchPosts(); }
      else showToast('err', 'Delete failed');
    } catch { showToast('err', 'Network error'); }
  };

  const showEditor = editing || creating;

  // ─── Editor ───
  if (showEditor) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={cancelEdit} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to list
        </button>
        <h1 className="text-lg font-bold text-gray-900 mb-5" style={{ fontFamily: 'var(--font-heading)' }}>
          {creating ? 'Create News Post' : 'Edit News Post'}
        </h1>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
            <Input
              value={form.title}
              onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))}
              placeholder="Post title"
              className="text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Summary (shown in list)</label>
            <Input
              value={form.summary}
              onChange={e => setForm((p: any) => ({ ...p, summary: e.target.value }))}
              placeholder="Brief summary..."
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.is_published}
                  onChange={e => setForm((p: any) => ({ ...p, is_published: e.target.checked }))}
                  className="w-4 h-4 accent-teal-600"
                />
                <span className="text-sm text-gray-700">Published</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Content <span className="text-gray-400 font-normal">(supports **bold** and line breaks)</span>
            </label>
            <textarea
              value={form.content}
              onChange={e => setForm((p: any) => ({ ...p, content: e.target.value }))}
              rows={12}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Write your news content here..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : creating ? 'Publish Post' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── List ───
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {toast.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>News Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Post
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center">
            <p className="text-sm text-gray-500 mb-4">No news posts yet.</p>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white" size="sm" onClick={startCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create First Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id} className="flex items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    post.category === 'announcement' ? 'bg-red-50 text-red-600' :
                    post.category === 'update' ? 'bg-blue-50 text-blue-600' :
                    post.category === 'tips' ? 'bg-purple-50 text-purple-600' :
                    'bg-gray-50 text-gray-500'
                  }`}>{CATEGORIES.find(c => c.value === post.category)?.label || post.category}</span>
                  {!post.is_published && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <EyeOff className="h-2.5 w-2.5" /> Draft
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(post.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate">{post.title}</p>
                {post.summary && <p className="text-xs text-gray-500 truncate">{post.summary}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => startEdit(post)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(post.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
