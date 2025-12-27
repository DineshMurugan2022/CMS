const OpenAI = require('openai');
const config = require('../config/config');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseUrl,
});

/**
 * Mock response for testing when API is unavailable
 */
function getMockSchema() {
  return {
    schema: {
      collections: [
        {
          name: "mock_testimonials",
          fields: [
            { name: "author", type: "text", selector: ".author", required: true },
            { name: "content", type: "rich_text", selector: ".content", required: true },
            { name: "rating", type: "number", selector: ".stars", required: false }
          ]
        },
        {
          name: "mock_features",
          fields: [
            { name: "title", type: "text", selector: "h3", required: true },
            { name: "description", type: "text", selector: "p", required: true }
          ]
        }
      ],
      singletons: [
        {
          name: "mock_hero_section",
          fields: [
            { name: "headline", type: "text", selector: "h1", required: true },
            { name: "subheadline", type: "text", selector: ".subtitle", required: false },
            { name: "cta_text", type: "text", selector: ".btn", required: false }
          ]
        }
      ]
    }
  };
}

/**
 * Analyze HTML and extract content schema using AI
 * @param {string} html - Cleaned HTML string
 * @returns {Promise<Object>} - Content schema JSON
 */

async function analyzeHtml(html) {
  // Check for Mock Mode
  if (process.env.USE_MOCK_AI === 'true') {
    console.log('⚠️ using Mock AI Mode');
    return getMockSchema();
  }

  if (!config.openai.apiKey || config.openai.apiKey.includes('your_openai_api_key')) {
    throw new Error('OpenAI API Key is not configured.');
  }

  const systemPrompt = `You are an expert CMS architect. Analyze this HTML and extract a COMPREHENSIVE content schema.
  
  RULES:
  1. Identify ALL text content, headings, images, and links as fields.
  2. "collections" = Repeating items (cards, list items, testimonials).
  3. "singletons" = Unique sections (header, hero, about, features, footer).
  4. Use "selector" to find the element. Be specific (e.g., ".hero h1", "#about p").
  
  Return ONLY valid JSON in this exact format:
  {
    "schema": {
      "collections": [
        {
          "name": "collection_name",
          "fields": [
            { "name": "title", "type": "text", "selector": ".card h3", "required": false },
            { "name": "image", "type": "image", "selector": "img", "required": false }
          ]
        }
      ],
      "singletons": [
        {
          "name": "section_name",
          "fields": [
            { "name": "heading", "type": "text", "selector": "h1", "required": false },
            { "name": "description", "type": "rich_text", "selector": "div.content", "required": false }
          ]
        }
      ]
    }
  }
  IMPORTANT: Output ONLY the raw JSON string. NO markdown, NO text. Capture as much content as possible.`;

  let currentPrompt = html;
  let retryCount = 0;
  const MAX_RETRIES = 2;

  while (retryCount <= MAX_RETRIES) {
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: currentPrompt }
      ];

      // On retries, add context about previous failure
      if (retryCount > 0) {
        messages.unshift({
          role: "system",
          content: "You previously generated invalid JSON. Please fix syntax errors like missing commas or quotes."
        });
      }

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: messages,
        temperature: 0.1,
        max_tokens: 2000, // Reduced from 4000 to save memory
      });

      const result = response.choices[0].message.content;

      // 1. Extract JSON block
      const firstBrace = result.indexOf('{');
      const lastBrace = result.lastIndexOf('}');

      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No JSON found');
      }

      let jsonString = result.substring(firstBrace, lastBrace + 1);

      // 2. Simple cleanup (fix trailing commas)
      jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

      return JSON.parse(jsonString);

    } catch (error) {
      console.error(`AI Attempt ${retryCount + 1} failed:`, error.message);

      // Check for memory/Ollama specific errors
      if (error.message.includes('allocate CPU buffer') || error.message.includes('exit status 2')) {
        console.error("CRITICAL: Ollama out of memory.");
        throw new Error('Local AI ran out of memory. Please close other apps or use a smaller HTML file.');
      }

      if (retryCount === MAX_RETRIES) {
        throw new Error('Failed to analyze HTML after retries: ' + error.message);
      }

      // Prepare prompt for retry
      currentPrompt = `The previous JSON had a syntax error: ${error.message}. Please fix it and return valid JSON for:\n\n` + html.substring(0, 1000) + '...';
      retryCount++;
    }
  }
}

module.exports = {
  analyzeHtml
};
