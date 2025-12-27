const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config/config');

// Dynamic Import Wrappers
let AdminJS, AdminJSExpress;
let AdminJSSQLResource, AdminJSSQLProperty; // We need classes, not just the module
let knex;
let initialized = false;
let initializationPromise = null;

async function initAdminJS() {
    if (initialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            // Import ESM modules
            const adminJsModule = await import('adminjs');
            AdminJS = adminJsModule.default || adminJsModule;

            const adminJsExpressModule = await import('@adminjs/express');
            AdminJSExpress = adminJsExpressModule.default || adminJsExpressModule;

            const adminJsSqlModule = await import('@adminjs/sql');
            AdminJSSQLResource = adminJsSqlModule.Resource;
            AdminJSSQLProperty = adminJsSqlModule.Property;

            // Import Knex (CJS)
            knex = require('knex');

            // We do NOT register Adapter because we are manually creating resources
            // AdminJS.registerAdapter(...) 

            console.log("✅ AdminJS dependencies loaded (Manual Adapter Mode)");
            initialized = true;
        } catch (err) {
            console.error("❌ Failed to initialize AdminJS dependencies:", err);
            throw err;
        }
    })();

    return initializationPromise;
}

// CACHE IMPLEMENTATION
const adminInstances = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function cleanupAdminInstances() {
    const now = Date.now();
    for (const [fileId, instance] of adminInstances.entries()) {
        if (now - instance.lastAccessed > CACHE_TTL) {
            console.log(`🧹 Cleaning up expired admin panel for: ${fileId}`);
            if (instance.knexClient) {
                instance.knexClient.destroy();
            }
            adminInstances.delete(fileId);
        }
    }
}

setInterval(cleanupAdminInstances, 15 * 60 * 1000);

/**
 * Map SQLite type to AdminJS type
 */
function mapType(sqliteType) {
    const type = sqliteType.toUpperCase();
    if (type.includes('INT')) return 'number';
    if (type.includes('CHAR') || type.includes('TEXT')) return 'string'; // We'll refine rich text later via options
    if (type.includes('BOOL')) return 'boolean';
    if (type.includes('DATE') || type.includes('TIME')) return 'datetime';
    return 'string';
}

/**
 * Get or create AdminJS instance for a specific database
 */
async function getAdminPanel(dbPath, fileId) {
    await initAdminJS();

    if (adminInstances.has(fileId)) {
        const instance = adminInstances.get(fileId);
        instance.lastAccessed = Date.now();
        return { admin: instance.admin, router: instance.router };
    }

    try {
        const absoluteDbPath = path.resolve(dbPath);
        console.log(`🔍 Checking database at: ${absoluteDbPath} (Input: ${dbPath})`);

        if (!fs.existsSync(dbPath)) {
            console.error(`❌ Database file not found at: ${absoluteDbPath}`);
            throw new Error('Database not found');
        }

        // 1. Inspect Schema using better-sqlite3 (Sync, fast)
        const db = new Database(dbPath);
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

        // 2. Setup Knex for AdminJS interaction
        const knexClient = knex({
            client: 'better-sqlite3',
            connection: { filename: dbPath },
            useNullAsDefault: true
        });

        // 3. Build Manual Resources
        const resources = tables.map(table => {
            const tableName = table.name;
            const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();

            const properties = columns.map(col => {
                const type = mapType(col.type);
                return new AdminJSSQLProperty({
                    name: col.name,
                    type: type,
                    position: col.cid,
                    isId: col.pk > 0,
                    isNullable: !col.notnull,
                    isEditable: col.pk === 0 // ID usually not editable
                });
            });

            const idProperty = properties.find(p => p.isId()) || properties[0];

            const resourceInstance = new AdminJSSQLResource({
                tableName: tableName,
                knex: knexClient,
                properties: properties,
                idProperty: idProperty,
                database: 'sqlite',
                dialect: 'postgresql', // HACK: @adminjs/sql checks this for ILIKE vs LIKE. PG mostly safe fallback for Knex.
                // schemaName: 'public' // Not needed for sqlite
            });

            // Apply property overrides (Rich Text, etc)
            // AdminJS Resource Options are passed separately to constructor? 
            // No, passed to AdminJS constructor.

            // We need to define Options for this resource.
            const resourceOptions = {
                id: tableName,
                navigation: { name: 'Content', icon: 'Content' },
                properties: {}
            };

            columns.forEach(col => {
                // Heuristic for types
                if (col.name.includes('rich_text') || (col.type === 'TEXT' && col.name.includes('content'))) {
                    resourceOptions.properties[col.name] = { type: 'textarea' }; // rich_text often needs custom component, textarea is safe fallback
                }
                if (col.name.includes('image')) {
                    // resourceOptions.properties[col.name] = { type: 'string' }; // default
                }
            });

            return {
                resource: resourceInstance,
                options: resourceOptions
            };
        });

        db.close();

        // 4. Initialize AdminJS
        const admin = new AdminJS({
            resources: resources,
            rootPath: `/admin/${fileId}`,
            loginPath: `/admin/${fileId}/login`,
            logoutPath: `/admin/${fileId}/logout`,
            branding: {
                companyName: 'AutoCMS',
                softwareBrothers: false,
            }
        });

        // Config Auth
        const authenticate = async (email, password) => {
            if (email === config.admin.email && password === config.admin.password) {
                return { email, role: 'admin' };
            }
            return null;
        };

        const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
            authenticate,
            cookieName: 'adminjs',
            cookiePassword: config.session.secret,
            loginPath: `/admin/${fileId}/login`,
            logoutPath: `/admin/${fileId}/logout`,
        }, null, {
            resave: false,
            saveUninitialized: true,
            secret: config.session.secret,
        });

        adminInstances.set(fileId, {
            admin,
            router,
            lastAccessed: Date.now(),
            knexClient
        });

        return { admin, router };

    } catch (error) {
        console.error('Error creating admin panel:', error);
        throw error;
    }
}

function getAvailableDatabases() {
    const databasesDir = config.paths.databases;
    if (!fs.existsSync(databasesDir)) {
        return [];
    }
    return fs.readdirSync(databasesDir)
        .filter(file => file.endsWith('.db'))
        .map(file => ({
            filename: file,
            fileId: file.replace('.db', ''),
            path: path.join(databasesDir, file),
            createdAt: fs.statSync(path.join(databasesDir, file)).birthtime,
        }));
}

module.exports = {
    getAdminPanel,
    getAvailableDatabases
};
