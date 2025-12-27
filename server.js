const app = require('./src/app');
const config = require('./src/config/config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 AutoCMS Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload endpoint: POST /api/upload`);
  console.log(`🤖 AI Engine: ${config.openai.model}`);
  console.log(`🔒 Admin Auth: ${config.admin.email} (configured in .env)`);
});
