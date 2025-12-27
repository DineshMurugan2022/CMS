const FormData = require('form-data');
const fs = require('fs');
const http = require('http');

const form = new FormData();
form.append('html', fs.createReadStream('test-sample.html'));

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/upload',
  method: 'POST',
  headers: form.getHeaders()
});

form.pipe(req);

req.on('response', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const result = JSON.parse(data);
      console.log('\n✅ Success! Database created.');
      console.log('Database Schema:', JSON.stringify(result.database, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => console.error('Request error:', e.message));

req.end();
