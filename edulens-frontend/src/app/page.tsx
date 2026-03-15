'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  BookOpen, Brain, TrendingUp, MessageCircle, Trophy,
  GraduationCap, Users, LogOut, ChevronRight, ArrowRight,
  Target, Star,
} from 'lucide-react';

interface ChildProfile { id: string; name: string; gradeLevel: number; }

const LEARNING_STAGES = [
  {
    id: 'oc_prep',
    label: 'OC Prep',
    sublabel: 'Year 4–5',
    description: 'NSW Opportunity Class entrance preparation',
    color: '#2563EB',
  },
  {
    id: 'selective',
    label: 'Selective',
    sublabel: 'Year 6–7',
    description: 'NSW Selective High School entrance preparation',
    color: '#7C3AED',
  },
  {
    id: 'hsc',
    label: 'HSC',
    sublabel: 'Year 11–12',
    description: 'Higher School Certificate preparation',
    color: '#0D9488',
  },
  {
    id: 'lifelong',
    label: 'University',
    sublabel: 'Beyond',
    description: 'Tertiary entrance and academic excellence',
    color: '#D97706',
  },
];

/* Academic crest SVG */
function AcademicCrest({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M18 2L4 8v10c0 8 6.5 13.5 14 15 7.5-1.5 14-7 14-15V8L18 2z"
        fill="#B8860B" fillOpacity="0.18" stroke="#B8860B" strokeWidth="1.5" />
      <polygon points="18,9 10,13 18,17 26,13" fill="#B8860B" />
      <rect x="17.2" y="17" width="1.6" height="5" fill="#B8860B" />
      <circle cx="18" cy="22.5" r="1.5" fill="#B8860B" />
      <line x1="9" y1="20" x2="27" y2="20" stroke="#B8860B" strokeWidth="0.8" strokeOpacity="0.5" />
      <circle cx="11" cy="24" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="14" cy="26" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="25" cy="24" r="1" fill="#B8860B" fillOpacity="0.6" />
      <circle cx="22" cy="26" r="1" fill="#B8860B" fillOpacity="0.6" />
    </svg>
  );
}

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
    <div className="min-h-screen" style={{ background: 'var(--parchment)', fontFamily: 'var(--font-body)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40" style={{ background: 'var(--oxford-navy)', borderBottom: '2px solid var(--gold)' }}>
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <AcademicCrest size={34} />
            <div className="leading-tight">
              <span className="block text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--gold-bright)' }}>
                EduLens
              </span>
              <span className="block text-[9px] uppercase tracking-[0.18em] opacity-60" style={{ color: '#d4c48a' }}>
                Academic Excellence
              </span>
            </div>
          </div>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              {user.role === 'parent' && (
                <Button size="sm" variant="outline" onClick={() => router.push('/parent/dashboard')}
                  style={{ borderColor: 'rgba(232,237,244,0.35)', color: '#e8edf4', background: 'transparent' }}>
                  <Users className="h-3.5 w-3.5 mr-1.5" />Dashboard
                </Button>
              )}
              {user.role === 'parent' && children.map(child => (
                <Button key={child.id} size="sm" variant="ghost" onClick={() => enterStudentView(child)}
                  style={{ color: 'var(--gold-bright)' }}>
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5" />{child.name}
                </Button>
              ))}
              {user.role === 'student' && (
                <Button size="sm" variant="outline" onClick={() => router.push('/student/dashboard')}
                  style={{ borderColor: 'rgba(232,237,244,0.35)', color: '#e8edf4', background: 'transparent' }}>
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5" />My Dashboard
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleLogout} style={{ color: 'rgba(232,237,244,0.6)' }}>
                <LogOut className="h-3.5 w-3.5 mr-1" />Sign out
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push('/login')}
                style={{ color: 'rgba(232,237,244,0.8)' }}>Sign In</Button>
              <Button size="sm" onClick={() => router.push('/register')}
                style={{ background: 'var(--gold)', color: 'var(--navy-dark)', fontWeight: 700 }}>
                Get Started
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 pt-18 pb-14 pt-16">
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-6"
            style={{ background: 'rgba(28,53,87,0.08)', border: '1px solid var(--gold)', color: 'var(--oxford-navy)', fontFamily: 'var(--font-body)', letterSpacing: '0.04em' }}
          >
            <Target className="h-3.5 w-3.5" style={{ color: 'var(--gold)' }} />
            Built for NSW families · OC, Selective &amp; HSC
          </div>
          <h1
            className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}
          >
            One Learning Journey,<br />
            <span style={{ color: 'var(--gold)' }}>From OC Prep to HSC</span>
          </h1>
          <p
            className="text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#6b7280', fontFamily: 'var(--font-serif)' }}
          >
            EduLens tracks your child's learning intelligence across every milestone —
            OC entrance, Selective school, and HSC. The insights from each stage carry forward,
            making each exam a stepping stone, not a starting over.
          </p>
          <div className="flex gap-3 justify-center">
            {isAuthenticated && user ? (
              <Button size="lg" onClick={() => router.push('/parent/dashboard')}
                style={{ background: 'var(--oxford-navy)', color: '#fff', fontFamily: 'var(--font-body)' }}>
                Go to Dashboard <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button size="lg" onClick={() => router.push('/register')}
                  style={{ background: 'var(--oxford-navy)', color: '#fff', fontFamily: 'var(--font-body)' }}>
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/login')}
                  style={{ borderColor: 'var(--oxford-navy)', color: 'var(--oxford-navy)', fontFamily: 'var(--font-body)' }}>
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Learning Pathway */}
        <div
          className="rounded-xl p-7 border"
          style={{ background: '#fff', borderColor: 'var(--parchment-mid)', borderTop: '3px solid var(--oxford-navy)' }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest text-center mb-6"
            style={{ color: 'var(--gold)', fontFamily: 'var(--font-body)' }}
          >
            Your Child's Academic Pathway
          </p>
          <div className="flex items-center justify-between gap-2">
            {LEARNING_STAGES.map((stage, idx) => (
              <div key={stage.id} className="flex items-center flex-1">
                <div className="flex-1">
                  <div
                    className="rounded-lg border p-4 text-center"
                    style={{ borderColor: stage.color, background: `${stage.color}0f` }}
                  >
                    <div className="font-bold text-base" style={{ color: stage.color, fontFamily: 'var(--font-serif)' }}>{stage.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: stage.color, opacity: 0.7 }}>{stage.sublabel}</div>
                  </div>
                  <p className="text-xs text-center mt-2 leading-tight" style={{ color: '#9ca3af' }}>{stage.description}</p>
                </div>
                {idx < LEARNING_STAGES.length - 1 && (
                  <ArrowRight className="h-5 w-5 flex-shrink-0 mx-1" style={{ color: 'var(--gold)' }} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gold)' }} />
            <p className="text-sm" style={{ color: '#9ca3af', fontFamily: 'var(--font-body)' }}>
              Learning DNA — skills, patterns, and traits — carries forward across every stage
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="py-16" style={{ background: 'var(--parchment-mid)' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-bold mb-2 heading-rule"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}
            >
              Intelligence that grows with your child
            </h2>
            <p className="text-lg mt-4" style={{ color: '#6b7280', fontFamily: 'var(--font-serif)' }}>
              Not just test prep — a lifelong learning profile
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard
              icon={<Brain className="h-9 w-9" style={{ color: '#2563EB' }} />}
              title="Adaptive Stage Testing"
              description="Stage-specific question banks and formats for OC, Selective, and HSC. Each test adapts to your child's current level."
            />
            <FeatureCard
              icon={<Trophy className="h-9 w-9" style={{ color: 'var(--gold)' }} />}
              title="Weekly Contests"
              description="Compete against peers in timed contests. See your child's real percentile ranking across thousands of students."
            />
            <FeatureCard
              icon={<TrendingUp className="h-9 w-9" style={{ color: 'var(--forest)' }} />}
              title="Learning DNA"
              description="Deep skill profiling, error pattern analysis, and time behaviour tracking that persists across every exam stage."
            />
            <FeatureCard
              icon={<MessageCircle className="h-9 w-9" style={{ color: '#7C3AED' }} />}
              title="AI Parent Advisor"
              description="Ask anything about your child's performance. Get stage-aware insights powered by Claude AI with full context."
            />
          </div>
        </div>
      </section>

      {/* ── Contest Section ─────────────────────────────────────────────── */}
      <section className="py-16" style={{ background: 'var(--parchment)' }}>
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-5"
                style={{ background: 'rgba(184,134,11,0.1)', border: '1px solid var(--gold)', color: 'var(--gold)' }}
              >
                <Trophy className="h-3.5 w-3.5" />
                Weekly Contests
              </div>
              <h2
                className="text-3xl font-bold mb-4"
                style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}
              >
                Where does your child rank among peers?
              </h2>
              <p className="text-lg mb-6 leading-relaxed" style={{ color: '#6b7280', fontFamily: 'var(--font-serif)' }}>
                Practice tests tell you how a student compares to themselves.
                EduLens Contests give parents the one signal that matters most:{' '}
                <strong style={{ color: 'var(--oxford-navy)' }}>real percentile ranking against actual peers preparing for the same exam.</strong>
              </p>
              <ul className="space-y-2.5 mb-7">
                {[
                  'Same questions, same time, fair comparison',
                  'Anonymised leaderboard — privacy protected',
                  'Score distribution shows exactly where your child stands',
                  'Percentile trend tracks improvement over weeks',
                ].map(point => (
                  <li key={point} className="flex items-start gap-2.5 text-base" style={{ color: '#6b7280' }}>
                    <Star className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} />
                    {point}
                  </li>
                ))}
              </ul>
              {!isAuthenticated && (
                <Button onClick={() => router.push('/register')}
                  style={{ background: 'var(--oxford-navy)', color: '#fff', fontFamily: 'var(--font-body)' }}>
                  Join Next Contest <Trophy className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>

            {/* Mock contest card */}
            <div
              className="rounded-xl p-6 space-y-4 border"
              style={{ background: '#fff', borderColor: 'var(--parchment-mid)', borderTop: '3px solid var(--oxford-navy)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--oxford-navy)' }}>
                  OC Weekly Challenge #12
                </p>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#dcfce7', color: '#15803d' }}
                >
                  Open
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Registered', value: '127' },
                  { label: 'Questions', value: '30' },
                  { label: 'Duration', value: '30 min' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-3 text-center border" style={{ borderColor: 'var(--parchment-mid)' }}>
                    <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}>{s.value}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--parchment-mid)' }}>
                <p className="text-sm mb-2" style={{ color: '#9ca3af' }}>Last week's result — Mia Chen</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold" style={{ color: 'var(--oxford-navy)', fontFamily: 'var(--font-heading)' }}>Rank #18 of 94</span>
                  <span className="text-base font-bold" style={{ color: 'var(--forest)' }}>81st percentile</span>
                </div>
                <div className="w-full rounded-full h-2.5" style={{ background: 'var(--parchment-mid)' }}>
                  <div className="h-2.5 rounded-full" style={{ width: '81%', background: 'var(--forest)' }} />
                </div>
                <p className="text-xs mt-1.5" style={{ color: '#9ca3af' }}>Better than 81% of participants</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Banner ───────────────────────────────────────────────── */}
      <section className="py-14" style={{ background: 'var(--oxford-navy)', borderTop: '2px solid var(--gold)', borderBottom: '2px solid var(--gold)' }}>
        <div className="max-w-4xl mx-auto px-5">
          <div className="grid md:grid-cols-4 gap-6 text-center">
            {[
              { n: '4+', l: 'Exam Stages Covered' },
              { n: 'Weekly', l: 'Contests Available' },
              { n: 'Real-time', l: 'Skill Tracking' },
              { n: 'NSW', l: 'Curriculum Aligned' },
            ].map(s => (
              <div key={s.l}>
                <div className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--gold-bright)' }}>{s.n}</div>
                <div className="text-base" style={{ color: 'rgba(232,237,244,0.65)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      {!isAuthenticated && (
        <section className="py-16" style={{ background: 'var(--parchment)' }}>
          <div className="max-w-2xl mx-auto px-5 text-center">
            <h2
              className="text-3xl font-bold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--oxford-navy)' }}
            >
              Start your child's learning journey today
            </h2>
            <p className="mb-8 text-lg" style={{ color: '#6b7280', fontFamily: 'var(--font-serif)' }}>
              Free to start. No credit card required. Works for OC, Selective, and HSC.
            </p>
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={() => router.push('/register')}
                style={{ background: 'var(--oxford-navy)', color: '#fff', fontFamily: 'var(--font-body)' }}>
                Create Free Account
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push('/login')}
                style={{ borderColor: 'var(--oxford-navy)', color: 'var(--oxford-navy)', fontFamily: 'var(--font-body)' }}>
                Sign In
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--oxford-navy)', borderTop: '1px solid rgba(184,134,11,0.3)' }}>
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <AcademicCrest size={22} />
            <span className="text-sm" style={{ color: 'rgba(232,237,244,0.6)', fontFamily: 'var(--font-body)' }}>
              EduLens · NSW Academic Excellence Platform
            </span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/news')}
              className="text-sm hover:opacity-100 transition-opacity"
              style={{ color: 'rgba(212,196,138,0.7)' }}
            >
              News
            </button>
            <span className="text-sm" style={{ color: 'rgba(232,237,244,0.35)' }}>
              &copy; {new Date().getFullYear()} EduLens
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="rounded-xl p-7 hover:shadow-md transition-shadow border"
      style={{ background: '#fff', borderColor: 'var(--parchment-mid)', borderTop: '3px solid var(--oxford-navy)' }}
    >
      <div className="mb-5">{icon}</div>
      <h3 className="text-xl font-semibold mb-2.5" style={{ fontFamily: 'var(--font-serif)', color: 'var(--oxford-navy)' }}>{title}</h3>
      <p className="text-base leading-relaxed" style={{ color: '#6b7280', fontFamily: 'var(--font-body)' }}>{description}</p>
    </div>
  );
}
