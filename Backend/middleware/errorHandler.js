module.exports = (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
        ? error.status
        : error.type === 'entity.parse.failed' ? 400 : 500;
    const message = status === 400
        ? 'Request body contains invalid JSON.'
        : 'An unexpected server error occurred.';

    if (status >= 500) {
        console.error('Unhandled request error:', error);
    }

    res.status(status).json({ message });
};
