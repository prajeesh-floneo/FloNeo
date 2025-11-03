SELECT id, "appId", "elementId", jsonb_array_length(nodes) as node_count 
FROM "Workflow" 
WHERE "appId" = 1;

