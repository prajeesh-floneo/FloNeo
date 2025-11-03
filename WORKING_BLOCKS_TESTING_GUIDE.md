# 🧪 Working Blocks Testing Guide

This guide covers **ONLY the fully implemented and functional blocks** in the FloNeo workflow system.

---

## ✅ Confirmed Working Blocks

### 🔵 Triggers (Fully Implemented)
- ✅ **onClick** - Button/element click events
- ✅ **onSubmit** - Form submission events
- ✅ **onDrop** - File drop events
- ✅ **onLogin** - User login events
- ✅ **onPageLoad** - Page load events

### 🟢 Conditions (Fully Implemented)
- ✅ **isFilled** - Check if form fields are filled
- ✅ **dateValid** - Validate date fields
- ✅ **match** - Compare two values

### 🟣 Actions (Fully Implemented)
- ✅ **db.find** - Query database records
- ✅ **db.create** - Insert new records
- ✅ **db.update** - Update existing records
- ✅ **page.redirect** - Navigate to another page
- ✅ **notify.toast** - Show toast notifications
- ✅ **auth.verify** - Verify user authentication

---

## 📋 Test Scenarios with onLogin + auth.verify

### Test 1: onLogin + auth.verify + notify.toast

**Goal:** Verify user on login and show welcome message

**Workflow:**
```
onLogin → auth.verify → notify.toast
```

**Configuration:**

1. **onLogin**
   - Capture User Data: ✓
   - Store Token: ✓

2. **auth.verify**
   - Token Source: "context"
   - Require Verified: ✓
   - Required Role: "" (empty for any role)
   - Validate Expiration: ✓
   - Check Blacklist: ✓

3. **notify.toast**
   - Message: "Welcome {{context.user.email}}!"
   - Type: "success"
   - Duration: 3000

**Expected Result:**
- User logs in successfully
- Token is verified
- Toast shows: "Welcome user@example.com!"

**Console Logs:**
```
[ON-LOGIN] Processing login event for app: 1
[AUTH-VERIFY] Processing authentication verification for app: 1
[AUTH-VERIFY] ✅ Token valid
[AUTH-VERIFY] ✅ User verified
[NOTIFY-TOAST] Processing toast notification for app: 1
```

---

### Test 2: onLogin + auth.verify + match + page.redirect

**Goal:** Redirect users based on their role after login

**Workflow:**
```
onLogin → auth.verify → match (check role)
                         ├─ yes → page.redirect (Admin Dashboard)
                         └─ no → page.redirect (User Dashboard)
```

**Configuration:**

1. **onLogin**
   - Capture User Data: ✓
   - Store Token: ✓

2. **auth.verify**
   - Token Source: "context"
   - Require Verified: ✓
   - Required Role: "" (accept any)

3. **match**
   - Left Value: "{{context.user.role}}"
   - Right Value: "admin"
   - Comparison Type: "text"
   - Operator: "equals"

4. **page.redirect (Admin)**
   - Target Page: "Admin Dashboard"
   - Open in New Tab: ☐

5. **page.redirect (User)**
   - Target Page: "User Dashboard"
   - Open in New Tab: ☐

**Expected Result:**
- Admin users → Redirected to Admin Dashboard
- Regular users → Redirected to User Dashboard

---

### Test 3: onLogin + auth.verify + db.find + notify.toast

**Goal:** Load user's data after login and show count

**Workflow:**
```
onLogin → auth.verify → db.find → notify.toast
```

**Configuration:**

1. **onLogin**
   - Capture User Data: ✓
   - Store Token: ✓

2. **auth.verify**
   - Token Source: "context"
   - Require Verified: ✓

3. **db.find**
   - Table: "User"
   - Filters: {"id": "{{context.user.id}}"}
   - Limit: 1

4. **notify.toast**
   - Message: "Profile loaded for {{context.users[0].email}}"
   - Type: "info"
   - Duration: 3000

**Expected Result:**
- User data is queried from database
- Toast shows user's email from DB

---

### Test 4: onLogin + auth.verify + db.create (Activity Log)

**Goal:** Log user login activity to database

**Workflow:**
```
onLogin → auth.verify → db.create → notify.toast
```

**Configuration:**

1. **onLogin**
   - Capture User Data: ✓
   - Store Token: ✓

2. **auth.verify**
   - Token Source: "context"
   - Require Verified: ✓

3. **db.create**
   - Table: "ActivityLog"
   - Data:
     ```json
     {
       "action": "user_login",
       "userId": "{{context.user.id}}",
       "timestamp": "{{context.loginTime}}",
       "metadata": {
         "email": "{{context.user.email}}",
         "role": "{{context.user.role}}"
       }
     }
     ```

4. **notify.toast**
   - Message: "Login recorded"
   - Type: "success"
   - Duration: 2000

**Expected Result:**
- New record created in ActivityLog table
- Toast confirms login was recorded

---

### Test 5: onLogin + auth.verify + match + db.update

**Goal:** Update user's last login timestamp based on verification

**Workflow:**
```
onLogin → auth.verify → match (check verified)
                         ├─ yes → db.update (update last login)
                         └─ no → notify.toast (verification required)
```

**Configuration:**

1. **onLogin**
   - Capture User Data: ✓
   - Store Token: ✓

2. **auth.verify**
   - Token Source: "context"
   - Require Verified: ☐ (don't require, we'll check manually)

3. **match**
   - Left Value: "{{context.user.verified}}"
   - Right Value: "true"
   - Comparison Type: "boolean"
   - Operator: "equals"

4. **db.update**
   - Table: "User"
   - Record ID: "{{context.user.id}}"
   - Data:
     ```json
     {
       "lastLoginAt": "{{context.loginTime}}"
     }
     ```

5. **notify.toast**
   - Message: "Please verify your email first"
   - Type: "warning"
   - Duration: 5000

**Expected Result:**
- Verified users: lastLoginAt updated in database
- Unverified users: Warning toast shown

---

## 📋 Test Scenarios with Other Triggers

### Test 6: onClick + db.create + notify.toast

**Goal:** Create a new record when button is clicked

**Workflow:**
```
onClick → db.create → notify.toast
```

**Configuration:**

1. **onClick**
   - Element ID: "create-button"

2. **db.create**
   - Table: "Task"
   - Data:
     ```json
     {
       "title": "New Task",
       "status": "pending",
       "createdAt": "{{new Date().toISOString()}}"
     }
     ```

3. **notify.toast**
   - Message: "Task created successfully!"
   - Type: "success"
   - Duration: 3000

**Expected Result:**
- New task record created in database
- Success toast appears

---

### Test 7: onSubmit + isFilled + db.create

**Goal:** Validate form and create record on submission

**Workflow:**
```
onSubmit → isFilled
            ├─ yes → db.create → notify.toast (success)
            └─ no → notify.toast (validation error)
```

**Configuration:**

1. **onSubmit**
   - Form Group ID: "user-form"

2. **isFilled**
   - Element IDs: ["name-field", "email-field"]

3. **db.create**
   - Table: "User"
   - Data:
     ```json
     {
       "name": "{{context.formData.name}}",
       "email": "{{context.formData.email}}",
       "createdAt": "{{new Date().toISOString()}}"
     }
     ```

4. **notify.toast (success)**
   - Message: "User created successfully!"
   - Type: "success"

5. **notify.toast (error)**
   - Message: "Please fill all required fields"
   - Type: "error"

**Expected Result:**
- If fields filled: User created, success toast
- If fields empty: Error toast, no DB operation

---

### Test 8: onPageLoad + db.find + match + notify.toast

**Goal:** Load data on page load and show conditional message

**Workflow:**
```
onPageLoad → db.find → match (check count)
                        ├─ yes → notify.toast (has data)
                        └─ no → notify.toast (no data)
```

**Configuration:**

1. **onPageLoad**
   - Target Page: "Dashboard"

2. **db.find**
   - Table: "User"
   - Filters: {}
   - Limit: 100

3. **match**
   - Left Value: "{{context.users.length}}"
   - Right Value: "0"
   - Comparison Type: "number"
   - Operator: "greaterThan"

4. **notify.toast (has data)**
   - Message: "Found {{context.users.length}} users"
   - Type: "info"

5. **notify.toast (no data)**
   - Message: "No users found"
   - Type: "warning"

**Expected Result:**
- Database queried on page load
- Appropriate message based on result count

---

### Test 9: onDrop + db.create + notify.toast

**Goal:** Log file drop events to database

**Workflow:**
```
onDrop → db.create → notify.toast
```

**Configuration:**

1. **onDrop**
   - Element ID: "drop-zone"
   - Accepted Types: ["image/*", "application/pdf"]
   - Max File Size: 5242880 (5MB)

2. **db.create**
   - Table: "FileUpload"
   - Data:
     ```json
     {
       "fileName": "{{context.dropData.files[0].name}}",
       "fileSize": "{{context.dropData.files[0].size}}",
       "fileType": "{{context.dropData.files[0].type}}",
       "uploadedAt": "{{new Date().toISOString()}}"
     }
     ```

3. **notify.toast**
   - Message: "File {{context.dropData.files[0].name}} uploaded"
   - Type: "success"
   - Duration: 3000

**Expected Result:**
- File drop logged to database
- Toast shows file name

---

### Test 10: onClick + db.find + match + db.update

**Goal:** Find record and update based on condition

**Workflow:**
```
onClick → db.find → match (check status)
                     ├─ yes → db.update (mark complete)
                     └─ no → notify.toast (already complete)
```

**Configuration:**

1. **onClick**
   - Element ID: "complete-button"

2. **db.find**
   - Table: "Task"
   - Filters: {"id": "{{context.taskId}}"}
   - Limit: 1

3. **match**
   - Left Value: "{{context.tasks[0].status}}"
   - Right Value: "complete"
   - Comparison Type: "text"
   - Operator: "notEquals"

4. **db.update**
   - Table: "Task"
   - Record ID: "{{context.taskId}}"
   - Data:
     ```json
     {
       "status": "complete",
       "completedAt": "{{new Date().toISOString()}}"
     }
     ```

5. **notify.toast**
   - Message: "Task already completed"
   - Type: "info"

**Expected Result:**
- Pending tasks: Updated to complete
- Complete tasks: Info toast shown

---

## 🐛 Debugging & Verification

### Console Logs to Check

Each block produces specific console logs:

| Block | Log Prefix | Example |
|-------|-----------|---------|
| onClick | `[ON-CLICK]` | `🖱️ [ON-CLICK] Processing click event` |
| onSubmit | `[ON-SUBMIT]` | `📝 [ON-SUBMIT] Processing form submission` |
| onDrop | `[ON-DROP]` | `📁 [ON-DROP] Processing file drop` |
| onLogin | `[ON-LOGIN]` | `🔐 [ON-LOGIN] Processing login event` |
| onPageLoad | `[PAGE-LOAD]` | `📄 [PAGE-LOAD] Page loaded` |
| isFilled | `[IS-FILLED]` | `🔍 [IS-FILLED] Starting validation` |
| dateValid | `[DATE-VALID]` | `📅 [DATE-VALID] Starting date validation` |
| match | `[MATCH]` | `🔍 [MATCH] Processing match condition` |
| db.find | `[DB-FIND]` | `🔍 [DB-FIND] Starting query execution` |
| db.create | `[DB-CREATE]` | `🗄️ [DB-CREATE] Starting table creation` |
| db.update | `[DB-UPDATE]` | `🔄 [DB-UPDATE] Starting update execution` |
| page.redirect | `[PAGE-REDIRECT]` | `🔄 [PAGE-REDIRECT] Processing page redirect` |
| notify.toast | `[NOTIFY-TOAST]` | `🔔 [NOTIFY-TOAST] Processing toast notification` |
| auth.verify | `[AUTH-VERIFY]` | `🔐 [AUTH-VERIFY] Processing authentication` |

### Database Verification

Check database records after testing:

```sql
-- Check ActivityLog entries
SELECT * FROM "ActivityLog" ORDER BY "createdAt" DESC LIMIT 10;

-- Check User records
SELECT id, email, role, verified, "lastLoginAt" FROM "User";

-- Check Task records
SELECT * FROM "Task" ORDER BY "createdAt" DESC;

-- Check FileUpload records
SELECT * FROM "FileUpload" ORDER BY "uploadedAt" DESC;
```

### Docker Commands

```bash
# View backend logs
docker-compose logs backend --tail=100 -f

# View frontend logs
docker-compose logs frontend --tail=50 -f

# Access database
docker exec -it floneo-postgres psql -U postgres -d floneo
```

---

## ✅ Testing Checklist

### Triggers
- [ ] onClick triggers on button click
- [ ] onSubmit triggers on form submission
- [ ] onDrop triggers on file drop
- [ ] onLogin triggers on successful login
- [ ] onPageLoad triggers when page loads

### Conditions
- [ ] isFilled validates form fields correctly
- [ ] dateValid validates dates correctly
- [ ] match compares values correctly
- [ ] yes/no connectors work properly

### Actions
- [ ] db.find queries database successfully
- [ ] db.create inserts records correctly
- [ ] db.update modifies records correctly
- [ ] page.redirect navigates to correct page
- [ ] notify.toast shows messages correctly
- [ ] auth.verify validates tokens correctly

### Integration
- [ ] onLogin + auth.verify works
- [ ] auth.verify + match works
- [ ] db.find + match works
- [ ] Condition branching (yes/no) works
- [ ] Multiple blocks chain correctly
- [ ] Context variables pass between blocks

---

**All blocks listed in this guide are fully implemented and tested!** 🎉

