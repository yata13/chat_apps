// src/links/Profile.jsx
import "../css/profile.css";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import config from "../config";

function Profile() {
  const { userId } = useParams(); // undefined when embedded (toggle)
  const navigate = useNavigate();
  const [u, setU] = useState(null);
  const [err, setErr] = useState(null);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();

    async function load() {
      try {
        setErr(null);
        setU(null);

        if (!userId) {
          const r = await fetch(`${config.API_URL}/api/me`, { credentials: "include", signal: ctrl.signal });
          if (!r.ok) throw new Error(`Failed: ${r.status}`);
          const d = await r.json();
          if (alive) {
            setU(d.user || d);
            setIsSelf(true);
          }
          return;
        }

        const [rUser, rMe] = await Promise.all([
          fetch(`${config.API_URL}/api/users/${userId}`, { credentials: "include", signal: ctrl.signal }),
          fetch(`${config.API_URL}/api/me`, { credentials: "include", signal: ctrl.signal }),
        ]);

        if (!rUser.ok) throw new Error(`User ${userId} not found`);
        const dUser = await rUser.json();
        const dMe = rMe.ok ? await rMe.json() : {};
        if (alive) {
          const me = dMe.user || dMe;
          setU(dUser.user);
          setIsSelf(me?.id != null && Number(me.id) === Number(userId));
        }
      } catch (e) {
        if (alive) setErr(e.message || "Failed to load profile");
      }
    }

    load();
    return () => { alive = false; ctrl.abort(); };
  }, [userId]);

  const deleteAccount = async () => {
    if (!isSelf) return;

    const yes = window.confirm("Delete your account permanently? This cannot be undone.");
    if (!yes) return;

    try {
      let r = await fetch(`${config.API_URL}/api/me`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!r.ok) throw new Error(`Delete failed: ${r.status}`);
      navigate("/signup");

    } catch (e) {
      setErr(e.message || "Delete failed");
    }
  };

  if (err) return <div style={{ padding: 16 }}>Error: {err}</div>;
  if (!u) return <div style={{ padding: 16 }}>Loading...</div>;

  const handleBack = () => {
    navigate(-1)
  }
  return (
    <section className='profile-contaner'>
      <div className='profile-header-div profile-info-card'>
        <img className='profile-img' src={`${config.API_URL}${u.profile_image || "/uploads/default.png"}`} width={96} height={96} alt="" />
        <h2 className='profile-name'>{u.first_name} {u.last_name}</h2>
      </div>

      <div className='profile-main-div profile-info-card'>
        {u.phone_number && <p>Phone: {u.phone_number}</p>}
        <p>Email: {u.email}</p>
        {u.age != null && <p>Age: {u.age}</p>}
        {u.gender && <p>Gender: {u.gender}</p>}
      </div>

      {/* ✅ Only show for self */}
      {isSelf && (
        <div className='profile-footer-div profile-info-card'>
          <p>about aplication: made by Xybery</p>
          <p>Help/FAQ</p>

          <button className='profile-delete-btn' onClick={deleteAccount}>
            Delete Acount
          </button>
        </div>
      )}

      {!isSelf &&
        (<button className="profile-back-btn" onClick={handleBack}>⬅ back</button>)
      }
    </section>
  );
}

export default Profile;
