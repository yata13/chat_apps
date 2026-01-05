import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

console.log("🔌 Initializing database connection...");
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET'}`);
console.log(`   DB_SSL: ${process.env.DB_SSL}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);

const pool = new pg.Pool({
  // Allow using a single connection string (common for Supabase/Render)
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual params if no connection string
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  // SSL is often required for cloud Postgres
  ssl: process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false)
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log("✅ Database connected successfully"))
  .catch(err => console.error("❌ Database connection failed:", err.message));

export default pool;
