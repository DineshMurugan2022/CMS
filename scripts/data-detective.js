const cheerio = require('cheerio');
const fs = require('fs');

/**
 * Data Detective - Analyzes HTML to find Collections and Singletons
 * @param {string} html - HTML content to analyze
 * @returns {Object} - Analysis results with CSS selectors
 */
function analyzeHtmlAsDetective(html) {
  const $ = cheerio.load(html);
  const analysis = {
    collections: [],
    singletons: [],
    metadata: {
      totalElements: $('*').length,
      uniqueClasses: new Set(),
      uniqueIds: new Set(),
      repeatedPatterns: {}
    }
  };

  // Collect all classes and IDs
  $('*').each(function() {
    const classes = $(this).attr('class');
    const id = $(this).attr('id');
    
    if (classes) {
      classes.split(' ').forEach(cls => {
        if (cls.trim()) analysis.metadata.uniqueClasses.add(cls.trim());
      });
    }
    
    if (id) {
      analysis.metadata.uniqueIds.add(id);
    }
  });

  // Convert Sets to Arrays
  analysis.metadata.uniqueClasses = Array.from(analysis.metadata.uniqueClasses);
  analysis.metadata.uniqueIds = Array.from(analysis.metadata.uniqueIds);

  // Find repeating patterns (potential collections)
  const classCounts = {};
  analysis.metadata.uniqueClasses.forEach(className => {
    const count = $(`.${className}`).length;
    if (count > 1) {
      classCounts[className] = count;
    }
  });

  // Sort by frequency
  const sortedClasses = Object.entries(classCounts)
    .sort(([,a], [,b]) => b - a)
    .filter(([,count]) => count >= 2); // At least 2 instances

  // Analyze repeating patterns as collections
  sortedClasses.forEach(([className, count]) => {
    const elements = $(`.${className}`);
    const firstElement = elements.first();
    
    // Get all child elements with their tags and classes
    const childStructure = [];
    firstElement.children().each(function() {
      const tag = this.tagName.toLowerCase();
      const classes = $(this).attr('class') || '';
      const id = $(this).attr('id') || '';
      childStructure.push({
        tag,
        classes: classes.split(' ').filter(c => c.trim()),
        id,
        selector: id ? `#${id}` : `${tag}.${classes.split(' ').join('.')}`.replace(/\.$/, tag)
      });
    });

    // Extract text content patterns
    const textContents = [];
    elements.each(function() {
      const text = $(this).text().trim();
      if (text) textContents.push(text);
    });

    analysis.collections.push({
      name: className.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      className: className,
      count: count,
      selector: `.${className}`,
      childStructure: childStructure,
      textSamples: textContents.slice(0, 3), // Show first 3 samples
      fields: childStructure.map(child => ({
        name: child.id || child.classes[0] || child.tag,
        selector: child.selector,
        type: detectFieldType(child, $),
        sampleContent: $(child.selector).first().text().trim() || $(child.selector).first().attr('src') || ''
      }))
    });
  });

  // Find unique content areas (singletons)
  const potentialSingletons = [
    'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
    '.hero', '.banner', '.about', '.intro', '.welcome', '.headline',
    '#header', '#footer', '#hero', '#main', '#content'
  ];

  potentialSingletons.forEach(selector => {
    const elements = $(selector);
    if (elements.length === 1) {
      const element = elements.first();
      const text = element.text().trim();
      
      if (text.length > 10) { // Only include if there's meaningful content
        const childStructure = [];
        element.children().each(function() {
          const tag = this.tagName.toLowerCase();
          const classes = $(this).attr('class') || '';
          const id = $(this).attr('id') || '';
          childStructure.push({
            tag,
            classes: classes.split(' ').filter(c => c.trim()),
            id,
            selector: id ? `#${id}` : `${tag}.${classes.split(' ').join('.')}`.replace(/\.$/, tag)
          });
        });

        analysis.singletons.push({
          name: selector.replace(/[.#]/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          selector: selector,
          textLength: text.length,
          childStructure: childStructure,
          fields: childStructure.map(child => ({
            name: child.id || child.classes[0] || child.tag,
            selector: child.selector,
            type: detectFieldType(child, $),
            sampleContent: $(child.selector).first().text().trim() || $(child.selector).first().attr('src') || ''
          }))
        });
      }
    }
  });

  // Add common semantic elements as singletons
  const semanticElements = ['h1', 'h2', 'title'];
  semanticElements.forEach(tag => {
    const elements = $(tag);
    if (elements.length === 1) {
      const element = elements.first();
      const text = element.text().trim();
      
      analysis.singletons.push({
        name: tag.toUpperCase(),
        selector: tag,
        textLength: text.length,
        fields: [{
          name: tag + '_content',
          selector: tag,
          type: 'text',
          sampleContent: text
        }]
      });
    }
  });

  return analysis;
}

/**
 * Detect field type based on element properties
 * @param {Object} element - Element info
 * @param {Object} $ - Cheerio instance
 * @returns {string} - Field type
 */
function detectFieldType(element, $) {
  const el = $(element.selector);
  
  // Check for images
  if (element.tag === 'img' || el.attr('src')) {
    return 'image';
  }
  
  // Check for links
  if (element.tag === 'a' || el.attr('href')) {
    return 'url';
  }
  
  // Check for headings
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(element.tag)) {
    return 'heading';
  }
  
  // Check for paragraphs or text-heavy elements
  const text = el.text().trim();
  if (text.length > 100) {
    return 'rich_text';
  }
  
  // Check for numbers
  if (/^\d+$/.test(text)) {
    return 'number';
  }
  
  // Default to text
  return 'text';
}

// Test with the sample HTML
const html = fs.readFileSync('test-sample.html', 'utf8');
const analysis = analyzeHtmlAsDetective(html);

console.log('🔍 Data Detective HTML Analysis\n');
console.log('📊 Metadata:');
console.log(`- Total Elements: ${analysis.metadata.totalElements}`);
console.log(`- Unique Classes: ${analysis.metadata.uniqueClasses.length}`);
console.log(`- Unique IDs: ${analysis.metadata.uniqueIds.length}`);
console.log(`- Repeating Patterns Found: ${analysis.collections.length}`);

console.log('\n🔄 COLLECTIONS (Repeating Elements):');
analysis.collections.forEach((collection, i) => {
  console.log(`\n${i + 1}. ${collection.name}`);
  console.log(`   Class: .${collection.className}`);
  console.log(`   Count: ${collection.count} instances`);
  console.log(`   Selector: ${collection.selector}`);
  console.log(`   Fields: ${collection.fields.length} found`);
  collection.fields.forEach(field => {
    console.log(`     - ${field.name} (${field.type}): ${field.selector}`);
    if (field.sampleContent) {
      console.log(`       Sample: "${field.sampleContent.substring(0, 50)}${field.sampleContent.length > 50 ? '...' : ''}"`);
    }
  });
});

console.log('\n🎯 SINGLETONS (Unique Content Areas):');
analysis.singletons.forEach((singleton, i) => {
  console.log(`\n${i + 1}. ${singleton.name}`);
  console.log(`   Selector: ${singleton.selector}`);
  console.log(`   Text Length: ${singleton.textLength} chars`);
  console.log(`   Fields: ${singleton.fields.length} found`);
  singleton.fields.forEach(field => {
    console.log(`     - ${field.name} (${field.type}): ${field.selector}`);
    if (field.sampleContent) {
      console.log(`       Sample: "${field.sampleContent.substring(0, 50)}${field.sampleContent.length > 50 ? '...' : ''}"`);
    }
  });
});

// Export for use in other modules
module.exports = { analyzeHtmlAsDetective, detectFieldType };
