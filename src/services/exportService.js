const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');
const Database = require('better-sqlite3');
const archiver = require('archiver');
const { generatePreview } = require('./previewService'); // Reuse preview logic?
// Actually generatePreview returns HTML string. We can use that.

async function exportProject(fileId, res) {
    const uploadDir = config.paths.uploads || 'uploads';
    const dbDir = config.paths.databases || 'databases';
    const dbPath = path.join(dbDir, `${fileId}.db`);

    if (!fs.existsSync(dbPath)) throw new Error('Database not found');

    // 1. Generate the final HTML with data baked in
    // We reuse preview logic but we might need to adjust asset paths if we want them relative
    // Current preview logic:
    // - Tries to keep relative paths
    // - Or rewrites to /uploads/ if not found
    // - Injects <base href="/uploads/">

    // For EXPORT, we want standard relative paths, NO <base> tag pointing to server, 
    // and we want to include all assets in the zip.

    // Let's implement a custom bake function that is similar to preview but cleaner for export
    const htmlWithData = await bakeHtml(fileId, uploadDir, dbPath);

    // 2. Setup Zip Stream
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', function (err) {
        throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // 3. Add the Baked HTML as index.html (or original name)
    // We assume fileId matches the main HTML name loosely? 
    // Actually fileId is the basename without extension. Use .html
    archive.append(htmlWithData, { name: `${fileId}.html` });

    // 4. Add Assets
    // We need to add all OTHER files from the upload folder.
    // Check if uploaded as a folder or flat
    // If flat in uploads/, we should only zip relevant assets?
    // Hard to know which files belong to this project if uploads/ is a dump.
    // BUT we used the 'Smart Fallback' logic.
    // Best effort: parse the HTML and find local assets, add them to zip.

    // Or, if we see subdirectories in uploads/, maybe we can just zip them?
    // Let's use the asset discovery from the HTML to be precise.

    const $ = cheerio.load(htmlWithData);
    const assets = new Set();

    $('link[href], script[src], img[src]').each((i, el) => {
        const src = $(el).attr('href') || $(el).attr('src');
        if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
            // It's a local asset
            // Normalize path
            const cleanSrc = src.split('?')[0].split('#')[0];
            assets.add(cleanSrc);
        }
    });

    // Add found assets to zip
    for (const assetPath of assets) {
        // Resolve assetPath against uploadDir
        // 1. Try exact path (if uploadDir/assetPath exists)
        let localPath = path.join(uploadDir, assetPath);

        if (!fs.existsSync(localPath)) {
            // 2. Try flat path (uploadDir/basename)
            const flatPath = path.join(uploadDir, path.basename(assetPath));
            if (fs.existsSync(flatPath)) {
                localPath = flatPath;
            } else {
                continue; // Skip missing files
            }
        }

        archive.file(localPath, { name: assetPath });
    }

    await archive.finalize();
}

async function bakeHtml(fileId, uploadDir, dbPath) {
    // Similar to generatePreview but without server-specific rewrites
    // We just want to inject content.

    // Find HTML file
    let htmlPath = path.join(uploadDir, `${fileId}.html`);
    if (!fs.existsSync(htmlPath)) {
        const files = await fs.readdir(uploadDir, { recursive: true });
        const match = files.find(f => path.basename(f) === `${fileId}.html`);
        if (match) htmlPath = path.join(uploadDir, match);
        else throw new Error('HTML file not found');
    }

    const rawHtml = await fs.readFile(htmlPath, 'utf8');
    const $ = cheerio.load(rawHtml);
    const db = new Database(dbPath);
    const schemaPath = path.join(uploadDir, `${fileId}-schema.json`);
    const schema = await fs.readJson(schemaPath);

    // Inject Singletons
    if (schema.schema.singletons) {
        schema.schema.singletons.forEach(singleton => {
            const tableName = singleton.name.replace(/[^a-zA-Z0-9_]/g, '_');
            const row = db.prepare(`SELECT * FROM "${tableName}" LIMIT 1`).get();
            if (!row) return;

            singleton.fields.forEach(field => {
                const value = row[field.name];
                if (value === undefined || value === null) return;
                const $el = $(field.selector).first();
                if ($el.length === 0) return;
                if (field.type === 'rich_text') $el.html(value);
                else if (field.type === 'image') $el.attr('src', value);
                else $el.text(value);
            });
        });
    }

    // Inject Collections (Simplified for export - just use what's in DB)
    if (schema.schema.collections) {
        schema.schema.collections.forEach(collection => {
            const tableName = collection.name.replace(/[^a-zA-Z0-9_]/g, '_');
            const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
            if (rows.length === 0) return;

            const firstSelector = collection.fields[0].selector;
            const $firstMatch = $(firstSelector).first();
            let $templateItem = $firstMatch.closest('[class*="card"], [class*="item"], [class*="col"], [class*="testimonial"], [class*="member"], [class*="post"], li');

            if ($templateItem.length === 0) $templateItem = $firstMatch;

            if ($templateItem.length > 0) {
                const $container = $templateItem.parent();
                const $template = $templateItem.clone();
                $container.empty();

                rows.forEach(row => {
                    const $newItem = $template.clone();
                    collection.fields.forEach(field => {
                        const value = row[field.name];
                        let $target = $newItem.find(field.selector);
                        if ($target.length === 0) {
                            const parts = field.selector.split(' ');
                            $target = $newItem.find(parts[parts.length - 1]);
                        }
                        if ($target.length > 0) {
                            if (field.type === 'rich_text') $target.html(value);
                            else if (field.type === 'image') $target.attr('src', value);
                            else $target.text(value);
                        }
                    });
                    $container.append($newItem);
                });
            }
        });
    }

    db.close();
    return $.html();
}

module.exports = { exportProject };
