// backend/services/auth.service.js
import pool from "../db.js";
import bcrypt from "bcrypt";

export async function createUser({ fname, lname, email, password, age, gender, phone, profile_image }) {
  const { rows: exist } = await pool.query(
    "SELECT id FROM users WHERE email = $1 OR phone_number = $2 LIMIT 1",
    [email, phone]
  );
  if (exist.length) return { error: "Email or phone already registered" };

  const hash = await bcrypt.hash(password, 10);
  const { rows: res } = await pool.query(
    `INSERT INTO users (first_name,last_name,email,password_hash,age,gender,phone_number,profile_image)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [fname, lname, email, hash, age || null, gender || "other", phone || null, profile_image || "/uploads/default.png"]
  );
  return { id: res[0].id };
}

export async function verifyLogin({ identity, password }) {
  const { rows } = await pool.query(
    `SELECT id, first_name, last_name, email, password_hash
     FROM users WHERE email = $1 OR phone_number = $2 LIMIT 1`,
    [identity, identity]
  );
  if (!rows.length) return { error: "Invalid credentials" };

  const u = rows[0];
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return { error: "Invalid credentials" };

  return { user: { id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email } };
}

export async function listUsers() {
  const { rows } = await pool.query(
    `SELECT id, first_name, last_name, email, phone_number, age, gender, profile_image, last_message, last_seen
     FROM users ORDER BY id DESC`
  );
  return rows;
}

export async function getUser(id) {
  const { rows } = await pool.query(
    `SELECT id, first_name, last_name, email, phone_number, age, gender, profile_image, last_message, last_seen
     FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}


export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  next();
}
