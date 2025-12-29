const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');
const apiRoutes = require('./routes/apiRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public/browser'));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // Serve uploaded assets

// Ignore favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// API Routes
app.use('/api', apiRoutes);

// Smart Asset Fallback: If asset not found, try to find it in uploads root (for flat uploads)
app.use((req, res, next) => {
    // Only try to recover asset requests (files with extensions)
    if (!path.extname(req.path)) return next();

    const filename = path.basename(req.path);
    const flatPath = path.join(process.cwd(), 'uploads', filename);

    if (fs.existsSync(flatPath)) {
        return res.sendFile(flatPath);
    }
    next();
});

// Serve Angular SPA for all non-API routes
app.use((req, res, next) => {
    // Check if it's an API call or static asset that wasn't found
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(__dirname, '../public/browser/index.html'));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
