# Quick Testing Guide - Tasks 1 & 2

## 🚀 FASTEST WAY TO TEST

---

## ✅ TASK 2: Password Field Element

### **Test 1: Verify Element Appears (30 seconds)**

```
1. Open FloNeo → Login
2. Create/Open an app
3. Go to Canvas page
4. Click "Form" tab in element toolbar (left side)
5. Scroll down to find "Password Field" with 🔒 Lock icon
```

**Expected**: Password Field appears in the form elements list

---

### **Test 2: Drag to Canvas (1 minute)**

```
1. Drag "Password Field" from toolbar
2. Drop it on the canvas
3. Verify it renders as a password input field
```

**Expected**: 
- Password field appears on canvas
- Shows placeholder text: "Enter password"
- Input is masked (shows dots/asterisks when typing)

---

### **Test 3: Configure Properties (2 minutes)**

```
1. Click on the password field to select it
2. Look at properties panel on the right
3. Find "Password Field" properties section
4. Change placeholder to "Enter your password"
5. Check "Required Field" checkbox
6. Change minimum length to 12
7. Change maximum length to 64
```

**Expected**:
- Properties panel shows password field options
- All changes apply immediately
- Placeholder updates on canvas

---

### **Test 4: Test in Run Mode (3 minutes)**

```
1. Add a form group:
   - Add password field
   - Add submit button
   - Group them together (select both → right-click → Create Form Group)

2. Create workflow:
   - Select submit button
   - Open Workflow Builder
   - Create: onSubmit → notify.toast
   - Configure toast: "Password: {{context.formData.password-xxx}}"
   - Save workflow

3. Go to Run mode
4. Enter password: "MySecurePass123"
5. Click submit button
```

**Expected**:
- Toast appears showing the password value
- Password is captured in formData
- Form submission works correctly

---

## ✅ TASK 1: auth.verify Configuration Panel

### **Test 1: Verify Configuration Panel Appears (30 seconds)**

```
1. Open FloNeo → Login
2. Create/Open an app
3. Go to Workflow Builder
4. Drag "auth.verify" block from Actions category
5. Drop it on the canvas
6. Click on the auth.verify block to select it
```

**Expected**: Configuration panel appears below the block with these options:
- Token Source dropdown
- Require Verified checkbox
- Required Role input
- Validate Expiration checkbox
- Check Blacklist checkbox
- Purple help panel at bottom

---

### **Test 2: Configure Options (2 minutes)**

```
1. Select auth.verify block
2. Change Token Source to "From Authorization Header"
3. Uncheck "Require Verified"
4. Enter "admin" in Required Role field
5. Uncheck "Validate Expiration"
6. Keep "Check Blacklist" checked
```

**Expected**:
- All options change immediately
- Configuration saves to the block
- No errors in console

---

### **Test 3: Test Configuration Persistence (1 minute)**

```
1. Configure auth.verify block (as above)
2. Save the workflow
3. Refresh the page
4. Open the same workflow
5. Select auth.verify block
6. Verify all configuration is still there
```

**Expected**:
- All configuration persists after refresh
- Token Source: "header"
- Require Verified: unchecked
- Required Role: "admin"
- Validate Expiration: unchecked
- Check Blacklist: checked

---

### **Test 4: Test Workflow Execution (5 minutes)**

```
1. Create this workflow:
   onClick → auth.verify → notify.toast

2. Configure auth.verify:
   - Token Source: "context"
   - Require Verified: checked
   - Required Role: "developer"
   - Validate Expiration: checked
   - Check Blacklist: checked

3. Configure notify.toast:
   - Message: "Auth verified! User: {{context.user.email}}"
   - Type: Success

4. Save workflow

5. Go to Run mode

6. Click the button
```

**Expected**:
- Workflow executes
- auth.verify receives configuration
- Toast shows user email if authenticated
- Check backend logs for configuration details

---

## 🔍 VISUAL VERIFICATION

### Password Field Should Look Like:

```
┌─────────────────────────────────────┐
│  Form Elements                      │
├─────────────────────────────────────┤
│  📝 Text Field                      │
│  📝 Text Area                       │
│  🔘 Button                          │
│  ☑️  Checkbox                       │
│  ⭕ Radio Button                    │
│  ▼  Dropdown                        │
│  🔄 Toggle Switch                   │
│  📞 Phone Field                     │
│  🔒 Password Field  ← NEW!          │
│  📅 Date Picker                     │
└─────────────────────────────────────┘
```

### auth.verify Configuration Panel Should Look Like:

```
┌─────────────────────────────────────┐
│  auth.verify                        │
│  Unlock access                      │
├─────────────────────────────────────┤
│  Token Source:                      │
│  [From Context (Workflow) ▼]        │
│  Where to get the authentication... │
│                                     │
│  ☑️ Require Verified User           │
│                                     │
│  Required Role (Optional):          │
│  [developer, admin, user, etc.]     │
│  Leave empty to allow any role      │
│                                     │
│  ☑️ Validate Token Expiration       │
│                                     │
│  ☑️ Check Token Blacklist           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Authentication Configuration│   │
│  │ • Token Source: Where to... │   │
│  │ • Require Verified: User... │   │
│  │ • Required Role: Specific...│   │
│  │ • Validate Expiration: ...  │   │
│  │ • Check Blacklist: Verify...│   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Password Field:

**Issue**: Password field not appearing in element toolbar  
**Solution**: Refresh the page, clear browser cache

**Issue**: Password shows as plain text  
**Solution**: Check browser console for errors, verify getInputType() function

**Issue**: Properties panel not showing  
**Solution**: Make sure password field is selected (click on it)

**Issue**: Form submission not capturing password  
**Solution**: Verify password field is in a form group

---

### auth.verify Configuration:

**Issue**: Configuration panel not appearing  
**Solution**: Make sure auth.verify block is selected (click on it)

**Issue**: Configuration not saving  
**Solution**: Check browser console for errors, verify workflow saves

**Issue**: Backend not receiving configuration  
**Solution**: Check network tab, verify workflow execution payload

**Issue**: Checkboxes not working  
**Solution**: Refresh page, check for JavaScript errors

---

## ✅ QUICK CHECKLIST

### Before Testing:
- [ ] Backend server running (port 5000)
- [ ] Frontend server running (port 3000)
- [ ] Logged in to FloNeo
- [ ] Have an app created

### Password Field:
- [ ] Element appears in toolbar
- [ ] Can drag to canvas
- [ ] Renders as password input
- [ ] Properties panel works
- [ ] Form submission works

### auth.verify:
- [ ] Configuration panel appears
- [ ] All options configurable
- [ ] Configuration persists
- [ ] Workflow executes with config

---

## 🎯 SUCCESS CRITERIA

### Password Field: ✅
- Appears in Form category
- Drag-and-drop works
- Masked input (password type)
- Properties configurable
- Form integration works

### auth.verify: ✅
- Configuration panel visible
- 5 configuration options work
- Help panel displays
- Configuration saves
- Backend receives config

---

## 📞 NEED HELP?

### Check These Files:
1. `IMPLEMENTATION_COMPLETE_TASKS_1_AND_2.md` - Full implementation details
2. `TASK_ANALYSIS_AND_IMPLEMENTATION_PLAN.md` - Original analysis
3. Browser console - For JavaScript errors
4. Backend logs - For workflow execution details

### Debug Commands:
```bash
# Check backend logs
cd server
npm run dev

# Check frontend logs
# Open browser console (F12)
# Look for errors or warnings
```

---

## 🎉 EXPECTED RESULTS

If everything works correctly:

✅ **Password Field**:
- Visible in element toolbar
- Draggable to canvas
- Configurable via properties panel
- Works in form submissions
- Secure (masked input)

✅ **auth.verify Configuration**:
- Configuration panel visible
- All 5 options work
- Configuration persists
- Backend receives configuration
- Workflow executes correctly

**Total Testing Time**: ~15 minutes for both tasks

---

**Ready to test? Start with Password Field (easier), then move to auth.verify!** 🚀

