import React, { useEffect, useState } from "react";
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
      <div className="pb-announcement-heading-copy"><div className="pb-announcement-kicker"><span className="pb-live-dot" /> PRINTBHEJO UPDATES</div><h2>📢 Latest Updates</h2><p>Official vacancy aur admit card links — ek hi jagah.</p></div>
      <div className="pb-announcement-tabs" role="tablist">
        <button className={type === "vacancy" ? "active" : ""} onClick={() => setType("vacancy")} role="tab" aria-selected={type === "vacancy"}>🆕 <span>New Vacancy</span></button>
        <button className={type === "admit_card" ? "active" : ""} onClick={() => setType("admit_card")} role="tab" aria-selected={type === "admit_card"}>🎫 <span>Admit Card</span></button>
      </div>
    </div>
    {loading ? <div className="pb-announcement-empty"><span className="pb-spinner" /> Loading latest updates...</div> : !items.length ? <div className="pb-announcement-empty"><div className="pb-empty-icon">📭</div><strong>Abhi koi {type === "vacancy" ? "new vacancy" : "admit card"} update nahi hai</strong><span>New official updates yahan automatically appear honge.</span></div> : <div className="pb-announcement-grid">
      {items.map(item => <article className="pb-announcement-card" key={item.id}>
        <div className="pb-card-top"><div className="pb-announcement-tag">{typeLabel(item.type)}</div>{item.logo_url ? <img src={item.logo_url} alt="" className="pb-announcement-logo" /> : <div className="pb-announcement-logo-placeholder">PB</div>}</div>
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
        <div className="pb-card-divider" />
        <div className="pb-announcement-actions">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="pb-announcement-primary">{actionLabel(item.type)} <span>↗</span></a>
          <button onClick={() => shareWhatsApp(item)} className="pb-announcement-whatsapp"><span>◉</span> WhatsApp</button>
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
    const result = editing ? await supabase.from("announcement_links").update(payload).eq("id", editing) : await supabase.from("announcement_links").insert(payload);
    if (result.error) setMessage(result.error.message); else { setMessage(editing ? "Update saved." : "Announcement added."); setForm({ type: "vacancy", title: "", description: "", url: "", logo_url: "", active: true }); setEditing(null); await load(); }
    setBusy(false);
  };
  const edit = (item) => { setEditing(item.id); setForm({ type: item.type, title: item.title || "", description: item.description || "", url: item.url || "", logo_url: item.logo_url || "", active: item.active !== false }); };
  const remove = async (id) => { if (!confirm("Delete this announcement?")) return; const { error } = await supabase.from("announcement_links").delete().eq("id", id); if (error) setMessage(error.message); else load(); };
  const toggle = async (item) => { const { error } = await supabase.from("announcement_links").update({ active: !item.active }).eq("id", item.id); if (error) setMessage(error.message); else load(); };
  const reset = () => { setEditing(null); setForm({ type: "vacancy", title: "", description: "", url: "", logo_url: "", active: true }); setMessage(""); };

  return <section className="pb-announcements-admin">
    <div className="pb-admin-announcement-title"><div><div className="pb-admin-kicker">CONTENT CONTROL</div><h2>📢 Announcements</h2><p>New Vacancy aur Admit Card ke official links manage karein.</p></div><div className="pb-admin-count"><strong>{items.length}</strong><span>Total updates</span></div></div>
    <form onSubmit={save} className="pb-announcement-form">
      <div className="pb-form-section-title">{editing ? "Edit update" : "Create new update"}</div>
      <div className="pb-form-row">
        <label>Type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="vacancy">🆕 New Vacancy</option><option value="admit_card">🎫 Admit Card</option></select></label>
        <label>Title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Exam / recruitment name" /></label>
      </div>
      <label>Short Details<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short official details" rows="3" /></label>
      <label>Official URL<input required type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://official-website.gov.in/..." /></label>
      <label>Logo URL <span className="pb-optional">Optional</span><input type="url" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></label>
      <label className="pb-check"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /><span>Show this update on public page</span></label>
      <div className="pb-form-actions"><button className="pb-save" disabled={busy}>{busy ? "Saving..." : editing ? "✓ Save Changes" : "+ Add Announcement"}</button>{editing && <button type="button" onClick={reset}>Cancel</button>}</div>
      {message && <small className="pb-admin-message">{message}</small>}
    </form>
    <div className="pb-admin-announcement-list">{items.map(item => <div className="pb-admin-announcement-item" key={item.id}><div className="pb-admin-item-main"><span className={`pb-admin-type ${item.type === "vacancy" ? "vacancy" : "admit"}`}>{typeLabel(item.type)}</span><strong>{item.title}</strong><span className="pb-admin-item-desc">{item.description || item.url}</span></div><div className="pb-item-actions"><button onClick={() => toggle(item)} className={item.active ? "status-active" : "status-inactive"}>{item.active ? "● Live" : "○ Hidden"}</button><button onClick={() => edit(item)}>Edit</button><button onClick={() => remove(item.id)} className="danger">Delete</button></div></div>)}</div>
  </section>;
}

function styles() {
  if (document.getElementById("pb-announcement-styles")) return;
  const style = document.createElement("style"); style.id = "pb-announcement-styles";
  style.textContent = `.pb-announcements-public,.pb-announcements-admin{margin:26px auto;max-width:1120px;padding:24px;border:1px solid rgba(148,163,184,.2);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(247,250,255,.88));box-shadow:0 16px 45px rgba(30,41,59,.07);box-sizing:border-box}.pb-announcement-head,.pb-admin-announcement-title{display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.pb-announcement-kicker,.pb-admin-kicker{font-size:10px;letter-spacing:1.6px;font-weight:850;color:#3568dc;margin-bottom:6px}.pb-live-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#2dbb78;box-shadow:0 0 0 4px #2dbb7820;margin-right:7px}.pb-announcement-head h2,.pb-admin-announcement-title h2{margin:0 0 6px;font-size:27px;letter-spacing:-.6px;color:#111827}.pb-announcement-head p,.pb-admin-announcement-title p{margin:0;color:#718096;font-size:14px}.pb-announcement-tabs{display:flex;gap:6px;padding:5px;border:1px solid #e3e9f2;border-radius:14px;background:#f4f7fb}.pb-announcement-tabs button{border:0;background:transparent;color:#667085;border-radius:10px;padding:10px 13px;cursor:pointer;font-weight:750;transition:.18s ease;white-space:nowrap}.pb-announcement-tabs button.active{background:#fff;color:#1f5edb;box-shadow:0 4px 13px rgba(30,64,175,.1)}.pb-announcement-tabs button:hover{color:#1f5edb}.pb-announcement-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:16px;margin-top:22px}.pb-announcement-card{position:relative;overflow:hidden;padding:19px;border:1px solid #e4e9f1;border-radius:19px;background:#fff;box-shadow:0 8px 25px rgba(30,41,59,.055);transition:transform .18s ease,box-shadow .18s ease}.pb-announcement-card:before{content:"";position:absolute;left:0;top:0;right:0;height:3px;background:linear-gradient(90deg,#2563eb,#60a5fa)}.pb-announcement-card:hover{transform:translateY(-2px);box-shadow:0 13px 30px rgba(30,41,59,.09)}.pb-card-top{display:flex;justify-content:space-between;align-items:flex-start;min-height:48px}.pb-announcement-logo,.pb-announcement-logo-placeholder{width:46px;height:46px;object-fit:contain;border-radius:12px;flex:0 0 46px}.pb-announcement-logo{background:#f7f9fc;border:1px solid #edf0f4}.pb-announcement-logo-placeholder{display:grid;place-items:center;background:#eef4ff;color:#2f66d6;font-size:12px;font-weight:900}.pb-announcement-tag{display:inline-flex;align-items:center;border-radius:999px;padding:6px 9px;background:#eff5ff;color:#2f63c8;font-size:11px;font-weight:850}.pb-announcement-card h3{margin:13px 0 7px;font-size:18px;line-height:1.25;color:#172033}.pb-announcement-card p{margin:0;white-space:pre-wrap;line-height:1.5;color:#697586;font-size:13px;min-height:40px}.pb-card-divider{height:1px;background:#edf0f4;margin:16px 0 13px}.pb-announcement-actions{display:flex;gap:8px}.pb-announcement-primary,.pb-announcement-whatsapp{border:0;border-radius:11px;padding:10px 12px;text-decoration:none;cursor:pointer;font-weight:750;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:6px}.pb-announcement-primary{background:#2563eb;color:#fff;flex:1;box-shadow:0 6px 15px rgba(37,99,235,.17)}.pb-announcement-primary:hover{background:#1d4ed8}.pb-announcement-whatsapp{background:#edf9f1;color:#18703b}.pb-announcement-empty{text-align:center;padding:35px 15px;color:#6b7280;display:flex;flex-direction:column;align-items:center;gap:7px}.pb-empty-icon{font-size:28px}.pb-spinner{width:22px;height:22px;border:3px solid #dbe5f6;border-top-color:#2563eb;border-radius:50%;animation:pbspin .8s linear infinite}@keyframes pbspin{to{transform:rotate(360deg)}}.pb-admin-count{min-width:82px;text-align:center;padding:9px 13px;border:1px solid #e3e9f2;border-radius:13px;background:#f8faff}.pb-admin-count strong{display:block;font-size:19px;color:#2563eb}.pb-admin-count span{display:block;font-size:10px;color:#8a94a6}.pb-announcement-form{margin-top:20px;display:grid;gap:13px;padding:19px;border:1px solid #e4e9f1;border-radius:18px;background:#f9fbff}.pb-form-section-title{font-size:13px;font-weight:850;color:#344054;margin-bottom:1px}.pb-form-row{display:grid;grid-template-columns:180px 1fr;gap:13px}.pb-announcement-form label{display:grid;gap:6px;font-weight:700;font-size:12px;color:#475467}.pb-announcement-form input,.pb-announcement-form textarea,.pb-announcement-form select{font:inherit;padding:11px 12px;border:1px solid #dbe2ec;border-radius:11px;box-sizing:border-box;width:100%;background:#fff;color:#172033;outline:none}.pb-announcement-form input:focus,.pb-announcement-form textarea:focus,.pb-announcement-form select:focus{border-color:#5b83e8;box-shadow:0 0 0 3px rgba(37,99,235,.09)}.pb-optional{font-weight:500;color:#98a2b3;margin-left:3px}.pb-check{display:flex!important;align-items:center;grid-template-columns:auto 1fr;gap:9px!important}.pb-check input{width:auto}.pb-form-actions{display:flex;gap:8px}.pb-form-actions button{border:1px solid #d8e0eb;border-radius:10px;padding:10px 14px;background:#fff;color:#475467;font-weight:750;cursor:pointer}.pb-form-actions .pb-save{background:#2563eb;color:#fff;border-color:#2563eb}.pb-admin-message{color:#166534;font-weight:650}.pb-admin-announcement-list{display:grid;gap:9px;margin-top:20px}.pb-admin-announcement-item{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px 15px;border:1px solid #e5eaf1;border-radius:14px;background:#fff}.pb-admin-item-main{min-width:0;flex:1}.pb-admin-item-main strong{display:block;font-size:14px;margin-top:5px}.pb-admin-type{font-size:10px;font-weight:850}.pb-admin-type.vacancy{color:#2563eb}.pb-admin-type.admit{color:#7c3aed}.pb-admin-item-desc{display:block;opacity:.65;font-size:11px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pb-item-actions{display:flex;gap:6px;flex-wrap:wrap}.pb-item-actions button{border:1px solid #e1e6ee;background:#f8fafc;border-radius:9px;padding:8px 10px;cursor:pointer;font-weight:700;color:#475467}.pb-item-actions .status-active{color:#147a4b;background:#edf9f1;border-color:#d4f0df}.pb-item-actions .status-inactive{color:#7b8794}.pb-item-actions .danger{color:#b42318;background:#fff3f2;border-color:#f5d3d0}@media(max-width:700px){.pb-announcements-public,.pb-announcements-admin{margin:16px 10px;padding:16px;border-radius:20px}.pb-announcement-head,.pb-admin-announcement-title{align-items:stretch;flex-direction:column;gap:15px}.pb-announcement-head h2,.pb-admin-announcement-title h2{font-size:23px}.pb-announcement-tabs{width:100%;box-sizing:border-box}.pb-announcement-tabs button{flex:1;padding:10px 7px;font-size:12px}.pb-form-row{grid-template-columns:1fr}.pb-announcement-grid{grid-template-columns:1fr;margin-top:17px}.pb-admin-count{align-self:flex-start}.pb-admin-announcement-item{align-items:stretch;flex-direction:column}.pb-item-actions{width:100%}.pb-item-actions button{flex:1}.pb-announcement-actions{flex-direction:column}.pb-announcement-primary,.pb-announcement-whatsapp{width:100%}}`;
  document.head.appendChild(style);
}

export function mountAnnouncementPlatform(mode, element) { styles(); const root = createRoot(element); root.render(mode === "admin" ? <AdminAnnouncements /> : <PublicAnnouncements />); return root; }
export default function AnnouncementPlatform({ mode }) { return mode === "admin" ? <AdminAnnouncements /> : <PublicAnnouncements />; }
