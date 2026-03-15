'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { useI18n, Lang } from '@/lib/i18n';
import {
  LayoutDashboard, ClipboardList, Users, LogOut, Trophy,
  ChevronDown, UserCheck, Newspaper, Globe,
} from 'lucide-react';

type NavItem = { labelKey: string; href: string; icon: React.ElementType; exact?: boolean };

const STUDENT_ITEMS: NavItem[] = [
  { labelKey: 'dashboard',     href: '/student/dashboard', icon: LayoutDashboard, exact: true },
  { labelKey: 'practiceTests', href: '/student/test',      icon: ClipboardList },
  { labelKey: 'contests',      href: '/student/contests',  icon: Trophy },
  { labelKey: 'news',          href: '/news',              icon: Newspaper },
];

const PARENT_ITEMS: NavItem[] = [
  { labelKey: 'dashboard', href: '/parent/dashboard', icon: Users, exact: true },
  { labelKey: 'contests',  href: '/parent/contests',  icon: Trophy },
  { labelKey: 'news',      href: '/news',              icon: Newspaper },
];

interface ChildProfile { id: string; name: string; gradeLevel: number; }

/* Academic crest SVG — shield with mortarboard silhouette */
function AcademicCrest({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {/* Shield body */}
      <path
        d="M18 2L4 8v10c0 8 6.5 13.5 14 15 7.5-1.5 14-7 14-15V8L18 2z"
        fill="#B8860B" fillOpacity="0.15" stroke="#B8860B" strokeWidth="1.5"
      />
      {/* Mortarboard cap */}
      <polygon points="18,9 10,13 18,17 26,13" fill="#B8860B" />
      <rect x="17.2" y="17" width="1.6" height="5" fill="#B8860B" />
      <circle cx="18" cy="22.5" r="1.5" fill="#B8860B" />
      {/* Horizontal divider */}
      <line x1="9" y1="20" x2="27" y2="20" stroke="#B8860B" strokeWidth="0.8" strokeOpacity="0.5" />
      {/* Laurel dots */}
      <circle cx="11" cy="24" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="14" cy="26" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="25" cy="24" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="22" cy="26" r="1" fill="#B8860B" fillOpacity="0.6" />
    </svg>
  );
}

export default function AppNav() {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, student, setStudent, logout } = useAuthStore();
  const { lang, setLang, t } = useI18n();

  const [children, setChildren]         = useState<ChildProfile[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? 'student';
  const viewingAsStudent = role === 'parent' && student !== null;
  const navItems = (role === 'student' || viewingAsStudent) ? STUDENT_ITEMS : PARENT_ITEMS;

  useEffect(() => {
    if (role === 'parent' && user?.id) {
      apiClient.listStudents(user.id)
        .then(res => setChildren(res.success ? res.students : []))
        .catch(() => {});
    }
  }, [role, user?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); router.push('/login'); };

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href + '/') || pathname === item.href;
  };

  const switchToParent = () => {
    setStudent(null);
    setDropdownOpen(false);
    router.push('/parent/dashboard');
  };

  const switchToChild = (child: ChildProfile) => {
    setStudent(child as any);
    setDropdownOpen(false);
    router.push('/student/dashboard');
  };

  const activeIsParent = role === 'parent' && !student;
  const displayName = activeIsParent ? user?.name : (student?.name || user?.name);
  const displaySub  = activeIsParent
    ? 'Parent'
    : student
      ? `Year ${(student as any).gradeLevel}`
      : '';

  const showSwitcher = role === 'parent';

  return (
    <nav
      className="sticky top-0 z-50"
      style={{ background: 'var(--oxford-navy)', borderBottom: '2px solid var(--gold)' }}
    >
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between h-14">

        {/* ── Brand ────────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <AcademicCrest size={30} />
            <div className="leading-tight">
              <span
                className="block text-base font-bold tracking-wide"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--gold-bright)' }}
              >
                EduLens
              </span>
              <span
                className="block text-[9px] uppercase tracking-[0.16em] opacity-60"
                style={{ color: '#d4c48a', fontFamily: 'var(--font-body)' }}
              >
                Academic Excellence
              </span>
            </div>
          </Link>

          {/* Vertical rule */}
          <div className="h-6 w-px opacity-30" style={{ background: 'var(--gold)' }} />

          {/* Nav links */}
          <div className="flex items-center gap-0.5">
            {navItems.map(item => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors"
                  style={{
                    fontFamily: 'var(--font-body)',
                    color: active ? 'var(--gold-bright)' : 'rgba(232,237,244,0.82)',
                  }}
                >
                  <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {(t.nav as any)[item.labelKey] || item.labelKey}
                  {/* Gold underline for active */}
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ background: 'var(--gold-bright)' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Right side ───────────────────────────────────────── */}
        <div className="flex items-center gap-1">

          {showSwitcher ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors"
                style={{ background: dropdownOpen ? 'rgba(184,134,11,0.15)' : 'transparent' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: activeIsParent ? '#6b4fa0' : 'var(--forest)',
                    color: '#fff',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {displayName?.charAt(0) ?? '?'}
                </div>
                <div className="hidden sm:block leading-tight text-left">
                  <p className="text-sm font-semibold max-w-[100px] truncate" style={{ color: '#e8edf4', fontFamily: 'var(--font-body)' }}>{displayName}</p>
                  {displaySub && <p className="text-[10px] opacity-60" style={{ color: '#d4c48a' }}>{displaySub}</p>}
                </div>
                <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} style={{ color: '#d4c48a' }} />
              </button>

              {dropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-60 rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 border"
                  style={{ background: '#fff', borderColor: 'var(--parchment-mid)' }}
                >
                  {/* Parent row */}
                  <button
                    onClick={switchToParent}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                    style={{ background: activeIsParent ? '#f5f0ff' : undefined }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                         style={{ background: '#ede9f7', color: '#6b4fa0', fontFamily: 'var(--font-heading)' }}>
                      {user?.name?.charAt(0) ?? 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-400">{t.common.parent}</p>
                    </div>
                    {activeIsParent && <UserCheck className="h-4 w-4 flex-shrink-0" style={{ color: '#6b4fa0' }} />}
                  </button>

                  {children.length > 0 && (
                    <>
                      <div className="border-t border-gray-100 mx-3 my-1.5" />
                      <p className="px-4 pt-0.5 pb-1 text-[10px] uppercase tracking-widest text-gray-400 font-semibold"
                         style={{ fontFamily: 'var(--font-body)' }}>
                        {t.common.children}
                      </p>
                      {children.map(child => {
                        const active = student?.id === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => switchToChild(child)}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left"
                            style={{ background: active ? '#f0faf8' : undefined }}
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                 style={{ background: '#d8f0ea', color: 'var(--forest)', fontFamily: 'var(--font-heading)' }}>
                              {child.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{child.name}</p>
                              <p className="text-xs text-gray-400">Year {child.gradeLevel}</p>
                            </div>
                            {active && <UserCheck className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--forest)' }} />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--forest)', color: '#fff', fontFamily: 'var(--font-heading)' }}
              >
                {displayName?.charAt(0) ?? '?'}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-semibold max-w-[110px] truncate" style={{ color: '#e8edf4' }}>{displayName}</p>
                {displaySub && <p className="text-[10px] opacity-60" style={{ color: '#d4c48a' }}>{displaySub}</p>}
              </div>
            </div>
          )}

          {/* Language switcher */}
          <button
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-2 rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'rgba(212,196,138,0.8)' }}
            title={lang === 'en' ? '切换中文' : 'Switch to English'}
          >
            <Globe className="h-4 w-4" />
            <span>{lang === 'en' ? '中文' : 'EN'}</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-2 rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'rgba(232,237,244,0.6)' }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t.common.logout}</span>
          </button>
        </div>

      </div>
    </nav>
  );
}
