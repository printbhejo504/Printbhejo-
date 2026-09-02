import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, EyeOff, LogIn, LogOut, QrCode, User, X } from "lucide-react";
import { supabase } from "./config";
import "./auth-ui.css";

const getDisplayName = (user) => user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "PrintBhejo User";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("login");
  const [showAuth, setShowAuth] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [headerTarget, setHeaderTarget] = useState(null);

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset"); setShowAuth(true); setError(""); setMessage("");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const findHeader = () => setHeaderTarget(document.querySelector(".header"));
    findHeader();
    const t = setTimeout(findHeader, 0);
    return () => clearTimeout(t);
  }, [session]);

  useEffect(() => {
    if (session?.user) document.body.classList.add("pb-authenticated");
    else document.body.classList.remove("pb-authenticated");
    const syncTab = () => {
      const buttons = Array.from(document.querySelectorAll(".tabs button"));
      const target = buttons.find(b => session ? /receive/i.test(b.textContent || "") : /send/i.test(b.textContent || ""));
      if (target) target.click();
    };
    syncTab();
    const t = setTimeout(syncTab, 80);
    return () => { clearTimeout(t); document.body.classList.remove("pb-authenticated"); };
  }, [session]);

  const user = session?.user;
  const name = getDisplayName(user);
  const permanentUrl = useMemo(() => {
    if (!user) return "";
    const base = window.location.origin + window.location.pathname;
    return `${base}?receiver=${encodeURIComponent(user.id)}&name=${encodeURIComponent(name)}`;
  }, [user, name]);
  const qrUrl = useMemo(() => permanentUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=16&data=${encodeURIComponent(permanentUrl)}` : "", [permanentUrl]);

  function openAuth(nextMode = "login") {
    setMode(nextMode); setError(""); setMessage(""); setPassword(""); setShowPassword(false); setShowAuth(true);
  }

  async function login(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (!supabase) { setError("Supabase is not configured."); return; }
    if (!loginId.trim() || !password) { setError("Gmail/Email aur password dono enter karein."); return; }
    setBusy(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: loginId.trim(), password });
    setBusy(false);
    if (authError) { setError("Login ID ya password galat hai."); return; }
    setSession(data.session); setShowAuth(false); setPassword("");
  }

  async function signup(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (!supabase) { setError("Supabase is not configured."); return; }
    if (!loginId.trim() || !password) { setError("Gmail/Email aur password enter karein."); return; }
    if (password.length < 6) { setError("Password kam se kam 6 characters ka hona chahiye."); return; }
    setBusy(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: loginId.trim(), password,
      options: { data: { full_name: fullName.trim() } }
    });
    setBusy(false);
    if (authError) { setError(authError.message || "Account create nahi ho saka."); return; }
    if (data.session) { setSession(data.session); setShowAuth(false); }
    else { setMessage("Account ban gaya. Email inbox me verification link check karein, phir Login karein."); setMode("login"); }
    setPassword("");
  }

  async function googleLogin() {
    if (!supabase) { setError("Supabase is not configured."); return; }
    setError(""); setMessage(""); setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
    setBusy(false);
    if (authError) setError("Google login start nahi ho saka. Supabase me Google provider enable karein.");
  }

  async function forgotPassword(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (!supabase) { setError("Supabase is not configured."); return; }
    if (!loginId.trim()) { setError("Apna Gmail/Email enter karein."); return; }
    setBusy(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(loginId.trim(), { redirectTo: window.location.origin + window.location.pathname });
    setBusy(false);
    if (authError) { setError("Password reset email nahi bheja ja saka."); return; }
    setMessage("Password reset link aapke email par bhej diya gaya hai. Inbox/Spam check karein.");
  }

  async function resetPassword(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (!supabase || password.length < 6) { setError("New password kam se kam 6 characters ka hona chahiye."); return; }
    setBusy(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (authError) { setError(authError.message || "Password update nahi ho saka."); return; }
    setMessage("Password successfully change ho gaya. Ab aap PrintBhejo use kar sakte hain.");
    setPassword(""); setMode("login"); setShowAuth(false);
  }

  async function logout() { await supabase?.auth.signOut(); setSession(null); }

  async function downloadQr() {
    if (!qrUrl) return;
    try {
      const res = await fetch(qrUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `PrintBhejo-${name.replace(/[^a-z0-9_-]+/gi, "-")}-QR.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { window.open(qrUrl, "_blank", "noopener,noreferrer"); }
  }

  if (session === undefined) return <div className="auth-loading">PrintBhejo loading…</div>;

  const headerControls = !session ? (
    <button className="header-login-button" onClick={() => openAuth("login")}><LogIn size={18}/> Login</button>
  ) : (
    <div className="header-user-controls"><span className="header-user-name"><User size={17}/> {name}</span><span className="qr-first-badge"><QrCode size={15}/> Your QR</span><button onClick={logout}><LogOut size={16}/> Logout</button></div>
  );

  const authModal = showAuth && !session && mode !== "reset" ? (
    <div className="login-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowAuth(false)}>
      <div className="auth-card login-modal" role="dialog" aria-modal="true">
        <button className="login-close" onClick={() => setShowAuth(false)} aria-label="Close"><X size={20}/></button>
        <div className="auth-logo"><img src="/printbhejo-logo-new.png" alt="PrintBhejo" /></div>
        <h1>{mode === "signup" ? "Create PrintBhejo Account" : mode === "forgot" ? "Forgot Password" : "Login to PrintBhejo"}</h1>
        <p>{mode === "signup" ? "Apna Gmail/Email aur password se account banayein." : mode === "forgot" ? "Apna registered Gmail/Email enter karein." : "Login optional hai. Login karke permanent receiving QR dekhein."}</p>
        {mode === "forgot" ? (
          <form onSubmit={forgotPassword}>
            <label>Gmail / Email<input type="email" value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="email" placeholder="you@gmail.com" /></label>
            {error && <div className="auth-error">{error}</div>}{message && <div className="auth-message">{message}</div>}
            <button className="auth-primary" disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button>
            <button type="button" className="auth-link-button" onClick={() => openAuth("login")}>← Back to Login</button>
          </form>
        ) : (
          <>
            {mode === "login" && <button type="button" className="google-button" onClick={googleLogin} disabled={busy}><span className="google-g">G</span> Continue with Google</button>}
            {mode === "login" && <div className="auth-divider"><span>or</span></div>}
            <form onSubmit={mode === "signup" ? signup : login}>
              {mode === "signup" && <label>Name<input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>}
              <label>Gmail / Email<input type="email" value={loginId} onChange={e => setLoginId(e.target.value)} autoComplete="email" placeholder="you@gmail.com" /></label>
              <label>Password<div className="password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Enter password" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label="Show password">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
              {error && <div className="auth-error">{error}</div>}{message && <div className="auth-message">{message}</div>}
              <button className="auth-primary" disabled={busy}>{busy ? (mode === "signup" ? "Creating…" : "Logging in…") : (mode === "signup" ? "Create Account →" : "Login →")}</button>
            </form>
            {mode === "login" ? <div className="auth-actions"><button className="auth-link-button" onClick={() => openAuth("forgot")}>Forgot Password?</button><button className="auth-link-button" onClick={() => openAuth("signup")}>Create New Account</button></div> : <div className="auth-actions"><button className="auth-link-button" onClick={() => openAuth("login")}>Already have an account? Login</button></div>}
          </>
        )}
        <small>Without login bhi file transfer normally kaam karega.</small>
      </div>
    </div>
  ) : null;

  const resetModal = showAuth && mode === "reset" ? (
    <div className="login-modal-backdrop"><div className="auth-card login-modal" role="dialog" aria-modal="true"><div className="auth-logo"><img src="/printbhejo-logo-new.png" alt="PrintBhejo" /></div><h1>Set New Password</h1><p>Apna naya password set karein.</p><form onSubmit={resetPassword}><label>New Password<div className="password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="New password" /><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{error && <div className="auth-error">{error}</div>}{message && <div className="auth-message">{message}</div>}<button className="auth-primary" disabled={busy}>{busy ? "Saving…" : "Save New Password"}</button></form></div></div>
  ) : null;

  return <>
    {headerTarget && createPortal(headerControls, headerTarget)}
    {session && <div className="permanent-qr-panel pb-qr-first"><div><span className="qr-badge">PERMANENT QR</span><h2>{name}</h2><p>Ye aapka permanent receiving QR hai. Isse koi bhi person bina login kiye aapko file bhej sakta hai.</p><code>{permanentUrl}</code></div><img src={qrUrl} alt={`Permanent QR for ${name}`}/><button onClick={downloadQr}><Download size={17}/> Download QR</button></div>}
    {children}
    {authModal}{resetModal}
  </>;
}
