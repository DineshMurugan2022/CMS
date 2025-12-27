try {
    console.log("Testing @adminjs/express...");
    const AdminJSExpress = require('@adminjs/express'); // Fails
    console.log("Success with default!");
} catch (e) {
    console.log("Default failed:", e.code);
    try {
        console.log("Testing @adminjs/express/lib...");
        const AdminJSExpress = require('@adminjs/express/lib');
        console.log("Success with /lib!");
    } catch (e2) {
        console.log("/lib failed:", e2.message);
    }
}
