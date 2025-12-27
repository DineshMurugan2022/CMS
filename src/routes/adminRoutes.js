const express = require('express');
const path = require('path');
const adminService = require('../services/adminService');
const config = require('../config/config');

const router = express.Router();

// Create/Get Admin Panel
// NOTE: AdminJS handles the routing dynamically. 
// We likely need to mount the AdminJS router exactly at the path it expects.
// The original code had:
// app.use('/admin/:fileId', (req, res, next) => { ... })

// And a creation endpoint:
// app.post('/api/admin/:fileId', ... )

// We will replicate the creation endpoint first.

router.post('/:fileId', async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const dbDir = config.paths.databases || 'databases';
        const dbPath = path.join(dbDir, `${fileId}.db`);

        // This effectively "warms up" the cache and checks existence
        await adminService.getAdminPanel(dbPath, fileId);

        res.json({
            success: true,
            message: 'Admin panel ready',
            adminUrl: `/admin/${fileId}`,
            loginUrl: `/admin/${fileId}/login`
        });

    } catch (error) {
        next(error);
    }
});

// Middleware to handle dynamic admin routes
// This function will be exported and used in app.js as:
// app.use('/admin/:fileId', adminRouterMiddleware)
const adminRouterMiddleware = async (req, res, next) => {
    const { fileId } = req.params;
    const dbDir = config.paths.databases || 'databases';

    // Ignore reserved words to prevent routing errors
    if (['login', 'logout', '_next', 'assets'].includes(fileId)) {
        return next();
    }

    const dbPath = path.join(dbDir, `${fileId}.db`);

    try {
        const { router } = await adminService.getAdminPanel(dbPath, fileId);
        return router(req, res, next);
    } catch (error) {
        // If we can't load the admin panel, calling next(error) might break AdminJS flow
        // or loop. If it's 404, we return it.
        // But since this is a middleware mounted at /admin/:fileId,
        // if we fail, we should probably output a 404 or error page.
        if (error.message === 'Database not found') {
            return res.status(404).send('Admin Panel Not Found: Database does not exist.');
        }
        console.error('Admin middleware error:', error);
        next(error);
    }
};

module.exports = {
    router, // Standard API routes like creation
    adminRouterMiddleware // The dynamic middleware
};
