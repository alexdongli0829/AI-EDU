'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, Sparkles, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { login, studentLogin, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const { lang, setLang, t } = useI18n();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-white to-teal-50/30">
      <div className="w-full max-w-[400px]">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-200/50">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            Edu<span className="text-teal-600">Lens</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1.5 font-medium">{t.login.tagline}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xl shadow-gray-200/40 p-8">
          {/* Language switcher */}
          <div className="flex justify-end mb-3 -mt-2 -mr-2">
            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="font-medium">{lang === 'en' ? '中文' : 'English'}</span>
            </button>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{t.login.welcomeBack}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {t.login.subtitle}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                {t.login.emailOrUsername}
              </label>
              <Input
                type="text"
                placeholder={t.login.emailPlaceholder}
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); clearError(); }}
                autoComplete="username"
                required
                className="h-11 text-sm rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                {t.login.password}
              </label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  placeholder={t.login.passwordPlaceholder}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }}
                  autoComplete="current-password"
                  required
                  className="h-11 text-sm pr-10 rounded-xl"
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
              className="w-full h-11 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold text-sm mt-2 rounded-xl shadow-md shadow-teal-200/50 transition-all hover:shadow-lg"
              disabled={isLoading || !identifier || !password}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.signIn}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              {t.login.newParent}{' '}
              <Link href="/register" className="text-teal-600 font-semibold hover:text-teal-700 hover:underline underline-offset-2">
                {t.login.createAccount}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8 font-medium">
          {t.login.tagline}
        </p>
      </div>
    </div>
  );
}
