'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { BookOpen, Brain, TrendingUp, MessageCircle, GraduationCap, Users, LogOut } from 'lucide-react';

interface ChildProfile { id: string; name: string; gradeLevel: number; }

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user, student, setStudent, logout } = useAuthStore();
  const [children, setChildren] = useState<ChildProfile[]>([]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'parent') {
      apiClient.listStudents(user.id)
        .then(res => setChildren(res.success ? res.students : []))
        .catch(() => {});
    }
  }, [isAuthenticated, user]);

  const handleLogout = () => { logout(); router.push('/'); };

  const enterStudentView = (child: ChildProfile) => {
    setStudent(child as any);
    router.push('/student/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary">EduLens</h1>
          </div>
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              {user.role === 'parent' && (
                <Button variant="outline" onClick={() => router.push('/parent/dashboard')}>
                  <Users className="h-4 w-4 mr-2 text-purple-600" />
                  {user.name}
                </Button>
              )}
              {user.role === 'parent' && children.map(child => (
                <Button key={child.id} variant="outline" onClick={() => enterStudentView(child)}>
                  <GraduationCap className="h-4 w-4 mr-2 text-teal-600" />
                  {child.name}
                </Button>
              ))}
              {user.role === 'student' && (
                <Button variant="outline" onClick={() => router.push('/student/dashboard')}>
                  <GraduationCap className="h-4 w-4 mr-2 text-teal-600" />
                  {student?.name ?? user.name}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-1" /> Sign out
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => router.push('/login')}>
                Sign In
              </Button>
              <Button onClick={() => router.push('/register')}>
                Get Started (Parents)
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          AI-Powered Personalized Learning
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Adaptive testing, real-time insights, and AI tutoring that understands each student's
          unique learning journey
        </p>
        <div className="flex gap-4 justify-center">
          {isAuthenticated && user ? (
            <Button size="lg" onClick={() => router.push('/select-profile')}>
              Go to My Dashboard
            </Button>
          ) : (
            <>
              <Button size="lg" onClick={() => router.push('/register')}>
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push('/login')}>
                Sign In
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Brain className="h-10 w-10 text-blue-600" />}
            title="Adaptive Testing"
            description="Real-time tests that adjust to student performance with WebSocket timer sync"
          />
          <FeatureCard
            icon={<TrendingUp className="h-10 w-10 text-green-600" />}
            title="Bayesian Analytics"
            description="Advanced skill mastery tracking with confidence intervals and error pattern analysis"
          />
          <FeatureCard
            icon={<MessageCircle className="h-10 w-10 text-purple-600" />}
            title="AI Tutoring"
            description="Socratic teaching method with Claude AI, streaming responses in real-time"
          />
          <FeatureCard
            icon={<BookOpen className="h-10 w-10 text-orange-600" />}
            title="Parent Insights"
            description="Detailed progress reports and AI-powered recommendations for parent support"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <StatCard number="10,000+" label="Students Learning" />
            <StatCard number="95%" label="Improvement Rate" />
            <StatCard number="4.9/5" label="Parent Rating" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2026 EduLens. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-primary mb-2">{number}</div>
      <div className="text-gray-600">{label}</div>
    </div>
  );
}
