# 📋 Console Logs Reference - What to Look For

## ✅ EXPECTED LOGS (When Everything Works)

### Phase 1: Workflow Loading
```
🔄 RUN: ===== FETCHING WORKFLOWS =====
🔄 RUN: Fetching /api/canvas/workflows/[appId]
🔄 RUN: Workflow status 200
🔄 RUN: Workflow ok: true
🔄 RUN: Workflow data count: 1
```

### Phase 2: Workflow Processing
```
🔄 RUN: ===== PROCESSING WORKFLOWS =====
🔄 RUN: Processing workflow - key: workflow-1, nodes: 2, edges: 1
✅ [WF-LOAD] Loaded workflow for element workflow-1: 2 nodes, 1 edges
```

### Phase 3: Workflow Indexing
```
[WF-INDEX] Building index from workflows map with 1 workflows
[WF-INDEX] Workflows map keys: ["workflow-1"]
[WF-INDEX] Processing workflow for elementId: workflow-1, nodes: 2
```

### Phase 4: Trigger Detection
```
[WF-INDEX] Workflow nodes: [
  { id: "node-1", label: "onSubmit", category: "Triggers", ... },
  { id: "node-2", label: "ai.summarize", category: "Actions", ... }
]
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

### Phase 5: Trigger Node Data
```
[WF-INDEX] 🔍 Trigger node data details: {
  label: "onSubmit",
  selectedFormGroup: "form_group_1Tn1Tn1Tn1Tn1Tn1",
  triggerType: undefined,
  allKeys: ["label", "category", "selectedFormGroup", ...]
}
```

### Phase 6: onSubmit Indexing
```
[WF-INDEX] 🎯 Processing onSubmit trigger for elementId: workflow-1
[WF-INDEX] ✅ OnSubmit indexed by form group: formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit
selectedFormGroup: form_group_1Tn1Tn1Tn1Tn1Tn1
```

### Phase 7: Final Index
```
[WF-INDEX] ✅ Final index keys: [
  "formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit"
]
[WF-INDEX] ✅ Final index size: 1 workflows size: 1
```

### Phase 8: Button Click
```
🎯 LIVE PREVIEW: Button clicked: button-1
[CLICK] Button button-1 is marked as submit button for form group form_group_1Tn1Tn1Tn1Tn1Tn1 (explicit)
```

### Phase 9: Form Data Collection
```
[SUBMIT] Collected form data - input-1: "test value" (from canvas)
[SUBMIT] Form data collected: {
  "input-1": "test value"
}
```

### Phase 10: Workflow Lookup
```
[SUBMIT] Found 1 workflow(s) for formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit
```

### Phase 11: Workflow Execution
```
[WF-RUN] Processing node 1: onSubmit
[WF-RUN] Processing node 2: ai.summarize
[WF-RUN] Workflow execution completed successfully
✨ [WF-RUN] Displaying AI summary: {...}
```

---

## ❌ ERROR LOGS (When Something is Wrong)

### Error 1: selectedFormGroup is undefined
```
[WF-INDEX] ⚠️ OnSubmit trigger found but NO form group selected: workflow-1
trigger node data: {
  label: "onSubmit",
  selectedFormGroup: undefined,  // ❌ PROBLEM!
  ...
}
```

**Solution:** Open workflow builder, select form group in trigger config

### Error 2: Workflow not indexed
```
[WF-INDEX] ✅ Final index keys: []  // ❌ Empty array!
[WF-INDEX] ✅ Final index size: 0 workflows size: 1
```

**Solution:** Check if trigger was detected (Error 1)

### Error 3: Button not recognized as submit button
```
🎯 LIVE PREVIEW: Button clicked: button-1
[CLICK] No workflow found for button-1:click  // ❌ Not recognized as submit!
```

**Solution:** Check button properties - verify `isSubmitButton: true` and `formGroupId` is set

### Error 4: Form group ID mismatch
```
[WF-INDEX] ✅ OnSubmit indexed by form group: formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit
[CLICK] Button button-1 is marked as submit button for form group form_group:submit  // ❌ Different ID!
[SUBMIT] No workflow found for formGroup:form_group:submit
```

**Solution:** Verify form group ID matches in both places

### Error 5: Workflow not found
```
[SUBMIT] No workflow found for formGroup:form_group_1Tn1Tn1Tn1Tn1Tn1:submit
```

**Solution:** Check if indexing key matches lookup key

---

## 🎯 Quick Checklist

### ✅ If you see all these logs, it's working:
- [ ] `[WF-INDEX] 🔍 Trigger node data details: { ... selectedFormGroup: "..." }`
- [ ] `[WF-INDEX] ✅ OnSubmit indexed by form group: formGroup:...`
- [ ] `[WF-INDEX] ✅ Final index keys: [...]` (not empty)
- [ ] `[CLICK] Button ... is marked as submit button for form group ...`
- [ ] `[SUBMIT] Found 1 workflow(s) for formGroup:...`
- [ ] `[WF-RUN] Workflow execution completed successfully`

### ❌ If you see any of these, there's a problem:
- [ ] `[WF-INDEX] ⚠️ OnSubmit trigger found but NO form group selected`
- [ ] `[WF-INDEX] ✅ Final index keys: []` (empty)
- [ ] `[CLICK] No workflow found for button-1:click` (not recognized as submit)
- [ ] `[SUBMIT] No workflow found for formGroup:...`

---

## 📸 How to Take Screenshots

1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Refresh page**
4. **Scroll through console**
5. **Take screenshots of key logs**
6. **Share with me**

---

**Status: REFERENCE GUIDE READY** ✅

