# 8 Pending Workflow Blocks - Comprehensive Implementation Plan

## 📋 Executive Summary

This document provides a complete implementation plan for 8 pending workflow blocks in the FloNeo application. The blocks are categorized into **Triggers** (3), **Conditions** (2), and **Actions** (3).

**Implementation Priority:**
1. **Phase 1 (Simple)**: db.upsert, email.send
2. **Phase 2 (Medium)**: switch, expr, ui.openModal
3. **Phase 3 (Complex)**: onRecordCreate, onRecordUpdate, onSchedule

---

## 🎯 Block Overview & Validation

### ✅ Triggers (3 blocks)

| Block | Description | Complexity | Dependencies |
|-------|-------------|------------|--------------|
| **onRecordCreate** | Executes when a new database record is created | Complex | Database triggers, event system |
| **onRecordUpdate** | Executes when an existing record is modified | Complex | Database triggers, event system |
| **onSchedule** | Executes at scheduled intervals (cron-like) | Complex | Job scheduler, cron parser |

### ✅ Conditions (2 blocks)

| Block | Description | Complexity | Dependencies |
|-------|-------------|------------|--------------|
| **switch** | Multiple conditional branches (case/default) | Medium | Edge routing system |
| **expr** | Advanced logical/mathematical expressions | Medium | Expression parser, sandbox |

### ✅ Actions (3 blocks)

| Block | Description | Complexity | Dependencies |
|-------|-------------|------------|--------------|
| **db.upsert** | Update or insert database record | Simple | Existing db.create, db.update |
| **ui.openModal** | Opens a modal dialog on screen | Medium | Frontend modal system, Socket.io |
| **email.send** | Sends emails with templates | Simple | Existing EmailService |

---

## 📊 Implementation Priority & Rationale

### Phase 1: Quick Wins (1-2 days)
**Blocks**: db.upsert, email.send

**Rationale:**
- Both leverage existing infrastructure
- db.upsert combines db.create + db.update logic
- email.send uses existing EmailService
- High value, low complexity
- No new dependencies required

### Phase 2: Medium Complexity (3-5 days)
**Blocks**: switch, expr, ui.openModal

**Rationale:**
- switch requires multi-branch routing (different from yes/no)
- expr requires safe expression evaluation
- ui.openModal requires frontend-backend coordination
- Moderate complexity, moderate value

### Phase 3: Complex Features (5-7 days)
**Blocks**: onRecordCreate, onRecordUpdate, onSchedule

**Rationale:**
- Requires database triggers or polling mechanism
- onSchedule needs job scheduler (node-cron or similar)
- High complexity, high value
- Requires new infrastructure

---

## 🔧 Technical Architecture Analysis

### Current Workflow System

**Trigger Execution Flow:**
```
User Action → Frontend detects event → Lookup workflow in index
→ Send nodes + edges + context to backend → Execute sequentially
→ Return results → Frontend processes (toasts, redirects, etc.)
```

**Context Passing:**
```javascript
{
  ...context,
  formData: { field1: value1, ... },
  user: { id, email, role },
  dbFindResults: [...],
  httpResponse: { data, statusCode },
  roleCheckResult: { userRole, isValid }
}
```

**Conditional Branching:**
```javascript
// Current system (yes/no only)
const conditionResult = result?.isValid || result?.isFilled || false;
const connectorLabel = conditionResult ? "yes" : "no";
const edgeKey = `${node.id}:${connectorLabel}`;
const nextNodeId = edgeMap[edgeKey];
```

**Challenge for switch block**: Need to support multiple branches (case1, case2, case3, default)

---

## 📦 Detailed Block Specifications

### 1. db.upsert (Action Block)

**Purpose**: Update record if exists, insert if doesn't exist

**Configuration Options:**
- `tableName` (string, required): Target table
- `uniqueFields` (array, required): Fields to check for existence (e.g., ["email"])
- `updateData` (object, required): Data to update if record exists
- `insertData` (object, required): Data to insert if record doesn't exist
- `returnRecord` (boolean, default: true): Return the upserted record

**Backend Implementation:**
```javascript
const executeDbUpsert = async (node, context, appId, userId) => {
  // 1. Validate app access
  // 2. Extract configuration
  // 3. Build WHERE clause using uniqueFields
  // 4. Check if record exists (db.find logic)
  // 5. If exists: execute db.update
  // 6. If not exists: execute db.create
  // 7. Return upserted record in context
};
```

**Context Output:**
```javascript
{
  ...context,
  dbUpsertResult: {
    operation: "update" | "insert",
    record: { id, ...fields },
    tableName: "users"
  }
}
```

**Complexity**: ⭐ Simple (reuses existing db.create and db.update logic)

**Estimated Time**: 2-3 hours

---

### 2. email.send (Action Block)

**Purpose**: Send emails using preconfigured templates or custom parameters

**Configuration Options:**
- `to` (string, required): Recipient email (supports context variables)
- `subject` (string, required): Email subject
- `body` (string, required): Email body (HTML or plain text)
- `bodyType` (enum: "html" | "text", default: "html")
- `from` (string, optional): Sender email (defaults to SMTP_USER)
- `cc` (array, optional): CC recipients
- `bcc` (array, optional): BCC recipients
- `attachments` (array, optional): File attachments
- `template` (string, optional): Predefined template name
- `templateVars` (object, optional): Variables for template substitution

**Backend Implementation:**
```javascript
const executeEmailSend = async (node, context, appId, userId) => {
  // 1. Validate app access
  // 2. Extract configuration
  // 3. Substitute context variables in to, subject, body
  // 4. If template specified, load and render template
  // 5. Use existing EmailService to send
  // 6. Return send result in context
};
```

**Context Output:**
```javascript
{
  ...context,
  emailSendResult: {
    success: true,
    messageId: "abc123",
    to: "user@example.com",
    subject: "Welcome!",
    sentAt: "2024-01-01T12:00:00Z"
  }
}
```

**Security Considerations:**
- Rate limiting (max 10 emails per minute per user)
- Validate email addresses
- Sanitize HTML content
- Prevent email injection attacks
- Check SMTP configuration

**Complexity**: ⭐ Simple (uses existing EmailService)

**Estimated Time**: 3-4 hours

---

### 3. switch (Condition Block)

**Purpose**: Evaluate multiple conditional branches (like switch/case statement)

**Configuration Options:**
- `variable` (string, required): Variable to evaluate (e.g., "{{context.user.role}}")
- `cases` (array, required): Array of case objects
  - `value` (string): Value to match
  - `label` (string): Connector label (e.g., "admin", "user", "guest")
- `defaultCase` (boolean, default: true): Include default case

**Example Configuration:**
```javascript
{
  variable: "{{context.user.role}}",
  cases: [
    { value: "admin", label: "admin" },
    { value: "manager", label: "manager" },
    { value: "user", label: "user" }
  ],
  defaultCase: true
}
```

**Backend Implementation:**
```javascript
const executeSwitch = async (node, context, appId, userId) => {
  // 1. Validate app access
  // 2. Extract and substitute variable
  // 3. Find matching case
  // 4. Return matched case label for routing
  // 5. If no match, return "default"
};
```

**Frontend Changes Required:**
- Update edge routing to support multiple connectors
- Add UI for creating multiple case connectors
- Visual distinction for case connectors vs yes/no

**Routing Logic:**
```javascript
// In workflow execution
if (node.data.label === "switch") {
  const matchedCase = result.matchedCase || "default";
  const edgeKey = `${node.id}:${matchedCase}`;
  nextNodeId = edgeMap[edgeKey];
}
```

**Context Output:**
```javascript
{
  ...context,
  switchResult: {
    variable: "admin",
    matchedCase: "admin",
    allCases: ["admin", "manager", "user", "default"]
  }
}
```

**Complexity**: ⭐⭐ Medium (requires multi-branch routing)

**Estimated Time**: 6-8 hours

---

### 4. expr (Condition Block)

**Purpose**: Evaluate advanced logical or mathematical expressions

**Configuration Options:**
- `expression` (string, required): Expression to evaluate
- `returnType` (enum: "boolean" | "number" | "string", default: "boolean")
- `variables` (object, optional): Additional variables for expression

**Example Expressions:**
```javascript
// Boolean expressions
"{{context.age}} >= 18"
"{{context.score}} > 80 && {{context.verified}} === true"
"{{context.role}} === 'admin' || {{context.role}} === 'manager'"

// Mathematical expressions
"{{context.price}} * 1.2"  // Add 20% tax
"{{context.total}} - {{context.discount}}"

// String expressions
"{{context.firstName}} + ' ' + {{context.lastName}}"
```

**Backend Implementation:**
```javascript
const executeExpr = async (node, context, appId, userId) => {
  // 1. Validate app access
  // 2. Extract expression
  // 3. Substitute context variables
  // 4. Safely evaluate expression (use vm2 or similar sandbox)
  // 5. Return result and isValid for branching
};
```

**Security Considerations:**
- **CRITICAL**: Use sandboxed evaluation (vm2 library)
- Whitelist allowed operations
- Prevent code injection
- Timeout long-running expressions (max 1 second)
- Limit expression complexity

**Safe Evaluation Example:**
```javascript
const { VM } = require('vm2');
const vm = new VM({
  timeout: 1000,
  sandbox: {
    context: context,
    Math: Math,
    // Whitelist safe functions only
  }
});

const result = vm.run(expression);
```

**Context Output:**
```javascript
{
  ...context,
  exprResult: {
    expression: "age >= 18",
    result: true,
    returnType: "boolean",
    isValid: true  // For conditional branching
  }
}
```

**Complexity**: ⭐⭐ Medium (requires safe expression evaluation)

**Estimated Time**: 8-10 hours

**Dependencies**: `vm2` npm package

---

### 5. ui.openModal (Action Block)

**Purpose**: Opens a modal dialog on the screen for popups, confirmations, or input forms

**Configuration Options:**
- `title` (string, required): Modal title
- `content` (string, required): Modal content (supports HTML)
- `size` (enum: "sm" | "md" | "lg" | "xl", default: "md")
- `showCloseButton` (boolean, default: true)
- `buttons` (array, optional): Custom buttons
  - `label` (string): Button text
  - `variant` (string): Button style
  - `action` (string): Action to trigger on click
- `formFields` (array, optional): Form fields for input modals
- `onClose` (string, optional): Workflow to trigger on close

**Challenge**: Backend workflows cannot directly manipulate frontend UI

**Solution**: Use Socket.io to emit modal open event to frontend

**Backend Implementation:**
```javascript
const executeUiOpenModal = async (node, context, appId, userId) => {
  // 1. Validate app access
  // 2. Extract configuration
  // 3. Substitute context variables in title, content
  // 4. Emit Socket.io event to frontend
  // 5. Return modal data in context
  
  global.emitCanvasUpdate(appId, 'workflow:openModal', {
    modalId: generateId(),
    title: processedTitle,
    content: processedContent,
    size: size,
    buttons: buttons,
    formFields: formFields
  });
};
```

**Frontend Implementation:**
```typescript
// In client/app/run/page.tsx
socket.on('workflow:openModal', (data) => {
  setModalData(data);
  setModalOpen(true);
});
```

**Context Output:**
```javascript
{
  ...context,
  modalResult: {
    modalId: "modal-123",
    opened: true,
    title: "Confirm Action",
    timestamp: "2024-01-01T12:00:00Z"
  }
}
```

**Complexity**: ⭐⭐ Medium (requires frontend-backend coordination)

**Estimated Time**: 8-10 hours

---

## 🔄 Continue to Part 2...

This document is getting long. I'll create a second part with the remaining 3 complex blocks (onRecordCreate, onRecordUpdate, onSchedule) and implementation guides.

