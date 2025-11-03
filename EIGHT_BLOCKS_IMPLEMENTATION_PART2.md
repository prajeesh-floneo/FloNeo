# 8 Pending Workflow Blocks - Part 2: Complex Triggers

## 📦 Complex Trigger Blocks

### 6. onRecordCreate (Trigger Block)

**Purpose**: Automatically executes workflows when a new database record is created

**Configuration Options:**
- `tableName` (string, required): Table to monitor
- `conditions` (array, optional): Filter which records trigger the workflow
  - `field` (string): Field name
  - `operator` (string): Comparison operator
  - `value` (any): Value to compare
- `debounce` (number, default: 0): Delay in ms before triggering

**Challenge**: PostgreSQL doesn't have built-in event emitters like MongoDB

**Solution Options:**

**Option 1: Database Triggers + NOTIFY/LISTEN (Recommended)**
```sql
-- Create trigger function
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

-- Attach to table
CREATE TRIGGER users_create_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION notify_record_create();
```

**Backend Implementation:**
```javascript
// In server/index.js or separate service
const { Client } = require('pg');

class DatabaseEventListener {
  constructor() {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    this.listeners = new Map();
  }

  async start() {
    await this.client.connect();
    
    // Listen for record_created events
    await this.client.query('LISTEN record_created');
    
    this.client.on('notification', async (msg) => {
      if (msg.channel === 'record_created') {
        const data = JSON.parse(msg.payload);
        await this.handleRecordCreate(data);
      }
    });
  }

  async handleRecordCreate(data) {
    const { table, record } = data;
    
    // Find workflows with onRecordCreate trigger for this table
    const workflows = await prisma.workflow.findMany({
      where: {
        nodes: {
          path: ['$[*].data.label'],
          equals: 'onRecordCreate'
        }
      }
    });
    
    // Filter workflows by table name and conditions
    for (const workflow of workflows) {
      const triggerNode = workflow.nodes.find(
        n => n.data.label === 'onRecordCreate'
      );
      
      if (triggerNode.data.tableName === table) {
        // Check conditions
        if (this.matchesConditions(record, triggerNode.data.conditions)) {
          // Execute workflow
          await this.executeWorkflow(workflow, {
            tableName: table,
            record: record,
            operation: 'create',
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  matchesConditions(record, conditions) {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.every(condition => {
      const fieldValue = record[condition.field];
      switch (condition.operator) {
        case 'equals': return fieldValue === condition.value;
        case 'not_equals': return fieldValue !== condition.value;
        case 'greater_than': return fieldValue > condition.value;
        case 'less_than': return fieldValue < condition.value;
        case 'contains': return String(fieldValue).includes(condition.value);
        default: return true;
      }
    });
  }

  async executeWorkflow(workflow, context) {
    // Execute workflow using existing workflow execution logic
    // Similar to how onClick, onSubmit work
  }
}

// Initialize in server/index.js
const dbEventListener = new DatabaseEventListener();
dbEventListener.start();
```

**Option 2: Polling (Simpler but less efficient)**
```javascript
// Poll database every N seconds for new records
setInterval(async () => {
  const newRecords = await prisma.$queryRaw`
    SELECT * FROM users 
    WHERE created_at > NOW() - INTERVAL '10 seconds'
  `;
  
  for (const record of newRecords) {
    await handleRecordCreate(record);
  }
}, 10000); // Poll every 10 seconds
```

**Recommendation**: Use Option 1 (NOTIFY/LISTEN) for production, Option 2 for quick prototype

**Context Output:**
```javascript
{
  tableName: "users",
  record: { id: 123, email: "user@example.com", ... },
  operation: "create",
  timestamp: "2024-01-01T12:00:00Z"
}
```

**Complexity**: ⭐⭐⭐ Complex (requires database triggers or polling)

**Estimated Time**: 10-12 hours

**Dependencies**: PostgreSQL NOTIFY/LISTEN or polling mechanism

---

### 7. onRecordUpdate (Trigger Block)

**Purpose**: Automatically executes workflows when an existing record is modified

**Configuration Options:**
- `tableName` (string, required): Table to monitor
- `watchFields` (array, optional): Only trigger if these fields change
- `conditions` (array, optional): Filter which records trigger the workflow
- `debounce` (number, default: 0): Delay in ms before triggering

**Implementation**: Similar to onRecordCreate but with AFTER UPDATE trigger

**Database Trigger:**
```sql
CREATE OR REPLACE FUNCTION notify_record_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'record_updated',
    json_build_object(
      'table', TG_TABLE_NAME,
      'old_record', row_to_json(OLD),
      'new_record', row_to_json(NEW),
      'changed_fields', (
        SELECT json_object_agg(key, value)
        FROM json_each(row_to_json(NEW))
        WHERE value IS DISTINCT FROM (row_to_json(OLD) ->> key)::json
      ),
      'timestamp', NOW()
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_update_trigger
AFTER UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION notify_record_update();
```

**Backend Implementation:**
```javascript
async handleRecordUpdate(data) {
  const { table, old_record, new_record, changed_fields } = data;
  
  // Find workflows with onRecordUpdate trigger
  const workflows = await prisma.workflow.findMany({
    where: {
      nodes: {
        path: ['$[*].data.label'],
        equals: 'onRecordUpdate'
      }
    }
  });
  
  for (const workflow of workflows) {
    const triggerNode = workflow.nodes.find(
      n => n.data.label === 'onRecordUpdate'
    );
    
    if (triggerNode.data.tableName === table) {
      // Check if watched fields changed
      if (this.watchedFieldsChanged(
        changed_fields,
        triggerNode.data.watchFields
      )) {
        // Execute workflow
        await this.executeWorkflow(workflow, {
          tableName: table,
          oldRecord: old_record,
          newRecord: new_record,
          changedFields: changed_fields,
          operation: 'update',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
}

watchedFieldsChanged(changedFields, watchFields) {
  if (!watchFields || watchFields.length === 0) return true;
  
  return watchFields.some(field => 
    Object.keys(changedFields).includes(field)
  );
}
```

**Context Output:**
```javascript
{
  tableName: "users",
  oldRecord: { id: 123, email: "old@example.com", ... },
  newRecord: { id: 123, email: "new@example.com", ... },
  changedFields: { email: "new@example.com" },
  operation: "update",
  timestamp: "2024-01-01T12:00:00Z"
}
```

**Complexity**: ⭐⭐⭐ Complex (requires database triggers)

**Estimated Time**: 10-12 hours

---

### 8. onSchedule (Trigger Block)

**Purpose**: Executes workflows at scheduled intervals (cron-like)

**Configuration Options:**
- `schedule` (string, required): Cron expression (e.g., "0 9 * * *" for daily at 9 AM)
- `timezone` (string, default: "UTC"): Timezone for schedule
- `enabled` (boolean, default: true): Enable/disable schedule
- `runOnce` (boolean, default: false): Run only once then disable
- `maxRuns` (number, optional): Maximum number of executions

**Cron Expression Examples:**
```
"* * * * *"       - Every minute
"0 * * * *"       - Every hour
"0 9 * * *"       - Daily at 9 AM
"0 9 * * 1"       - Every Monday at 9 AM
"0 0 1 * *"       - First day of every month at midnight
"*/15 * * * *"    - Every 15 minutes
```

**Implementation**: Use node-cron library

**Backend Implementation:**
```javascript
const cron = require('node-cron');

class ScheduledWorkflowManager {
  constructor() {
    this.scheduledJobs = new Map();
  }

  async loadScheduledWorkflows() {
    // Find all workflows with onSchedule trigger
    const workflows = await prisma.workflow.findMany({
      where: {
        nodes: {
          path: ['$[*].data.label'],
          equals: 'onSchedule'
        }
      }
    });

    for (const workflow of workflows) {
      const triggerNode = workflow.nodes.find(
        n => n.data.label === 'onSchedule'
      );

      if (triggerNode.data.enabled !== false) {
        this.scheduleWorkflow(workflow, triggerNode.data);
      }
    }
  }

  scheduleWorkflow(workflow, config) {
    const { schedule, timezone, runOnce, maxRuns } = config;
    
    // Validate cron expression
    if (!cron.validate(schedule)) {
      console.error(`Invalid cron expression: ${schedule}`);
      return;
    }

    let runCount = 0;

    const job = cron.schedule(schedule, async () => {
      runCount++;

      console.log(`🕐 [SCHEDULE] Running workflow: ${workflow.name}`);

      // Execute workflow
      await this.executeWorkflow(workflow, {
        scheduledAt: new Date().toISOString(),
        schedule: schedule,
        runCount: runCount,
        timezone: timezone
      });

      // Check if should stop
      if (runOnce || (maxRuns && runCount >= maxRuns)) {
        job.stop();
        this.scheduledJobs.delete(workflow.id);
        
        // Update workflow to disable schedule
        await this.disableSchedule(workflow.id);
      }
    }, {
      timezone: timezone || 'UTC'
    });

    this.scheduledJobs.set(workflow.id, job);
    console.log(`✅ [SCHEDULE] Scheduled workflow: ${workflow.name} (${schedule})`);
  }

  async executeWorkflow(workflow, context) {
    // Execute workflow using existing workflow execution logic
    try {
      const response = await fetch(`${process.env.BACKEND_URL}/api/workflow/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getSystemToken()}`
        },
        body: JSON.stringify({
          appId: workflow.appId,
          nodes: workflow.nodes,
          edges: workflow.edges,
          context: context
        })
      });

      const result = await response.json();
      console.log(`✅ [SCHEDULE] Workflow executed:`, result);
    } catch (error) {
      console.error(`❌ [SCHEDULE] Workflow execution failed:`, error);
    }
  }

  async disableSchedule(workflowId) {
    // Update workflow to set enabled = false
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId }
    });

    const updatedNodes = workflow.nodes.map(node => {
      if (node.data.label === 'onSchedule') {
        return {
          ...node,
          data: {
            ...node.data,
            enabled: false
          }
        };
      }
      return node;
    });

    await prisma.workflow.update({
      where: { id: workflowId },
      data: { nodes: updatedNodes }
    });
  }

  stopWorkflow(workflowId) {
    const job = this.scheduledJobs.get(workflowId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(workflowId);
    }
  }

  stopAll() {
    for (const [workflowId, job] of this.scheduledJobs) {
      job.stop();
    }
    this.scheduledJobs.clear();
  }
}

// Initialize in server/index.js
const scheduledWorkflowManager = new ScheduledWorkflowManager();
scheduledWorkflowManager.loadScheduledWorkflows();

// Reload schedules when workflows are saved
// In workflow save endpoint
router.post('/save', async (req, res) => {
  // ... save workflow ...
  
  // Reload schedules
  await scheduledWorkflowManager.loadScheduledWorkflows();
});
```

**Context Output:**
```javascript
{
  scheduledAt: "2024-01-01T09:00:00Z",
  schedule: "0 9 * * *",
  runCount: 1,
  timezone: "UTC",
  nextRun: "2024-01-02T09:00:00Z"
}
```

**Complexity**: ⭐⭐⭐ Complex (requires job scheduler)

**Estimated Time**: 12-15 hours

**Dependencies**: `node-cron` npm package

**Security Considerations:**
- Validate cron expressions
- Prevent infinite loops
- Rate limiting (max 1 execution per minute per workflow)
- System token for scheduled executions
- Error handling and retry logic

---

## 🔄 Continue to Part 3...

Next part will cover implementation guides, testing strategies, and deployment checklist.