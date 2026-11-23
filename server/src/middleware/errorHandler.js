export function errorHandler(err, req, res, next) {
  console.error('[SecureVault Error]', err);

  // Handle CORS validation failures
  if (err.message && err.message.startsWith('CORS policy:')) {
    return res.status(403).json({
      error: err.message,
      code: 'CORS_FORBIDDEN'
    });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File size exceeds maximum allowed upload limit (100MB).',
        code: 'FILE_TOO_LARGE'
      });
    }
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
      code: 'UPLOAD_ERROR'
    });
  }

  const statusCode = err.statusCode || 500;
  const response = {
    error: err.message || 'An unexpected internal server error occurred.',
    code: err.code || 'INTERNAL_ERROR'
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
