'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { useI18n, Lang } from '@/lib/i18n';
import {
  Home, LayoutDashboard, ClipboardList, Users, LogOut,
  ChevronDown, GraduationCap, UserCheck, Sparkles, Newspaper, Globe,
} from 'lucide-react';

type NavItem = { labelKey: string; href: string; icon: React.ElementType; exact?: boolean };

const STUDENT_ITEMS: NavItem[] = [
  { labelKey: 'dashboard',      href: '/student/dashboard', icon: LayoutDashboard, exact: true },
  { labelKey: 'practiceTests',  href: '/student/test',      icon: ClipboardList },
  { labelKey: 'news',           href: '/news',              icon: Newspaper },
];

const PARENT_ITEMS: NavItem[] = [
  { labelKey: 'dashboard', href: '/parent/dashboard', icon: Users, exact: true },
  { labelKey: 'news',      href: '/news',              icon: Newspaper },
];

interface ChildProfile { id: string; name: string; gradeLevel: number; }

export default function AppNav() {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, student, setStudent, logout } = useAuthStore();
  const { lang, setLang, t } = useI18n();

  const [children, setChildren]       = useState<ChildProfile[]>([]);
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
      ? `Grade ${(student as any).gradeLevel}`
      : '';

  const showSwitcher = role === 'parent';

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">

        {/* Brand */}
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-gray-900 group-hover:text-teal-600 transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>
              Edu<span className="text-teal-600 group-hover:text-teal-700">Lens</span>
            </span>
          </Link>

          <div className="h-5 w-px bg-gray-200" />

          <div className="flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isActive(item)
                    ? 'bg-teal-50 text-teal-700 shadow-sm shadow-teal-100'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {(t.nav as any)[item.labelKey] || item.labelKey}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: profile + logout */}
        <div className="flex items-center gap-2">

          {showSwitcher ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm ${
                  activeIsParent ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                }`}>
                  {displayName?.charAt(0) ?? '?'}
                </div>
                <div className="hidden sm:block leading-tight text-left">
                  <p className="text-sm font-semibold text-gray-800 max-w-[100px] truncate">{displayName}</p>
                  {displaySub && <p className="text-[11px] text-gray-400">{displaySub}</p>}
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={switchToParent}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${
                      activeIsParent ? 'bg-purple-50/60' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {user?.name?.charAt(0) ?? 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
                      <p className="text-[11px] text-gray-400">{t.common.parent}</p>
                    </div>
                    {activeIsParent && <UserCheck className="h-4 w-4 text-purple-500 flex-shrink-0" />}
                  </button>

                  {children.length > 0 && (
                    <>
                      <div className="border-t border-gray-100 mx-3 my-1" />
                      <p className="px-3.5 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{t.common.children}</p>
                      {children.map(child => {
                        const active = student?.id === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => switchToChild(child)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${
                              active ? 'bg-teal-50/60' : ''
                            }`}
                          >
                            <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {child.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{child.name}</p>
                              <p className="text-[11px] text-gray-400">Grade {child.gradeLevel}</p>
                            </div>
                            {active && <UserCheck className="h-4 w-4 text-teal-500 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                {displayName?.charAt(0) ?? '?'}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">{displayName}</p>
                {displaySub && <p className="text-[11px] text-gray-400">{displaySub}</p>}
              </div>
            </div>
          )}

          {/* Language switcher */}
          <button
            onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-2 rounded-lg hover:bg-gray-50"
            title={lang === 'en' ? '切换中文' : 'Switch to English'}
          >
            <Globe className="h-4 w-4" />
            <span className="font-medium">{lang === 'en' ? '中文' : 'EN'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2.5 py-2 rounded-lg hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">{t.common.logout}</span>
          </button>
        </div>

      </div>
    </nav>
  );
}
