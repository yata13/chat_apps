// back/server.js (top of file)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import fs from "fs";

// ⬇️ use your actual routes file name
import authRouter from "./routes/authroutes.js";
import chat from "./routes/chat.js";
import uploadRouter from "./routes/upload.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration - supports multiple origins for production
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(url => url.trim())
  : ["http://localhost:5173"];

const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

app.set("io", io);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`  Origin: ${req.headers.origin || 'No Origin'}`);
  console.log(`  Cookies: ${req.headers.cookie ? 'Present' : 'Missing'}`);
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // Reflect origin for Netlify and localhost, or allow if no origin (mobile/curl)
    if (!origin) return callback(null, true);
    if (origin.includes("netlify.app") || origin.includes("localhost") || origin.includes("rendered.com")) {
      callback(null, true);
    } else {
      callback(null, true); // Still permissive for debugging, but we log it
    }
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

// uploads static
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

app.use("/api", authRouter);
app.use("/api", chat);
app.use("/api", uploadRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Socket auth via cookie "token"
io.use((socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const token = cookies.token;
    if (!token) return next(new Error("Unauthenticated"));
    socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { next(new Error("Invalid token")); }
});
io.on("connection", (socket) => {
  console.log(`User ${socket.data.user.id} connected`);

  // Update user's last_seen to now
  (async () => {
    const pool = (await import("./db.js")).default;
    await pool.query("UPDATE users SET last_seen = NOW() WHERE id = $1", [socket.data.user.id]);
  })().catch(console.error);

  // Auto-join all user conversations on connect
  (async () => {
    const { listConversations } = await import("./services/chat.service.js");
    const convs = await listConversations(socket.data.user.id);
    convs.forEach(c => socket.join(`conv:${c.conversation_id}`));
  })().catch(() => { });

  socket.on("join_conversation", ({ conversationId }) => {
    if (Number.isFinite(Number(conversationId))) {
      socket.join(`conv:${conversationId}`);
    }
  });

  socket.on("message:send", async ({ conversationId, body }) => {
    const { insertMessage, ensureConvAccess } = await import("./services/chat.service.js");
    if (!(await ensureConvAccess(Number(conversationId), socket.data.user.id))) return;
    const msg = await insertMessage({ conversationId: Number(conversationId), senderId: socket.data.user.id, body });
    io.to(`conv:${conversationId}`).emit("message:new", msg);
  });

  socket.on("typing:start", ({ conversationId }) => {
    socket.to(`conv:${conversationId}`).emit("typing:start", {
      userId: socket.data.user.id,
      name: `${socket.data.user.first_name} ${socket.data.user.last_name}`.trim()
    });
  });

  socket.on("typing:stop", ({ conversationId }) => {
    socket.to(`conv:${conversationId}`).emit("typing:stop", { userId: socket.data.user.id });
  });

  socket.on("disconnect", () => {
    console.log(`User ${socket.data.user.id} disconnected`);
    // Update last_seen on disconnect
    (async () => {
      const pool = (await import("./db.js")).default;
      await pool.query("UPDATE users SET last_seen = NOW() WHERE id = $1", [socket.data.user.id]);
    })().catch(console.error);
  });
});


// after app.use("/api/chat", router) etc.
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});


const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 CLIENT_URL env var: ${process.env.CLIENT_URL || 'NOT SET'}`);
  console.log(`🌐 Allowed origins: ${allowedOrigins.join(', ')}`);
});
