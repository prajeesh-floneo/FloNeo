# Complete RoleIs Block Testing Guide - App Owner Perspective

## Overview

This guide explains how to test the RoleIs block workflow from an **app owner's perspective**, including creating credentials, managing users, and verifying access control.

---

## Table of Contents

1. [Understanding the App Owner Workflow](#understanding-the-app-owner-workflow)
2. [Setting Up Your App](#setting-up-your-app)
3. [Creating App Users via RoleIs](#creating-app-users-via-roleis)
4. [Testing User Management](#testing-user-management)
5. [Verifying Access Control](#verifying-access-control)
6. [Complete Testing Scenarios](#complete-testing-scenarios)
7. [Troubleshooting](#troubleshooting)

---

## Understanding the App Owner Workflow

### As an App Owner, You Can:

1. **Create App Users** - Via RoleIs block in workflows
2. **Manage Users** - Via App Users UI screen
3. **Assign Roles** - Define roles and assign to users
4. **Grant Page Access** - Control which pages users can access
5. **Test User Login** - Verify users can log in with credentials

### Key Concepts:

- **Platform User** - You (the app owner) - logged into FloNeo platform
- **App User** - End users of your app - created via RoleIs or manually
- **App Role** - Roles defined for your app (e.g., admin, staff, user)
- **Page Access** - Specific pages an app user can access

---

## Setting Up Your App

### Step 1: Create an App

1. Login to FloNeo platform
2. Go to Dashboard
3. Click "Create New App"
4. Fill in app details:
   - Name: "My Loan App"
   - Description: "Loan application system"
   - Template: Choose a template or start blank

### Step 2: Navigate to Canvas

1. Click on your app
2. Go to "Canvas" tab
3. You'll see the canvas editor

### Step 3: Create Pages (Optional but Recommended)

**Why?** To test page access control later.

1. Go to Database screen
2. Click "App Users" button
3. Note: Pages are created automatically when you create pages in your app
4. Or create via API: `POST /api/pages/:appId/create`

**Example Pages:**
- Dashboard (`/dashboard`)
- Applications (`/applications`)
- Reports (`/reports`)
- Settings (`/settings`)

---

## Creating App Users via RoleIs

### Scenario 1: Form Submission Workflow

**Goal:** Create a user when someone submits a loan application form.

#### Step 1: Create Form Elements

1. In Canvas, add form elements:
   - Email input (elementId: `email`)
   - Password input (elementId: `password`)
   - Full Name input (elementId: `fullName`)
   - Loan Amount input (elementId: `loanAmount`)

2. Set `formGroupId` on all inputs (e.g., `loanForm`)

#### Step 2: Create Workflow

**Workflow Structure:**
```
Form Submit → RoleIs → db.create → notify.toast
```

#### Step 3: Configure RoleIs Block

**Open RoleIs Block Configuration:**

1. **User Creation Section:**
   ```
   Username/Email: {{formData.email}}
   Password: {{formData.password}}
   Role for New User: user
   ```

2. **Role Check Section:**
   ```
   Required Role to Check: user
   Allow multiple roles: (unchecked)
   Required Pages: (leave empty or specify)
   ```

#### Step 4: Configure db.create Block

**Settings:**
```
Table Name: loan_applications
Data Source: formData
```

**The block will automatically:**
- Use `context.appUser.id` if available
- Link records to created user

#### Step 5: Test the Workflow

1. Fill the form:
   ```
   Email: applicant1@example.com
   Password: password123
   Full Name: John Doe
   Loan Amount: 50000
   ```

2. Submit the form

3. **Expected Result:**
   - User created in AppUser table
   - Role "user" assigned
   - Loan application record created
   - Success toast shown

4. **Verify in App Users Screen:**
   - Go to Database screen
   - Click "App Users" button
   - You should see `applicant1@example.com` listed
   - Role badge shows "User"
   - User appears **automatically** (real-time update)

---

### Scenario 2: Button Click Workflow

**Goal:** Create a test user when clicking a button.

#### Step 1: Create Button

1. Add a button to canvas
2. Set `onClick` trigger

#### Step 2: Create Workflow

**Workflow Structure:**
```
Button Click → RoleIs → notify.toast
```

#### Step 3: Configure RoleIs Block

**Use Static Values:**
```
Username/Email: test@example.com
Password: test123
Role for New User: user
```

#### Step 4: Test

1. Click the button
2. **Expected Result:**
   - User created
   - Toast notification
   - User appears in App Users screen automatically

---

## Testing User Management

### Test 1: View All Users

1. **Navigate to App Users:**
   - Database screen → "App Users" button
   - Or: `/app-users?appId=1&appName=My%20Loan%20App`

2. **Expected UI:**
   - List of all app users
   - Columns: Email, Name, Role, Page Access, Status, Created, Actions

3. **Verify:**
   - Users created via RoleIs appear here
   - Real-time updates work (no refresh needed)

### Test 2: Edit User

1. **Click Edit Icon** (pencil) on a user
2. **Edit Modal Opens:**
   - Email field (editable)
   - Name field (editable)
   - Role dropdown (editable)
   - Active checkbox (editable)

3. **Make Changes:**
   ```
   Email: applicant1@example.com (keep same)
   Name: John Doe Updated
   Role: staff
   Active: ✓ (checked)
   ```

4. **Click "Save Changes"**

5. **Expected Result:**
   - User updated in database
   - UI updates automatically (real-time)
   - Toast notification shown
   - Role badge updates to "Staff"

### Test 3: Edit Page Access

1. **Click Shield Icon** on a user
2. **Page Access Modal Opens:**
   - List of all available pages
   - Checkboxes for each page
   - Currently selected pages are checked

3. **Select Pages:**
   - ✓ Dashboard
   - ✓ Applications
   - ✗ Reports (unchecked)
   - ✗ Settings (unchecked)

4. **Click "Save Access"**

5. **Expected Result:**
   - Page access updated
   - UI updates automatically
   - User's page access badges update
   - Toast notification shown

### Test 4: Reset Password

1. **Click Key Icon** on a user
2. **Reset Password Modal Opens:**
   - New password input field
   - Show/hide password toggle

3. **Enter New Password:**
   ```
   New Password: newpassword123
   ```

4. **Click "Reset Password"**

5. **Expected Result:**
   - Password updated in database (hashed)
   - Modal closes
   - Toast notification shown
   - User can now login with new password

### Test 5: Delete User

1. **Click Trash Icon** on a user
2. **Delete Confirmation Modal Opens:**
   - Warning message
   - Cancel and Delete buttons

3. **Click "Delete User"**

4. **Expected Result:**
   - User deleted from database
   - User removed from UI automatically (real-time)
   - All associated roles and page access deleted
   - Toast notification shown

---

## Verifying Access Control

### Test 1: User Login

**Goal:** Verify created users can log in.

#### Step 1: Get User Credentials

From App Users screen, note:
- Email: `applicant1@example.com`
- Password: (the one set in RoleIs or reset)

#### Step 2: Test Login via API

**Request:**
```http
POST http://localhost:5000/api/app-users/1/login
Content-Type: application/json

{
  "email": "applicant1@example.com",
  "password": "password123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "applicant1@example.com",
    "name": "John Doe",
    "roles": ["user"],
    "accessiblePages": ["dashboard", "applications"]
  }
}
```

#### Step 3: Verify Token

**Use token in subsequent requests:**
```http
GET http://localhost:5000/api/app-users/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "applicant1@example.com",
    "name": "John Doe",
    "isActive": true,
    "roles": [
      {
        "appRole": {
          "id": 1,
          "name": "User",
          "slug": "user"
        }
      }
    ],
    "pageAccess": [
      {
        "page": {
          "id": 1,
          "slug": "dashboard",
          "title": "Dashboard"
        }
      }
    ]
  }
}
```

### Test 2: Role-Based Access

**Goal:** Verify users can only access pages they're granted.

#### Step 1: Create Multiple Users with Different Access

**User 1 (Admin):**
- Role: `admin`
- Pages: All pages

**User 2 (Staff):**
- Role: `staff`
- Pages: Dashboard, Applications

**User 3 (User):**
- Role: `user`
- Pages: Dashboard only

#### Step 2: Test Each User's Access

**Login as User 3:**
```http
POST /api/app-users/1/login
{
  "email": "user3@example.com",
  "password": "password123"
}
```

**Response should show:**
```json
{
  "accessiblePages": ["dashboard"]
}
```

**Verify:** User 3 can only access dashboard page.

---

## Complete Testing Scenarios

### Scenario A: Complete User Registration Flow

**Steps:**
1. User fills loan application form
2. Form submits → RoleIs creates user account
3. db.create saves application data
4. User receives confirmation
5. App owner views user in App Users screen
6. App owner grants page access
7. User logs in and accesses granted pages

**Expected Results:**
- ✅ User created with role
- ✅ Application data saved
- ✅ User appears in App Users screen (real-time)
- ✅ Page access can be edited
- ✅ User can login successfully
- ✅ User can only access granted pages

### Scenario B: Bulk User Creation

**Steps:**
1. Create workflow: `http.request → RoleIs → db.create`
2. HTTP request fetches array of users from external API
3. RoleIs creates first user from array
4. db.create inserts all records

**Expected Results:**
- ✅ First user created
- ✅ All records inserted
- ✅ Records linked to created user
- ✅ User appears in App Users screen

### Scenario C: User Management Workflow

**Steps:**
1. App owner views App Users screen
2. Creates user via RoleIs (in another tab)
3. User appears automatically (real-time update)
4. App owner edits user details
5. App owner grants page access
6. App owner resets password
7. User logs in with new password
8. App owner deletes user
9. User removed automatically (real-time update)

**Expected Results:**
- ✅ All CRUD operations work
- ✅ Real-time updates work (no refresh needed)
- ✅ Page access editing works
- ✅ Password reset works
- ✅ User deletion works

---

## How to Test Everything

### 1. Test from UI (Canvas)

**Setup:**
1. Create form with email/password fields
2. Connect to RoleIs workflow
3. Submit form

**Verify:**
- User created
- Appears in App Users screen automatically

### 2. Test from Workflow Execution

**Setup:**
1. Create workflow with RoleIs block
2. Execute workflow via API or UI

**Verify:**
- User created
- Context variables set correctly
- Next blocks receive context

### 3. Test from Postman

**Create User:**
```http
POST http://localhost:5000/api/app-users/1/create
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "roleSlug": "user",
  "name": "Test User"
}
```

**List Users:**
```http
GET http://localhost:5000/api/app-users/1/list
Authorization: Bearer YOUR_JWT_TOKEN
```

**Update User:**
```http
PUT http://localhost:5000/api/app-users/1
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "test@example.com",
  "name": "Updated Name",
  "isActive": true,
  "roleSlug": "staff"
}
```

**Grant Page Access:**
```http
POST http://localhost:5000/api/pages/1/assign/1
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "pageIds": [1, 2, 3]
}
```

**Delete User:**
```http
DELETE http://localhost:5000/api/app-users/1
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Troubleshooting

### Issue: User not created via RoleIs

**Check:**
1. Email and password provided in RoleIs config
2. Backend logs for errors
3. AppUser table exists
4. User already exists (won't create duplicate)

**Solution:**
- Check workflow execution logs
- Verify RoleIs block configuration
- Check database connection

### Issue: Real-time updates not working

**Check:**
1. Socket.io connection established (browser console)
2. Joined app room: Check console for "Joined app room"
3. Backend emits events: Check server logs
4. Frontend listens to events: Check component useEffect

**Solution:**
- Refresh page to reconnect socket
- Check browser console for errors
- Verify appId matches

### Issue: Page access not saving

**Check:**
1. Pages exist for the app
2. API route working: `/api/pages/:appId/assign/:appUserId`
3. Backend logs for errors

**Solution:**
- Create pages first
- Check API proxy routes
- Verify authentication token

### Issue: User can't login

**Check:**
1. User exists in AppUser table
2. Password is correct
3. User is active (`isActive: true`)
4. Password was hashed correctly

**Solution:**
- Reset password via App Users screen
- Check user status
- Verify password hash in database

---

## Quick Reference

### RoleIs Configuration:
- **Username/Email:** `{{formData.email}}` or static value
- **Password:** `{{formData.password}}` or static value
- **Role for New User:** Role slug (e.g., "user", "admin")
- **Required Role to Check:** Role to verify
- **Required Pages:** Array of page slugs

### Context Variables Available:
- `context.appUser` - User object (id, email, role)
- `context.roleCheck` - Role verification result
- `context.createdAppUserId` - ID of created user

### API Endpoints:
- `GET /api/app-users/:appId/list` - List users
- `POST /api/app-users/:appId/create` - Create user
- `GET /api/app-users/:userId` - Get user
- `PUT /api/app-users/:userId` - Update user
- `DELETE /api/app-users/:userId` - Delete user
- `POST /api/app-users/:userId/reset-password` - Reset password
- `POST /api/app-users/:appId/login` - User login
- `GET /api/pages/:appId/list` - List pages
- `POST /api/pages/:appId/assign/:appUserId` - Grant page access

---

## Testing Checklist

### ✅ User Creation:
- [ ] Create user via form submission
- [ ] Create user via button click
- [ ] Create user via Postman API
- [ ] User appears in App Users screen automatically
- [ ] Password is hashed (not plain text)
- [ ] Role is assigned correctly
- [ ] Page access can be granted

### ✅ User Management:
- [ ] View all users in App Users screen
- [ ] Edit user details
- [ ] Edit page access
- [ ] Reset password
- [ ] Delete user
- [ ] All updates appear in real-time (no refresh)

### ✅ Access Control:
- [ ] User can login with credentials
- [ ] User receives JWT token
- [ ] User can access granted pages
- [ ] User cannot access non-granted pages
- [ ] Role-based access works correctly

### ✅ Real-Time Updates:
- [ ] Create user → Appears automatically
- [ ] Update user → Updates automatically
- [ ] Delete user → Removed automatically
- [ ] Grant page access → Updates automatically

---

*Complete testing guide for RoleIs block from app owner perspective*

