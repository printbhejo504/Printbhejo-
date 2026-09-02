import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, LogIn, LogOut, QrCode, User, X } from "lucide-react";
import { supabase } from "./config";
import "./auth-ui.css";

const getDisplayName = (user) => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "PrintBhejo User";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) document.body.classList.add("pb-authenticated");
    else document.body.classList.remove("pb-authenticated");
    return () => document.body.classList.remove("pb-authenticated");
  }, [session]);

  const user = session?.user;
  const name = getDisplayName(user);
  const permanentUrl = useMemo(() => {
    if (!user) return "";
    const base = window.location.origin + window.location.pathname;
    return `${base}?receiver=${encodeURIComponent(user.id)}&name=${encodeURIComponent(name)}`;
  }, [user, name]);
  const qrUrl = useMemo(() => permanentUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=16&data=${encodeURIComponent(permanentUrl)}` : "", [permanentUrl]);

  async function login(e) {
    e.preventDefault(); setError("");
    if (!supabase) { setError("Supabase is not configured."); return; }
    if (!loginId.trim() || !password) { setError("Login ID aur password dono enter karein."); return; }
    setBusy(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: loginId.trim(), password });
    setBusy(false);
    if (authError) { setError("Login ID ya password galat hai."); return; }
    setSession(data.session);
    setShowLogin(false);
    setPassword("");
  }

  async function logout() { await supabase?.auth.signOut(); setSession(null); }

  async function downloadQr() {
    if (!qrUrl) return;
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PrintBhejo-${name.replace(/[^a-z0-9_-]+/gi, "-")}-QR.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { window.open(qrUrl, "_blank", "noopener,noreferrer"); }
  }

  if (session === undefined) return <div className="auth-loading">PrintBhejo loading…</div>;

  const headerControls = !session ? (
    <button className="header-login-button" onClick={() => { setError(""); setShowLogin(true); }}><LogIn size={18}/> Login</button>
  ) : (
    <div className="header-user-controls"><span className="header-user-name"><User size={17}/> {name}</span><span className="qr-first-badge"><QrCode size={15}/> Your QR</span><button onClick={logout}><LogOut size={16}/> Logout</button></div>
  );

  return <>
    {createPortal(headerControls, document.querySelector(".header") || document.body)}
    {session && <div className="permanent-qr-panel pb-qr-first"><div><span className="qr-badge">PERMANENT QR</span><h2>{name}</h2><p>Ye aapka permanent receiving QR hai. Isse koi bhi person bina login kiye aapko file bhej sakta hai.</p><code>{permanentUrl}</code></div><img src={qrUrl} alt={`Permanent QR for ${name}`}/><button onClick={downloadQr}><Download size={17}/> Download QR</button></div>}
    {children}
    {!session && showLogin && <div className="login-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowLogin(false)}><div className="auth-card login-modal" role="dialog" aria-modal="true"><button className="login-close" onClick={() => setShowLogin(false)} aria-label="Close"><X size={20}/></button><div className="auth-logo"><img src="/printbhejo-logo-new.png" alt="PrintBhejo" /></div><h1>Login to PrintBhejo</h1><p>Login optional hai. Login karke apna permanent QR dekhein.</p><form onSubmit={login}><label>Login ID<input value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="username" placeholder="Enter Login ID" /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter Password" /></label>{error && <div className="auth-error">{error}</div>}<button className="auth-primary" disabled={busy}>{busy ? "Logging in…" : "Login →"}</button></form><small>Without login bhi file transfer normally kaam karega.</small></div></div>}
  </>;
}
