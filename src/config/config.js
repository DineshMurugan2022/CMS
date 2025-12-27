require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'ollama', // Default to 'ollama' string if not set, needed for SDK validation
    model: process.env.OPENAI_MODEL || 'llama3',
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  },
  session: {
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'admin',
  },
  paths: {
    uploads: 'uploads',
    databases: 'databases',
  }
};

// Basic validation
if (!config.openai.apiKey || config.openai.apiKey === 'your_openai_api_key_here') {
  console.warn('⚠️ WARNING: OPENAI_API_KEY is not set or is using the default placeholder.');
}

if (config.session.secret === 'default_insecure_secret') {
  console.warn('⚠️ WARNING: Using default insecure session secret. Set SESSION_SECRET in .env');
}

module.exports = config;
