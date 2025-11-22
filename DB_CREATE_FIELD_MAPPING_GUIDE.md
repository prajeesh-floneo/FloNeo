# db.create Field Mapping Guide

## Problem
When using `db.create` with form data, it uses element IDs (like `textfield-1763703120651`, `password-1763718997244`) as column names instead of meaningful field names (like `email`, `password`).

## Solution: Manual Field Mapping in db.create

### Step 1: Configure db.create Block

1. **Add db.create block** to your workflow
2. **Set Table Name** (e.g., `users`, `signup_data`)
3. **Configure "Data to Insert" / "Fields" section:**

#### Method 1: Manual Field Mapping (Recommended)

In the `db.create` block properties, you'll see a section for **"Data to Insert"** or **"Fields"**:

1. Click **"Add Field"** or **"Add Column"**
2. For each database column, configure:

   **Field 1: Email**
   - **Column Name:** `email` (this is your database column name)
   - **Value:** `{{formData.textfield-1763703120651}}`
     - Replace `textfield-1763703120651` with your actual email field ID
     - Or use the field name if you set one: `{{formData.emailInput}}`

   **Field 2: Password**
   - **Column Name:** `password` (this is your database column name)
   - **Value:** `{{formData.password-1763718997244}}`
     - Replace `password-1763718997244` with your actual password field ID
     - Or use the field name if you set one: `{{formData.passwordInput}}`

### Step 2: Understanding the Mapping

**The key is:**
- **Column Name** = Database column name (what you want in your table)
- **Value** = Form field reference (where to get the data from)

**Example:**
```
Column Name: email
Value: {{formData.textfield-1763703120651}}

This means:
- Database column will be named: "email"
- Data will come from form field with ID: "textfield-1763703120651"
```

### Step 3: Complete Example

**Form Fields:**
- Email field ID: `textfield-1763703120651`
- Password field ID: `password-1763718997244`

**db.create Configuration:**
```
Table Name: users

Fields:
1. Column: email
   Value: {{formData.textfield-1763703120651}}

2. Column: password
   Value: {{formData.password-1763718997244}}
```

**Result:**
- Database table: `app_3_users`
- Columns: `email`, `password` (not `textfield-1763703120651`, `password-1763718997244`)

## How to Find Your Field IDs

### Method 1: Check Element Properties
1. Click on your textfield/password field in canvas
2. Look at the properties panel
3. Find the `id` field (e.g., `textfield-1763703120651`)
4. Use this in your mapping: `{{formData.textfield-1763703120651}}`

### Method 2: Check Browser Console
1. Open browser console (F12)
2. Submit the form
3. Look for logs showing `formData` object
4. See what keys are available

### Method 3: Use Field Names (If Set)
If you set a `name` property on your form fields:
- Email field: `name="emailInput"`
- Password field: `name="passwordInput"`

Then you can use:
- `{{formData.emailInput}}`
- `{{formData.passwordInput}}`

**Note:** The actual key in `formData` might still be the element ID, so check the console first.

## Common Issues and Solutions

### Issue 1: Column Name Validation Error
**Error:** `Column name contains forbidden pattern: password_1763718997244`

**Cause:** The system tried to use the element ID as a column name, and it contains "password" which was blocked.

**Solution:** Use manual field mapping (Method 1 above) to set proper column names like `email` and `password`.

### Issue 2: Data Not Inserting
**Cause:** Field ID mismatch or incorrect mapping.

**Solution:**
1. Check browser console for actual `formData` keys
2. Verify field IDs match in db.create configuration
3. Ensure column names are valid (letters, numbers, underscores only)

### Issue 3: Element IDs Change
**Cause:** Element IDs are auto-generated and may change.

**Solution:**
1. Set `name` properties on form fields for stable references
2. Use manual field mapping in db.create
3. Or use field names if supported

## Best Practices

1. **Always use manual field mapping** for production
2. **Use meaningful column names** (email, password, name, etc.)
3. **Set `name` properties** on form fields for easier reference
4. **Test in console** to verify formData structure
5. **Document your mappings** for future reference

## Example: Complete Signup Workflow

```
onSubmit
  ↓
db.create
  Table: users
  Fields:
    - Column: email, Value: {{formData.textfield-1763703120651}}
    - Column: password, Value: {{formData.password-1763718997244}}
    - Column: name, Value: {{formData.textfield-1763703120652}}
  ↓
page.redirect
  ↓
notify.toast
```

## Summary

**To use field names instead of element IDs:**

1. **Don't rely on automatic mapping** - it uses element IDs
2. **Use manual field mapping** in db.create block
3. **Set Column Name** = Your desired database column name
4. **Set Value** = Reference to form field: `{{formData.<elementId>}}`
5. **Result:** Clean column names in database, proper data mapping

The key is: **Column Name** is what you want in the database, **Value** is where to get the data from the form.




