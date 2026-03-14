'use client';

import { usePathname } from 'next/navigation';
import AppNav from '@/components/app-nav';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // No nav during active test (immersive experience) or on the login page
  const hideNav =
    pathname === '/student/login' ||
    pathname.startsWith('/student/test/take/');

  return (
    <>
      {!hideNav && <AppNav />}
      {children}
    </>
  );
}
