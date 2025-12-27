const http = require('http');

function checkServer() {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
        });
        res.on('end', () => {
            console.log('No more data in response.');
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.end();
}

// Check Databases endpoint as well
function checkDatabases() {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/databases',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log(`DB STATUS: ${res.statusCode}`);
        res.on('data', (chunk) => {
            console.log(`DB BODY: ${chunk}`);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.end();
}

setTimeout(checkServer, 1000);
setTimeout(checkDatabases, 1500);
