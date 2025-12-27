const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');

/**
 * Create database from AI-generated schema
 * @param {Object} schema - AI-generated content schema
 * @param {string} dbPath - Path for the SQLite database file
 * @returns {Database} - SQLite database instance
 */
function generateDbFromSchema(schema, dbPath) {
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables for collections
  if (schema.schema.collections) {
    schema.schema.collections.forEach(collection => {
      const tableName = collection.name;
      const columns = [];
      
      // Add id and timestamps
      columns.push('id INTEGER PRIMARY KEY AUTOINCREMENT');
      columns.push('created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      columns.push('updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      
      // Add fields based on schema
      collection.fields.forEach(field => {
        let columnDef = `${field.name} `;
        
        switch (field.type) {
          case 'text':
            columnDef += 'TEXT';
            break;
          case 'rich_text':
            columnDef += 'TEXT';
            break;
          case 'image':
            columnDef += 'TEXT'; // Store image URLs
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
        
        if (field.required) {
          columnDef += ' NOT NULL';
        }
        
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
      const tableName = singleton.name;
      const columns = [];
      
      // Add id and timestamps
      columns.push('id INTEGER PRIMARY KEY');
      columns.push('created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      columns.push('updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      
      // Add fields based on schema
      singleton.fields.forEach(field => {
        let columnDef = `${field.name} `;
        
        switch (field.type) {
          case 'text':
            columnDef += 'TEXT';
            break;
          case 'rich_text':
            columnDef += 'TEXT';
            break;
          case 'image':
            columnDef += 'TEXT'; // Store image URLs
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
        
        if (field.required) {
          columnDef += ' NOT NULL';
        }
        
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
      const tableName = collection.name;
      
      // Find all instances of this collection
      const collectionElements = $(collection.fields[0].selector).map((i, elem) => {
        return $(elem).closest('[class*="card"], [class*="item"], [class*="testimonial"], [class*="member"], [class*="post"]').get(0) || elem;
      }).get();
      
      if (collectionElements.length === 0) {
        // Fallback: try to find elements using a more generic approach
        const firstSelector = collection.fields[0].selector;
        collectionElements.push(...$(firstSelector).get());
      }
      
      collectionElements.forEach((element, index) => {
        const $element = $(element);
        const rowData = {};
        
        collection.fields.forEach(field => {
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
        const placeholders = columns.map(() => '?').join(', ');
        const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        
        try {
          const stmt = db.prepare(insertSQL);
          stmt.run(...Object.values(rowData));
          console.log(`🌱 Seeded ${tableName} row ${index + 1}`);
        } catch (error) {
          console.error(`❌ Error seeding ${tableName}:`, error.message);
        }
      });
    });
  }
  
  // Seed singletons
  if (schema.schema.singletons) {
    schema.schema.singletons.forEach(singleton => {
      const tableName = singleton.name;
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
      const placeholders = columns.map(() => '?').join(', ');
      const insertSQL = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
      
      try {
        const stmt = db.prepare(insertSQL);
        stmt.run(...Object.values(rowData));
        console.log(`🌱 Seeded singleton: ${tableName}`);
      } catch (error) {
        console.error(`❌ Error seeding singleton ${tableName}:`, error.message);
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
