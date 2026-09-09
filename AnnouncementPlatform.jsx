import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./config";

const typeLabel = (type) => type === "vacancy" ? "🆕 New Vacancy" : "🎫 Admit Card";
const actionLabel = (type) => type === "vacancy" ? "Apply Now" : "Check Admit Card";

function shareWhatsApp(item) {
  const printBhejo = window.location.origin + "/";
  const text = `${item.title}\n\n${item.description || "Official update"}\n\n${actionLabel(item.type)}: ${item.url}\n\nMore updates: ${printBhejo}\nShared via PrintBhejo`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function PublicAnnouncements() {
  const [type, setType] = useState("vacancy");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from("announcement_links").select("id,type,title,description,url,logo_url,created_at").eq("type", type).eq("active", true).order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!supabase) return;
    const channel = supabase.channel("announcement-links-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcement_links" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [type]);

  return <section className="pb-announcements-public" aria-label="PrintBhejo announcements">
    <div className="pb-announcement-head">
      <div><h2>📢 Latest Updates</h2><p>Official vacancy aur admit card links</p></div>
      <div className="pb-announcement-tabs">
        <button className={type === "vacancy" ? "active" : ""} onClick={() => setType("vacancy")}>🆕 New Vacancy</button>
        <button className={type === "admit_card" ? "active" : ""} onClick={() => setType("admit_card")}>🎫 Admit Card</button>
      </div>
    </div>
    {loading ? <div className="pb-announcement-empty">Loading...</div> : !items.length ? <div className="pb-announcement-empty">Abhi koi {type === "vacancy" ? "new vacancy" : "admit card"} update available nahi hai.</div> : <div className="pb-announcement-grid">
      {items.map(item => <article className="pb-announcement-card" key={item.id}>
        {item.logo_url && <img src={item.logo_url} alt="" className="pb-announcement-logo" />}
        <div className="pb-announcement-tag">{typeLabel(item.type)}</div>
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
        <div className="pb-announcement-actions">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="pb-announcement-primary">{actionLabel(item.type)} ↗</a>
          <button onClick={() => shareWhatsApp(item)} className="pb-announcement-whatsapp">Share on WhatsApp</button>
        </div>
      </article>)}
    </div>}
  </section>;
}

function AdminAnnouncements() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ type: "vacancy", title: "", description: "", url: "", logo_url: "", active: true });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("announcement_links").select("id,type,title,description,url,logo_url,active,created_at").order("created_at", { ascending: false });
    setItems(data || []);
  };
  useEffect(() => {
    load();
    if (!supabase) return;
    const channel = supabase.channel("announcement-links-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcement_links" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!supabase || !form.title.trim() || !form.url.trim()) return;
    setBusy(true); setMessage("");
    const payload = { type: form.type, title: form.title.trim(), description: form.description.trim() || null, url: form.url.trim(), logo_url: form.logo_url.trim() || null, active: !!form.active };
    const result = editing
      ? await supabase.from("announcement_links").update(payload).eq("id", editing)
      : await supabase.from("announcement_links").insert(payload);
    if (result.error) setMessage(result.error.message); else {
      setMessage(editing ? "Update saved." : "Announcement added.");
      setForm({ type: "vacancy", title: "", description: "", url: "", logo_url: "", active: true });
      setEditing(null); await load();
    }
    setBusy(false);
  };

  const edit = (item) => { setEditing(item.id); setForm({ type: item.type, title: item.title || "", description: item.description || "", url: item.url || "", logo_url: item.logo_url || "", active: item.active !== false }); };
  const remove = async (id) => { if (!confirm("Delete this announcement?")) return; const { error } = await supabase.from("announcement_links").delete().eq("id", id); if (error) setMessage(error.message); else load(); };
  const toggle = async (item) => { const { error } = await supabase.from("announcement_links").update({ active: !item.active }).eq("id", item.id); if (error) setMessage(error.message); };

  return <section className="pb-announcements-admin">
    <div className="pb-admin-announcement-title"><div><h2>📢 Announcements</h2><p>New Vacancy aur Admit Card ke official links manage karein.</p></div></div>
    <form onSubmit={save} className="pb-announcement-form">
      <div className="pb-form-row">
        <label>Type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="vacancy">🆕 New Vacancy</option><option value="admit_card">🎫 Admit Card</option></select></label>
        <label>Title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Exam / recruitment name" /></label>
      </div>
      <label>Short Details<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short official details" rows="3" /></label>
      <label>Official URL<input required type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://official-website.gov.in/..." /></label>
      <label>Logo URL (optional)<input type="url" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></label>
      <label className="pb-check"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active on public page</label>
      <div className="pb-form-actions"><button className="pb-save" disabled={busy}>{busy ? "Saving..." : editing ? "Save Changes" : "Add Announcement"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm({ type: "vacancy", title: "", description: "", url: "", logo_url: "", active: true }); }}>Cancel</button>}</div>
      {message && <small className="pb-admin-message">{message}</small>}
    </form>
    <div className="pb-admin-announcement-list">{items.map(item => <div className="pb-admin-announcement-item" key={item.id}><div><strong>{typeLabel(item.type)} — {item.title}</strong><span>{item.description || item.url}</span></div><div className="pb-item-actions"><button onClick={() => toggle(item)}>{item.active ? "Active" : "Inactive"}</button><button onClick={() => edit(item)}>Edit</button><button onClick={() => remove(item.id)} className="danger">Delete</button></div></div>)}</div>
  </section>;
}

function styles() {
  if (document.getElementById("pb-announcement-styles")) return;
  const style = document.createElement("style"); style.id = "pb-announcement-styles";
  style.textContent = `.pb-announcements-public,.pb-announcements-admin{margin:24px auto;max-width:1100px;padding:20px;border:1px solid rgba(127,127,127,.18);border-radius:18px;background:rgba(255,255,255,.72);box-sizing:border-box}.pb-announcement-head,.pb-admin-announcement-title{display:flex;justify-content:space-between;gap:18px;align-items:center}.pb-announcement-head h2,.pb-admin-announcement-title h2{margin:0 0 5px}.pb-announcement-head p,.pb-admin-announcement-title p{margin:0;opacity:.7}.pb-announcement-tabs{display:flex;gap:8px;flex-wrap:wrap}.pb-announcement-tabs button,.pb-item-actions button,.pb-form-actions button{border:1px solid #d1d5db;background:#fff;border-radius:10px;padding:9px 12px;cursor:pointer}.pb-announcement-tabs button.active,.pb-save{background:#111827!important;color:#fff;border-color:#111827!important}.pb-announcement-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:18px}.pb-announcement-card{padding:17px;border:1px solid rgba(127,127,127,.18);border-radius:15px;background:#fff}.pb-announcement-logo{width:46px;height:46px;object-fit:contain;border-radius:9px;float:right}.pb-announcement-tag{font-size:12px;font-weight:700;opacity:.7}.pb-announcement-card h3{margin:8px 0}.pb-announcement-card p{white-space:pre-wrap;line-height:1.45;opacity:.8}.pb-announcement-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.pb-announcement-primary,.pb-announcement-whatsapp{border:0;border-radius:10px;padding:10px 13px;text-decoration:none;cursor:pointer;font-weight:600}.pb-announcement-primary{background:#111827;color:#fff}.pb-announcement-whatsapp{background:#e8f7ed;color:#176b36}.pb-announcement-empty{text-align:center;padding:25px;opacity:.65}.pb-announcement-form{margin-top:18px;display:grid;gap:12px}.pb-form-row{display:grid;grid-template-columns:180px 1fr;gap:12px}.pb-announcement-form label{display:grid;gap:6px;font-weight:600;font-size:13px}.pb-announcement-form input,.pb-announcement-form textarea,.pb-announcement-form select{font:inherit;padding:10px;border:1px solid #d1d5db;border-radius:9px;box-sizing:border-box;width:100%;background:#fff}.pb-check{display:flex!important;align-items:center;grid-template-columns:auto 1fr}.pb-check input{width:auto}.pb-form-actions{display:flex;gap:8px}.pb-admin-message{color:#166534}.pb-admin-announcement-list{display:grid;gap:8px;margin-top:20px}.pb-admin-announcement-item{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border:1px solid rgba(127,127,127,.18);border-radius:12px}.pb-admin-announcement-item span{display:block;opacity:.65;font-size:12px;margin-top:3px}.pb-item-actions{display:flex;gap:6px;flex-wrap:wrap}.pb-item-actions .danger{color:#b91c1c}@media(max-width:650px){.pb-announcement-head,.pb-admin-announcement-title,.pb-admin-announcement-item{align-items:stretch;flex-direction:column}.pb-form-row{grid-template-columns:1fr}.pb-announcements-public,.pb-announcements-admin{margin:14px 10px;padding:14px}}`;
  document.head.appendChild(style);
}

export function mountAnnouncementPlatform(mode, element) {
  styles();
  const root = createRoot(element);
  root.render(mode === "admin" ? <AdminAnnouncements /> : <PublicAnnouncements />);
  return root;
}

export default function AnnouncementPlatform({ mode }) { return mode === "admin" ? <AdminAnnouncements /> : <PublicAnnouncements />; }
