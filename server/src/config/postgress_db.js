import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const {
    DATABASE_URL,
    DB_USER: USER,
    DB_PASSWORD: PASSWORD,
    DB_HOST: HOST,
    DB_PORT: PORT,
    DB_NAME: NAME,
    DB_DRIVER: DRIVER
} = process.env;

const usePglite = String(DRIVER || "").toLowerCase() === "pglite";

const toPgResult = (result) => {
    const rows = result?.rows || [];
    return {
        rows,
        rowCount: result?.affectedRows ?? rows.length,
    };
};

const createPglitePool = async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const dataDir = path.join(__dirname, "../../data/pglite");
    fs.mkdirSync(dataDir, { recursive: true });
    const db = await PGlite.create({ dataDir });

    const run = async (text, params) => {
        const sql = String(text || "").trim();
        if (!sql) return { rows: [], rowCount: 0 };

        if (/^begin$/i.test(sql)) {
            await db.exec("BEGIN");
            return { rows: [], rowCount: 0 };
        }
        if (/^commit$/i.test(sql)) {
            await db.exec("COMMIT");
            return { rows: [], rowCount: 0 };
        }
        if (/^rollback$/i.test(sql)) {
            await db.exec("ROLLBACK");
            return { rows: [], rowCount: 0 };
        }

        if (!params?.length && /;\s*\S/.test(sql)) {
            const results = await db.exec(sql);
            const last = Array.isArray(results) ? results.at(-1) : results;
            return toPgResult(last || { rows: [] });
        }

        return toPgResult(await db.query(sql, params));
    };

    const poolAdapter = {
        query: run,
        connect: async () => ({
            query: run,
            release: () => {},
        }),
        end: async () => {
            await db.close();
        },
    };

    console.log("Using embedded PGlite database for local rooms");
    return poolAdapter;
};

let pool;

if (usePglite) {
    pool = await createPglitePool();
} else {
    if (!DATABASE_URL && (!USER || !PASSWORD)) {
        console.error("❌ Database credentials missing in .env file!");
    }

    pool = new pg.Pool(
        DATABASE_URL
            ? {
                connectionString: DATABASE_URL,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            }
            : {
                user: USER,
                password: String(PASSWORD || ""),
                host: HOST || "localhost",
                port: Number(PORT) || 5432,
                database: NAME || "postgres",
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
            }
    );
}

export { pool };

const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log("Database connected successfully");
        client.release();
    } catch (err) {
        console.error("Database connection error:", err.message);
        if (err.code === "28P01") {
            console.error("The password in your .env file does not match PostgreSQL. For local demo, set DB_DRIVER=pglite.");
        }
    }
};

export default connectDB;
