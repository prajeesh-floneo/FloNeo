# Signup Workflow: Complete Step-by-Step Guide

## Overview
This guide explains exactly how to create a signup page workflow: `onSubmit → db.create → page.redirect → notify.toast`

## How Data Flows

### 1. Form Submission (onSubmit)
When a user fills out a form and clicks submit:

```
Form Fields:
├── textfield-123 (name: "emailInput") → Value: "user@example.com"
└── textfield-456 (name: "passwordInput") → Value: "mypassword123"
```

**onSubmit block captures:**
```javascript
formData = {
  "textfield-123": "user@example.com",  // Field ID as key
  "textfield-456": "mypassword123"      // Field ID as key
}
```

**onSubmit also adds to context:**
```javascript
context = {
  formData: {
    "textfield-123": "user@example.com",
    "textfield-456": "mypassword123"
  },
  // Also adds each field directly to context:
  "textfield-123": "user@example.com",
  "textfield-456": "mypassword123"
}
```

---

## 2. Database Creation (db.create)

### Step 1: Create Your Database Table

**Option A: Create Table Manually (Recommended)**
1. Go to **Database** section in your app
2. Click **"Create Table"**
3. Add columns:
   - `email` (Text, Required)
   - `password` (Text, Required)
   - `name` (Text, Optional)
   - `created_at` (Date, Auto) - usually added automatically
4. Name it: `users` or `signup_users`
5. The system will create: `app_1_users` (where 1 is your appId)

**Option B: Let db.create Auto-Create Table**
- If table doesn't exist, `db.create` will create it automatically
- Column types are inferred from the data you provide

---

### Step 2: Configure db.create Block

#### A. Basic Configuration

1. **Table Name:**
   - Enter: `users` (or your table name)
   - System will use: `app_<appId>_users`

2. **Data Source:**
   - The `db.create` block automatically looks for data in this order:
     1. **Manual `insertData`** (if you manually configure fields)
     2. **`httpResponse.data`** (from http.request block)
     3. **`formData`** (from onSubmit block) ← **This is what we use for signup**
     4. **Context data** (any other data in workflow context)

#### B. Mapping Form Data to Database Columns

**Method 1: Automatic Mapping (Easiest)**

If your form field IDs match your database column names, it works automatically:

```
Form Field ID: "emailInput" → Database Column: "emailInput"
Form Field ID: "passwordInput" → Database Column: "passwordInput"
```

**Method 2: Manual Field Mapping (Recommended)**

In the `db.create` block properties, you'll see **"Data to Insert"** or **"Fields"** section:

1. Click **"Add Field"** or **"Add Column"**
2. For each database column, add a field:

   **Field 1: Email**
   - **Column Name:** `email`
   - **Value:** `{{formData.textfield-123}}`
     - Replace `textfield-123` with your actual email field ID
     - Or use: `{{formData.emailInput}}` if you named it

   **Field 2: Password**
   - **Column Name:** `password`
   - **Value:** `{{formData.textfield-456}}`
     - Replace `textfield-456` with your actual password field ID
     - Or use: `{{formData.passwordInput}}` if you named it

   **Field 3: Name (Optional)**
   - **Column Name:** `name`
   - **Value:** `{{formData.nameInput}}` (if you have a name field)

---

### Step 3: Understanding the Mapping Syntax

**Available Variables in db.create:**

1. **Form Data:**
   ```javascript
   {{formData.<fieldId>}}        // Access by field ID
   {{formData.emailInput}}        // If field has name="emailInput"
   ```

2. **Context Variables:**
   ```javascript
   {{email}}                      // If onSubmit added it to context
   {{password}}                   // Direct context access
   ```

3. **Static Values:**
   ```javascript
   "user"                         // Plain text
   {{new Date().toISOString()}}   // Current timestamp (if supported)
   ```

---

## 3. Complete Workflow Example

### Visual Flow:
```
┌─────────────────┐
│   Signup Form   │
│  - Email Input  │
│  - Password Input│
│  - Submit Button│
└────────┬────────┘
         │ User clicks Submit
         ▼
┌─────────────────┐
│   onSubmit      │ ← Captures form data
│                 │   formData = {
│                 │     "textfield-123": "user@example.com",
│                 │     "textfield-456": "mypassword123"
│                 │   }
└────────┬────────┘
         │ next
         ▼
┌─────────────────┐
│   db.create     │ ← Maps and inserts data
│                 │   Table: "users"
│                 │   Fields:
│                 │   - email: {{formData.textfield-123}}
│                 │   - password: {{formData.textfield-456}}
└────────┬────────┘
         │ next (on success)
         ▼
┌─────────────────┐
│ page.redirect   │ ← Redirects to dashboard
│                 │   Target Page: "Dashboard" or "Page 2"
└────────┬────────┘
         │ next
         ▼
┌─────────────────┐
│  notify.toast   │ ← Shows success message
│                 │   Message: "Signup successful!"
│                 │   Type: "success"
└─────────────────┘
```

---

## 4. Detailed Configuration Steps

### Step 1: Create Form on Canvas

1. **Add Textfield for Email:**
   - Drag `textfield` element
   - Properties:
     - `name`: `emailInput` (or any name you prefer)
     - `placeholder`: "Enter your email"
     - `type`: "email" (optional, for validation)

2. **Add Textfield for Password:**
   - Drag `textfield` element
   - Properties:
     - `name`: `passwordInput` (or any name you prefer)
     - `placeholder`: "Enter your password"
     - `type`: "password" (important for security)

3. **Add Submit Button:**
   - Drag `button` element
   - Properties:
     - `text`: "Sign Up"
     - `isSubmitButton`: `true` ← **IMPORTANT**
     - `formGroupId`: Select your form group

4. **Group as Form:**
   - Select both textfields
   - Right-click → "Group" → "Form Group"
   - This creates a form group that `onSubmit` can capture

---

### Step 2: Create Workflow

1. **Add onSubmit Block:**
   - In workflow builder, add `onSubmit` trigger
   - Properties:
     - **Form Group:** Select the form group you created
     - This will automatically capture all fields in that group

2. **Add db.create Block:**
   - Connect `onSubmit` → `db.create` (use "next" connector)
   - Properties:
     - **Table Name:** `users`
     - **Data to Insert / Fields:**
       - Click **"Add Field"**
       - **Column:** `email`
       - **Value:** `{{formData.emailInput}}`
       - Click **"Add Field"** again
       - **Column:** `password`
       - **Value:** `{{formData.passwordInput}}`

3. **Add page.redirect Block:**
   - Connect `db.create` → `page.redirect` (use "next" connector)
   - Properties:
     - **Target Page:** Select "Dashboard" or "Page 2"
     - **Method:** "navigate"

4. **Add notify.toast Block:**
   - Connect `page.redirect` → `notify.toast` (use "next" connector)
   - Properties:
     - **Title:** "Success"
     - **Description:** "Signup successful! Welcome!"
     - **Variant:** "success"

---

## 5. How to Find Your Field IDs

**Method 1: Check Element Properties**
1. Click on your textfield element in canvas
2. Look at the properties panel
3. Find the `id` field (e.g., `textfield-1763631400397`)
4. Use this in your mapping: `{{formData.textfield-1763631400397}}`

**Method 2: Check Element Name**
1. If you set a `name` property (e.g., `emailInput`)
2. You can use: `{{formData.emailInput}}`
3. But the actual key in `formData` might still be the element ID

**Method 3: Check Browser Console**
1. Open browser console (F12)
2. Submit the form
3. Look for logs showing `formData` object
4. See what keys are available

---

## 6. Common Mapping Examples

### Example 1: Simple Email/Password Signup
```javascript
// db.create Fields:
{
  email: "{{formData.emailInput}}",
  password: "{{formData.passwordInput}}"
}
```

### Example 2: Full User Profile
```javascript
// db.create Fields:
{
  email: "{{formData.emailInput}}",
  password: "{{formData.passwordInput}}",
  name: "{{formData.nameInput}}",
  phone: "{{formData.phoneInput}}",
  age: "{{formData.ageInput}}"
}
```

### Example 3: Mixed Static and Dynamic
```javascript
// db.create Fields:
{
  email: "{{formData.emailInput}}",
  password: "{{formData.passwordInput}}",
  role: "user",  // Static value
  status: "active",  // Static value
  created_at: "{{new Date().toISOString()}}"  // Dynamic timestamp
}
```

---

## 7. Testing Your Workflow

### Step 1: Test in Canvas Mode
1. Fill out the form
2. Click submit button
3. Check browser console for logs:
   - `[ON-SUBMIT]` logs showing formData
   - `[DB-CREATE]` logs showing data insertion
   - Check if data was inserted successfully

### Step 2: Verify Database
1. Go to **Database** section
2. Find your `users` table
3. Check if new record was created
4. Verify email and password are stored

### Step 3: Test in Run Mode
1. Click **"Run App"** button
2. Navigate to signup page
3. Fill form and submit
4. Verify:
   - Redirect happens
   - Toast notification appears
   - Data is saved in database

---

## 8. Important Security Notes

### ⚠️ Password Security

**CRITICAL:** The `db.create` block stores passwords as **plain text** by default!

**For Production, you MUST hash passwords:**

**Option 1: Use RoleIs Block (Recommended)**
```
onSubmit → RoleIs → page.redirect → notify.toast
```

The `RoleIs` block:
- Automatically hashes passwords with bcrypt
- Creates user in `AppUser` table
- Handles authentication
- Manages roles and page access

**Option 2: Add Password Hashing**
- Before `db.create`, add a `code` block or `http.request` to hash password
- Then pass hashed password to `db.create`

---

## 9. Troubleshooting

### Problem: Data Not Inserting

**Check:**
1. Field IDs in `formData` match what you're using in `db.create`
2. Column names in database match what you're using
3. Check browser console for errors
4. Check backend logs for `[DB-CREATE]` errors

**Solution:**
- Use exact field IDs from form
- Verify table exists or let `db.create` create it
- Check data types match (text, number, etc.)

### Problem: Form Data Not Captured

**Check:**
1. Form fields are grouped in a Form Group
2. Submit button has `isSubmitButton: true`
3. Submit button has correct `formGroupId`
4. `onSubmit` block is connected to the form

**Solution:**
- Re-group form fields
- Verify submit button configuration
- Check `onSubmit` block form group selection

### Problem: Wrong Data in Database

**Check:**
1. Field mapping in `db.create` is correct
2. Using correct field IDs
3. Data types match (text vs number)

**Solution:**
- Double-check field mappings
- Use browser console to see actual `formData` structure
- Verify column types in database

---

## 10. Quick Reference

### Form Data Structure:
```javascript
formData = {
  "<elementId>": "<value>",
  "textfield-123": "user@example.com",
  "textfield-456": "mypassword123"
}
```

### db.create Field Mapping:
```javascript
{
  "<columnName>": "{{formData.<elementId>}}",
  "email": "{{formData.textfield-123}}",
  "password": "{{formData.textfield-456}}"
}
```

### Available Variables:
- `{{formData.<fieldId>}}` - Form field value
- `{{<fieldName>}}` - Direct context access (if added by onSubmit)
- `"static value"` - Plain text value

---

## Summary

1. **Create form** with email and password fields
2. **Group fields** as a Form Group
3. **Add onSubmit** block connected to form
4. **Add db.create** block with field mappings:
   - `email: {{formData.emailInput}}`
   - `password: {{formData.passwordInput}}`
5. **Add page.redirect** to redirect after signup
6. **Add notify.toast** to show success message
7. **Test** in canvas and run mode
8. **Verify** data in database

**For production:** Replace `db.create` with `RoleIs` block for automatic password hashing and user management!




