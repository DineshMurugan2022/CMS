# AutoCMS - HTML to Headless CMS Converter

Transform any HTML file into a fully functional Headless CMS with AI-powered content extraction and automatic admin panel generation.

## 🚀 Features

- **AI-Powered Analysis**: Uses OpenAI GPT-4 to intelligently analyze HTML structure
- **Automatic Schema Generation**: Identifies collections (repeating elements) and singletons (unique sections)
- **Content Type Detection**: Automatically categorizes content as text, images, rich text, numbers, etc.
- **Dynamic Admin Panel**: Generates admin interfaces based on extracted schema
- **File Upload Support**: Drag & drop or browse to upload HTML files

## 📋 Phase A: Complete ✅

### What's Working:
- ✅ Express server setup with file upload capabilities
- ✅ HTML cleaning and preprocessing
- ✅ AI-powered content schema extraction
- ✅ Beautiful web interface for file uploads
- ✅ JSON schema generation with collections and singletons

### Tech Stack:
- **Backend**: Node.js + Express
- **File Upload**: Multer
- **HTML Parsing**: Cheerio.js
- **AI Engine**: OpenAI GPT-4
- **Frontend**: Vanilla HTML/CSS/JS

## 🛠️ Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   # Edit .env file with your OpenAI API key
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Access Application**:
   - Main App: http://localhost:3000
   - Upload API: POST /api/upload

## 📊 Schema Output Format

The AI generates structured JSON schemas like:

```json
{
  "schema": {
    "collections": [
      {
        "name": "testimonials",
        "fields": [
          {
            "name": "customer_name",
            "type": "text",
            "selector": ".testimonial-name",
            "required": true
          },
          {
            "name": "testimonial_text",
            "type": "rich_text",
            "selector": ".testimonial-content",
            "required": true
          }
        ]
      }
    ],
    "singletons": [
      {
        "name": "hero_section",
        "fields": [
          {
            "name": "headline",
            "type": "text",
            "selector": ".hero h1",
            "required": true
          }
        ]
      }
    ]
  }
}
```

## 🎯 Next Steps (Phase B & C)

- **Phase B**: Dynamic database generation with SQLite
- **Phase C**: AdminJS integration for automatic admin panel creation

## 🧪 Test the System

1. Start the server
2. Open http://localhost:3000
3. Upload any HTML file
4. View the generated schema
5. Ready for Phase B implementation!
