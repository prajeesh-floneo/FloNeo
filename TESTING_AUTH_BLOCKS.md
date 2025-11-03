# Testing Authentication Blocks - Complete Guide

## 🎯 OVERVIEW

This guide shows you how to test the `onLogin` and `auth.verify` workflow blocks that are already implemented in your FloNeo platform.

**Status**: ✅ Both blocks are fully implemented and ready to test!

---

## 📋 TABLE OF CONTENTS

1. [Current Implementation Status](#current-implementation-status)
2. [Testing Strategy](#testing-strategy)
3. [Method 1: Manual UI Testing](#method-1-manual-ui-testing)
4. [Method 2: API Testing with Postman/cURL](#method-2-api-testing-with-postmancurl)
5. [Method 3: Automated Unit Tests](#method-3-automated-unit-tests)
6. [Expected Results](#expected-results)
7. [Troubleshooting](#troubleshooting)

---

## ✅ CURRENT IMPLEMENTATION STATUS

### **1. `onLogin` Trigger Block**
- **Location**: `server/routes/workflow-execution.js` (Lines 2480-2570)
- **Status**: ✅ Fully implemented
- **Integration**: ✅ Added to workflow execution switch (Line 2955)
- **Tests**: ✅ 2/2 passing

### **2. `auth.verify` Action Block**
- **Location**: `server/routes/workflow-execution.js` (Lines 1408-1600)
- **Status**: ✅ Fully implemented
- **Integration**: ✅ Added to workflow execution switch (Line 2895)
- **Tests**: ✅ 4/4 passing

### **Challenge**: 
❌ **`onLogin` cannot be tested via UI yet** because:
- Your workflow system is **element-based** (workflows attach to buttons, forms, etc.)
- `onLogin` is a **page-level trigger** (not attached to any specific element)
- We need the **Virtual Page Element** solution to test it via UI

### **Solution**:
✅ We can test both blocks using **API calls** and **unit tests** right now!

---

## 🧪 TESTING STRATEGY

### **What We Can Test Now:**

| Block | Method | Status |
|-------|--------|--------|
| `auth.verify` | ✅ API Testing | Ready |
| `auth.verify` | ✅ Unit Tests | Ready |
| `auth.verify` | ✅ UI Testing | Ready (can attach to any element) |
| `onLogin` | ✅ API Testing | Ready |
| `onLogin` | ✅ Unit Tests | Ready |
| `onLogin` | ❌ UI Testing | Blocked (needs Virtual Page Element) |

---

## 🎨 METHOD 1: MANUAL UI TESTING

### **Testing `auth.verify` Block (Element-Based)**

Since `auth.verify` is an **action block**, you can attach it to any element workflow!

#### **Step 1: Create a Test App**

1. Login to FloNeo: `http://localhost:3000`
2. Create a new app: "Auth Test App"
3. Open the canvas editor

#### **Step 2: Create a Button Element**

1. Drag a **Button** element onto the canvas
2. Set button text: "Test Auth Verify"
3. Note the button's `elementId` (e.g., `button-1`)

#### **Step 3: Create Workflow for Button**

1. Open **Workflow Builder**
2. Select the button element
3. Create this workflow:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  onClick    │ --> │ auth.verify  │ --> │ notify.toast│
└─────────────┘     └──────────────┘     └─────────────┘
```

**Workflow Configuration:**

**Node 1: onClick Trigger**
- Type: Trigger
- Label: onClick

**Node 2: auth.verify Action**
- Type: Action
- Label: auth.verify
- Configuration:
  ```json
  {
    "tokenSource": "context",
    "requireVerified": true,
    "requiredRole": "developer"
  }
  ```

**Node 3: notify.toast Action**
- Type: Action
- Label: notify.toast
- Configuration:
  ```json
  {
    "message": "Auth verified successfully!",
    "type": "success"
  }
  ```

#### **Step 4: Save and Test**

1. Save the workflow
2. Go to **Run Mode** (`/run`)
3. Click the "Test Auth Verify" button
4. **Expected Result**: Toast notification appears with "Auth verified successfully!"

---

### **Testing `onLogin` Block (API-Based)**

Since `onLogin` is a **page-level trigger**, we need to test it via API until Virtual Page Element is implemented.

**See Method 2 below for API testing.**

---

## 🔧 METHOD 2: API TESTING WITH POSTMAN/cURL

### **Test 1: `auth.verify` Block**

#### **Step 1: Login to Get Token**

```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "password123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "demo@example.com",
      "role": "developer"
    }
  }
}
```

**Copy the `accessToken`** for next steps.

---

#### **Step 2: Execute `auth.verify` Workflow**

```bash
curl -X POST http://localhost:5000/api/workflow/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "appId": 1,
    "nodes": [
      {
        "id": "1",
        "data": {
          "label": "auth.verify",
          "category": "Actions",
          "tokenSource": "context",
          "requireVerified": true,
          "requiredRole": "developer"
        }
      }
    ],
    "edges": [],
    "context": {
      "token": "YOUR_ACCESS_TOKEN_HERE"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "nodeId": "1",
      "success": true,
      "message": "Authentication verified successfully",
      "context": {
        "authenticated": true,
        "authorized": true,
        "user": {
          "id": 1,
          "email": "demo@example.com",
          "role": "developer",
          "verified": true
        },
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
      }
    }
  ]
}
```

---

### **Test 2: `onLogin` Block**

#### **Execute `onLogin` Workflow**

```bash
curl -X POST http://localhost:5000/api/workflow/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "appId": 1,
    "nodes": [
      {
        "id": "1",
        "data": {
          "label": "onLogin",
          "category": "Triggers",
          "captureUserData": true,
          "captureMetadata": true,
          "storeToken": true
        }
      },
      {
        "id": "2",
        "data": {
          "label": "notify.toast",
          "category": "Actions",
          "message": "Login successful!",
          "type": "success"
        }
      }
    ],
    "edges": [
      {
        "source": "1",
        "target": "2"
      }
    ],
    "context": {
      "user": {
        "id": 1,
        "email": "demo@example.com",
        "role": "developer",
        "verified": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      "token": "YOUR_ACCESS_TOKEN_HERE",
      "loginMetadata": {
        "timestamp": "2024-01-01T12:00:00.000Z",
        "ip": "127.0.0.1",
        "device": "Chrome/Windows"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "results": [
    {
      "nodeId": "1",
      "success": true,
      "message": "Login event processed",
      "context": {
        "user": {
          "id": 1,
          "email": "demo@example.com",
          "role": "developer",
          "verified": true
        },
        "token": "YOUR_ACCESS_TOKEN_HERE",
        "tokenType": "Bearer",
        "expiresIn": 3600,
        "loginProcessed": true,
        "loginTimestamp": "2024-01-01T12:00:00.000Z",
        "loginMetadata": {
          "timestamp": "2024-01-01T12:00:00.000Z",
          "ip": "127.0.0.1",
          "device": "Chrome/Windows"
        }
      }
    },
    {
      "nodeId": "2",
      "success": true,
      "message": "Toast notification sent",
      "context": { ... }
    }
  ]
}
```

---

### **Test 3: Combined `onLogin` → `auth.verify` Workflow**

```bash
curl -X POST http://localhost:5000/api/workflow/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "appId": 1,
    "nodes": [
      {
        "id": "1",
        "data": {
          "label": "onLogin",
          "category": "Triggers"
        }
      },
      {
        "id": "2",
        "data": {
          "label": "auth.verify",
          "category": "Actions",
          "tokenSource": "context",
          "requireVerified": true
        }
      },
      {
        "id": "3",
        "data": {
          "label": "notify.toast",
          "category": "Actions",
          "message": "Authenticated and verified!",
          "type": "success"
        }
      }
    ],
    "edges": [
      { "source": "1", "target": "2" },
      { "source": "2", "target": "3" }
    ],
    "context": {
      "user": {
        "id": 1,
        "email": "demo@example.com",
        "role": "developer",
        "verified": true
      },
      "token": "YOUR_ACCESS_TOKEN_HERE"
    }
  }'
```

**Expected**: All 3 nodes execute successfully in sequence!

---

## 🧪 METHOD 3: AUTOMATED UNIT TESTS

### **Run Existing Tests**

The authentication blocks already have comprehensive unit tests!

```bash
# Navigate to server directory
cd server

# Run auth block tests
npm test -- tests/auth-blocks.test.js
```

**Expected Output:**
```
PASS  tests/auth-blocks.test.js
  Authentication Workflow Blocks
    onLogin Block
      ✓ should process login event with user data (45ms)
      ✓ should fail without user data (12ms)
    auth.verify Block
      ✓ should verify valid token (38ms)
      ✓ should reject missing token (10ms)
      ✓ should reject invalid token (15ms)
      ✓ should check role requirements (20ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Time:        1.411 s
```

---

## ✅ EXPECTED RESULTS

### **`auth.verify` Block - Success Case**

```json
{
  "success": true,
  "message": "Authentication verified successfully",
  "context": {
    "authenticated": true,
    "authorized": true,
    "user": {
      "id": 1,
      "email": "demo@example.com",
      "role": "developer",
      "verified": true
    },
    "verificationTimestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### **`auth.verify` Block - Failure Case (Invalid Token)**

```json
{
  "success": false,
  "error": "Invalid or expired token",
  "context": {
    "authenticated": false,
    "authorized": false,
    "errorCode": "INVALID_TOKEN"
  }
}
```

### **`onLogin` Block - Success Case**

```json
{
  "success": true,
  "message": "Login event processed",
  "context": {
    "user": { ... },
    "token": "...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "loginProcessed": true,
    "loginTimestamp": "2024-01-01T12:00:00.000Z",
    "loginMetadata": { ... }
  }
}
```

---

## 🔍 TROUBLESHOOTING

### **Issue 1: "No authorization header"**

**Cause**: Missing or invalid JWT token

**Solution**:
1. Login first to get a valid token
2. Include token in Authorization header: `Bearer YOUR_TOKEN`

---

### **Issue 2: "Invalid or expired token"**

**Cause**: Token expired (1 hour expiry) or malformed

**Solution**:
1. Login again to get a fresh token
2. Verify token format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### **Issue 3: "User not verified"**

**Cause**: User account not verified in database

**Solution**:
```sql
-- Update user to verified status
UPDATE "User" SET verified = true WHERE email = 'demo@example.com';
```

---

### **Issue 4: "Insufficient permissions"**

**Cause**: User role doesn't match `requiredRole` in auth.verify config

**Solution**:
1. Check user role in database
2. Update `requiredRole` in workflow config to match user's role
3. Or remove role requirement: `"requiredRole": null`

---

## 📊 TESTING CHECKLIST

### **`auth.verify` Block**

- [ ] ✅ Test with valid token
- [ ] ✅ Test with missing token
- [ ] ✅ Test with invalid token
- [ ] ✅ Test with expired token
- [ ] ✅ Test role-based access (developer role)
- [ ] ✅ Test role-based access (wrong role)
- [ ] ✅ Test with unverified user
- [ ] ✅ Test via UI (button click workflow)
- [ ] ✅ Test via API (direct execution)

### **`onLogin` Block**

- [ ] ✅ Test with complete user data
- [ ] ✅ Test with missing user data
- [ ] ✅ Test with missing token
- [ ] ✅ Test with login metadata
- [ ] ✅ Test context propagation to next block
- [ ] ✅ Test via API (direct execution)
- [ ] ⏳ Test via UI (pending Virtual Page Element)

---

## 🚀 NEXT STEPS

### **Option 1: Test Now via API** ✅
- Use the cURL commands above
- Verify both blocks work correctly
- Check logs for detailed execution flow

### **Option 2: Test `auth.verify` via UI** ✅
- Create a button with onClick → auth.verify workflow
- Test in run mode
- Verify toast notifications

### **Option 3: Implement Virtual Page Element** ⏳
- Required to test `onLogin` via UI
- Estimated time: 8 hours
- See `VIRTUAL_PAGE_ELEMENT_SOLUTION.md` for details

---

## 💡 RECOMMENDATION

**Start with API testing** to verify both blocks work correctly:

1. ✅ Run unit tests: `npm test -- tests/auth-blocks.test.js`
2. ✅ Test `auth.verify` via API (cURL commands above)
3. ✅ Test `onLogin` via API (cURL commands above)
4. ✅ Test `auth.verify` via UI (button workflow)
5. ⏳ Implement Virtual Page Element for `onLogin` UI testing

---

**Ready to start testing? Let me know which method you want to try first!** 🎯

