'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, HelpCircle, Users, Activity, Database } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/admin/questions?limit=1`).then(r => r.json()).catch(() => null),
      fetch(`${API}/admin/config`).then(r => r.json()).catch(() => null),
    ]).then(([qRes, cRes]) => {
      setStats({
        totalQuestions: qRes?.total ?? qRes?.questions?.length ?? '—',
        configKeys: cRes?.config ? Object.keys(cRes.config).length : '—',
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  const cards = [
    { label: 'Questions', value: stats?.totalQuestions, icon: HelpCircle, color: 'text-blue-600', bg: 'bg-blue-50', href: '/admin/questions' },
    { label: 'Config Keys', value: stats?.configKeys, icon: Database, color: 'text-purple-600', bg: 'bg-purple-50', href: '/admin/settings' },
    { label: 'Services', value: '6', icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Active', value: 'Online', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">System overview and management.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <Card key={c.label} className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                  <c.icon className={`h-4.5 w-4.5 ${c.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-extrabold ${c.color}`}>{c.value}</p>
                  <p className="text-xs text-gray-500">{c.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/admin/questions" className="block px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors">
                Manage Questions
              </Link>
              <Link href="/admin/questions?action=create" className="block px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors">
                Create New Question
              </Link>
              <Link href="/admin/settings" className="block px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors">
                Error Classification Settings
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">API Endpoints</h3>
            <div className="space-y-1.5 text-xs text-gray-500 font-mono">
              <p>GET  /admin/questions</p>
              <p>POST /admin/questions</p>
              <p>PUT  /admin/questions/:id</p>
              <p>DEL  /admin/questions/:id</p>
              <p>GET  /admin/config</p>
              <p>PUT  /admin/config</p>
              <p>POST /admin/bulk/import</p>
              <p>GET  /admin/bulk/export</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
