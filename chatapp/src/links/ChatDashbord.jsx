// src/links/ChatDashbord.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.jsx";
import "../css/dashbord.css";
import Profile from "./Profile";
import config from "../config.js";

export default function ChatDashbord() {
  const navigate = useNavigate();
  const { logout, user: currentUser } = useAuth(); // Use context for user & logout

  // UI state
  const [activeTab, setActiveTab] = useState("public"); // "public" | "group" | "profile"
  const [query, setQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false); // Toggle for create group UI

  // data state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [conversations, setConversations] = useState([]); // DMs + Groups

  // current logged in user (fallback if context is slow updating, though context is preferred)
  const me = currentUser;

  // quick group creation
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [allUsers, setAllUsers] = useState([]);               // for picking members
  const [selectedMemberIds, setSelectedMemberIds] = useState([]); // chosen members

  // helpers
  const norm = (s = "") =>
    s.toString().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  const matchConv = (q, c) => {
    if (!q) return true;
    if (c.is_group) return norm(c.title || "").includes(norm(q));
    const full = `${c.first_name || ""} ${c.last_name || ""}`.trim();
    return norm(full).includes(norm(q));
  };

  // fetch conversations and users
  useEffect(() => {
    (async () => {
      try {
        const [convRes, usersRes] = await Promise.all([
          fetch(`${config.API_URL}/api/conversations`, {
            credentials: "include",
            headers: { Accept: "application/json" }
          }),
          fetch(`${config.API_URL}/api/users`, {
            credentials: "include",
            headers: { Accept: "application/json" }
          })
        ]);

        if (convRes.status === 401) {
          // Context should handle this, but safe fallback
          return;
        }

        if (!convRes.ok) throw new Error(`Conversations failed: ${convRes.status}`);
        const convData = await convRes.json();
        setConversations(Array.isArray(convData?.conversations) ? convData.conversations : []);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setAllUsers(Array.isArray(usersData?.users) ? usersData.users : []);
        }
      } catch (e) {
        setErr(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // derived lists
  const hasQuery = query.trim().length > 0;
  const filtered = conversations.filter((c) => matchConv(query, c));
  const dms = conversations.filter((c) => c.is_group === 0);
  const groups = conversations.filter((c) => c.is_group === 1);
  const filteredDMs = dms.filter((c) => matchConv(query, c));
  const filteredGroups = groups.filter((c) => matchConv(query, c));

  // actions
  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const openConversation = (conversationId) => {
    if (!conversationId) return;
    navigate(`/chat/${conversationId}`);
  };

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const createGroup = async () => {
    const title = newGroupTitle.trim();
    if (!title) return;
    try {
      const r = await fetch(`${config.API_URL}/api/groups`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, memberIds: selectedMemberIds })
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed to create group");

      setNewGroupTitle("");
      setSelectedMemberIds([]);
      setShowCreateGroup(false); // Hide after create
      navigate(`/chat/${d.conversationId}`);
    } catch (e) {
      setErr(e.message || "Failed to create group");
    }
  };

  const startDMWith = async (userId) => {
    try {
      const r = await fetch(`${config.API_URL}/api/conversations/with/${userId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed to start conversation");
      navigate(`/chat/${d.conversationId}`);
    } catch (e) {
      setErr(e.message || "Failed to start conversation");
    }
  };

  // render helpers
  const renderItem = (c) => (
    <li
      key={c.conversation_id}
      className="dsb-li"
      onClick={() => openConversation(c.conversation_id)}
    >
      <img
        className="dsb-header-profile"
        src={
          c.is_group
            ? `${config.API_URL}${c.avatar_url || "/group.png"}`
            : `${config.API_URL}${c.profile_image || "/uploads/default.png"}`
        }
        alt=""
      />
      <div className="displey-info">
        <p>
          {c.is_group
            ? (c.title || "Untitled group")
            : `${c.first_name || ""} ${c.last_name || ""}`.trim() || "User"}
        </p>
        <h6>{c.last_message_body || "Tap to open"}</h6>
      </div>
      <h5>
        {c.last_message_at
          ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : ""}
      </h5>
    </li>
  );

  const renderPickUser = (u) => (
    <label
      key={u.id}
      className="dsb-pick-user"
    >
      <input
        type="checkbox"
        checked={selectedMemberIds.includes(u.id)}
        onChange={() => toggleMember(u.id)}
      />
      <img className="dsb-header-profile small" src={`${config.API_URL}${u.profile_image || "/uploads/default.png"}`} alt="" />
      <span>{`${u.first_name || ""} ${u.last_name || ""}`.trim() || "User"}</span>
    </label>
  );

  return (
    <>
      <header className="dsb-header-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img className="dsb-logo-img" src="/logo.png" alt="Logo" />
          <h3 style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>Ping</h3>
        </div>

        <div className="dsb-header-src-bar-div" style={{ flex: 1, maxWidth: 600, position: 'relative', top: 0, background: 'transparent', padding: 0 }}>
          <input
            className="dsb-header-src-bar"
            type="search"
            placeholder="Search people & groups..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <button onClick={handleLogout} className="dsb-logout-btn">Logout</button>
      </header>

      <div className="dsb-header-nav-bar-div">
        <li className={`dsb-header-nav-bar ${activeTab === 'public' ? 'active' : ''}`} onClick={() => setActiveTab("public")}>Chats</li>
        <li className={`dsb-header-nav-bar ${activeTab === 'group' ? 'active' : ''}`} onClick={() => setActiveTab("group")}>Groups</li>
        <li className={`dsb-header-nav-bar ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab("profile")}>Profile</li>
      </div>

      <div className="dsb-content-area">
        {loading && <p style={{ padding: 20, textAlign: 'center', opacity: 0.7 }}>Loading chats...</p>}
        {err && <p style={{ color: "#ff6b6b", padding: 20, textAlign: 'center' }}>{err}</p>}

        {!loading && !err && (
          <div className="dsb-header-chat-list">
            {/* Unified container for scrollability */}

            {hasQuery ? (
              <>
                <p className="section-label">Search Results</p>
                <ul>
                  {filtered.map(renderItem)}
                  {filtered.length === 0 && (
                    <div className="empty-state">No matches found</div>
                  )}
                </ul>
              </>
            ) : (
              <>
                {activeTab === "public" && (
                  <>
                    <h4 className="section-label">Recent Conversations</h4>
                    <ul>
                      {filteredDMs.map(renderItem)}
                      {filteredDMs.length === 0 && <div className="empty-state">No conversations yet</div>}
                    </ul>

                    {/* Start New Chat List - Now inside the scrollable area */}
                    <div className="new-chat-section">
                      <h4 className="section-label">Start New Chat</h4>
                      <div className="user-grid">
                        {allUsers.filter(u => u.id !== me?.id).map(u => (
                          <div
                            key={u.id}
                            className="user-card"
                            onClick={() => startDMWith(u.id)}
                          >
                            <img className="dsb-header-profile" src={`${config.API_URL}${u.profile_image || "/uploads/default.png"}`} alt="" />
                            <div className="user-info">
                              <p>{`${u.first_name || ""} ${u.last_name || ""}`.trim() || "User"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "group" && (
                  <div style={{ padding: 12 }}>
                    <button
                      className="dsb-crt-grp-btn"
                      style={{ width: '100%', marginBottom: 16 }}
                      onClick={() => setShowCreateGroup(!showCreateGroup)}
                    >
                      {showCreateGroup ? "Cancel Group Creation" : "+ Create New Group"}
                    </button>

                    {showCreateGroup && (
                      <div className="create-group-panel">
                        <input
                          type="text"
                          placeholder="Group Name"
                          value={newGroupTitle}
                          onChange={(e) => setNewGroupTitle(e.target.value)}
                          className="dsb-header-src-bar"
                          style={{ marginBottom: 12 }}
                        />
                        <p className="section-label">Select Members:</p>
                        <div className="pick-user-grid">
                          {allUsers.map(renderPickUser)}
                        </div>
                        <button className="dsb-primary-btn" onClick={createGroup} style={{ marginTop: 12 }}>
                          Create Group ({selectedMemberIds.length})
                        </button>
                      </div>
                    )}

                    <h4 className="section-label">Your Groups</h4>
                    <ul>
                      {filteredGroups.map(renderItem)}
                      {filteredGroups.length === 0 && !showCreateGroup && (
                        <div className="empty-state">No groups joined</div>
                      )}
                    </ul>
                  </div>
                )}

                {activeTab === "profile" && <Profile />}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
