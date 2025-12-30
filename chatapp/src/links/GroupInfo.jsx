// src/links/GroupInfo.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import config from "../config";

export default function GroupInfo() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState("");
  const [searchUsers, setSearchUsers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${config.API_URL}/api/groups/${conversationId}`, { credentials: "include" });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || "Failed to load group");
        setGroup(d.group);
        setMembers(d.members);
      } catch (e) { setErr(e.message); } finally { setLoading(false); }
    })();
  }, [conversationId]);

  useEffect(() => {
    if (!q.trim()) { setSearchUsers([]); return; }
    (async () => {
      const r = await fetch(`${config.API_URL}/api/users`, { credentials: "include" });
      const d = await r.json();
      const norm = (s = "") => s.toLowerCase();
      const filtered = (d.users || []).filter(u => {
        const full = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        return norm(full).includes(norm(q)) || (u.email || "").toLowerCase().includes(norm(q));
      });
      setSearchUsers(filtered.slice(0, 10));
    })();
  }, [q]);

  async function addMember(userId) {
    const r = await fetch(`${config.API_URL}/api/groups/${conversationId}/members`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [userId] })
    });
    const d = await r.json();
    if (!d.ok) return setErr(d.error || "Failed to add");
    const r2 = await fetch(`${config.API_URL}/api/groups/${conversationId}`, { credentials: "include" });
    const d2 = await r2.json();
    setMembers(d2.members || []);
    setQ(""); setSearchUsers([]);
  }

  async function removeMember(userId) {
    if (!confirm("Remove this member?")) return;
    const r = await fetch(`${config.API_URL}/api/groups/${conversationId}/members/${userId}`, {
      method: "DELETE", credentials: "include"
    });
    const d = await r.json();
    if (!d.ok) return setErr(d.error || "Failed to remove");
    setMembers(members.filter(m => m.user_id !== userId));
  }

  async function changeRole(userId, role) {
    const r = await fetch(`${config.API_URL}/api/groups/${conversationId}/role`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role })
    });
    const d = await r.json();
    if (!d.ok) return setErr(d.error || "Failed to change role");
    setMembers(members.map(m => m.user_id === userId ? { ...m, role } : m));
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>← Back</button>
      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "tomato" }}>{err}</p>}
      {!loading && group && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={group.avatar_url || "/group.png"} alt="group" style={{ width: 48, height: 48, borderRadius: 8 }} />
            <div>
              <h2 style={{ margin: 0 }}>{group.title || "Untitled group"}</h2>
              <small>Created: {new Date(group.created_at).toLocaleString()}</small>
            </div>
          </div>

          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <h3>Add members</h3>
            <input
              className="dsb-header-src-bar"
              placeholder="Search users by name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: 420 }}
            />
            {q && (
              <ul style={{ marginTop: 8 }}>
                {searchUsers.map(u => (
                  <li key={u.id} className="dsb-li" style={{ cursor: "pointer" }} onClick={() => addMember(u.id)}>
                    <img className="dsb-header-profile" src={u.profile_image || "/avatar3.png"} alt="" />
                    <div className="displey-info">
                      <p>{`${u.first_name || ""} ${u.last_name || ""}`.trim() || "User"}</p>
                      <h6>{u.email}</h6>
                    </div>
                  </li>
                ))}
                {searchUsers.length === 0 && <li style={{ opacity: .7 }}>No users</li>}
              </ul>
            )}
          </div>

          <h3>Members</h3>
          <ul>
            {members.map(m => (
              <li key={m.user_id} className="dsb-li">
                <img className="dsb-header-profile" src={m.profile_image || "/avatar3.png"} alt="" />
                <div className="displey-info">
                  <p>{`${m.first_name || ""} ${m.last_name || ""}`.trim() || "User"}</p>
                  <h6>{m.email}</h6>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ padding: "2px 8px", borderRadius: 12, border: "1px solid #444", fontSize: 12, opacity: .9 }}>
                    {m.role}
                  </span>
                  {m.role === "member" && <button onClick={() => changeRole(m.user_id, "admin")}>Make admin</button>}
                  {m.role === "admin" && <button onClick={() => changeRole(m.user_id, "member")}>Make member</button>}
                  <button onClick={() => removeMember(m.user_id)}>Remove</button>
                </div>
              </li>
            ))}
            {members.length === 0 && <li className="dsb-li"><div className="displey-info"><p>No members</p></div></li>}
          </ul>
        </>
      )}
    </div>
  );
}
