'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import {
  Home, LayoutDashboard, ClipboardList, Users, LogOut,
  ChevronDown, GraduationCap, UserCheck,
} from 'lucide-react';

type NavItem = { label: string; href: string; icon: React.ElementType; exact?: boolean };

const STUDENT_ITEMS: NavItem[] = [
  { label: 'Dashboard',      href: '/student/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Practice Tests', href: '/student/test',      icon: ClipboardList },
];

const PARENT_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/parent/dashboard', icon: Users, exact: true },
];

interface ChildProfile { id: string; name: string; gradeLevel: number; }

export default function AppNav() {
  const pathname   = usePathname();
  const router     = useRouter();
  const { user, student, setStudent, logout } = useAuthStore();

  const [children, setChildren]       = useState<ChildProfile[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = user?.role ?? 'student';
  // When a parent has selected a child, show student nav items
  const viewingAsStudent = role === 'parent' && student !== null;
  const navItems = (role === 'student' || viewingAsStudent) ? STUDENT_ITEMS : PARENT_ITEMS;

  // Fetch children list for parent accounts
  useEffect(() => {
    if (role === 'parent' && user?.id) {
      apiClient.listStudents(user.id)
        .then(res => setChildren(res.success ? res.students : []))
        .catch(() => {});
    }
  }, [role, user?.id]);

  // Close dropdown on outside click
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

  // Current profile display values
  const activeIsParent = role === 'parent' && !student;
  const displayName = activeIsParent ? user?.name : (student?.name || user?.name);
  const displaySub  = activeIsParent
    ? 'Parent'
    : student
      ? `Grade ${(student as any).gradeLevel}`
      : '';

  // Show switcher for parent accounts that have children, or for parent viewing a child
  const showSwitcher = role === 'parent';

  return (
    <nav
      className="bg-white border-b border-gray-200 sticky top-0 z-50"
      style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between" style={{ height: '52px' }}>

        {/* Brand + Home + nav links */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="text-sm font-extrabold text-gray-900 tracking-tight group-hover:text-teal-600 transition-colors">
              Edu<span className="text-teal-600">Lens</span>
            </span>
            <Home className="h-3.5 w-3.5 text-gray-400 group-hover:text-teal-600 transition-colors" />
          </Link>

          <span className="text-gray-200 text-lg font-light select-none">|</span>

          <div className="flex items-center gap-0.5">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item)
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: profile switcher + logout */}
        <div className="flex items-center gap-1">

          {showSwitcher ? (
            /* ── Profile switcher dropdown (parent accounts) ── */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  activeIsParent ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                }`}>
                  {displayName?.charAt(0) ?? '?'}
                </div>
                <div className="hidden sm:block leading-tight text-left">
                  <p className="text-xs font-semibold text-gray-800 max-w-[90px] truncate">{displayName}</p>
                  {displaySub && <p className="text-[10px] text-gray-400">{displaySub}</p>}
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  {/* Parent row */}
                  <button
                    onClick={switchToParent}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left ${
                      activeIsParent ? 'bg-purple-50' : ''
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {user?.name?.charAt(0) ?? 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
                      <p className="text-[10px] text-gray-400">Parent</p>
                    </div>
                    {activeIsParent && <UserCheck className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />}
                  </button>

                  {/* Children rows */}
                  {children.length > 0 && (
                    <>
                      <div className="border-t border-gray-100 mx-3 my-1" />
                      {children.map(child => {
                        const active = student?.id === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => switchToChild(child)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left ${
                              active ? 'bg-teal-50' : ''
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {child.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-800 truncate">{child.name}</p>
                              <p className="text-[10px] text-gray-400">Grade {child.gradeLevel}</p>
                            </div>
                            {active && <UserCheck className="h-3.5 w-3.5 text-teal-500 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── Simple avatar for direct student login ── */
            <div className="flex items-center gap-2 px-2">
              <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {displayName?.charAt(0) ?? '?'}
              </div>
              <div className="hidden sm:block leading-tight">
                <p className="text-xs font-semibold text-gray-800 max-w-[110px] truncate">{displayName}</p>
                {displaySub && <p className="text-[10px] text-gray-400">{displaySub}</p>}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1.5 rounded-md hover:bg-gray-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </div>
    </nav>
  );
}
