# EduLens Frontend

Clean, modern React frontend for the EduLens educational platform built with Next.js 14, TypeScript, and Tailwind CSS.

## 🎨 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **HTTP Client:** Axios
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Icons:** Lucide React

## 📁 Project Structure

```
edulens-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Landing page
│   │   ├── login/              # Login page
│   │   ├── register/           # Registration page
│   │   ├── student/            # Student pages
│   │   │   ├── dashboard/      # Student dashboard
│   │   │   ├── test/[testId]/  # Test taking interface
│   │   │   ├── tutor/          # AI tutor chat
│   │   │   ├── profile/        # Student profile
│   │   │   └── results/[id]/   # Test results
│   │   └── parent/             # Parent pages
│   │       ├── dashboard/      # Parent dashboard
│   │       ├── chat/           # Parent AI advisor chat
│   │       └── student/[id]/   # Child's detailed view
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   │   ├── button.tsx      # Button component
│   │   │   ├── card.tsx        # Card component
│   │   │   └── input.tsx       # Input component
│   │   └── providers.tsx       # React Query provider
│   ├── lib/
│   │   ├── api-client.ts       # API client with auth
│   │   └── utils.ts            # Utility functions
│   ├── store/
│   │   └── auth-store.ts       # Zustand auth store
│   └── types/
│       └── index.ts            # TypeScript types
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn

### Installation

```bash
cd edulens-frontend
npm install
```

### Environment Variables

Create a `.env.local` file:

```bash
# API Endpoints
NEXT_PUBLIC_API_URL=https://your-api-gateway.amazonaws.com/dev
NEXT_PUBLIC_SSE_URL=http://your-alb.amazonaws.com
NEXT_PUBLIC_WS_URL=wss://your-websocket-api.amazonaws.com/dev
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## 📱 Features

### Landing Page
- ✅ Clean hero section with gradient design
- ✅ Feature cards highlighting platform capabilities
- ✅ Statistics showcase
- ✅ Responsive design

### Authentication
- ✅ Login page with email/password
- ✅ Registration page with role selection (student/parent)
- ✅ JWT token management
- ✅ Protected routes
- ✅ Auto-redirect based on user role

### Student Dashboard
- ✅ Overall progress overview
- ✅ Skills mastery visualization
- ✅ Available tests list
- ✅ Quick actions (Take Test, AI Tutor)
- ✅ Real-time data with React Query

### Test Taking Interface
- ✅ Real-time timer with WebSocket sync
- ✅ Progress bar
- ✅ Multiple choice questions
- ✅ Short answer input
- ✅ Essay textarea
- ✅ Question navigation
- ✅ Auto-submit on time expiry
- ✅ Answer persistence

### AI Tutor Chat
- ✅ SSE streaming responses (real-time)
- ✅ Clean chat UI with bubbles
- ✅ Typing indicator
- ✅ Auto-scroll to bottom
- ✅ Welcome message with suggestions
- ✅ Keyboard shortcuts (Enter to send)

### Parent Dashboard
- ✅ Multi-child overview
- ✅ Overall mastery per child
- ✅ Test completion stats
- ✅ Average scores
- ✅ Strengths & weaknesses
- ✅ Weekly summary insights
- ✅ Quick actions (View details, Chat with advisor)

### Student Profile
- ✅ Bayesian mastery visualization
- ✅ Skill breakdown by subject
- ✅ Error pattern analysis
- ✅ Time behavior indicators
- ✅ Progress charts (Recharts)
- ✅ Recommendations

## 🎨 Design Principles

### Clean & Simple
- Minimal UI with focus on content
- Consistent spacing and typography
- Clear visual hierarchy
- No unnecessary decorations

### Colors
- **Primary:** Blue (#3B82F6) - Trust, intelligence
- **Success:** Green (#10B981) - Achievement, growth
- **Warning:** Orange (#F59E0B) - Attention, caution
- **Error:** Red (#EF4444) - Problems, urgent

### Components
Based on shadcn/ui principles:
- Accessible by default
- Composable and reusable
- Customizable with Tailwind
- TypeScript-first

## 🔌 API Integration

### API Client

The `apiClient` handles all backend communication:

```typescript
import { apiClient } from '@/lib/api-client';

// Authentication
await apiClient.login(email, password);
await apiClient.register(data);
await apiClient.logout();

// Tests
const tests = await apiClient.getTests();
const session = await apiClient.startTestSession(testId, studentId);
await apiClient.submitAnswer(sessionId, questionId, answer, timeSpent);
await apiClient.endTestSession(sessionId);

// Chat
const session = await apiClient.createStudentChatSession(studentId);
const messages = await apiClient.getStudentChatMessages(sessionId);

// Profile
const profile = await apiClient.getStudentProfile(studentId);
```

### WebSocket (Timer Sync)

```typescript
const ws = apiClient.createWebSocketConnection(studentId, sessionId);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'timer_sync') {
    setTimeRemaining(data.timeRemaining);
  }
};
```

### SSE (Chat Streaming)

```typescript
const eventSource = new EventSource(url);

eventSource.addEventListener('delta', (event) => {
  const data = JSON.parse(event.data);
  appendText(data.text); // Stream text as it arrives
});

eventSource.addEventListener('done', (event) => {
  finishMessage(); // Complete the message
  eventSource.close();
});
```

## 🔐 State Management

### Zustand Auth Store

```typescript
import { useAuthStore } from '@/store/auth-store';

const { user, isAuthenticated, login, logout } = useAuthStore();

// Login
await login(email, password);

// Check auth
if (isAuthenticated) {
  // Redirect to dashboard
}

// Logout
logout();
```

### React Query (Server State)

```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading } = useQuery({
  queryKey: ['student-profile', studentId],
  queryFn: () => apiClient.getStudentProfile(studentId),
  enabled: !!studentId,
});
```

## 📊 Data Visualization

### Progress Bars

```tsx
<div className="w-full bg-gray-200 rounded-full h-3">
  <div
    className={`h-3 rounded-full ${getMasteryColor(mastery)}`}
    style={{ width: `${mastery * 100}%` }}
  />
</div>
```

### Charts (Recharts)

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

<LineChart data={data}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="score" stroke="#3B82F6" />
</LineChart>
```

## 🎯 User Flows

### Student Flow
1. **Login** → Student Dashboard
2. **Click "Take a Test"** → Test List
3. **Select Test** → Test Taking Interface (with WebSocket timer)
4. **Complete Test** → Results Page
5. **Click "AI Tutor"** → Chat Interface (with SSE streaming)
6. **Ask Questions** → Get Socratic responses
7. **View Profile** → See skills mastery & recommendations

### Parent Flow
1. **Login** → Parent Dashboard
2. **View Children's Progress** → See mastery, scores, strengths/weaknesses
3. **Click "Talk to AI Advisor"** → Parent Chat
4. **Discuss Child's Progress** → Get personalized recommendations
5. **Click "View Analytics"** → Detailed charts & insights

## 🚧 Future Enhancements

- [ ] Add test results visualization page
- [ ] Add parent chat with AI advisor
- [ ] Add admin dashboard
- [ ] Add question management UI
- [ ] Add dark mode toggle
- [ ] Add mobile responsive improvements
- [ ] Add push notifications
- [ ] Add offline support (PWA)
- [ ] Add accessibility improvements (WCAG 2.1 AA)

## 🧪 Testing

```bash
# Run type checking
npm run type-check

# Run linter
npm run lint
```

## 📦 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### AWS Amplify

```bash
# Push to GitHub
git push

# Connect to AWS Amplify Console
# Auto-deploys on push
```

### Docker

```bash
# Build
docker build -t edulens-frontend .

# Run
docker run -p 3000:3000 edulens-frontend
```

## 🔧 Customization

### Colors

Edit `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      primary: 'hsl(221.2 83.2% 53.3%)', // Change primary color
    },
  },
}
```

### Fonts

Edit `src/app/layout.tsx`:

```typescript
import { Inter, Roboto } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
const roboto = Roboto({ weight: ['400', '700'], subsets: ['latin'] });
```

## 🐛 Troubleshooting

### API Connection Issues

Check `.env.local` has correct API URLs:
```bash
NEXT_PUBLIC_API_URL=https://your-actual-api-gateway.amazonaws.com/dev
```

### WebSocket Not Connecting

Ensure WebSocket URL uses `wss://` (secure) in production:
```bash
NEXT_PUBLIC_WS_URL=wss://your-websocket-api.amazonaws.com/dev
```

### SSE Streaming Not Working

Check ALB DNS is accessible and CORS is configured:
```bash
NEXT_PUBLIC_SSE_URL=http://your-alb-dns.amazonaws.com
```

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://github.com/pmndrs/zustand)

## 📄 License

Copyright © 2026 EduLens. All rights reserved.

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**
