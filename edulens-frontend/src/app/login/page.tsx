'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, studentLogin, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);

  // Already authenticated — go to the appropriate dashboard
  const { user } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role === 'parent') router.replace('/parent/dashboard');
    else if (user.role === 'student') router.replace('/student/dashboard');
    else router.replace('/select-profile');
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      // If identifier contains @, treat as parent/admin email login; otherwise student username
      if (identifier.includes('@')) {
        await login(identifier.trim(), password);
      } else {
        await studentLogin(identifier.trim(), password);
      }
      router.push('/select-profile');
    } catch {
      // error already set in store
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Edu<span className="text-teal-600">Lens</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">OC Exam Prep</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Sign in</h1>
          <p className="text-xs text-gray-500 mb-6">
            Use your email (parent) or student username
          </p>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Email or username
              </label>
              <Input
                type="text"
                placeholder="e.g. parent@email.com or alex123"
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); clearError(); }}
                autoComplete="username"
                required
                className="h-10 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  autoComplete="current-password"
                  required
                  className="h-10 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm mt-2"
              disabled={isLoading || !identifier || !password}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              New parent?{' '}
              <Link href="/register" className="text-teal-600 font-semibold hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          NSW Opportunity Class preparation · EduLens
        </p>
      </div>
    </div>
  );
}
