'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import {
  Loader2, Megaphone, Lightbulb, RefreshCw, ChevronRight,
  Calendar, Tag, ArrowLeft,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

const CATEGORIES: Record<string, { labelKey: keyof typeof import('@/lib/i18n/en').default.news; color: string; bg: string; border: string }> = {
  announcement: { labelKey: 'announcement', color: '#DC2626', bg: 'bg-red-50', border: 'border-red-200' },
  update:       { labelKey: 'platformUpdate', color: '#2563EB', bg: 'bg-blue-50', border: 'border-blue-200' },
  tips:         { labelKey: 'tipsAdvice', color: '#7C3AED', bg: 'bg-purple-50', border: 'border-purple-200' },
  general:      { labelKey: 'general', color: '#6B7280', bg: 'bg-gray-50', border: 'border-gray-200' },
};

interface NewsPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  published_at: string;
}

export default function NewsPage() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [filterCategory, setFilterCategory] = useState('');

  useEffect(() => {
    fetchPosts();
  }, [filterCategory]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (filterCategory) params.set('category', filterCategory);
      const res = await fetch(`${API}/news?${params}`);
      const data = await res.json();
      if (data.success) setPosts(data.posts || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getCat = (cat: string) => {
    const c = CATEGORIES[cat] || CATEGORIES.general;
    return { ...c, label: (t.news as any)[c.labelKey] || c.labelKey };
  };

  // ─── Single post view ───
  if (selectedPost) {
    const cat = getCat(selectedPost.category);
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <button
            onClick={() => setSelectedPost(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> {t.news.backToNews}
          </button>

          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cat.bg} ${cat.border} border`} style={{ color: cat.color }}>
              {cat.label}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(selectedPost.published_at)}
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
            {selectedPost.title}
          </h1>

          {selectedPost.summary && (
            <p className="text-base text-gray-600 mb-6 leading-relaxed font-medium">
              {selectedPost.summary}
            </p>
          )}

          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
            {selectedPost.content.split('\n').map((line, i) => {
              if (!line.trim()) return <br key={i} />;
              if (line.startsWith('- ')) return (
                <div key={i} className="flex items-start gap-2 mb-1.5 pl-1">
                  <span className="text-teal-500 mt-0.5">&#8226;</span>
                  <span>{renderBold(line.slice(2))}</span>
                </div>
              );
              if (/^\d+\./.test(line)) return (
                <div key={i} className="flex items-start gap-2 mb-2 pl-1">
                  <span className="text-teal-600 font-bold text-sm min-w-[1.2rem]">{line.match(/^\d+/)?.[0]}.</span>
                  <span>{renderBold(line.replace(/^\d+\.\s*/, ''))}</span>
                </div>
              );
              return <p key={i} className="mb-3">{renderBold(line)}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── News list ───
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
            {t.news.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.news.subtitle}
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              !filterCategory ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t.news.all}
          </button>
          {Object.entries(CATEGORIES).map(([key, { labelKey, color, bg, border }]) => (
            <button
              key={key}
              onClick={() => setFilterCategory(filterCategory === key ? '' : key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterCategory === key ? `${bg} ${border}` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
              style={filterCategory === key ? { color } : undefined}
            >
              {(t.news as any)[labelKey] || labelKey}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center">
              <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t.news.noPosts}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post, i) => {
              const cat = getCat(post.category);
              const isFirst = i === 0;
              return (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className={`w-full text-left transition-all hover:shadow-md rounded-2xl border border-gray-200/80 bg-white overflow-hidden group ${
                    isFirst ? 'p-6' : 'p-5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.bg} ${cat.border} border`}
                          style={{ color: cat.color }}
                        >
                          {cat.label}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(post.published_at)}</span>
                      </div>
                      <h3 className={`font-bold text-gray-900 mb-1.5 group-hover:text-teal-700 transition-colors ${isFirst ? 'text-lg' : 'text-base'}`}
                          style={{ fontFamily: 'var(--font-heading)' }}>
                        {post.title}
                      </h3>
                      {post.summary && (
                        <p className={`text-gray-500 leading-relaxed ${isFirst ? 'text-sm' : 'text-xs'}`}>
                          {post.summary}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-teal-500 flex-shrink-0 mt-1 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
