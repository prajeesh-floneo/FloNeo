# 8 Pending Workflow Blocks - Part 3: Implementation Guide

## 🚀 Step-by-Step Implementation Guide

### Phase 1: db.upsert & email.send (Days 1-2)

#### Day 1: db.upsert Implementation

**Step 1: Backend Handler (2 hours)**
```javascript
// Location: server/routes/workflow-execution.js
// Add after executeDbUpdate function

const executeDbUpsert = async (node, context, appId, userId) => {
  const startTime = Date.now();

  try {
    console.log("🔄 [DB-UPSERT] Starting upsert execution for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting
    if (!securityValidator.checkRateLimit(userId, "db.upsert")) {
      throw new Error("Rate limit exceeded");
    }

    const {
      tableName,
      uniqueFields = [],
      updateData = {},
      insertData = {},
      returnRecord = true
    } = node.data;

    if (!tableName) {
      throw new Error("Table name is required");
    }

    if (uniqueFields.length === 0) {
      throw new Error("At least one unique field is required");
    }

    // Build WHERE clause for checking existence
    const queryBuilder = new SafeQueryBuilder();
    uniqueFields.forEach(field => {
      const value = insertData[field] || updateData[field];
      if (value !== undefined) {
        queryBuilder.addCondition(field, "=", value);
      }
    });

    // Check if record exists
    const { query, params } = queryBuilder.buildSelectQuery(tableName, ["id"]);
    const existingRecords = await prisma.$queryRawUnsafe(query, ...params);

    let operation, result;

    if (existingRecords.length > 0) {
      // Record exists - UPDATE
      operation = "update";
      const updateNode = {
        data: {
          tableName,
          updateData,
          whereConditions: uniqueFields.map(field => ({
            field,
            operator: "=",
            value: insertData[field] || updateData[field]
          })),
          returnUpdatedRecords: returnRecord
        }
      };
      result = await executeDbUpdate(updateNode, context, appId, userId);
    } else {
      // Record doesn't exist - INSERT
      operation = "insert";
      const createNode = {
        data: {
          tableName,
          formData: insertData
        }
      };
      result = await executeDbCreate(createNode, context, appId, userId);
    }

    const executionTime = Date.now() - startTime;

    console.log(`✅ [DB-UPSERT] ${operation} completed in ${executionTime}ms`);

    return {
      success: true,
      operation,
      tableName,
      executionTime,
      context: {
        ...context,
        dbUpsertResult: {
          operation,
          tableName,
          record: result.context?.recordId || result.context?.dbUpdateResult?.updatedRecords?.[0],
          executionTime
        }
      }
    };
  } catch (error) {
    console.error("❌ [DB-UPSERT] Error:", error.message);
    throw new Error(`Database upsert failed: ${error.message}`);
  }
};
```

**Step 2: Register Handler (15 minutes)**
```javascript
// In Actions switch statement
case "db.upsert":
  result = await executeDbUpsert(node, currentContext, appId, userId);
  break;
```

**Step 3: Frontend Configuration Panel (1 hour)**
```typescript
// In client/workflow-builder/components/workflow-node.tsx
{data.label === "db.upsert" && (
  <div className="mt-2 w-full space-y-3">
    <div className="text-sm font-medium">Database Upsert Configuration</div>
    
    {/* Table Name */}
    <div>
      <label className="block text-xs font-medium mb-1">Table Name *</label>
      <input
        type="text"
        placeholder="users"
        value={data.tableName || ""}
        onChange={(e) => updateNodeData("tableName", e.target.value)}
        className="w-full px-3 py-2 border rounded-md text-sm"
      />
    </div>

    {/* Unique Fields */}
    <div>
      <label className="block text-xs font-medium mb-1">Unique Fields *</label>
      {(data.uniqueFields || []).map((field: string, index: number) => (
        <div key={index} className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="email"
            value={field}
            onChange={(e) => {
              const newFields = [...(data.uniqueFields || [])];
              newFields[index] = e.target.value;
              updateNodeData("uniqueFields", newFields);
            }}
            className="flex-1 px-3 py-2 border rounded-md text-sm"
          />
          <button
            onClick={() => {
              const newFields = (data.uniqueFields || []).filter(
                (_: string, i: number) => i !== index
              );
              updateNodeData("uniqueFields", newFields);
            }}
            className="px-3 py-2 bg-red-500 text-white rounded-md text-sm"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => {
          const newFields = [...(data.uniqueFields || []), ""];
          updateNodeData("uniqueFields", newFields);
        }}
        className="px-3 py-2 bg-blue-500 text-white rounded-md text-sm"
      >
        + Add Field
      </button>
    </div>

    {/* Update Data */}
    <div>
      <label className="block text-xs font-medium mb-1">Update Data (JSON)</label>
      <textarea
        placeholder='{"name": "{{context.name}}", "email": "{{context.email}}"}'
        value={JSON.stringify(data.updateData || {}, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            updateNodeData("updateData", parsed);
          } catch {}
        }}
        className="w-full px-3 py-2 border rounded-md text-sm font-mono"
        rows={4}
      />
    </div>

    {/* Insert Data */}
    <div>
      <label className="block text-xs font-medium mb-1">Insert Data (JSON)</label>
      <textarea
        placeholder='{"name": "{{context.name}}", "email": "{{context.email}}"}'
        value={JSON.stringify(data.insertData || {}, null, 2)}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            updateNodeData("insertData", parsed);
          } catch {}
        }}
        className="w-full px-3 py-2 border rounded-md text-sm font-mono"
        rows={4}
      />
    </div>
  </div>
)}
```

**Step 4: Update TypeScript Interface (15 minutes)**
```typescript
// In WorkflowNodeData interface
uniqueFields?: string[];
updateData?: Record<string, any>;
insertData?: Record<string, any>;
returnRecord?: boolean;
```

**Step 5: Test (30 minutes)**
- Create workflow: onClick → db.upsert → notify.toast
- Test insert scenario (record doesn't exist)
- Test update scenario (record exists)
- Verify context output

---

#### Day 2: email.send Implementation

**Step 1: Backend Handler (2 hours)**
```javascript
// Location: server/routes/workflow-execution.js
const emailService = require('../utils/email');

const executeEmailSend = async (node, context, appId, userId) => {
  try {
    console.log("📧 [EMAIL-SEND] Processing email send for app:", appId);

    // Validate app access
    const hasAccess = await securityValidator.validateAppAccess(
      appId,
      userId,
      prisma
    );
    if (!hasAccess) {
      throw new Error("Access denied to this app");
    }

    // Rate limiting (max 10 emails per minute)
    if (!securityValidator.checkRateLimit(userId, "email.send", 10, 60000)) {
      throw new Error("Email rate limit exceeded (max 10 per minute)");
    }

    const {
      to,
      subject,
      body,
      bodyType = "html",
      from,
      cc = [],
      bcc = [],
      template,
      templateVars = {}
    } = node.data;

    if (!to) {
      throw new Error("Recipient email is required");
    }

    if (!subject) {
      throw new Error("Email subject is required");
    }

    if (!body && !template) {
      throw new Error("Email body or template is required");
    }

    // Substitute context variables
    const processedTo = substituteContextVariables(to, context);
    const processedSubject = substituteContextVariables(subject, context);
    let processedBody = substituteContextVariables(body, context);

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(processedTo)) {
      throw new Error("Invalid recipient email address");
    }

    // If template specified, render template
    if (template) {
      processedBody = renderEmailTemplate(template, {
        ...templateVars,
        ...context
      });
    }

    // Send email using existing EmailService
    const result = await emailService.sendNotificationEmail(
      processedTo,
      'workflow',
      processedBody,
      context.user?.name || 'User'
    );

    console.log("✅ [EMAIL-SEND] Email sent successfully:", result);

    return {
      success: true,
      type: "email",
      emailSent: true,
      context: {
        ...context,
        emailSendResult: {
          success: result.success,
          messageId: result.messageId,
          to: processedTo,
          subject: processedSubject,
          sentAt: new Date().toISOString()
        }
      }
    };
  } catch (error) {
    console.error("❌ [EMAIL-SEND] Error:", error.message);
    return {
      success: false,
      type: "email",
      error: error.message,
      context: context
    };
  }
};

// Helper function to render email templates
function renderEmailTemplate(templateName, vars) {
  const templates = {
    welcome: `
      <h2>Welcome ${vars.userName}!</h2>
      <p>Thank you for joining our platform.</p>
    `,
    notification: `
      <h2>Notification</h2>
      <p>${vars.message}</p>
    `,
    // Add more templates as needed
  };

  return templates[templateName] || vars.message || '';
}
```

**Step 2-5**: Similar to db.upsert (register handler, add UI, update types, test)

---

### Phase 2: switch, expr, ui.openModal (Days 3-7)

**Implementation order:**
1. switch (Days 3-4): Multi-branch routing
2. expr (Days 5-6): Safe expression evaluation
3. ui.openModal (Day 7): Frontend-backend coordination

**Key challenges:**
- switch: Update edge routing logic to support multiple connectors
- expr: Implement safe sandboxed evaluation with vm2
- ui.openModal: Socket.io event emission and frontend modal handling

---

### Phase 3: onRecordCreate, onRecordUpdate, onSchedule (Days 8-14)

**Implementation order:**
1. onSchedule (Days 8-10): Easiest of the three, uses node-cron
2. onRecordCreate (Days 11-12): Database triggers + NOTIFY/LISTEN
3. onRecordUpdate (Days 13-14): Similar to onRecordCreate

**Key challenges:**
- Database triggers setup and management
- Event listener service initialization
- System token for scheduled/automated executions

---

## 🧪 Testing Strategy

### Unit Tests
```javascript
// test/workflow-blocks.test.js
describe('db.upsert', () => {
  it('should insert when record does not exist', async () => {
    // Test insert scenario
  });

  it('should update when record exists', async () => {
    // Test update scenario
  });

  it('should handle errors gracefully', async () => {
    // Test error handling
  });
});
```

### Integration Tests
- Test complete workflows with multiple blocks
- Test context passing between blocks
- Test error propagation

### End-to-End Tests
- Test from UI trigger to final result
- Test with real database operations
- Test with real email sending (use test SMTP)

---

## 📋 Deployment Checklist

### Before Deployment
- [ ] All 8 blocks implemented and tested
- [ ] TypeScript compilation passes
- [ ] No console errors in browser
- [ ] All existing blocks still work
- [ ] Documentation updated
- [ ] Test cases written and passing

### Environment Setup
- [ ] Install node-cron: `npm install node-cron`
- [ ] Install vm2: `npm install vm2`
- [ ] Configure SMTP for email.send
- [ ] Set up database triggers for onRecordCreate/Update

### Database Migrations
- [ ] Create trigger functions
- [ ] Attach triggers to relevant tables
- [ ] Test NOTIFY/LISTEN mechanism

### Monitoring
- [ ] Add logging for all new blocks
- [ ] Monitor scheduled job execution
- [ ] Track email sending metrics
- [ ] Monitor database trigger performance

---

## 🎯 Summary & Recommendations

### Recommended Implementation Order

**Week 1:**
1. db.upsert (Day 1)
2. email.send (Day 2)
3. switch (Days 3-4)

**Week 2:**
4. expr (Days 5-6)
5. ui.openModal (Day 7)
6. onSchedule (Days 8-10)

**Week 3:**
7. onRecordCreate (Days 11-12)
8. onRecordUpdate (Days 13-14)

### Dependencies to Install
```bash
npm install node-cron vm2
```

### Key Success Factors
1. **Start simple**: db.upsert and email.send first
2. **Test thoroughly**: Each block before moving to next
3. **Reuse existing code**: Leverage db.create, db.update, EmailService
4. **Security first**: Sandbox expr, rate limit email.send
5. **Document as you go**: Update docs for each block

### Potential Issues & Solutions

**Issue 1**: switch block routing complexity
- **Solution**: Extend existing edge routing to support multiple connectors

**Issue 2**: expr security risks
- **Solution**: Use vm2 sandbox, whitelist operations, timeout limits

**Issue 3**: Database triggers performance
- **Solution**: Use NOTIFY/LISTEN, add debouncing, limit trigger frequency

**Issue 4**: Scheduled jobs persistence
- **Solution**: Store schedules in database, reload on server restart

---

**Total Estimated Time**: 14-18 days (2-3 weeks)

**All blocks are feasible and well-designed!** 🎉

