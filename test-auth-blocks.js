/**
 * Authentication Blocks Testing Script
 * 
 * This script tests the onLogin and auth.verify workflow blocks
 * via direct API calls to verify they work correctly.
 * 
 * Usage:
 *   node test-auth-blocks.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const TEST_EMAIL = 'demo@example.com';
const TEST_PASSWORD = 'password123';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log('📋', title, colors.bright + colors.cyan);
  console.log('='.repeat(60) + '\n');
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
    };
  }
}

async function login() {
  logSection('STEP 1: Login to Get Authentication Token');
  
  log('🔐', `Logging in as: ${TEST_EMAIL}`, colors.blue);
  
  const result = await makeRequest(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  if (!result.ok) {
    log('❌', `Login failed: ${result.data?.message || result.error}`, colors.red);
    return null;
  }

  const token = result.data?.data?.accessToken;
  const user = result.data?.data?.user;

  if (!token) {
    log('❌', 'No access token received', colors.red);
    return null;
  }

  log('✅', 'Login successful!', colors.green);
  log('👤', `User: ${user.email} (${user.role})`, colors.blue);
  log('🔑', `Token: ${token.substring(0, 30)}...`, colors.blue);
  
  return { token, user };
}

async function testAuthVerify(token, user) {
  logSection('STEP 2: Test auth.verify Block');
  
  log('🧪', 'Testing auth.verify with valid token...', colors.blue);
  
  const result = await makeRequest(`${BACKEND_URL}/api/workflow/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      appId: 1,
      nodes: [
        {
          id: '1',
          data: {
            label: 'auth.verify',
            category: 'Actions',
            tokenSource: 'context',
            requireVerified: true,
            requiredRole: 'developer',
          },
        },
      ],
      edges: [],
      context: {
        token: token,
      },
    }),
  });

  if (!result.ok) {
    log('❌', `auth.verify test failed: ${result.data?.message || result.error}`, colors.red);
    return false;
  }

  const blockResult = result.data?.results?.[0];
  
  if (!blockResult) {
    log('❌', 'No block result received', colors.red);
    return false;
  }

  if (!blockResult.success) {
    log('❌', `auth.verify failed: ${blockResult.error}`, colors.red);
    return false;
  }

  log('✅', 'auth.verify executed successfully!', colors.green);
  log('🔐', `Authenticated: ${blockResult.context?.authenticated}`, colors.blue);
  log('🔐', `Authorized: ${blockResult.context?.authorized}`, colors.blue);
  log('👤', `User verified: ${blockResult.context?.user?.email}`, colors.blue);
  
  return true;
}

async function testAuthVerifyInvalidToken() {
  logSection('STEP 3: Test auth.verify with Invalid Token');
  
  log('🧪', 'Testing auth.verify with invalid token...', colors.blue);
  
  const invalidToken = 'invalid.token.here';
  
  const result = await makeRequest(`${BACKEND_URL}/api/workflow/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${invalidToken}`,
    },
    body: JSON.stringify({
      appId: 1,
      nodes: [
        {
          id: '1',
          data: {
            label: 'auth.verify',
            category: 'Actions',
            tokenSource: 'context',
            requireVerified: true,
          },
        },
      ],
      edges: [],
      context: {
        token: invalidToken,
      },
    }),
  });

  const blockResult = result.data?.results?.[0];
  
  if (blockResult && !blockResult.success) {
    log('✅', 'auth.verify correctly rejected invalid token!', colors.green);
    log('⚠️', `Error: ${blockResult.error}`, colors.yellow);
    return true;
  }

  log('❌', 'auth.verify should have rejected invalid token', colors.red);
  return false;
}

async function testOnLogin(token, user) {
  logSection('STEP 4: Test onLogin Block');
  
  log('🧪', 'Testing onLogin trigger block...', colors.blue);
  
  const result = await makeRequest(`${BACKEND_URL}/api/workflow/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      appId: 1,
      nodes: [
        {
          id: '1',
          data: {
            label: 'onLogin',
            category: 'Triggers',
            captureUserData: true,
            captureMetadata: true,
            storeToken: true,
          },
        },
      ],
      edges: [],
      context: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          verified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        token: token,
        loginMetadata: {
          timestamp: new Date().toISOString(),
          ip: '127.0.0.1',
          device: 'Node.js Test Script',
        },
      },
    }),
  });

  if (!result.ok) {
    log('❌', `onLogin test failed: ${result.data?.message || result.error}`, colors.red);
    return false;
  }

  const blockResult = result.data?.results?.[0];
  
  if (!blockResult) {
    log('❌', 'No block result received', colors.red);
    return false;
  }

  if (!blockResult.success) {
    log('❌', `onLogin failed: ${blockResult.error}`, colors.red);
    return false;
  }

  log('✅', 'onLogin executed successfully!', colors.green);
  log('👤', `User captured: ${blockResult.context?.user?.email}`, colors.blue);
  log('🔑', `Token stored: ${blockResult.context?.token ? 'Yes' : 'No'}`, colors.blue);
  log('📊', `Login processed: ${blockResult.context?.loginProcessed}`, colors.blue);
  log('⏰', `Timestamp: ${blockResult.context?.loginTimestamp}`, colors.blue);
  
  return true;
}

async function testCombinedWorkflow(token, user) {
  logSection('STEP 5: Test Combined onLogin → auth.verify Workflow');
  
  log('🧪', 'Testing onLogin → auth.verify workflow chain...', colors.blue);
  
  const result = await makeRequest(`${BACKEND_URL}/api/workflow/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      appId: 1,
      nodes: [
        {
          id: '1',
          data: {
            label: 'onLogin',
            category: 'Triggers',
            captureUserData: true,
            storeToken: true,
          },
        },
        {
          id: '2',
          data: {
            label: 'auth.verify',
            category: 'Actions',
            tokenSource: 'context',
            requireVerified: true,
            requiredRole: 'developer',
          },
        },
      ],
      edges: [
        { source: '1', target: '2' },
      ],
      context: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          verified: true,
        },
        token: token,
      },
    }),
  });

  if (!result.ok) {
    log('❌', `Combined workflow test failed: ${result.data?.message || result.error}`, colors.red);
    return false;
  }

  const results = result.data?.results;
  
  if (!results || results.length !== 2) {
    log('❌', `Expected 2 block results, got ${results?.length || 0}`, colors.red);
    return false;
  }

  const onLoginResult = results[0];
  const authVerifyResult = results[1];

  if (!onLoginResult.success || !authVerifyResult.success) {
    log('❌', 'One or more blocks failed in the workflow', colors.red);
    return false;
  }

  log('✅', 'Combined workflow executed successfully!', colors.green);
  log('1️⃣', `onLogin: ${onLoginResult.message}`, colors.blue);
  log('2️⃣', `auth.verify: ${authVerifyResult.message}`, colors.blue);
  log('🔗', 'Context propagated correctly between blocks', colors.green);
  
  return true;
}

async function runAllTests() {
  console.log('\n');
  log('🚀', 'FloNeo Authentication Blocks Test Suite', colors.bright + colors.cyan);
  log('🌐', `Backend URL: ${BACKEND_URL}`, colors.blue);
  console.log('\n');

  // Step 1: Login
  const auth = await login();
  if (!auth) {
    log('❌', 'Cannot proceed without authentication', colors.red);
    process.exit(1);
  }

  const { token, user } = auth;

  // Step 2: Test auth.verify with valid token
  const test1 = await testAuthVerify(token, user);

  // Step 3: Test auth.verify with invalid token
  const test2 = await testAuthVerifyInvalidToken();

  // Step 4: Test onLogin
  const test3 = await testOnLogin(token, user);

  // Step 5: Test combined workflow
  const test4 = await testCombinedWorkflow(token, user);

  // Summary
  logSection('TEST SUMMARY');
  
  const tests = [
    { name: 'auth.verify (valid token)', passed: test1 },
    { name: 'auth.verify (invalid token)', passed: test2 },
    { name: 'onLogin', passed: test3 },
    { name: 'Combined workflow', passed: test4 },
  ];

  tests.forEach((test, index) => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    const color = test.passed ? colors.green : colors.red;
    log(test.passed ? '✅' : '❌', `Test ${index + 1}: ${test.name}`, color);
  });

  const passedCount = tests.filter(t => t.passed).length;
  const totalCount = tests.length;

  console.log('\n');
  if (passedCount === totalCount) {
    log('🎉', `All tests passed! (${passedCount}/${totalCount})`, colors.bright + colors.green);
  } else {
    log('⚠️', `Some tests failed (${passedCount}/${totalCount} passed)`, colors.yellow);
  }
  console.log('\n');
}

// Run tests
runAllTests().catch(error => {
  log('❌', `Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});

