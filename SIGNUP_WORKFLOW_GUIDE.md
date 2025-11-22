# Signup Workflow Guide

## Overview
This guide explains how to create a signup workflow that saves user data (email, password) to a database table when users submit a signup form.

## Workflow Structure
```
onSubmit → db.create → page.redirect → notify.toast
```

## Step-by-Step Setup

### 1. Create the Signup Form

1. **Add Form Fields:**
   - Add a `textfield` element for "Email"
   - Add a `textfield` element for "Password" (set type to "password" in properties)
   - Add a `button` element labeled "SignUp" or "Submit"

2. **Group Fields as Form:**
   - Select both textfield elements
   - Group them as a "Form" (this creates a form group)
   - The button should have `isSubmitButton: true` and `formGroupId` matching the form group

### 2. Configure onSubmit Trigger

1. **Add onSubmit Block:**
   - Click on the submit button
   - In the properties panel, go to "Interactions" or "Workflow"
   - Add an `onSubmit` trigger block
   - This will automatically capture form data when the button is clicked

### 3. Configure db.create Block

1. **Add db.create Block:**
   - Connect `onSubmit` → `db.create` (use "next" connector)

2. **Configure db.create Settings:**
   - **Table Name:** Enter your table name (e.g., `users`, `signup_users`, `app_users`)
   - **Data Source:** Select "Form Data" or "onSubmit Data"
   - **Fields Mapping:**
     - Map `email` field from form to `email` column in table
     - Map `password` field from form to `password` column in table
     - Add any other fields you want to save (e.g., `name`, `created_at`)

3. **Table Structure:**
   The db.create block will automatically create a table with these columns:
   - `id` (auto-increment)
   - `email` (text)
   - `password` (text) - **IMPORTANT: Store hashed passwords, not plain text!**
   - `app_id` (number) - automatically added
   - `created_at` (timestamp) - automatically added
   - `updated_at` (timestamp) - automatically added

### 4. Configure page.redirect Block

1. **Add page.redirect Block:**
   - Connect `db.create` → `page.redirect` (use "next" connector)

2. **Configure Redirect:**
   - **Target Page:** Select the page to redirect to after signup (e.g., "Page 2", "Login Page", "Dashboard")
   - **Method:** Choose redirect method (usually "navigate")

### 5. Configure notify.toast Block

1. **Add notify.toast Block:**
   - Connect `page.redirect` → `notify.toast` (use "next" connector)

2. **Configure Toast:**
   - **Message:** "Signup successful! Welcome!"
   - **Type:** "success"
   - **Duration:** 3000 (3 seconds)

## Complete Workflow Example

```
┌─────────────┐
│  onSubmit   │ ← Triggered when form is submitted
└──────┬──────┘
       │ next
       ▼
┌─────────────┐
│  db.create  │ ← Creates table and inserts user data
│             │   Table: "users"
│             │   Data: { email: formData.email, password: formData.password }
└──────┬──────┘
       │ next
       ▼
┌─────────────┐
│page.redirect│ ← Redirects to success page
│             │   Target: "Page 2" or "Dashboard"
└──────┬──────┘
       │ next
       ▼
┌─────────────┐
│notify.toast │ ← Shows success message
│             │   Message: "Signup successful!"
└─────────────┘
```

## Important Security Notes

### ⚠️ Password Hashing
**CRITICAL:** Never store passwords in plain text!

1. **Option 1: Use RoleIs Block (Recommended)**
   - After `db.create`, add a `RoleIs` block
   - The RoleIs block automatically hashes passwords using bcrypt
   - It also creates user records in the `AppUser` table with proper authentication

2. **Option 2: Hash in Workflow**
   - Add a `script` or `function` block before `db.create`
   - Use bcrypt to hash the password
   - Then pass the hashed password to `db.create`

### Recommended Workflow with RoleIs

```
onSubmit → RoleIs → page.redirect → notify.toast
```

The `RoleIs` block will:
- Hash the password automatically
- Create user in `AppUser` table
- Assign role and page access
- Return user data

## Testing the Workflow

1. **Test in Canvas:**
   - Fill in the form fields
   - Click the submit button
   - Check browser console for workflow execution logs

2. **Verify Database:**
   - Go to Database section
   - Check if the table was created
   - Verify that user data was inserted

3. **Test in Run Mode:**
   - Click "Run App" button
   - Fill the form and submit
   - Verify redirect and toast notification

## Troubleshooting

### Table Not Created
- Check if `db.create` block is properly configured
- Verify table name is valid (no spaces, special characters)
- Check backend logs for errors

### Data Not Inserted
- Verify form fields are properly grouped
- Check field names match in form and db.create mapping
- Ensure `onSubmit` trigger is connected to the form

### Redirect Not Working
- Verify target page exists
- Check page ID is correct
- Ensure `page.redirect` is connected after `db.create`

### Toast Not Showing
- Check if `notify.toast` block is properly configured
- Verify it's connected in the workflow
- Check browser console for errors

## Next Steps: Merge with RoleIs

After basic signup works, you can enhance it:

1. **Replace db.create with RoleIs:**
   ```
   onSubmit → RoleIs → page.redirect → notify.toast
   ```

2. **RoleIs Configuration:**
   - **Email Field:** Map from form email
   - **Password Field:** Map from form password
   - **Role:** Assign default role (e.g., "user", "member")
   - **Page Access:** Select which pages user can access

3. **Benefits:**
   - Automatic password hashing
   - User authentication ready
   - Role-based access control
   - Page access management

## Example: Complete Signup with RoleIs

```
onSubmit
  ↓ (next)
RoleIs
  - Email: {{formData.email}}
  - Password: {{formData.password}}
  - Role: "user"
  - Pages: ["page-1", "page-2"]
  ↓ (yes - if user created successfully)
page.redirect
  - Target: "page-2" (Dashboard)
  ↓ (next)
notify.toast
  - Message: "Welcome! Account created successfully."
  - Type: "success"
```

This workflow will:
1. Capture form data on submit
2. Create user with hashed password
3. Assign role and page access
4. Redirect to dashboard
5. Show success message




