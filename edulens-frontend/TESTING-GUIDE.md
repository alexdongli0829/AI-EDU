# Frontend Testing Guide

## ✅ Setup Complete

- **Frontend URL**: http://localhost:3000
- **Backend API**: https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev
- **WebSocket**: wss://rdtva58ibf.execute-api.us-east-1.amazonaws.com/dev
- **Streaming (ALB)**: http://edulens-alb-dev-1133597433.us-east-1.elb.amazonaws.com

## 📱 Pages to Test

### 1. Landing Page
**URL**: http://localhost:3000

**What to check**:
- ✅ Page loads without errors
- ✅ Navigation links work
- ✅ Responsive design
- ✅ Login/Register buttons visible

### 2. Login Page
**URL**: http://localhost:3000/login

**What to check**:
- ✅ Form renders
- ✅ Email and password fields
- ✅ Submit button
- ⚠️ **Note**: Will fail because backend Lambda handlers are placeholders

**Expected behavior**:
- Form submits to API
- Will get error (backend not implemented yet)

### 3. Register Page
**URL**: http://localhost:3000/register

**What to check**:
- ✅ Form renders
- ✅ Name, email, password, role fields
- ✅ Role selector (Student/Parent)
- ⚠️ **Note**: Will fail (backend placeholder)

### 4. Student Dashboard
**URL**: http://localhost:3000/student/dashboard

**What to check**:
- ✅ Page structure loads
- ✅ Navigation
- ⚠️ Will redirect to login (auth not implemented)

### 5. Parent Dashboard
**URL**: http://localhost:3000/parent/dashboard

**What to check**:
- ✅ Page structure loads
- ✅ Multi-child support UI
- ⚠️ Will redirect to login (auth not implemented)

## 🔧 Current Limitations

### Backend is Not Implemented ❌

The Lambda functions are **placeholder handlers** that return:
```json
{ "statusCode": 200, "body": "{\"message\": \"Placeholder\"}" }
```

**What doesn't work yet**:
- ❌ Authentication (login/register)
- ❌ Database queries
- ❌ Test creation/taking
- ❌ AI tutor chat
- ❌ WebSocket connections
- ❌ Profile calculations

**What DOES work**:
- ✅ Frontend UI renders
- ✅ API calls are made (just get placeholder responses)
- ✅ Routing and navigation
- ✅ React components
- ✅ Form validation (client-side)
- ✅ Styling and layout

## 🧪 Test Cases

### Test 1: UI Rendering

```bash
# Open in browser
open http://localhost:3000
```

**Check**:
- Landing page loads
- No console errors
- Navigation works
- Responsive design (resize window)

### Test 2: API Connection

```bash
# Open browser console (F12)
# Try to login with any credentials

# You should see in Network tab:
# POST https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev/api/auth/login
# Response: {"message": "Placeholder"}
```

### Test 3: Error Handling

1. Go to login page
2. Submit empty form
3. **Check**: Client-side validation shows errors

### Test 4: Page Navigation

1. Navigate to different pages via menu
2. **Check**: All pages load without breaking

## 🐛 Expected Errors

### Console Warnings (Normal)

```
Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>
```
- This is a React warning, can be fixed later

### API Errors (Expected)

```
Error: Request failed with status code 404
```
- Backend endpoints not fully implemented
- Lambda returns placeholder responses

### Authentication Errors (Expected)

```
Unauthorized - redirecting to login
```
- Auth not implemented yet
- Normal behavior

## 🔍 Browser DevTools Testing

### Open DevTools (F12 or Cmd+Option+I)

**Console Tab**:
- Check for JavaScript errors
- Look for API calls

**Network Tab**:
- See all API requests
- Check request/response payloads
- Verify endpoints are correct

**Application Tab** → Local Storage:
- Check if auth tokens are stored (they won't be yet)

## 📊 What You Can Verify

### ✅ Infrastructure is Working

Even without backend implementation, you can verify:

1. **API Gateway is reachable**
   ```bash
   curl https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev/health
   # Will get 403 or placeholder response (means it's reachable)
   ```

2. **CORS is configured**
   - Frontend can make requests to backend
   - No CORS errors in console

3. **Frontend builds successfully**
   ```bash
   npm run build
   # Should complete without errors
   ```

4. **Environment variables loaded**
   ```bash
   # In browser console:
   console.log(process.env.NEXT_PUBLIC_API_URL)
   # Should show your API URL
   ```

## 🚀 Next Steps: Implement Backend

To make the app fully functional, you need to:

### 1. Implement Lambda Function Code

Replace placeholder handlers in:
```
edulens-backend/services/
├── test-engine/
│   └── dist/handlers/
│       ├── create-test.js
│       ├── start-test-session.js
│       └── ...
├── conversation-engine/
│   └── dist/handlers/
│       └── ...
└── ...
```

### 2. Update Database Connection

Lambda functions need to read `DB_SECRET_ARN` and connect to Aurora.

See: `edulens-infrastructure/docs/DATABASE-CONNECTION.md`

**Example**:
```typescript
// Get database URL from Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient();
const response = await client.send(
  new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
);
const creds = JSON.parse(response.SecretString);
const dbUrl = `postgresql://${creds.username}:${creds.password}@${creds.host}:${creds.port}/${creds.dbname}`;
```

### 3. Initialize Database Schema

```bash
# Connect to Aurora and run migrations
# Create tables: users, tests, questions, etc.
```

### 4. Implement Authentication

- JWT token generation
- Password hashing
- Session management

### 5. Implement Core Features

- Test engine (IRT algorithm)
- AI tutor (AWS Bedrock integration)
- Profile calculations
- Background jobs

### 6. Redeploy Backend

After implementing code:
```bash
cd edulens-infrastructure
./deploy.sh dev deploy
```

## 📸 Screenshots to Verify

Take screenshots of:
1. Landing page
2. Login page
3. Register page
4. Browser console (showing API calls)
5. Network tab (showing 200 responses)

## 🆘 Troubleshooting

### Frontend won't start

```bash
# Check port 3000 is available
lsof -ti:3000 | xargs kill -9

# Restart
npm run dev
```

### API calls failing

```bash
# Check .env.local
cat .env.local

# Verify API Gateway is deployed
aws cloudformation describe-stacks --stack-name EduLensApiGatewayStack-dev
```

### Page shows blank

```bash
# Check for errors
npm run dev

# Check browser console for errors
```

## 📚 Documentation

- **Frontend**: Next.js 14 with App Router
- **State Management**: Zustand
- **API Calls**: Axios with React Query
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui

## Summary

### What's Working ✅
- Frontend UI is complete
- Infrastructure is deployed
- API endpoints are accessible
- Frontend makes API calls

### What's Not Working ❌
- Backend Lambda implementations (placeholders only)
- Database not initialized
- Authentication not implemented
- AI features not implemented

### Next Action 🎯
**Implement backend Lambda function code** to make the app fully functional.

---

**Current Status**: Frontend testing successful, ready for backend implementation! 🎉
