# RoleIs Block - Complete Guide

## Overview

The **RoleIs** block is a powerful workflow component that handles user authentication, role management, and access control for your applications. It can create app users, assign roles, grant page access, and verify permissions.

---

## How RoleIs Block Works

### 1. **User Creation & Credential Management**

When you configure the RoleIs block with user credentials:

#### Configuration Fields:
- **Username/Email**: The email address for the new user
- **Password**: The password for the new user account
- **Role for New User**: The role to assign (e.g., "user", "admin", "manager")

#### What Happens:
1. **Check if user exists**: The system first checks if a user with that email already exists for the app
2. **Create new user** (if doesn't exist):
   - Password is hashed using bcrypt (secure encryption)
   - User is stored in the `AppUser` table
   - User is marked as active
3. **Role assignment**:
   - If the specified role doesn't exist, it's automatically created
   - The role is assigned to the user
   - Role information is stored in `AppUserRole` table
4. **Page access** (if configured):
   - If `requiredPages` are specified, the user gets access to those pages
   - Page access is stored in `PageAccess` table

#### Example Workflow:
```
onClick → RoleIs (create user: prince@gmail.com, password: "secret123", role: "user")
         → db.create (insert loan application)
         → notify.toast ("Application submitted!")
```

---

### 2. **Role Verification**

The RoleIs block can also verify if a user has the required role:

#### Configuration:
- **Required Role to Check**: The role that must be present (e.g., "admin")
- **Allow multiple roles**: Checkbox to allow checking against multiple roles
- **Required Pages**: Pages the user must have access to

#### What Happens:
1. **Get user role**: 
   - If an AppUser was created in this workflow, use that user's role
   - Otherwise, check the platform user's role
2. **Verify role match**:
   - Single role mode: Check if user role matches required role exactly
   - Multiple role mode: Check if user role is in the list of allowed roles
3. **Verify page access**:
   - Check if user has access to all required pages
   - Combines direct page access + role-based page access
4. **Return result**:
   - `isFilled: true` if role and page checks pass
   - `isFilled: false` if any check fails

---

## Database Structure

### Tables Used:

#### 1. **AppUser** Table
Stores user credentials and basic information:
```sql
- id: Primary key
- appId: Which app this user belongs to
- email: User's email (unique per app)
- password: Hashed password (bcrypt)
- name: User's display name (optional)
- isActive: Whether user account is active
- createdAt: When user was created
- updatedAt: Last update timestamp
```

#### 2. **AppRole** Table
Stores role definitions:
```sql
- id: Primary key
- appId: Which app this role belongs to
- name: Role display name (e.g., "User", "Admin")
- slug: Role identifier (e.g., "user", "admin")
- description: Role description
- isPredefined: Whether role is system-defined
```

#### 3. **AppUserRole** Table
Links users to roles (many-to-many):
```sql
- appUserId: Reference to AppUser
- appRoleId: Reference to AppRole
- grantedBy: Who granted this role (user ID)
- createdAt: When role was assigned
```

#### 4. **PageAccess** Table
Stores which users can access which pages:
```sql
- id: Primary key
- appId: Which app
- appUserId: Which user
- pageId: Which page
- pageSlug: Page identifier (e.g., "page-1")
```

---

## Complete Workflow Example: Loan Application System

### Scenario:
You're building a loan application system where:
1. Users submit loan applications
2. Each user gets a unique account
3. Users can only view their own applications
4. Admins can view all applications

### Step-by-Step Setup:

#### Step 1: Create the Workflow
```
Button Click → RoleIs → db.create → notify.toast
```

#### Step 2: Configure RoleIs Block

**In the RoleIs configuration modal:**

1. **User Creation Section:**
   - Username/Email: `{{formData.email}}` (from form input)
   - Password: `{{formData.password}}` (from form input)
   - Role for New User: `user`

2. **Role Check Section:**
   - Required Role to Check: `user`
   - Allow multiple roles: Unchecked
   - Required Pages: Leave empty (or specify pages if needed)

#### Step 3: Configure db.create Block

The db.create block will:
- Receive data from the form submission
- Insert loan application data
- Link it to the user created by RoleIs block

**Data flow:**
```
RoleIs creates user → context.appUser = { id: 123, email: "...", role: "user" }
db.create receives → context.formData (loan application data)
db.create inserts → loan application + user ID reference
```

#### Step 4: What Happens When User Clicks Submit

1. **Form submission**:
   - User fills form with email, password, loan details
   - Clicks submit button

2. **RoleIs block executes**:
   - Checks if `prince@gmail.com` exists for this app
   - If not, creates new AppUser:
     ```json
     {
       "id": 1,
       "appId": 1,
       "email": "prince@gmail.com",
       "password": "$2a$12$hashed...",
       "isActive": true
     }
     ```
   - Creates/assigns "user" role
   - Sets `context.appUser` for next blocks

3. **db.create block executes**:
   - Receives loan application data from form
   - Inserts into database:
     ```json
     {
       "applicationId": "LN123456",
       "fullName": "Prince Kumar",
       "email": "prince@gmail.com",
       "loanAmount": 100000,
       "appUserId": 1  // Linked to user created above
     }
     ```

4. **notify.toast block executes**:
   - Shows success message: "Application submitted successfully!"

---

## Managing App Users (After Creation)

### API Endpoints Available:

#### 1. **List All Users for an App**
```
GET /api/app-users/:appId/list
```
Returns all users with their roles and page access.

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
      "roles": [
        {
          "appRole": {
            "name": "User",
            "slug": "user"
          }
        }
      ],
      "pageAccess": [
        {
          "page": {
            "slug": "page-1",
            "title": "Dashboard"
          }
        }
      ]
    }
  ]
}
```

#### 2. **Get Single User**
```
GET /api/app-users/:appUserId
```
Returns detailed information about a specific user.

#### 3. **Update User**
```
PUT /api/app-users/:appUserId
Body: {
  "email": "newemail@gmail.com",
  "name": "New Name",
  "isActive": true,
  "roleSlug": "admin"
}
```
Updates user information and/or role.

#### 4. **Reset Password (by App Owner)**
```
POST /api/app-users/:appUserId/reset-password
Body: {
  "newPassword": "newSecurePassword123"
}
```
Allows app owner to reset a user's password.

**Use Case:**
- User forgets password
- App owner can reset it from the admin panel
- User can then login with new password

#### 5. **Delete User**
```
DELETE /api/app-users/:appUserId
```
Removes user and all associated data (roles, page access).

---

## Access Control Flow

### How Page Access Works:

1. **Direct Page Access**:
   - User is explicitly granted access to specific pages
   - Stored in `PageAccess` table
   - Example: User "prince@gmail.com" has access to "page-1"

2. **Role-Based Page Access**:
   - Role is granted access to pages
   - All users with that role get access
   - Example: "admin" role has access to all pages

3. **Combined Access**:
   - User gets access from both direct + role-based
   - If user has role "admin" OR direct access to "page-1", they can access it

### Example:

```
User: prince@gmail.com
Role: "user"
Direct Page Access: ["page-1"]
Role "user" Page Access: ["page-1", "page-2"]

Result: User can access ["page-1", "page-2"]
```

---

## Security Features

### 1. **Password Hashing**
- All passwords are hashed using bcrypt
- Salt rounds: 12 (configurable via `BCRYPT_SALT_ROUNDS`)
- Original passwords are never stored

### 2. **App Isolation**
- Users are scoped to specific apps
- User "prince@gmail.com" in App 1 is different from "prince@gmail.com" in App 2
- Each app has its own user base

### 3. **Role Validation**
- Roles are validated before assignment
- Invalid roles are rejected
- Role slugs are normalized (spaces → hyphens, lowercase)

### 4. **Access Control**
- Page access is checked before allowing navigation
- Users can only access pages they're granted
- RoleIs block verifies access in workflows

---

## Common Use Cases

### Use Case 1: User Registration
```
Form Submit → RoleIs (create user) → db.create (save profile) → notify.toast
```

### Use Case 2: Login Verification
```
Form Submit → RoleIs (verify role) → Conditional Branch → Show Dashboard
```

### Use Case 3: Admin-Only Actions
```
Button Click → RoleIs (check if role = "admin") → If true: db.create, If false: notify.toast (error)
```

### Use Case 4: Multi-Role Access
```
Button Click → RoleIs (check if role in ["admin", "manager"]) → Execute action
```

---

## Troubleshooting

### Issue: User not created
**Check:**
- Email and password fields are provided
- Email format is valid
- User doesn't already exist for this app

### Issue: Role check fails
**Check:**
- Required role matches user's actual role (case-sensitive after normalization)
- User has been assigned a role
- Role exists in the app

### Issue: Page access denied
**Check:**
- User has direct page access OR role-based access
- Page slug matches exactly
- User is active (`isActive: true`)

### Issue: Password reset not working
**Check:**
- New password meets minimum requirements (6+ characters)
- App owner has permission to reset passwords
- User exists in the database

---

## Best Practices

1. **Always hash passwords**: Never store plain text passwords
2. **Use role slugs**: Use consistent role naming (lowercase, hyphens)
3. **Validate inputs**: Check email format, password strength
4. **Log actions**: Track user creation, role changes, password resets
5. **Handle errors gracefully**: Show user-friendly error messages
6. **Test workflows**: Test with different roles and scenarios

---

## Integration with Other Blocks

### With db.create:
```javascript
// RoleIs sets context.appUser
context.appUser = {
  id: 123,
  email: "prince@gmail.com",
  role: "user"
}

// db.create can use it
dataToInsert = {
  ...formData,
  appUserId: context.appUser.id,
  userEmail: context.appUser.email
}
```

### With Conditional Blocks:
```javascript
// RoleIs sets context.roleCheck
context.roleCheck = {
  isValid: true,
  roleValid: true,
  pageValid: true,
  userRole: "user",
  requiredRole: "user"
}

// Conditional block can check
if (context.roleCheck.isValid) {
  // Allow action
} else {
  // Deny action
}
```

---

## Summary

The RoleIs block is a comprehensive solution for:
- ✅ User creation and credential management
- ✅ Role assignment and verification
- ✅ Page access control
- ✅ Integration with database operations
- ✅ Security (password hashing, access control)

It seamlessly integrates with your workflow to create secure, role-based applications where users can be created, authenticated, and granted appropriate access levels.

---

*Last Updated: Based on RoleIs block implementation in workflow-execution.js*

