const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const upload = require('../middleware/upload');
const { cleanHtml } = require('../utils/htmlCleaner');
const aiService = require('../services/aiService');
const dbService = require('../services/dbService');
const previewService = require('../services/previewService');
const config = require('../config/config');
const exportService = require('../services/exportService');

const router = express.Router();

// Upload and analyze HTML
router.post('/upload', upload.single('html'), async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('No HTML file uploaded');
            error.status = 400;
            throw error;
        }

        const htmlPath = req.file.path;
        const rawHtml = await fs.readFile(htmlPath, 'utf8');

        // Clean HTML to reduce token count
        const cleanedHtml = cleanHtml(rawHtml);

        // Analyze with Heuristic Service (Fast, No AI)
        // const schema = await aiService.analyzeHtml(cleanedHtml);
        const schema = await require('../services/heuristicService').analyzeHtml(cleanedHtml);

        // Generate database from schema
        // Use config paths
        const dbDir = config.paths.databases || 'databases';
        const dbPath = path.join(dbDir, req.file.filename.replace(/\.html?$/i, '.db'));

        const db = dbService.generateDbFromSchema(schema, dbPath);

        // Seed database with content from HTML
        dbService.seedData(db, schema, rawHtml);

        // Get database schema info
        const dbSchema = dbService.getDatabaseSchema(db);

        // Close database connection
        db.close();

        // Save schema for later use (optional, but good for reference)
        const schemaPath = path.join(config.paths.uploads, req.file.filename.replace(/\.html?$/i, '-schema.json'));
        await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2));

        res.json({
            success: true,
            message: 'HTML analyzed and database created successfully',
            schema: schema,
            database: dbSchema,
            fileId: req.file.filename.replace(/\.html?$/i, ''),
            dbPath: dbPath
        });

    } catch (error) {
        next(error);
    }
});



// Preview content
router.get('/preview/:fileId', async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const html = await previewService.generatePreview(fileId);
        res.send(html);
    } catch (err) {
        if (err.message.includes('Schema file not found')) {
            res.status(400).send(`
                <h1>Preview Unavailable</h1>
                <p>Missing Schema Mapping. Please re-analyze this file from the Dashboard.</p>
                <a href="/">Back to Dashboard</a>
            `);
        } else {
            next(err);
        }
    }
});

// Get database content
router.get('/database/:fileId', async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const dbDir = config.paths.databases || 'databases';
        const dbPath = path.join(dbDir, `${fileId}.db`);

        if (!fs.existsSync(dbPath)) {
            const error = new Error('Database not found');
            error.status = 404;
            throw error;
        }

        const Database = require('better-sqlite3');
        const db = new Database(dbPath);
        const schema = dbService.getDatabaseSchema(db);

        // Get data for all tables
        const data = {};
        for (const table of schema.tables) {
            const rows = db.prepare(`SELECT * FROM "${table.name}"`).all();
            data[table.name] = rows;
        }

        db.close();

        res.json({
            success: true,
            schema: schema,
            data: data
        });

    } catch (error) {
        next(error);
    }
});

// Update database content - Generic Endpoint
router.put('/database/:fileId/:table/:id', async (req, res, next) => {
    try {
        const { fileId, table, id } = req.params;
        const dbDir = config.paths.databases || 'databases';
        const dbPath = path.join(dbDir, `${fileId}.db`);

        if (!fs.existsSync(dbPath)) {
            const error = new Error('Database not found');
            error.status = 404;
            throw error;
        }

        const Database = require('better-sqlite3');
        const db = new Database(dbPath);

        // Security Validation
        const validTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
        if (!validTables.includes(table)) {
            db.close();
            const error = new Error(`Invalid table name: ${table}`);
            error.status = 400;
            throw error;
        }

        const validColumns = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
        const updateFields = Object.keys(req.body);

        // Filter only valid columns to be safe
        const safeFields = updateFields.filter(field => validColumns.includes(field));

        if (safeFields.length === 0) {
            db.close();
            return res.json({ success: true, message: "No valid fields to update" });
        }

        const setClause = safeFields.map(field => `"${field}" = ?`).join(', ');
        const values = [...safeFields.map(f => req.body[f]), id];

        try {
            const updateSQL = `UPDATE "${table}" SET ${setClause} WHERE id = ?`;
            const stmt = db.prepare(updateSQL);
            const result = stmt.run(...values);
            console.log(`UPDATE ${table} id=${id}: Changes ${result.changes}`);
            res.json({
                success: true,
                message: 'Record updated successfully',
                changes: result.changes
            });
        } catch (err) {
            throw new Error(`Update failed: ${err.message}`);
        } finally {
            db.close();
        }

    } catch (error) {
        next(error);
    }
});

// Add new record to database
router.post('/database/:fileId/:table', async (req, res, next) => {
    try {
        const { fileId, table } = req.params;
        const dbDir = config.paths.databases || 'databases';
        const dbPath = path.join(dbDir, `${fileId}.db`);

        if (!fs.existsSync(dbPath)) {
            const error = new Error('Database not found');
            error.status = 404;
            throw error;
        }

        const Database = require('better-sqlite3');
        const db = new Database(dbPath);

        // Security Validation
        const validTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
        if (!validTables.includes(table)) {
            db.close();
            const error = new Error(`Invalid table name: ${table}`);
            error.status = 400;
            throw error;
        }

        const validColumns = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
        const fields = Object.keys(req.body);

        const validFields = fields.filter(f => validColumns.includes(f));

        if (validFields.length === 0) {
            db.close();
            throw new Error("No valid columns provided");
        }

        const placeholders = validFields.map(() => '?').join(', ');
        const values = validFields.map(f => req.body[f]);
        const columnNames = validFields.map(f => `"${f}"`).join(', ');

        try {
            const insertSQL = `INSERT INTO "${table}" (${columnNames}) VALUES (${placeholders})`;
            const stmt = db.prepare(insertSQL);
            const result = stmt.run(...values);
            res.json({
                success: true,
                message: 'Record added successfully',
                id: result.lastInsertRowid
            });
        } catch (err) {
            throw new Error(`Insert failed: ${err.message}`);
        } finally {
            db.close();
        }

    } catch (error) {
        next(error);
    }
});

// Delete record from database
router.delete('/database/:fileId/:table/:id', async (req, res, next) => {
    try {
        const { fileId, table, id } = req.params;
        const dbDir = config.paths.databases || 'databases';
        const dbPath = path.join(dbDir, `${fileId}.db`);

        if (!fs.existsSync(dbPath)) {
            const error = new Error('Database not found');
            error.status = 404;
            throw error;
        }

        const Database = require('better-sqlite3');
        const db = new Database(dbPath);

        // Security Validation
        const validTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
        if (!validTables.includes(table)) {
            db.close();
            const error = new Error(`Invalid table name: ${table}`);
            error.status = 400;
            throw error;
        }

        try {
            const deleteSQL = `DELETE FROM "${table}" WHERE id = ?`;
            const stmt = db.prepare(deleteSQL);
            const result = stmt.run(id);
            res.json({
                success: true,
                message: 'Record deleted successfully',
                changes: result.changes
            });
        } catch (err) {
            throw new Error(`Delete failed: ${err.message}`);
        } finally {
            db.close();
        }

    } catch (error) {
        next(error);
    }
});

// -----------------------------------------
// DASHBOARD & BATCH PROCESSING ROUTES
// -----------------------------------------

// Bulk Upload (No Analysis yet)
router.post('/upload-folder', upload.array('files'), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new Error('No files uploaded');
        }
        res.json({ success: true, count: req.files.length, message: 'Files uploaded successfully' });
    } catch (error) {
        next(error);
    }
});

// Get Dashboard Status (Uploaded Files vs Ready DBs)
router.get('/files-status', async (req, res, next) => {
    try {
        const uploadDir = config.paths.uploads;
        const dbDir = config.paths.databases;

        fs.ensureDirSync(uploadDir);
        fs.ensureDirSync(dbDir);

        const allFiles = await fs.readdir(uploadDir);
        const htmlFiles = allFiles.filter(f =>
            f.match(/\.(html|htm)$/i) &&
            !f.startsWith('._') &&
            !['tslib.html', 'common.html', 'styles.html'].includes(f)
        );

        const databases = await fs.readdir(dbDir);

        const fileList = htmlFiles.map(file => {
            const dbName = file.replace(/\.html?$/i, '.db');
            const hasDb = databases.includes(dbName);
            return {
                name: file,
                dbId: file.replace(/\.html?$/i, ''),
                hasDb: hasDb
            };
        });

        res.json({ files: fileList });
    } catch (error) {
        next(error);
    }
});

// On-Demand Analysis (Single File)
router.post('/analyze-file', async (req, res, next) => {
    try {
        const { filename } = req.body;
        if (!filename) throw new Error('Filename required');


        const uploadDir = config.paths.uploads || 'uploads';
        let htmlPath = path.join(uploadDir, filename);

        // Recursive search if not found at root
        if (!fs.existsSync(htmlPath)) {
            const files = await fs.readdir(uploadDir, { recursive: true });
            // readdir recursive returns paths relative to uploadDir, e.g. "subdir\file.html"
            // We need to match the filename part
            const match = files.find(f => path.basename(f) === filename);
            if (match) {
                htmlPath = path.join(uploadDir, match);
            } else {
                throw new Error(`File not found: ${filename}`);
            }
        }

        const rawHtml = await fs.readFile(htmlPath, 'utf8');
        const cleanedHtml = cleanHtml(rawHtml);
        const schema = await require('../services/heuristicService').analyzeHtml(cleanedHtml);

        const dbDir = config.paths.databases || 'databases';
        const dbPath = path.join(dbDir, filename.replace(/\.html?$/i, '.db'));

        const db = dbService.generateDbFromSchema(schema, dbPath);
        dbService.seedData(db, schema, rawHtml);
        db.close();

        // Save schema backup
        const schemaPath = path.join(uploadDir, filename.replace(/\.html?$/i, '-schema.json'));
        await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2));

        res.json({ success: true });

    } catch (error) {
        console.error("❌ ANALYSIS API ERROR:", error);
        next(error);
    }
});

// Start Analysis for Single File (Forward to existing logic logic? No, duplicate logic for now to separate concerns)
// Keeping previous logic for reference but Dashboard uses APIs above.

// Delete uploaded file and associated database
router.delete('/file/:filename', async (req, res, next) => {
    try {
        const { filename } = req.params;
        const uploadDir = config.paths.uploads;
        const dbDir = config.paths.databases;

        const htmlPath = path.join(uploadDir, filename);
        const dbPath = path.join(dbDir, filename.replace(/\.html?$/i, '.db'));
        const schemaPath = path.join(uploadDir, filename.replace(/\.html?$/i, '-schema.json'));

        // Delete HTML
        if (fs.existsSync(htmlPath)) {
            await fs.unlink(htmlPath);
        }

        // Delete DB
        if (fs.existsSync(dbPath)) {
            await fs.unlink(dbPath);
        }

        // Delete Schema
        if (fs.existsSync(schemaPath)) {
            await fs.unlink(schemaPath);
        }

        res.json({ success: true, message: 'File and associated data deleted' });
    } catch (error) {
        next(error);
    }
});

// Export/Download Endpoint
router.get('/download/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fileId}-export.zip"`);
        await exportService.exportProject(fileId, res);
    } catch (err) {
        console.error('Export failed:', err);
        // If headers sent, we can't send json error
        if (!res.headersSent) {
            res.status(500).json({ error: 'Export failed: ' + err.message });
        }
    }
});

module.exports = router;
