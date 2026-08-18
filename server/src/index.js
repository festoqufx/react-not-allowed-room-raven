import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { pool } from './config/postgress_db.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { parseAllowedOrigins, isAllowedOrigin } from './lib/corsOrigins.js';

// Routes
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import { startGuestRoomExpiryWatcher } from './services/guestRoomExpiry.js';

// Socket Handlers
import { registerSocketHandlers } from "./socket/socketHandlers.js";

dotenv.config();

const app = express();
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY));
}
const server = createServer(app);
import { setupSocket } from './socket/socketHandlers.js';
const io = setupSocket(server);

const allowedOrigins = parseAllowedOrigins(process.env.FRONT_CORS);
console.log("Allowed CORS origins:", allowedOrigins);

const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) {
            callback(null, true);
        } else {
            console.error(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', apiLimiter);

app.get('/', (req, res) => {
    res.send('NotAllowedRoom API is running...');
});

// Middleware to attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Use Routes
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/auth', authRoutes);

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'ok', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something broke!' });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startGuestRoomExpiryWatcher(io);
});
