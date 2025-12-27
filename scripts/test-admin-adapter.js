const knex = require('knex');

(async () => {
    try {
        console.log("Starting Adapter Test...");
        const adminJsModule = await import('adminjs');
        const AdminJS = adminJsModule.default || adminJsModule;

        const adminJsSqlModule = await import('@adminjs/sql');
        const AdminJSSQL = adminJsSqlModule;

        console.log("Registering Adapter...");
        // Log what we are registering
        console.log("Resource Type:", typeof AdminJSSQL.Resource);
        console.log("Database Type:", typeof AdminJSSQL.Database);

        AdminJS.registerAdapter({
            Resource: AdminJSSQL.Resource,
            Database: AdminJSSQL.Database,
        });

        // Setup Knex
        const db = knex({
            client: 'better-sqlite3',
            connection: {
                filename: ':memory:'
            },
            useNullAsDefault: true
        });

        // Create table first
        await db.schema.createTable('test_table', (table) => {
            table.increments('id');
            table.string('name');
        });

        // Debug isAdapterFor
        const dummyResource = { client: db, dialect: 'sqlite', table: 'test_table' };
        try {
            console.log("isAdapterFor result:", AdminJSSQL.Database.isAdapterFor(dummyResource));
        } catch (e) { console.log("isAdapterFor threw:", e); }

        // Try manual instantiation
        console.log("Attempting manual Resource instantiation...");
        const manualResource = new AdminJSSQL.Resource({
            client: db,
            table: 'test_table'
        });

        console.log("Creating AdminJS instance with manual resource...");
        // When passing a Resource instance, we pass it directly in the array?
        // Or in the object structure?
        // Usually AdminJS expects { resource: classOrInstance, options: ... }

        const admin = new AdminJS({
            resources: [{
                resource: manualResource,
                options: {}
            }]
        });

        console.log("✅ AdminJS initialized successfully!");

    } catch (e) {
        console.error("❌ Initialization Failed:");
        console.error(e.message);
        if (e.message.includes('no adapters')) {
            console.log("Reproduced the error!");
        }
    }
})();
