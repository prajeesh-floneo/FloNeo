# 🔍 Complete Debugging Steps for onSubmit Issue

## The Flow

Here's what should happen when you click a submit button:

```
1. User clicks submit button
   ↓
2. handleElementClick() is called
   ↓
3. Check if button is marked as submit button
   ↓
4. Get formGroupId from button properties
   ↓
5. Collect form data from all elements in that form group
   ↓
6. Create lookup key: formGroup:${formGroupId}:submit
   ↓
7. Look up workflows in workflowIndex using that key
   ↓
8. If found, execute workflows
   ↓
9. If NOT found, log "No workflow found"
```

## 🎯 Step-by-Step Debugging

### Step 1: Check Workflow Indexing
**Look for these logs in console:**

```
[WF-INDEX] 🔍 Trigger node data details: {
  label: "onSubmit",
  selectedFormGroup: "form_group",
  ...
}
```

**Questions:**
- [ ] Is `label` = "onSubmit"?
- [ ] Is `selectedFormGroup` defined (not undefined)?
- [ ] What is the exact value of `selectedFormGroup`?

**If selectedFormGroup is undefined:**
- ❌ PROBLEM: Workflow trigger not configured
- ✅ SOLUTION: Open workflow builder, select form group in trigger config

### Step 2: Check Indexing Result
**Look for these logs:**

```
[WF-INDEX] ✅ OnSubmit indexed by form group: formGroup:XXXXX:submit
```

**Questions:**
- [ ] Do you see this log?
- [ ] What is the exact key? (e.g., `formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit`)

**If you see a warning instead:**
```
[WF-INDEX] ⚠️ OnSubmit trigger found but NO form group selected
```
- ❌ PROBLEM: selectedFormGroup is undefined
- ✅ SOLUTION: Configure form group in workflow trigger

### Step 3: Check Final Index
**Look for:**

```
[WF-INDEX] ✅ Final index keys: [...]
```

**Expand the array and look for:**
```
"formGroup:XXXXX:submit"
```

**Questions:**
- [ ] Is this key in the final index?
- [ ] What is the exact key value?

### Step 4: Click the Submit Button
**Look for these logs:**

```
🎯 LIVE PREVIEW: Button clicked: [buttonId]
```

**Then look for:**

```
[CLICK] Button [buttonId] is marked as submit button for form group [formGroupId]
```

**Questions:**
- [ ] Do you see this log?
- [ ] What is the exact formGroupId? (e.g., `form_group_1Tn1Tn1Tn1Tn1Tn1`)

### Step 5: Check Form Data Collection
**Look for:**

```
[SUBMIT] Collected form data - [elementId]: [value]
[SUBMIT] Form data collected: {...}
```

**Questions:**
- [ ] Do you see these logs?
- [ ] Is form data being collected correctly?

### Step 6: Check Workflow Lookup
**Look for:**

```
[SUBMIT] Found X workflow(s) for formGroup:XXXXX:submit
```

**Questions:**
- [ ] Do you see this log?
- [ ] What is the value of X?
  - If X > 0: ✅ Workflow found
  - If X = 0: ❌ Workflow NOT found

**If workflow NOT found:**
```
[SUBMIT] No workflow found for formGroup:XXXXX:submit
```

## 🔴 The Key Comparison

This is the CRITICAL step:

**Indexing (from Step 2):**
```
formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit
```

**Lookup (from Step 6):**
```
formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit
```

**Do they match?**
- ✅ YES: Workflow will be found
- ❌ NO: Workflow will NOT be found

## 📋 Debugging Checklist

- [ ] **Step 1:** selectedFormGroup is defined
- [ ] **Step 2:** Workflow indexed with correct key
- [ ] **Step 3:** Key is in final index
- [ ] **Step 4:** Button recognized as submit button
- [ ] **Step 5:** Form data collected
- [ ] **Step 6:** Workflow found in index

## 🚀 What to Do Next

1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Refresh the page**
4. **Follow Steps 1-6 above**
5. **Take screenshots of the logs**
6. **Report findings**

## 📝 Report Template

When you report findings, include:

```
Step 1: selectedFormGroup = "???"
Step 2: Indexed key = "formGroup:???:submit"
Step 3: Key in final index? YES/NO
Step 4: Button formGroupId = "???"
Step 5: Form data collected? YES/NO
Step 6: Workflows found? X (0 or more)

Key comparison:
- Indexed: formGroup:???:submit
- Lookup: formGroup:???:submit
- Match? YES/NO
```

---

**Status: READY FOR DEBUGGING** ✅

