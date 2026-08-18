import { hashPassword, comparePassword } from "../lib/hased.js";
import { pool } from "../config/postgress_db.js";
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { sendVerificationEmail } from '../services/emailService.js';

const createVerificationToken = () => {
    const token = crypto.randomBytes(32).toString('hex');
    return {
        token,
        hash: crypto.createHash('sha256').update(token).digest('hex')
    };
};

export const Register = async (req, res) => {
    const client = await pool.connect();
    try {
        const name = req.body.name?.trim();
        const email = req.body.email?.trim().toLowerCase();
        const { password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const hashedPassword = await hashPassword(password);
        const user = {
            name,
            email,
            hashedPassword,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
            isDeleted: false
        }

        const verification = createVerificationToken();
        await client.query('BEGIN');
        const result = await client.query(
            `INSERT INTO user_profile
                (name, email, hashed_password, created_at, updated_at, is_active, is_deleted,
                 isverified, verification_token_hash, verification_token_expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, NOW() + INTERVAL '1 hour')
             RETURNING id`,
            [user.name, user.email, user.hashedPassword, user.createdAt, user.updatedAt,
                user.isActive, user.isDeleted, verification.hash]
        );

        await sendVerificationEmail({
            email: user.email,
            name: user.name,
            token: verification.token
        });
        await client.query('COMMIT');

        console.log('User registered successfully');

        res.status(201).json({
            success: true,
            message: "Account created. Check your email to verify it.",
            userId: result.rows[0].id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            isActive: user.isActive,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.log(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Unable to create account or send verification email" });
    } finally {
        client.release();
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const user = await pool.query(
            "SELECT * FROM user_profile WHERE email = $1 AND is_active = true AND is_deleted = false",
            [email]
        );
        if (user.rows.length === 0) {
            return res.status(404).json({ message: "User not found or account disabled" });
        }

        const validPassword = await comparePassword(password, user.rows[0].hashed_password);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid password" });
        }

        const sessionToken = uuidv4();
        if (!user.rows[0].isverified) {
            return res.status(401).json({
                success: false,
                message: "User is not verified. Please verify your email first.",
                isverified: false,
                userId: user.rows[0].id
            });
        }

        const session = {
            user_id: user.rows[0].id,
            session_token: sessionToken,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true,
            is_deleted: false
        }

        await pool.query(
            "INSERT INTO auth_session (user_id, session_token, created_at, updated_at, is_active, is_deleted) VALUES ($1, $2, $3, $4, $5, $6)",
            [session.user_id, session.session_token, session.created_at, session.updated_at, session.is_active, session.is_deleted]
        );

        console.log('User logged in successfully');

        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            sessionToken: sessionToken,
            userId: user.rows[0].id,
            name: user.rows[0].name,
            isverified: user.rows[0].isverified,
            email: user.rows[0].email,
            createdAt: user.rows[0].created_at,
            updatedAt: user.rows[0].updated_at,
            isActive: user.rows[0].is_active,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const refreshtoken = async (req, res) => {
    const client = await pool.connect();
    try {
        const { session_token } = req.body;
        if (!session_token) {
            return res.status(400).json({ message: "Session token is required" });
        }

        await client.query('BEGIN');

        const session = await client.query("SELECT * FROM auth_session WHERE session_token = $1 AND is_active = true", [session_token]);
        if (session.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Active session not found" });
        }

        const newSessionToken = uuidv4();
        const now = new Date().toISOString();

        // Deactivate old session
        await client.query(
            "UPDATE auth_session SET is_active = false, updated_at = $1 WHERE session_token = $2",
            [now, session_token]
        );

        // Create new session
        await client.query(
            "INSERT INTO auth_session (user_id, session_token, created_at, updated_at, is_active, is_deleted) VALUES ($1, $2, $3, $4, $5, $6)",
            [session.rows[0].user_id, newSessionToken, now, now, true, false]
        );

        await client.query('COMMIT');
        console.log('Token refreshed successfully');

        res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            userId: session.rows[0].user_id,
            sessionToken: newSessionToken
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
}

export const logout = async (req, res) => {
    try {
        const { session_token } = req.body;
        if (!session_token) {
            return res.status(400).json({ message: "Session token is required" });
        }

        await pool.query(
            "UPDATE auth_session SET is_active = false, updated_at = $1 WHERE session_token = $2",
            [new Date().toISOString(), session_token]
        );

        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


export const verify_email = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Verification token is required" });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const now = new Date().toISOString();
        const user = await pool.query(
            `UPDATE user_profile
             SET isverified = true, updated_at = $1, verification_token_hash = NULL,
                 verification_token_expires_at = NULL
             WHERE verification_token_hash = $2
               AND verification_token_expires_at > NOW()
               AND is_active = true AND is_deleted = false
             RETURNING id, email, created_at, updated_at, is_active`,
            [now, tokenHash]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Verification link is invalid or has expired"
            });
        }

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
            userId: user.rows[0].id,
            email: user.rows[0].email,
            createdAt: user.rows[0].created_at,
            updatedAt: user.rows[0].updated_at,
            isActive: user.rows[0].is_active,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const resend_verification = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await pool.query(
            `SELECT id, name, email, isverified, verification_token_expires_at FROM user_profile
             WHERE email = $1 AND is_active = true AND is_deleted = false`,
            [email]
        );

        // Use the same response for unknown and verified accounts to avoid account enumeration.
        if (user.rows.length === 0 || user.rows[0].isverified) {
            return res.status(200).json({
                success: true,
                message: "If the account needs verification, a new link has been sent."
            });
        }

        const tokenCreatedWithinLastMinute = user.rows[0].verification_token_expires_at
            && new Date(user.rows[0].verification_token_expires_at).getTime() > Date.now() + 59 * 60 * 1000;
        if (tokenCreatedWithinLastMinute) {
            return res.status(200).json({
                success: true,
                message: "A verification link was sent recently. Please wait before trying again."
            });
        }

        const verification = createVerificationToken();
        await pool.query(
            `UPDATE user_profile
             SET verification_token_hash = $1,
                 verification_token_expires_at = NOW() + INTERVAL '1 hour', updated_at = $2
             WHERE id = $3`,
            [verification.hash, new Date().toISOString(), user.rows[0].id]
        );
        await sendVerificationEmail({
            email: user.rows[0].email,
            name: user.rows[0].name,
            token: verification.token
        });

        res.status(200).json({
            success: true,
            message: "If the account needs verification, a new link has been sent."
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Unable to resend verification email" });
    }
};
