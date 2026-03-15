'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

/* Academic crest — reused from app-nav */
function AcademicCrest({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M18 2L4 8v10c0 8 6.5 13.5 14 15 7.5-1.5 14-7 14-15V8L18 2z"
        fill="#B8860B" fillOpacity="0.18" stroke="#B8860B" strokeWidth="1.5"
      />
      <polygon points="18,9 10,13 18,17 26,13" fill="#B8860B" />
      <rect x="17.2" y="17" width="1.6" height="5" fill="#B8860B" />
      <circle cx="18" cy="22.5" r="1.5" fill="#B8860B" />
      <line x1="9" y1="20" x2="27" y2="20" stroke="#B8860B" strokeWidth="0.8" strokeOpacity="0.5" />
      <circle cx="11" cy="24" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="14" cy="26" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="25" cy="24" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="22" cy="26" r="1" fill="#B8860B" fillOpacity="0.6" />
    </svg>
  );
}

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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--parchment)' }}
    >
      {/* Decorative top bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1"
        style={{ background: 'var(--oxford-navy)' }}
      />

      <div className="w-full max-w-[420px]">

        {/* Brand lockup */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'var(--oxford-navy)', border: '2px solid var(--gold)' }}
            >
              <AcademicCrest size={52} />
            </div>
          </div>
          <h1
            className="text-4xl font-bold tracking-wide"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}
          >
            EduLens
          </h1>
          <p
            className="text-xs uppercase tracking-[0.22em] mt-1 font-semibold"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)' }}
          >
            Academic Excellence
          </p>
          <p className="text-sm mt-3" style={{ color: '#6b7280', fontFamily: 'var(--font-serif)' }}>
            {t.login.tagline}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl shadow-xl p-8 border"
          style={{
            background: '#fff',
            borderColor: 'var(--parchment-mid)',
            borderTop: '3px solid var(--oxford-navy)',
          }}
        >
          {/* Language switcher */}
          <div className="flex justify-end mb-4 -mt-1 -mr-1">
            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-gray-50"
              style={{ color: 'var(--gold)', border: '1px solid var(--parchment-mid)' }}
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === 'en' ? '中文' : 'English'}
            </button>
          </div>

          <h2
            className="text-xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--navy-dark)' }}
          >
            {t.login.welcomeBack}
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280', fontFamily: 'var(--font-body)' }}>
            {t.login.subtitle}
          </p>

          {error && (
            <div
              className="mb-5 px-4 py-3 rounded-lg text-sm font-medium border"
              style={{ background: '#fef2f2', borderColor: '#fecaca', color: 'var(--crimson)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--navy-mid)', fontFamily: 'var(--font-body)' }}
              >
                {t.login.emailOrUsername}
              </label>
              <Input
                type="text"
                placeholder={t.login.emailPlaceholder}
                value={identifier}
                onChange={e => { setIdentifier(e.target.value); clearError(); }}
                autoComplete="username"
                required
                className="h-11 text-sm"
                style={{ borderColor: 'var(--parchment-mid)', fontFamily: 'var(--font-body)' }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--navy-mid)', fontFamily: 'var(--font-body)' }}
              >
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
                  className="h-11 text-sm pr-10"
                  style={{ borderColor: 'var(--parchment-mid)', fontFamily: 'var(--font-body)' }}
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
              className="w-full h-11 text-sm font-semibold mt-1"
              disabled={isLoading || !identifier || !password}
              style={{
                background: isLoading || !identifier || !password ? undefined : 'var(--oxford-navy)',
                color: '#fff',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.04em',
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.signIn}
            </Button>
          </form>

          <div
            className="mt-6 pt-5 border-t text-center"
            style={{ borderColor: 'var(--parchment-mid)' }}
          >
            <p className="text-sm" style={{ color: '#6b7280', fontFamily: 'var(--font-body)' }}>
              {t.login.newParent}{' '}
              <Link
                href="/register"
                className="font-semibold hover:underline underline-offset-2"
                style={{ color: 'var(--oxford-navy)' }}
              >
                {t.login.createAccount}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p
          className="text-center text-xs mt-8"
          style={{ color: '#9ca3af', fontFamily: 'var(--font-body)' }}
        >
          &copy; {new Date().getFullYear()} EduLens — Committed to Academic Excellence
        </p>
      </div>
    </div>
  );
}
