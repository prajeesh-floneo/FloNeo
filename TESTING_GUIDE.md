# Complete Testing Guide: App Users & RoleIs Block

This guide explains how to test the RoleIs block workflow and view/manage app users from UI, workflow, and Postman.

---

## Table of Contents

1. [Workflow Setup](#workflow-setup)
2. [Testing from UI](#testing-from-ui)
3. [Testing from Workflow](#testing-from-workflow)
4. [Testing from Postman](#testing-from-postman)
5. [Viewing Users & Access Details](#viewing-users--access-details)

---

## Workflow Setup

### Recommended Workflow for User Creation

```
Form Submit → RoleIs → db.create → notify.toast
```

**Why this workflow?**
- **Form Submit**: Collects user credentials and data
- **RoleIs**: Creates user account and assigns role
- **db.create**: Stores application data linked to user
- **notify.toast**: Confirms successful submission

### Step-by-Step Configuration

#### 1. Create a Form with Input Fields

**Required fields:**
- Email input (elementId: `email`)
- Password input (elementId: `password`)
- Loan application fields (e.g., `fullName`, `loanAmount`, etc.)

#### 2. Configure RoleIs Block

**Settings:**
- **Username/Email**: `{{formData.email}}`
- **Password**: `{{formData.password}}`
- **Role for New User**: `user` (or any role name)
- **Required Role to Check**: `user`
- **Required Pages**: (optional) Leave empty or specify page slugs

#### 3. Configure db.create Block

**Settings:**
- **Table Name**: `loan_applications` (or your table name)
- **Data Source**: `formData` (or `httpResponse.data` if using API)
- The block will automatically use `context.appUser` from RoleIs

#### 4. Configure notify.toast Block

**Settings:**
- **Message**: `Application submitted successfully! User created: {{appUser.email}}`
- **Variant**: `success`

---

## Testing from UI

### Method 1: Using Canvas Form

1. **Open your app in Canvas**
   - Navigate to your app
   - Go to Canvas view

2. **Create/Open a form**
   - Add input fields for email, password, and loan details
   - Connect form to workflow

3. **Fill the form**
   ```
   Email: prince@gmail.com
   Password: secret123
   Full Name: Prince Kumar
   Loan Amount: 100000
   ```

4. **Submit the form**
   - Click submit button
   - Watch for success toast notification

5. **Verify user creation**
   - Go to: `http://localhost:3000/app-users?appId=1&appName=YourApp`
   - You should see the new user listed

### Method 2: Using App Users Management Screen

1. **Navigate to App Users**
   - From app dashboard, click "App Users" button (if available)
   - Or go directly to: `/app-users?appId=YOUR_APP_ID&appName=YOUR_APP_NAME`

2. **View all users**
   - See list of all registered users
   - View their roles and page access

3. **Test user management**
   - **Edit User**: Click edit icon → Update email/name/role → Save
   - **Reset Password**: Click key icon → Enter new password → Reset
   - **Delete User**: Click trash icon → Confirm deletion

---

## Testing from Workflow

### Test Workflow Execution

1. **Trigger the workflow**
   - Use a button with `onClick` trigger
   - Or use form submission trigger

2. **Check workflow logs**
   - Open browser console (F12)
   - Look for logs like:
     ```
     🔐 [ROLE-IS] Executing role check...
     👤 [ROLE-IS] Creating new AppUser with credentials...
     ✅ [ROLE-IS] Created AppUser 1 with role user
     🗄️ [DB-CREATE] Starting table creation...
     ✅ [DB-CREATE] Record inserted successfully
     ```

3. **Verify context variables**
   - After RoleIs executes, check `context.appUser`:
     ```javascript
     context.appUser = {
       id: 1,
       email: "prince@gmail.com",
       role: "user"
     }
     ```

### Test Different Scenarios

#### Scenario 1: New User Creation
- **Input**: Email that doesn't exist
- **Expected**: User created, role assigned, workflow continues

#### Scenario 2: Existing User
- **Input**: Email that already exists
- **Expected**: Uses existing user, doesn't create duplicate

#### Scenario 3: Role Verification
- **Input**: User with different role
- **Expected**: RoleIs check passes/fails based on configuration

---

## Testing from Postman

### 1. List All Users for an App

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
      "email": "prince@gmail.com",
      "name": "Prince Kumar",
      "isActive": true,
      "createdAt": "2025-01-20T10:00:00.000Z",
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
            "slug": "page-1",
            "title": "Dashboard"
          }
        }
      ]
    }
  ]
}
```

### 2. Get Single User Details

**Request:**
```http
GET http://localhost:5000/api/app-users/1
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "prince@gmail.com",
    "name": "Prince Kumar",
    "isActive": true,
    "roles": [...],
    "pageAccess": [...]
  }
}
```

### 3. Create User Manually

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": 2,
    "email": "test@example.com",
    "name": "Test User",
    "isActive": true
  },
  "roleAssigned": true
}
```

### 4. Update User

**Request:**
```http
PUT http://localhost:5000/api/app-users/1
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "email": "newemail@gmail.com",
  "name": "Updated Name",
  "isActive": true,
  "roleSlug": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "user": {
    "id": 1,
    "email": "newemail@gmail.com",
    "name": "Updated Name",
    "isActive": true,
    "roles": [...]
  }
}
```

### 5. Reset Password

**Request:**
```http
POST http://localhost:5000/api/app-users/1/reset-password
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "newPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### 6. Delete User

**Request:**
```http
DELETE http://localhost:5000/api/app-users/1
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 7. User Login (Test Authentication)

**Request:**
```http
POST http://localhost:5000/api/app-users/1/login
Content-Type: application/json

{
  "email": "prince@gmail.com",
  "password": "secret123"
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
    "email": "prince@gmail.com",
    "name": "Prince Kumar",
    "roles": ["user"],
    "accessiblePages": ["page-1", "page-2"]
  }
}
```

### 8. Execute Workflow (Test RoleIs Block)

**Request:**
```http
POST http://localhost:5000/api/workflow/execute
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "workflowId": 1,
  "triggerElementId": "button-123",
  "context": {
    "formData": {
      "email": "newuser@example.com",
      "password": "password123",
      "fullName": "New User",
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
          "id": 2,
          "email": "newuser@example.com",
          "role": "user"
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

---

## Viewing Users & Access Details

### From UI (App Users Screen)

1. **Navigate to App Users**
   ```
   URL: http://localhost:3000/app-users?appId=1&appName=YourApp
   ```

2. **View User List**
   - See all users in a table
   - Columns: Email, Name, Role, Page Access, Status, Created Date

3. **View User Details**
   - Click on a user row to see full details
   - See all roles assigned
   - See all pages user can access

4. **Search Users**
   - Use search bar to filter by email, name, or role

### From Database (Direct SQL Query)

If you have database access, you can query directly:

```sql
-- Get all users for an app
SELECT * FROM "AppUser" WHERE "appId" = 1;

-- Get user with roles
SELECT 
  u.id, u.email, u.name, u."isActive",
  r.name as role_name, r.slug as role_slug
FROM "AppUser" u
LEFT JOIN "AppUserRole" ur ON u.id = ur."appUserId"
LEFT JOIN "AppRole" r ON ur."appRoleId" = r.id
WHERE u."appId" = 1;

-- Get user page access
SELECT 
  u.email,
  p.slug as page_slug,
  p.title as page_title
FROM "AppUser" u
LEFT JOIN "PageAccess" pa ON u.id = pa."appUserId"
LEFT JOIN "AppPage" p ON pa."pageId" = p.id
WHERE u."appId" = 1;
```

### From Backend Logs

Check server console for detailed logs:

```
🔐 [ROLE-IS] Executing role check...
👤 [ROLE-IS] Creating new AppUser with credentials...
✅ [ROLE-IS] Created AppUser 1 with role user
📄 [ROLE-IS] Assigned 2 page(s) to AppUser 1: ["page-1", "page-2"]
```

---

## Complete Test Checklist

### ✅ User Creation Tests

- [ ] Create user via workflow (RoleIs block)
- [ ] Create user manually via API
- [ ] Verify user appears in App Users screen
- [ ] Verify password is hashed (not plain text)
- [ ] Verify role is assigned correctly
- [ ] Verify page access is granted (if configured)

### ✅ User Management Tests

- [ ] List all users (API + UI)
- [ ] Get single user details
- [ ] Update user email
- [ ] Update user name
- [ ] Change user role
- [ ] Activate/deactivate user
- [ ] Reset user password
- [ ] Delete user

### ✅ Authentication Tests

- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Login with non-existent email (should fail)
- [ ] Verify JWT token is returned
- [ ] Verify accessible pages are returned

### ✅ Workflow Integration Tests

- [ ] RoleIs creates user in workflow
- [ ] db.create uses context.appUser
- [ ] Duplicate prevention works (same email twice)
- [ ] Role verification works correctly
- [ ] Page access check works

### ✅ UI Tests

- [ ] App Users screen loads
- [ ] Users list displays correctly
- [ ] Search functionality works
- [ ] Edit modal opens and saves
- [ ] Reset password modal works
- [ ] Delete confirmation works
- [ ] Database table scrolling works

---

## Troubleshooting

### Issue: User not appearing in App Users screen

**Check:**
1. Verify appId in URL matches the app where user was created
2. Check browser console for errors
3. Verify API endpoint is working: `GET /api/app-users/:appId/list`
4. Check if user was actually created (check database or logs)

### Issue: Password reset not working

**Check:**
1. Verify you're using the correct user ID
2. Check password meets minimum requirements (6+ characters)
3. Verify JWT token is valid
4. Check server logs for errors

### Issue: Role not assigned

**Check:**
1. Verify role slug matches exactly (case-insensitive, but normalized)
2. Check if role exists in AppRole table
3. Verify AppUserRole record was created
4. Check workflow logs for role assignment

### Issue: Page access not granted

**Check:**
1. Verify page exists in AppPage table
2. Check PageAccess records were created
3. Verify page slugs match exactly
4. Check if role-based access is configured

---

## Quick Reference

### API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/app-users/:appId/list` | List all users |
| GET | `/api/app-users/:appUserId` | Get single user |
| POST | `/api/app-users/:appId/create` | Create user |
| PUT | `/api/app-users/:appUserId` | Update user |
| POST | `/api/app-users/:appUserId/reset-password` | Reset password |
| DELETE | `/api/app-users/:appUserId` | Delete user |
| POST | `/api/app-users/:appId/login` | User login |

### Context Variables (After RoleIs)

```javascript
context.appUser = {
  id: 1,
  email: "prince@gmail.com",
  role: "user"
}

context.roleCheck = {
  isValid: true,
  roleValid: true,
  pageValid: true,
  userRole: "user",
  requiredRole: "user"
}
```

---

## Next Steps

1. **Test user creation** via workflow
2. **View users** in App Users screen
3. **Test API endpoints** in Postman
4. **Verify access control** works correctly
5. **Test password reset** functionality

---

*Last Updated: Complete testing guide for App Users and RoleIs block*








