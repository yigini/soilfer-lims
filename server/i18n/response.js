/**
 * Small helpers to standardize API responses with code + params + fallback text.
 * 
 * Success shape: { messageCode, messageParams, message, data }
 * Error shape:   { errorCode, errorParams, error, data }
 */

const success = (res, messageCode, message, messageParams = null, status = 200, data = null) => {
    return res.status(status).json({
        messageCode,
        messageParams,
        message,
        data
    });
};

const error = (res, status, errorCode, message, errorParams = null, data = null) => {
    return res.status(status).json({
        errorCode,
        errorParams,
        error: message,
        data
    });
};

module.exports = { success, error };
