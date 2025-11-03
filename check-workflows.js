#!/usr/bin/env node

const http = require('http');

// First, get a fresh token
const credentials = {
  email: 'demo@example.com',
  password: 'Demo123!@#'
};

const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🔐 Getting Fresh Token...\n');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      
      if (jsonData.success && jsonData.data?.accessToken) {
        const token = jsonData.data.accessToken;
        console.log('✅ Token obtained successfully!\n');
        
        // Now fetch workflows for app 1
        console.log('🔍 Fetching Workflows for App ID 1...\n');
        
        const workflowsOptions = {
          hostname: 'localhost',
          port: 5000,
          path: '/api/canvas/workflows/1?preview=true',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };
        
        const workflowsReq = http.request(workflowsOptions, (workflowsRes) => {
          let workflowsData = '';
          
          workflowsRes.on('data', (chunk) => {
            workflowsData += chunk;
          });
          
          workflowsRes.on('end', () => {
            try {
              const workflowsJson = JSON.parse(workflowsData);
              
              if (workflowsJson.success && workflowsJson.data) {
                const workflows = workflowsJson.data;
                console.log(`✅ Found ${workflows.length} workflow(s):\n`);
                
                workflows.forEach((workflow, idx) => {
                  console.log(`${idx + 1}. Workflow ID: ${workflow.id}`);
                  console.log(`   Name: ${workflow.name}`);
                  console.log(`   Element ID: ${workflow.elementId || 'NULL'}`);
                  console.log(`   Page ID: ${workflow.pageId || 'NULL'}`);
                  console.log(`   Nodes: ${workflow.nodes?.length || 0}`);
                  console.log(`   Edges: ${workflow.edges?.length || 0}`);
                  
                  // Log trigger nodes
                  if (workflow.nodes && workflow.nodes.length > 0) {
                    const triggerNodes = workflow.nodes.filter(n => 
                      n.data?.category === 'Triggers' || 
                      n.data?.label?.includes('on')
                    );
                    console.log(`   Trigger Nodes: ${triggerNodes.length}`);
                    triggerNodes.forEach(tn => {
                      console.log(`     - ${tn.data?.label || tn.type}`);
                    });
                  }
                  console.log('');
                });
              } else {
                console.log('⚠️ No workflows found');
                console.log('Response:', workflowsJson);
              }
            } catch (e) {
              console.log('Error parsing workflows:', e.message);
              console.log('Raw data:', workflowsData);
            }
          });
        });
        
        workflowsReq.on('error', (error) => {
          console.error('❌ Workflows request error:', error.message);
        });
        
        workflowsReq.end();
      } else {
        console.log('❌ Login failed');
        console.log('Response:', jsonData);
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  });
});

loginReq.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

loginReq.write(JSON.stringify(credentials));
loginReq.end();
