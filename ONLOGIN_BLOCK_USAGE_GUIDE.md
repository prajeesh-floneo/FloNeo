# onLogin Block - Complete Usage Guide

## 🔐 What is onLogin?

The **onLogin** block is a **trigger block** that automatically executes workflows when a user successfully logs into your FloNeo application.

**Key Point**: Unlike other blocks, onLogin does NOT require you to specify any element ID. It triggers automatically on the login event itself.

---

## 🎯 How onLogin Works

### Automatic Triggering

```
User enters credentials → Clicks Login → Authentication succeeds → onLogin workflows execute
```

**No element configuration needed!** The onLogin block listens to the global login event, not a specific UI element.

---

## 📋 Configuration Options

When you click on the onLogin block in the Workflow Builder, you'll see:

### 1. **Capture User Data** (Checkbox)
- ✅ **Checked** (default): Captures user information (id, email, role, verified status)
- ❌ **Unchecked**: Does not capture user data

### 2. **Store Authentication Token** (Checkbox)
- ✅ **Checked** (default): Stores the JWT authentication token
- ❌ **Unchecked**: Does not store the token

### 3. **Available Context Variables**
These variables are automatically available to downstream blocks:
- `{{context.user.id}}` - User ID
- `{{context.user.email}}` - User email address
- `{{context.user.role}}` - User role (e.g., "admin", "user")
- `{{context.user.verified}}` - Email verification status (true/false)
- `{{context.token}}` - Authentication JWT token
- `{{context.loginTime}}` - Login timestamp

---

## 🧪 Step-by-Step Testing Guide

### Test 1: Basic onLogin Workflow

#### 1. Create the Workflow

1. **Go to Workflows**
   - Navigate to http://localhost:3000
   - Click "Workflows" in sidebar
   - Click "Create New Workflow"

2. **Add onLogin Block**
   - In Block Library → **Triggers** section (blue)
   - Drag **onLogin** block to canvas

3. **Configure onLogin**
   - Click on the onLogin block
   - ✅ Check "Capture User Data"
   - ✅ Check "Store Authentication Token"

4. **Add notify.toast Block**
   - In Block Library → **Actions** section (purple)
   - Drag **notify.toast** block to canvas

5. **Configure notify.toast**
   - Click on the notify.toast block
   - **Message**: `Welcome back, {{context.user.email}}!`
   - **Title**: "Login Successful"
   - **Variant**: "success"
   - **Duration**: 5000

6. **Connect the Blocks**
   - Hover over onLogin block
   - Click and drag from the blue "next" dot
   - Connect to notify.toast block

7. **Save the Workflow**
   - Click "Save Workflow"
   - Name: "Welcome Message on Login"
   - Click "Save"

#### 2. Test the Workflow

1. **Logout**
   - Click your profile icon
   - Click "Logout"

2. **Login Again**
   - Enter your credentials
   - Click "Login"

3. **Expected Results**
   - ✅ Green toast appears: "Welcome back, your-email@example.com!"
   - ✅ Toast shows "Login Successful" title
   - ✅ Toast disappears after 5 seconds

4. **Verify in Console** (Press F12)
   ```
   🔐 [ON-LOGIN] Processing login event
   🔐 [ON-LOGIN] Login configuration: { captureUserData: true, storeToken: true }
   [WF-EXEC] Starting workflow execution
   [NOTIFY-TOAST] Showing toast: Welcome back, demo@example.com!
   ```

5. **Verify in Backend Logs**
   ```bash
   docker-compose logs backend --tail=20
   ```
   Look for:
   ```
   🔐 [ON-LOGIN] Processing login event for app
   🔐 [ON-LOGIN] User data captured: { id: 1, email: 'demo@example.com', role: 'user' }
   ```

---

### Test 2: onLogin with Conditional Logic

#### Workflow: Show Different Messages Based on User Role

1. **Create Workflow**
   - onLogin → match → Two notify.toast blocks

2. **Configure onLogin**
   - ✅ Capture User Data
   - ✅ Store Authentication Token

3. **Configure match Block**
   - **Left Value**: `{{context.user.role}}`
   - **Right Value**: "admin"
   - **Comparison Type**: "text"
   - **Operator**: "equals"
   - ✅ Ignore Case

4. **Configure First Toast** (for admins - "yes" path)
   - **Message**: "Welcome Admin! You have full access."
   - **Variant**: "success"

5. **Configure Second Toast** (for regular users - "no" path)
   - **Message**: "Welcome User! Enjoy your session."
   - **Variant**: "default"

6. **Connect Blocks**
   - onLogin → match (blue "next")
   - match → First toast (green "yes")
   - match → Second toast (red "no")

7. **Test**
   - Login as admin → See admin message
   - Login as regular user → See user message

---

### Test 3: onLogin with Database Update

#### Workflow: Log User Login Activity

1. **Create Workflow**
   - onLogin → db.update → notify.toast

2. **Configure onLogin**
   - ✅ Capture User Data
   - ✅ Store Authentication Token

3. **Configure db.update**
   - **Table**: "User"
   - **Where Conditions**:
     ```json
     [
       {
         "field": "id",
         "operator": "equals",
         "value": "{{context.user.id}}"
       }
     ]
     ```
   - **Update Data**:
     ```json
     {
       "lastLogin": "{{context.loginTime}}"
     }
     ```
   - ✅ Return Updated Records

4. **Configure notify.toast**
   - **Message**: "Last login updated successfully!"
   - **Variant**: "success"

5. **Connect and Test**
   - Login → Database updates lastLogin timestamp → Toast confirms

---

## ❓ Common Questions

### Q1: Do I need to specify an element ID for onLogin?
**A**: No! onLogin triggers automatically on the login event. You don't need to configure any element ID.

### Q2: Can I have multiple onLogin workflows?
**A**: Yes! All onLogin workflows will execute when a user logs in. They run in parallel.

### Q3: What if I don't check "Capture User Data"?
**A**: The context variables (user.id, user.email, etc.) will not be available to downstream blocks.

### Q4: When exactly does onLogin trigger?
**A**: onLogin triggers immediately after successful authentication, before the user is redirected to the app.

### Q5: Can I use onLogin to redirect users based on their role?
**A**: Yes! Use onLogin → match (check role) → page.redirect

---

## 🎯 Example Use Cases

### 1. **Welcome Message**
```
onLogin → notify.toast
Message: "Welcome back, {{context.user.email}}!"
```

### 2. **Role-Based Redirect**
```
onLogin → match (check role) → page.redirect
If admin → redirect to /admin
If user → redirect to /dashboard
```

### 3. **Log Login Activity**
```
onLogin → db.update
Update User table with lastLogin timestamp
```

### 4. **Send Welcome Email**
```
onLogin → api.call (send email)
Send welcome email to {{context.user.email}}
```

### 5. **Load User Preferences**
```
onLogin → db.find (get user preferences) → notify.toast
Show personalized welcome message
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow doesn't trigger on login | Check if workflow is saved, verify onLogin block is configured |
| Context variables are empty | Ensure "Capture User Data" is checked |
| Multiple toasts appear | Normal if multiple onLogin workflows exist |
| Workflow triggers on page load | Check if you accidentally used onPageLoad instead of onLogin |

---

## ✅ Quick Checklist

- [ ] onLogin block added to workflow
- [ ] "Capture User Data" checked (if using context variables)
- [ ] "Store Authentication Token" checked (if needed)
- [ ] Connected to downstream blocks (notify.toast, db.update, etc.)
- [ ] Workflow saved
- [ ] Tested by logging out and logging back in
- [ ] Console logs show `[ON-LOGIN]` messages
- [ ] Expected behavior occurs (toast, redirect, database update, etc.)

---

## 🎉 Summary

**onLogin is simple to use:**
1. ✅ No element ID required
2. ✅ Triggers automatically on login
3. ✅ Provides user data via context variables
4. ✅ Works with all downstream blocks
5. ✅ Can have multiple workflows

**Perfect for:**
- Welcome messages
- Role-based redirects
- Login activity logging
- User preference loading
- Personalized experiences

**Ready to test!** 🚀

