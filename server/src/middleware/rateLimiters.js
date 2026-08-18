import { rateLimit } from 'express-rate-limit';

const createLimiter = ({ windowMs, limit, message, skipSuccessfulRequests = false }) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    skipSuccessfulRequests,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message
        });
    }
});

export const apiLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    message: 'Too many requests. Please try again later.'
});

export const loginLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    message: 'Too many failed login attempts. Please try again in 15 minutes.'
});

export const registrationLimiter = createLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: 'Too many accounts created from this address. Please try again later.'
});

export const verificationLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    message: 'Too many invalid verification attempts. Please try again later.'
});

export const resendVerificationLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 3,
    message: 'Too many verification emails requested. Please try again in 15 minutes.'
});
