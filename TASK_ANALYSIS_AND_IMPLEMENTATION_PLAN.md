# Task Analysis and Implementation Plan

## 📋 TASK OVERVIEW

### TASK 1: Add UI Configuration Panel for `auth.verify` Block
Add configuration UI in workflow builder for the `auth.verify` block.

### TASK 2: Add Password Field Element to Canvas (PRIORITY)
Add a new password input field element to the canvas page builder.

---

## 🔍 CODEBASE ANALYSIS

### Current State Analysis:

#### 1. **Password Field Element - Already Partially Implemented!**

**Finding**: Password field is ALREADY implemented in the backend but MISSING from the UI element library!

**Evidence**:
- ✅ `ElementManager.tsx` (Line 189): `PASSWORD_FIELD: 200` width defined
- ✅ `ElementManager.tsx` (Line 210): `PASSWORD_FIELD: 40` height defined
- ✅ `ElementManager.tsx` (Line 270-273): Default properties defined
- ✅ `CanvasRenderer.tsx` (Line 689): `PASSWORD_FIELD` case handled
- ✅ `CanvasRenderer.tsx` (Line 694): `getInputType()` function converts to `type="password"`
- ❌ `element-toolbar.tsx`: **MISSING** from element library array
- ❌ `canvas/page.tsx` (Line 3410): **MISSING** from default properties

**Conclusion**: Password field is 80% implemented! Just needs to be added to the UI element library.

---

#### 2. **auth.verify Block Configuration - Not Implemented**

**Finding**: `auth.verify` block exists but has NO configuration UI.

**Evidence**:
- ✅ Backend handler exists: `server/routes/workflow-execution.js` (Line 1408)
- ✅ Block appears in block library: `client/workflow-builder/components/block-library.tsx`
- ❌ NO configuration panel in `workflow-node.tsx`
- ✅ Other blocks have configuration panels (e.g., `notify.toast`, `db.find`, `match`)

**Pattern Found**: Configuration panels are added in `workflow-node.tsx` using conditional rendering based on `data.label`.

---

## 🚨 POTENTIAL ISSUES & SOLUTIONS

### TASK 2: Password Field Element

#### **Issue 1: Missing Icon Import**
**Problem**: Need to import Lock icon for password field  
**Solution**: Add `Lock` import from `lucide-react` in `element-toolbar.tsx`

#### **Issue 2: Element Type Naming Inconsistency**
**Problem**: Codebase uses both lowercase (`password`) and uppercase (`PASSWORD_FIELD`)  
**Analysis**:
- `element-toolbar.tsx` uses lowercase: `type: "textfield"`, `type: "phone"`
- `ElementManager.tsx` uses uppercase: `PASSWORD_FIELD`, `PHONE_FIELD`
- `CanvasRenderer.tsx` uses uppercase: `case "PASSWORD_FIELD"`

**Solution**: Use lowercase `"password"` in element-toolbar.tsx, add mapping in canvas renderer

#### **Issue 3: getInputType() Function Location**
**Problem**: Need to verify `getInputType()` function handles password type  
**Location**: `client/components/canvas/CanvasRenderer.tsx`  
**Solution**: Check if function exists and returns correct type

#### **Issue 4: Properties Panel Configuration**
**Problem**: Password field needs properties panel for configuration  
**Current State**: `properties-panel.tsx` has phone field example (Line 2930)  
**Solution**: Add password field properties section following same pattern

#### **Issue 5: Form Validation Integration**
**Problem**: Password fields need validation (min length, pattern, required)  
**Solution**: Add validation properties to default properties object

#### **Issue 6: Security Concern - Value Display**
**Problem**: Password values should never be displayed in edit mode  
**Solution**: Always use `type="password"` and never show actual value in properties panel

---

### TASK 1: auth.verify Configuration Panel

#### **Issue 1: Configuration Data Structure**
**Problem**: Need to define configuration options structure  
**Backend Expects**:
```javascript
{
  tokenSource: "context" | "header" | "config",
  requireVerified: boolean,
  requiredRole: string | null,
  validateExpiration: boolean,
  checkBlacklist: boolean
}
```

**Solution**: Add these fields to `WorkflowNodeData` interface

#### **Issue 2: UI Component Pattern**
**Problem**: Need to follow existing configuration panel pattern  
**Pattern Found**: Use conditional rendering in `workflow-node.tsx` around line 1236 (notify.toast example)  
**Solution**: Add similar section for `auth.verify`

#### **Issue 3: Token Source Dropdown**
**Problem**: Need dropdown with 3 options  
**Solution**: Use `<select>` element like in other configurations

#### **Issue 4: Role Input Field**
**Problem**: Should it be text input or dropdown?  
**Analysis**: Roles are dynamic (developer, admin, user, etc.)  
**Solution**: Use text input with placeholder showing examples

#### **Issue 5: Checkbox Components**
**Problem**: Need checkboxes for boolean options  
**Solution**: Use standard HTML checkbox or import from UI library

---

## 📝 IMPLEMENTATION PLAN

### TASK 2: Password Field Element (PRIORITY)

#### **Step 1: Add to Element Library** ✅
**File**: `client/components/element-toolbar.tsx`  
**Location**: After phone field (around line 188)  
**Code**:
```typescript
{
  type: "password",
  icon: Lock,
  label: "Password Field",
  category: "form",
  description: "Secure password input",
}
```

#### **Step 2: Add Icon Import** ✅
**File**: `client/components/element-toolbar.tsx`  
**Location**: Top of file with other imports  
**Code**: Add `Lock` to lucide-react imports

#### **Step 3: Add Default Properties** ✅
**File**: `client/app/canvas/page.tsx`  
**Location**: In `getDefaultProperties` function (around line 3410)  
**Code**:
```typescript
password: {
  placeholder: "Enter password",
  value: "",
  backgroundColor: "#ffffff",
  color: "#000000",
  required: false,
  minLength: 8,
  maxLength: 128,
  pattern: "",
  showStrengthIndicator: false,
}
```

#### **Step 4: Verify Canvas Renderer** ✅
**File**: `client/components/canvas/CanvasRenderer.tsx`  
**Action**: Check if `PASSWORD_FIELD` case exists (Line 689) - Already exists!

#### **Step 5: Add getInputType Mapping** ✅
**File**: `client/components/canvas/CanvasRenderer.tsx`  
**Action**: Verify `getInputType()` function handles password type

#### **Step 6: Add Properties Panel** ✅
**File**: `client/components/properties-panel.tsx`  
**Location**: After phone field properties (around line 2943)  
**Code**: Add password field configuration section

#### **Step 7: Test in Canvas** ✅
- Drag password field to canvas
- Configure properties
- Test in run mode
- Verify form submission captures value

---

### TASK 1: auth.verify Configuration Panel

#### **Step 1: Update WorkflowNodeData Interface** ✅
**File**: `client/workflow-builder/components/workflow-node.tsx`  
**Location**: Around line 60-130  
**Code**:
```typescript
// auth.verify configuration properties
tokenSource?: "context" | "header" | "config";
requireVerified?: boolean;
requiredRole?: string;
validateExpiration?: boolean;
checkBlacklist?: boolean;
```

#### **Step 2: Add Configuration Panel** ✅
**File**: `client/workflow-builder/components/workflow-node.tsx`  
**Location**: After notify.toast configuration (around line 1360)  
**Code**: Add auth.verify configuration section with:
- Token Source dropdown
- Require Verified checkbox
- Required Role text input
- Validate Expiration checkbox
- Check Blacklist checkbox

#### **Step 3: Test Configuration** ✅
- Add auth.verify block to workflow
- Configure options
- Save workflow
- Verify configuration is passed to backend

---

## 🎯 IMPLEMENTATION ORDER

### Phase 1: Password Field Element (30 minutes)
1. ✅ Add Lock icon import
2. ✅ Add password element to element library
3. ✅ Add default properties
4. ✅ Verify canvas renderer
5. ✅ Add properties panel configuration
6. ✅ Test functionality

### Phase 2: auth.verify Configuration (20 minutes)
1. ✅ Update WorkflowNodeData interface
2. ✅ Add configuration panel UI
3. ✅ Test configuration saving
4. ✅ Verify backend receives configuration

---

## ✅ TESTING CHECKLIST

### Password Field Element:
- [ ] Element appears in form category
- [ ] Can drag to canvas
- [ ] Renders as password input (masked)
- [ ] Properties panel shows configuration options
- [ ] Can set placeholder text
- [ ] Can set required field
- [ ] Can set min/max length
- [ ] Form submission captures password value
- [ ] Value is never displayed in plain text
- [ ] Works in both edit and run mode

### auth.verify Configuration:
- [ ] Configuration panel appears when block is selected
- [ ] Token Source dropdown works
- [ ] Require Verified checkbox works
- [ ] Required Role input works
- [ ] Configuration saves to node.data
- [ ] Backend receives configuration
- [ ] Workflow executes with configuration

---

## 🔒 SECURITY CONSIDERATIONS

### Password Field:
1. ✅ Never display password value in properties panel
2. ✅ Always use `type="password"` attribute
3. ✅ Don't log password values to console
4. ✅ Clear password from memory after form submission
5. ✅ Add option for password strength indicator
6. ✅ Support autocomplete="new-password" attribute

### auth.verify:
1. ✅ Token should never be displayed in UI
2. ✅ Configuration should be validated before sending to backend
3. ✅ Role names should be validated (no special characters)

---

## 📦 FILES TO MODIFY

### TASK 2: Password Field
1. `client/components/element-toolbar.tsx` - Add element definition
2. `client/app/canvas/page.tsx` - Add default properties
3. `client/components/properties-panel.tsx` - Add properties panel
4. `client/components/canvas/CanvasRenderer.tsx` - Verify rendering (already done)

### TASK 1: auth.verify
1. `client/workflow-builder/components/workflow-node.tsx` - Add interface + UI

---

## 🚀 READY TO IMPLEMENT

All potential issues identified and solutions prepared. Ready to proceed with implementation!

**Estimated Time**:
- TASK 2 (Password Field): 30 minutes
- TASK 1 (auth.verify Config): 20 minutes
- **Total**: 50 minutes

**Risk Level**: LOW (most code already exists, just needs to be connected)

