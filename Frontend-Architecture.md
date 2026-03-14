# EduLens Frontend Architecture

**Version:** 1.0
**Last Updated:** March 2026
**Author:** Senior Frontend Architect

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Application Architecture](#4-application-architecture)
5. [Component Design System](#5-component-design-system)
6. [State Management](#6-state-management)
7. [API Integration](#7-api-integration)
8. [Real-Time Features](#8-real-time-features)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Routing & Navigation](#10-routing--navigation)
11. [Performance Optimization](#11-performance-optimization)
12. [Testing Strategy](#12-testing-strategy)
13. [Build & Deployment](#13-build--deployment)
14. [Development Workflow](#14-development-workflow)

---

## 1. Architecture Overview

### 1.1 Frontend Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js 14 App Router                       │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Pages Layer                                      │   │   │
│  │  │  • /login, /dashboard, /test, /chat, /profile   │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                         ↓                                 │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Layout & Template Layer                         │   │   │
│  │  │  • RootLayout, DashboardLayout, TestLayout      │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                         ↓                                 │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Feature Components Layer                        │   │   │
│  │  │  • TestSession, QuestionDisplay, ChatInterface  │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                         ↓                                 │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  UI Components Layer (shadcn/ui)                │   │   │
│  │  │  • Button, Card, Dialog, Input, Select          │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              State Management Layer                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │ React Context│  │   SWR Cache  │  │ Zustand     │  │   │
│  │  │ (Auth, User) │  │ (API Data)   │  │ (UI State)  │  │   │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Integration Layer                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │  REST Client │  │  WebSocket   │  │ SSE Client  │  │   │
│  │  │  (axios)     │  │  (Timer)     │  │ (AI Chat)   │  │   │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Services                            │
│  • API Gateway (REST)                                           │
│  • WebSocket Gateway (Timer Sync)                               │
│  • ALB + Lambda (SSE Streaming)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Type Safety First**: Comprehensive TypeScript coverage with strict mode
2. **Component Isolation**: Self-contained components with clear interfaces
3. **Server-First Rendering**: Leverage Next.js RSC for performance
4. **Progressive Enhancement**: Core functionality works without JavaScript
5. **Accessibility**: WCAG 2.1 AA compliance throughout
6. **Performance Budget**:
   - FCP < 1.5s
   - LCP < 2.5s
   - TTI < 3.5s
   - Bundle size < 200KB (gzipped)

---

## 2. Technology Stack

### 2.1 Core Framework

```json
{
  "framework": "Next.js 14.2+",
  "react": "React 18.2+",
  "typescript": "5.4+",
  "styling": "Tailwind CSS 3.4+",
  "ui-library": "shadcn/ui (Radix UI primitives)"
}
```

### 2.2 State Management

```json
{
  "server-state": "SWR 2.2+ (data fetching & caching)",
  "client-state": "Zustand 4.5+ (UI state)",
  "context": "React Context (auth, theme)"
}
```

### 2.3 API & Real-Time

```json
{
  "http-client": "axios 1.6+",
  "websocket": "native WebSocket API",
  "sse": "EventSource API with retry logic",
  "validation": "zod 3.22+"
}
```

### 2.4 Testing

```json
{
  "unit-testing": "Vitest 1.3+",
  "component-testing": "@testing-library/react 14+",
  "e2e-testing": "Playwright 1.41+",
  "visual-testing": "Chromatic (optional)"
}
```

### 2.5 Development Tools

```json
{
  "linting": "ESLint 8+ with Next.js config",
  "formatting": "Prettier 3+",
  "git-hooks": "husky + lint-staged",
  "package-manager": "pnpm 8+"
}
```

---

## 3. Project Structure

### 3.1 Repository Structure

```
edulens-frontend/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # PR checks (lint, test, build)
│       ├── deploy-staging.yml        # Deploy to staging
│       └── deploy-production.yml     # Deploy to production
│
├── public/
│   ├── images/
│   ├── fonts/
│   └── favicon.ico
│
├── src/
│   ├── app/                          # Next.js 14 App Router
│   │   ├── (auth)/                   # Route group: Authentication
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/              # Route group: Authenticated routes
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── test/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx          # Test details
│   │   │   │   │   └── session/
│   │   │   │   │       └── page.tsx      # Active test session
│   │   │   │   └── page.tsx              # Test list
│   │   │   ├── chat/
│   │   │   │   ├── parent/
│   │   │   │   │   ├── page.tsx          # Parent chat
│   │   │   │   │   └── [sessionId]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── student/
│   │   │   │       └── page.tsx          # Student chat
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── admin/                    # Admin routes
│   │   │   ├── questions/
│   │   │   │   └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── api/                      # API routes (if needed)
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   │
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing page
│   │   ├── error.tsx                 # Error boundary
│   │   ├── loading.tsx               # Global loading
│   │   └── not-found.tsx             # 404 page
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── features/                 # Feature-specific components
│   │   │   ├── test/
│   │   │   │   ├── TestCard.tsx
│   │   │   │   ├── QuestionDisplay.tsx
│   │   │   │   ├── AnswerInput.tsx
│   │   │   │   ├── TestTimer.tsx
│   │   │   │   └── TestResults.tsx
│   │   │   ├── chat/
│   │   │   │   ├── ChatInterface.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   ├── StreamingMessage.tsx
│   │   │   │   └── ChatHistory.tsx
│   │   │   ├── profile/
│   │   │   │   ├── LearningDNA.tsx
│   │   │   │   ├── ProfileChart.tsx
│   │   │   │   ├── RecommendationCard.tsx
│   │   │   │   └── ProgressTimeline.tsx
│   │   │   └── admin/
│   │   │       ├── QuestionEditor.tsx
│   │   │       ├── UserManagement.tsx
│   │   │       └── SystemMetrics.tsx
│   │   │
│   │   ├── layout/                   # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── PageContainer.tsx
│   │   │
│   │   └── common/                   # Shared components
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── ErrorMessage.tsx
│   │       ├── EmptyState.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   ├── lib/
│   │   ├── api/                      # API client layer
│   │   │   ├── client.ts             # Axios instance
│   │   │   ├── auth.ts               # Auth endpoints
│   │   │   ├── tests.ts              # Test endpoints
│   │   │   ├── chat.ts               # Chat endpoints
│   │   │   ├── profile.ts            # Profile endpoints
│   │   │   └── admin.ts              # Admin endpoints
│   │   │
│   │   ├── websocket/                # WebSocket client
│   │   │   ├── client.ts
│   │   │   ├── timer-sync.ts
│   │   │   └── reconnection.ts
│   │   │
│   │   ├── sse/                      # SSE client
│   │   │   ├── client.ts
│   │   │   └── chat-stream.ts
│   │   │
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useTestSession.ts
│   │   │   ├── useTimer.ts
│   │   │   ├── useChat.ts
│   │   │   ├── useProfile.ts
│   │   │   └── useWebSocket.ts
│   │   │
│   │   ├── stores/                   # Zustand stores
│   │   │   ├── uiStore.ts            # UI state (modals, toasts)
│   │   │   ├── testStore.ts          # Test session state
│   │   │   └── chatStore.ts          # Chat UI state
│   │   │
│   │   ├── utils/                    # Utility functions
│   │   │   ├── format.ts             # Date, number formatting
│   │   │   ├── validation.ts         # Form validation
│   │   │   ├── storage.ts            # LocalStorage wrapper
│   │   │   └── cn.ts                 # Tailwind class merger
│   │   │
│   │   └── constants/                # Constants
│   │       ├── routes.ts
│   │       ├── config.ts
│   │       └── errors.ts
│   │
│   ├── types/
│   │   ├── api.ts                    # API response types
│   │   ├── models.ts                 # Domain models
│   │   ├── ui.ts                     # UI-specific types
│   │   └── index.ts
│   │
│   ├── styles/
│   │   ├── globals.css               # Global styles + Tailwind
│   │   └── themes.css                # Theme variables
│   │
│   └── middleware.ts                 # Next.js middleware (auth)
│
├── tests/
│   ├── unit/                         # Unit tests
│   │   ├── components/
│   │   └── utils/
│   ├── integration/                  # Integration tests
│   │   └── api/
│   └── e2e/                          # E2E tests
│       ├── auth.spec.ts
│       ├── test-flow.spec.ts
│       └── chat.spec.ts
│
├── .env.local                        # Local environment
├── .env.staging                      # Staging environment
├── .env.production                   # Production environment
├── next.config.js                    # Next.js configuration
├── tailwind.config.js                # Tailwind configuration
├── tsconfig.json                     # TypeScript configuration
├── vitest.config.ts                  # Vitest configuration
├── playwright.config.ts              # Playwright configuration
├── .eslintrc.json                    # ESLint configuration
├── .prettierrc                       # Prettier configuration
└── package.json
```

---

## 4. Application Architecture

### 4.1 App Router Structure

Next.js 14 App Router with React Server Components (RSC):

```typescript
// src/app/layout.tsx
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { ThemeProvider } from '@/lib/contexts/ThemeContext';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'EduLens - Personalized Learning Platform',
  description: 'AI-powered personalized learning for students',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

```typescript
// src/app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 4.2 Route Groups & Organization

```
app/
├── (auth)/              # Public authentication routes
│   ├── login/
│   ├── signup/
│   └── layout.tsx       # Minimal layout (no nav)
│
├── (dashboard)/         # Protected user routes
│   ├── dashboard/
│   ├── test/
│   ├── chat/
│   ├── profile/
│   └── layout.tsx       # Full layout (header + sidebar)
│
└── admin/              # Protected admin routes
    └── layout.tsx      # Admin layout (different nav)
```

---

## 5. Component Design System

### 5.1 Component Hierarchy

```
UI Components (shadcn/ui)
    ↓
Common Components (shared utilities)
    ↓
Feature Components (domain-specific)
    ↓
Page Components (full views)
```

### 5.2 Component Template

```typescript
// src/components/features/test/QuestionDisplay.tsx
import { FC, memo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Question, Answer } from '@/types/models';

interface QuestionDisplayProps {
  question: Question;
  currentAnswer?: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export const QuestionDisplay: FC<QuestionDisplayProps> = memo(({
  question,
  currentAnswer,
  onAnswerChange,
  onSubmit,
  isSubmitting = false,
  className,
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <h2 className="text-2xl font-semibold">
          Question {question.order}
        </h2>
        <p className="text-sm text-muted-foreground">
          {question.subject} • {question.difficulty}
        </p>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {/* Question Text */}
          <div className="prose max-w-none">
            <p className="text-lg">{question.text}</p>
          </div>

          {/* Answer Input */}
          {question.type === 'multiple_choice' ? (
            <div className="space-y-2">
              {question.options.map((option) => (
                <Button
                  key={option.id}
                  variant={currentAnswer === option.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => onAnswerChange(option.id)}
                  disabled={isSubmitting}
                >
                  {option.text}
                </Button>
              ))}
            </div>
          ) : (
            <textarea
              className="w-full min-h-[200px] p-4 border rounded-md"
              value={currentAnswer || ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Enter your answer here..."
              disabled={isSubmitting}
            />
          )}

          {/* Submit Button */}
          <Button
            onClick={onSubmit}
            disabled={!currentAnswer || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Answer'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

QuestionDisplay.displayName = 'QuestionDisplay';
```

### 5.3 shadcn/ui Integration

Install and configure shadcn/ui:

```bash
pnpm dlx shadcn-ui@latest init
```

```typescript
// components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

Key components to install:
```bash
pnpm dlx shadcn-ui@latest add button card dialog input select toast tabs badge avatar dropdown-menu
```

---

## 6. State Management

### 6.1 State Management Strategy

```
┌────────────────────────────────────────────────────────┐
│                    State Layers                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│  React Context (Global, Rarely Changes)                │
│  • Authentication state                                 │
│  • User profile                                         │
│  • Theme preferences                                    │
│                                                         │
│  ──────────────────────────────────────────────────   │
│                                                         │
│  SWR (Server State, API Data)                          │
│  • Test sessions                                        │
│  • Questions                                            │
│  • Chat history                                         │
│  • Profile data                                         │
│  • Automatic caching, revalidation, deduplication      │
│                                                         │
│  ──────────────────────────────────────────────────   │
│                                                         │
│  Zustand (Client UI State)                             │
│  • Modal open/close                                     │
│  • Toast notifications                                  │
│  • Test session local state (unsaved answers)          │
│  • Chat UI state (typing indicator, scroll position)   │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 6.2 Auth Context (React Context)

```typescript
// src/lib/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User, AuthTokens } from '@/types/models';
import { authApi } from '@/lib/api/auth';
import { storage } from '@/lib/utils/storage';

interface AuthContextValue {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      const storedTokens = storage.getTokens();
      if (storedTokens) {
        try {
          const userData = await authApi.verifyToken(storedTokens.accessToken);
          setUser(userData);
          setTokens(storedTokens);
        } catch (error) {
          storage.clearTokens();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setUser(response.user);
    setTokens(response.tokens);
    storage.setTokens(response.tokens);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      if (tokens) {
        await authApi.logout(tokens.refreshToken);
      }
    } finally {
      setUser(null);
      setTokens(null);
      storage.clearTokens();
      router.push('/login');
    }
  };

  const refreshToken = async () => {
    if (!tokens?.refreshToken) throw new Error('No refresh token');
    const newTokens = await authApi.refresh(tokens.refreshToken);
    setTokens(newTokens);
    storage.setTokens(newTokens);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 6.3 SWR for Server State

```typescript
// src/lib/hooks/useTestSession.ts
import useSWR from 'swr';
import { testsApi } from '@/lib/api/tests';
import type { TestSession } from '@/types/models';

export function useTestSession(sessionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TestSession>(
    sessionId ? `/tests/sessions/${sessionId}` : null,
    () => testsApi.getSession(sessionId!),
    {
      refreshInterval: 0, // Don't auto-refresh
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    session: data,
    isLoading,
    isError: !!error,
    error,
    mutate, // Manual revalidation
  };
}

// Usage in component
function TestSessionPage({ params }: { params: { id: string } }) {
  const { session, isLoading, isError } = useTestSession(params.id);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage />;
  if (!session) return <NotFound />;

  return <TestInterface session={session} />;
}
```

### 6.4 Zustand for UI State

```typescript
// src/lib/stores/testStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Answer {
  questionId: string;
  answer: string;
  timestamp: number;
}

interface TestState {
  // State
  currentQuestionIndex: number;
  answers: Record<string, Answer>;
  isSubmitting: boolean;

  // Actions
  setCurrentQuestion: (index: number) => void;
  saveAnswer: (questionId: string, answer: string) => void;
  clearAnswers: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
}

export const useTestStore = create<TestState>()(
  devtools(
    (set) => ({
      currentQuestionIndex: 0,
      answers: {},
      isSubmitting: false,

      setCurrentQuestion: (index) =>
        set({ currentQuestionIndex: index }),

      saveAnswer: (questionId, answer) =>
        set((state) => ({
          answers: {
            ...state.answers,
            [questionId]: {
              questionId,
              answer,
              timestamp: Date.now(),
            },
          },
        })),

      clearAnswers: () =>
        set({ answers: {}, currentQuestionIndex: 0 }),

      setSubmitting: (isSubmitting) =>
        set({ isSubmitting }),
    }),
    { name: 'test-store' }
  )
);
```

---

## 7. API Integration

### 7.1 Axios Client Configuration

```typescript
// src/lib/api/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '@/lib/utils/storage';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tokens = storage.getTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Token expired, try refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokens = storage.getTokens();
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token');
        }

        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refresh_token: tokens.refreshToken }
        );

        storage.setTokens(data.tokens);
        originalRequest.headers.Authorization = `Bearer ${data.tokens.access_token}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        storage.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### 7.2 API Service Layer

```typescript
// src/lib/api/tests.ts
import { apiClient } from './client';
import type { Test, TestSession, SessionResponse } from '@/types/models';

export const testsApi = {
  // Get available tests
  async getTests(): Promise<Test[]> {
    const { data } = await apiClient.get('/tests');
    return data.tests;
  },

  // Create test session
  async createSession(testId: string): Promise<TestSession> {
    const { data } = await apiClient.post('/tests/sessions', {
      test_id: testId,
    });
    return data.session;
  },

  // Get session details
  async getSession(sessionId: string): Promise<TestSession> {
    const { data } = await apiClient.get(`/tests/sessions/${sessionId}`);
    return data.session;
  },

  // Submit answer
  async submitAnswer(
    sessionId: string,
    questionId: string,
    answer: string
  ): Promise<SessionResponse> {
    const { data } = await apiClient.post(
      `/tests/sessions/${sessionId}/responses`,
      {
        question_id: questionId,
        student_answer: answer,
      }
    );
    return data.response;
  },

  // Complete session
  async completeSession(sessionId: string): Promise<{ score: number }> {
    const { data } = await apiClient.post(
      `/tests/sessions/${sessionId}/complete`
    );
    return data;
  },
};
```

```typescript
// src/lib/api/chat.ts
import { apiClient } from './client';
import type { ChatSession, ChatMessage } from '@/types/models';

export const chatApi = {
  // Create chat session
  async createSession(
    studentId: string,
    role: 'parent' | 'student'
  ): Promise<ChatSession> {
    const { data } = await apiClient.post('/chat/sessions', {
      student_id: studentId,
      role,
    });
    return data.session;
  },

  // Get session history
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const { data } = await apiClient.get(`/chat/sessions/${sessionId}/messages`);
    return data.messages;
  },

  // Send message (returns immediately, SSE for streaming)
  async sendMessage(
    sessionId: string,
    content: string
  ): Promise<{ message_id: string }> {
    const { data } = await apiClient.post(
      `/chat/sessions/${sessionId}/messages`,
      { content }
    );
    return data;
  },
};
```

---

## 8. Real-Time Features

### 8.1 WebSocket Client (Timer Sync)

```typescript
// src/lib/websocket/client.ts
import { EventEmitter } from 'events';

interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code);
        this.emit('disconnected', event.code);
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[WebSocket] Reconnecting... (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Not connected, cannot send message');
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

```typescript
// src/lib/hooks/useTimer.ts
import { useEffect, useState } from 'react';
import { WebSocketClient } from '@/lib/websocket/client';
import { useAuth } from '@/lib/contexts/AuthContext';

interface TimerState {
  remainingTime: number;
  isWarning: boolean;
  isExpired: boolean;
}

export function useTimer(sessionId: string | null) {
  const { tokens } = useAuth();
  const [timer, setTimer] = useState<TimerState>({
    remainingTime: 0,
    isWarning: false,
    isExpired: false,
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !tokens) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/timer/${sessionId}?token=${tokens.accessToken}`;
    const ws = new WebSocketClient({ url: wsUrl });

    ws.on('connected', () => {
      console.log('[Timer] Connected');
      setIsConnected(true);
    });

    ws.on('disconnected', () => {
      console.log('[Timer] Disconnected');
      setIsConnected(false);
    });

    ws.on('message', (data) => {
      if (data.type === 'timer_update') {
        setTimer({
          remainingTime: data.remaining_time,
          isWarning: data.remaining_time <= 300, // 5 minutes warning
          isExpired: data.remaining_time <= 0,
        });
      }
    });

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [sessionId, tokens]);

  return { ...timer, isConnected };
}
```

### 8.2 SSE Client (AI Chat Streaming)

```typescript
// src/lib/sse/chat-stream.ts
import { EventSourcePolyfill } from 'event-source-polyfill';

interface StreamOptions {
  onDelta: (text: string) => void;
  onComplete: (messageId: string) => void;
  onError: (error: Error) => void;
}

export class ChatStreamClient {
  private eventSource: EventSourcePolyfill | null = null;

  async streamMessage(
    sessionId: string,
    content: string,
    accessToken: string,
    options: StreamOptions
  ): Promise<void> {
    const url = new URL(
      `/chat/sessions/${sessionId}/messages`,
      process.env.NEXT_PUBLIC_API_URL
    );

    try {
      this.eventSource = new EventSourcePolyfill(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ content }),
      } as any);

      this.eventSource.addEventListener('delta', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          options.onDelta(data.text);
        } catch (error) {
          console.error('[SSE] Parse error:', error);
        }
      });

      this.eventSource.addEventListener('done', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          options.onComplete(data.message_id);
        } catch (error) {
          console.error('[SSE] Parse error:', error);
        } finally {
          this.close();
        }
      });

      this.eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error);
        options.onError(new Error('Stream error'));
        this.close();
      };
    } catch (error) {
      options.onError(error as Error);
    }
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
```

```typescript
// src/lib/hooks/useChat.ts
import { useState, useCallback } from 'react';
import { ChatStreamClient } from '@/lib/sse/chat-stream';
import { useAuth } from '@/lib/contexts/AuthContext';
import { chatApi } from '@/lib/api/chat';
import type { ChatMessage } from '@/types/models';

export function useChat(sessionId: string) {
  const { tokens } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');

  const sendMessage = useCallback(
    async (content: string) => {
      if (!tokens) return;

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Start streaming
      setIsStreaming(true);
      setStreamingMessage('');

      const streamClient = new ChatStreamClient();

      await streamClient.streamMessage(
        sessionId,
        content,
        tokens.accessToken,
        {
          onDelta: (text) => {
            setStreamingMessage((prev) => prev + text);
          },
          onComplete: (messageId) => {
            // Replace streaming message with final message
            const assistantMessage: ChatMessage = {
              id: messageId,
              role: 'assistant',
              content: streamingMessage,
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setStreamingMessage('');
            setIsStreaming(false);
          },
          onError: (error) => {
            console.error('[Chat] Stream error:', error);
            setIsStreaming(false);
            setStreamingMessage('');
          },
        }
      );

      return () => {
        streamClient.close();
      };
    },
    [sessionId, tokens, streamingMessage]
  );

  return {
    messages,
    streamingMessage,
    isStreaming,
    sendMessage,
  };
}
```

---

## 9. Authentication & Authorization

### 9.1 Middleware for Route Protection

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_ROUTES = ['/login', '/signup', '/'];
const ADMIN_ROUTES = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes - allow access
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('access_token')?.value;

  // No token - redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verify token
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Admin route check
    if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // Add user info to headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.sub as string);
    requestHeaders.set('x-user-role', payload.role as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    // Invalid token - redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 9.2 Role-Based Access Control

```typescript
// src/lib/utils/rbac.ts
export enum Role {
  ADMIN = 'admin',
  PARENT = 'parent',
  STUDENT = 'student',
}

export enum Permission {
  VIEW_TESTS = 'view:tests',
  TAKE_TEST = 'take:test',
  VIEW_PROFILE = 'view:profile',
  CHAT_AS_PARENT = 'chat:parent',
  CHAT_AS_STUDENT = 'chat:student',
  MANAGE_QUESTIONS = 'manage:questions',
  VIEW_ALL_USERS = 'view:all_users',
}

const rolePermissions: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.VIEW_TESTS,
    Permission.VIEW_PROFILE,
    Permission.MANAGE_QUESTIONS,
    Permission.VIEW_ALL_USERS,
  ],
  [Role.PARENT]: [
    Permission.VIEW_TESTS,
    Permission.VIEW_PROFILE,
    Permission.CHAT_AS_PARENT,
  ],
  [Role.STUDENT]: [
    Permission.VIEW_TESTS,
    Permission.TAKE_TEST,
    Permission.VIEW_PROFILE,
    Permission.CHAT_AS_STUDENT,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}
```

```typescript
// src/components/common/ProtectedRoute.tsx
'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { hasPermission, Permission } from '@/lib/utils/rbac';
import { redirect } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission: Permission;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  permission,
  fallback = null,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    redirect('/login');
  }

  if (!hasPermission(user.role, permission)) {
    return <>{fallback || <div>Access Denied</div>}</>;
  }

  return <>{children}</>;
}
```

---

## 10. Routing & Navigation

### 10.1 Route Configuration

```typescript
// src/lib/constants/routes.ts
export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',

  // Dashboard
  DASHBOARD: '/dashboard',

  // Tests
  TESTS: '/test',
  TEST_DETAIL: (id: string) => `/test/${id}`,
  TEST_SESSION: (id: string) => `/test/${id}/session`,

  // Chat
  PARENT_CHAT: '/chat/parent',
  PARENT_CHAT_SESSION: (sessionId: string) => `/chat/parent/${sessionId}`,
  STUDENT_CHAT: '/chat/student',

  // Profile
  PROFILE: '/profile',

  // Admin
  ADMIN_QUESTIONS: '/admin/questions',
  ADMIN_USERS: '/admin/users',
} as const;
```

### 10.2 Navigation Component

```typescript
// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/lib/contexts/AuthContext';
import { hasPermission, Permission } from '@/lib/utils/rbac';
import {
  HomeIcon,
  BookOpenIcon,
  ChatBubbleIcon,
  UserIcon,
} from '@/components/icons';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const navItems: NavItem[] = [
  {
    href: ROUTES.DASHBOARD,
    label: 'Dashboard',
    icon: HomeIcon,
  },
  {
    href: ROUTES.TESTS,
    label: 'Tests',
    icon: BookOpenIcon,
    permission: Permission.VIEW_TESTS,
  },
  {
    href: ROUTES.PARENT_CHAT,
    label: 'Chat',
    icon: ChatBubbleIcon,
    permission: Permission.CHAT_AS_PARENT,
  },
  {
    href: ROUTES.PROFILE,
    label: 'Profile',
    icon: UserIcon,
    permission: Permission.VIEW_PROFILE,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredItems = navItems.filter((item) =>
    item.permission ? hasPermission(user!.role, item.permission) : true
  );

  return (
    <aside className="w-64 border-r bg-card">
      <nav className="p-4 space-y-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

## 11. Performance Optimization

### 11.1 Code Splitting & Lazy Loading

```typescript
// src/app/(dashboard)/test/[id]/session/page.tsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// Lazy load heavy components
const TestInterface = dynamic(
  () => import('@/components/features/test/TestInterface'),
  {
    loading: () => <LoadingSpinner />,
    ssr: false, // Disable SSR for client-only components
  }
);

const QuestionDisplay = dynamic(
  () => import('@/components/features/test/QuestionDisplay').then(
    (mod) => ({ default: mod.QuestionDisplay })
  )
);

export default function TestSessionPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TestInterface sessionId={params.id} />
    </Suspense>
  );
}
```

### 11.2 Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image';

export function ProfileAvatar({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={80}
      height={80}
      className="rounded-full"
      priority={false} // Lazy load by default
      placeholder="blur" // Show blur placeholder
      blurDataURL="data:image/png;base64,..." // Low-quality placeholder
    />
  );
}
```

### 11.3 Bundle Analysis

```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... other config
});
```

Run analysis:
```bash
ANALYZE=true pnpm build
```

---

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest)

```typescript
// tests/unit/utils/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatDuration, formatScore } from '@/lib/utils/format';

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(120)).toBe('2:00');
    expect(formatDuration(3665)).toBe('1:01:05');
  });
});

describe('formatScore', () => {
  it('formats score as percentage', () => {
    expect(formatScore(85)).toBe('85%');
    expect(formatScore(100)).toBe('100%');
  });
});
```

### 12.2 Component Tests (React Testing Library)

```typescript
// tests/unit/components/QuestionDisplay.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuestionDisplay } from '@/components/features/test/QuestionDisplay';

describe('QuestionDisplay', () => {
  const mockQuestion = {
    id: '1',
    order: 1,
    subject: 'Math',
    difficulty: 'medium',
    text: 'What is 2 + 2?',
    type: 'multiple_choice',
    options: [
      { id: 'a', text: '3' },
      { id: 'b', text: '4' },
      { id: 'c', text: '5' },
    ],
  };

  it('renders question text', () => {
    render(
      <QuestionDisplay
        question={mockQuestion}
        onAnswerChange={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
  });

  it('calls onAnswerChange when option is selected', () => {
    const handleAnswerChange = vi.fn();
    render(
      <QuestionDisplay
        question={mockQuestion}
        onAnswerChange={handleAnswerChange}
        onSubmit={() => {}}
      />
    );

    fireEvent.click(screen.getByText('4'));
    expect(handleAnswerChange).toHaveBeenCalledWith('b');
  });

  it('disables submit button when no answer selected', () => {
    render(
      <QuestionDisplay
        question={mockQuestion}
        onAnswerChange={() => {}}
        onSubmit={() => {}}
      />
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });
});
```

### 12.3 E2E Tests (Playwright)

```typescript
// tests/e2e/test-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Test Taking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'student@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should complete a test session', async ({ page }) => {
    // Navigate to tests
    await page.click('a[href="/test"]');
    await expect(page).toHaveURL('/test');

    // Select a test
    await page.click('text=Math Diagnostic Test');
    await expect(page).toHaveURL(/\/test\/[^/]+$/);

    // Start test
    await page.click('text=Start Test');
    await expect(page).toHaveURL(/\/test\/[^/]+\/session$/);

    // Answer first question
    await page.click('button:has-text("Option A")');
    await page.click('text=Submit Answer');

    // Verify question progressed
    await expect(page.locator('text=Question 2')).toBeVisible();

    // Complete test (mock remaining questions)
    // ...

    // Verify results page
    await expect(page).toHaveURL(/\/test\/[^/]+\/results$/);
    await expect(page.locator('text=Test Complete')).toBeVisible();
  });

  test('should respect timer countdown', async ({ page }) => {
    // Start test
    await page.goto('/test/123/session');

    // Verify timer is displayed
    const timer = page.locator('[data-testid="timer"]');
    await expect(timer).toBeVisible();

    // Verify timer updates
    const initialTime = await timer.textContent();
    await page.waitForTimeout(2000);
    const updatedTime = await timer.textContent();
    expect(initialTime).not.toBe(updatedTime);
  });
});
```

### 12.4 Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 13. Build & Deployment

### 13.1 Next.js Configuration

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Output standalone for Docker
  output: 'standalone',

  // Image domains
  images: {
    domains: ['edulens-assets.s3.amazonaws.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },

  // Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
        has: [
          {
            type: 'cookie',
            key: 'access_token',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

### 13.2 Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build
ENV NEXT_TELEMETRY_DISABLED 1
RUN corepack enable pnpm && pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000
      - NEXT_PUBLIC_WS_URL=ws://localhost:4001
    depends_on:
      - backend
```

### 13.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        run: corepack enable pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm type-check

      - name: Unit tests
        run: pnpm test:unit

      - name: Build
        run: pnpm build

      - name: E2E tests
        run: pnpm test:e2e
        env:
          NEXT_PUBLIC_API_URL: http://localhost:4000
```

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: corepack enable pnpm && pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_API_URL: https://api.edulens.com
          NEXT_PUBLIC_WS_URL: wss://ws.edulens.com

      - name: Deploy to S3
        run: aws s3 sync ./out s3://edulens-frontend-prod --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### 13.4 AWS Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Route 53                          │
│              (edulens.com DNS)                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│              CloudFront CDN                         │
│  • Global edge locations                            │
│  • SSL/TLS termination                              │
│  • DDoS protection                                  │
│  • Caching static assets                            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│               S3 Bucket                             │
│         (Static site hosting)                       │
│  • HTML, CSS, JS, images                            │
│  • Next.js static export                            │
│  • Versioned for rollback                           │
└─────────────────────────────────────────────────────┘
```

**Alternative: Vercel/Amplify Deployment**

For simpler deployment:
```bash
# Vercel
pnpm i -g vercel
vercel --prod

# AWS Amplify
amplify init
amplify add hosting
amplify publish
```

---

## 14. Development Workflow

### 14.1 Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/edulens-frontend.git
cd edulens-frontend

# 2. Install dependencies
corepack enable pnpm
pnpm install

# 3. Setup environment
cp .env.example .env.local
# Edit .env.local with your settings

# 4. Start development server
pnpm dev

# Frontend runs on http://localhost:3000
```

### 14.2 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4001
NEXT_PUBLIC_ENV=development
JWT_SECRET=your-jwt-secret-here
```

### 14.3 NPM Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\"",
    "test": "vitest",
    "test:unit": "vitest run",
    "test:watch": "vitest watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "prepare": "husky install"
  }
}
```

### 14.4 Git Workflow

```bash
# Feature development
git checkout -b feature/chat-ui
# ... make changes
git add .
git commit -m "feat: add chat streaming UI"
git push origin feature/chat-ui
# Create PR on GitHub

# Commit message convention (Conventional Commits)
# feat: new feature
# fix: bug fix
# docs: documentation
# style: formatting
# refactor: code restructure
# test: adding tests
# chore: maintenance
```

### 14.5 Code Quality Tools

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

```json
// .lintstagedrc
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

---

## Summary

This frontend architecture provides:

✅ **Modern Stack**: Next.js 14 App Router, React 18, TypeScript, Tailwind
✅ **Type Safety**: Comprehensive TypeScript coverage
✅ **State Management**: SWR (server state) + Zustand (UI state) + Context (global)
✅ **Real-Time**: WebSocket (timer) + SSE (AI streaming)
✅ **Component Library**: shadcn/ui for consistent design
✅ **Testing**: Unit (Vitest) + Component (RTL) + E2E (Playwright)
✅ **Performance**: Code splitting, image optimization, bundle analysis
✅ **Security**: JWT auth, middleware, RBAC
✅ **DevOps**: Docker, GitHub Actions, AWS deployment

**Next Steps:**
1. Review and approve architecture
2. Set up project repository
3. Configure development environment
4. Start implementation (Phase 1: Authentication & Core UI)
5. Iterate with user feedback

---

**Document Version:** 1.0
**Last Updated:** March 2026