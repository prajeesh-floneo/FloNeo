# Roles Block - Complete Testing Guide

## ✅ Implementation Status

The roleIs block has been successfully implemented with:
- ✅ Backend handler: `executeRoleIs` function in `server/routes/workflow-execution.js`
- ✅ Frontend configuration panel in `client/workflow-builder/components/workflow-node.tsx`
- ✅ Registered in Conditions switch statement
- ✅ Support for single role and multiple roles checking
- ✅ User role retrieval from context or database
- ✅ Conditional branching (yes/no paths)
- ✅ Error handling and validation

---

## 🧪 Test Cases

### Test 1: Single Role Check - Admin User

**Objective**: Verify single role checking for admin users

**Setup**:
1. Create a button element
2. Create workflow: `[onClick] → [roleIs] → [notify.toast]`
3. Configure roleIs to check for "admin" role

**Configuration**:
- **Check Mode**: Single Role
- **Required Role**: `admin`

**Expected Result**:
- ✅ If user has "admin" role: follows "yes" path
- ✅ Toast shows: "User has required role: admin"
- ✅ Console logs: `👤 [ROLE-IS] Checking if user role "admin" equals "admin": true`

**Verification**:
```javascript
context.roleCheckResult = {
  userRole: "admin",
  isValid: true,
  requiredRole: "admin",
  roles: []
}
```

---

### Test 2: Single Role Check - Non-Admin User

**Objective**: Verify single role checking rejects non-matching roles

**Setup**:
1. Create a button element
2. Create workflow:
```
[onClick] → [roleIs]
  ├─ yes → [notify.toast: "Access Granted"]
  └─ no → [notify.toast: "Access Denied"]
```

**Configuration**:
- **Check Mode**: Single Role
- **Required Role**: `admin`

**Expected Result**:
- ✅ If user has "user" role: follows "no" path
- ✅ Toast shows: "Access Denied"
- ✅ Console logs: `👤 [ROLE-IS] Checking if user role "user" equals "admin": false`

---

### Test 3: Multiple Roles Check - Any Match

**Objective**: Verify multiple roles checking with any match

**Setup**:
1. Create a button element
2. Create workflow: `[onClick] → [roleIs] → [notify.toast]`

**Configuration**:
- **Check Mode**: Multiple Roles (Any Match)
- **Allowed Roles**: `admin`, `manager`, `moderator`

**Expected Result**:
- ✅ If user has "manager" role: follows "yes" path
- ✅ Toast shows: "User has required role: manager"
- ✅ Console logs: `👤 [ROLE-IS] Checking if user role "manager" is in [admin, manager, moderator]: true`

---

### Test 4: Multiple Roles Check - No Match

**Objective**: Verify multiple roles checking rejects non-matching roles

**Setup**:
1. Create a button element
2. Create workflow:
```
[onClick] → [roleIs]
  ├─ yes → [notify.toast: "Authorized"]
  └─ no → [notify.toast: "Not Authorized"]
```

**Configuration**:
- **Check Mode**: Multiple Roles (Any Match)
- **Allowed Roles**: `admin`, `manager`

**Expected Result**:
- ✅ If user has "guest" role: follows "no" path
- ✅ Toast shows: "Not Authorized"
- ✅ Console logs: `👤 [ROLE-IS] Checking if user role "guest" is in [admin, manager]: false`

---

### Test 5: Role Check with onLogin Trigger

**Objective**: Verify role checking works with onLogin trigger

**Setup**:
1. Create workflow on page load:
```
[onLogin] → [roleIs]
  ├─ yes → [notify.toast: "Admin logged in"]
  └─ no → [notify.toast: "User logged in"]
```

**Configuration**:
- **Check Mode**: Single Role
- **Required Role**: `admin`

**Expected Result**:
- ✅ When admin logs in: shows "Admin logged in"
- ✅ When regular user logs in: shows "User logged in"
- ✅ User role is captured from onLogin context

---

### Test 6: Role Check with auth.verify

**Objective**: Verify role checking works after auth.verify

**Setup**:
1. Create workflow:
```
[onClick] → [auth.verify] → [roleIs]
  ├─ yes → [notify.toast: "Verified Admin"]
  └─ no → [notify.toast: "Not Admin"]
```

**Configuration**:
- **auth.verify**: Check token validity
- **roleIs**: Check for "admin" role

**Expected Result**:
- ✅ Token is verified first
- ✅ Then role is checked
- ✅ User role is available in context from auth.verify

---

### Test 7: Role Check with Database Query

**Objective**: Verify role checking works with database queries

**Setup**:
1. Create workflow:
```
[onClick] → [db.find] → [roleIs]
  ├─ yes → [notify.toast: "Admin can view"]
  └─ no → [notify.toast: "User cannot view"]
```

**Configuration**:
- **db.find**: Query user data
- **roleIs**: Check for "admin" role

**Expected Result**:
- ✅ Database query executes first
- ✅ Role check uses user data from context
- ✅ Conditional branching works correctly

---

### Test 8: Role Check - No User Role Found

**Objective**: Verify error handling when user role is not found

**Setup**:
1. Create a button element
2. Create workflow: `[onClick] → [roleIs] → [notify.toast]`

**Configuration**:
- **Check Mode**: Single Role
- **Required Role**: `admin`

**Expected Result**:
- ✅ Request fails gracefully
- ✅ `isValid` returns false
- ✅ Console logs: `👤 [ROLE-IS] No user role found`
- ✅ Error message: "User role not found"

---

### Test 9: Role Check - Missing Configuration

**Objective**: Verify error handling for missing configuration

**Setup**:
1. Create a button element
2. Create workflow: `[onClick] → [roleIs] → [notify.toast]`

**Configuration**:
- **Check Mode**: Single Role
- **Required Role**: (empty)

**Expected Result**:
- ✅ Request fails with error
- ✅ Error message: "No role configuration provided"
- ✅ `isValid` returns false

---

### Test 10: Role Check - Case Sensitivity

**Objective**: Verify role checking is case-sensitive

**Setup**:
1. Create a button element
2. Create workflow: `[onClick] → [roleIs] → [notify.toast]`

**Configuration**:
- **Check Mode**: Single Role
- **Required Role**: `Admin` (capital A)

**Expected Result**:
- ✅ If user has "admin" role (lowercase): follows "no" path
- ✅ Role checking is case-sensitive
- ✅ "Admin" ≠ "admin"

---

## 🔍 Debugging Tips

### Check Console Logs
Look for these log patterns:
- `👤 [ROLE-IS] Processing role check for app: X`
- `👤 [ROLE-IS] User role from context: admin`
- `👤 [ROLE-IS] User role from database: admin`
- `👤 [ROLE-IS] Checking if user role "admin" equals "admin": true`
- `❌ [ROLE-IS] Error: ...`

### Verify Context
After roleIs block, check context in next block:
```javascript
console.log("Role Check Result:", context.roleCheckResult);
```

### Check User Role Source
- From context: `context.user.role` (set by onLogin or auth.verify)
- From database: Fetched using userId

### Test with Different Roles
Create test users with different roles:
- admin
- manager
- user
- guest

---

## ✅ Success Criteria

All tests should pass:
- ✅ Single role checking works correctly
- ✅ Multiple roles checking works correctly
- ✅ Role checking works with onLogin trigger
- ✅ Role checking works with auth.verify
- ✅ Role checking works with database queries
- ✅ Error handling works for missing roles
- ✅ Error handling works for missing configuration
- ✅ Role checking is case-sensitive
- ✅ Conditional branching works (yes/no paths)
- ✅ Context is properly updated with role check result
- ✅ Existing workflow blocks are not affected

---

## 🚀 Next Steps

1. Run all test cases above
2. Verify console logs match expected patterns
3. Check that context is properly updated
4. Test with real user data
5. Verify integration with existing blocks

---

**Roles Block Implementation Complete!** ✅

