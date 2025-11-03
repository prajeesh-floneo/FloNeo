# 🚀 Working Blocks Quick Reference

## ✅ Fully Implemented Blocks

---

## 🔵 TRIGGERS

### onClick
**Description:** Triggers when an element is clicked  
**Category:** Triggers  
**Connector:** next (blue)

**Configuration:**
- `elementId` - ID of the clickable element

**Context Output:**
```javascript
{
  elementId: "button-1",
  clickData: {
    timestamp: "2024-01-01T12:00:00Z",
    position: { x: 100, y: 200 }
  }
}
```

**Example Use:**
```
onClick (button) → db.create → notify.toast
```

---

### onSubmit
**Description:** Triggers when a form is submitted  
**Category:** Triggers  
**Connector:** next (blue)

**Configuration:**
- `selectedFormGroup` - Form group ID

**Context Output:**
```javascript
{
  formGroupId: "form-1",
  formData: {
    name: "John Doe",
    email: "john@example.com"
  }
}
```

**Example Use:**
```
onSubmit → isFilled → db.create
```

---

### onDrop
**Description:** Triggers when files are dropped  
**Category:** Triggers  
**Connector:** next (blue)

**Configuration:**
- `elementId` - Drop zone element ID
- `acceptedTypes` - Array of accepted MIME types
- `maxFileSize` - Maximum file size in bytes

**Context Output:**
```javascript
{
  dropData: {
    files: [
      { name: "file.pdf", size: 1024, type: "application/pdf" }
    ],
    position: { x: 100, y: 200 },
    elementId: "drop-zone-1"
  }
}
```

**Example Use:**
```
onDrop → db.create (log upload) → notify.toast
```

---

### onLogin
**Description:** Triggers when user logs in  
**Category:** Triggers  
**Connector:** next (blue)

**Configuration:**
- `captureUserData` - Capture user information (boolean)
- `storeToken` - Store authentication token (boolean)

**Context Output:**
```javascript
{
  user: {
    id: 1,
    email: "user@example.com",
    role: "admin",
    verified: true
  },
  token: "eyJhbGciOiJIUzI1NiIs...",
  loginTime: "2024-01-01T12:00:00Z"
}
```

**Example Use:**
```
onLogin → auth.verify → page.redirect
```

---

### onPageLoad
**Description:** Triggers when a page loads  
**Category:** Triggers  
**Connector:** next (blue)

**Configuration:**
- `targetPageId` - ID of the page to monitor

**Context Output:**
```javascript
{
  pageId: "page-123",
  pageName: "Dashboard",
  loadData: {
    timestamp: "2024-01-01T12:00:00Z",
    elementCount: 15
  }
}
```

**Example Use:**
```
onPageLoad → db.find → notify.toast
```

---

## 🟢 CONDITIONS

### isFilled
**Description:** Checks if form fields are filled  
**Category:** Conditions  
**Connectors:** yes (green) / no (red)

**Configuration:**
- `selectedElementIds` - Array of element IDs to check

**Context Output:**
```javascript
{
  isFilled: true,  // or false
  checkedFields: ["field-1", "field-2"],
  emptyFields: []
}
```

**Example Use:**
```
onSubmit → isFilled
            ├─ yes → db.create
            └─ no → notify.toast (error)
```

---

### dateValid
**Description:** Validates date fields  
**Category:** Conditions  
**Connectors:** yes (green) / no (red)

**Configuration:**
- `selectedElementIds` - Array of date field IDs
- `dateFormat` - Expected date format (e.g., "YYYY-MM-DD")
- `validationRules` - Min/max date constraints

**Context Output:**
```javascript
{
  isValid: true,  // or false
  errors: [],
  parsedDate: "2024-01-01",
  formattedDate: "January 1, 2024"
}
```

**Example Use:**
```
onSubmit → dateValid
            ├─ yes → db.create
            └─ no → notify.toast (invalid date)
```

---

### match
**Description:** Compares two values  
**Category:** Conditions  
**Connectors:** yes (green) / no (red)

**Configuration:**
- `leftValue` - First value to compare (supports {{context.variable}})
- `rightValue` - Second value to compare
- `comparisonType` - "text", "number", "boolean"
- `operator` - "equals", "notEquals", "greaterThan", "lessThan", "contains"

**Context Output:**
```javascript
{
  match: true,  // or false
  leftValue: "admin",
  rightValue: "admin",
  operator: "equals"
}
```

**Example Use:**
```
onLogin → match (check role)
           ├─ yes → page.redirect (admin)
           └─ no → page.redirect (user)
```

---

## 🟣 ACTIONS

### db.find
**Description:** Query database records  
**Category:** Actions  
**Connector:** next (blue)

**Configuration:**
- `table` - Table name (e.g., "User", "Task")
- `filters` - JSON object with filter conditions
- `limit` - Maximum number of records to return

**Context Output:**
```javascript
{
  users: [  // or tasks, etc. based on table name
    { id: 1, name: "John", email: "john@example.com" },
    { id: 2, name: "Jane", email: "jane@example.com" }
  ],
  count: 2
}
```

**Example Use:**
```
onPageLoad → db.find → notify.toast
```

**Filter Examples:**
```json
// Find all records
{}

// Find by ID
{"id": 1}

// Find by email
{"email": "user@example.com"}

// Find with context variable
{"id": "{{context.user.id}}"}
```

---

### db.create
**Description:** Insert new database record  
**Category:** Actions  
**Connector:** next (blue)

**Configuration:**
- `table` - Table name
- `data` - JSON object with field values

**Context Output:**
```javascript
{
  created: true,
  record: {
    id: 123,
    name: "New Record",
    createdAt: "2024-01-01T12:00:00Z"
  }
}
```

**Example Use:**
```
onClick → db.create → notify.toast
```

**Data Examples:**
```json
// Simple record
{
  "name": "John Doe",
  "email": "john@example.com"
}

// With context variables
{
  "userId": "{{context.user.id}}",
  "action": "login",
  "timestamp": "{{context.loginTime}}"
}

// With nested data
{
  "title": "Task",
  "metadata": {
    "priority": "high",
    "tags": ["urgent", "important"]
  }
}
```

---

### db.update
**Description:** Update existing database record  
**Category:** Actions  
**Connector:** next (blue)

**Configuration:**
- `table` - Table name
- `recordId` - ID of record to update (supports {{context.variable}})
- `data` - JSON object with fields to update

**Context Output:**
```javascript
{
  updated: true,
  record: {
    id: 123,
    status: "complete",
    updatedAt: "2024-01-01T12:00:00Z"
  }
}
```

**Example Use:**
```
onClick → db.find → db.update → notify.toast
```

**Update Examples:**
```json
// Update single field
{
  "status": "complete"
}

// Update multiple fields
{
  "status": "complete",
  "completedAt": "{{new Date().toISOString()}}",
  "completedBy": "{{context.user.id}}"
}
```

---

### page.redirect
**Description:** Navigate to another page  
**Category:** Actions  
**Connector:** next (blue)

**Configuration:**
- `targetPageId` - ID of page to navigate to
- `openInNewTab` - Open in new tab (boolean)

**Context Output:**
```javascript
{
  redirected: true,
  targetPage: "dashboard",
  timestamp: "2024-01-01T12:00:00Z"
}
```

**Example Use:**
```
onLogin → auth.verify → page.redirect
```

---

### notify.toast
**Description:** Show toast notification  
**Category:** Actions  
**Connector:** next (blue)

**Configuration:**
- `message` - Notification message (supports {{context.variable}})
- `type` - "success", "error", "warning", "info"
- `duration` - Display duration in milliseconds

**Context Output:**
```javascript
{
  notified: true,
  message: "Welcome user@example.com!",
  type: "success"
}
```

**Example Use:**
```
db.create → notify.toast
```

**Message Examples:**
```
// Static message
"Record created successfully!"

// With context variable
"Welcome {{context.user.email}}!"

// With multiple variables
"Found {{context.users.length}} users in the system"
```

---

### auth.verify
**Description:** Verify user authentication  
**Category:** Actions  
**Connector:** next (blue)

**Configuration:**
- `tokenSource` - "context", "header", "cookie"
- `requireVerified` - Require email verification (boolean)
- `requiredRole` - Required user role (empty for any)
- `validateExpiration` - Check token expiration (boolean)
- `checkBlacklist` - Check token blacklist (boolean)

**Context Output:**
```javascript
{
  verified: true,
  user: {
    id: 1,
    email: "user@example.com",
    role: "admin",
    verified: true
  },
  token: "eyJhbGciOiJIUzI1NiIs..."
}
```

**Example Use:**
```
onLogin → auth.verify → match → page.redirect
```

---

## 🔗 Connector Types

| Connector | Color | Use With | Description |
|-----------|-------|----------|-------------|
| **next** | Blue | Triggers, Actions | Normal sequential flow |
| **yes** | Green | Conditions | True/success branch |
| **no** | Red | Conditions | False/failure branch |
| **onError** | Red (dashed) | Any block | Error handling |

---

## 📊 Common Workflow Patterns

### Pattern 1: Login Authentication
```
onLogin → auth.verify → page.redirect
```

### Pattern 2: Form Validation & Submit
```
onSubmit → isFilled
            ├─ yes → db.create → notify.toast
            └─ no → notify.toast (error)
```

### Pattern 3: Role-Based Access
```
onLogin → auth.verify → match (role)
                         ├─ yes → page.redirect (admin)
                         └─ no → page.redirect (user)
```

### Pattern 4: Data Loading
```
onPageLoad → db.find → match (has data)
                        ├─ yes → notify.toast (success)
                        └─ no → notify.toast (no data)
```

### Pattern 5: CRUD with Notification
```
onClick → db.create → notify.toast
```

### Pattern 6: Conditional Update
```
onClick → db.find → match (check status)
                     ├─ yes → db.update
                     └─ no → notify.toast
```

### Pattern 7: Activity Logging
```
onLogin → auth.verify → db.create (log) → notify.toast
```

---

## 🐛 Quick Debugging

### Check Console Logs
Press **F12** → **Console** tab

Look for these prefixes:
- `[ON-CLICK]` - Click events
- `[ON-SUBMIT]` - Form submissions
- `[ON-DROP]` - File drops
- `[ON-LOGIN]` - Login events
- `[PAGE-LOAD]` - Page loads
- `[IS-FILLED]` - Field validation
- `[DATE-VALID]` - Date validation
- `[MATCH]` - Value comparison
- `[DB-FIND]` - Database queries
- `[DB-CREATE]` - Record creation
- `[DB-UPDATE]` - Record updates
- `[PAGE-REDIRECT]` - Page navigation
- `[NOTIFY-TOAST]` - Notifications
- `[AUTH-VERIFY]` - Authentication

### Check Backend Logs
```bash
docker-compose logs backend --tail=100 -f
```

### Check Database
```bash
docker exec -it floneo-postgres psql -U postgres -d floneo
```

```sql
-- List tables
\dt

-- Check workflows
SELECT id, name, "appId", "pageId" FROM "Workflow";

-- Check users
SELECT id, email, role, verified FROM "User";
```

---

## ✅ Testing Checklist

### Triggers
- [ ] onClick works
- [ ] onSubmit works
- [ ] onDrop works
- [ ] onLogin works
- [ ] onPageLoad works

### Conditions
- [ ] isFilled validates correctly
- [ ] dateValid validates correctly
- [ ] match compares correctly
- [ ] yes/no connectors work

### Actions
- [ ] db.find queries data
- [ ] db.create inserts records
- [ ] db.update modifies records
- [ ] page.redirect navigates
- [ ] notify.toast shows messages
- [ ] auth.verify validates tokens

### Integration
- [ ] onLogin + auth.verify
- [ ] auth.verify + match
- [ ] db.find + match
- [ ] Workflows chain correctly
- [ ] Context passes between blocks

---

**For detailed test scenarios, see [WORKING_BLOCKS_TESTING_GUIDE.md](./WORKING_BLOCKS_TESTING_GUIDE.md)**

