import multer from "multer";

export function errorMiddleware (error, req, res, next) {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Max 50MB.' });
        }
    }
    console.error('Unhandled error: ', error);
    res.status(550).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
}