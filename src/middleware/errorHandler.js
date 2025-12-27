function errorHandler(err, req, res, next) {
    console.error('❌ Error:', err);

    // Default error status
    const status = err.status || 500;

    res.status(status).json({
        success: false,
        error: err.message || 'Internal Server Error',
        // Only show stack in development
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

module.exports = errorHandler;
