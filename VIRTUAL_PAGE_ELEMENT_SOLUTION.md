# Virtual Page Element Solution - Complete Documentation

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Implementation Details](#implementation-details)
5. [Database Schema](#database-schema)
6. [Frontend Changes](#frontend-changes)
7. [Backend Changes](#backend-changes)
8. [Workflow Execution](#workflow-execution)
9. [User Experience](#user-experience)
10. [Migration Guide](#migration-guide)
11. [Testing Strategy](#testing-strategy)
12. [FAQ](#faq)

---

## 🎯 OVERVIEW

### What is a Virtual Page Element?

A **Virtual Page Element** is an invisible, system-generated canvas element that represents the page itself. It serves as an anchor point for page-level workflows (like `onPageLoad`, `onLogin`) without requiring changes to the existing element-based workflow system.

### Key Characteristics:

- **Invisible**: Not rendered on the canvas
- **Automatic**: Created when a page is created
- **Immutable**: Cannot be deleted or moved by users
- **Special ID Format**: `page-{pageId}` (e.g., `page-1`, `page-2`)
- **Limited Triggers**: Only supports page-level triggers (onPageLoad, onLogin)

---

## 🔍 PROBLEM STATEMENT

### Current System:

- Workflows are **element-based** (attached to buttons, forms, inputs, etc.)
- Each element has a unique `elementId`
- Workflows are stored with `appId` + `elementId` as unique key
- Workflow execution is triggered by element events (onClick, onSubmit, etc.)

### Challenge:

- `onPageLoad` is a **page-level trigger**, not an element-level trigger
- No specific element to attach the workflow to
- Need a solution that **doesn't change** the existing workflow system

### Solution:

Create a **virtual element** that represents the page itself, allowing page-level workflows to use the same element-based workflow system.

---

## 🏗️ SOLUTION ARCHITECTURE

### Architecture Diagram:

```
┌─────────────────────────────────────────────────────────────┐
│                         FloNeo App                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Page 1     │  │   Page 2     │  │   Page 3     │     │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤     │
│  │              │  │              │  │              │     │
│  │ Virtual Elem │  │ Virtual Elem │  │ Virtual Elem │     │
│  │ ID: page-1   │  │ ID: page-2   │  │ ID: page-3   │     │
│  │ (invisible)  │  │ (invisible)  │  │ (invisible)  │     │
│  │              │  │              │  │              │     │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │     │
│  │ │ Button-1 │ │  │ │ Form-1   │ │  │ │ Input-1  │ │     │
│  │ │ onClick  │ │  │ │ onSubmit │ │  │ │ onChange │ │     │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │     │
│  │              │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Workflow Storage (Database):
┌─────────┬────────────┬──────────────────────────────────┐
│ appId   │ elementId  │ Workflow (nodes, edges)          │
├─────────┼────────────┼──────────────────────────────────┤
│ 1       │ page-1     │ onPageLoad → db.find → ui.render │
│ 1       │ page-2     │ onPageLoad → auth.verify → ...   │
│ 1       │ button-1   │ onClick → http.request → ...     │
│ 1       │ form-1     │ onSubmit → db.create → ...       │
└─────────┴────────────┴──────────────────────────────────┘
```

### Data Flow:

```
1. Page Creation
   ↓
2. Auto-create Virtual Page Element (page-{pageId})
   ↓
3. User configures onPageLoad workflow
   ↓
4. Workflow saved with elementId = "page-{pageId}"
   ↓
5. Page loads in run mode
   ↓
6. System triggers workflow for "page-{pageId}"
   ↓
7. Workflow executes normally
```

---

## 🛠️ IMPLEMENTATION DETAILS

### Phase 1: Database & Backend

#### 1.1 Virtual Element Structure

```javascript
const virtualPageElement = {
  id: `page-${pageId}`, // Unique ID format
  type: "virtual-page", // Special type
  properties: {
    isVirtual: true, // Flag for filtering
    pageId: pageId, // Reference to page
    pageName: pageName, // Page name for display
    visible: false, // Never render on canvas
    draggable: false, // Cannot be moved
    deletable: false, // Cannot be deleted
    allowedTriggers: [
      // Only page-level triggers
      "onPageLoad",
      "onLogin",
    ],
  },
  position: { x: 0, y: 0 }, // Dummy position
  size: { width: 0, height: 0 }, // No size
  styles: {}, // No styles
  canvasId: canvasId, // Link to canvas
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

#### 1.2 Auto-Creation Logic

**Location**: `server/routes/canvas.js` - Page creation endpoint

```javascript
// POST /api/canvas/:appId/pages - Create new page
router.post("/:appId/pages", authenticateToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const { name, route } = req.body;

    // 1. Create the page
    const page = await prisma.page.create({
      data: {
        appId: parseInt(appId),
        name: name,
        route: route,
        // ... other fields
      },
    });

    // 2. Auto-create virtual page element
    const virtualElement = await prisma.canvasElement.create({
      data: {
        id: `page-${page.id}`,
        type: "virtual-page",
        properties: {
          isVirtual: true,
          pageId: page.id,
          pageName: page.name,
          visible: false,
          draggable: false,
          deletable: false,
          allowedTriggers: ["onPageLoad", "onLogin"],
        },
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        styles: {},
        canvasId: canvasId,
      },
    });

    console.log("✅ Created virtual page element:", virtualElement.id);

    res.json({
      success: true,
      data: {
        page,
        virtualElement,
      },
    });
  } catch (error) {
    console.error("❌ Page creation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

#### 1.3 Prevent Deletion of Virtual Elements

```javascript
// DELETE /api/canvas/:appId/elements/:elementId
router.delete(
  "/:appId/elements/:elementId",
  authenticateToken,
  async (req, res) => {
    try {
      const { elementId } = req.params;

      // Check if element is virtual
      const element = await prisma.canvasElement.findUnique({
        where: { id: elementId },
      });

      if (element?.properties?.isVirtual) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete virtual page element",
        });
      }

      // Proceed with normal deletion
      await prisma.canvasElement.delete({
        where: { id: elementId },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

---

### Phase 2: Frontend - Canvas

#### 2.1 Filter Virtual Elements from Canvas Display

**Location**: `client/app/canvas/page.tsx`

```typescript
// Filter out virtual elements when rendering canvas
const visibleElements = useMemo(() => {
  return canvasElements.filter((el) => {
    // Hide virtual page elements
    if (el.properties?.isVirtual === true) {
      return false;
    }
    return true;
  });
}, [canvasElements]);

// Use visibleElements for rendering
return (
  <div className="canvas">
    {visibleElements.map((element) => (
      <CanvasElement key={element.id} element={element} />
    ))}
  </div>
);
```

#### 2.2 Load Virtual Elements in Context

**Location**: `client/app/canvas/page.tsx` - Canvas data loading

```typescript
useEffect(() => {
  const loadCanvasData = async () => {
    // ... existing code to load canvas

    // Load ALL elements including virtual ones
    const response = await fetch(`/api/canvas/${appId}/elements`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();

    // Store all elements (including virtual) in context
    setCanvasElements(data.elements);

    // Separate virtual elements for special handling
    const virtualElements = data.elements.filter(
      (el) => el.properties?.isVirtual
    );
    const regularElements = data.elements.filter(
      (el) => !el.properties?.isVirtual
    );

    console.log("📄 Loaded virtual page elements:", virtualElements.length);
    console.log("🎨 Loaded regular elements:", regularElements.length);
  };

  loadCanvasData();
}, [appId]);
```

---

### Phase 3: Frontend - Workflow Builder

#### 3.1 Add Page Workflows Section

**Location**: `client/workflow-builder/components/workflow-builder.tsx`

```typescript
function WorkflowBuilderContent() {
  const { selectedElementId, setSelectedElementId, canvasElements, pages } =
    useCanvasWorkflow();
  const [currentPageId, setCurrentPageId] = useState<number | null>(null);

  // Get virtual page element for current page
  const virtualPageElement = useMemo(() => {
    if (!currentPageId) return null;
    return canvasElements.find((el) => el.id === `page-${currentPageId}`);
  }, [currentPageId, canvasElements]);

  return (
    <div className="workflow-builder">
      {/* Page-Level Workflows Section */}
      <div className="page-workflows-section">
        <h3 className="text-sm font-semibold mb-2">📄 Page-Level Workflows</h3>

        {/* Page Selector */}
        <select
          value={currentPageId || ""}
          onChange={(e) => setCurrentPageId(parseInt(e.target.value))}
          className="w-full mb-2"
        >
          <option value="">Select a page...</option>
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.name}
            </option>
          ))}
        </select>

        {/* Page Load Workflow Button */}
        {currentPageId && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setSelectedElementId(`page-${currentPageId}`)}
          >
            <FileCode className="w-4 h-4 mr-2" />
            Configure Page Load Workflow
          </Button>
        )}

        {virtualPageElement && selectedElementId === virtualPageElement.id && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
            ✅ Editing page load workflow for:{" "}
            {virtualPageElement.properties.pageName}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* Element Workflows Section */}
      <div className="element-workflows-section">
        <h3 className="text-sm font-semibold mb-2">🎨 Element Workflows</h3>
        {/* ... existing element workflow UI ... */}
      </div>
    </div>
  );
}
```

#### 3.2 Restrict Trigger Blocks for Virtual Elements

**Location**: `client/workflow-builder/components/block-library.tsx`

```typescript
// Filter blocks based on selected element type
const getAvailableBlocks = (selectedElementId: string | null) => {
  if (!selectedElementId) return allBlocks;

  // Check if selected element is virtual page element
  const isVirtualPage = selectedElementId.startsWith("page-");

  if (isVirtualPage) {
    // Only show page-level triggers
    return allBlocks.filter((block) => {
      if (block.category === "Triggers") {
        return ["onPageLoad", "onLogin"].includes(block.name);
      }
      return true; // Allow all actions and conditions
    });
  }

  // For regular elements, exclude page-level triggers
  return allBlocks.filter((block) => {
    if (block.category === "Triggers") {
      return !["onPageLoad", "onLogin"].includes(block.name);
    }
    return true;
  });
};
```

---

### Phase 4: Frontend - Run Mode

#### 4.1 Trigger Page Load Workflows

**Location**: `client/app/run/page.tsx`

```typescript
// Trigger onPageLoad workflows when page changes
useEffect(() => {
  if (!currentPageId || !workflowIndex) return;

  console.log("🌐 [PAGE-LOAD] Page changed to:", currentPageId);

  // Get virtual element ID for this page
  const virtualElementId = `page-${currentPageId}`;

  // Find onPageLoad workflows for this virtual element
  const pageLoadKey = `${virtualElementId}:pageLoad` as TriggerKey;
  const workflows = workflowIndex.get(pageLoadKey);

  if (workflows && workflows.length > 0) {
    console.log(
      `🚀 [PAGE-LOAD] Found ${workflows.length} onPageLoad workflow(s)`
    );

    workflows.forEach((wf, index) => {
      console.log(
        `🚀 [PAGE-LOAD] Executing workflow ${index + 1}/${workflows.length}`
      );

      runWorkflow(wf, {
        pageId: currentPageId,
        pageName: pages.find((p) => p.id === currentPageId)?.name,
        timestamp: new Date().toISOString(),
        triggerType: "pageLoad",
      });
    });
  } else {
    console.log("ℹ️ [PAGE-LOAD] No onPageLoad workflows for this page");
  }
}, [currentPageId, workflowIndex]);
```

#### 4.2 Index Virtual Element Workflows

**Location**: `client/app/run/page.tsx` - Workflow indexing

```typescript
const indexWorkflows = useCallback((workflows: Workflow[]) => {
  const idx = new Map<TriggerKey, Workflow[]>();

  workflows.forEach((workflow) => {
    const { elementId, nodes } = workflow;

    // Check if this is a virtual page element
    const isVirtualPage = elementId.startsWith("page-");

    if (isVirtualPage) {
      console.log(
        "📄 [WF-INDEX] Indexing virtual page element workflow:",
        elementId
      );
    }

    // Find trigger node
    const triggerNode = nodes.find((n) => n.data?.category === "Triggers");

    if (!triggerNode) {
      console.warn("[WF-INDEX] No trigger node found for workflow:", elementId);
      return;
    }

    const triggerType = triggerNode.data.label;

    // Index by trigger type
    if (triggerType === "onPageLoad") {
      const key = `${elementId}:pageLoad` as TriggerKey;
      const existing = idx.get(key) ?? [];
      idx.set(key, [...existing, workflow]);
      console.log("[WF-INDEX] Indexed onPageLoad workflow:", key);
    } else if (triggerType === "onLogin") {
      const key = `${elementId}:login` as TriggerKey;
      const existing = idx.get(key) ?? [];
      idx.set(key, [...existing, workflow]);
      console.log("[WF-INDEX] Indexed onLogin workflow:", key);
    }
    // ... other trigger types
  });

  return idx;
}, []);
```

---

## 📊 DATABASE SCHEMA

### No Schema Changes Required!

The existing `CanvasElement` table already supports virtual elements:

```prisma
model CanvasElement {
  id         String   @id @default(uuid())
  type       String   // "virtual-page" for virtual elements
  properties Json     // { isVirtual: true, pageId, ... }
  position   Json
  size       Json
  styles     Json
  canvasId   Int
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  canvas     Canvas   @relation(fields: [canvasId], references: [id])
}
```

The existing `Workflow` table already supports virtual elements:

```prisma
model Workflow {
  id        Int      @id @default(autoincrement())
  appId     Int
  elementId String   // Can be "page-1", "page-2", etc.
  name      String
  nodes     Json
  edges     Json
  metadata  Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  app       App      @relation(fields: [appId], references: [id])

  @@unique([appId, elementId])
  @@index([appId])
  @@index([elementId])
}
```

**No migrations needed!** ✅

---

## 🎨 USER EXPERIENCE

### Workflow Builder UI:

```
┌────────────────────────────────────────────────────────────┐
│  Workflow Builder - App: My App                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📄 Page-Level Workflows                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Select Page: [Home Page ▼]                          │ │
│  │                                                      │ │
│  │ [📄 Configure Page Load Workflow]                   │ │
│  │                                                      │ │
│  │ ✅ Editing page load workflow for: Home Page        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│  🎨 Element Workflows                                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ • Button-1 (onClick)                                 │ │
│  │ • Form-1 (onSubmit)                                  │ │
│  │ • Input-1 (onChange)                                 │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Block Library (for Virtual Page Element):

```
Available Triggers:
✅ onPageLoad  - Triggers when page loads
✅ onLogin     - Triggers after user login
❌ onClick     - (Not available for page-level)
❌ onSubmit    - (Not available for page-level)
❌ onChange    - (Not available for page-level)
```

---

## 🔄 MIGRATION GUIDE

### For Existing Apps:

**Step 1**: Run migration script to create virtual elements for existing pages

```javascript
// migration-script.js
const createVirtualElementsForExistingPages = async () => {
  const pages = await prisma.page.findMany();

  for (const page of pages) {
    const virtualElementId = `page-${page.id}`;

    // Check if virtual element already exists
    const existing = await prisma.canvasElement.findUnique({
      where: { id: virtualElementId },
    });

    if (!existing) {
      await prisma.canvasElement.create({
        data: {
          id: virtualElementId,
          type: "virtual-page",
          properties: {
            isVirtual: true,
            pageId: page.id,
            pageName: page.name,
            visible: false,
            draggable: false,
            deletable: false,
            allowedTriggers: ["onPageLoad", "onLogin"],
          },
          position: { x: 0, y: 0 },
          size: { width: 0, height: 0 },
          styles: {},
          canvasId: page.canvasId,
        },
      });

      console.log(`✅ Created virtual element for page: ${page.name}`);
    }
  }

  console.log("✅ Migration complete!");
};
```

**Step 2**: No changes needed for existing workflows - they continue to work as before

---

## 🧪 TESTING STRATEGY

### Unit Tests:

```javascript
describe("Virtual Page Elements", () => {
  test("should create virtual element when page is created", async () => {
    const page = await createPage({ name: "Test Page" });
    const virtualElement = await prisma.canvasElement.findUnique({
      where: { id: `page-${page.id}` },
    });

    expect(virtualElement).toBeDefined();
    expect(virtualElement.properties.isVirtual).toBe(true);
  });

  test("should prevent deletion of virtual elements", async () => {
    const response = await request(app)
      .delete(`/api/canvas/1/elements/page-1`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain("Cannot delete virtual");
  });

  test("should filter virtual elements from canvas display", () => {
    const elements = [
      { id: "page-1", properties: { isVirtual: true } },
      { id: "button-1", properties: {} },
    ];

    const visible = elements.filter((el) => !el.properties?.isVirtual);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("button-1");
  });
});
```

### Integration Tests:

```javascript
describe("Page Load Workflow", () => {
  test("should trigger onPageLoad workflow when page loads", async () => {
    // 1. Create page with virtual element
    const page = await createPage({ name: "Test Page" });

    // 2. Create onPageLoad workflow
    const workflow = await createWorkflow({
      elementId: `page-${page.id}`,
      nodes: [
        { id: "1", data: { label: "onPageLoad", category: "Triggers" } },
        { id: "2", data: { label: "notify.toast", category: "Actions" } },
      ],
      edges: [{ source: "1", target: "2" }],
    });

    // 3. Load page in run mode
    const result = await loadPage(page.id);

    // 4. Verify workflow was triggered
    expect(result.workflowsTriggered).toContain(workflow.id);
  });
});
```

---

## ❓ FAQ

### Q1: Can users see virtual page elements?

**A**: No, they are completely invisible in the canvas. They only appear in the workflow builder's "Page-Level Workflows" section.

### Q2: Can users delete virtual page elements?

**A**: No, deletion is prevented by the backend. Virtual elements are system-managed.

### Q3: What happens if a page is deleted?

**A**: The virtual element should be deleted automatically (cascade delete). The associated workflows will also be deleted.

### Q4: Can I attach regular element triggers (onClick, onSubmit) to virtual elements?

**A**: No, the block library filters out non-page-level triggers when a virtual element is selected.

### Q5: How do I migrate existing apps?

**A**: Run the migration script to create virtual elements for existing pages. Existing workflows are unaffected.

### Q6: Does this work with multi-page apps?

**A**: Yes! Each page gets its own virtual element (`page-1`, `page-2`, etc.), so each page can have its own onPageLoad workflow.

### Q7: Can I have multiple onPageLoad workflows per page?

**A**: Yes, you can create multiple workflow nodes in a single workflow, or create multiple workflows attached to the same virtual element.

### Q8: What about performance?

**A**: Minimal impact. Virtual elements are filtered out during rendering, and workflow indexing is the same as regular elements.

---

## ✅ SUMMARY

### What You Get:

✅ **No changes to workflow system** - Uses existing element-based architecture  
✅ **Automatic virtual elements** - Created when pages are created  
✅ **Clean UI** - Separate section for page-level workflows  
✅ **Backward compatible** - Existing workflows unaffected  
✅ **Scalable** - Easy to add more page-level triggers  
✅ **Type-safe** - Full TypeScript support  
✅ **Well-tested** - Comprehensive test coverage

### Implementation Effort:

- **Backend**: ~2 hours (auto-creation, deletion prevention)
- **Frontend Canvas**: ~1 hour (filtering virtual elements)
- **Frontend Workflow Builder**: ~2 hours (page workflows UI)
- **Frontend Run Mode**: ~1 hour (trigger page load workflows)
- **Testing**: ~2 hours (unit + integration tests)
- **Total**: ~8 hours

---
