const Database = require('better-sqlite3');
const fs = require('fs-extra');
const cheerio = require('cheerio');
const path = require('path');
const config = require('../config/config');

/**
 * Create database from AI-generated schema
 * @param {Object} schema - AI-generated content schema
 * @param {string} dbPath - Path for the SQLite database file
 * @returns {Database} - SQLite database instance
 */
function generateDbFromSchema(schema, dbPath) {
    // Ensure directory exists
    fs.ensureDirSync(path.dirname(dbPath));

    const db = new Database(dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables for collections
    if (schema.schema.collections) {
        schema.schema.collections.forEach(collection => {
            const tableName = collection.name.replace(/[^a-zA-Z0-9_]/g, '_');
            const columns = [];

            // Add id and timestamps
            columns.push('id INTEGER PRIMARY KEY AUTOINCREMENT');
            columns.push('created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
            columns.push('updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');

            // Add fields based on schema, ignoring reserved names
            collection.fields.forEach(field => {
                const lowerName = field.name.toLowerCase();
                // Skip if the field is named 'id', 'created_at', or 'updated_at' as we add them manually
                if (lowerName === 'id' || lowerName === 'created_at' || lowerName === 'updated_at') {
                    return;
                }

                // Sanitize field name
                const safeFieldName = field.name.replace(/[^a-zA-Z0-9_]/g, '_');
                field.name = safeFieldName; // Update original field name for consistent use later

                let columnDef = `${safeFieldName} `;

                switch (field.type) {
                    case 'text':
                    case 'rich_text':
                    case 'image': // Store image URLs
                        columnDef += 'TEXT';
                        break;
                    case 'number':
                        columnDef += 'INTEGER';
                        break;
                    case 'boolean':
                        columnDef += 'BOOLEAN';
                        break;
                    case 'date':
                        columnDef += 'DATETIME';
                        break;
                    default:
                        columnDef += 'TEXT';
                }

                // Removed strict NOT NULL to prevent seeding failures with weak AI selectors
                // if (field.required) {
                //    columnDef += ' NOT NULL';
                // }

                columns.push(columnDef);
            });

            const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
            db.exec(createTableSQL);
            console.log(`✅ Created table: ${tableName}`);
        });
    }

    // Create tables for singletons
    if (schema.schema.singletons) {
        schema.schema.singletons.forEach(singleton => {
            const tableName = singleton.name.replace(/[^a-zA-Z0-9_]/g, '_');
            const columns = [];

            // Add id and timestamps (Singletons usually have ID=1)
            columns.push('id INTEGER PRIMARY KEY');
            columns.push('created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
            columns.push('updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');

            // Add fields based on schema, ignoring reserved names
            singleton.fields.forEach(field => {
                const lowerName = field.name.toLowerCase();
                if (lowerName === 'id' || lowerName === 'created_at' || lowerName === 'updated_at') {
                    return;
                }

                // Sanitize field name
                const safeFieldName = field.name.replace(/[^a-zA-Z0-9_]/g, '_');
                field.name = safeFieldName;

                let columnDef = `${safeFieldName} `;

                switch (field.type) {
                    case 'text':
                    case 'rich_text':
                    case 'image':
                        columnDef += 'TEXT';
                        break;
                    case 'number':
                        columnDef += 'INTEGER';
                        break;
                    case 'boolean':
                        columnDef += 'BOOLEAN';
                        break;
                    case 'date':
                        columnDef += 'DATETIME';
                        break;
                    default:
                        columnDef += 'TEXT';
                }

                // Removed strict NOT NULL to prevent seeding failures with weak AI selectors
                // if (field.required) {
                //     columnDef += ' NOT NULL';
                // }

                columns.push(columnDef);
            });

            const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
            db.exec(createTableSQL);
            console.log(`✅ Created singleton table: ${tableName}`);
        });
    }

    return db;
}

/**
 * Seed database with content from HTML
 * @param {Database} db - SQLite database instance
 * @param {Object} schema - AI-generated content schema
 * @param {string} html - Original HTML content
 */
function seedData(db, schema, html) {
    const $ = cheerio.load(html);

    // Seed collections
    if (schema.schema.collections) {
        schema.schema.collections.forEach(collection => {
            const tableName = collection.name.replace(/[^a-zA-Z0-9_]/g, '_');

            // Find all instances of this collection
            // Try specific selector first
            let collectionElements = [];

            if (collection.fields.length > 0) {
                const firstSelector = collection.fields[0].selector;
                collectionElements = $(firstSelector).map((i, elem) => {
                    // Heuristic: try to find the container card/item
                    return $(elem).closest('[class*="card"], [class*="item"], [class*="testimonial"], [class*="member"], [class*="post"]').get(0) || elem;
                }).get();

                if (collectionElements.length === 0) {
                    // Fallback
                    collectionElements = $(firstSelector).get();
                }
            }

            collectionElements.forEach((element, index) => {
                const $element = $(element);
                const rowData = {};

                collection.fields.forEach(field => {
                    // logic to find field within the element or by global index
                    const $fieldElement = $element.find(field.selector).length > 0
                        ? $element.find(field.selector).first()
                        : $(field.selector).eq(index);

                    switch (field.type) {
                        case 'text':
                            rowData[field.name] = $fieldElement.text().trim() || '';
                            break;
                        case 'rich_text':
                            rowData[field.name] = $fieldElement.html() || '';
                            break;
                        case 'image':
                            rowData[field.name] = $fieldElement.attr('src') || $fieldElement.attr('href') || '';
                            break;
                        case 'number':
                            const numText = $fieldElement.text().trim();
                            rowData[field.name] = numText ? parseInt(numText) || 0 : 0;
                            break;
                        case 'boolean':
                            const boolText = $fieldElement.text().trim().toLowerCase();
                            rowData[field.name] = boolText === 'true' || boolText === 'yes' || boolText === 'on' ? 1 : 0;
                            break;
                        case 'date':
                            const dateText = $fieldElement.text().trim();
                            rowData[field.name] = dateText || new Date().toISOString();
                            break;
                        default:
                            rowData[field.name] = $fieldElement.text().trim() || '';
                    }
                });

                // Insert into database
                const columns = Object.keys(rowData);
                if (columns.length > 0) {
                    const placeholders = columns.map(() => '?').join(', ');
                    const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

                    try {
                        const stmt = db.prepare(insertSQL);
                        stmt.run(...Object.values(rowData));
                        console.log(`🌱 Seeded ${tableName} row ${index + 1}`);
                    } catch (error) {
                        console.error(`❌ Error seeding ${tableName}:`, error.message);
                    }
                }
            });
        });
    }

    // Seed singletons
    if (schema.schema.singletons) {
        schema.schema.singletons.forEach(singleton => {
            const tableName = singleton.name.replace(/[^a-zA-Z0-9_]/g, '_');
            const rowData = {};

            singleton.fields.forEach(field => {
                const $fieldElement = $(field.selector).first();

                switch (field.type) {
                    case 'text':
                        rowData[field.name] = $fieldElement.text().trim() || '';
                        break;
                    case 'rich_text':
                        rowData[field.name] = $fieldElement.html() || '';
                        break;
                    case 'image':
                        rowData[field.name] = $fieldElement.attr('src') || $fieldElement.attr('href') || '';
                        break;
                    case 'number':
                        const numText = $fieldElement.text().trim();
                        rowData[field.name] = numText ? parseInt(numText) || 0 : 0;
                        break;
                    case 'boolean':
                        const boolText = $fieldElement.text().trim().toLowerCase();
                        rowData[field.name] = boolText === 'true' || boolText === 'yes' || boolText === 'on' ? 1 : 0;
                        break;
                    case 'date':
                        const dateText = $fieldElement.text().trim();
                        rowData[field.name] = dateText || new Date().toISOString();
                        break;
                    default:
                        rowData[field.name] = $fieldElement.text().trim() || '';
                }
            });

            // Insert singleton (only one row per singleton)
            const columns = Object.keys(rowData);
            if (columns.length > 0) {
                const placeholders = columns.map(() => '?').join(', ');
                const insertSQL = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

                try {
                    const stmt = db.prepare(insertSQL);
                    stmt.run(...Object.values(rowData));
                    console.log(`🌱 Seeded singleton: ${tableName}`);
                } catch (error) {
                    console.error(`❌ Error seeding singleton ${tableName}:`, error.message);
                }
            }
        });
    }
}

/**
 * Get database schema information
 * @param {Database} db - SQLite database instance
 * @returns {Object} - Database schema info
 */
function getDatabaseSchema(db) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const schema = { tables: [] };

    tables.forEach(table => {
        const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
        schema.tables.push({
            name: table.name,
            columns: columns.map(col => ({
                name: col.name,
                type: col.type,
                nullable: !col.notnull,
                default: col.dflt_value
            }))
        });
    });

    return schema;
}

module.exports = {
    generateDbFromSchema,
    seedData,
    getDatabaseSchema
};
