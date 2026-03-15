'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Loader2, GraduationCap, Users, LogOut, Plus } from 'lucide-react';

interface StudentProfile {
  id: string;
  name: string;
  gradeLevel: number;
  username: string;
  testsCompleted?: number;
}

/* Academic crest SVG */
function AcademicCrest({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M18 2L4 8v10c0 8 6.5 13.5 14 15 7.5-1.5 14-7 14-15V8L18 2z"
        fill="#B8860B" fillOpacity="0.18" stroke="#B8860B" strokeWidth="1.5" />
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

/* Avatar colours cycle — deeper, more academic tones */
const AVATAR_STYLES = [
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#ede9f7', color: '#6b21a8' },
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#fef3c7', color: '#92400e' },
];

export default function SelectProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, setStudent, logout } = useAuthStore();

  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'admin') {
      router.replace('/admin/dashboard');
      return;
    }
    if (user.role === 'student') {
      router.replace('/student/dashboard');
      return;
    }
    if (user.role === 'parent') {
      setLoadingStudents(true);
      apiClient.listStudents(user.id)
        .then(res => setStudents(res.success ? res.students : []))
        .catch(() => setStudents([]))
        .finally(() => setLoadingStudents(false));
    }
  }, [isAuthenticated, user, router]);

  const handleLogout = () => { logout(); router.push('/login'); };

  const enterParentDashboard = () => {
    setStudent(null);
    router.push('/parent/dashboard');
  };

  const enterStudentView = (s: StudentProfile) => {
    setStudent(s as any);
    router.push('/student/dashboard');
  };

  if (!user || user.role !== 'parent') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--parchment)' }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--oxford-navy)' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--parchment)', fontFamily: 'var(--font-body)' }}
    >
      {/* Decorative top bar */}
      <div className="fixed top-0 left-0 right-0 h-1" style={{ background: 'var(--oxford-navy)' }} />

      {/* Brand lockup */}
      <div className="text-center mb-9">
        <div className="flex justify-center mb-4">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--oxford-navy)', border: '2px solid var(--gold)' }}
          >
            <AcademicCrest size={54} />
          </div>
        </div>
        <h1
          className="text-4xl font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}
        >
          EduLens
        </h1>
        <p
          className="text-sm uppercase tracking-[0.2em] mt-1 font-semibold"
          style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)' }}
        >
          Academic Excellence
        </p>
        <p className="text-base mt-3" style={{ color: '#6b7280', fontFamily: 'var(--font-serif)' }}>
          Who's using EduLens today?
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">

        {/* Parent card */}
        <button
          onClick={enterParentDashboard}
          className="w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left group"
          style={{
            background: '#fff',
            borderColor: 'var(--parchment-mid)',
            borderTop: '3px solid var(--oxford-navy)',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--oxford-navy)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--parchment-mid)')}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--oxford-navy)' }}
          >
            <Users className="h-7 w-7" style={{ color: 'var(--gold-bright)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}>
              {user.name}
            </p>
            <p className="text-sm" style={{ color: '#9ca3af' }}>Parent dashboard · manage children &amp; analytics</p>
          </div>
          <span
            className="text-sm font-semibold px-3 py-1 rounded-full flex-shrink-0"
            style={{ background: 'rgba(28,53,87,0.08)', color: 'var(--oxford-navy)', border: '1px solid var(--navy-light)', fontFamily: 'var(--font-body)' }}
          >
            Parent
          </span>
        </button>

        {/* Divider */}
        {(loadingStudents || students.length > 0) && (
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px" style={{ background: 'var(--parchment-mid)' }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)' }}>
              Children
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--parchment-mid)' }} />
          </div>
        )}

        {/* Student cards */}
        {loadingStudents ? (
          <div className="flex items-center justify-center py-5">
            <Loader2 className="h-5 w-5 animate-spin mr-2" style={{ color: 'var(--oxford-navy)' }} />
            <span className="text-xs" style={{ color: '#9ca3af' }}>Loading students…</span>
          </div>
        ) : (
          students.map((s, i) => {
            const av = AVATAR_STYLES[i % AVATAR_STYLES.length];
            return (
              <button
                key={s.id}
                onClick={() => enterStudentView(s)}
                className="w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left"
                style={{ background: '#fff', borderColor: 'var(--parchment-mid)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--parchment-mid)')}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
                  style={{ background: av.bg, color: av.color, fontFamily: 'var(--font-heading)' }}
                >
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}>
                    {s.name}
                  </p>
                  <p className="text-sm" style={{ color: '#9ca3af' }}>
                    Year {s.gradeLevel}
                    {s.testsCompleted ? ` · ${s.testsCompleted} tests completed` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <GraduationCap className="h-5 w-5" style={{ color: 'var(--gold)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--oxford-navy)', fontFamily: 'var(--font-body)' }}>
                    Student
                  </span>
                </div>
              </button>
            );
          })
        )}

        {/* Add student shortcut */}
        {!loadingStudents && (
          <button
            onClick={() => router.push('/parent/dashboard')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed text-base transition-all"
            style={{ borderColor: 'var(--parchment-mid)', color: '#9ca3af' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--gold)';
              e.currentTarget.style.color = 'var(--oxford-navy)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--parchment-mid)';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span style={{ fontFamily: 'var(--font-body)' }}>Add a student</span>
          </button>
        )}

      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-9 flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: '#9ca3af', fontFamily: 'var(--font-body)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--oxford-navy)')}
        onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>

      {/* Footer note */}
      <p className="mt-6 text-xs" style={{ color: '#d1d5db', fontFamily: 'var(--font-body)' }}>
        &copy; {new Date().getFullYear()} EduLens — Academic Excellence
      </p>
    </div>
  );
}
