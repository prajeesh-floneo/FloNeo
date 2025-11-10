# 🔍 onSubmit Trigger Debugging Guide

## Issue Summary

onSubmit workflows are not being triggered when the submit button is clicked. The issue is likely that:
1. The trigger node is not being detected
2. The trigger node is detected but `selectedFormGroup` is not set
3. The workflow is being indexed with the wrong key

## Enhanced Logging Added

I've added comprehensive logging to help debug this issue. Here's what to look for in the console:

### Step 1: Workflow Loading
```
🔄 RUN: ===== FETCHING WORKFLOWS =====
🔄 RUN: Fetching /api/canvas/workflows/[appId]
🔄 RUN: Workflow status 200
🔄 RUN: Workflow ok: true
🔄 RUN: Workflow data count: X
```

### Step 2: Workflow Processing
```
🔄 RUN: ===== PROCESSING WORKFLOWS =====
🔄 RUN: Processing workflow - key: [elementId], nodes: X, edges: Y
✅ [WF-LOAD] Loaded workflow for element [elementId]: X nodes, Y edges
```

### Step 3: Workflow Indexing
```
[WF-INDEX] Building index from workflows map with X workflows
[WF-INDEX] Workflows map keys: [elementId1, elementId2, ...]
[WF-INDEX] Processing workflow for elementId: [elementId], nodes: X
```

### Step 4: Node Structure Analysis
```
[WF-INDEX] Workflow nodes: [
  {
    id: "node-1",
    label: "onSubmit",
    category: "Triggers",
    type: "workflowNode",
    allDataKeys: ["label", "category", "selectedFormGroup", ...]
  },
  ...
]
```

### Step 5: Trigger Detection
```
[WF-INDEX] ✅ Trigger node found: {
  id: "node-1",
  label: "onSubmit",
  category: "Triggers",
  byCategory: true,
  byFlag: false,
  byLabel: true,
  byPattern: true
}
```

### Step 6: Trigger Node Data Details
```
[WF-INDEX] 🔍 Trigger node data details: {
  label: "onSubmit",
  selectedFormGroup: "form-1",  // THIS IS CRITICAL!
  triggerType: undefined,
  allKeys: ["label", "category", "selectedFormGroup", ...]
}
```

### Step 7: onSubmit Indexing
```
[WF-INDEX] 🎯 Processing onSubmit trigger for elementId: [elementId]
[WF-INDEX] ✅ OnSubmit indexed by form group: formGroup:form-1:submit
```

### Step 8: Final Index
```
[WF-INDEX] ✅ Final index keys: [
  "formGroup:form-1:submit",
  "button-1:click",
  ...
]
```

### Step 9: Form Submission
```
🎯 LIVE PREVIEW: Button clicked: [buttonId]
[CLICK] Button [buttonId] is marked as submit button for form group [formGroupId]
[SUBMIT] Form data collected: {...}
[SUBMIT] Found 1 workflow(s) for formGroup:[formGroupId]:submit
[WF-RUN] Processing node 1: onSubmit
[WF-RUN] Processing node 2: ai.summarize
[WF-RUN] Workflow execution completed successfully
```

## Debugging Checklist

### ✅ Check 1: Workflows are Loading
Look for: `🔄 RUN: Workflow data count: X` (X should be > 0)

**If not found:**
- Check network tab for `/api/canvas/workflows/[appId]` request
- Verify response status is 200
- Check if workflows exist in the database

### ✅ Check 2: Trigger Node is Detected
Look for: `[WF-INDEX] ✅ Trigger node found: { label: "onSubmit" }`

**If not found:**
- Check `[WF-INDEX] Workflow nodes:` to see actual node structure
- Verify node has `label: "onSubmit"`
- Verify node has `category: "Triggers"`

### ✅ Check 3: selectedFormGroup is Set
Look for: `selectedFormGroup: "form-1"` in trigger node data details

**If not found:**
- This is the ROOT CAUSE!
- The onSubmit trigger node doesn't have `selectedFormGroup` set
- Need to check workflow builder to ensure form group is selected

### ✅ Check 4: Workflow is Indexed Correctly
Look for: `[WF-INDEX] ✅ OnSubmit indexed by form group: formGroup:form-1:submit`

**If not found:**
- Check if trigger node was detected (Check 2)
- Check if selectedFormGroup is set (Check 3)

### ✅ Check 5: Button is Recognized as Submit Button
Look for: `[CLICK] Button [buttonId] is marked as submit button for form group [formGroupId]`

**If not found:**
- Check if button has `isSubmitButton: true` in properties
- Check if button has `formGroupId` in properties
- Check if form group exists in page.groups

### ✅ Check 6: Workflow is Found on Submit
Look for: `[SUBMIT] Found 1 workflow(s) for formGroup:[formGroupId]:submit`

**If not found:**
- Check if indexing key matches lookup key
- Verify form group ID is the same in both places

### ✅ Check 7: Workflow Executes
Look for: `[WF-RUN] Workflow execution completed successfully`

**If not found:**
- Check for errors in workflow execution
- Check block configuration

## Common Issues and Solutions

### Issue 1: selectedFormGroup is undefined
**Symptom:** `selectedFormGroup: undefined` in trigger node data

**Solution:**
1. Open workflow builder
2. Click on onSubmit trigger node
3. In configuration panel, select the form group from dropdown
4. Save workflow
5. Refresh preview

### Issue 2: Button not recognized as submit button
**Symptom:** `[CLICK] Button [buttonId] is marked as submit button` NOT found

**Solution:**
1. Check button properties in canvas
2. Verify `isSubmitButton: true`
3. Verify `formGroupId` matches form group ID
4. Refresh preview

### Issue 3: Form group ID mismatch
**Symptom:** Indexing key `formGroup:form-1:submit` but lookup key `formGroup:form-2:submit`

**Solution:**
1. Verify form group ID in workflow trigger node
2. Verify form group ID in button properties
3. Make sure they match exactly
4. Refresh preview

### Issue 4: Workflow not in index
**Symptom:** `[SUBMIT] No workflow found for formGroup:[formGroupId]:submit`

**Solution:**
1. Check `[WF-INDEX] ✅ Final index keys:` to see all indexed keys
2. Verify `formGroup:[formGroupId]:submit` is in the list
3. If not, check trigger detection (Check 2)
4. If yes, check form group ID match (Issue 3)

## Testing Steps

1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Open Preview mode**
4. **Look for logs starting with `[WF-INDEX]`**
5. **Follow the debugging checklist above**
6. **Fill form and click submit**
7. **Look for logs starting with `[SUBMIT]` and `[WF-RUN]`**

## Expected Console Output

```
[WF-INDEX] Building index from workflows map with 1 workflows
[WF-INDEX] Processing workflow for elementId: workflow-1, nodes: 2
[WF-INDEX] ✅ Trigger node found: { label: "onSubmit", ... }
[WF-INDEX] 🔍 Trigger node data details: { selectedFormGroup: "form-1", ... }
[WF-INDEX] 🎯 Processing onSubmit trigger for elementId: workflow-1
[WF-INDEX] ✅ OnSubmit indexed by form group: formGroup:form-1:submit
[WF-INDEX] ✅ Final index keys: ["formGroup:form-1:submit"]

🎯 LIVE PREVIEW: Button clicked: button-1
[CLICK] Button button-1 is marked as submit button for form group form-1
[SUBMIT] Form data collected: {...}
[SUBMIT] Found 1 workflow(s) for formGroup:form-1:submit
[WF-RUN] Processing node 1: onSubmit
[WF-RUN] Processing node 2: ai.summarize
[WF-RUN] Workflow execution completed successfully
✨ [WF-RUN] Displaying AI summary: {...}
```

## Next Steps

1. **Run the debugging checklist**
2. **Identify which check fails**
3. **Apply the corresponding solution**
4. **Test again**
5. **Report findings**

---

**Status: DEBUGGING GUIDE READY** ✅

