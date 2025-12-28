// backend/routes/chat.js
import express from "express";
import { requireAuth } from "./authroutes.js";
import pool from "../db.js";

import {
  // DMs + groups
  getOrCreateOneToOne,
  listConversations,
  listMessages,
  insertMessage,
  ensureConvAccess,
  getConversationById,

  // group management
  createGroup,
  addMembers,
  removeMember,
  setRole,
} from "../services/chat.service.js";

const router = express.Router();
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------ DM (1:1) ------------ */
router.post("/conversations/with/:otherId", requireAuth, a(async (req, res) => {
  const myId = req.user.id;
  const otherId = Number(req.params.otherId);
  if (!Number.isFinite(otherId) || otherId === myId) {
    return res.status(400).json({ ok: false, error: "Invalid user id" });
  }
  const cid = await getOrCreateOneToOne(myId, otherId);
  res.json({ ok: true, conversationId: cid });
}));

/* List all conversations (DMs + groups) */
router.get("/conversations", requireAuth, a(async (req, res) => {
  const rows = await listConversations(req.user.id);
  res.json({ ok: true, conversations: rows });
}));

/* Read messages (paged) */
router.get("/messages", requireAuth, a(async (req, res) => {
  const conversationId = Number(req.query.conversationId);
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 50;

  if (!Number.isFinite(conversationId)) {
    return res.status(400).json({ ok: false, error: "conversationId required" });
  }
  const conv = await getConversationById(conversationId);
  if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });

  const allowed = await ensureConvAccess(conversationId, req.user.id);
  if (!allowed) return res.status(403).json({ ok: false, error: "Not a participant" });

  const msgs = await listMessages(conversationId, limit, beforeId);
  res.json({ ok: true, messages: msgs });
}));

/* Send message */
router.post("/messages", requireAuth, a(async (req, res) => {
  const { conversationId, body } = req.body;
  if (!Number.isFinite(Number(conversationId)) || !body?.trim()) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  const conv = await getConversationById(Number(conversationId));
  if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });

  const allowed = await ensureConvAccess(Number(conversationId), req.user.id);
  if (!allowed) return res.status(403).json({ ok: false, error: "Not a participant" });

  const msg = await insertMessage({
    conversationId: Number(conversationId),
    senderId: req.user.id,
    body: body.trim(),
  });

  req.app.get("io")?.to?.(`conv:${conversationId}`)?.emit?.("message:new", msg);
  res.status(201).json({ ok: true, message: msg });
}));

/* ------------ Groups ------------ */

/* Create group */
router.post("/groups", requireAuth, a(async (req, res) => {
  const { title, memberIds = [], avatarUrl = null } = req.body || {};
  const conversationId = await createGroup({
    title,
    creatorId: req.user.id,
    memberIds,
    avatarUrl,
  });
  res.status(201).json({ ok: true, conversationId });
}));

/* Group details + members */
router.get("/groups/:id", requireAuth, a(async (req, res) => {
  const conversationId = Number(req.params.id);

  const conv = await getConversationById(conversationId);
  if (!conv || conv.is_group !== 1) {
    return res.status(404).json({ ok: false, error: "Group not found" });
  }

  const allowed = await ensureConvAccess(conversationId, req.user.id);
  if (!allowed) return res.status(403).json({ ok: false, error: "Not a participant" });

  const [members] = await pool.query(
    `SELECT cp.user_id, cp.role, u.first_name, u.last_name, u.profile_image, u.email
     FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.conversation_id = ?
     ORDER BY (cp.role='admin') DESC, u.first_name ASC, u.last_name ASC`,
    [conversationId]
  );

  res.json({
    ok: true,
    group: {
      id: conversationId,
      title: conv.title,
      avatar_url: conv.avatar_url,
      created_at: conv.created_at
    },
    members
  });
}));

/* Add members (admin) */
router.post("/groups/:id/members", requireAuth, a(async (req, res) => {
  const conversationId = Number(req.params.id);
  const { memberIds = [] } = req.body || {};
  await addMembers(conversationId, req.user.id, memberIds);
  res.json({ ok: true });
}));

/* Remove member (admin or self) */
router.delete("/groups/:id/members/:userId", requireAuth, a(async (req, res) => {
  const conversationId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  await removeMember(conversationId, req.user.id, targetUserId);
  res.json({ ok: true });
}));

/* Promote/demote role (admin) */
router.post("/groups/:id/role", requireAuth, a(async (req, res) => {
  const conversationId = Number(req.params.id);
  const { userId, role } = req.body || {};
  if (!['member','admin'].includes(role)) {
    return res.status(400).json({ ok:false, error:"Bad role" });
  }
  await setRole(conversationId, req.user.id, Number(userId), role);
  res.json({ ok: true });
}));

export default router;
