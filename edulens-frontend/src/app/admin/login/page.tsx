'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, Shield } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role === 'admin') router.replace('/admin');
    else {
      setAuthError('This account does not have admin access.');
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setAuthError(null);
    try {
      await login(email.trim(), password);
    } catch {
      // error set in store
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#111827', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4 border border-gray-700">
            <Shield className="h-6 w-6 text-teal-400" />
          </div>
          <p className="text-xl font-extrabold text-white tracking-tight">
            Edu<span className="text-teal-400">Lens</span> <span className="text-gray-500 font-medium text-sm">Admin</span>
          </p>
        </div>

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
          <h1 className="text-base font-bold text-white mb-1">Admin Sign In</h1>
          <p className="text-xs text-gray-500 mb-6">Authorized personnel only.</p>

          {(error || authError) && (
            <div className="mb-4 px-3 py-2.5 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-400">
              {authError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Email</label>
              <Input
                type="email"
                placeholder="admin@edulens.com"
                value={email}
                onChange={e => { setEmail(e.target.value); clearError(); setAuthError(null); }}
                autoComplete="username"
                required
                className="h-10 text-sm bg-gray-900 border-gray-700 text-white placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Password</label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); setAuthError(null); }}
                  autoComplete="current-password"
                  required
                  className="h-10 text-sm pr-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm mt-2"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
