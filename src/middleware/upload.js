const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config/config');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = config.paths.uploads || 'uploads';

        // Handle folder structure if present in originalname (which we set from webkitRelativePath)
        // file.originalname might be "MySite/assets/css/style.css"
        const fullPath = file.originalname;
        const subDir = path.dirname(fullPath);

        // If subDir is just '.' it means no folder structure
        if (subDir === '.') {
            // Optimization for root uploads
            cb(null, uploadDir);
        } else {
            const targetDir = path.join(uploadDir, subDir);
            fs.ensureDir(targetDir)
                .then(() => cb(null, targetDir))
                .catch(err => cb(err));
        }
    },
    filename: (req, file, cb) => {
        // Just use the basename, since we handled the directory above
        cb(null, path.basename(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // Increased limit for assets
    fileFilter: (req, file, cb) => {
        // Allow common web assets
        if (file.mimetype.match(/(html|css|javascript|json|image|font|video|audio)/) ||
            file.originalname.match(/\.(html|htm|css|js|jsx|ts|tsx|json|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|mp4|webm)$/i)) {
            cb(null, true);
        } else {
            console.warn(`Skipped unsupported file: ${file.originalname}`);
            cb(null, false);
        }
    }
});

module.exports = upload;
