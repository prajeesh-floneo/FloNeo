# http.request Block - Step-by-Step Implementation Guide

## Table of Contents
1. [Backend Implementation](#1-backend-implementation)
2. [Frontend Configuration Panel](#2-frontend-configuration-panel)
3. [Block Registration](#3-block-registration)
4. [Testing Guide](#4-testing-guide)
5. [Example Workflows](#5-example-workflows)

---

## 1. Backend Implementation

### Step 1.1: Add executeHttpRequest Function

**File:** `server/routes/workflow-execution.js`

**Location:** Add after `executeOnLogin` function (around line 2600)

```javascript
// HttpRequest action block handler
const executeHttpRequest = async (node, context, appId, userId) => {
  try {
    console.log("🌐 [HTTP-REQUEST] Processing HTTP request for app:", appId);
    
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
      url,
      method = "GET",
      headers = [],
      bodyType = "none",
      body,
      authType = "none",
      authConfig = {},
      timeout = 30000,
      followRedirects = true,
      validateSSL = true,
      responseType = "json",
      saveResponseTo = "httpResponse"
    } = config;
    
    // Validate required fields
    if (!url || typeof url !== "string" || url.trim() === "") {
      throw new Error("URL is required for HTTP request");
    }
    
    // Security: Validate URL to prevent SSRF attacks
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      throw new Error("Invalid URL format");
    }
    
    // Block localhost and internal IPs
    const blockedHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "169.254.169.254", // AWS metadata
      "metadata.google.internal" // GCP metadata
    ];
    
    const blockedPorts = [22, 23, 25, 3306, 5432, 6379, 27017];
    
    if (blockedHosts.includes(urlObj.hostname.toLowerCase())) {
      throw new Error("Access to localhost/internal IPs is not allowed");
    }
    
    // Check for private IP ranges
    const hostname = urlObj.hostname;
    if (
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new Error("Access to private IP ranges is not allowed");
    }
    
    if (urlObj.port && blockedPorts.includes(parseInt(urlObj.port))) {
      throw new Error(`Access to port ${urlObj.port} is not allowed`);
    }
    
    // Build request headers
    const requestHeaders = {};
    
    // Add custom headers from configuration
    if (Array.isArray(headers)) {
      headers.forEach(({ key, value }) => {
        if (key && value) {
          requestHeaders[key] = value;
        }
      });
    }
    
    // Add authentication headers
    if (authType === "bearer" && authConfig.token) {
      requestHeaders["Authorization"] = `Bearer ${authConfig.token}`;
    } else if (authType === "api-key" && authConfig.apiKey) {
      const headerName = authConfig.apiKeyHeader || "X-API-Key";
      requestHeaders[headerName] = authConfig.apiKey;
    } else if (authType === "basic" && authConfig.username && authConfig.password) {
      const credentials = Buffer.from(
        `${authConfig.username}:${authConfig.password}`
      ).toString("base64");
      requestHeaders["Authorization"] = `Basic ${credentials}`;
    }
    
    // Build request body
    let requestBody = null;
    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      if (bodyType === "json" && body) {
        try {
          requestBody = typeof body === "string" ? JSON.parse(body) : body;
          requestHeaders["Content-Type"] = "application/json";
        } catch (e) {
          throw new Error("Invalid JSON in request body");
        }
      } else if (bodyType === "raw" && body) {
        requestBody = body;
        if (!requestHeaders["Content-Type"]) {
          requestHeaders["Content-Type"] = "text/plain";
        }
      }
    }
    
    console.log("🌐 [HTTP-REQUEST] Request details:", {
      url,
      method,
      headersCount: Object.keys(requestHeaders).length,
      hasBody: !!requestBody,
      timeout
    });
    
    const requestStartTime = new Date();
    
    // Make HTTP request using axios
    const axios = require("axios");
    const https = require("https");
    
    const response = await axios({
      url,
      method: method.toUpperCase(),
      headers: requestHeaders,
      data: requestBody,
      timeout,
      maxRedirects: followRedirects ? 5 : 0,
      validateStatus: () => true, // Don't throw on any status code
      httpsAgent: validateSSL
        ? undefined
        : new https.Agent({
            rejectUnauthorized: false
          }),
      maxContentLength: 10 * 1024 * 1024, // 10MB max response size
      maxBodyLength: 10 * 1024 * 1024 // 10MB max request size
    });
    
    const requestEndTime = new Date();
    const duration = requestEndTime - requestStartTime;
    
    // Determine success based on status code
    const isSuccess = response.status >= 200 && response.status < 300;
    
    console.log(`${isSuccess ? "✅" : "❌"} [HTTP-REQUEST] Response received:`, {
      statusCode: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      dataSize: JSON.stringify(response.data).length
    });
    
    // Build response object
    const responseData = {
      success: isSuccess,
      statusCode: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      timing: {
        requestSentAt: requestStartTime.toISOString(),
        responseReceivedAt: requestEndTime.toISOString(),
        duration
      }
    };
    
    // Add to context
    const updatedContext = {
      ...context,
      [saveResponseTo]: responseData
    };
    
    return {
      success: isSuccess,
      isValid: isSuccess, // For conditional branching
      message: `HTTP ${method} request completed with status ${response.status}`,
      context: updatedContext
    };
    
  } catch (error) {
    console.error("❌ [HTTP-REQUEST] Error:", error);
    
    // Determine error type
    let errorType = "UNKNOWN_ERROR";
    let errorMessage = error.message;
    
    if (error.code === "ECONNABORTED") {
      errorType = "TIMEOUT";
      errorMessage = "Request timed out";
    } else if (error.code === "ENOTFOUND") {
      errorType = "DNS_ERROR";
      errorMessage = "Could not resolve hostname";
    } else if (error.code === "ECONNREFUSED") {
      errorType = "CONNECTION_REFUSED";
      errorMessage = "Connection refused by server";
    } else if (error.code === "ETIMEDOUT") {
      errorType = "TIMEOUT";
      errorMessage = "Connection timed out";
    } else if (error.response) {
      errorType = "HTTP_ERROR";
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
    }
    
    return {
      success: false,
      isValid: false, // For conditional branching
      error: errorType,
      errorMessage,
      context: {
        ...context,
        httpResponse: {
          success: false,
          error: errorType,
          errorMessage,
          timing: {
            requestSentAt: new Date().toISOString(),
            failed: true
          }
        }
      }
    };
  }
};
```

### Step 1.2: Register the Block Handler

**File:** `server/routes/workflow-execution.js`

**Location:** In the workflow execution switch statement (around line 2920)

Find the Actions section and add:

```javascript
case "http.request":
  result = await executeHttpRequest(
    node,
    currentContext,
    appId,
    userId
  );
  break;
```

**Full context:**
```javascript
} else if (node.data.category === "Actions") {
  switch (node.data.label) {
    case "db.create":
      result = await executeDbCreate(node, currentContext, appId, userId);
      break;

    case "db.find":
      result = await executeDbFind(node, currentContext, appId, userId);
      break;

    case "db.update":
      result = await executeDbUpdate(node, currentContext, appId, userId);
      break;

    case "notify.toast":
      result = await executeNotifyToast(node, currentContext, appId, userId);
      break;

    case "page.redirect":
      result = await executePageRedirect(node, currentContext, appId, userId);
      break;

    case "page.goBack":
      result = await executePageGoBack(node, currentContext, appId, userId);
      break;

    case "auth.verify":
      result = await executeAuthVerify(node, currentContext, appId, userId);
      break;

    case "http.request":  // ← ADD THIS
      result = await executeHttpRequest(node, currentContext, appId, userId);
      break;

    default:
      console.log(`⚠️ [WF-EXEC] Unhandled action block: ${node.data.label}`);
      result = {
        success: true,
        message: `${node.data.label} executed (placeholder)`,
      };
  }
}
```

---

## 2. Frontend Configuration Panel

### Step 2.1: Add Configuration UI

**File:** `client/workflow-builder/components/workflow-node.tsx`

**Location:** In the configuration panel section (around line 400)

Add this case in the switch statement:

```typescript
case "http.request":
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700">HTTP Request Configuration</div>
      
      {/* URL Input */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          URL *
        </label>
        <input
          type="text"
          placeholder="https://api.example.com/endpoint"
          value={nodeData.url || ""}
          onChange={(e) => updateNodeData("url", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {/* Method Dropdown */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Method *
        </label>
        <select
          value={nodeData.method || "GET"}
          onChange={(e) => updateNodeData("method", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      {/* Headers */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Headers
        </label>
        {(nodeData.headers || []).map((header: any, index: number) => (
          <div key={index} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Header Name"
              value={header.key || ""}
              onChange={(e) => {
                const newHeaders = [...(nodeData.headers || [])];
                newHeaders[index] = { ...newHeaders[index], key: e.target.value };
                updateNodeData("headers", newHeaders);
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Header Value"
              value={header.value || ""}
              onChange={(e) => {
                const newHeaders = [...(nodeData.headers || [])];
                newHeaders[index] = { ...newHeaders[index], value: e.target.value };
                updateNodeData("headers", newHeaders);
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={() => {
                const newHeaders = (nodeData.headers || []).filter((_: any, i: number) => i !== index);
                updateNodeData("headers", newHeaders);
              }}
              className="px-3 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            const newHeaders = [...(nodeData.headers || []), { key: "", value: "" }];
            updateNodeData("headers", newHeaders);
          }}
          className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
        >
          + Add Header
        </button>
      </div>

      {/* Authentication Type */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Authentication
        </label>
        <select
          value={nodeData.authType || "none"}
          onChange={(e) => updateNodeData("authType", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="none">No Authentication</option>
          <option value="bearer">Bearer Token</option>
          <option value="api-key">API Key</option>
          <option value="basic">Basic Auth</option>
        </select>
      </div>

      {/* Bearer Token */}
      {nodeData.authType === "bearer" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Bearer Token *
          </label>
          <input
            type="password"
            placeholder="Enter Bearer Token"
            value={nodeData.authConfig?.token || ""}
            onChange={(e) =>
              updateNodeData("authConfig", {
                ...nodeData.authConfig,
                token: e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      )}

      {/* API Key */}
      {nodeData.authType === "api-key" && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              API Key *
            </label>
            <input
              type="password"
              placeholder="Enter API Key"
              value={nodeData.authConfig?.apiKey || ""}
              onChange={(e) =>
                updateNodeData("authConfig", {
                  ...nodeData.authConfig,
                  apiKey: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              API Key Header Name
            </label>
            <input
              type="text"
              placeholder="X-API-Key"
              value={nodeData.authConfig?.apiKeyHeader || "X-API-Key"}
              onChange={(e) =>
                updateNodeData("authConfig", {
                  ...nodeData.authConfig,
                  apiKeyHeader: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </>
      )}

      {/* Basic Auth */}
      {nodeData.authType === "basic" && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Username *
            </label>
            <input
              type="text"
              placeholder="Enter Username"
              value={nodeData.authConfig?.username || ""}
              onChange={(e) =>
                updateNodeData("authConfig", {
                  ...nodeData.authConfig,
                  username: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Password *
            </label>
            <input
              type="password"
              placeholder="Enter Password"
              value={nodeData.authConfig?.password || ""}
              onChange={(e) =>
                updateNodeData("authConfig", {
                  ...nodeData.authConfig,
                  password: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </>
      )}

      {/* Request Body (for POST/PUT/PATCH) */}
      {["POST", "PUT", "PATCH"].includes(nodeData.method) && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Body Type
            </label>
            <select
              value={nodeData.bodyType || "none"}
              onChange={(e) => updateNodeData("bodyType", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="none">No Body</option>
              <option value="json">JSON</option>
              <option value="raw">Raw Text</option>
            </select>
          </div>

          {nodeData.bodyType !== "none" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Request Body
              </label>
              <textarea
                placeholder={
                  nodeData.bodyType === "json"
                    ? '{"key": "value"}'
                    : "Enter raw text"
                }
                value={nodeData.body || ""}
                onChange={(e) => updateNodeData("body", e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              />
            </div>
          )}
        </>
      )}

      {/* Timeout */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Timeout (ms)
        </label>
        <input
          type="number"
          placeholder="30000"
          value={nodeData.timeout || 30000}
          onChange={(e) => updateNodeData("timeout", parseInt(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>

      {/* Save Response To */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Save Response To (Context Variable)
        </label>
        <input
          type="text"
          placeholder="httpResponse"
          value={nodeData.saveResponseTo || "httpResponse"}
          onChange={(e) => updateNodeData("saveResponseTo", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
      </div>
    </div>
  );
```

---

## 3. Block Registration

The http.request block is already listed in the block library (`client/workflow-builder/components/block-library.tsx`):

```typescript
{
  title: "Actions",
  color: "bg-purple-500/20 border-purple-500/30",
  textColor: "text-purple-400",
  blocks: [
    { name: "db.find", icon: Search, description: "Query rows" },
    { name: "db.create", icon: Database, description: "Insert row" },
    { name: "db.update", icon: Database, description: "Update row" },
    { name: "db.upsert", icon: Database, description: "Create/update" },
    { name: "http.request", icon: Webhook, description: "Call REST API" },  // ← Already exists
    // ...
  ],
}
```

No changes needed here!

---

## 4. Testing Guide

### Test 1: Simple GET Request

**Setup:**
1. Create button element
2. Create workflow:
   ```
   [onClick] → [http.request] → [notify.toast]
   ```

**Configuration:**
- URL: `https://jsonplaceholder.typicode.com/posts/1`
- Method: GET
- Auth: None

**Expected Result:**
- Toast shows: "HTTP GET request completed with status 200"
- Console shows response data

### Test 2: POST Request with JSON Body

**Setup:**
1. Create form with name and email fields
2. Create workflow:
   ```
   [onSubmit] → [http.request]
                   ├─ yes → [notify.toast: "Success!"]
                   └─ no → [notify.toast: "Error!"]
   ```

**Configuration:**
- URL: `https://jsonplaceholder.typicode.com/posts`
- Method: POST
- Body Type: JSON
- Body: `{"title": "{{context.formData.name}}", "body": "{{context.formData.email}}"}`
- Auth: None

**Expected Result:**
- Success toast appears
- Response contains created post with ID

### Test 3: Bearer Token Authentication

**Setup:**
1. Create button
2. Create workflow:
   ```
   [onClick] → [http.request] → [notify.toast]
   ```

**Configuration:**
- URL: `https://api.github.com/user`
- Method: GET
- Auth: Bearer Token
- Token: `your_github_token`

**Expected Result:**
- Returns GitHub user data
- Status 200

### Test 4: Error Handling (404)

**Setup:**
1. Create button
2. Create workflow:
   ```
   [onClick] → [http.request]
                 ├─ yes → [notify.toast: "Found!"]
                 └─ no → [notify.toast: "Not Found!"]
   ```

**Configuration:**
- URL: `https://jsonplaceholder.typicode.com/posts/999999`
- Method: GET

**Expected Result:**
- "Not Found!" toast appears
- Follows "no" path

---

## 5. Example Workflows

### Example 1: Weather API Integration

```
[onPageLoad] → [http.request: Get Weather]
                 ├─ yes → [element.update: Display temperature]
                 └─ no → [notify.toast: "Failed to load weather"]

Configuration:
- URL: https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY
- Method: GET
- Auth: None
- Save Response To: weatherData

Then use: {{context.weatherData.data.main.temp}}
```

### Example 2: User Registration

```
[onSubmit: Registration Form] → [http.request: Create User]
                                   ├─ yes → [page.redirect: /dashboard]
                                   └─ no → [notify.toast: "Registration failed"]

Configuration:
- URL: https://your-api.com/users
- Method: POST
- Body Type: JSON
- Body: {
    "name": "{{context.formData.name}}",
    "email": "{{context.formData.email}}",
    "password": "{{context.formData.password}}"
  }
- Auth: API Key
- API Key: your_api_key
```

### Example 3: Data Sync

```
[onClick: Sync Button] → [http.request: Fetch Data]
                           ├─ yes → [db.create: Save to local DB] → [notify.toast: "Synced!"]
                           └─ no → [notify.toast: "Sync failed"]

Configuration:
- URL: https://api.example.com/data
- Method: GET
- Auth: Bearer Token
- Token: {{context.user.token}}
- Save Response To: syncData

Then in db.create:
- Use {{context.syncData.data}} to populate database
```

---

**Implementation Complete!** 🎉

Follow these steps to implement the http.request block. Test thoroughly with the provided examples before deploying to production.

