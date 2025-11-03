#!/usr/bin/env node

const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJkZW1vQGV4YW1wbGUuY29tIiwicm9sZSI6ImRldmVsb3BlciIsImlhdCI6MTc2MTEzMjYwMCwiZXhwIjoxNzYxMTM2MjAwfQ.qv82oT2JXGCAOhemIoiG5ytACwunvLeTHrB9OgTPbJI';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/canvas/workflows/2?preview=true',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('🔍 Testing Workflows API...\n');
console.log('Request:', {
  url: `http://${options.hostname}:${options.port}${options.path}`,
  method: options.method,
  headers: options.headers
});

const req = http.request(options, (res) => {
  let data = '';

  console.log(`\n📊 Response Status: ${res.statusCode}`);
  console.log('Response Headers:', res.headers);
  console.log('\n📄 Response Body:\n');

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
      
      if (jsonData.success && jsonData.data) {
        const workflows = Array.isArray(jsonData.data) ? jsonData.data : [jsonData.data];
        console.log(`\n✅ Found ${workflows.length} workflow(s)`);
        
        workflows.forEach((wf, idx) => {
          console.log(`\nWorkflow ${idx + 1}:`);
          console.log(`  - ID: ${wf.id}`);
          console.log(`  - Element ID: ${wf.elementId}`);
          console.log(`  - Nodes: ${wf.nodes?.length || 0}`);
          console.log(`  - Edges: ${wf.edges?.length || 0}`);
          
          if (wf.nodes && wf.nodes.length > 0) {
            console.log(`  - Node types: ${wf.nodes.map(n => n.data?.label || n.type).join(', ')}`);
          }
        });
      } else {
        console.log('\n⚠️ No workflows found or error in response');
      }
    } catch (e) {
      console.log('Raw data:', data);
      console.log('Parse error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.end();
