# Quick Start: App Users Management

## 🎯 What Was Fixed & Added

### 1. ✅ Database UI Scrolling Fixed
- Changed container classes to enable proper scrolling
- Added `min-h-0` to flex containers to prevent overflow issues
- Table now scrolls properly without needing to zoom out

### 2. ✅ App Users Management UI Created
- New screen to view all app users
- See user details: email, name, roles, page access
- Edit users, reset passwords, delete users
- Search functionality

### 3. ✅ API Endpoints Available
- List users: `GET /api/app-users/:appId/list`
- Get user: `GET /api/app-users/:appUserId`
- Update user: `PUT /api/app-users/:appUserId`
- Reset password: `POST /api/app-users/:appUserId/reset-password`
- Delete user: `DELETE /api/app-users/:appUserId`

---

## 🚀 How to Access App Users Screen

### From Database Screen:
1. Go to Database screen for your app
2. Click **"App Users"** button in the header
3. You'll see all registered users

### Direct URL:
```
http://localhost:3000/app-users?appId=1&appName=YourApp
```

---

## 📋 How RoleIs Block Stores Credentials

### When RoleIs Block Executes:

1. **User Credentials Stored:**
   - Email → `AppUser.email`
   - Password → `AppUser.password` (hashed with bcrypt)
   - Name → `AppUser.name` (optional)

2. **Role Assignment:**
   - Role → `AppRole` table (created if doesn't exist)
   - User-Role link → `AppUserRole` table

3. **Page Access:**
   - Page access → `PageAccess` table
   - Links user to specific pages

### Database Tables Used:
- `AppUser` - User credentials
- `AppRole` - Role definitions
- `AppUserRole` - User-role relationships
- `PageAccess` - User page permissions

---

## 🧪 Testing Methods

### Method 1: From UI (Easiest)

1. **Create User via Workflow:**
   - Set up workflow: `Form Submit → RoleIs → db.create`
   - Fill form with email, password, and data
   - Submit form
   - User is created automatically

2. **View Users:**
   - Go to App Users screen
   - See all registered users
   - View their roles and access

3. **Manage Users:**
   - Click edit icon to update user
   - Click key icon to reset password
   - Click trash icon to delete user

### Method 2: From Postman

**List Users:**
```http
GET http://localhost:5000/api/app-users/1/list
Authorization: Bearer YOUR_TOKEN
```

**Create User:**
```http
POST http://localhost:5000/api/app-users/1/create
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "roleSlug": "user",
  "name": "Test User"
}
```

**Reset Password:**
```http
POST http://localhost:5000/api/app-users/1/reset-password
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "newPassword": "newPassword123"
}
```

### Method 3: From Workflow

**Workflow Configuration:**
```
onClick/onSubmit → RoleIs → db.create → notify.toast
```

**RoleIs Settings:**
- Username/Email: `{{formData.email}}`
- Password: `{{formData.password}}`
- Role: `user`

**After Execution:**
- Check `context.appUser` for created user details
- User is stored in database
- Can be viewed in App Users screen

---

## 📊 What You Can See

### In App Users Screen:

1. **User List:**
   - Email address
   - Name (if provided)
   - Assigned roles (badges)
   - Page access (badges)
   - Active/Inactive status
   - Creation date

2. **User Details:**
   - All roles assigned
   - All pages user can access
   - Account status
   - Creation timestamp

3. **Actions Available:**
   - Edit user information
   - Change user role
   - Reset password
   - Delete user

---

## ✅ Recommended Workflow

### For Loan Application System:

```
Form Submit
  ↓
RoleIs Block
  - Email: {{formData.email}}
  - Password: {{formData.password}}
  - Role: "user"
  ↓
db.create Block
  - Table: "loan_applications"
  - Data: {{formData}}
  - Links to: {{appUser.id}}
  ↓
notify.toast
  - Message: "Application submitted!"
```

### What Happens:

1. User fills form with:
   - Email: `prince@gmail.com`
   - Password: `secret123`
   - Loan details

2. RoleIs creates:
   - AppUser record
   - Role assignment
   - Page access (if configured)

3. db.create inserts:
   - Loan application data
   - Linked to user ID

4. User can now:
   - Login with credentials
   - View their applications
   - Access granted pages

---

## 🔍 Verification Steps

### After Creating User:

1. **Check App Users Screen:**
   - User should appear in list
   - Email, role, and access visible

2. **Check Database:**
   - `AppUser` table has new record
   - `AppUserRole` has role assignment
   - `PageAccess` has page permissions (if configured)

3. **Test Login:**
   ```http
   POST /api/app-users/1/login
   {
     "email": "prince@gmail.com",
     "password": "secret123"
   }
   ```

4. **Check Workflow Logs:**
   - Look for: `✅ [ROLE-IS] Created AppUser X with role user`
   - Verify: `context.appUser` is set

---

## 🎯 Quick Test Checklist

- [ ] Database scrolling works (no zoom needed)
- [ ] App Users screen accessible
- [ ] Users list displays correctly
- [ ] Create user via workflow
- [ ] User appears in App Users screen
- [ ] Edit user works
- [ ] Reset password works
- [ ] Delete user works
- [ ] API endpoints work in Postman
- [ ] Login with created credentials works

---

## 📝 Notes

- **Passwords are hashed** - Never stored in plain text
- **Users are app-specific** - Same email in different apps = different users
- **Roles are auto-created** - If role doesn't exist, it's created automatically
- **Page access is optional** - Only if `requiredPages` is configured in RoleIs

---

*For detailed testing instructions, see `TESTING_GUIDE.md`*








