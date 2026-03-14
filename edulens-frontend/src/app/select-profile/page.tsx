'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Loader2, GraduationCap, Users, LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentProfile {
  id: string;
  name: string;
  gradeLevel: number;
  username: string;
  testsCompleted?: number;
}

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
      // Students skip the selector — go straight to dashboard
      router.replace('/student/dashboard');
      return;
    }
    // Parent: load their children
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
    // Set the student context so student pages can load data
    setStudent(s as any);
    router.push(`/student/dashboard`);
  };

  // Loading / redirect in progress
  if (!user || user.role !== 'parent') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAF9' }}>
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  const avatarColor = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-teal-100 text-teal-700', 'bg-amber-100 text-amber-700'];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: '#FAFAF9', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
    >
      {/* Brand */}
      <p className="text-xl font-extrabold text-gray-900 tracking-tight mb-1">
        Edu<span className="text-teal-600">Lens</span>
      </p>
      <p className="text-sm text-gray-500 mb-8">Who's using EduLens today?</p>

      <div className="w-full max-w-md space-y-3">

        {/* Parent card */}
        <button
          onClick={enterParentDashboard}
          className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left group"
        >
          <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-lg font-bold flex-shrink-0 group-hover:bg-purple-200 transition-colors">
            <Users className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">{user.name}</p>
            <p className="text-xs text-gray-500">Parent dashboard · manage children & analytics</p>
          </div>
          <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full flex-shrink-0">
            Parent
          </span>
        </button>

        {/* Divider */}
        {(loadingStudents || students.length > 0) && (
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">Children</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        )}

        {/* Students */}
        {loadingStudents ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
            <span className="text-xs text-gray-400">Loading students…</span>
          </div>
        ) : (
          students.map((s, i) => (
            <button
              key={s.id}
              onClick={() => enterStudentView(s)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border-2 border-gray-200 hover:border-teal-300 hover:shadow-md transition-all text-left group"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 group-hover:opacity-90 transition-opacity ${avatarColor[i % avatarColor.length]}`}>
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                <p className="text-xs text-gray-500">
                  Grade {s.gradeLevel}
                  {s.testsCompleted ? ` · ${s.testsCompleted} tests completed` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <GraduationCap className="h-4 w-4 text-teal-500" />
                <span className="text-xs font-semibold text-teal-600">Student</span>
              </div>
            </button>
          ))
        )}

        {/* Add student shortcut */}
        {!loadingStudents && (
          <button
            onClick={() => router.push('/parent/dashboard')}
            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600 transition-all text-sm"
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            <span>Add a student</span>
          </button>
        )}

      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-8 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  );
}
