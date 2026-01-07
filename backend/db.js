import pg from "pg";
import dns from "dns";
import dotenv from "dotenv";
dotenv.config();

// Force IPv4 to fix Render + Supabase connection issues
dns.setDefaultResultOrder('ipv4first');

console.log("🔌 Initializing database connection...");
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET'}`);
console.log(`   DB_SSL: ${process.env.DB_SSL}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log("✅ Database connected successfully"))
  .catch(err => console.error("❌ Database connection failed:", err.message));

export default pool;
