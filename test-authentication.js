#!/usr/bin/env node

/**
 * Authentication Testing Script for Floneo Application
 * Tests all authentication scenarios and error handling
 */

const https = require('https');
const http = require('http');

// Test configuration
const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:5000';

// Test credentials
const VALID_CREDENTIALS = {
  email: 'demo@example.com',
  password: 'Demo123!@#'
};

const INVALID_CREDENTIALS = {
  email: 'test@invalid.com',
  password: 'wrongpassword'
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

// Test functions
async function testBackendHealth() {
  console.log('\n🔍 Testing Backend Health...');
  try {
    const response = await makeRequest(`${BACKEND_URL}/health`);
    if (response.status === 200) {
      console.log('✅ Backend is healthy');
      return true;
    } else {
      console.log(`❌ Backend health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Backend is not accessible: ${error.message}`);
    return false;
  }
}

async function testFrontendHealth() {
  console.log('\n🔍 Testing Frontend Health...');
  try {
    const response = await makeRequest(FRONTEND_URL);
    if (response.status === 200) {
      console.log('✅ Frontend is accessible');
      return true;
    } else {
      console.log(`❌ Frontend health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Frontend is not accessible: ${error.message}`);
    return false;
  }
}

async function testValidLogin() {
  console.log('\n🔍 Testing Valid Login...');
  try {
    const response = await makeRequest(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      body: VALID_CREDENTIALS
    });

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Data:`, response.data);

    if (response.status === 200 && response.data.success) {
      console.log('✅ Valid login successful');
      console.log(`✅ Access token received: ${response.data.data?.accessToken ? 'YES' : 'NO'}`);
      return response.data.data?.accessToken;
    } else {
      console.log(`❌ Valid login failed: ${response.data.message || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Login request failed: ${error.message}`);
    return null;
  }
}

async function testInvalidLogin() {
  console.log('\n🔍 Testing Invalid Login...');
  try {
    const response = await makeRequest(`${FRONTEND_URL}/api/auth/login`, {
      method: 'POST',
      body: INVALID_CREDENTIALS
    });

    console.log(`Response Status: ${response.status}`);
    console.log(`Response Data:`, response.data);

    if (response.status === 401 && !response.data.success) {
      console.log('✅ Invalid login properly rejected');
      console.log(`✅ Error message: ${response.data.message}`);
      return true;
    } else {
      console.log(`❌ Invalid login should have been rejected`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Invalid login test failed: ${error.message}`);
    return false;
  }
}

async function testProtectedEndpoint(token) {
  console.log('\n🔍 Testing Protected Endpoint Access...');
  try {
    const response = await makeRequest(`${FRONTEND_URL}/api/apps`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Response Status: ${response.status}`);

    if (response.status === 200) {
      console.log('✅ Protected endpoint accessible with valid token');
      return true;
    } else {
      console.log(`❌ Protected endpoint access failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Protected endpoint test failed: ${error.message}`);
    return false;
  }
}

async function testExpiredToken() {
  console.log('\n🔍 Testing Expired Token Handling...');
  try {
    // Use an obviously expired token
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImRldmVsb3BlciIsImV4cCI6MTYwMDAwMDAwMH0.invalid';
    
    const response = await makeRequest(`${FRONTEND_URL}/api/apps`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${expiredToken}`
      }
    });

    console.log(`Response Status: ${response.status}`);

    if (response.status === 401) {
      console.log('✅ Expired token properly rejected');
      return true;
    } else {
      console.log(`❌ Expired token should have been rejected`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Expired token test failed: ${error.message}`);
    return false;
  }
}

async function testNoToken() {
  console.log('\n🔍 Testing No Token Access...');
  try {
    const response = await makeRequest(`${FRONTEND_URL}/api/apps`, {
      method: 'GET'
    });

    console.log(`Response Status: ${response.status}`);

    if (response.status === 401) {
      console.log('✅ No token access properly rejected');
      return true;
    } else {
      console.log(`❌ No token access should have been rejected`);
      return false;
    }
  } catch (error) {
    console.log(`❌ No token test failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 FLONEO AUTHENTICATION TESTING SUITE');
  console.log('=====================================');

  const results = {
    backendHealth: false,
    frontendHealth: false,
    validLogin: false,
    invalidLogin: false,
    protectedEndpoint: false,
    expiredToken: false,
    noToken: false
  };

  // Test backend health
  results.backendHealth = await testBackendHealth();
  if (!results.backendHealth) {
    console.log('\n❌ Backend is not accessible. Please check Docker containers.');
    return results;
  }

  // Test frontend health
  results.frontendHealth = await testFrontendHealth();
  if (!results.frontendHealth) {
    console.log('\n❌ Frontend is not accessible. Please check Docker containers.');
    return results;
  }

  // Test authentication flows
  const token = await testValidLogin();
  results.validLogin = !!token;

  results.invalidLogin = await testInvalidLogin();

  if (token) {
    results.protectedEndpoint = await testProtectedEndpoint(token);
  }

  results.expiredToken = await testExpiredToken();
  results.noToken = await testNoToken();

  // Print summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=======================');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${test}`);
  });

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Authentication system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the issues above.');
  }

  return results;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
