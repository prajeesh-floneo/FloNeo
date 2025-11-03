# UI-Based Workflow Testing Guide - No Code Changes Required

## 🎯 Overview

This guide provides step-by-step instructions for testing workflow blocks using **ONLY the FloNeo Workflow Builder UI**. No code modifications required!

**Blocks to Test:**

- ✅ **Triggers**: onPageLoad, onLogin, onDrop
- ✅ **Conditions**: match, dateValid
- ✅ **Actions**: db.find, db.update

---

## 📋 Prerequisites

1. ✅ Application running at http://localhost:3000
2. ✅ Logged in to FloNeo
3. ✅ Browser console open (Press F12)
4. ✅ Backend logs accessible: `docker-compose logs backend -f`

---

## 🧪 Test 1: onPageLoad Trigger

### Goal

Verify that workflows execute automatically when a page loads.

### Step-by-Step Instructions

#### 1. Create the Workflow

1. **Navigate to Workflows**

   - Click "Workflows" in the left sidebar
   - Click "Create New Workflow" button (top-right)

2. **Add onPageLoad Block**

   - In the Block Library (left panel), find **"Triggers"** section (blue)
   - Locate **"onPageLoad"** block (icon: MousePointer, description: "Page opens")
   - **Drag and drop** it onto the canvas

3. **Configure onPageLoad**

   - **Click** on the onPageLoad block
   - In the right panel, you'll see:
     - **Target Page dropdown** - Select any page from your app
     - **Pages available counter** - Shows how many pages exist
   - **Select a page** from the dropdown
   - Note the page ID for later verification

4. **Add notify.toast Block**

   - In Block Library, find **"Actions"** section (purple)
   - Locate **"notify.toast"** block (icon: Bell, description: "Show toast")
   - **Drag and drop** it onto the canvas

5. **Configure notify.toast**

   - **Click** on the notify.toast block
   - In the right panel, set:
     - **Message**: "Page loaded successfully! 🎉"
     - **Title**: "Welcome"
     - **Variant**: "success" (green)
     - **Duration**: 3000 (3 seconds)

6. **Connect the Blocks**

   - **Hover** over the onPageLoad block
   - You'll see a **blue dot** on the right side (labeled "next")
   - **Click and drag** from the blue dot to the notify.toast block
   - A blue line should connect them

7. **Save the Workflow**
   - Click "Save Workflow" button (top-right)
   - Name it: "Test onPageLoad"
   - Click "Save"

#### 2. Test the Workflow

1. **Go to Preview Mode**

   - Click "Preview" or "Run App" button
   - Navigate to the page you selected in step 3

2. **Expected Results**

   - ✅ Green toast notification appears: "Page loaded successfully! 🎉"
   - ✅ Toast shows title "Welcome"
   - ✅ Toast disappears after 3 seconds

3. **Verify in Console** (Press F12)

   ```
   [PAGE-LOAD] 📄 Page loaded, checking for onPageLoad workflows
   [PAGE-LOAD] Current page ID: <your-page-id>
   [PAGE-LOAD] ✅ Found 1 onPageLoad workflow(s) for page <your-page-id>
   [WF-EXEC] Starting workflow execution
   📄 [ON-PAGE-LOAD] Processing page load for app
   [NOTIFY-TOAST] Showing toast: Page loaded successfully! 🎉
   ```

4. **Verify in Backend Logs**
   ```bash
   docker-compose logs backend --tail=20
   ```
   Look for:
   ```
   📄 [ON-PAGE-LOAD] Processing page load for app
   📄 [ON-PAGE-LOAD] Page load configuration
   ```

#### 3. Troubleshooting

| Issue                | Solution                                             |
| -------------------- | ---------------------------------------------------- |
| No toast appears     | Check console for errors, verify page ID matches     |
| Wrong page triggers  | Verify targetPageId in onPageLoad configuration      |
| Workflow doesn't run | Hard refresh (Ctrl+Shift+R), check workflow is saved |

---

## 🧪 Test 2: onLogin Trigger

### Goal

Verify that workflows execute when a user logs in.

### Step-by-Step Instructions

#### 1. Create the Workflow

1. **Create New Workflow**

   - Go to Workflows → Create New Workflow

2. **Add onLogin Block**

   - In Block Library → **Triggers** section
   - Drag **"onLogin"** block (icon: Users, description: "Auth success")

3. **Configure onLogin**

   - Click on the onLogin block
   - In the right panel, check:
     - ✅ **Capture User Data**
     - ✅ **Store Authentication Token**

4. **Add notify.toast Block**

   - Drag **"notify.toast"** from Actions section

5. **Configure notify.toast**

   - **Message**: "Welcome back, {{context.user.email}}!"
   - **Title**: "Login Successful"
   - **Variant**: "success"
   - **Duration**: 5000

6. **Connect Blocks**

   - Connect onLogin → notify.toast (blue "next" connector)

7. **Save Workflow**
   - Name: "Test onLogin"
   - Click Save

#### 2. Test the Workflow

1. **Logout**

   - Click your profile → Logout

2. **Login Again**

   - Enter credentials and login

3. **Expected Results**

   - ✅ Toast appears: "Welcome back, your-email@example.com!"
   - ✅ Toast shows "Login Successful" title
   - ✅ Toast is green (success variant)

4. **Verify in Console**

   ```
   🔐 [ON-LOGIN] Processing login event
   [WF-EXEC] Starting workflow execution
   [NOTIFY-TOAST] Showing toast: Welcome back, demo@example.com!
   ```

5. **Verify in Backend Logs**
   ```
   🔐 [ON-LOGIN] Processing login event for app
   🔐 [ON-LOGIN] Login configuration: { captureUserData: true, storeToken: true }
   ```

#### 3. Troubleshooting

| Issue                        | Solution                                                 |
| ---------------------------- | -------------------------------------------------------- |
| Toast doesn't show           | Check if workflow is saved, verify onLogin is configured |
| Email not showing            | Verify context variable syntax: {{context.user.email}}   |
| Workflow runs multiple times | Normal if multiple onLogin workflows exist               |

---

## 🧪 Test 3: onDrop Trigger

### Goal

Verify that workflows execute when files are dropped on a drop zone.

### Step-by-Step Instructions

#### 1. Create a Drop Zone Element

1. **Go to Canvas Editor**

   - Navigate to your app's canvas page

2. **Add Drop Zone** (if not already present)
   - In Element Library, find "Drop Zone" or "File Upload"
   - Drag it onto the canvas
   - Note the element ID (visible in properties panel)

#### 2. Create the Workflow

1. **Create New Workflow**

   - Go to Workflows → Create New Workflow

2. **Add onDrop Block**

   - In Block Library → **Triggers** section
   - Drag **"onDrop"** block (icon: Navigation, description: "Card moved")

3. **Configure onDrop**

   - Click on the onDrop block
   - In the right panel, set:
     - **Target Element ID**: (ID of your drop zone)
     - **Accepted Types**: ["image/*", "application/pdf"]
     - **Max File Size**: 5242880 (5MB)
     - **Allow Multiple**: true

4. **Add notify.toast Block**
   - Drag **"notify.toast"** from Actions
     00
5. **Configure notify.toast**

   - **Message**: "{{context.dropResult.successCount}} file(s) uploaded!"
   - **Title**: "Upload Complete"
   - **Variant**: "success"

6. **Connect Blocks**

   - Connect onDrop → notify.toast

7. **Save Workflow**
   - Name: "Test onDrop"

#### 2. Test the Workflow

1. **Go to Preview Mode**

   - Navigate to the page with the drop zone

2. **Drop Files**

   - Drag an image or PDF file from your computer
   - Drop it on the drop zone element

3. **Expected Results**

   - ✅ Toast appears: "1 file(s) uploaded!"
   - ✅ Toast shows "Upload Complete" title
   - ✅ File is processed and stored

4. **Verify in Console**

   ```
   📁 [DROP-EVENT] Processing drop with files: 1
   📁 [ON-DROP] Processing file drop for app
   ✅ [ON-DROP] File processed successfully
   [NOTIFY-TOAST] Showing toast: 1 file(s) uploaded!
   ```

5. **Verify in Backend Logs**
   ```
   📁 [ON-DROP] Processing file drop for app
   📁 [ON-DROP] Drop configuration
   ✅ [ON-DROP] File processed successfully
   ```

#### 3. Troubleshooting

| Issue                  | Solution                                             |
| ---------------------- | ---------------------------------------------------- |
| Drop doesn't trigger   | Verify element ID matches, check accepted file types |
| File rejected          | Check file size and type match configuration         |
| Multiple workflows run | Normal if multiple onDrop workflows exist            |

---

## 🧪 Test 4: match Condition Block

### Goal

Verify that the match block correctly compares values and routes workflow execution.

### Step-by-Step Instructions

#### 1. Create the Workflow

1. **Create New Workflow**

   - Go to Workflows → Create New Workflow

2. **Add onPageLoad Block**

   - Drag **"onPageLoad"** from Triggers
   - Configure to target a specific page

3. **Add match Block**

   - In Block Library → **Conditions** section (green)
   - Drag **"match"** block (icon: Search, description: "Compare values")

4. **Configure match**

   - Click on the match block
   - In the right panel, set:
     - **Left Value**: "admin"
     - **Right Value**: "admin"
     - **Comparison Type**: "text"
     - **Operator**: "equals"
     - **Options**:
       - ✅ Ignore Case
       - ✅ Trim Spaces

5. **Add Two notify.toast Blocks**

   - Drag two **"notify.toast"** blocks

6. **Configure First Toast** (for "yes" path)

   - **Message**: "Match successful! Values are equal ✅"
   - **Variant**: "success"

7. **Configure Second Toast** (for "no" path)

   - **Message**: "Match failed! Values are different ❌"
   - **Variant**: "destructive"

8. **Connect Blocks**

   - Connect onPageLoad → match (blue "next")
   - Connect match → First toast (green "yes" connector)
   - Connect match → Second toast (red "no" connector)

9. **Save Workflow**
   - Name: "Test match - Equal Values"

#### 2. Test the Workflow

1. **Go to Preview Mode**

   - Navigate to the configured page

2. **Expected Results**

   - ✅ Green toast appears: "Match successful! Values are equal ✅"
   - ✅ Red toast does NOT appear

3. **Verify in Console**

   ```
   🔍 [MATCH] Processing match condition
   🔍 [MATCH] Comparison: "admin" equals "admin"
   🔍 [MATCH] Result: true
   🔀 [WF-EXEC] Condition result: true, following "yes" connector
   ```

4. **Test with Non-Matching Values**
   - Edit the workflow
   - Change match block's **Right Value** to "user"
   - Save and test again
   - Expected: Red toast appears instead

#### 3. Troubleshooting

| Issue             | Solution                                      |
| ----------------- | --------------------------------------------- |
| Wrong toast shows | Check left/right values, verify operator      |
| Both toasts show  | Check connectors are properly connected       |
| No toast shows    | Verify match block is connected to onPageLoad |

---

## 🧪 Test 5: dateValid Condition Block

### Goal

Verify that the dateValid block correctly validates date fields.

### Step-by-Step Instructions

#### 1. Create a Form with Date Field

1. **Go to Canvas Editor**

   - Add a **Date Input** field to your page
   - Note the element ID

2. **Add a Submit Button**
   - Add a **Button** element
   - Set button type to "submit"
   - Note the element ID

#### 2. Create the Workflow

1. **Create New Workflow**

   - Go to Workflows → Create New Workflow

2. **Add onSubmit Block**

   - Drag **"onSubmit"** from Triggers
   - Configure to target your form

3. **Add dateValid Block**

   - In Block Library → **Conditions** section
   - Drag **"dateValid"** block (icon: Calendar, description: "Date range")

4. **Configure dateValid**

   - Click on the dateValid block
   - In the right panel, set:
     - **Selected Element IDs**: [your-date-field-id]
     - **Date Format**: "YYYY-MM-DD"
     - **Validation Rules**:
       - Min Date: "2024-01-01"
       - Max Date: "2025-12-31"

5. **Add Two notify.toast Blocks**

   - One for valid dates (yes path)
   - One for invalid dates (no path)

6. **Configure Toasts**

   - **Valid Toast**: "Date is valid! ✅"
   - **Invalid Toast**: "Invalid date! Please check ❌"

7. **Connect Blocks**

   - onSubmit → dateValid
   - dateValid → Valid toast (green "yes")
   - dateValid → Invalid toast (red "no")

8. **Save Workflow**
   - Name: "Test dateValid"

#### 2. Test the Workflow

1. **Go to Preview Mode**

   - Navigate to the page with the date field

2. **Test Valid Date**

   - Enter: "2024-06-15"
   - Click Submit
   - Expected: Green toast "Date is valid! ✅"

3. **Test Invalid Date**

   - Enter: "2026-01-01" (outside range)
   - Click Submit
   - Expected: Red toast "Invalid date! Please check ❌"

4. **Verify in Console**
   ```
   📅 [DATE-VALID] Processing date validation
   📅 [DATE-VALID] Validating date: 2024-06-15
   📅 [DATE-VALID] Result: valid
   🔀 [WF-EXEC] Condition result: true, following "yes" connector
   ```

#### 3. Troubleshooting

| Issue                  | Solution                              |
| ---------------------- | ------------------------------------- |
| Always shows invalid   | Check date format matches input       |
| Element not found      | Verify element ID is correct          |
| Validation doesn't run | Check onSubmit is properly configured |

---

## 🧪 Test 6: db.find Action Block

### Goal

Verify that the db.find block correctly queries database records.

### Step-by-Step Instructions

#### 1. Create the Workflow

1. **Create New Workflow**

   - Go to Workflows → Create New Workflow

2. **Add onPageLoad Block**

   - Drag **"onPageLoad"** from Triggers
   - Configure to target a page

3. **Add db.find Block**

   - In Block Library → **Actions** section (purple)
   - Drag **"db.find"** block (icon: Search, description: "Query rows")

4. **Configure db.find**

   - Click on the db.find block
   - In the right panel, set:
     - **Table**: "User"
     - **Conditions**:
       ```json
       [
         {
           "field": "email",
           "operator": "equals",
           "value": "demo@example.com"
         }
       ]
       ```
     - **Limit**: 1
     - **Columns**: ["id", "email", "role"]

5. **Add notify.toast Block**

   - Drag **"notify.toast"** from Actions

6. **Configure notify.toast**

   - **Message**: "Found user: {{context.records[0].email}}"
   - **Title**: "Query Result"
   - **Variant**: "success"

7. **Connect Blocks**

   - onPageLoad → db.find → notify.toast

8. **Save Workflow**
   - Name: "Test db.find"

#### 2. Test the Workflow

1. **Go to Preview Mode**

   - Navigate to the configured page

2. **Expected Results**

   - ✅ Toast appears: "Found user: demo@example.com"
   - ✅ Toast shows "Query Result" title

3. **Verify in Console**

   ```
   🔍 [DB-FIND] Processing database query
   🔍 [DB-FIND] Table: User
   🔍 [DB-FIND] Found 1 record(s)
   [NOTIFY-TOAST] Showing toast: Found user: demo@example.com
   ```

4. **Verify in Backend Logs**
   ```
   🔍 [DB-FIND] Processing database query for app
   🔍 [DB-FIND] Query configuration: { table: 'User', conditions: [...] }
   🔍 [DB-FIND] Found 1 record(s)
   ```

#### 3. Troubleshooting

| Issue                  | Solution                                           |
| ---------------------- | -------------------------------------------------- |
| No records found       | Check table name, verify conditions match data     |
| Context variable empty | Check records array exists: {{context.records[0]}} |
| Query fails            | Verify table exists in database                    |

---

## 🧪 Test 7: db.update Action Block

### Goal

Verify that the db.update block correctly updates database records.

### Step-by-Step Instructions

#### 1. Create the Workflow

1. **Create New Workflow**

   - Go to Workflows → Create New Workflow

2. **Add onClick Block**

   - Drag **"onClick"** from Triggers
   - Configure to target a button element

3. **Add db.update Block**

   - In Block Library → **Actions** section
   - Drag **"db.update"** block (icon: Database, description: "Update row")

4. **Configure db.update**

   - Click on the db.update block
   - In the right panel, set:
     - **Table**: "User"
     - **Where Conditions**:
       ```json
       [
         {
           "field": "email",
           "operator": "equals",
           "value": "demo@example.com"
         }
       ]
       ```
     - **Update Data**:
       ```json
       {
         "role": "admin"
       }
       ```
     - ✅ **Return Updated Records**

5. **Add notify.toast Block**

   - Drag **"notify.toast"** from Actions

6. **Configure notify.toast**

   - **Message**: "User role updated to: {{context.updatedRecords[0].role}}"
   - **Title**: "Update Successful"
   - **Variant**: "success"

7. **Connect Blocks**

   - onClick → db.update → notify.toast

8. **Save Workflow**
   - Name: "Test db.update"

#### 2. Test the Workflow

1. **Go to Preview Mode**

   - Navigate to the page with the button

2. **Click the Button**

   - Click the configured button element

3. **Expected Results**

   - ✅ Toast appears: "User role updated to: admin"
   - ✅ Toast shows "Update Successful" title

4. **Verify in Console**

   ```
   🔄 [DB-UPDATE] Processing database update
   🔄 [DB-UPDATE] Table: User
   🔄 [DB-UPDATE] Updated 1 record(s)
   [NOTIFY-TOAST] Showing toast: User role updated to: admin
   ```

5. **Verify in Backend Logs**

   ```
   🔄 [DB-UPDATE] Processing database update for app
   🔄 [DB-UPDATE] Update configuration: { table: 'User', whereConditions: [...] }
   🔄 [DB-UPDATE] Updated 1 record(s)
   ```

6. **Verify in Database** (Optional)
   ```bash
   docker exec -it floneo-postgres psql -U floneo -d floneo_db
   SELECT email, role FROM "User" WHERE email = 'demo@example.com';
   ```
   Expected: role should be "admin"

#### 3. Troubleshooting

| Issue                  | Solution                                   |
| ---------------------- | ------------------------------------------ |
| No records updated     | Check where conditions match existing data |
| Update fails           | Verify table and column names are correct  |
| Context variable empty | Ensure "Return Updated Records" is checked |

---

## 📊 Quick Reference: Console Log Patterns

| Block      | Console Log Pattern                          |
| ---------- | -------------------------------------------- |
| onPageLoad | `[PAGE-LOAD] 📄 Page loaded`                 |
| onLogin    | `🔐 [ON-LOGIN] Processing login event`       |
| onDrop     | `📁 [ON-DROP] Processing file drop`          |
| match      | `🔍 [MATCH] Processing match condition`      |
| dateValid  | `📅 [DATE-VALID] Processing date validation` |
| db.find    | `🔍 [DB-FIND] Processing database query`     |
| db.update  | `🔄 [DB-UPDATE] Processing database update`  |

---

## ✅ Testing Checklist

- [ ] onPageLoad triggers on page navigation
- [ ] onLogin triggers on user login
- [ ] onDrop triggers on file drop
- [ ] match correctly compares values (yes/no paths)
- [ ] dateValid validates date ranges (yes/no paths)
- [ ] db.find queries database successfully
- [ ] db.update modifies records successfully
- [ ] All workflows show in console logs
- [ ] All workflows show in backend logs
- [ ] Toast notifications appear as expected

---

## 🎯 Success Criteria

All tests pass if:

1. ✅ Workflows execute when triggered
2. ✅ Console logs show expected patterns
3. ✅ Backend logs confirm execution
4. ✅ Toast notifications display correctly
5. ✅ Database operations succeed
6. ✅ Condition blocks route correctly (yes/no paths)

**All blocks are working correctly!** 🎉
