'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Brain, TrendingUp, MessageCircle, Trophy,
  GraduationCap, Users, LogOut, ChevronRight, ArrowRight,
  Target, Sparkles, Star,
} from 'lucide-react';

interface ChildProfile { id: string; name: string; gradeLevel: number; }

// The learning pathway stages EduLens supports
const LEARNING_STAGES = [
  {
    id: 'oc_prep',
    label: 'OC Prep',
    sublabel: 'Year 4–5',
    description: 'NSW Opportunity Class entrance preparation',
    color: 'from-blue-500 to-blue-600',
    light: 'bg-blue-50 border-blue-200 text-blue-700',
    dot: 'bg-blue-500',
  },
  {
    id: 'selective_prep',
    label: 'Selective',
    sublabel: 'Year 6–7',
    description: 'NSW Selective High School entrance preparation',
    color: 'from-violet-500 to-violet-600',
    light: 'bg-violet-50 border-violet-200 text-violet-700',
    dot: 'bg-violet-500',
  },
  {
    id: 'hsc_prep',
    label: 'HSC',
    sublabel: 'Year 11–12',
    description: 'Higher School Certificate preparation',
    color: 'from-teal-500 to-teal-600',
    light: 'bg-teal-50 border-teal-200 text-teal-700',
    dot: 'bg-teal-500',
  },
  {
    id: 'university',
    label: 'University',
    sublabel: 'Beyond',
    description: 'Tertiary entrance and academic excellence',
    color: 'from-amber-500 to-amber-600',
    light: 'bg-amber-50 border-amber-200 text-amber-700',
    dot: 'bg-amber-500',
  },
];

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
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-lg leading-none">EduLens</span>
              <span className="block text-[9px] text-gray-400 leading-none tracking-wide uppercase">Learning Intelligence</span>
            </div>
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              {user.role === 'parent' && (
                <Button size="sm" variant="outline" onClick={() => router.push('/parent/dashboard')}>
                  <Users className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                  Dashboard
                </Button>
              )}
              {user.role === 'parent' && children.map(child => (
                <Button key={child.id} size="sm" variant="ghost" onClick={() => enterStudentView(child)}>
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5 text-violet-600" />
                  {child.name}
                </Button>
              ))}
              {user.role === 'student' && (
                <Button size="sm" variant="outline" onClick={() => router.push('/student/dashboard')}>
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                  My Dashboard
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5 mr-1" />Sign out
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>Sign In</Button>
              <Button size="sm" onClick={() => router.push('/register')}>Get Started Free</Button>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 pt-16 pb-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 text-xs font-semibold text-teal-700 mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            Built for NSW families · OC, Selective & HSC
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            One Learning Journey,<br />
            <span className="bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
              From OC Prep to HSC
            </span>
          </h1>
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
            EduLens tracks your child's learning intelligence across every milestone —
            OC entrance, Selective school, and HSC. The insights from each stage carry forward,
            making each exam a stepping stone, not a starting over.
          </p>
          <div className="flex gap-3 justify-center">
            {isAuthenticated && user ? (
              <Button size="lg" onClick={() => router.push('/parent/dashboard')} className="bg-teal-600 hover:bg-teal-700">
                Go to Dashboard <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => router.push('/register')} className="bg-teal-600 hover:bg-teal-700">
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/login')}>
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Learning Pathway Visualization */}
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-6">
            Your Child's Learning Pathway
          </p>
          <div className="flex items-center justify-between gap-2">
            {LEARNING_STAGES.map((stage, idx) => (
              <div key={stage.id} className="flex items-center flex-1">
                <div className="flex-1">
                  <div className={`rounded-xl border p-3 text-center ${stage.light}`}>
                    <div className="font-bold text-sm">{stage.label}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{stage.sublabel}</div>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-1.5 leading-tight">{stage.description}</p>
                </div>
                {idx < LEARNING_STAGES.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0 mx-1" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-teal-400" />
            <p className="text-[10px] text-gray-400">
              Learning DNA — skills, patterns, and traits — carries forward across every stage
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Intelligence that grows with your child</h2>
            <p className="text-gray-500 text-sm">Not just test prep — a lifelong learning profile</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard
              icon={<Brain className="h-8 w-8 text-blue-600" />}
              title="Adaptive Stage Testing"
              description="Stage-specific question banks and formats for OC, Selective, and HSC. Each test adapts to your child's current level."
            />
            <FeatureCard
              icon={<Trophy className="h-8 w-8 text-amber-500" />}
              title="Weekly Contests"
              description="Compete against peers in timed contests. See your child's real percentile ranking across thousands of students."
            />
            <FeatureCard
              icon={<TrendingUp className="h-8 w-8 text-teal-600" />}
              title="Learning DNA"
              description="Deep skill profiling, error pattern analysis, and time behaviour tracking that persists across every exam stage."
            />
            <FeatureCard
              icon={<MessageCircle className="h-8 w-8 text-violet-600" />}
              title="AI Parent Advisor"
              description="Ask anything about your child's performance. Get stage-aware insights powered by Claude AI with full context."
            />
          </div>
        </div>
      </section>

      {/* Contest Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs font-semibold text-amber-700 mb-4">
                <Trophy className="h-3.5 w-3.5" />
                Weekly Contests
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Where does your child rank among peers?
              </h2>
              <p className="text-gray-500 mb-5 leading-relaxed">
                Practice tests tell you how a student compares to themselves.
                EduLens Contests give parents the one signal that matters most:
                <strong className="text-gray-700"> real percentile ranking against actual peers preparing for the same exam.</strong>
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  'Same questions, same time, fair comparison',
                  'Anonymized leaderboard — privacy protected',
                  'Score distribution shows exactly where your child stands',
                  'Percentile trend tracks improvement over weeks',
                ].map(point => (
                  <li key={point} className="flex items-start gap-2 text-sm text-gray-600">
                    <Star className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
              {!isAuthenticated && (
                <Button onClick={() => router.push('/register')} className="bg-amber-500 hover:bg-amber-600">
                  Join Next Contest <Trophy className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">OC Weekly Challenge #12</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Open</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Registered', value: '127' },
                  { label: 'Questions', value: '30' },
                  { label: 'Duration', value: '30 min' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-lg p-3 border border-gray-100 text-center">
                    <p className="text-base font-bold text-gray-900">{s.value}</p>
                    <p className="text-[9px] text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-2">Last week's result — Mia Chen</p>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-900">Rank #18 of 94</span>
                  <span className="text-sm font-bold text-teal-600">81st percentile</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-teal-500" style={{ width: '81%' }} />
                </div>
                <p className="text-[9px] text-gray-400 mt-1">Better than 81% of participants</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gradient-to-r from-teal-600 to-blue-600 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-6 text-center text-white">
            {[
              { n: '4+', l: 'Exam Stages Covered' },
              { n: 'Weekly', l: 'Contests Available' },
              { n: 'Real-time', l: 'Skill Tracking' },
              { n: 'NSW', l: 'Curriculum Aligned' },
            ].map(s => (
              <div key={s.l}>
                <div className="text-3xl font-bold mb-1">{s.n}</div>
                <div className="text-teal-100 text-sm">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!isAuthenticated && (
        <section className="py-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Start your child's learning journey today</h2>
            <p className="text-gray-500 mb-6 text-sm">Free to start. No credit card required. Works for OC, Selective, and HSC.</p>
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={() => router.push('/register')} className="bg-teal-600 hover:bg-teal-700">
                Create Free Account
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push('/login')}>
                Sign In
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t py-6 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span>EduLens · NSW Learning Intelligence Platform</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => router.push('/news')} className="hover:text-gray-600">News</button>
            <span>&copy; 2026 EduLens</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
