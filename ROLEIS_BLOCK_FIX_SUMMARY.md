# RoleIs Block Enhancement - Fix Summary

## Issues Fixed

### 1. **Database Table Missing Error**
**Error**: `The table 'public.AppUser' does not exist in the current database`

**Solution**: 
- Added error handling to gracefully handle missing AppUser table
- Code now checks if table exists before attempting operations
- Provides clear warning message to run migrations

**Action Required**: Run database migrations:
```bash
cd server
npx prisma migrate dev --name add_app_user_tables
```

### 2. **PageAccess Schema Error**
**Error**: `Unknown argument 'userId'. Did you mean 'user'?`

**Root Cause**: The `PageAccess` model uses `appUserId` (for AppUsers), not `userId` (for platform Users).

**Solution**:
- Fixed query to use `appUserId` instead of `userId` for AppUsers
- Added role-based page access checking (via `RolePage` table)
- Platform users skip page access check (they don't have PageAccess records)

### 3. **UI Reorganization**
**Issue**: User was confused about why "Required Role" field appeared below custom role field.

**Solution**:
- Reorganized UI into clear sections:
  1. **User Creation Section** (Blue) - For creating new AppUsers
  2. **Role Check Section** (Green) - For checking existing user roles
  3. **Page Access Section** - For page access requirements
- Clarified field purposes:
  - "Role for New User" - Used when creating user (uses `customRole`)
  - "Required Role to Check" - Used for checking existing users (uses `requiredRole`)

---

## How It Works

### User Creation Flow

1. **When credentials are provided** (username/email + password):
   - Creates new `AppUser` record in database for the specific `appId`
   - Hashes password using bcrypt
   - Creates role if `customRole` is specified and doesn't exist
   - Assigns role to the new user via `AppUserRole` table
   - User data is saved to that app's database (appId-specific)

2. **Role Assignment Priority**:
   - If `customRole` is provided → uses `customRole`
   - Else if `requiredRole` is provided → uses `requiredRole`
   - Else defaults to `"user"`

### Role Check Flow

1. **If user was just created**:
   - Uses the created AppUser's role for validation
   - Checks role against `requiredRole` or `roles` array

2. **If no user creation**:
   - Checks platform User's role (from context or database)
   - Validates against `requiredRole` or `roles` array

### Page Access Check Flow

1. **For AppUsers**:
   - Checks direct page access (via `PageAccess` table)
   - Checks role-based page access (via `RolePage` → `AppPage`)
   - Combines both for comprehensive access check

2. **For Platform Users**:
   - Skips page access check (they don't have PageAccess records)
   - Only role check is performed

---

## Database Schema

### AppUser Model
```prisma
model AppUser {
  id         Int        @id @default(autoincrement())
  appId      Int        // Links to specific app
  email      String
  password   String?
  name       String?
  isActive   Boolean    @default(true)
  roles      AppUserRole[]
  pageAccess PageAccess[]
}
```

### AppRole Model
```prisma
model AppRole {
  id           Int           @id @default(autoincrement())
  appId        Int           // Links to specific app
  name         String
  slug         String
  description  String?
  isPredefined Boolean       @default(false)
  roleUsers    AppUserRole[]
  rolePages    RolePage[]    // Pages this role can access
}
```

### PageAccess Model
```prisma
model PageAccess {
  id        Int      @id @default(autoincrement())
  appId     Int
  appUserId Int      // Links to AppUser (NOT platform User)
  pageId    Int
  pageSlug  String
  user      AppUser  @relation(...)
}
```

---

## Login Flow (To Be Implemented)

### Current State
- AppUser creation is working
- Role assignment is working
- Page access checking is working

### Required Implementation
To enable AppUser login and page filtering:

1. **Create AppUser Login Endpoint** (`/api/app-users/:appId/login`):
   ```javascript
   POST /api/app-users/:appId/login
   Body: { email, password }
   ```

2. **Login Flow**:
   - Find AppUser by email and appId
   - Verify password with bcrypt
   - Get user's roles
   - Get user's page access (direct + role-based)
   - Return JWT token with user info

3. **Page Filtering on Frontend**:
   - On app load, check logged-in AppUser
   - Fetch user's accessible pages
   - Only show pages user has access to
   - Redirect to first accessible page

### Example Login Implementation
```javascript
// server/routes/appUsers.js
router.post("/:appId/login", async (req, res) => {
  const { appId } = req.params;
  const { email, password } = req.body;
  
  // Find AppUser
  const appUser = await prisma.appUser.findFirst({
    where: {
      appId: Number(appId),
      email: email.trim().toLowerCase(),
      isActive: true,
    },
    include: {
      roles: {
        include: { appRole: true },
      },
      pageAccess: {
        include: { page: true },
      },
    },
  });
  
  if (!appUser) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
  
  // Verify password
  const isValid = await bcrypt.compare(password, appUser.password);
  if (!isValid) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
  
  // Get accessible pages (direct + role-based)
  const directPages = appUser.pageAccess.map(pa => pa.pageSlug);
  const rolePages = [];
  
  for (const userRole of appUser.roles) {
    const rolePagesData = await prisma.rolePage.findMany({
      where: { roleId: userRole.appRoleId },
      include: { appPage: true },
    });
    rolePages.push(...rolePagesData.map(rp => rp.appPage.slug));
  }
  
  const accessiblePages = [...new Set([...directPages, ...rolePages])];
  
  // Generate token
  const token = jwt.sign(
    { appUserId: appUser.id, appId, email: appUser.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  
  res.json({
    success: true,
    token,
    user: {
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      roles: appUser.roles.map(r => r.appRole.slug),
      accessiblePages,
    },
  });
});
```

---

## UI Structure (After Reorganization)

### Section 1: Create User & Generate Credentials (Optional)
- **Username/Email**: Email or username for new user
- **Password**: Password for new user account
- **Role for New User**: Role to assign when creating (uses `customRole`)
- **Note**: Explains that user will be created for this specific appId

### Section 2: Role Check Configuration
- **Allow multiple roles**: Toggle for multi-role mode
- **Required Role to Check**: Role to validate against (uses `requiredRole`)
  - Only shown in single-role mode
  - Used for checking existing users
- **Allowed Roles**: List of roles (only shown in multi-role mode)

### Section 3: Required Page Access
- Checkboxes for pages user must have access to
- Checks both direct page access and role-based access

---

## Testing Checklist

- [ ] Run database migrations: `npx prisma migrate dev`
- [ ] Test user creation with credentials
- [ ] Test role creation (auto-create if doesn't exist)
- [ ] Test role assignment to new user
- [ ] Test role check for created user
- [ ] Test role check for platform user
- [ ] Test page access check (direct + role-based)
- [ ] Test duplicate user prevention
- [ ] Test error handling when table doesn't exist

---

## Next Steps

1. **Run Migrations**: Execute `npx prisma migrate dev` in the `server` directory
2. **Test User Creation**: Create a workflow with RoleIs block and test user creation
3. **Implement Login**: Create AppUser login endpoint and frontend integration
4. **Implement Page Filtering**: Filter pages based on user's accessible pages on app load

---

## Files Modified

1. `server/routes/workflow-execution.js`
   - Fixed `executeRoleIs` function
   - Added AppUser creation logic
   - Fixed PageAccess queries
   - Added role-based page access checking

2. `client/workflow-builder/components/workflow-node.tsx`
   - Reorganized UI sections
   - Clarified field purposes
   - Added better labels and descriptions

3. `server/routes/appUsers.js` (New)
   - Created API endpoints for AppUser management
   - Registered in `server/index.js`

---

## Important Notes

- **AppId Isolation**: Each AppUser is scoped to a specific `appId`. Users created for appId=1 are separate from users for appId=2.
- **Role Auto-Creation**: If a role doesn't exist, it will be automatically created when assigning to a user.
- **Password Security**: All passwords are hashed using bcrypt before storage.
- **Page Access**: Users can have access via:
  1. Direct assignment (PageAccess table)
  2. Role-based access (RolePage → AppPage)
  3. Both are checked and combined




