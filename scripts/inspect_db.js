const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbDir = path.join(__dirname, '../databases');

if (!fs.existsSync(dbDir)) {
    console.log('No databases directory found.');
    process.exit(0);
}

const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.db'));
if (files.length === 0) {
    console.log('No database files found.');
    process.exit(0);
}

console.log(`Found ${files.length} databases.`);

files.forEach(file => {
    console.log(`\n📄 Checking ${file}...`);
    try {
        const db = new Database(path.join(dbDir, file));
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

        if (tables.length === 0) {
            console.log('   ❌ Empty (No tables)');
        } else {
            tables.forEach(t => {
                const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get().c;
                console.log(`   ✅ Table '${t.name}': ${count} rows`);
            });
        }
        db.close();
    } catch (e) {
        console.log(`   ⚠️ Error reading: ${e.message}`);
    }
});
