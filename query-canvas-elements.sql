-- Query all canvas elements for app 1
SELECT 
  "elementId",
  type,
  name,
  x,
  y,
  width,
  height
FROM "CanvasElement"
WHERE "canvasId" = (SELECT id FROM "Canvas" WHERE "appId" = 1)
ORDER BY "createdAt" DESC
LIMIT 20;

