# FloNeo LCNC Platform - Canvas API Documentation

## Overview

The Canvas API provides comprehensive backend support for the drag-and-drop canvas interface, enabling users to create, manage, and collaborate on visual application interfaces in real-time.

## Table of Contents

1. [Authentication](#authentication)
2. [Canvas Management](#canvas-management)
3. [Element Operations](#element-operations)
4. [Bulk Operations](#bulk-operations)
5. [Grouping Operations](#grouping-operations)
6. [History & Undo/Redo](#history--undoredo)
7. [Import/Export](#importexport)
8. [Media Management](#media-management)
9. [Real-time Events](#real-time-events)
10. [Element Types & Validation](#element-types--validation)
11. [Performance Optimization](#performance-optimization)

## Authentication

All Canvas API endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Canvas Management

### Get Canvas
```http
GET /api/canvas/:appId
```

**Description:** Retrieves or creates a canvas for the specified app.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "appId": 123,
    "name": "My Canvas",
    "description": "Canvas description",
    "width": 1200,
    "height": 800,
    "background": {"color": "#ffffff", "opacity": 100},
    "gridEnabled": true,
    "snapEnabled": true,
    "zoomLevel": 1.0,
    "elements": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Canvas
```http
PUT /api/canvas/:appId
```

**Request Body:**
```json
{
  "name": "Updated Canvas Name",
  "description": "Updated description",
  "width": 1600,
  "height": 1000,
  "background": {"color": "#f0f0f0", "opacity": 90},
  "gridEnabled": false,
  "snapEnabled": true,
  "zoomLevel": 1.5
}
```

## Element Operations

### Create Element
```http
POST /api/canvas/:appId/elements
```

**Request Body:**
```json
{
  "type": "TEXT_FIELD",
  "name": "Username Field",
  "x": 100,
  "y": 200,
  "width": 300,
  "height": 40,
  "rotation": 0,
  "zIndex": 1,
  "groupId": null,
  "parentId": null,
  "properties": {
    "placeholder": "Enter username",
    "required": true,
    "maxlength": 50
  },
  "styles": {
    "fill": {"color": "#ffffff", "opacity": 100},
    "stroke": {"color": "#cccccc", "opacity": 100, "weight": 1},
    "cornerRadius": 4
  },
  "constraints": {}
}
```

### Update Element
```http
PUT /api/canvas/:appId/elements/:elementId
```

**Request Body:** Same structure as create, with only fields to update.

### Delete Element
```http
DELETE /api/canvas/:appId/elements/:elementId
```

### Duplicate Element
```http
POST /api/canvas/:appId/elements/:elementId/duplicate
```

**Request Body:**
```json
{
  "offsetX": 20,
  "offsetY": 20
}
```

## Bulk Operations

### Bulk Update Elements
```http
PUT /api/canvas/:appId/elements/bulk
```

**Request Body:**
```json
{
  "elements": [
    {
      "elementId": "element-uuid-1",
      "updateData": {"x": 150, "y": 200}
    },
    {
      "elementId": "element-uuid-2", 
      "updateData": {"width": 300, "height": 50}
    }
  ]
}
```

### Bulk Delete Elements
```http
DELETE /api/canvas/:appId/elements/bulk
```

**Request Body:**
```json
{
  "elementIds": ["element-uuid-1", "element-uuid-2"]
}
```

## Grouping Operations

### Create Group
```http
POST /api/canvas/:appId/groups
```

**Request Body:**
```json
{
  "elementIds": ["element-uuid-1", "element-uuid-2"],
  "groupName": "Header Group"
}
```

### Ungroup Elements
```http
DELETE /api/canvas/:appId/groups/:groupId
```

## History & Undo/Redo

### Get Canvas History
```http
GET /api/canvas/:appId/history?page=1&limit=50&action=element_create
```

### Undo Last Action
```http
POST /api/canvas/:appId/undo
```

### Redo Last Action
```http
POST /api/canvas/:appId/redo
```

## Import/Export

### Export Canvas
```http
GET /api/canvas/:appId/export?format=json&includeHistory=false
```

**Query Parameters:**
- `format`: `json` or `template`
- `includeHistory`: `true` or `false`

### Import Canvas
```http
POST /api/canvas/:appId/import
```

**Request Body:**
```json
{
  "canvasData": {
    "canvas": {...},
    "elements": [...]
  },
  "replaceExisting": false,
  "validateElements": true
}
```

## Media Management

### Upload Media Files
```http
POST /api/media/upload
```

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `files`: File(s) to upload (max 10 files, 50MB each)
- `appId`: Associated app ID (optional)

**Supported File Types:**
- Images: JPEG, PNG, GIF, WebP, SVG
- Videos: MP4, WebM, OGG
- Audio: MP3, WAV, OGG
- Documents: PDF, TXT, DOC, DOCX

### Get Media Files
```http
GET /api/media?appId=123&type=image&page=1&limit=20
```

### Delete Media File
```http
DELETE /api/media/:id
```

### Serve Media File
```http
GET /api/media/files/:filename
```

### Serve Thumbnail
```http
GET /api/media/thumbnails/:filename
```

## Real-time Events

The Canvas API supports real-time collaboration through Socket.io events:

### Canvas Events
- `canvas:updated` - Canvas properties changed
- `canvas:imported` - Canvas imported
- `canvas:undo` - Undo action performed
- `canvas:redo` - Redo action performed

### Element Events
- `element:created` - New element added
- `element:updated` - Element properties changed
- `element:deleted` - Element removed
- `element:duplicated` - Element duplicated

### Collaboration Events
- `canvas:user-joined` - User joined canvas
- `canvas:user-left` - User left canvas
- `cursor:user-moved` - User cursor moved
- `element:selected-by-user` - Element selected
- `element:drag-started-by-user` - Element drag started
- `element:drag-moved-by-user` - Element being dragged
- `element:drag-ended-by-user` - Element drag ended

### Client-side Socket Events
```javascript
// Join canvas room
socket.emit('canvas:join', { appId: 123 });

// Track cursor movement
socket.emit('cursor:move', { appId: 123, x: 100, y: 200 });

// Element selection
socket.emit('element:select', { appId: 123, elementId: 'uuid' });

// Element dragging
socket.emit('element:drag-start', { 
  appId: 123, 
  elementId: 'uuid', 
  startPosition: { x: 100, y: 200 } 
});
```

## Element Types & Validation

### Supported Element Types

1. **TEXT_FIELD**
   - Required: `placeholder`
   - Optional: `value`, `maxlength`, `minlength`, `required`, `readonly`, `disabled`, `inputType`, `pattern`

2. **TEXT_AREA**
   - Required: `placeholder`
   - Optional: `value`, `rows`, `cols`, `maxlength`, `required`, `readonly`, `disabled`

3. **DROPDOWN**
   - Required: `options`
   - Optional: `value`, `defaultValue`, `multiple`, `disabled`, `required`

4. **CHECKBOX**
   - Required: `name`
   - Optional: `checked`, `value`, `disabled`, `required`

5. **RADIO_BUTTON**
   - Required: `name`, `value`
   - Optional: `checked`, `disabled`, `required`

6. **PHONE_FIELD**
   - Required: `placeholder`
   - Optional: `value`, `maxlength`, `minlength`, `inputType`, `pattern`, `required`, `disabled`, `countryCode`

7. **TOGGLE**
   - Optional: `checked`, `disabled`, `value`, `defaultValue`

8. **DATE_PICKER**
   - Optional: `value`, `min`, `max`, `required`, `disabled`, `format`

9. **IMAGE**
   - Required: `src`
   - Optional: `alt`, `title`, `loading`

10. **BUTTON**
    - Required: `text`
    - Optional: `type`, `disabled`, `onClick`, `style`

11. **UPLOAD_MEDIA**
    - Optional: `accept`, `multiple`, `required`, `disabled`, `maxSize`

12. **ADD_MEDIA**
    - Required: `source`
    - Optional: `multiple`, `disabled`, `required`

13. **SHAPE**
    - Required: `type`
    - Optional: `color`, `size`, `rotation`, `border`

### Style Properties

All elements support these style properties:
- `opacity`: 0-100
- `cornerRadius`: 0-1000
- `fill`: `{color: "#ffffff", opacity: 100}`
- `stroke`: `{color: "#000000", opacity: 100, weight: 1, position: "inside"}`

### Position Properties

All elements have these position properties:
- `x`, `y`: Position coordinates
- `width`, `height`: Dimensions
- `rotation`: -360 to 360 degrees
- `zIndex`: Layer order (-1000 to 1000)

## Performance Optimization

### Caching

The API implements multi-level caching:
- Canvas data cached for 5 minutes
- Element data cached for 3 minutes  
- Media files cached for 10 minutes

### Viewport Filtering

For large canvases, use viewport filtering:
```http
GET /api/canvas/:appId?viewport={"x":0,"y":0,"width":1200,"height":800,"zoom":1}
```

### Pagination

Large element lists are automatically paginated:
```http
GET /api/canvas/:appId/elements?page=1&limit=50
```

### Bulk Operations

Use bulk operations for better performance when updating multiple elements.

## Error Handling

All endpoints return consistent error responses:
```json
{
  "success": false,
  "message": "Error description",
  "validationErrors": [...] // For validation failures
}
```

## Rate Limiting

- Canvas operations: 100 requests per minute
- Media uploads: 20 requests per minute
- Bulk operations: 10 requests per minute

## Database Schema

The Canvas system uses these main models:
- `Canvas`: Canvas properties and settings
- `CanvasElement`: Individual elements on canvas
- `CanvasHistory`: Action history for undo/redo
- `ElementInteraction`: Element event handlers
- `ElementValidation`: Element validation rules
- `MediaFile`: Uploaded media files

For complete schema details, see `server/prisma/schema.prisma`.

## Frontend Integration Guide

### 1. Canvas Initialization

```javascript
// Initialize canvas connection
const socket = io('http://localhost:5000', {
  auth: { token: authToken }
});

// Join canvas room
socket.emit('canvas:join', { appId: 123 });

// Load canvas data
const loadCanvas = async (appId) => {
  const response = await fetch(`/api/canvas/${appId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return response.json();
};
```

### 2. Element Management

```javascript
// Create element
const createElement = async (appId, elementData) => {
  const response = await fetch(`/api/canvas/${appId}/elements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(elementData)
  });
  return response.json();
};

// Update element
const updateElement = async (appId, elementId, updateData) => {
  const response = await fetch(`/api/canvas/${appId}/elements/${elementId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(updateData)
  });
  return response.json();
};
```

### 3. Real-time Collaboration

```javascript
// Listen for real-time updates
socket.on('element:created', (data) => {
  // Add new element to canvas
  addElementToCanvas(data.element);
});

socket.on('element:updated', (data) => {
  // Update existing element
  updateElementOnCanvas(data.element);
});

socket.on('cursor:user-moved', (data) => {
  // Show other user's cursor
  showUserCursor(data.user, data.cursor);
});

// Send cursor updates
const onMouseMove = (event) => {
  socket.emit('cursor:move', {
    appId: currentAppId,
    x: event.clientX,
    y: event.clientY
  });
};
```

### 4. File Upload Integration

```javascript
// Upload media files
const uploadFiles = async (files, appId) => {
  const formData = new FormData();
  formData.append('appId', appId);

  for (let file of files) {
    formData.append('files', file);
  }

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: formData
  });

  return response.json();
};
```

### 5. Undo/Redo Implementation

```javascript
// Undo last action
const undo = async (appId) => {
  const response = await fetch(`/api/canvas/${appId}/undo`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return response.json();
};

// Redo last action
const redo = async (appId) => {
  const response = await fetch(`/api/canvas/${appId}/redo`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  return response.json();
};
```

## Best Practices

1. **Performance**: Use viewport filtering for large canvases
2. **Caching**: Implement client-side caching for frequently accessed data
3. **Real-time**: Throttle cursor movement events to avoid spam
4. **Validation**: Validate element data on client before sending to server
5. **Error Handling**: Implement proper error handling and user feedback
6. **File Uploads**: Show upload progress and validate file types/sizes
7. **Collaboration**: Implement conflict resolution for simultaneous edits
