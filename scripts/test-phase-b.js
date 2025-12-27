const fs = require('fs');
const path = require('path');

// Since we can't easily test the upload endpoint, let's test the core functionality directly
const { generateDbFromSchema, seedData, getDatabaseSchema } = require('./database');

// Mock schema (what the AI would generate)
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

async function testPhaseB() {
  try {
    console.log('🧪 Testing Phase B: Database Generation & Seeding\n');
    
    // Read test HTML
    const html = fs.readFileSync('test-sample.html', 'utf8');
    console.log('✅ Test HTML loaded');
    
    // Generate database
    const dbPath = 'test-cms.db';
    const db = generateDbFromSchema(mockSchema, dbPath);
    console.log('✅ Database schema generated');
    
    // Seed data
    seedData(db, mockSchema, html);
    console.log('✅ Database seeded with HTML content');
    
    // Get database schema
    const dbSchema = getDatabaseSchema(db);
    console.log('\n📊 Generated Database Schema:');
    console.log(JSON.stringify(dbSchema, null, 2));
    
    // Show seeded data
    console.log('\n🌱 Seeded Data:');
    dbSchema.tables.forEach(table => {
      const rows = db.prepare(`SELECT * FROM ${table.name}`).all();
      console.log(`\n📋 Table: ${table.name}`);
      console.log(JSON.stringify(rows, null, 2));
    });
    
    // Close database
    db.close();
    console.log('\n✅ Phase B test completed successfully!');
    
    // Cleanup
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🧹 Test database cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPhaseB();
