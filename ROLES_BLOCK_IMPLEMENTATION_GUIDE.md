# roles Block - Step-by-Step Implementation Guide

## Table of Contents
1. [Backend Implementation](#1-backend-implementation)
2. [Frontend Configuration Panel](#2-frontend-configuration-panel)
3. [Block Registration](#3-block-registration)
4. [Testing Guide](#4-testing-guide)
5. [Example Workflows](#5-example-workflows)

---

## 1. Backend Implementation

### Step 1.1: Add executeRoleIs Function

**File:** `server/routes/workflow-execution.js`

**Location:** Add after `executeHttpRequest` function

```javascript
// RoleIs condition block handler
const executeRoleIs = async (node, context, appId, userId) => {
  try {
    console.log("👤 [ROLE-IS] Processing role check for app:", appId);
    
    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }
    
    const config = node.data || {};
    const {
      requiredRole,
      checkType = "exact",
      roleHierarchy = {
        admin: 3,
        developer: 2,
        user: 1
      }
    } = config;
    
    // Validate required fields
    if (!requiredRole || typeof requiredRole !== "string" || requiredRole.trim() === "") {
      throw new Error("Required role is not specified");
    }
    
    console.log("👤 [ROLE-IS] Role check configuration:", {
      requiredRole,
      checkType,
      userId
    });
    
    // Get user from context or database
    let user = context.user;
    
    if (!user || !user.role) {
      console.log("👤 [ROLE-IS] No user in context, fetching from database");
      // Fallback: Get user from database using userId
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          verified: true
        }
      });
    }
    
    if (!user || !user.role) {
      console.warn("⚠️ [ROLE-IS] No user found in context or database");
      return {
        success: false,
        isValid: false,
        hasRole: false,
        error: "USER_NOT_FOUND",
        errorMessage: "User not found or not authenticated",
        context: {
          ...context,
          roleCheck: {
            hasRole: false,
            error: "USER_NOT_FOUND",
            errorMessage: "User not found or not authenticated"
          }
        }
      };
    }
    
    console.log("👤 [ROLE-IS] Checking role:", {
      userRole: user.role,
      requiredRole,
      checkType
    });
    
    let hasRole = false;
    let checkDetails = {};
    
    if (checkType === "exact") {
      // Exact role match
      hasRole = user.role === requiredRole;
      checkDetails = {
        checkType: "exact",
        userRole: user.role,
        requiredRole,
        match: hasRole
      };
    } else if (checkType === "minimum") {
      // Minimum role level check
      const userLevel = roleHierarchy[user.role] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;
      hasRole = userLevel >= requiredLevel;
      checkDetails = {
        checkType: "minimum",
        userRole: user.role,
        userLevel,
        requiredRole,
        requiredLevel,
        meetsMinimum: hasRole
      };
    }
    
    console.log(`${hasRole ? "✅" : "❌"} [ROLE-IS] Role check result:`, {
      hasRole,
      userRole: user.role,
      requiredRole,
      checkType
    });
    
    return {
      success: true,
      isValid: hasRole, // For conditional branching (yes/no paths)
      hasRole,
      message: hasRole
        ? `User has required role: ${requiredRole}`
        : `User does not have required role: ${requiredRole}`,
      context: {
        ...context,
        roleCheck: {
          hasRole,
          userRole: user.role,
          requiredRole,
          checkType,
          authorized: hasRole,
          checkDetails,
          checkedAt: new Date().toISOString()
        }
      }
    };
    
  } catch (error) {
    console.error("❌ [ROLE-IS] Error:", error);
    return {
      success: false,
      isValid: false,
      hasRole: false,
      error: "ROLE_CHECK_ERROR",
      errorMessage: error.message,
      context: {
        ...context,
        roleCheck: {
          hasRole: false,
          error: "ROLE_CHECK_ERROR",
          errorMessage: error.message
        }
      }
    };
  }
};
```

### Step 1.2: Register the Block Handler

**File:** `server/routes/workflow-execution.js`

**Location:** In the workflow execution switch statement (around line 2950)

Find the Conditions section and add:

```javascript
case "roleIs":
  result = await executeRoleIs(node, currentContext, appId, userId);
  break;
```

**Full context:**
```javascript
} else if (node.data.category === "Conditions") {
  switch (node.data.label) {
    case "isFilled":
      result = await executeIsFilled(node, currentContext, appId, userId);
      break;

    case "dateValid":
      result = await executeDateValid(node, currentContext, appId, userId);
      break;

    case "match":
      result = await executeMatch(node, currentContext, appId, userId);
      break;

    case "roleIs":  // ← ADD THIS
      result = await executeRoleIs(node, currentContext, appId, userId);
      break;

    default:
      console.log(
        `⚠️ [WF-EXEC] Unhandled condition block: ${node.data.label}`
      );
      result = {
        success: true,
        message: `${node.data.label} checked (placeholder)`,
      };
  }
}
```

---

## 2. Frontend Configuration Panel

### Step 2.1: Add Configuration UI

**File:** `client/workflow-builder/components/workflow-node.tsx`

**Location:** In the configuration panel section

Add this case in the switch statement:

```typescript
case "roleIs":
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700">Role Check Configuration</div>
      
      {/* Required Role Dropdown */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Required Role *
        </label>
        <select
          value={nodeData.requiredRole || ""}
          onChange={(e) => updateNodeData("requiredRole", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">Select Role</option>
          <option value="admin">Admin</option>
          <option value="developer">Developer</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Check Type */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Check Type
        </label>
        <select
          value={nodeData.checkType || "exact"}
          onChange={(e) => updateNodeData("checkType", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="exact">Exact Match</option>
          <option value="minimum">Minimum Level</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {nodeData.checkType === "exact"
            ? "User must have exactly this role"
            : "User must have this role or higher (admin > developer > user)"}
        </p>
      </div>

      {/* Role Hierarchy Info */}
      {nodeData.checkType === "minimum" && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="text-xs font-medium text-blue-800 mb-2">
            Role Hierarchy:
          </div>
          <div className="text-xs text-blue-700 space-y-1">
            <div>• Admin (Level 3) - Highest permissions</div>
            <div>• Developer (Level 2) - Medium permissions</div>
            <div>• User (Level 1) - Basic permissions</div>
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
        <div className="text-xs font-medium text-gray-700 mb-1">
          How it works:
        </div>
        <div className="text-xs text-gray-600">
          This block checks if the current user has the required role.
          Connect the <span className="text-green-600 font-medium">YES</span> path
          for authorized users and the{" "}
          <span className="text-red-600 font-medium">NO</span> path for
          unauthorized users.
        </div>
      </div>
    </div>
  );
```

---

## 3. Block Registration

The roleIs block is already listed in the block library (`client/workflow-builder/components/block-library.tsx`):

```typescript
{
  title: "Conditions",
  color: "bg-green-500/20 border-green-500/30",
  textColor: "text-green-400",
  blocks: [
    { name: "isFilled", icon: CheckCircle, description: "Required fields" },
    { name: "dateValid", icon: Calendar, description: "Date range" },
    { name: "match", icon: Search, description: "Compare values" },
    { name: "inList", icon: CheckSquare, description: "Enum check" },
    { name: "roleIs", icon: Users, description: "User role" },  // ← Already exists
    // ...
  ],
}
```

No changes needed here!

---

## 4. Testing Guide

### Test 1: Exact Role Match (Admin Only)

**Setup:**
1. Create a page with a button labeled "Admin Panel"
2. Create workflow:
   ```
   [onClick] → [roleIs: admin]
                 ├─ yes → [notify.toast: "Welcome Admin!"]
                 └─ no → [notify.toast: "Access Denied"]
   ```

**Configuration:**
- Required Role: admin
- Check Type: Exact Match

**Test Cases:**
- Login as admin → Click button → ✅ "Welcome Admin!" toast
- Login as developer → Click button → ❌ "Access Denied" toast
- Login as user → Click button → ❌ "Access Denied" toast

### Test 2: Minimum Role Level (Developer or Higher)

**Setup:**
1. Create a page with a button labeled "Developer Tools"
2. Create workflow:
   ```
   [onClick] → [roleIs: developer]
                 ├─ yes → [page.redirect: /dev-tools]
                 └─ no → [page.redirect: /home]
   ```

**Configuration:**
- Required Role: developer
- Check Type: Minimum Level

**Test Cases:**
- Login as admin → Click button → ✅ Redirects to /dev-tools (admin >= developer)
- Login as developer → Click button → ✅ Redirects to /dev-tools (exact match)
- Login as user → Click button → ❌ Redirects to /home (user < developer)

### Test 3: Page Load Protection

**Setup:**
1. Create an admin dashboard page
2. Create workflow:
   ```
   [onPageLoad] → [roleIs: admin]
                    ├─ yes → [db.find: admin data] → [display dashboard]
                    └─ no → [page.redirect: /unauthorized]
   ```

**Configuration:**
- Required Role: admin
- Check Type: Exact Match

**Test Cases:**
- Login as admin → Navigate to page → ✅ Dashboard loads
- Login as developer → Navigate to page → ❌ Redirects to /unauthorized
- Not logged in → Navigate to page → ❌ Redirects to /unauthorized

### Test 4: Combined with onLogin

**Setup:**
1. Create workflow:
   ```
   [onLogin] → [roleIs: admin]
                 ├─ yes → [page.redirect: /admin-dashboard]
                 └─ no → [page.redirect: /user-dashboard]
   ```

**Configuration:**
- Required Role: admin
- Check Type: Exact Match

**Test Cases:**
- Login as admin → ✅ Redirects to /admin-dashboard
- Login as developer → ❌ Redirects to /user-dashboard
- Login as user → ❌ Redirects to /user-dashboard

---

## 5. Example Workflows

### Example 1: Admin Panel Access Control

```
[onPageLoad: Admin Page] → [roleIs: admin]
                             ├─ yes → [db.find: all users] → [display user list]
                             └─ no → [page.redirect: /home] → [notify.toast: "Admin access required"]

Configuration:
- Required Role: admin
- Check Type: Exact Match

Purpose: Protect admin pages from non-admin users
```

### Example 2: Premium Feature Unlock

```
[onClick: "Unlock Premium Feature"] → [roleIs: premium]
                                        ├─ yes → [notify.toast: "Feature unlocked!"] → [element.update: show feature]
                                        └─ no → [page.redirect: /upgrade] → [notify.toast: "Upgrade to premium"]

Configuration:
- Required Role: premium
- Check Type: Exact Match

Purpose: Gate premium features behind subscription
```

### Example 3: Role-Based Data Access

```
[onSubmit: Create Record] → [roleIs: developer]
                              ├─ yes → [db.create: with admin fields]
                              └─ no → [db.create: with limited fields]

Configuration:
- Required Role: developer
- Check Type: Minimum Level

Purpose: Allow developers and admins to create records with additional fields
```

### Example 4: Multi-Level Access Control

```
[onClick: "View Reports"] → [roleIs: developer]
                              ├─ yes → [db.find: all reports] → [display all reports]
                              └─ no → [roleIs: user]
                                       ├─ yes → [db.find: user reports] → [display user reports]
                                       └─ no → [notify.toast: "Login required"]

Configuration (First roleIs):
- Required Role: developer
- Check Type: Minimum Level

Configuration (Second roleIs):
- Required Role: user
- Check Type: Minimum Level

Purpose: Show different data based on user role level
```

### Example 5: Login Redirect Based on Role

```
[onLogin] → [roleIs: admin]
              ├─ yes → [page.redirect: /admin-dashboard]
              └─ no → [roleIs: developer]
                       ├─ yes → [page.redirect: /developer-dashboard]
                       └─ no → [page.redirect: /user-dashboard]

Configuration (First roleIs):
- Required Role: admin
- Check Type: Exact Match

Configuration (Second roleIs):
- Required Role: developer
- Check Type: Exact Match

Purpose: Redirect users to role-specific dashboards after login
```

---

## 6. Advanced Use Cases

### Use Case 1: Role-Based UI Elements

**Scenario:** Show/hide UI elements based on user role

**Workflow:**
```
[onPageLoad] → [roleIs: admin]
                 ├─ yes → [element.update: show admin buttons]
                 └─ no → [element.update: hide admin buttons]
```

**Implementation:**
1. Create hidden admin buttons on the page
2. Use element.update to set visibility based on role check

### Use Case 2: Audit Logging for Admin Actions

**Scenario:** Log all admin actions for security audit

**Workflow:**
```
[onClick: Delete User] → [roleIs: admin]
                           ├─ yes → [db.create: audit log] → [db.delete: user] → [notify.toast: "User deleted"]
                           └─ no → [notify.toast: "Unauthorized"]
```

**Implementation:**
1. Check if user is admin
2. If yes, log the action before performing it
3. If no, deny access

### Use Case 3: Dynamic Form Fields

**Scenario:** Show additional form fields for developers

**Workflow:**
```
[onPageLoad: Form Page] → [roleIs: developer]
                            ├─ yes → [element.update: show advanced fields]
                            └─ no → [element.update: hide advanced fields]
```

**Implementation:**
1. Create form with basic and advanced fields
2. Hide advanced fields by default
3. Show them only for developers

---

## 7. Security Best Practices

### 1. Always Check Roles on Backend
- Never rely solely on frontend role checks
- Backend validation is mandatory for security
- Frontend checks are for UX only

### 2. Use Minimum Level for Hierarchical Permissions
- Use "minimum" check type when higher roles should have access
- Example: Admin should access developer features

### 3. Combine with auth.verify
- Always verify authentication before checking roles
- Example workflow:
  ```
  [onPageLoad] → [auth.verify] → [roleIs] → [protected content]
  ```

### 4. Log Role Check Failures
- Track unauthorized access attempts
- Use db.create to log failed role checks
- Monitor for suspicious activity

### 5. Provide Clear Error Messages
- Tell users why access was denied
- Redirect to appropriate pages
- Offer upgrade/contact options

---

## 8. Troubleshooting

### Issue: Role check always fails

**Solutions:**
1. Check if user is logged in (use auth.verify first)
2. Verify user.role exists in context
3. Check database for user role value
4. Ensure role name matches exactly (case-sensitive)

### Issue: Minimum level check not working

**Solutions:**
1. Verify roleHierarchy is configured correctly
2. Check that role names match hierarchy keys
3. Ensure checkType is set to "minimum"

### Issue: Role check works in workflow builder but not in run mode

**Solutions:**
1. Ensure workflow is saved
2. Check that user is authenticated in run mode
3. Verify userId is passed to workflow execution
4. Check browser console for errors

---

**Implementation Complete!** 🎉

The roleIs block is now ready to use for role-based access control in your workflows. Test thoroughly with different user roles before deploying to production.

