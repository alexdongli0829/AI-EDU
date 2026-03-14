'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main login page with student parameter
    router.push('/login?student=true');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <p>Redirecting to student login...</p>
      </div>
    </div>
  );
}