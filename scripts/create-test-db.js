const { generateDbFromSchema, seedData, getDatabaseSchema } = require('./database');
const fs = require('fs');
const path = require('path');

// Create a test database using the same schema from Phase B
const mockSchema = {
  schema: {
    collections: [
      {
        name: "testimonials",
        fields: [
          {
            name: "customer_name",
            type: "text",
            selector: ".testimonial .name",
            required: true
          },
          {
            name: "testimonial_text",
            type: "rich_text",
            selector: ".testimonial .content",
            required: true
          }
        ]
      },
      {
        name: "team_members",
        fields: [
          {
            name: "member_name",
            type: "text",
            selector: ".team-member .member-name",
            required: true
          },
          {
            name: "role",
            type: "text",
            selector: ".team-member .role",
            required: false
          },
          {
            name: "image_url",
            type: "image",
            selector: ".team-member img",
            required: false
          }
        ]
      }
    ],
    singletons: [
      {
        name: "hero_section",
        fields: [
          {
            name: "headline",
            type: "text",
            selector: ".hero h1",
            required: true
          },
          {
            name: "subheadline",
            type: "text",
            selector: ".hero p",
            required: false
          }
        ]
      }
    ]
  }
};

async function createTestDatabase() {
  try {
    console.log('🧪 Creating test database for Phase C testing\n');
    
    // Read test HTML
    const html = fs.readFileSync('test-sample.html', 'utf8');
    
    // Create databases directory
    if (!fs.existsSync('databases')) {
      fs.mkdirSync('databases', { recursive: true });
    }
    
    // Generate database
    const dbPath = path.join('databases', 'test-cms-phase-c.db');
    const db = generateDbFromSchema(mockSchema, dbPath);
    
    // Seed data
    seedData(db, mockSchema, html);
    
    // Get database schema
    const dbSchema = getDatabaseSchema(db);
    
    // Show seeded data
    console.log('📊 Database Schema:');
    dbSchema.tables.forEach(table => {
      if (!table.name.startsWith('sqlite_')) {
        const rows = db.prepare(`SELECT * FROM ${table.name}`).all();
        console.log(`\n📋 Table: ${table.name} (${rows.length} rows)`);
        rows.forEach((row, i) => {
          console.log(`  Row ${i + 1}:`, JSON.stringify(row, null, 4));
        });
      }
    });
    
    db.close();
    console.log('\n✅ Test database created successfully!');
    console.log('📁 Database location:', dbPath);
    console.log('🔗 Admin panel will be available at: http://localhost:3000/admin/test-cms-phase-c');
    console.log('🔐 Login credentials: admin@autocms.com / admin');
    
  } catch (error) {
    console.error('❌ Error creating test database:', error.message);
  }
}

createTestDatabase();
