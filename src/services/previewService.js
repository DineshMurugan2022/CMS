const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');
const Database = require('better-sqlite3');

async function generatePreview(fileId) {
    const uploadDir = config.paths.uploads || 'uploads';
    const dbDir = config.paths.databases || 'databases';

    const htmlPath = path.join(uploadDir, `${fileId}.html`);
    const schemaPath = path.join(uploadDir, `${fileId}-schema.json`);
    const dbPath = path.join(dbDir, `${fileId}.db`);

    if (!fs.existsSync(htmlPath)) throw new Error('HTML file not found');
    if (!fs.existsSync(schemaPath)) throw new Error('Schema file not found - Please Re-Analyze the file');
    if (!fs.existsSync(dbPath)) throw new Error('Database not found');

    const rawHtml = await fs.readFile(htmlPath, 'utf8');
    const schema = await fs.readJson(schemaPath);
    const db = new Database(dbPath);

    // Determine the base path for assets
    // If the file was uploaded as 'Project/index.html', we want base to be '/uploads/Project/'
    // We can infer this from the subdirectories in 'uploads' if we scan for it, 
    // OR we can just rely on the fact that we served /uploads static.
    // If the HTML has relative links "assets/style.css", and we are at URL /preview/fileId,
    // we need to set <base> to where the file actually lives.

    // IMPORTANT: Since we flattened single file uploads but kept structure for folders...
    // Let's assume fileId is consistent with the filename on disk.
    // If fileId is "index", and path is "uploads/index.html", base is "/uploads/"
    // If fileId is "Project_index", and path is "uploads/Project/index.html"... wait, our fileId logic strips paths?
    // In apiRoutes: fileId = req.file.filename (stripped extension).
    // Our new upload middleware preserves structure but filename is basename. 
    // Wait, multers destination changes but filename is basename.
    // So 'Project/index.html' -> destination 'uploads/Project', filename 'index.html'.
    // BUT we need to know the 'Project' part to find the file!

    // Issue: apiRoutes /analyze assumes file is at uploads/filename.
    // WE BROKE apiRoutes logic by changing upload structure without updating analyze logic.
    // We need to FIND the file first.

    // Quick Fix: Search for the file in uploads directory recursively?
    // Or just check if it exists at root, if not search subdirs.

    let actualHtmlPath = htmlPath;
    let baseUrl = '/uploads/';

    if (!fs.existsSync(htmlPath)) {
        // Search subdirectories
        // Search subdirectories using native recursive search (Node 20+)
        const files = await fs.readdir(uploadDir, { recursive: true });
        const match = files.find(f => path.basename(f) === `${fileId}.html`);
        if (match) {
            actualHtmlPath = path.join(uploadDir, match);
            // Construct Base URL: /uploads/subdir/
            const subDir = path.dirname(match);
            // Normalize path separators for URL
            const urlSubDir = subDir.split(path.sep).join('/');
            baseUrl = `/uploads/${urlSubDir}/`;

            // Update dbPath references if needed? No, DB is flat in databases/
        }
    }

    if (actualHtmlPath !== htmlPath) {
        // Read from found path
        rawHtml = await fs.readFile(actualHtmlPath, 'utf8');
    }

    const $ = cheerio.load(rawHtml);

    // FIX FOR FLAT UPLOADS: Check if assets (CSS/JS/Img) are missing in subdirs but present in root
    // We rewrite 'css/style.css' to 'style.css' if 'style.css' exists but 'css/style.css' does not.

    // 1. Link Tags (CSS)
    $('link[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('/')) {
            const requestedPath = path.join(uploadDir, href); // e.g. uploads/css/style.css
            const flatPath = path.join(uploadDir, path.basename(href)); // e.g. uploads/style.css

            if (!fs.existsSync(requestedPath) && fs.existsSync(flatPath)) {
                $(el).attr('href', path.basename(href));
            }
        }
    });

    // 2. Script Tags (JS)
    $('script[src]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('/')) {
            const requestedPath = path.join(uploadDir, src);
            const flatPath = path.join(uploadDir, path.basename(src));

            if (!fs.existsSync(requestedPath) && fs.existsSync(flatPath)) {
                $(el).attr('src', path.basename(src));
            }
        }
    });

    // 3. Images
    $('img[src]').each((i, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('/')) {
            // Keep relative paths as is, the <base> tag will handle them!
            // BUT, if we want to ensure they work even if base is slightly off, we could rewrite,
            // but relying on <base> is cleaner for relative links.
            // However, the previous logic was trying to "flatten" path if not found.
            // Let's keep the fallback logic but make it smarter.

            // Should we rewrite to absolute /uploads/...?
            // The <base> tag is /uploads/subdir/.
            // If src is "images/logo.png", browser requests /uploads/subdir/images/logo.png.
            // If file is explicitly at uploads/images/logo.png (flat), we need to fix it.

            const effectiveBase = baseUrl.startsWith('/') ? baseUrl.substring(1) : baseUrl; // Remove leading slash for local fs check
            // Actually, uploadDir is 'uploads'. baseUrl is '/uploads/subdir/'.
            // relative src "img.png" -> uploads/subdir/img.png

            // We only need to intervene if the default resolution FAILS.
            // But we can't easily know if it fails without checking FS.

            // Construct the theoretical path on disk
            // If baseUrl is /uploads/Project/, and src is "assets/icon.png"
            // Disk path should be: uploads/Project/assets/icon.png

            // Note: baseUrl includes /uploads/ prefix.
            // We need to map baseUrl back to disk path.
            const relativeDir = baseUrl.replace(/^\/uploads\//, '').replace(/\/$/, '');
            const expectedPath = path.join(uploadDir, relativeDir, src);

            if (!fs.existsSync(expectedPath)) {
                // Try to find it elsewhere?
                // Fallback: Check if it exists at root of uploads/src
                const rootPath = path.join(uploadDir, src);
                if (fs.existsSync(rootPath)) {
                    // Rewrite to absolute path ignoring base
                    $(el).attr('src', `/uploads/${src}`);
                } else {
                    // Fallback: Check if basename exists anywhere in uploadDir?
                    // Too expensive? Maybe just check root.
                    const baseName = path.basename(src);
                    const flatPath = path.join(uploadDir, baseName);
                    if (fs.existsSync(flatPath)) {
                        $(el).attr('src', `/uploads/${baseName}`);
                    }
                }
            }
        }
    });

    // Inject Base Tag to point to /uploads/ root
    if ($('head').length > 0) {
        $('head').prepend(`<base href="/uploads/">`);
    } else {
        $('html').prepend(`<head><base href="/uploads/"></head>`);
    }

    // 1. Inject Singletons
    if (schema.schema.singletons) {
        schema.schema.singletons.forEach(singleton => {
            console.log(`Processing singleton: ${singleton.name}`);
            const tableName = singleton.name.replace(/[^a-zA-Z0-9_]/g, '_');
            const row = db.prepare(`SELECT * FROM "${tableName}" LIMIT 1`).get();
            if (!row) {
                console.log(`No data found for singleton ${tableName}`);
                return;
            }

            singleton.fields.forEach(field => {
                const value = row[field.name];
                if (value === undefined || value === null) return;

                const $el = $(field.selector).first();
                if ($el.length === 0) {
                    console.log(`Selector not found for ${singleton.name}.${field.name}: ${field.selector}`);
                    return;
                }

                console.log(`Injecting ${singleton.name}.${field.name} = ${value}`);
                updateElement($, $el, field, value, uploadDir);
            });
        });
    }

    // 2. Inject Collections
    if (schema.schema.collections) {
        schema.schema.collections.forEach(collection => {
            console.log(`Processing collection: ${collection.name}`);
            const tableName = collection.name.replace(/[^a-zA-Z0-9_]/g, '_');
            const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
            if (rows.length === 0) {
                console.log(`No rows for collection ${tableName}`);
                return;
            }

            if (collection.fields.length > 0) {
                const firstSelector = collection.fields[0].selector;
                const $firstMatch = $(firstSelector).first();

                if ($firstMatch.length === 0) {
                    console.log(`First match not found for collection ${collection.name} selector ${firstSelector}`);
                    return;
                }

                // Heuristic: specific to common layouts (cards, list items)
                let $templateItem = $firstMatch.closest('[class*="card"], [class*="item"], [class*="col"], [class*="testimonial"], [class*="member"], [class*="post"], li');

                if ($templateItem.length === 0) {
                    // Fallback: Use the element itself as the item if no container found (matches seedData logic)
                    $templateItem = $firstMatch;
                    console.log(`Using fallback template item for ${collection.name}`);
                } else {
                    console.log(`Found container template for ${collection.name}: ${$templateItem.get(0).tagName}`);
                }

                if ($templateItem.length > 0) {
                    const $container = $templateItem.parent();
                    const $template = $templateItem.clone();

                    // console.log(`Emptying container for ${collection.name}`);
                    $container.empty();

                    rows.forEach((row, idx) => {
                        const $newItem = $template.clone();

                        collection.fields.forEach(field => {
                            const value = row[field.name];
                            // Try relative search first
                            let $target = $newItem.find(field.selector);

                            if ($target.length === 0) {
                                // Try finding by relative selector manually (if schema selector was "parent child")
                                // If selector is ".card h3" and we are in ".card", look for "h3"
                                const parts = field.selector.split(' ');
                                const lastPart = parts[parts.length - 1];
                                $target = $newItem.find(lastPart);
                            }

                            // If still not found, and we are using fallback template (element itself), AND this field MATCHES the selector
                            if ($target.length === 0 && $newItem.is(field.selector)) {
                                $target = $newItem;
                            }

                            if ($target.length > 0) {
                                // console.log(`Injecting col ${idx} ${field.name}`);
                                updateElement($, $target.first(), field, value, uploadDir);
                            } else {
                                // console.log(`Field target not found in item: ${field.selector}`);
                            }
                        });

                        $container.append($newItem);
                    });
                }
            }
        });
    }

    db.close();
    return $.html();
}

function updateElement($, $el, field, value, uploadDir) {
    if (field.type === 'image') {
        // Resolve path logic
        let finalPath = value;
        if (value && !value.startsWith('http') && !value.startsWith('//') && !value.startsWith('/')) {
            const requestedPath = path.join(uploadDir, value);
            const flatPath = path.join(uploadDir, path.basename(value));

            if (!fs.existsSync(requestedPath) && fs.existsSync(flatPath)) {
                finalPath = path.basename(value);
            }
        }
        $el.attr('src', finalPath);
    } else if (field.type === 'rich_text') {
        $el.html(value);
    } else {
        $el.text(value);
    }
}

module.exports = { generatePreview };
