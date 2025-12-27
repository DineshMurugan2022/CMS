const AdminJS = require('adminjs');

(async () => {
    try {
        console.log("Importing @adminjs/sql...");
        const adminJsSqlModule = await import('@adminjs/sql');

        console.log("Keys in module:", Object.keys(adminJsSqlModule));
        console.log("adminJsSqlModule.default:", adminJsSqlModule.default);
        console.log("adminJsSqlModule.Resource:", adminJsSqlModule.Resource);
        console.log("adminJsSqlModule.Database:", adminJsSqlModule.Database);

        if (adminJsSqlModule.Adapter) {
            console.log("Found Adapter export!");
        }

        // Check if I can access via default if it's a CJS interop thing
        if (adminJsSqlModule.default) {
            console.log("Keys in default:", Object.keys(adminJsSqlModule.default));
        }

    } catch (e) {
        console.error(e);
    }
})();
