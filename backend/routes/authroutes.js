import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  listUsers,
  getUser,
  createUser,
  verifyLogin,
  requireAdmin
} from "../services/auth.service.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const ONE_HOUR = 60 * 60;

/* ===================== Multer: file upload (profile image) ===================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// uploads folder will live at: back/uploads (sibling of routes/)
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname?.replace?.(/\s+/g, "_") || "image";
    const ext = path.extname(safe);
    cb(null, `${Date.now()}_${path.basename(safe, ext)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  }
});

/* ===================== JWT helpers ===================== */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ONE_HOUR });
}
function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction, // Cross-domain cookies must be secure
    maxAge: ONE_HOUR * 1000,
    path: "/",
  });
  console.log(`Set-Cookie called. Environment: ${isProduction ? 'Production (Secure/None)' : 'Dev (Lax)'}`);
}
export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    console.warn(`Auth failed: No token cookie found for ${req.url}. Headers:`, req.headers.cookie ? 'Present (different name?)' : 'Missing entirely');
    return res.status(401).json({ ok: false, error: "Unauthenticated" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    console.warn(`Auth failed: Invalid/Expired token for ${req.url}`);
    return res.status(401).json({ ok: false, error: "Invalid/expired token" });
  }
}

/* ===================== Routes ===================== */

// REGISTER (expects profile_image string URL)
router.post("/register", upload.none(), async (req, res) => {
  const { fname, lname, age, gender, phone, email, password, profile_image } = req.body;
  if (!fname || !lname || !email || !password) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  try {
    // Use the provided URL or default
    const imagePath = profile_image || "/uploads/default.png";

    const result = await createUser({
      fname,
      lname,
      email,
      password,
      age: age ? Number(age) : null,
      gender,
      phone,
      profile_image: imagePath,
    });

    if (result.error) {
      return res.status(409).json({ ok: false, error: result.error });
    }

    // keep token small; don't stuff profile_image into JWT
    const token = signToken({
      id: result.id,
      email,
      first_name: fname,
      last_name: lname
    });
    setAuthCookie(res, token);

    // Return newly created user row so FE can show avatar immediately
    const user = await getUser(result.id);
    return res.status(201).json({ ok: true, user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Registration failed" });
  }
});

// LOGIN (return full user including profile_image)
router.post("/login", async (req, res) => {
  const { identity, password } = req.body;
  if (!identity || !password) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  const r = await verifyLogin({ identity, password });
  if (r.error) return res.status(401).json({ ok: false, error: r.error });

  // Load full user (so we include profile_image, phone, etc.)
  const full = await getUser(r.user.id);
  const token = signToken({
    id: full.id,
    email: full.email,
    first_name: full.first_name,
    last_name: full.last_name
  });
  setAuthCookie(res, token);

  return res.json({ ok: true, user: full });
});

// LOGOUT
router.post("/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  res.json({ ok: true });
});

// USERS (list) - protected
router.get("/users", requireAuth, async (_req, res) => {
  const users = await listUsers();
  res.json({ ok: true, users });
});

// USER by id - protected
router.get("/users/:id", requireAuth, async (req, res) => {
  const u = await getUser(Number(req.params.id));
  if (!u) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, user: u });
});

// ME - protected (return full user, not just JWT payload)
router.get("/me", requireAuth, async (req, res) => {
  const u = await getUser(req.user.id);
  if (!u) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, user: u });
});

router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  const users = await listUsers();
  res.json({ ok: true, count: users.length });
});

export default router;
