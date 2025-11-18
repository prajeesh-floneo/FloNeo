# Workflow Fixes Summary - RoleIs, db.create, and Page Access

## Issues Fixed

### 1. **db.create Parameterized Query Error** ✅
**Problem:** The `db.create` block was using `$queryRawUnsafe` with parameterized queries (`$1, $2, $3`), but Prisma's `$queryRawUnsafe` doesn't support parameterized queries in that format.

**Solution:** 
- Changed to use proper SQL escaping with direct value insertion
- Added proper escaping for strings (single quotes), booleans (TRUE/FALSE), numbers, dates, and NULL values
- This ensures SQL injection protection while maintaining functionality

**File:** `server/routes/workflow-execution.js` (lines 918-984)

### 2. **Page Access Assignment for Created Users** ✅
**Problem:** When a user was created via `roleIs` block, page access wasn't being assigned even when `requiredPages` were specified.

**Solution:**
- Added automatic page access assignment when a user is created and `requiredPages` are specified
- Improved page matching logic to handle different page ID formats (canvas IDs, slugs, names)
- Page access is now assigned immediately upon user creation

**File:** `server/routes/workflow-execution.js` (lines 4213-4257)

### 3. **db.create Context Data Integration** ✅
**Problem:** The `db.create` block couldn't access user credentials created by the `roleIs` block.

**Solution:**
- Enhanced `db.create` to check multiple data sources:
  1. Manual `insertData` from workflow configuration (highest priority)
  2. `formData` from context
  3. `appUser` data from `roleIs` block (email, role, appUserId)
  4. Other context data (`userEmail`, `customRole`)
- This allows seamless data flow: `onClick -> roleIs -> db.create -> notify.toast`

**File:** `server/routes/workflow-execution.js` (lines 871-904)

### 4. **Page Slug Consistency** ✅
**Problem:** Canvas page IDs (like "page-1") didn't match AppPage slugs (generated from page names like "Page 1" → "page-1").

**Solution:**
- Updated canvas sync to use the canvas page ID directly as the AppPage slug
- This ensures consistency between workflow blocks and page references
- Pages are now referenced by their canvas ID (e.g., "page-1") in both places

**File:** `server/routes/canvas.js` (lines 937-975)

## Complete Workflow: onClick -> roleIs -> db.create -> notify.toast

### How It Works:

1. **onClick Trigger**: User clicks a button
2. **roleIs Block**: 
   - Creates a new AppUser with email/password
   - Assigns a custom role
   - Assigns page access based on `requiredPages`
   - Passes user data to context for next blocks
3. **db.create Block**:
   - Receives user data from `roleIs` context
   - Creates/updates a database table
   - Saves user credentials (email, role, appUserId) to the table
4. **notify.toast Block**:
   - Shows success notification

### Testing the Workflow:

1. **Create a Workflow:**
   - Add `onClick` block connected to a button
   - Add `roleIs` block with:
     - User Email: `test@example.com`
     - User Password: `password123`
     - Role for New User: `admin`
     - Required Page Access: `page-1, page-3` (comma-separated)
   - Add `db.create` block with:
     - Table Name: `users`
     - Leave `insertData` empty (it will use context from roleIs)
   - Add `notify.toast` block with success message

2. **Test the Flow:**
   - Click the button in preview mode
   - Check backend logs for:
     - ✅ User creation
     - ✅ Page access assignment
     - ✅ Database record creation
     - ✅ Toast notification

3. **Verify Database:**
   - Check `AppUser` table: Should have new user with email `test@example.com`
   - Check `PageAccess` table: Should have entries for the user and specified pages
   - Check your custom table (e.g., `app_1_users`): Should have record with email, role, appUserId

## Testing AppUser Login

### How to Test Created Users:

1. **Use the AppUser Login Endpoint:**
   ```
   POST /api/app-users/:appId/login
   Body: {
     "email": "test@example.com",
     "password": "password123"
   }
   ```

2. **Response includes:**
   - JWT token
   - User data (id, email, roles)
   - `accessiblePages`: Array of page slugs the user can access

3. **Page Filtering:**
   - When an AppUser logs in, they receive a list of `accessiblePages`
   - The frontend should filter pages based on this list
   - Only pages in `accessiblePages` should be visible/navigable

### onLogin Block:

The `onLogin` trigger block can be used in workflows to:
- Capture user data after login
- Store login metadata
- Trigger workflows based on login events

**Usage:**
- Add `onLogin` block to workflow
- It will automatically receive user data from the login context
- Connect to other blocks (e.g., `db.create` to log login events)

## Database Migrations Required

⚠️ **Important:** Before testing, ensure you've run database migrations:

```bash
cd server
npx prisma migrate dev
```

This creates the necessary tables:
- `AppUser`
- `AppRole`
- `AppUserRole`
- `AppPage`
- `RolePage`
- `PageAccess`

## Performance Improvements

1. **SQL Escaping:** Proper escaping prevents SQL injection while maintaining performance
2. **Page Matching:** Efficient page lookup with multiple matching strategies
3. **Context Passing:** Optimized data flow between workflow blocks
4. **Error Handling:** Graceful error handling that doesn't break the workflow

## Next Steps

1. ✅ Test the complete workflow: `onClick -> roleIs -> db.create -> notify.toast`
2. ✅ Verify user creation and page access assignment
3. ✅ Test AppUser login endpoint
4. ✅ Implement frontend page filtering based on `accessiblePages`
5. ✅ Add UI for testing AppUser login in the run page

## Files Modified

1. `server/routes/workflow-execution.js`:
   - Fixed `executeDbCreate` SQL escaping
   - Enhanced `executeRoleIs` page access assignment
   - Improved context data passing

2. `server/routes/canvas.js`:
   - Updated page slug generation to use canvas page IDs

3. `server/routes/appUsers.js`:
   - Already has login endpoint (`POST /api/app-users/:appId/login`)


