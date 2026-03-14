'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, HelpCircle, Settings, LogOut, Home,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Questions', href: '/admin/questions', icon: HelpCircle },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const isAdminLogin = pathname === '/admin/login';
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated || isAdminLogin) return;
    if (!isAuthenticated) { router.push('/admin/login'); return; }
    if (user?.role !== 'admin') { router.push('/admin/login'); return; }
  }, [hydrated, isAuthenticated, user, router, isAdminLogin]);

  const isActive = (item: typeof NAV_ITEMS[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const handleLogout = () => { logout(); router.push('/admin/login'); };

  // Admin login page renders without the sidebar shell
  if (isAdminLogin) return <>{children}</>;

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-800">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white tracking-tight">
              Edu<span className="text-teal-400">Lens</span>
            </span>
            <span className="text-[10px] bg-teal-600 text-white px-1.5 py-0.5 rounded font-semibold">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item)
                  ? 'bg-gray-800 text-white'
                  : 'hover:bg-gray-800/60 hover:text-white'
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-gray-800 space-y-1">
          <Link
            href="/parent/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-gray-800/60 hover:text-white transition-colors"
          >
            <Home className="h-4 w-4" />
            Back to App
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-gray-800/60 hover:text-white transition-colors text-left"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>

        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate">{user?.name}</p>
          <p className="text-[10px] text-gray-600 truncate">{user?.email}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  );
}
