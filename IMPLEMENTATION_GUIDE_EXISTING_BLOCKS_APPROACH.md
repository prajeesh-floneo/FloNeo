# 📋 IMPLEMENTATION GUIDE: USING EXISTING BLOCKS APPROACH

**Strategy:** Minimize new blocks, maximize existing functionality  
**Timeline:** 3 weeks  
**Effort:** 19 hours  
**New Blocks:** 2 (db.delete, db.aggregate)

---

## WEEK 1: FIX EXISTING BLOCKS & DOCUMENT PATTERNS

### Task 1.1: Fix ui.openModal Frontend Integration (3 hours)

**Current Issue:**
- Backend returns modal data correctly
- Frontend doesn't display modal
- No Socket.io event handling

**Implementation:**

**Step 1: Update workflow execution response handler**
```typescript
// In client/app/run/page.tsx or workflow executor
const handleWorkflowResult = (result) => {
  // Check for modal action
  if (result.action?.type === "openModal") {
    const { payload } = result.action;
    
    // Emit Socket.io event
    socket.emit('workflow:openModal', payload);
    
    // Or dispatch to modal state
    setModalState({
      isOpen: true,
      id: payload.modalId,
      title: payload.title,
      content: payload.content,
      size: payload.size,
      data: payload.data
    });
  }
};
```

**Step 2: Add modal rendering**
```typescript
// Render modal based on state
{modalState.isOpen && (
  <Modal
    open={modalState.isOpen}
    onClose={() => setModalState({...modalState, isOpen: false})}
    title={modalState.title}
    size={modalState.size}
  >
    <div>{modalState.content}</div>
  </Modal>
)}
```

**Step 3: Test with ai.summarize**
```
ai.summarize → ui.openModal (display summary)
```

**Success Criteria:**
- ✅ Modal displays when workflow executes ui.openModal
- ✅ Modal shows correct title and content
- ✅ Modal closes properly
- ✅ Works with context variables

---

### Task 1.2: Document CRM Patterns (2 hours)

**Create:** `CRM_WORKFLOW_PATTERNS.md`

**Content:**

**Pattern 1: Create Lead**
```
onSubmit → db.create (table: "leads", data: {
  name: "{{context.form.name}}",
  email: "{{context.form.email}}",
  phone: "{{context.form.phone}}",
  source: "web_form",
  createdAt: "{{context.timestamp}}"
})
         → notify.toast ("Lead created successfully")
```

**Pattern 2: Update Contact**
```
onClick → db.find (table: "contacts", where: {id: "{{context.contactId}}"})
        → db.update (table: "contacts", data: {
            name: "{{context.form.name}}",
            email: "{{context.form.email}}",
            updatedAt: "{{context.timestamp}}"
          })
        → notify.toast ("Contact updated")
```

**Pattern 3: Create Deal**
```
onClick → db.create (table: "deals", data: {
  title: "{{context.form.dealTitle}}",
  amount: "{{context.form.amount}}",
  stage: "new",
  contactId: "{{context.contactId}}",
  createdAt: "{{context.timestamp}}"
})
         → notify.toast ("Deal created")
```

**Pattern 4: Log Activity**
```
onClick → db.create (table: "activities", data: {
  type: "{{context.activityType}}",
  description: "{{context.description}}",
  contactId: "{{context.contactId}}",
  createdAt: "{{context.timestamp}}"
})
         → notify.toast ("Activity logged")
```

**Pattern 5: Generate Sales Report**
```
onPageLoad → db.find (table: "deals", where: {stage: "closed"})
           → expr (calculate total: {{context.data}}.reduce((sum, d) => sum + d.amount, 0))
           → ui.openModal (title: "Sales Report", content: "Total: {{context.exprResult}}")
```

**Pattern 6: Find Contacts by Status**
```
onClick → db.find (table: "contacts", where: {status: "active"})
        → match (check if found: {{context.data.length}} > 0)
          ├─ yes → ui.openModal (show contacts)
          └─ no → notify.toast ("No contacts found")
```

---

### Task 1.3: Create CRM Workflow Templates (4 hours)

**Create:** Pre-built workflows in database

**Template 1: Lead Capture Form**
- Trigger: onSubmit
- Blocks: db.create (leads), email.send (notification), notify.toast
- Use Case: Website contact form

**Template 2: Contact Management**
- Trigger: onClick
- Blocks: db.find, db.update, notify.toast
- Use Case: Update contact details

**Template 3: Deal Pipeline**
- Trigger: onClick
- Blocks: db.find (deals), expr (calculate totals), ui.openModal
- Use Case: View sales pipeline

**Template 4: Activity Logging**
- Trigger: onClick
- Blocks: db.create (activities), notify.toast
- Use Case: Log customer interactions

**Template 5: Email Campaign**
- Trigger: onPageLoad
- Blocks: db.find (contacts), email.send, notify.toast
- Use Case: Send bulk emails

**Implementation:**
```javascript
// Create templates in database
const templates = [
  {
    name: "Lead Capture",
    description: "Capture leads from web form",
    nodes: [...],
    edges: [...]
  },
  // ... more templates
];

// Store in database
await prisma.workflowTemplate.createMany({ data: templates });
```

---

## WEEK 2: CREATE db.delete BLOCK

### Task 2.1: Backend Implementation (2 hours)

**Location:** `server/routes/workflow-execution.js`

**Implementation:**
```javascript
const executeDbDelete = async (node, context, appId, userId) => {
  try {
    console.log("🗑️ [DB-DELETE] Processing delete for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId, userId, prisma
    );
    if (!hasAccess) throw new Error("Access denied");

    const { tableName, whereConditions, returnDeletedRecords = false } = node.data;

    if (!tableName) throw new Error("Table name required");
    if (!whereConditions || whereConditions.length === 0) {
      throw new Error("WHERE conditions required for safety");
    }

    // Build safe query
    const queryBuilder = new SafeQueryBuilder();
    whereConditions.forEach(cond => {
      const value = substituteContextVariables(cond.value, context);
      queryBuilder.addCondition(cond.field, cond.operator, value);
    });

    const { query, params } = queryBuilder.buildDeleteQuery(tableName);
    const result = await prisma.$queryRawUnsafe(query, ...params);

    return {
      success: true,
      deletedCount: result.length,
      tableName,
      context: {
        ...context,
        dbDeleteResult: { deletedCount: result.length }
      }
    };
  } catch (error) {
    throw new Error(`Database delete failed: ${error.message}`);
  }
};
```

**Add to execution switch:**
```javascript
case "db.delete":
  result = await executeDbDelete(node, currentContext, appId, userId);
  break;
```

---

### Task 2.2: Frontend Configuration Panel (1 hour)

**Location:** `client/workflow-builder/components/workflow-node.tsx`

**Add to configuration:**
```typescript
case "db.delete":
  return (
    <div className="space-y-4">
      {/* Table Selection */}
      <div>
        <label className="text-sm font-medium">Table:</label>
        <select value={data.tableName || ""} onChange={(e) => {
          setNodes(nodes => nodes.map(n => 
            n.id === id ? {...n, data: {...n.data, tableName: e.target.value}} : n
          ));
        }}>
          <option>Select table...</option>
          {tables.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* WHERE Conditions */}
      <div>
        <label className="text-sm font-medium">WHERE Conditions:</label>
        {/* Add condition builder UI */}
      </div>
    </div>
  );
```

---

### Task 2.3: Testing (1 hour)

**Test Cases:**
```javascript
// Test 1: Delete single record
db.delete({
  tableName: "leads",
  whereConditions: [{field: "id", operator: "=", value: "{{context.leadId}}"}]
})

// Test 2: Delete multiple records
db.delete({
  tableName: "activities",
  whereConditions: [{field: "contactId", operator: "=", value: "{{context.contactId}}"}]
})

// Test 3: Safety check (no WHERE conditions)
// Should fail with error

// Test 4: Verify database page reflects deletion
```

---

## WEEK 3: CREATE db.aggregate BLOCK

### Task 3.1: Backend Implementation (2 hours)

**Implementation:**
```javascript
const executeDbAggregate = async (node, context, appId, userId) => {
  try {
    const { tableName, aggregations = [], groupBy, whereConditions = [] } = node.data;

    // Build query
    const selectParts = aggregations.map(
      agg => `${agg.function}(${agg.field}) as ${agg.alias}`
    );

    let query = `SELECT ${selectParts.join(", ")} FROM "${tableName}"`;

    // Add WHERE
    if (whereConditions.length > 0) {
      const queryBuilder = new SafeQueryBuilder();
      whereConditions.forEach(cond => {
        queryBuilder.addCondition(cond.field, cond.operator, cond.value);
      });
      query += ` WHERE ...`;
    }

    // Add GROUP BY
    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }

    const result = await prisma.$queryRawUnsafe(query);

    return {
      success: true,
      data: result,
      context: { ...context, aggregateResult: result[0] }
    };
  } catch (error) {
    throw new Error(`Aggregation failed: ${error.message}`);
  }
};
```

---

### Task 3.2: Frontend Configuration (2 hours)

**Add aggregation builder UI**

---

### Task 3.3: Performance Testing (2 hours)

**Test with:**
- 1K records
- 10K records
- 100K records
- 1M records

---

## USAGE EXAMPLES

### Example 1: CRM Lead Management
```
onSubmit → db.create (leads)
         → email.send (welcome)
         → notify.toast ("Lead created")
```

### Example 2: Delete Old Records
```
onPageLoad → db.find (activities, where: {createdAt < 30 days ago})
           → db.delete (activities)
           → notify.toast ("Old records deleted")
```

### Example 3: Sales Report
```
onPageLoad → db.aggregate (deals, SUM(amount), GROUP BY stage)
           → ui.openModal (show report)
```

---

## SUCCESS CRITERIA

### Week 1
- ✅ ui.openModal displays correctly
- ✅ CRM patterns documented
- ✅ Templates created and working

### Week 2
- ✅ db.delete implemented
- ✅ All tests passing
- ✅ Safety checks working

### Week 3
- ✅ db.aggregate implemented
- ✅ Performance acceptable
- ✅ All tests passing

---

## TOTAL EFFORT SUMMARY

| Task | Hours | Status |
|------|-------|--------|
| Fix ui.openModal | 3 | Week 1 |
| Document CRM patterns | 2 | Week 1 |
| Create CRM templates | 4 | Week 1 |
| db.delete backend | 2 | Week 2 |
| db.delete frontend | 1 | Week 2 |
| db.delete testing | 1 | Week 2 |
| db.aggregate backend | 2 | Week 3 |
| db.aggregate frontend | 2 | Week 3 |
| db.aggregate testing | 2 | Week 3 |
| **TOTAL** | **19 hours** | **3 weeks** |

---

## COMPARISON

### Old Approach (Create Many Blocks)
- Create: crm.createLead, crm.updateContact, crm.createDeal, crm.addActivity, etc.
- Effort: 54+ hours
- Result: Duplicate functionality

### New Approach (Use Existing Blocks)
- Fix: ui.openModal
- Create: db.delete, db.aggregate
- Document: CRM patterns
- Effort: 19 hours
- Result: Flexible, reusable, maintainable

**Savings: 35 hours (65% reduction)**


