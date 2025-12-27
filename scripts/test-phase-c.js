const http = require('http');

// Simple test to verify server is running
function testServerConnection() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(options, (res) => {
    console.log('✅ Server is running!');
    console.log(`📡 Status: ${res.statusCode}`);
    console.log('🌐 Server is ready for testing');
    
    // Test admin panel creation
    testAdminPanel();
  });

  req.on('error', (err) => {
    console.log('❌ Server is not running');
    console.log('🔄 Please start server with: npm run dev');
    console.log('Error:', err.message);
  });

  req.on('timeout', () => {
    console.log('❌ Server connection timeout');
    req.destroy();
  });

  req.end();
}

// Test admin panel creation
function testAdminPanel() {
  console.log('\n🧪 Testing admin panel creation...');
  
  const postData = JSON.stringify({});
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/test-cms-phase-c',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('✅ Admin panel creation test:');
        console.log(`   Status: ${res.statusCode}`);
        if (result.success) {
          console.log(`   Admin URL: ${result.adminUrl}`);
          console.log(`   Login URL: ${result.loginUrl}`);
          console.log('🎉 Phase C is working! Admin panel is ready.');
          console.log('🔐 Login credentials: admin@autocms.com / admin');
          console.log('🌐 Visit the admin panel in your browser!');
        } else {
          console.log('❌ Admin panel creation failed:', result.error);
        }
      } catch (e) {
        console.log('❌ Invalid JSON response:', data);
      }
    });
  });

  req.on('error', (err) => {
    console.log('❌ Admin panel test failed:', err.message);
  });

  req.on('timeout', () => {
    console.log('❌ Admin panel test timeout');
    req.destroy();
  });

  req.write(postData);
  req.end();
}

console.log('🔍 Testing AutoCMS Phase C...\n');
testServerConnection();
