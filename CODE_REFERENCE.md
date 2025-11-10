# Authentication Blocks - Code Reference

## 1. onLogin Trigger Block Handler

**Location**: `server/routes/workflow-execution.js` (Lines 2480-2570)

### Function Signature:
```javascript
const executeOnLogin = async (node, context, appId) => { ... }
```

### Input Parameters:
- `node`: Block configuration object
- `context`: Workflow context containing user and token data
- `appId`: Application ID

### Expected Context Input:
```javascript
{
  user: {
    id: number,
    email: string,
    role: string,
    verified: boolean,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  token: string,              // JWT token
  loginMetadata: {
    timestamp: string,
    ip: string,
    device: string,
    location?: string
  }
}
```

### Output Context:
```javascript
{
  success: true,
  message: "Login event processed",
  context: {
    ...previousContext,
    loginProcessed: true,
    loginTimestamp: "2025-10-23T...",
    user: { ... },
    token: "eyJhbGc...",
    loginMetadata: { ... }
  }
}
```

### Error Response:
```javascript
{
  success: false,
  error: "No user data provided in login event",
  context: context
}
```

---

## 2. auth.verify Action Block Handler

**Location**: `server/routes/workflow-execution.js` (Lines 1408-1600)

### Function Signature:
```javascript
const executeAuthVerify = async (node, context, appId, userId) => { ... }
```

### Input Parameters:
- `node`: Block configuration with token, action, requiredRole
- `context`: Workflow context containing token
- `appId`: Application ID
- `userId`: Current user ID

### Configuration Options:
```javascript
node.data = {
  label: "auth.verify",
  category: "Actions",
  action: "read",              // read, write, delete
  requiredRole: "developer",   // optional
  validateExpiration: true,    // default: true
  checkBlacklist: true         // default: true
}
```

### Success Response:
```javascript
{
  success: true,
  isAuthenticated: true,
  isAuthorized: true,
  user: {
    id: number,
    email: string,
    role: string,
    verified: boolean,
    createdAt: timestamp,
    updatedAt: timestamp
  },
  context: {
    ...previousContext,
    user: { ... },
    isAuthenticated: true,
    isAuthorized: true
  }
}
```

### Error Responses:

**No Token:**
```javascript
{
  success: false,
  isAuthenticated: false,
  isAuthorized: false,
  error: "UNAUTHORIZED",
  errorMessage: "No authentication token provided",
  errorCode: 401
}
```

**Invalid Token:**
```javascript
{
  success: false,
  isAuthenticated: false,
  isAuthorized: false,
  error: "INVALID_TOKEN",
  errorMessage: "Invalid authentication token",
  errorCode: 401
}
```

**Token Expired:**
```javascript
{
  success: false,
  isAuthenticated: false,
  isAuthorized: false,
  error: "TOKEN_EXPIRED",
  errorMessage: "Authentication token has expired",
  errorCode: 401
}
```

**Insufficient Permissions:**
```javascript
{
  success: false,
  isAuthenticated: true,
  isAuthorized: false,
  error: "INSUFFICIENT_PERMISSIONS",
  errorMessage: "User role does not match required role",
  errorCode: 403
}
```

---

## 3. Switch Case Integration

### Actions Switch (Line 2894):
```javascript
case "auth.verify":
  result = await executeAuthVerify(
    node,
    currentContext,
    appId,
    userId
  );
  break;
```

### Triggers Switch (Line 2954):
```javascript
case "onLogin":
  result = await executeOnLogin(node, currentContext, appId);
  break;
```

---

## 4. Usage Examples

### Example 1: Protected Page
```javascript
// Workflow nodes
[
  {
    id: "onPageLoad-1",
    data: { label: "onPageLoad", category: "Triggers" }
  },
  {
    id: "auth-verify-1",
    data: {
      label: "auth.verify",
      category: "Actions",
      action: "read"
    }
  },
  {
    id: "db-find-1",
    data: { label: "db.find", category: "Actions" }
  }
]

// Edges
[
  { source: "onPageLoad-1", target: "auth-verify-1", label: "next" },
  { source: "auth-verify-1", target: "db-find-1", label: "yes" }
]
```

### Example 2: Post-Login Workflow
```javascript
// Workflow nodes
[
  {
    id: "onLogin-1",
    data: {
      label: "onLogin",
      category: "Triggers",
      captureUserData: true,
      storeToken: true
    }
  },
  {
    id: "redirect-1",
    data: {
      label: "page.redirect",
      category: "Actions",
      url: "/dashboard"
    }
  }
]

// Edges
[
  { source: "onLogin-1", target: "redirect-1", label: "next" }
]
```

---

## 5. Error Codes Reference

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| UNAUTHORIZED | No token provided | 401 |
| INVALID_TOKEN | Token signature invalid | 401 |
| TOKEN_EXPIRED | Token expiration time passed | 401 |
| TOKEN_REVOKED | Token blacklisted | 401 |
| USER_NOT_FOUND | User doesn't exist | 401 |
| ACCOUNT_NOT_VERIFIED | User not verified | 403 |
| INSUFFICIENT_PERMISSIONS | Role mismatch | 403 |
| INTERNAL_ERROR | Server error | 500 |

---

## 6. Logging Output

### onLogin Logging:
```
🔐 [ON-LOGIN] Processing login event for app: 1
🔐 [ON-LOGIN] Login configuration: { captureUserData: true, ... }
🔐 [ON-LOGIN] Login event details: { userId: 1, userEmail: "user@example.com", ... }
✅ [ON-LOGIN] Login event processed successfully
```

### auth.verify Logging:
```
🔐 [AUTH-VERIFY] Processing authentication verification for app: 1
🔐 [AUTH-VERIFY] Verification configuration: { action: "read", ... }
✅ [AUTH-VERIFY] Authentication verification completed: { isAuthenticated: true, ... }
```

---

**Reference Version**: 1.0
**Last Updated**: 2025-10-23

