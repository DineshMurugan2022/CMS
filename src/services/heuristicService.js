const cheerio = require('cheerio');

/**
 * Heuristic Analysis - Instantly extract schema without AI
 * Speed: ~10ms vs 10s+ for AI
 */
function analyzeHtml(html) {
    const $ = cheerio.load(html);
    const schema = {
        collections: [],
        singletons: []
    };

    // 1. Identify Collections (Repeated Elements)
    // We look for parent containers that have multiple identical children
    const candidates = new Map();

    $('*').each((i, elem) => {
        if (elem.type !== 'tag') return;
        const $elem = $(elem);
        const children = $elem.children();

        if (children.length > 1) {
            // Group children by "signature" (tag + classes)
            const groups = {};

            children.each((j, child) => {
                const $child = $(child);
                // Skip script/style/etc
                if (['script', 'style', 'link', 'meta'].includes(child.name)) return;

                // Signature: div.class1.class2
                const classes = ($child.attr('class') || '').split(/\s+/).sort().join('.');
                const signature = `${child.name}${classes ? '.' + classes : ''}`;

                if (!groups[signature]) groups[signature] = [];
                groups[signature].push($child);
            });

            // If any group has more than 1 item, it's a potential collection
            Object.entries(groups).forEach(([sig, items]) => {
                if (items.length > 1) {
                    // Check complexity: Does it have content? (Text or Images)
                    const firstItem = items[0];
                    const hasImage = firstItem.find('img').length > 0;
                    const hasText = firstItem.text().trim().length > 0;

                    if (hasImage || hasText) {
                        // Generate Collection Name
                        let name = 'collection_' + candidates.size;
                        // Try to derive name from class
                        const classes = (firstItem.attr('class') || '').split(/\s+/);
                        const relevantClass = classes.find(c => !c.match(/col-|row|grid|flex/));
                        if (relevantClass) name = relevantClass + '_list';

                        // SANITIZE NAME: Replace hyphens/special chars with underscores
                        name = name.replace(/[^a-zA-Z0-9_]/g, '_');

                        // Extract Fields from the first item
                        const fields = extractFields($, firstItem, name);

                        if (fields.length > 0) {
                            schema.collections.push({
                                name: name,
                                fields: fields
                            });
                            candidates.set(sig, true);
                        }
                    }
                }
            });
        }
    });

    // 2. Identify Singletons (Unique Sections)
    // Headers, Footers, and Sections with IDs
    const singletonSelector = 'header, footer, section[id], div[id*="hero"], div[id*="about"]';

    $(singletonSelector).each((i, elem) => {
        const $elem = $(elem);
        // Ensure this element isn't inside a collection we already found
        // (Simplified check)

        // Name
        let name = $elem.attr('id') || elem.name;
        if (name === 'section') name = 'section_' + i;

        // SANITIZE NAME
        name = name.replace(/[^a-zA-Z0-9_]/g, '_');

        if (candidates.has(name)) return; // Avoid dupe names

        const fields = extractFields($, $elem, name);
        if (fields.length > 0) {
            schema.singletons.push({
                name: name,
                fields: fields
            });
        }
    });

    return Promise.resolve({ schema });
}

function extractFields($, $container, prefix) {
    const fields = [];
    const usedNames = new Set();

    // Helper to add field
    const addField = (name, type, selector) => {
        let finalName = name;

        // Sanitize field name
        finalName = finalName.replace(/[^a-zA-Z0-9_]/g, '_');

        let counter = 1;
        while (usedNames.has(finalName)) {
            finalName = `${name}_${counter++}`; // Use original base name for suffixing
            // Re-sanitize if needed (though suffix is safe)
            finalName = finalName.replace(/[^a-zA-Z0-9_]/g, '_');
        }
        usedNames.add(finalName);
        fields.push({ name: finalName, type, selector, required: false });
    };

    // 1. Images
    $container.find('img').each((i, img) => {
        if (i > 3) return; // Limit to 3 images per section to avoid noise
        const selector = getUniqueSelector($, $(img), $container);
        addField('image', 'image', selector);
    });

    // 2. Headings
    $container.find('h1, h2, h3, h4, h5, h6').each((i, h) => {
        const selector = getUniqueSelector($, $(h), $container);
        addField('title', 'text', selector);
    });

    // 3. Paragraphs (Rich Text)
    $container.find('p').each((i, p) => {
        if (i > 3) return;
        const text = $(p).text().trim();
        if (text.length > 10) {
            const selector = getUniqueSelector($, $(p), $container);
            addField('description', 'rich_text', selector);
        }
    });

    // 4. Links/Buttons
    $container.find('a.btn, button').each((i, btn) => {
        const selector = getUniqueSelector($, $(btn), $container);
        addField('cta_text', 'text', selector);
    });

    return fields;
}

function getUniqueSelector($, $el, $context) {
    // Generate a selector relative to the container for singletons?
    // Or global? 
    // The current architecture uses GLOBAL selectors for SeedData (finding matches)
    // But for Collections, it needs to be generic to the item class.

    // Heuristic: If it has a class, use it. Else use tag.
    const tag = $el[0].name;
    const classes = ($el.attr('class') || '').split(/\s+/).filter(c => c && !c.match(/active|show|animate/));

    if (classes.length > 0) {
        return `${tag}.${classes[0]}`;
    }
    return tag;
}

module.exports = { analyzeHtml };
