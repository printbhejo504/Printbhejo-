import React, { useEffect, useMemo, useState } from "react";
import { Download, LogOut, QrCode, User } from "lucide-react";
import { supabase } from "./config";
import "./auth-ui.css";

const getDisplayName = (user) => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "PrintBhejo User";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined), [loginId, setLoginId] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [showQr, setShowQr] = useState(false);
  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);
  const user = session?.user, name = getDisplayName(user);
  const permanentUrl = useMemo(() => { if (!user) return ""; const base = window.location.origin + window.location.pathname; return `${base}?receiver=${encodeURIComponent(user.id)}&name=${encodeURIComponent(name)}`; }, [user, name]);
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
  }
  async function logout() { await supabase?.auth.signOut(); setSession(null); }
  async function downloadQr() {
    if (!qrUrl) return;
    try { const res = await fetch(qrUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `PrintBhejo-${name.replace(/[^a-z0-9_-]+/gi, "-")}-QR.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch { window.open(qrUrl, "_blank", "noopener,noreferrer"); }
  }
  if (session === undefined) return <div className="auth-loading">PrintBhejo loading…</div>;
  if (!session) return <div className="auth-screen"><div className="auth-card"><div className="auth-logo"><img src="/printbhejo-logo-new.png" alt="PrintBhejo" /></div><h1>PrintBhejo</h1><p>Login karke apna permanent receiving QR use karein.</p><form onSubmit={login}><label>Login ID<input value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="username" placeholder="Enter Login ID" /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter Password" /></label>{error&&<div className="auth-error">{error}</div>}<button className="auth-primary" disabled={busy}>{busy?"Logging in…":"Login →"}</button></form><small>Only authorized users can login. No public signup.</small></div></div>;
  return <><div className="user-bar"><div className="user-identity"><User size={18}/><span>{name}</span></div><button onClick={()=>setShowQr(v=>!v)}><QrCode size={17}/> My Permanent QR</button><button onClick={logout}><LogOut size={17}/> Logout</button></div>{showQr&&<div className="permanent-qr-panel"><div><span className="qr-badge">PERMANENT QR</span><h2>{name}</h2><p>Is QR ko ek baar save/print karke rakhein. QR ke andar aapka naam aur user identity saved hai.</p><code>{permanentUrl}</code></div><img src={qrUrl} alt={`Permanent QR for ${name}`}/><button onClick={downloadQr}><Download size={17}/> Download QR</button></div>}{children}</>;
}
