#!/usr/bin/env node

/**
 * Run App Diagnostic Script
 * Tests workflow loading and execution in the Run App module
 */

const http = require('http');

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:3000';

// Test credentials
const VALID_CREDENTIALS = {
  email: 'demo@example.com',
  password: 'Demo123!@#'
};

// Utility function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testRunAppWorkflows() {
  console.log('\n🧪 RUN APP DIAGNOSTIC TEST SUITE');
  console.log('================================\n');

  try {
    // Step 1: Login to get token
    console.log('📝 Step 1: Authenticating...');
    const loginResponse = await makeRequest(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      body: VALID_CREDENTIALS
    });

    if (loginResponse.status !== 200) {
      console.log('❌ Login failed');
      return;
    }

    const token = loginResponse.data.data.accessToken;
    console.log('✅ Authentication successful');
    console.log(`   Token: ${token.substring(0, 20)}...`);

    // Step 2: Get list of apps
    console.log('\n📝 Step 2: Fetching apps list...');
    const appsResponse = await makeRequest(`${FRONTEND_URL}/api/apps`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (appsResponse.status !== 200) {
      console.log(`❌ Failed to fetch apps: ${appsResponse.status}`);
      return;
    }

    const apps = appsResponse.data.data || [];
    console.log(`✅ Found ${apps.length} apps`);
    
    if (apps.length === 0) {
      console.log('⚠️  No apps found. Cannot test workflows.');
      return;
    }

    // Step 3: Get workflows for first app
    const appId = apps[0].id;
    console.log(`\n📝 Step 3: Fetching workflows for app ${appId}...`);
    
    const workflowsResponse = await makeRequest(
      `${FRONTEND_URL}/api/canvas/${appId}?preview=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (workflowsResponse.status !== 200) {
      console.log(`❌ Failed to fetch workflows: ${workflowsResponse.status}`);
      console.log(`   Response:`, workflowsResponse.data);
      return;
    }

    const canvas = workflowsResponse.data.data;
    console.log('✅ Canvas data fetched');
    console.log(`   Elements: ${canvas.elements?.length || 0}`);
    console.log(`   Workflows: ${canvas.workflows?.length || 0}`);

    // Step 4: Check workflow structure
    if (canvas.workflows && canvas.workflows.length > 0) {
      console.log('\n📝 Step 4: Analyzing workflow structure...');
      
      canvas.workflows.forEach((workflow, index) => {
        console.log(`\n   Workflow ${index + 1}:`);
        console.log(`   - ID: ${workflow.id}`);
        console.log(`   - Element ID: ${workflow.elementId}`);
        console.log(`   - Nodes: ${workflow.nodes?.length || 0}`);
        console.log(`   - Edges: ${workflow.edges?.length || 0}`);
        
        // Check for trigger nodes
        if (workflow.nodes && Array.isArray(workflow.nodes)) {
          const triggerNodes = workflow.nodes.filter(n => 
            n.data?.category === 'Triggers' || 
            n.data?.label?.includes('on')
          );
          console.log(`   - Trigger nodes: ${triggerNodes.length}`);
          
          if (triggerNodes.length > 0) {
            triggerNodes.forEach(tn => {
              console.log(`     • ${tn.data?.label || tn.type}`);
            });
          }
        }
      });
    } else {
      console.log('⚠️  No workflows found in canvas');
    }

    // Step 5: Test workflow execution
    if (canvas.workflows && canvas.workflows.length > 0) {
      console.log('\n📝 Step 5: Testing workflow execution...');
      
      const workflow = canvas.workflows[0];
      const executionResponse = await makeRequest(
        `${BACKEND_URL}/api/workflow/execute`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: {
            appId: appId,
            nodes: workflow.nodes || [],
            edges: workflow.edges || [],
            context: {
              elementId: workflow.elementId,
              formData: {}
            }
          }
        }
      );

      console.log(`   Response Status: ${executionResponse.status}`);
      
      if (executionResponse.status === 200) {
        console.log('✅ Workflow execution successful');
        console.log(`   Result:`, executionResponse.data);
      } else {
        console.log('❌ Workflow execution failed');
        console.log(`   Error:`, executionResponse.data);
      }
    }

    console.log('\n✅ RUN APP DIAGNOSTIC COMPLETE');

  } catch (error) {
    console.log(`\n❌ Test failed: ${error.message}`);
  }
}

// Run tests
testRunAppWorkflows().catch(console.error);
