const cheerio = require('cheerio');

/**
 * Clean HTML to reduce token count
 * @param {string} html - Raw HTML string
 * @returns {string} - Cleaned HTML
 */
function cleanHtml(html) {
    const $ = cheerio.load(html);

    // Remove scripts, styles, SVGs, and excessive items
    $('script').remove();
    $('style').remove();
    $('svg').remove();
    $('link').remove();
    $('iframe').remove();
    $('noscript').remove();
    $('meta').remove();
    $('head').remove(); // Head usually contains no content schema

    // Remove comments
    $('*').contents().each(function () {
        if (this.type === 'comment') $(this).remove();
    });

    const keepAttrs = ['id', 'class', 'href', 'src', 'alt'];

    $('*').each(function () {
        const $this = $(this);
        const attrs = $this[0].attribs;
        if (attrs) {
            Object.keys(attrs).forEach(attr => {
                if (!keepAttrs.includes(attr)) {
                    $this.removeAttr(attr);
                }
            });
        }
    });

    return $.html();
}

module.exports = {
    cleanHtml
};

