-- Query all workflows with their elementIds
SELECT 
  id, 
  "appId",
  "elementId", 
  name,
  jsonb_array_length(nodes) as node_count,
  jsonb_array_length(edges) as edge_count,
  "createdAt",
  "updatedAt"
FROM "Workflow"
WHERE "appId" = 1
ORDER BY "updatedAt" DESC;

