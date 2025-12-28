// backend/services/chat.service.js
import pool from "../db.js";

/** Verify the conversation exists and the user is a participant */
export async function ensureConvAccess(conversationId, userId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM conversation_participants
     WHERE conversation_id = $1 AND user_id = $2
     LIMIT 1`,
    [conversationId, userId]
  );
  return rows.length > 0;
}

/** Get a single conversation row (or null) */
export async function getConversationById(conversationId) {
  const { rows } = await pool.query(
    `SELECT id, is_group, title, avatar_url, created_at
     FROM conversations
     WHERE id = $1
     LIMIT 1`,
    [conversationId]
  );
  return rows.length ? rows[0] : null;
}

/** Create (or find) a 1:1 conversation */
export async function getOrCreateOneToOne(myId, otherId) {
  const { rows } = await pool.query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_participants p1
       ON p1.conversation_id=c.id AND p1.user_id=$1
     JOIN conversation_participants p2
       ON p2.conversation_id=c.id AND p2.user_id=$2
     WHERE c.is_group=false
     LIMIT 1`,
    [myId, otherId]
  );
  if (rows.length) return rows[0].id;

  const { rows: conv } = await pool.query(
    "INSERT INTO conversations (is_group) VALUES (false) RETURNING id"
  );
  const cid = conv[0].id;

  await pool.query(
    "INSERT INTO conversation_participants (conversation_id,user_id) VALUES ($1,$2),($3,$4)",
    [cid, myId, cid, otherId]
  );

  return cid;
}

/** Unified conversation list: returns both DMs and Groups */
export async function listConversations(myId) {
  const { rows } = await pool.query(
    `
    SELECT
      c.id           AS conversation_id,
      c.is_group,
      c.title,
      c.avatar_url,
      c.created_at,

      -- For DMs, show the "other user" fields; NULL for groups
      CASE WHEN c.is_group=false THEN u.id            END AS other_id,
      CASE WHEN c.is_group=false THEN u.first_name    END AS first_name,
      CASE WHEN c.is_group=false THEN u.last_name     END AS last_name,
      CASE WHEN c.is_group=false THEN u.profile_image END AS profile_image,

      m.id          AS last_message_id,
      m.body        AS last_message_body,
      m.created_at  AS last_message_at
    FROM conversations c
    JOIN conversation_participants me
      ON me.conversation_id = c.id AND me.user_id = $1
    LEFT JOIN (
      -- Pick "the other participant" for DMs
      SELECT op.conversation_id, op.user_id
      FROM conversation_participants op
    ) op
      ON op.conversation_id=c.id
     AND c.is_group=false
     AND op.user_id<>me.user_id
    LEFT JOIN users u
      ON u.id = op.user_id
    LEFT JOIN (
      SELECT conversation_id, MAX(id) AS last_id
      FROM messages
      GROUP BY conversation_id
    ) last_per_conv
      ON last_per_conv.conversation_id = c.id
    LEFT JOIN messages m
      ON m.id = last_per_conv.last_id
    ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `,
    [myId]
  );
  return rows;
}

/** Paginated messages (newest-last for rendering) */
export async function listMessages(conversationId, limit = 50, beforeId = null) {
  const sql = beforeId
    ? `SELECT id, conversation_id, sender_id, body, created_at
       FROM messages
       WHERE conversation_id = $1 AND id < $2
       ORDER BY id DESC
       LIMIT $3`
    : `SELECT id, conversation_id, sender_id, body, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT $2`;

  const params = beforeId
    ? [conversationId, beforeId, limit]
    : [conversationId, limit];

  const { rows } = await pool.query(sql, params);
  return rows.reverse(); // chronological
}

/** Insert a message and return the row */
export async function insertMessage({ conversationId, senderId, body }) {
  const { rows: res } = await pool.query(
    "INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id",
    [conversationId, senderId, body]
  );
  const { rows } = await pool.query(
    "SELECT id, conversation_id, sender_id, body, created_at FROM messages WHERE id = $1 LIMIT 1",
    [res[0].id]
  );
  return rows.length ? rows[0] : null;
}

/* ===================== Groups ====================== */

/** Create a new group and add members; creator is admin. */
export async function createGroup({ title, creatorId, memberIds = [], avatarUrl = null }) {
  if (!title?.trim()) throw new Error("Group title required");

  const { rows: convRes } = await pool.query(
    "INSERT INTO conversations (is_group, title, avatar_url, created_by) VALUES (true, $1, $2, $3) RETURNING id",
    [title.trim(), avatarUrl, creatorId]
  );
  const conversationId = convRes[0].id;

  const uniqueIds = Array.from(new Set([creatorId, ...memberIds.map(Number)].filter(Boolean)));
  if (uniqueIds.length) {
    // Postgres doesn't support bulk INSERT ... VALUES ? like MySQL
    // We must generate ($1, $2, $3), ($4, $5, $6)...
    const values = [];
    const params = [];
    let idx = 1;
    uniqueIds.forEach(uid => {
      params.push(conversationId, uid, uid === creatorId ? 'admin' : 'member');
      values.push(`($${idx++}, $${idx++}, $${idx++})`);
    });

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ${values.join(',')}`,
      params
    );
  }

  return conversationId;
}

/** Add members (admin only) */
export async function addMembers(conversationId, actorId, newMemberIds = []) {
  const { rows } = await pool.query(
    `SELECT role FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2 LIMIT 1`,
    [conversationId, actorId]
  );
  if (!rows.length || rows[0].role !== 'admin') throw new Error("Admin only");

  const uniqueIds = Array.from(new Set(newMemberIds.map(Number).filter(Boolean)));

  if (uniqueIds.length) {
    const values = [];
    const params = [];
    let idx = 1;
    uniqueIds.forEach(uid => {
      params.push(conversationId, uid, 'member');
      values.push(`($${idx++}, $${idx++}, $${idx++})`);
    });

    // IGNORE -> ON CONFLICT DO NOTHING
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id, role) 
       VALUES ${values.join(',')}
       ON CONFLICT DO NOTHING`,
      params
    );
  }
}

/** Remove a member (admin or self) */
export async function removeMember(conversationId, actorId, targetUserId) {
  if (actorId !== targetUserId) {
    const { rows } = await pool.query(
      `SELECT role FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2 LIMIT 1`,
      [conversationId, actorId]
    );
    if (!rows.length || rows[0].role !== 'admin') throw new Error("Admin only");
  }
  await pool.query(
    "DELETE FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2",
    [conversationId, targetUserId]
  );
}

/** Promote/demote admin (admin only) */
export async function setRole(conversationId, actorId, targetUserId, role) {
  const { rows } = await pool.query(
    `SELECT role FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2 LIMIT 1`,
    [conversationId, actorId]
  );
  if (!rows.length || rows[0].role !== 'admin') throw new Error("Admin only");

  await pool.query(
    "UPDATE conversation_participants SET role=$1 WHERE conversation_id=$2 AND user_id=$3",
    [role, conversationId, targetUserId]
  );
}
