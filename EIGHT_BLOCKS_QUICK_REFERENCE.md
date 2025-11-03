# 8 Pending Workflow Blocks - Quick Reference Guide

## 📊 Block Comparison Matrix

| Block | Category | Complexity | Time | Dependencies | Value | Priority |
|-------|----------|------------|------|--------------|-------|----------|
| **db.upsert** | Action | ⭐ Simple | 2-3h | None | High | 1 |
| **email.send** | Action | ⭐ Simple | 3-4h | EmailService | High | 2 |
| **switch** | Condition | ⭐⭐ Medium | 6-8h | Edge routing | Medium | 3 |
| **expr** | Condition | ⭐⭐ Medium | 8-10h | vm2 | Medium | 4 |
| **ui.openModal** | Action | ⭐⭐ Medium | 8-10h | Socket.io | Medium | 5 |
| **onSchedule** | Trigger | ⭐⭐⭐ Complex | 12-15h | node-cron | High | 6 |
| **onRecordCreate** | Trigger | ⭐⭐⭐ Complex | 10-12h | DB triggers | High | 7 |
| **onRecordUpdate** | Trigger | ⭐⭐⭐ Complex | 10-12h | DB triggers | High | 8 |

**Total Estimated Time**: 60-74 hours (7-9 working days)

---

## 🎯 Implementation Phases

### Phase 1: Quick Wins (Days 1-2) ✅
**Goal**: Deliver immediate value with minimal effort

**Blocks**:
- ✅ db.upsert (2-3 hours)
- ✅ email.send (3-4 hours)

**Why first?**
- Reuse existing infrastructure
- No new dependencies
- High user value
- Low risk

**Deliverables**:
- Working db.upsert block
- Working email.send block
- Test cases for both
- Documentation

---

### Phase 2: Medium Complexity (Days 3-7) 🔄
**Goal**: Add advanced conditional logic and UI interactions

**Blocks**:
- 🔄 switch (6-8 hours)
- 🔄 expr (8-10 hours)
- 🔄 ui.openModal (8-10 hours)

**Why second?**
- Moderate complexity
- Requires some new infrastructure
- Medium user value
- Moderate risk

**Deliverables**:
- Multi-branch routing system
- Safe expression evaluator
- Modal system integration
- Test cases for all three
- Documentation

---

### Phase 3: Complex Features (Days 8-14) ⏳
**Goal**: Add automated triggers and scheduling

**Blocks**:
- ⏳ onSchedule (12-15 hours)
- ⏳ onRecordCreate (10-12 hours)
- ⏳ onRecordUpdate (10-12 hours)

**Why last?**
- High complexity
- Requires significant new infrastructure
- High user value
- Higher risk

**Deliverables**:
- Job scheduler system
- Database event listener
- Trigger management system
- Test cases for all three
- Documentation

---

## 🔧 Technical Requirements

### Dependencies to Install

```bash
# Phase 2 dependencies
npm install vm2

# Phase 3 dependencies
npm install node-cron
```

### Database Setup (Phase 3)

```sql
-- Create trigger function for record creation
CREATE OR REPLACE FUNCTION notify_record_create()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'record_created',
    json_build_object(
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for record updates
CREATE OR REPLACE FUNCTION notify_record_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'record_updated',
    json_build_object(
      'table', TG_TABLE_NAME,
      'old_record', row_to_json(OLD),
      'new_record', row_to_json(NEW),
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Environment Variables

```env
# Email configuration (already exists)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="FloNeo <noreply@floneo.com>"

# Scheduler configuration (new)
SCHEDULER_ENABLED="true"
SCHEDULER_TIMEZONE="UTC"

# Database event listener (new)
DB_EVENTS_ENABLED="true"
DB_EVENTS_POLL_INTERVAL="10000"  # 10 seconds (fallback if NOTIFY/LISTEN fails)
```

---

## 📝 Configuration Examples

### db.upsert
```json
{
  "tableName": "users",
  "uniqueFields": ["email"],
  "updateData": {
    "name": "{{context.name}}",
    "lastLogin": "{{context.timestamp}}"
  },
  "insertData": {
    "email": "{{context.email}}",
    "name": "{{context.name}}",
    "createdAt": "{{context.timestamp}}"
  }
}
```

### email.send
```json
{
  "to": "{{context.user.email}}",
  "subject": "Welcome to FloNeo!",
  "body": "<h1>Welcome {{context.user.name}}!</h1><p>Thank you for joining.</p>",
  "bodyType": "html"
}
```

### switch
```json
{
  "variable": "{{context.user.role}}",
  "cases": [
    { "value": "admin", "label": "admin" },
    { "value": "manager", "label": "manager" },
    { "value": "user", "label": "user" }
  ],
  "defaultCase": true
}
```

### expr
```json
{
  "expression": "{{context.age}} >= 18 && {{context.verified}} === true",
  "returnType": "boolean"
}
```

### ui.openModal
```json
{
  "title": "Confirm Action",
  "content": "Are you sure you want to delete {{context.itemName}}?",
  "size": "md",
  "buttons": [
    { "label": "Cancel", "variant": "outline", "action": "close" },
    { "label": "Delete", "variant": "destructive", "action": "confirm" }
  ]
}
```

### onSchedule
```json
{
  "schedule": "0 9 * * *",
  "timezone": "America/New_York",
  "enabled": true,
  "runOnce": false
}
```

### onRecordCreate
```json
{
  "tableName": "users",
  "conditions": [
    { "field": "verified", "operator": "equals", "value": true }
  ],
  "debounce": 1000
}
```

### onRecordUpdate
```json
{
  "tableName": "orders",
  "watchFields": ["status", "payment_status"],
  "conditions": [
    { "field": "status", "operator": "equals", "value": "completed" }
  ]
}
```

---

## 🚨 Critical Issues & Solutions

### Issue 1: switch Block Routing
**Problem**: Current system only supports yes/no branching

**Solution**:
```javascript
// Extend edge routing logic
if (node.data.category === "Conditions" && node.data.label === "switch") {
  const matchedCase = result.matchedCase || "default";
  const edgeKey = `${node.id}:${matchedCase}`;
  nextNodeId = edgeMap[edgeKey];
} else if (node.data.category === "Conditions") {
  // Existing yes/no logic
  const conditionResult = result?.isValid || result?.isFilled || false;
  const connectorLabel = conditionResult ? "yes" : "no";
  const edgeKey = `${node.id}:${connectorLabel}`;
  nextNodeId = edgeMap[edgeKey];
}
```

### Issue 2: expr Security
**Problem**: User-provided expressions can execute arbitrary code

**Solution**:
```javascript
const { VM } = require('vm2');

const vm = new VM({
  timeout: 1000,  // 1 second max
  sandbox: {
    context: context,
    Math: Math,
    // Whitelist only safe operations
  }
});

try {
  const result = vm.run(expression);
  return result;
} catch (error) {
  throw new Error("Expression evaluation failed: " + error.message);
}
```

### Issue 3: Database Triggers Performance
**Problem**: Too many triggers can slow down database operations

**Solution**:
- Use debouncing (delay trigger execution)
- Batch multiple events
- Use NOTIFY/LISTEN instead of polling
- Add indexes on trigger tables

### Issue 4: Scheduled Jobs Persistence
**Problem**: Scheduled jobs lost on server restart

**Solution**:
```javascript
// On server startup
const scheduledWorkflowManager = new ScheduledWorkflowManager();
await scheduledWorkflowManager.loadScheduledWorkflows();

// On graceful shutdown
process.on('SIGTERM', () => {
  scheduledWorkflowManager.stopAll();
});
```

---

## ✅ Testing Checklist

### db.upsert
- [ ] Insert new record (record doesn't exist)
- [ ] Update existing record (record exists)
- [ ] Handle multiple unique fields
- [ ] Context variables substitution
- [ ] Error handling (missing fields)

### email.send
- [ ] Send plain text email
- [ ] Send HTML email
- [ ] Use email template
- [ ] Context variables substitution
- [ ] Rate limiting (max 10/minute)
- [ ] Invalid email address handling

### switch
- [ ] Match first case
- [ ] Match middle case
- [ ] Match last case
- [ ] Default case (no match)
- [ ] Multiple workflows with different cases

### expr
- [ ] Boolean expressions
- [ ] Mathematical expressions
- [ ] String expressions
- [ ] Complex expressions with multiple operators
- [ ] Security (prevent code injection)
- [ ] Timeout (long-running expressions)

### ui.openModal
- [ ] Open modal with title and content
- [ ] Different modal sizes
- [ ] Custom buttons
- [ ] Form fields in modal
- [ ] Modal close event
- [ ] Multiple modals

### onSchedule
- [ ] Daily schedule
- [ ] Hourly schedule
- [ ] Custom cron expression
- [ ] Run once and disable
- [ ] Max runs limit
- [ ] Timezone handling

### onRecordCreate
- [ ] Trigger on any record creation
- [ ] Trigger with conditions
- [ ] Multiple workflows on same table
- [ ] Debouncing
- [ ] Context data availability

### onRecordUpdate
- [ ] Trigger on any field update
- [ ] Trigger on specific field update
- [ ] Watch multiple fields
- [ ] Old vs new record comparison
- [ ] Debouncing

---

## 📚 Documentation Files

1. **EIGHT_BLOCKS_COMPREHENSIVE_IMPLEMENTATION_PLAN.md** - Main implementation plan
2. **EIGHT_BLOCKS_IMPLEMENTATION_PART2.md** - Complex triggers (onRecordCreate, onRecordUpdate, onSchedule)
3. **EIGHT_BLOCKS_IMPLEMENTATION_PART3.md** - Implementation guide and testing
4. **EIGHT_BLOCKS_QUICK_REFERENCE.md** - This file (quick reference)

---

## 🎯 Next Steps

1. **Review all documentation** (30 minutes)
2. **Set up development environment** (1 hour)
3. **Start with Phase 1** (db.upsert, email.send)
4. **Test thoroughly** after each block
5. **Move to Phase 2** after Phase 1 is complete
6. **Deploy incrementally** (don't wait for all 8 blocks)

---

**All 8 blocks are well-designed and feasible!** 🚀

**Estimated Total Time**: 60-74 hours (7-9 working days)

**Recommended Start**: db.upsert (easiest, highest value)

