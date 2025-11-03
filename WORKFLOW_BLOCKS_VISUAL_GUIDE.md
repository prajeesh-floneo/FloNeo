# Workflow Blocks Visual Guide - Quick Reference

## 🎨 Block Categories & Colors

```
┌─────────────────────────────────────────────────────────────┐
│  TRIGGERS (Blue)    │  CONDITIONS (Green)  │  ACTIONS (Purple) │
├─────────────────────┼──────────────────────┼───────────────────┤
│  onPageLoad         │  match               │  db.find          │
│  onLogin            │  dateValid           │  db.update        │
│  onDrop             │  isFilled            │  notify.toast     │
│  onClick            │                      │  page.redirect    │
│  onSubmit           │                      │  auth.verify      │
└─────────────────────┴──────────────────────┴───────────────────┘
```

---

## 🔵 TRIGGER BLOCKS

### onPageLoad
```
┌──────────────────────────┐
│   📄 onPageLoad          │
│   ─────────────          │
│   Page opens             │
│                          │
│   Config:                │
│   • Target Page: [▼]     │
│   • Pages available: 5   │
│                          │
│   Context Output:        │
│   • pageId               │
│   • pageName             │
│   • loadData.timestamp   │
│                          │
│   Connector: next (blue) │
└──────────────────────────┘
```

**Where to Find**: Block Library → Triggers (blue section)  
**Icon**: MousePointer  
**Description**: "Page opens"

**Configuration Panel**:
- Target Page dropdown (select which page triggers this)
- Shows available pages count
- Displays context variables

**How to Test**:
1. Drag onPageLoad to canvas
2. Click block → Select target page
3. Connect to notify.toast
4. Save workflow
5. Navigate to target page
6. Toast should appear automatically

---

### onLogin
```
┌──────────────────────────┐
│   🔐 onLogin             │
│   ────────               │
│   Auth success           │
│                          │
│   Config:                │
│   ☑ Capture User Data    │
│   ☑ Store Token          │
│                          │
│   Context Output:        │
│   • user.id              │
│   • user.email           │
│   • user.role            │
│   • token                │
│   • loginTime            │
│                          │
│   Connector: next (blue) │
└──────────────────────────┘
```

**Where to Find**: Block Library → Triggers (blue section)  
**Icon**: Users  
**Description**: "Auth success"

**Configuration Panel**:
- ☑ Capture User Data checkbox
- ☑ Store Authentication Token checkbox
- Shows available context variables

**How to Test**:
1. Drag onLogin to canvas
2. Click block → Check both checkboxes
3. Connect to notify.toast
4. Save workflow
5. Logout and login again
6. Toast should appear after login

---

### onDrop
```
┌──────────────────────────┐
│   📁 onDrop              │
│   ───────                │
│   Card moved             │
│                          │
│   Config:                │
│   • Target Element ID    │
│   • Accepted Types       │
│   • Max File Size        │
│   • Allow Multiple       │
│                          │
│   Context Output:        │
│   • dropResult.files     │
│   • dropResult.position  │
│   • successCount         │
│                          │
│   Connector: next (blue) │
└──────────────────────────┘
```

**Where to Find**: Block Library → Triggers (blue section)  
**Icon**: Navigation  
**Description**: "Card moved"

**Configuration Panel**:
- Target Element ID (which drop zone)
- Accepted file types (e.g., "image/*", "application/pdf")
- Max file size in bytes
- Allow multiple files checkbox

**How to Test**:
1. Create drop zone element on canvas
2. Drag onDrop to workflow canvas
3. Configure with drop zone element ID
4. Connect to notify.toast
5. Save workflow
6. Drop a file on the drop zone
7. Toast should appear

---

## 🟢 CONDITION BLOCKS

### match
```
┌──────────────────────────┐
│   🔍 match               │
│   ──────                 │
│   Compare values         │
│                          │
│   Config:                │
│   • Left Value: [____]   │
│   • Right Value: [____]  │
│   • Comparison: text ▼   │
│   • Operator: equals ▼   │
│   • ☑ Ignore Case        │
│   • ☑ Trim Spaces        │
│                          │
│   Connectors:            │
│   • yes (green)          │
│   • no (red)             │
└──────────────────────────┘
```

**Where to Find**: Block Library → Conditions (green section)  
**Icon**: Search  
**Description**: "Compare values"

**Configuration Panel**:
- Left Value (text or context variable)
- Right Value (text or context variable)
- Comparison Type: text, number, date, list
- Operator: equals, notEquals, contains, startsWith, endsWith, greaterThan, lessThan
- Options: Ignore Case, Trim Spaces, Allow Partial Matches

**How to Test**:
1. Drag match to canvas
2. Set Left Value: "admin"
3. Set Right Value: "admin"
4. Set Operator: "equals"
5. Connect to two notify.toast blocks (yes/no paths)
6. Test with matching and non-matching values

**Connectors**:
- **Green "yes"** → Executes when match is TRUE
- **Red "no"** → Executes when match is FALSE

---

### dateValid
```
┌──────────────────────────┐
│   📅 dateValid           │
│   ──────────             │
│   Date range             │
│                          │
│   Config:                │
│   • Element IDs: [____]  │
│   • Format: YYYY-MM-DD   │
│   • Min Date: [____]     │
│   • Max Date: [____]     │
│                          │
│   Context Output:        │
│   • isValid: true/false  │
│   • errors: []           │
│   • parsedDate           │
│                          │
│   Connectors:            │
│   • yes (green)          │
│   • no (red)             │
└──────────────────────────┘
```

**Where to Find**: Block Library → Conditions (green section)  
**Icon**: Calendar  
**Description**: "Date range"

**Configuration Panel**:
- Selected Element IDs (array of date field IDs)
- Date Format (e.g., "YYYY-MM-DD", "MM/DD/YYYY")
- Validation Rules:
  - Min Date
  - Max Date

**How to Test**:
1. Create date input field on canvas
2. Drag dateValid to workflow
3. Configure with date field ID
4. Set min/max date range
5. Connect to two notify.toast blocks (yes/no paths)
6. Test with valid and invalid dates

**Connectors**:
- **Green "yes"** → Executes when date is VALID
- **Red "no"** → Executes when date is INVALID

---

## 🟣 ACTION BLOCKS

### db.find
```
┌──────────────────────────┐
│   🔍 db.find             │
│   ────────               │
│   Query rows             │
│                          │
│   Config:                │
│   • Table: User ▼        │
│   • Conditions:          │
│     - field: email       │
│     - operator: equals   │
│     - value: demo@...    │
│   • Limit: 10            │
│   • Columns: [id, email] │
│                          │
│   Context Output:        │
│   • records: [...]       │
│   • count: 1             │
│                          │
│   Connector: next (blue) │
└──────────────────────────┘
```

**Where to Find**: Block Library → Actions (purple section)  
**Icon**: Search  
**Description**: "Query rows"

**Configuration Panel**:
- Table (dropdown of available tables)
- Conditions (array of filter conditions):
  - field name
  - operator (equals, notEquals, contains, greaterThan, lessThan)
  - value (can use context variables)
  - logic (AND/OR for multiple conditions)
- Order By (field and direction)
- Limit (max records to return)
- Offset (pagination)
- Columns (which fields to return)

**How to Test**:
1. Drag db.find to canvas
2. Select table: "User"
3. Add condition: email equals "demo@example.com"
4. Set limit: 1
5. Connect to notify.toast
6. Use context variable in toast: {{context.records[0].email}}

**Context Variables**:
- `{{context.records}}` - Array of found records
- `{{context.records[0].fieldName}}` - Access specific field
- `{{context.count}}` - Number of records found

---

### db.update
```
┌──────────────────────────┐
│   🔄 db.update           │
│   ──────────             │
│   Update row             │
│                          │
│   Config:                │
│   • Table: User ▼        │
│   • Where Conditions:    │
│     - field: id          │
│     - operator: equals   │
│     - value: 1           │
│   • Update Data:         │
│     {                    │
│       "role": "admin"    │
│     }                    │
│   • ☑ Return Updated     │
│                          │
│   Context Output:        │
│   • updatedRecords: [...] │
│   • updateCount: 1       │
│                          │
│   Connector: next (blue) │
└──────────────────────────┘
```

**Where to Find**: Block Library → Actions (purple section)  
**Icon**: Database  
**Description**: "Update row"

**Configuration Panel**:
- Table (dropdown of available tables)
- Where Conditions (which records to update):
  - field name
  - operator
  - value
  - logic (AND/OR)
- Update Data (JSON object with new values)
- ☑ Return Updated Records checkbox

**How to Test**:
1. Drag db.update to canvas
2. Select table: "User"
3. Add where condition: email equals "demo@example.com"
4. Set update data: {"role": "admin"}
5. Check "Return Updated Records"
6. Connect to notify.toast
7. Use context variable: {{context.updatedRecords[0].role}}

**Context Variables**:
- `{{context.updatedRecords}}` - Array of updated records (if enabled)
- `{{context.updateCount}}` - Number of records updated

---

## 🔗 Connector Types

```
┌────────────────────────────────────────────────────────┐
│  Connector  │  Color  │  Use With      │  Description  │
├─────────────┼─────────┼────────────────┼───────────────┤
│  next       │  Blue   │  Triggers      │  Sequential   │
│             │         │  Actions       │  flow         │
├─────────────┼─────────┼────────────────┼───────────────┤
│  yes        │  Green  │  Conditions    │  True/success │
│             │         │                │  branch       │
├─────────────┼─────────┼────────────────┼───────────────┤
│  no         │  Red    │  Conditions    │  False/fail   │
│             │         │                │  branch       │
├─────────────┼─────────┼────────────────┼───────────────┤
│  onError    │  Red    │  Any block     │  Error        │
│             │  Dashed │                │  handling     │
└─────────────┴─────────┴────────────────┴───────────────┘
```

---

## 📊 Common Workflow Patterns

### Pattern 1: Page Load with Data Query
```
onPageLoad → db.find → notify.toast
   (blue)      (blue)      (blue)
```

### Pattern 2: Login with Authentication
```
onLogin → auth.verify → page.redirect
 (blue)      (blue)         (blue)
```

### Pattern 3: Conditional Branching
```
onPageLoad → match ─┬─ yes → notify.toast (success)
   (blue)    (blue) │ (green)
                    └─ no → notify.toast (error)
                      (red)
```

### Pattern 4: Form Validation
```
onSubmit → dateValid ─┬─ yes → db.create → notify.toast
  (blue)     (blue)   │ (green)  (blue)      (blue)
                      └─ no → notify.toast (error)
                        (red)
```

### Pattern 5: File Upload
```
onDrop → notify.toast
(blue)      (blue)
```

### Pattern 6: Database Update with Condition
```
onClick → db.find → match ─┬─ yes → db.update → notify.toast
 (blue)    (blue)   (blue) │ (green)  (blue)      (blue)
                           └─ no → notify.toast (skip)
                             (red)
```

---

## 🎯 Quick Testing Checklist

```
┌─────────────────────────────────────────────────────┐
│  Block        │  Test Method              │  Result │
├───────────────┼───────────────────────────┼─────────┤
│  onPageLoad   │  Navigate to page         │  [ ]    │
│  onLogin      │  Logout and login         │  [ ]    │
│  onDrop       │  Drop file on zone        │  [ ]    │
│  match        │  Test yes/no paths        │  [ ]    │
│  dateValid    │  Test valid/invalid dates │  [ ]    │
│  db.find      │  Check console for data   │  [ ]    │
│  db.update    │  Verify database change   │  [ ]    │
└───────────────┴───────────────────────────┴─────────┘
```

---

## 🐛 Debugging Quick Reference

### Console Log Patterns
```
onPageLoad  → [PAGE-LOAD] 📄 Page loaded
onLogin     → 🔐 [ON-LOGIN] Processing login event
onDrop      → 📁 [ON-DROP] Processing file drop
match       → 🔍 [MATCH] Processing match condition
dateValid   → 📅 [DATE-VALID] Processing date validation
db.find     → 🔍 [DB-FIND] Processing database query
db.update   → 🔄 [DB-UPDATE] Processing database update
```

### Common Issues
```
┌──────────────────────────┬────────────────────────────┐
│  Issue                   │  Solution                  │
├──────────────────────────┼────────────────────────────┤
│  Workflow doesn't run    │  Hard refresh (Ctrl+Shift+R)│
│  Toast doesn't appear    │  Check console for errors  │
│  Wrong path executes     │  Verify connector colors   │
│  Context variable empty  │  Check variable syntax     │
│  Database query fails    │  Verify table/field names  │
└──────────────────────────┴────────────────────────────┘
```

---

## ✅ Success Indicators

**Workflow is working if you see:**
- ✅ Console logs with block-specific patterns
- ✅ Toast notifications appear as configured
- ✅ Correct connector path executes (yes/no)
- ✅ Context variables resolve correctly
- ✅ Database operations succeed
- ✅ Backend logs confirm execution

**All blocks tested and working!** 🎉

