import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import "../css/signup.css";
import config from "../config.js";


export default function Signup() {
  const navigate = useNavigate();

  // Consolidated form state
  const [userInfo, setUserInfo] = useState({
    fname: "",
    lname: "",
    age: "",
    gender: "",
    phone: "",
    email: "",
    password: "",
    imageFile: null,
  });

  // Error message shown above the submit button
  const [submitError, setSubmitError] = useState("");

  // Generic change handler for text inputs
  const onChange = (key) => (e) => {
    const value = e.target.value;
    setUserInfo((prev) => ({ ...prev, [key]: value }));
  };

  // Capture selected file for profile photo
  const onFile = (e) => {
    const file = e.target.files?.[0] || null;
    setUserInfo((prev) => ({ ...prev, imageFile: file }));
  };

  // Perform upload logic and register
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    // Validate (simplified)
    if (!userInfo.fname.trim() || !userInfo.lname.trim() || !userInfo.email || !userInfo.password) {
      setSubmitError("Please fill all required fields.");
      return;
    }

    // 1. Upload Image (if selected)
    let profileImageUrl = "";
    if (userInfo.imageFile) {
      try {
        // A. Get Signed URL
        const uploadRes = await fetch(`${config.API_URL}/api/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: userInfo.imageFile.name,
            filetype: userInfo.imageFile.type
          })
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.ok) throw new Error(uploadData.error || "Failed to get upload URL");

        // B. Upload to Supabase Storage
        const putRes = await fetch(uploadData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": userInfo.imageFile.type },
          body: userInfo.imageFile
        });
        if (!putRes.ok) throw new Error("Failed to upload image to storage");

        profileImageUrl = uploadData.publicUrl;
      } catch (err) {
        console.error("Upload failed:", err);
        setSubmitError("Failed to upload profile photo. Try again.");
        return;
      }
    }

    // 2. Register User
    try {
      const resp = await fetch(`${config.API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fname: userInfo.fname,
          lname: userInfo.lname,
          email: userInfo.email,
          password: userInfo.password,
          age: userInfo.age,
          gender: userInfo.gender,
          phone: userInfo.phone,
          profile_image: profileImageUrl // Send URL string
        }),
        credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok || data?.ok === false) {
        setSubmitError(data?.error || "Registration failed");
        return;
      }
      // Navigate to login on success
      navigate("/login");
    } catch (err) {
      console.error(err);
      setSubmitError("Network error. Please try again.");
    }
  };

  return (
    <main className="signup-shell">
      <form className="signup-card" onSubmit={handleSubmit}>
        {/* Logo */}
        <div className="signup-logo">
          <img src="./img-login.png" alt="Ping Logo" />
        </div>

        {/* Subtitle */}
        <p className="signup-subtitle">Create your account</p>

        {/* Name inputs */}
        <div className="signup-grid-2">
          <input
            className="signup-input"
            type="text"
            placeholder="First name"
            value={userInfo.fname}
            onChange={onChange("fname")}
            required
          />
          <input
            className="signup-input"
            type="text"
            placeholder="Last name"
            value={userInfo.lname}
            onChange={onChange("lname")}
            required
          />
        </div>

        {/* Phone and age inputs */}
        <div className="signup-grid-2">
          <input
            className="signup-input"
            type="tel"
            placeholder="Phone number"
            value={userInfo.phone}
            onChange={onChange("phone")}
            required
          />
          <input
            className="signup-input"
            type="number"
            min="1"
            placeholder="Age"
            value={userInfo.age}
            onChange={onChange("age")}
            required
          />
        </div>

        {/* Gender radio buttons */}
        <div className="signup-gender">
          <label>
            <input
              type="radio"
              name="gender"
              value="male"
              checked={userInfo.gender === "male"}
              onChange={onChange("gender")}
            />
            <span>Male</span>
          </label>
          <label>
            <input
              type="radio"
              name="gender"
              value="female"
              checked={userInfo.gender === "female"}
              onChange={onChange("gender")}
            />
            <span>Female</span>
          </label>
          <label>
            <input
              type="radio"
              name="gender"
              value="other"
              checked={userInfo.gender === "other"}
              onChange={onChange("gender")}
            />
            <span>Other</span>
          </label>
        </div>

        {/* Email and password */}
        <input
          className="signup-input"
          type="email"
          placeholder="Email"
          value={userInfo.email}
          onChange={onChange("email")}
          required
        />
        <input
          className="signup-input"
          type="password"
          placeholder="Password (8+ chars, uppercase & number)"
          value={userInfo.password}
          onChange={onChange("password")}
          required
        />

        {/* File upload */}
        <label className="signup-file">
          <input type="file" accept="image/*" onChange={onFile} />
          <span>{userInfo.imageFile?.name || "Choose profile photo"}</span>
        </label>

        {/* Submit button */}
        <button className="signup-btn" type="submit">
          Create Account
        </button>
        {submitError && <p className="signup-error">{submitError}</p>}

        {/* Bottom links */}
        <div className="signup-links">
          <Link to="/login">Already have an account? Sign in</Link>
          <span />
        </div>
      </form>
    </main>
  );
}