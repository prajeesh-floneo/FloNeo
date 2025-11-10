#!/usr/bin/env node

const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJkZW1vQGV4YW1wbGUuY29tIiwicm9sZSI6ImRldmVsb3BlciIsImlhdCI6MTc2MTEzMjYwMCwiZXhwIjoxNzYxMTM2MjAwfQ.qv82oT2JXGCAOhemIoiG5ytACwunvLeTHrB9OgTPbJI';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/apps',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('🔍 Fetching Apps List...\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      
      if (jsonData.success && jsonData.data) {
        const apps = jsonData.data;
        console.log(`✅ Found ${apps.length} app(s):\n`);
        
        apps.forEach((app, idx) => {
          console.log(`${idx + 1}. App ID: ${app.id}`);
          console.log(`   Name: ${app.name}`);
          console.log(`   Owner ID: ${app.ownerId}`);
          console.log(`   Created: ${app.createdAt}`);
          console.log('');
        });
      } else {
        console.log('⚠️ No apps found');
        console.log('Response:', jsonData);
      }
    } catch (e) {
      console.log('Error:', e.message);
      console.log('Raw data:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.end();
