# Complete RoleIs Block Testing Guide

## Overview

This guide explains how to test the RoleIs block workflow from start to finish, including UI testing, workflow testing, and Postman testing.

---

## Table of Contents

1. [Understanding RoleIs Block](#understanding-roleis-block)
2. [Workflow Setup](#workflow-setup)
3. [Testing from UI](#testing-from-ui)
4. [Testing from Workflow](#testing-from-workflow)
5. [Testing from Postman](#testing-from-postman)
6. [Verifying Results](#verifying-results)

---

## Understanding RoleIs Block

### What RoleIs Block Does:

1. **User Creation** (if credentials provided):
   - Creates new AppUser in database
   - Hashes password securely (bcrypt)
   - Assigns role to user
   - Grants page access (if configured)

2. **Role Verification**:
   - Checks if user has required role
   - Verifies page access permissions
   - Returns success/failure result

3. **Context Variables Set**:
   - `context.appUser` - Created/authenticated user info
   - `context.roleCheck` - Role verification result
   - `context.createdAppUserId` - ID of created user

---

## Workflow Setup

### Recommended Workflow Structure:

```
Form Submit / Button Click
    ↓
RoleIs Block
    ↓
db.create Block
    ↓
notify.toast Block
```

### Step 1: Create Form (if using form submission)

**Required Input Fields:**
- Email input (elementId: `email`)
- Password input (elementId: `password`)
- Other form fields (e.g., loan application data)

**Form Configuration:**
- Set `formGroupId` on all inputs
- Connect form to workflow via `onSubmit` trigger

### Step 2: Configure RoleIs Block

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

**Note:** If you want to test without creating a user, leave email/password empty and only configure role check.

### Step 3: Configure db.create Block

**Settings:**
```
Table Name: loan_applications
Data Source: formData
```

**The block will automatically:**
- Use `context.appUser.id` if available
- Link records to created user

### Step 4: Configure notify.toast Block

**Settings:**
```
Message: Application submitted! User: {{appUser.email}}
Variant: success
```

---

## Testing from UI

### Method 1: Form Submission

1. **Open your app in Canvas**
   - Navigate to your app
   - Go to Canvas view

2. **Create/Open form**
   - Add input fields: email, password, loan details
   - Connect form to workflow

3. **Fill the form:**
   ```
   Email: prince@gmail.com
   Password: secret123
   Full Name: Prince Kumar
   Loan Amount: 100000
   ```

4. **Submit the form**
   - Click submit button
   - Watch for success toast

5. **Verify in App Users screen:**
   - Go to Database screen
   - Click "App Users" button
   - You should see the new user listed

### Method 2: Button Click Workflow

1. **Create a button**
   - Add button to canvas
   - Set `onClick` trigger

2. **Configure workflow:**
   ```
   onClick → RoleIs → db.create → notify.toast
   ```

3. **In RoleIs block, use static values:**
   ```
   Username/Email: test@example.com
   Password: password123
   Role: user
   ```

4. **Click button**
   - Workflow executes
   - User is created
   - Data is inserted

5. **Check App Users screen**
   - User should appear immediately (real-time update)

---

## Testing from Workflow

### Test Scenario 1: Create New User

**Workflow:**
```
Button Click → RoleIs → db.create → notify.toast
```

**RoleIs Configuration:**
- Email: `newuser@example.com`
- Password: `password123`
- Role: `user`

**Expected Result:**
- User created in `AppUser` table
- Role assigned in `AppUserRole` table
- `context.appUser` set with user info
- db.create uses `context.appUser.id`
- Toast shows success message

**Check Logs:**
```
🔐 [ROLE-IS] Executing role check...
👤 [ROLE-IS] Creating new AppUser with credentials...
✅ [ROLE-IS] Created AppUser 1 with role user
🗄️ [DB-CREATE] Starting table creation...
✅ [DB-CREATE] Record inserted successfully
```

### Test Scenario 2: Existing User (No Duplicate)

**Workflow:**
```
Button Click → RoleIs → db.create
```

**RoleIs Configuration:**
- Email: `prince@gmail.com` (already exists)
- Password: `secret123`
- Role: `user`

**Expected Result:**
- Uses existing user (doesn't create duplicate)
- Gets existing user's role
- Continues workflow normally

**Check Logs:**
```
⚠️ [ROLE-IS] AppUser already exists, using existing user
✅ [ROLE-IS] Using existing AppUser role: user
```

### Test Scenario 3: Role Verification Only

**Workflow:**
```
Button Click → RoleIs → Conditional Branch
```

**RoleIs Configuration:**
- Email: (empty)
- Password: (empty)
- Required Role: `admin`

**Expected Result:**
- Checks platform user's role
- Returns `isFilled: true` if role matches
- Returns `isFilled: false` if role doesn't match

**Check Logs:**
```
🔐 [ROLE-IS] Executing role check...
👤 [ROLE-IS] No credentials provided, checking platform user role
⚠️ [ROLE-IS] User role missing → fail
```

### Test Scenario 4: Multiple Records Insertion

**Workflow:**
```
Button Click → http.request → RoleIs → db.create
```

**HTTP Request:**
- Returns array of users to create

**RoleIs Configuration:**
- Email: `{{httpResponse.data[0].email}}`
- Password: `{{httpResponse.data[0].password}}`
- Role: `user`

**Expected Result:**
- Creates first user from array
- db.create inserts all records
- All records linked to created user

---

## Testing from Postman

### 1. Execute Workflow with RoleIs

**Request:**
```http
POST http://localhost:5000/api/workflow/execute
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "workflowId": 1,
  "appId": 1,
  "triggerElementId": "button-123",
  "context": {
    "formData": {
      "email": "test@example.com",
      "password": "password123",
      "fullName": "Test User",
      "loanAmount": 50000
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "type": "roleIs",
      "success": true,
      "context": {
        "appUser": {
          "id": 1,
          "email": "test@example.com",
          "role": "user"
        },
        "roleCheck": {
          "isValid": true,
          "roleValid": true,
          "userRole": "user",
          "requiredRole": "user"
        }
      }
    },
    {
      "type": "db.create",
      "success": true,
      "recordId": 1,
      "recordsInserted": 1
    }
  ]
}
```

### 2. Verify User Created

**Request:**
```http
GET http://localhost:5000/api/app-users/1/list
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "email": "test@example.com",
      "name": null,
      "isActive": true,
      "roles": [
        {
          "appRole": {
            "name": "User",
            "slug": "user"
          }
        }
      ],
      "pageAccess": []
    }
  ]
}
```

### 3. Test User Login

**Request:**
```http
POST http://localhost:5000/api/app-users/1/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": null,
    "roles": ["user"],
    "accessiblePages": []
  }
}
```

---

## Verifying Results

### 1. Check Database Tables

**AppUser Table:**
```sql
SELECT * FROM "AppUser" WHERE "appId" = 1;
```

**Expected:**
- New user record with hashed password
- `isActive: true`
- `email` matches input

**AppUserRole Table:**
```sql
SELECT 
  u.email,
  r.name as role_name,
  r.slug as role_slug
FROM "AppUser" u
JOIN "AppUserRole" ur ON u.id = ur."appUserId"
JOIN "AppRole" r ON ur."appRoleId" = r.id
WHERE u."appId" = 1;
```

**Expected:**
- User linked to role
- Role name and slug match configuration

### 2. Check App Users UI

1. **Navigate to App Users:**
   - Database screen → "App Users" button
   - Or: `/app-users?appId=1&appName=YourApp`

2. **Verify user appears:**
   - Email matches
   - Role badge shows correct role
   - Status shows "Active"
   - Created date is recent

3. **Test real-time updates:**
   - Open App Users screen
   - Create user via workflow in another tab
   - User should appear automatically (no refresh needed)

### 3. Check Workflow Context

**After RoleIs executes, context should contain:**
```javascript
context.appUser = {
  id: 1,
  email: "test@example.com",
  role: "user"
}

context.roleCheck = {
  isValid: true,
  roleValid: true,
  pageValid: true,
  userRole: "user",
  requiredRole: "user"
}

context.createdAppUserId = 1
```

**Next blocks can use:**
- `{{appUser.email}}` - User's email
- `{{appUser.id}}` - User's ID
- `{{appUser.role}}` - User's role
- `{{roleCheck.isValid}}` - Whether role check passed

---

## Complete Test Checklist

### ✅ User Creation Tests

- [ ] Create user via form submission
- [ ] Create user via button click workflow
- [ ] Create user via Postman API
- [ ] Verify user appears in App Users screen
- [ ] Verify password is hashed (not plain text)
- [ ] Verify role is assigned
- [ ] Verify page access granted (if configured)
- [ ] Test with existing email (should use existing user)

### ✅ Role Verification Tests

- [ ] Test role check with matching role
- [ ] Test role check with non-matching role
- [ ] Test multiple roles check
- [ ] Test page access verification
- [ ] Test without credentials (platform user check)

### ✅ Real-Time Updates Tests

- [ ] Create user → Appears in UI automatically
- [ ] Update user → UI updates automatically
- [ ] Delete user → Removed from UI automatically
- [ ] Reset password → UI updates automatically

### ✅ Integration Tests

- [ ] RoleIs → db.create workflow works
- [ ] RoleIs → Conditional branch works
- [ ] RoleIs → Multiple blocks in sequence
- [ ] Context variables available in next blocks

---

## Troubleshooting

### Issue: User not created

**Check:**
1. Email and password fields provided in RoleIs config
2. Check backend logs for errors
3. Verify AppUser table exists
4. Check if user already exists (won't create duplicate)

### Issue: Role not assigned

**Check:**
1. Role slug matches exactly (case-insensitive, normalized)
2. Check AppRole table for role existence
3. Check AppUserRole table for assignment
4. Verify role was created if it didn't exist

### Issue: Real-time updates not working

**Check:**
1. Socket.io connection established (check browser console)
2. Joined app room: `socket.emit("join-canvas", { appId })`
3. Backend emits events: Check server logs
4. Frontend listens to events: Check component useEffect

### Issue: Context variables not available

**Check:**
1. RoleIs block executed successfully
2. Check workflow execution logs
3. Verify context is passed to next blocks
4. Use correct variable names: `{{appUser.email}}`

---

## Quick Reference

### RoleIs Configuration Fields:

- **Username/Email**: `{{formData.email}}` or static value
- **Password**: `{{formData.password}}` or static value
- **Role for New User**: Role slug (e.g., "user", "admin")
- **Required Role to Check**: Role to verify
- **Allow multiple roles**: Checkbox for multi-role check
- **Required Pages**: Array of page slugs

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

---

*Complete testing guide for RoleIs block workflow*








