# Testing Guide - All 8 Workflow Blocks

## Quick Test Checklist

### Phase 1: Action Blocks
- [ ] **db.upsert**: Test insert and update scenarios
- [ ] **email.send**: Test email sending with context variables

### Phase 2: Condition & Action Blocks
- [ ] **switch**: Test multi-case branching
- [ ] **expr**: Test JavaScript expression evaluation
- [ ] **ui.openModal**: Test modal opening and data passing

### Phase 3: Trigger Blocks
- [ ] **onSchedule**: Test interval and cron scheduling
- [ ] **onRecordCreate**: Test record creation triggers
- [ ] **onRecordUpdate**: Test record update triggers

---

## Detailed Testing Procedures

### 1. db.upsert Block

**Test Case 1: Insert New Record**
```
1. Create workflow with db.upsert block
2. Configure:
   - Table: "users"
   - Unique Fields: ["email"]
   - Insert Data: {name: "John", email: "john@example.com"}
3. Execute workflow
4. Verify: New record created in database
```

**Test Case 2: Update Existing Record**
```
1. Create workflow with db.upsert block
2. Configure:
   - Table: "users"
   - Unique Fields: ["email"]
   - Update Data: {name: "Jane"}
   - Insert Data: {name: "Jane", email: "jane@example.com"}
3. Execute workflow with existing email
4. Verify: Record updated, not duplicated
```

### 2. email.send Block

**Test Case 1: Send Simple Email**
```
1. Create workflow with email.send block
2. Configure:
   - To: "test@example.com"
   - Subject: "Test Email"
   - Body: "Hello {{context.user.name}}"
   - Body Type: "text"
3. Execute workflow
4. Verify: Email received with context variables substituted
```

**Test Case 2: HTML Email**
```
1. Configure email.send with HTML body
2. Body: "<h1>Welcome {{context.user.name}}</h1>"
3. Body Type: "html"
4. Execute and verify HTML formatting
```

### 3. switch Block

**Test Case 1: Case Matching**
```
1. Create workflow with switch block
2. Configure:
   - Input Value: "{{context.formData.status}}"
   - Cases: ["active", "inactive", "pending"]
3. Connect each case to different action
4. Execute with different status values
5. Verify: Correct case path taken
```

### 4. expr Block

**Test Case 1: Simple Expression**
```
1. Create workflow with expr block
2. Configure:
   - Expression: "5 + 3"
   - Output Variable: "result"
3. Execute workflow
4. Verify: context.result = 8
```

**Test Case 2: Complex Expression**
```
1. Expression: "Math.sqrt(16) * 2"
2. Verify: context.result = 8
```

### 5. ui.openModal Block

**Test Case 1: Open Modal**
```
1. Create workflow with ui.openModal block
2. Configure:
   - Modal ID: "confirmModal"
   - Title: "Confirm Action"
   - Content: "Are you sure?"
   - Size: "medium"
3. Execute workflow
4. Verify: Modal appears on frontend
```

### 6. onSchedule Trigger

**Test Case 1: Interval Scheduling**
```
1. Create workflow with onSchedule trigger
2. Configure:
   - Schedule Type: "interval"
   - Value: 5
   - Unit: "minutes"
3. Verify: Workflow scheduled for 5-minute intervals
```

### 7. onRecordCreate Trigger

**Test Case 1: Trigger on New Record**
```
1. Create workflow with onRecordCreate trigger
2. Configure:
   - Table: "users"
3. Create new record in users table
4. Verify: Workflow executes automatically
```

### 8. onRecordUpdate Trigger

**Test Case 1: Trigger on Update**
```
1. Create workflow with onRecordUpdate trigger
2. Configure:
   - Table: "users"
   - Watch Columns: ["status"]
3. Update status column in users table
4. Verify: Workflow executes automatically
```

---

## Integration Testing

**Test All Blocks Together**
```
1. Create complex workflow using all 8 blocks
2. Verify data flows correctly between blocks
3. Check context variables pass correctly
4. Verify error handling works
5. Test with edge cases
```

---

## Performance Testing

- [ ] Load test with 100+ concurrent workflows
- [ ] Monitor memory usage
- [ ] Check database query performance
- [ ] Verify rate limiting works correctly

---

## Security Testing

- [ ] Verify access control on all blocks
- [ ] Test with invalid inputs
- [ ] Verify SSRF prevention (http.request)
- [ ] Test expression injection attempts
- [ ] Verify email validation

---

## Status: Ready for Testing ✅

