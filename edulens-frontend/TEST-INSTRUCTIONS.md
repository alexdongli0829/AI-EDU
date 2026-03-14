# Frontend Authentication Test Instructions

## ✅ Current Status
- Frontend: http://localhost:3000 ✅ Running
- Backend API: https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev ✅ Working
- Database: Auto-initialized ✅ Working

## 🧪 Test Flow

### Test 1: User Registration

1. **Go to**: http://localhost:3000/register
2. **Fill in the form**:
   - Email: `test123@example.com`
   - Password: `TestPass123`
   - Name: `Test User`
   - Role: `Student`
   - Grade Level: `8`
   - Date of Birth: `2010-01-01`
3. **Click**: Register/Sign Up button
4. **Expected**:
   - Success message appears
   - Redirected to login page
   - Check browser console (F12) - should see no errors

### Test 2: User Login

1. **Go to**: http://localhost:3000/login (should redirect automatically)
2. **Fill in**:
   - Email: `test123@example.com`
   - Password: `TestPass123`
3. **Click**: Login/Sign In button
4. **Expected**:
   - JWT token saved to localStorage
   - User data loaded
   - Redirected to `/student/dashboard`
   - See welcome message with your name

### Test 3: Verify Token Storage

**Open Browser DevTools** (Press F12 or Cmd+Option+I):

1. Go to **Application** tab
2. Click **Local Storage** → `http://localhost:3000`
3. **Check for**:
   - `auth_token` - Should have JWT token (starts with `eyJ...`)
   - `auth-storage` - Should have user and student data in JSON

### Test 4: Verify API Calls

**In Browser DevTools**:

1. Go to **Network** tab
2. Reload the page or try logging in again
3. **Look for**:
   - `POST` to `https://z5hb4iztaj.../dev/auth/register` - Status 201
   - `POST` to `https://z5hb4iztaj.../dev/auth/login` - Status 200
4. **Click on the login request** → **Response** tab
5. Should see JSON with `token`, `user`, and `student` fields

### Test 5: Protected Routes

1. **Try accessing**: http://localhost:3000/student/dashboard
2. **Expected**:
   - If logged in: Dashboard loads with your data
   - If not logged in: Redirected to `/login`

### Test 6: Logout and Re-login

1. Find the **Logout** button (usually in nav or header)
2. Click it
3. **Expected**: Token cleared, redirected to home/login
4. Try logging in again with same credentials
5. Should work and return to dashboard

## 🐛 Troubleshooting

### Issue: "Network Error" or "Failed to fetch"

**Check**:
```bash
# Make sure frontend is running
curl http://localhost:3000 -I

# Make sure backend is accessible
curl -X POST "https://z5hb4iztaj.execute-api.us-east-1.amazonaws.com/dev/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@edulens.com","password":"Test1234"}'
```

### Issue: "Invalid email or password"

- Make sure you registered first
- Check password meets requirements (min 8 chars, letter + number)
- Try using the test account: `test@edulens.com` / `Test1234`

### Issue: "CORS Error"

Check browser console. If you see CORS errors, the backend should allow requests from `http://localhost:3000`. Currently configured correctly.

### Issue: Redirected to login after successful login

Check browser console for errors. The auth middleware might be rejecting the token.

## 📊 What to Verify

After successful login, check that:

✅ **Browser Console** (F12):
- No JavaScript errors
- See log: "Login successful" or similar

✅ **Network Tab**:
- POST /auth/register → 201 Created
- POST /auth/login → 200 OK with token

✅ **Application Tab** → Local Storage:
- `auth_token` exists with JWT value
- `auth-storage` has user object

✅ **Dashboard Page**:
- Shows your name
- Shows your role (Student)
- Navigation menu visible
- No error messages

## 🎯 Success Criteria

✅ Registration creates account in database
✅ Login returns valid JWT token
✅ Token stored in localStorage
✅ User redirected to dashboard
✅ Protected routes work correctly
✅ User data displays correctly

## 📸 Screenshots to Take

If everything works, take screenshots of:
1. Registration success message
2. Login page
3. Student dashboard with your data
4. Browser DevTools showing token in localStorage
5. Network tab showing successful API calls

---

**Current Test User**:
- Email: `test@edulens.com`
- Password: `Test1234`
- Role: Student
- Grade: 8

You can use this to test login without registering a new account.
