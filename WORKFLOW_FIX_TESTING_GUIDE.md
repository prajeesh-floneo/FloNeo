# 🧪 Workflow Indexing Fix - Testing Guide

## Overview

The workflow indexing issue has been fixed. This guide will help you verify that workflows are now executing correctly on the run page.

---

## Test Setup

### Prerequisites
- ✅ Application running on localhost:3000
- ✅ Backend running on localhost:5000
- ✅ Browser DevTools open (F12)
- ✅ Console tab visible

---

## Test Case 1: onSubmit Workflow (CRITICAL)

### Setup
1. Open Canvas Editor
2. Create a form with:
   - Text input field
   - Submit button
3. Create a workflow:
   - Trigger: onSubmit
   - Action: notify.toast (show success message)
4. Save and preview

### Test Steps
1. Open Preview mode
2. Enter text in the input field
3. Click Submit button
4. **Expected Result**: Toast notification appears

### Console Verification
Look for these logs:
```
[WF-INDEX] ✅ Trigger node found: {
  label: "onSubmit",
  byLabel: true,
  byPattern: true
}

[WF-INDEX] OnSubmit indexed by form group: formGroup:form-1:submit

[SUBMIT] Found 1 workflow(s) for formGroup:form-1:submit

[WF-RUN] Workflow execution completed successfully
```

### ✅ Pass Criteria
- [ ] Toast notification appears
- [ ] Console shows trigger node found
- [ ] Console shows workflow indexed by form group
- [ ] Console shows workflow execution completed

---

## Test Case 2: onClick Workflow

### Setup
1. Open Canvas Editor
2. Create a button
3. Create a workflow:
   - Trigger: onClick
   - Action: notify.toast (show message)
4. Save and preview

### Test Steps
1. Open Preview mode
2. Click the button
3. **Expected Result**: Toast notification appears

### Console Verification
Look for these logs:
```
[WF-INDEX] ✅ Trigger node found: {
  label: "onClick",
  byLabel: true,
  byPattern: true
}

[CLICK] Found 1 workflow(s) for [elementId]:click

[WF-RUN] Workflow execution completed successfully
```

### ✅ Pass Criteria
- [ ] Toast notification appears
- [ ] Console shows trigger node found
- [ ] Console shows workflow indexed by click
- [ ] Console shows workflow execution completed

---

## Test Case 3: AI Summarize Workflow (MAIN FIX)

### Setup
1. Open Canvas Editor
2. Create:
   - File Upload element
   - Submit button
3. Create workflow:
   - Trigger: onSubmit
   - Action: ai.summarize
4. Configure ai.summarize:
   - Select FILE_UPLOAD from dropdown
   - Paste Gemini API key
5. Save and preview

### Test Steps
1. Open Preview mode
2. Upload a PDF/DOCX/TXT file
3. Click Submit button
4. **Expected Result**: Summary popup appears

### Console Verification
Look for these logs:
```
[WF-INDEX] ✅ Trigger node found: {
  label: "onSubmit"
}

[WF-INDEX] OnSubmit indexed by form group: formGroup:form-1:submit

[SUBMIT] Found 1 workflow(s) for formGroup:form-1:submit

[WF-RUN] Processing node 1: onSubmit

[WF-RUN] Processing node 2: ai.summarize

[WF-RUN] Workflow execution completed successfully

✅ [WF-RUN] AI Summary success: Summary generated
```

### ✅ Pass Criteria
- [ ] File uploads successfully
- [ ] Summary popup appears
- [ ] Summary text is visible
- [ ] Copy button works
- [ ] Download button works
- [ ] Console shows all execution steps

---

## Test Case 4: Multiple Workflows

### Setup
1. Create two workflows on same button:
   - Workflow 1: notify.toast "First"
   - Workflow 2: notify.toast "Second"
2. Save and preview

### Test Steps
1. Open Preview mode
2. Click button
3. **Expected Result**: Both toasts appear

### Console Verification
```
[CLICK] Found 2 workflow(s) for [elementId]:click

[WF-RUN] Workflow execution completed successfully (x2)
```

### ✅ Pass Criteria
- [ ] Both toasts appear
- [ ] Console shows 2 workflows found
- [ ] Both workflows execute

---

## Test Case 5: onPageLoad Workflow

### Setup
1. Create workflow:
   - Trigger: onPageLoad
   - Action: notify.toast "Page loaded"
2. Save and preview

### Test Steps
1. Open Preview mode
2. Navigate to the page
3. **Expected Result**: Toast appears immediately

### Console Verification
```
[WF-INDEX] OnPageLoad indexed by page: page:[pageId]:pageLoad

[WF-RUN] Workflow execution completed successfully
```

### ✅ Pass Criteria
- [ ] Toast appears on page load
- [ ] Console shows onPageLoad indexed
- [ ] Console shows workflow executed

---

## Debugging Tips

### If Workflow Doesn't Execute

1. **Check Console for Errors**
   - Look for red error messages
   - Check for "No trigger node found"

2. **Verify Trigger Detection**
   - Look for `[WF-INDEX] ✅ Trigger node found`
   - If not found, check node structure

3. **Verify Indexing**
   - Look for `[WF-INDEX] OnSubmit indexed by form group`
   - Or `[CLICK] Found X workflow(s)`

4. **Check Workflow Execution**
   - Look for `[WF-RUN] Processing node`
   - Check for errors in block execution

### Common Issues

| Issue | Solution |
|-------|----------|
| No trigger found | Check node label starts with "on" |
| Wrong indexing key | Verify form group is selected |
| Workflow not executing | Check console for errors |
| Block fails | Check block configuration |

---

## Success Checklist

- [ ] onSubmit workflows execute on form submission
- [ ] onClick workflows execute on button click
- [ ] onPageLoad workflows execute on page load
- [ ] AI Summarize workflow works end-to-end
- [ ] Multiple workflows on same element work
- [ ] Console shows clear indexing messages
- [ ] No TypeScript errors
- [ ] No runtime errors

---

## Performance Notes

- Workflow indexing: < 100ms
- Workflow execution: Depends on blocks
- AI Summarize: 5-30 seconds (API dependent)

---

## Next Steps

1. ✅ Run all test cases
2. ✅ Verify console logs
3. ✅ Check for any errors
4. ✅ Test with real data
5. ✅ Deploy to production

---

**Status: READY FOR TESTING** ✅

If all tests pass, the workflow indexing fix is working correctly!

