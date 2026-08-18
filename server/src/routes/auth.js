import express from 'express'
import { Register, login, refreshtoken, logout, verify_email, resend_verification } from '../controller/authController.js';
import {
    loginLimiter,
    registrationLimiter,
    resendVerificationLimiter,
    verificationLimiter
} from '../middleware/rateLimiters.js';

const router = express.Router();

router.post("/register", registrationLimiter, Register)
router.post("/login", loginLimiter, login)
router.post("/logout", logout)
router.post("/refreshtoken", refreshtoken)
router.post('/verify_email', verificationLimiter, verify_email)
router.post('/resend_verification', resendVerificationLimiter, resend_verification)



export default router;
