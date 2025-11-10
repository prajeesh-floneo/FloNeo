# HTTP Request Block - Complete Testing Guide

## ✅ Implementation Status

The http.request block has been successfully implemented with:
- ✅ Backend handler: `executeHttpRequest` function in `server/routes/workflow-execution.js`
- ✅ Frontend configuration panel in `client/workflow-builder/components/workflow-node.tsx`
- ✅ Registered in Actions switch statement
- ✅ SSRF prevention and security measures
- ✅ Support for multiple authentication types
- ✅ Error handling and timeout management
- ✅ Context passing for response data

---

## 🧪 Test Cases

### Test 1: Simple GET Request (Public API)

**Objective**: Verify basic GET request functionality

**Setup**:
1. Create a new button element on a page
2. Create a workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `https://jsonplaceholder.typicode.com/posts/1`
- **Method**: GET
- **Authentication**: None
- **Timeout**: 30000ms

**Expected Result**:
- ✅ Request completes successfully
- ✅ Status code: 200
- ✅ Response contains post data with id, title, body, etc.
- ✅ Toast notification shows: "HTTP GET request completed with status 200"
- ✅ Console logs show: `✅ [HTTP-REQUEST] Response received: {statusCode: 200, ...}`

**Verification**:
```javascript
// Check context in next block
context.httpResponse = {
  success: true,
  statusCode: 200,
  data: { id: 1, title: "...", body: "...", ... },
  timing: { duration: ~100-500ms }
}
```

---

### Test 2: POST Request with JSON Body

**Objective**: Verify POST request with JSON body

**Setup**:
1. Create a form with name and email fields
2. Create workflow: `[onSubmit] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `https://jsonplaceholder.typicode.com/posts`
- **Method**: POST
- **Body Type**: JSON
- **Body**: 
```json
{
  "title": "{{context.formData.name}}",
  "body": "{{context.formData.email}}",
  "userId": 1
}
```
- **Authentication**: None

**Expected Result**:
- ✅ Request completes successfully
- ✅ Status code: 201 (Created)
- ✅ Response contains created post with ID
- ✅ Toast shows: "HTTP POST request completed with status 201"

**Verification**:
```javascript
context.httpResponse.data = {
  title: "John Doe",
  body: "john@example.com",
  userId: 1,
  id: 101  // Generated ID
}
```

---

### Test 3: Bearer Token Authentication

**Objective**: Verify Bearer token authentication

**Setup**:
1. Create a button
2. Create workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `https://api.github.com/user`
- **Method**: GET
- **Authentication**: Bearer Token
- **Token**: `ghp_YOUR_GITHUB_TOKEN` (replace with real token)

**Expected Result**:
- ✅ Request completes successfully
- ✅ Status code: 200
- ✅ Response contains GitHub user data
- ✅ Authorization header properly set

**Verification**:
```javascript
context.httpResponse.data = {
  login: "username",
  id: 12345,
  avatar_url: "...",
  ...
}
```

---

### Test 4: API Key Authentication

**Objective**: Verify API Key authentication

**Setup**:
1. Create a button
2. Create workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `https://api.example.com/data`
- **Method**: GET
- **Authentication**: API Key
- **API Key**: `your_api_key_here`
- **API Key Header Name**: `X-API-Key`

**Expected Result**:
- ✅ Request completes successfully
- ✅ Custom header `X-API-Key` is sent
- ✅ Response received from API

---

### Test 5: Basic Authentication

**Objective**: Verify Basic authentication

**Setup**:
1. Create a button
2. Create workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `https://httpbin.org/basic-auth/user/passwd`
- **Method**: GET
- **Authentication**: Basic Auth
- **Username**: `user`
- **Password**: `passwd`

**Expected Result**:
- ✅ Request completes successfully
- ✅ Status code: 200
- ✅ Authorization header contains Base64-encoded credentials

---

### Test 6: Error Handling (404 Not Found)

**Objective**: Verify error handling for 404 responses

**Setup**:
1. Create a button
2. Create workflow:
```
[onClick] → [http.request]
  ├─ yes → [notify.toast: "Found!"]
  └─ no → [notify.toast: "Not Found!"]
```

**Configuration**:
- **URL**: `https://jsonplaceholder.typicode.com/posts/999999`
- **Method**: GET

**Expected Result**:
- ✅ Request completes with status 404
- ✅ `isValid` returns false (follows "no" path)
- ✅ Toast shows: "Not Found!"
- ✅ Console logs: `❌ [HTTP-REQUEST] Response received: {statusCode: 404, ...}`

---

### Test 7: SSRF Prevention (Localhost Blocked)

**Objective**: Verify SSRF prevention

**Setup**:
1. Create a button
2. Create workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `http://localhost:5000/api/apps`
- **Method**: GET

**Expected Result**:
- ✅ Request fails with error
- ✅ Error message: "Access to localhost/internal IPs is not allowed"
- ✅ Console logs: `❌ [HTTP-REQUEST] Error: Access to localhost/internal IPs is not allowed`
- ✅ `isValid` returns false

---

### Test 8: SSRF Prevention (Private IP Blocked)

**Objective**: Verify private IP range blocking

**Setup**:
1. Create a button
2. Create workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `http://192.168.1.1/admin`
- **Method**: GET

**Expected Result**:
- ✅ Request fails with error
- ✅ Error message: "Access to private IP ranges is not allowed"
- ✅ `isValid` returns false

---

### Test 9: Timeout Handling

**Objective**: Verify timeout handling

**Setup**:
1. Create a button
2. Create workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `https://httpbin.org/delay/10` (10 second delay)
- **Method**: GET
- **Timeout**: 2000ms (2 seconds)

**Expected Result**:
- ✅ Request times out after 2 seconds
- ✅ Error type: "TIMEOUT"
- ✅ Error message: "Request timed out"
- ✅ `isValid` returns false

---

### Test 10: Custom Headers

**Objective**: Verify custom headers are sent

**Setup**:
1. Create a button
2. Create workflow: `[onClick] → [http.request] → [notify.toast]`

**Configuration**:
- **URL**: `https://httpbin.org/headers`
- **Method**: GET
- **Headers**:
  - Key: `X-Custom-Header`
  - Value: `CustomValue`
  - Key: `X-Another-Header`
  - Value: `AnotherValue`

**Expected Result**:
- ✅ Request completes successfully
- ✅ Response shows custom headers were received
- ✅ Console logs show headers count

---

## 🔍 Debugging Tips

### Check Console Logs
Look for these log patterns:
- `🌐 [HTTP-REQUEST] Processing HTTP request for app: X`
- `🌐 [HTTP-REQUEST] Request details: {...}`
- `✅ [HTTP-REQUEST] Response received: {...}`
- `❌ [HTTP-REQUEST] Error: ...`

### Verify Context
After http.request block, check context in next block:
```javascript
console.log("HTTP Response:", context.httpResponse);
```

### Check Network Tab
In browser DevTools, check if requests are being made to `/api/workflow/execute`

### Verify SSRF Prevention
Test with these URLs (should all fail):
- `http://localhost:3000`
- `http://127.0.0.1:8000`
- `http://192.168.1.1`
- `http://10.0.0.1`
- `http://169.254.169.254` (AWS metadata)

---

## ✅ Success Criteria

All tests should pass:
- ✅ GET requests work correctly
- ✅ POST requests with JSON body work
- ✅ All authentication types work (Bearer, API Key, Basic)
- ✅ Error responses (4xx, 5xx) are handled correctly
- ✅ Conditional branching works (yes/no paths)
- ✅ SSRF prevention blocks dangerous URLs
- ✅ Timeouts are respected
- ✅ Custom headers are sent
- ✅ Response data is available in context
- ✅ Existing workflow blocks are not affected

---

## 🚀 Next Steps

1. Run all test cases above
2. Verify console logs match expected patterns
3. Check that context is properly updated
4. Test with real APIs if available
5. Proceed to roles block implementation

---

**HTTP Request Block Implementation Complete!** ✅

