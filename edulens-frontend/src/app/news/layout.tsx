'use client';

import AppNav from '@/components/app-nav';

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
