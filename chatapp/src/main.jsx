// src/main.jsx
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./css/index.css";

import App from "./App.jsx";
import ChatDashbord from "./links/ChatDashbord.jsx";
import PrivateChatDashbord from "./links/PrivateChatDashbord.jsx";
import Profile from "./links/Profile.jsx";
import Login from "./links/Login.jsx";
import Signup from "./links/Signup.jsx";
import GroupInfo from "./links/GroupInfo.jsx";

import { AuthProvider } from "./auth/authContext.jsx";
import { RequireAuth, PublicOnly } from "./auth/RouteGuards.jsx";

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<App />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />

        {/* PRIVATE */}
        <Route path="/chatdashbord" element={<RequireAuth><ChatDashbord /></RequireAuth>} />
        <Route path="/chat/:conversationId" element={<RequireAuth><PrivateChatDashbord /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/profile/:userId" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/group/:conversationId" element={<RequireAuth><GroupInfo /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);
