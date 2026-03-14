'use client';

import AppNav from '@/components/app-nav';

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
