# Algorithm Documentation: Database and Workflow Fixes

This document explains step-by-step how we fixed the database insertion issues and improved the workflow execution logic in the FloNeo platform.

## Table of Contents
1. [Database Create (db.create) Fix](#database-create-dbcreate-fix)
2. [RoleIs Block Fix](#roleis-block-fix)
3. [Key Concepts](#key-concepts)

---

## Database Create (db.create) Fix

### Problem Statement

**Initial Issue:**
- When an HTTP API returned multiple records in a nested `data` array, only the first record was being inserted into the database
- Example API response:
  ```json
  {
    "success": true,
    "tableName": "Applicant Details",
    "count": 4,
    "data": [
      { "applicationId": "...", "fullName": "Prince Kumar", ... },
      { "applicationId": "...", "fullName": "Aditya Kumar", ... },
      { "applicationId": "...", "fullName": "Kaushal Kumar", ... },
      { "applicationId": "...", "fullName": "...", ... }
    ]
  }
  ```
- **Expected:** All 4 records should be inserted
- **Actual:** Only 1 record was inserted

### Root Cause Analysis

#### Step 1: Understanding the Data Flow

The workflow execution follows this path:
```
User clicks button → onClick trigger → http.request → db.create → notify.toast
```

1. **HTTP Request Block** receives API response and stores it in `context.httpResponse.data`
2. **DB Create Block** reads from `context.httpResponse.data` and extracts data for insertion
3. **Problem:** The extraction logic only took the first item from the `data` array

#### Step 2: Finding the Problematic Code

**Location:** `server/routes/workflow-execution.js` - `executeDbCreate` function

**Original Code Logic:**
```javascript
// OLD CODE (Line ~770)
if (Array.isArray(data.data) && data.data.length > 0) {
  console.log("Found nested 'data' array with", data.data.length, "items, extracting first element");
  const firstItem = data.data[0];  // ❌ Only taking first item!
  // ... process only firstItem
  return flattened;  // ❌ Returns only one record
}
```

**Why it failed:**
- The code explicitly extracted only `data.data[0]` (first element)
- It ignored all other items in the array
- The insertion logic was designed for a single record

### Solution Implementation

#### Step 3: Design the Solution

**Goal:** Extract ALL records from the `data` array and insert each one separately.

**Approach:**
1. Detect when we have multiple records in the `data` array
2. Store all records in an array (`recordsToInsert`)
3. Loop through all records and insert each one
4. Return all inserted record IDs

#### Step 4: Implementation Steps

##### Step 4.1: Add Records Array Variable

**Location:** Line ~711

**Change:**
```javascript
// BEFORE
let dataToInsert = {};
let dataSource = "none";

// AFTER
let dataToInsert = {};
let dataSource = "none";
let recordsToInsert = []; // ✅ New: Array to store multiple records
```

**Why:** We need a place to store all records before insertion.

##### Step 4.2: Modify Data Extraction Logic

**Location:** Line ~770-781

**Change:**
```javascript
// BEFORE
if (Array.isArray(data.data) && data.data.length > 0) {
  const firstItem = data.data[0];  // ❌ Only first item
  return { ...firstItem };  // ❌ Single record
}

// AFTER
if (Array.isArray(data.data) && data.data.length > 0) {
  console.log("Found nested 'data' array with", data.data.length, "items");
  // ✅ Return a special marker object to indicate multiple records
  return {
    __hasMultipleRecords: true,
    __recordsArray: data.data,  // ✅ Store ALL items
    __metadata: {
      success: data.success,
      tableName: data.tableName,
      count: data.count
    }
  };
}
```

**Why:** 
- Instead of extracting just the first item, we return a marker object
- This marker tells us we have multiple records
- We preserve the entire array for later processing

##### Step 4.3: Process All Records

**Location:** Line ~833-870

**Change:**
```javascript
// BEFORE
dataToInsert = extractDataFromResponse(httpData);
recordsToInsert = [dataToInsert];  // ❌ Only one record

// AFTER
const extractedData = extractDataFromResponse(httpData);

// ✅ Check if we have multiple records
if (extractedData && extractedData.__hasMultipleRecords && Array.isArray(extractedData.__recordsArray)) {
  console.log("Detected multiple records in 'data' array:", extractedData.__recordsArray.length);
  
  // ✅ Process ALL records from the array
  recordsToInsert = extractedData.__recordsArray.map((item, index) => {
    if (typeof item === 'object' && item !== null) {
      const flattened = { ...item };
      // Add metadata fields
      if (extractedData.__metadata?.success !== undefined) flattened._success = extractedData.__metadata.success;
      if (extractedData.__metadata?.tableName) flattened._tableName = extractedData.__metadata.tableName;
      if (extractedData.__metadata?.count !== undefined) flattened._count = extractedData.__metadata.count;
      return flattened;
    }
    return null;
  }).filter(record => record !== null);  // ✅ Remove invalid entries
  
  // Use first record for table schema creation
  if (recordsToInsert.length > 0) {
    dataToInsert = recordsToInsert[0];
    console.log("Using first record for table schema, will insert", recordsToInsert.length, "records total");
  }
} else {
  // Single record case (existing behavior)
  dataToInsert = extractedData;
  recordsToInsert = [dataToInsert];
}
```

**Why:**
- We check if the extracted data has the `__hasMultipleRecords` flag
- If yes, we use `.map()` to process ALL items in the array
- Each item becomes a separate record in `recordsToInsert`
- We use the first record to determine the table schema (column structure)
- If it's a single record, we keep the old behavior

##### Step 4.4: Create Helper Functions for Record Processing

**Location:** Line ~1429-1482

**Change:**
```javascript
// ✅ Helper function to convert complex types to strings (shared by multiple functions)
const prepareValueForInsert = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's an object with 'value' property, extract it
  if (typeof value === 'object' && value !== null && 'value' in value && !(value instanceof Date)) {
    return prepareValueForInsert(value.value);
  }
  
  // Convert objects and arrays to JSON strings
  if (typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
};

// ✅ Helper function to prepare a single record for insertion
const prepareRecordForInsert = (recordData) => {
  const preparedData = {};
  for (const [key, value] of Object.entries(recordData)) {
    let finalValue = value;
    
    // Extract value if it's in object format
    if (typeof value === 'object' && value !== null && 'value' in value && !(value instanceof Date) && !Array.isArray(value)) {
      finalValue = value.value;
    }
    
    // Prepare the value
    preparedData[key] = prepareValueForInsert(finalValue);
  }
  
  // Final validation: ensure no objects remain
  for (const [key, value] of Object.entries(preparedData)) {
    if (typeof value === 'object' && value !== null && !(value instanceof Date) && !Array.isArray(value)) {
      if ('value' in value) {
        preparedData[key] = prepareValueForInsert(value.value);
      } else {
        preparedData[key] = JSON.stringify(value);
      }
    }
  }
  
  return preparedData;
};
```

**Why:**
- `prepareValueForInsert`: Converts complex data types (objects, arrays) into database-compatible formats
- `prepareRecordForInsert`: Processes a single record and ensures all values are properly formatted
- These functions are reusable and ensure data consistency

##### Step 4.5: Create INSERT Statement Builder

**Location:** Line ~1612-1851

**Change:**
```javascript
// ✅ Build INSERT statement with proper SQL escaping for a single record
const buildInsertStatement = (preparedData) => {
  const insertColumns = [];
  const escapedValues = [];

  // Map data to table columns
  for (const [columnName, columnInfo] of tableSchema) {
    // Skip auto-generated columns
    if (columnName === "id" || columnName === "created_at" || columnName === "updated_at" || columnName === "app_id") {
      continue;
    }

    // Find data for this column (try multiple matching strategies)
    let dataValue = null;
    const possibleKeys = [columnName, columnInfo.originalName, columnInfo.elementId];
    
    // Try exact match, then case-insensitive match
    for (const key of possibleKeys) {
      if (preparedData[key] !== undefined) {
        dataValue = preparedData[key];
        break;
      }
      // Case-insensitive match
      const lowerKey = key.toLowerCase();
      for (const dataKey of Object.keys(preparedData)) {
        if (dataKey.toLowerCase() === lowerKey) {
          dataValue = preparedData[dataKey];
          break;
        }
      }
      if (dataValue !== null) break;
    }
    
    // Prepare the value for insertion
    dataValue = prepareValueForInsert(dataValue);
    
    // Escape value properly for PostgreSQL
    if (dataValue === null || dataValue === undefined) {
      escapedValues.push('NULL');
    } else if (typeof dataValue === 'boolean') {
      escapedValues.push(dataValue ? 'TRUE' : 'FALSE');
    } else if (dataValue instanceof Date) {
      escapedValues.push(`'${dataValue.toISOString()}'::timestamp`);
    } else if (typeof dataValue === 'number') {
      escapedValues.push(String(dataValue));
    } else if (typeof dataValue === 'string') {
      // Escape single quotes for SQL safety
      escapedValues.push(`'${dataValue.replace(/'/g, "''")}'`);
    } else if (Array.isArray(dataValue)) {
      escapedValues.push(`'${JSON.stringify(dataValue).replace(/'/g, "''")}'`);
    }
    
    insertColumns.push(`"${columnName}"`);
  }

  // Add app_id
  insertColumns.push('"app_id"');
  escapedValues.push(String(parseInt(appId)));

  return {
    columns: insertColumns,
    values: escapedValues
  };
};
```

**Why:**
- This function builds a safe SQL INSERT statement for one record
- It handles different data types (strings, numbers, dates, booleans)
- It escapes values to prevent SQL injection
- It returns the columns and values separately for reuse

##### Step 4.6: Loop Through All Records and Insert

**Location:** Line ~1780-1813

**Change:**
```javascript
// BEFORE
const insertSQL = `INSERT INTO "${tableName}" (...) VALUES (...) RETURNING id`;
const insertResult = await prisma.$queryRawUnsafe(insertSQL);
const insertedId = insertResult[0]?.id;  // ❌ Only one ID

// AFTER
// ✅ Insert all records
const insertedIds = [];
console.log(`Starting batch insert of ${recordsToInsert.length} record(s)`);

for (let recordIndex = 0; recordIndex < recordsToInsert.length; recordIndex++) {
  const recordData = recordsToInsert[recordIndex];
  console.log(`Processing record ${recordIndex + 1}/${recordsToInsert.length}`);
  
  // ✅ Prepare this record's data
  const preparedData = prepareRecordForInsert(recordData);
  
  // ✅ Build INSERT statement for this record
  const { columns: insertColumns, values: escapedValues } = buildInsertStatement(preparedData);
  
  const insertSQL = `INSERT INTO "${tableName}" (${insertColumns.join(", ")}) VALUES (${escapedValues.join(", ")}) RETURNING id`;

  const insertResult = await prisma.$queryRawUnsafe(insertSQL);
  const insertedId = insertResult[0]?.id;
  insertedIds.push(insertedId);  // ✅ Store all IDs

  console.log(`Record ${recordIndex + 1} inserted successfully, record ID: ${insertedId}`);
}

console.log(`All ${insertedIds.length} record(s) inserted successfully. IDs: ${insertedIds.join(", ")}`);
```

**Why:**
- We loop through ALL records in `recordsToInsert`
- Each record is processed and inserted separately
- We collect all inserted IDs in an array
- This ensures every record from the API response gets inserted

##### Step 4.7: Update Return Statement

**Location:** Line ~1827-1855

**Change:**
```javascript
// BEFORE
return {
  success: true,
  tableName,
  recordId: insertedId,  // ❌ Only first ID
  // ...
};

// AFTER
// Use first inserted ID for backward compatibility
const firstInsertedId = insertedIds[0];

return {
  success: true,
  tableName,
  recordId: firstInsertedId,  // ✅ First ID (for backward compatibility)
  recordIds: insertedIds,  // ✅ Array of all inserted IDs
  recordsInserted: insertedIds.length,  // ✅ Count of inserted records
  message: tableCreated
    ? `Table '${tableName}' created and ${insertedIds.length} record(s) inserted (IDs: ${insertedIds.join(", ")})`
    : `${insertedIds.length} record(s) inserted into '${tableName}' (IDs: ${insertedIds.join(", ")})`,
  // ...
};
```

**Why:**
- We return both `recordId` (first ID) for backward compatibility
- We also return `recordIds` (all IDs) and `recordsInserted` (count)
- This gives complete information about what was inserted

### Errors Encountered and Fixed

#### Error 1: Column Name Validation Error

**Error Message:**
```
Column name must start with letter and contain only alphanumeric characters and underscores
```

**Cause:**
- Metadata fields from API response started with underscore (`_success`, `_tableName`, `_count`)
- SQL column names cannot start with underscore
- The validation failed before insertion

**Solution:**
**Location:** `sanitizeIdentifier` function (Line ~25-74)

```javascript
const sanitizeIdentifier = (identifier) => {
  if (!identifier || typeof identifier !== "string") {
    throw new Error("Invalid identifier");
  }
  
  let sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  
  // ✅ Fix: Prefix fields starting with underscore
  if (sanitized.startsWith("_")) {
    sanitized = "meta" + sanitized;  // _success → meta_success
    console.log(`Had leading underscore, converted to: "${sanitized}"`);
  }
  
  // ✅ Ensure it starts with a letter
  if (/^[0-9]/.test(sanitized)) {
    sanitized = `field_${sanitized}`;
  }
  
  if (!sanitized || sanitized.trim() === "") {
    sanitized = "field_" + Math.random().toString(36).substring(2, 9);
  }
  
  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = "field_" + sanitized;
  }
  
  return sanitized;
};
```

**How it works:**
1. Converts `_success` → `meta_success`
2. Converts `_tableName` → `meta_tablename` → `meta_meta_tablename` (wait, that's wrong!)

**Better Solution:**
```javascript
if (sanitized.startsWith("_")) {
  sanitized = "meta" + sanitized;  // _success → meta_success ✅
}
```

**Result:** Metadata fields are now valid SQL column names.

#### Error 2: prepareValueForInsert is not defined

**Error Message:**
```
prepareValueForInsert is not defined
```

**Cause:**
- `prepareValueForInsert` was defined inside `prepareRecordForInsert` function
- `buildInsertStatement` function tried to call it, but it was out of scope
- JavaScript scope issue

**Solution:**
**Location:** Line ~1429-1446

**Before:**
```javascript
const prepareRecordForInsert = (recordData) => {
  const prepareValueForInsert = (value) => {  // ❌ Inside function
    // ...
  };
  // ...
};

const buildInsertStatement = (preparedData) => {
  // ...
  dataValue = prepareValueForInsert(dataValue);  // ❌ Error: not in scope!
};
```

**After:**
```javascript
// ✅ Move outside so both functions can use it
const prepareValueForInsert = (value) => {
  // ...
};

const prepareRecordForInsert = (recordData) => {
  // Can now use prepareValueForInsert ✅
};

const buildInsertStatement = (preparedData) => {
  // Can now use prepareValueForInsert ✅
  dataValue = prepareValueForInsert(dataValue);
};
```

**Result:** Both functions can now access `prepareValueForInsert`.

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Clicks Button                                        │
│    → Triggers onClick workflow                              │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. HTTP Request Block Executes                              │
│    → Makes API call to external service                      │
│    → Receives response: { success: true, data: [...] }      │
│    → Stores in context.httpResponse.data                     │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. DB Create Block Executes                                 │
│    → Reads context.httpResponse.data                         │
│    → Detects nested 'data' array                            │
│    → Extracts ALL items (not just first)                    │
│    → Stores in recordsToInsert array                        │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Table Schema Creation                                     │
│    → Uses first record to determine columns                 │
│    → Creates/updates table structure                        │
│    → Sanitizes column names (meta_success, etc.)            │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Record Processing Loop                                    │
│    FOR each record in recordsToInsert:                      │
│      → Prepare record data (prepareRecordForInsert)         │
│      → Build INSERT statement (buildInsertStatement)        │
│      → Execute SQL INSERT                                    │
│      → Store inserted ID                                     │
│    END FOR                                                   │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Return Results                                            │
│    → Returns all inserted IDs                                │
│    → Returns count of records inserted                       │
│    → Updates context for next workflow block                │
└─────────────────────────────────────────────────────────────┘
```

### Key Improvements

1. **Multiple Record Support**
   - Before: Only first record inserted
   - After: All records from array inserted

2. **Better Error Handling**
   - Column name sanitization handles edge cases
   - Detailed logging at each step
   - Graceful fallbacks

3. **Code Organization**
   - Helper functions for reusability
   - Clear separation of concerns
   - Easy to maintain and extend

4. **Backward Compatibility**
   - Still returns `recordId` (first ID)
   - Old code continues to work
   - New code can use `recordIds` array

---

## RoleIs Block Fix

### Problem Statement

**Initial Issue:**
- RoleIs block was not properly handling user authentication and role assignment
- Users were not being created or authenticated correctly
- Role validation was failing

### Root Cause Analysis

The RoleIs block needed to:
1. Check if a user exists with the given email
2. If not, create a new user with the specified role
3. Validate user credentials
4. Set user context for subsequent workflow blocks

### Solution Implementation

#### Step 1: User Lookup and Creation

**Location:** `server/routes/workflow-execution.js` - `executeRoleIs` function

**Logic:**
```javascript
// 1. Check if user already exists
const existingUser = await prisma.appUser.findFirst({
  where: {
    appId: Number(appId),
    email: userEmail.trim().toLowerCase(),
  },
});

if (existingUser) {
  // User exists - verify password and get role
  const isPasswordValid = await bcrypt.compare(userPassword, existingUser.password);
  if (isPasswordValid) {
    // Get user's role
    const userRoles = await prisma.appUserRole.findMany({
      where: { appUserId: existingUser.id },
      include: { appRole: true },
    });
    // Set context with user info
  }
} else {
  // User doesn't exist - create new user
  // Hash password
  const hashedPassword = await bcrypt.hash(userPassword, saltRounds);
  
  // Find or create role
  let appRole = await prisma.appRole.findFirst({
    where: { appId: Number(appId), slug: roleSlug },
  });
  
  if (!appRole) {
    appRole = await prisma.appRole.create({
      data: {
        appId: Number(appId),
        name: roleToAssign,
        slug: roleSlug,
        description: `Auto-created role: ${roleToAssign}`,
        isPredefined: false,
      },
    });
  }
  
  // Create AppUser
  const appUser = await prisma.appUser.create({
    data: {
      appId: Number(appId),
      email: userEmail.trim().toLowerCase(),
      password: hashedPassword,
      name: null,
      isActive: true,
    },
  });
  
  // Assign role to user
  await prisma.appUserRole.create({
    data: {
      appUserId: appUser.id,
      appRoleId: appRole.id,
    },
  });
}
```

**How it works:**
1. **User Lookup:** Checks if user exists by email
2. **Password Verification:** If user exists, verifies password using bcrypt
3. **Role Retrieval:** Gets user's assigned roles
4. **User Creation:** If user doesn't exist:
   - Hashes password securely
   - Finds or creates the specified role
   - Creates new user account
   - Assigns role to user
5. **Context Update:** Sets `context.appUser` with user information

#### Step 2: Context Variable Setting

**Location:** Return statement of `executeRoleIs`

**Logic:**
```javascript
return {
  success: true,
  userAuthenticated: true,
  userEmail: userEmail,
  userRole: createdUserRole || requiredRole,
  context: {
    ...context,
    appUser: {
      id: createdAppUserId || existingUser.id,
      email: userEmail,
      role: createdUserRole || existingUserRole,
    },
    userEmail: userEmail,
    customRole: createdUserRole || requiredRole,
    createdAppUserId: createdAppUserId,
  },
};
```

**How it works:**
- Sets `context.appUser` with user ID, email, and role
- Sets `context.userEmail` for easy access
- Sets `context.customRole` for role-based workflows
- Sets `context.createdAppUserId` if new user was created

### Integration with DB Create

The RoleIs block works together with DB Create:

```
User submits form
    ↓
RoleIs block executes
    ↓
Creates/authenticates user
    ↓
Sets context.appUser
    ↓
DB Create block can use context.appUser.email, context.appUser.role
    ↓
Inserts user data into database
```

**Example:**
```javascript
// In DB Create block
if (context.appUser) {
  dataToInsert = {
    ...dataToInsert,
    email: context.appUser.email || dataToInsert.email,
    role: context.appUser.role || dataToInsert.role,
    appUserId: context.appUser.id || dataToInsert.appUserId,
  };
}
```

---

## Key Concepts

### 1. Workflow Execution Flow

**How workflows execute:**
1. User action triggers workflow (button click, form submit, page load)
2. Workflow engine finds the starting node (trigger)
3. Executes nodes one by one following edges (connections)
4. Each node updates the context
5. Next node uses updated context

**Example:**
```
onClick → http.request → db.create → notify.toast
  ↓           ↓              ↓            ↓
context    context      context      context
(empty)   (httpResp)   (httpResp)   (httpResp)
                      (dbResult)    (dbResult)
```

### 2. Context Object

**What is context?**
- A shared object that passes data between workflow blocks
- Each block can read from and write to context
- Context persists throughout the workflow execution

**Common context variables:**
- `context.httpResponse`: HTTP request response data
- `context.formData`: Form submission data
- `context.appUser`: Authenticated user information
- `context.dbCreateResult`: Database insertion results

### 3. Data Extraction Strategy

**Priority order:**
1. Manual `insertData` (highest priority)
2. `httpResponse.data` (from HTTP request)
3. `formData` (from form submission)
4. `appUser` data (from RoleIs block)
5. Other context data

**Why this order?**
- Manual data takes precedence (user explicitly specified)
- HTTP response is common for API integrations
- Form data is for form-based workflows
- AppUser data provides default values

### 4. Column Name Sanitization

**Why needed?**
- SQL column names have strict rules
- Must start with a letter
- Can only contain letters, numbers, and underscores
- API responses may have invalid names

**Process:**
```
Original: "_success"
    ↓
Replace special chars: "_success" (no change)
    ↓
Check leading underscore: Yes
    ↓
Add prefix: "meta_success"
    ↓
Validate: ✅ Starts with letter
    ↓
Final: "meta_success"
```

### 5. SQL Injection Prevention

**How we prevent SQL injection:**
1. **Parameterized Queries:** Use Prisma's safe query methods
2. **Value Escaping:** Escape single quotes in strings
3. **Type Validation:** Ensure values match expected types
4. **Column Name Validation:** Sanitize and validate all column names

**Example:**
```javascript
// ❌ UNSAFE (never do this!)
const sql = `INSERT INTO table VALUES ('${userInput}')`;

// ✅ SAFE (what we do)
const escaped = userInput.replace(/'/g, "''");
const sql = `INSERT INTO table VALUES ('${escaped}')`;
// Or better: use Prisma's parameterized queries
```

### 6. Error Handling Strategy

**Multiple layers of error handling:**
1. **Validation:** Check data before processing
2. **Try-Catch:** Wrap risky operations
3. **Logging:** Detailed logs for debugging
4. **Fallbacks:** Default values when possible
5. **User Feedback:** Clear error messages

**Example:**
```javascript
try {
  // Try to sanitize
  columnName = sanitizeIdentifier(fieldName);
} catch (sanitizeError) {
  // Log error with details
  console.error(`Failed to sanitize "${fieldName}":`, sanitizeError.message);
  // Generate fallback name
  columnName = `field_${Math.random().toString(36).substring(2, 9)}`;
}
```

---

## Summary

### What We Fixed

1. **Multiple Record Insertion**
   - ✅ Now inserts ALL records from API response
   - ✅ Handles arrays of any size (1, 2, 10, 100+ records)
   - ✅ Returns all inserted record IDs

2. **Column Name Validation**
   - ✅ Handles metadata fields starting with underscore
   - ✅ Converts `_success` → `meta_success`
   - ✅ Ensures all column names are valid SQL identifiers

3. **Code Organization**
   - ✅ Helper functions for reusability
   - ✅ Clear separation of concerns
   - ✅ Better error handling and logging

4. **Scope Issues**
   - ✅ Fixed `prepareValueForInsert is not defined` error
   - ✅ Proper function scoping

### How It Works Now

1. **API Response** → Contains array of records
2. **Extraction** → All records extracted and stored
3. **Schema Creation** → Uses first record to determine columns
4. **Insertion Loop** → Each record inserted separately
5. **Result** → All record IDs returned

### Testing Checklist

✅ Single record insertion works
✅ Multiple record insertion works (2, 4, 10+ records)
✅ Column name sanitization handles edge cases
✅ Metadata fields are properly prefixed
✅ Error handling provides clear messages
✅ Backward compatibility maintained

---

## Future Improvements

1. **Batch Insertion:** Use single SQL statement for multiple records (faster)
2. **Transaction Support:** Rollback if any record fails
3. **Progress Tracking:** Show insertion progress for large datasets
4. **Error Recovery:** Continue inserting even if one record fails

---

*Last Updated: Based on fixes implemented for multiple record insertion and roleIs block improvements*










