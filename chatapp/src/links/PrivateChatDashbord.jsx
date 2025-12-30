
// src/links/PrivateChatDashbord.jsx
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useParams, useNavigate } from "react-router-dom";
import "../css/PrivateChatDashbord.css";
import config from "../config.js";

export default function PrivateChatDashbord() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [meId, setMeId] = useState(null);
  const [friendId, setFriendId] = useState(null);
  const [friend, setFriend] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // 1) who am I?
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${config.API_URL}/api/me`, { credentials: "include" });
        const d = r.ok ? await r.json() : {};
        setMeId(d?.user?.id ?? null);
      } catch { setMeId(null); }
    })();
  }, []);

  // 2) find friendId from /api/conversations (uses your other_id)
  useEffect(() => {
    if (!conversationId) return;
    (async () => {
      try {
        const r = await fetch(`${config.API_URL}/api/conversations`, { credentials: "include" });
        if (!r.ok) return;
        const d = await r.json();
        const conv = (d.conversations || []).find(
          c => Number(c.conversation_id) === Number(conversationId)
        );
        if (conv?.other_id) setFriendId(Number(conv.other_id));
      } catch { }
    })();
  }, [conversationId]);

  // 2b) load friend details whenever friendId changes
  useEffect(() => {
    if (!friendId) return;
    (async () => {
      try {
        const r = await fetch(`${config.API_URL}/api/users/${friendId}`, { credentials: "include" });
        if (!r.ok) throw new Error(`Friend ${friendId} not found`);
        const d = await r.json();
        setFriend(d.user || null);
      } catch {
        setFriend(null);
      }
    })();
  }, [friendId]);

  // 3) load history (unchanged)
  useEffect(() => {
    fetch(`${config.API_URL}/api/messages?conversationId=${conversationId}`, {
      credentials: "include"
    })
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .catch(console.error);
  }, [conversationId]);

  // 4) live updates (unchanged)
  useEffect(() => {
    const s = io(`${config.API_URL}`, { withCredentials: true });
    socketRef.current = s;

    s.emit("join_conversation", { conversationId: Number(conversationId) });

    s.on("message:new", (msg) => {
      if (msg.conversation_id === Number(conversationId)) {
        setMessages((prev) => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
      }
    });

    s.on("typing:start", ({ userId, name }) => {
      if (userId !== meId) {
        setIsTyping(true);
        setTypingUser(name || "Someone");
      }
    });

    s.on("typing:stop", ({ userId }) => {
      if (userId !== meId) {
        setIsTyping(false);
        setTypingUser(null);
      }
    });

    return () => s.disconnect();
  }, [conversationId]);

  // 5) send (unchanged)
  const send = async () => {
    const body = text.trim();
    if (!body) return;

    try {
      const response = await fetch(`${config.API_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId: Number(conversationId), body })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // ✅ use the friendId we set from /api/conversations
  const handleProfile = () => {
    if (friendId) navigate(`/Profile/${friendId}`);
  };

  const handleTyping = () => {
    if (!socketRef.current) return;

    socketRef.current.emit("typing:start", { conversationId: Number(conversationId) });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { conversationId: Number(conversationId) });
    }, 1000);
  };

  return (
    <div className="privatechatdashbord-private-dashbord">
      <header className="privatechatdashbord-private-header">
        <img
          onClick={handleProfile}
          className="privatechatdashbord-profile"
          src={`${config.API_URL}${friend?.profile_image || "/uploads/default.png"}`}
          alt="profile"
          style={{ cursor: friendId ? "pointer" : "not-allowed", opacity: friendId ? 1 : 0.6 }}
          title={friendId ? "Open profile" : "Loading..."}
        />
        <div className="privatechatdashbord-username">
          {friend
            ? `${friend.first_name || ""} ${friend.last_name || ""}`.trim() || `User #${friendId}`
            : `Conversation #${conversationId}`}
        </div>
        <div className="privatechatdashbord-freind">✅</div>
      </header>

      <main className="privatechatdashbord-private-main">
        {messages.map((m) => {
          const mine = meId != null && Number(m.sender_id) === Number(meId);
          return (
            <div key={m.id} className="row">
              <div className={`msg ${mine ? "sent" : "received"} `}>
                <div>{m.body}</div>
                <small style={{ opacity: 0.7, fontSize: "0.75em", marginTop: "4px", display: "block" }}>
                  {new Date(m.created_at).toLocaleTimeString()}
                </small>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="row">
            <div className="msg received" style={{ fontStyle: "italic", opacity: 0.7 }}>
              {typingUser} is typing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="privatechatdashbord-private-footer">
        <input
          className="privatechatdashbord-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleTyping();
          }}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
        />
        <button className="privatechatdashbord-send" onClick={send}>Send</button>
      </footer>
    </div>
  );
}
