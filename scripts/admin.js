const AdminJS = require('adminjs');
const AdminJSExpress = require('@adminjs/express');
const AdminJSSQL = require('@adminjs/sql');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');

// Register AdminJS SQL adapter
AdminJS.registerAdapter({
  Resource: AdminJSSQL.Resource,
  Database: AdminJSSQL.Database,
});

/**
 * Create AdminJS instance for a specific database
 * @param {string} dbPath - Path to SQLite database
 * @param {string} fileId - File identifier for routing
 * @returns {Object} - AdminJS instance and router
 */
function createAdminPanel(dbPath, fileId) {
  try {
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database not found');
    }

    const db = new Database(dbPath);
    
    // Get database schema
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    
    const resources = [];
    
    tables.forEach(table => {
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
      
      // Configure resource for each table
      const resource = {
        resource: {
          client: db,
          dialect: 'sqlite',
          table: table.name,
        },
        options: {
          id: table.name,
          navigation: {
            name: 'Content',
            icon: 'Content',
          },
          listProperties: columns
            .filter(col => col.name !== 'id' && !col.name.endsWith('_at'))
            .map(col => col.name),
          showProperties: columns.map(col => col.name),
          editProperties: columns
            .filter(col => col.name !== 'id' && !col.name.endsWith('_at'))
            .map(col => col.name),
          filterProperties: columns
            .filter(col => col.type === 'TEXT' || col.type === 'INTEGER')
            .map(col => col.name),
          properties: columns.reduce((acc, col) => {
            acc[col.name] = {
              type: col.type === 'INTEGER' ? 'number' : 'string',
              isVisible: col.name !== 'id',
              isRequired: !col.nullable,
              isEditable: col.name !== 'id' && !col.name.endsWith('_at'),
            };
            
            // Handle special field types based on column names
            if (col.name.includes('image') || col.name.includes('url') || col.name.includes('src')) {
              acc[col.name].type = 'string';
              acc[col.name].components = {
                edit: 'adminjs/src/input-type/string',
                list: 'adminjs/src/input-type/string',
                show: 'adminjs/src/input-type/string',
              };
            }
            
            if (col.name.includes('text') && col.name.includes('rich')) {
              acc[col.name].type = 'textarea';
            }
            
            if (col.name.includes('date') || col.name.includes('time')) {
              acc[col.name].type = 'datetime';
            }
            
            if (col.name.includes('boolean') || col.type === 'BOOLEAN') {
              acc[col.name].type = 'boolean';
            }
            
            return acc;
          }, {}),
        },
      };
      
      resources.push(resource);
    });

    // Create AdminJS instance
    const admin = new AdminJS({
      resources: resources,
      rootPath: `/admin/${fileId}`,
      branding: {
        companyName: 'AutoCMS',
        logo: '',
        favicon: '',
        softwareBrothers: false,
      },
      locale: {
        language: 'en',
        availableLanguages: ['en'],
        translations: {
          labels: {
            navigation: 'Content Management',
          },
        },
      },
    });

    // Configure authentication (simple for demo)
    const authenticate = async (email, password) => {
      // Simple authentication - in production, use proper auth
      if (email === 'admin@autocms.com' && password === 'admin') {
        return { email, role: 'admin' };
      }
      return null;
    };

    // Create router
    const router = AdminJSExpress.buildAuthenticatedRouter(admin, {
      authenticate,
      cookieName: 'adminjs',
      cookiePassword: 'sessionsecret',
    }, null, {
      resave: false,
      saveUninitialized: true,
      secret: 'sessionsecret',
    });

    db.close();
    
    return { admin, router };
    
  } catch (error) {
    console.error('Error creating admin panel:', error);
    throw error;
  }
}

/**
 * Get all available databases
 * @returns {Array} - List of database files
 */
function getAvailableDatabases() {
  const databasesDir = 'databases';
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
  createAdminPanel,
  getAvailableDatabases,
};
