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
      <div className="pb-announcement-heading-copy">
        <div className="pb-announcement-kicker"><span className="pb-live-dot" /> PRINTBHEJO UPDATES</div>
        <h2><span className="pb-heading-icon">📢</span> Latest Updates</h2>
        <p>Official vacancy aur admit card links — ek hi jagah.</p>
      </div>
      <div className="pb-announcement-live"><span className="pb-live-dot" /> Live Updates</div>
    </div>

    <div className="pb-announcement-tabs" role="tablist">
      <button className={type === "vacancy" ? "active" : ""} onClick={() => setType("vacancy")} role="tab" aria-selected={type === "vacancy"}>🆕 <span>New Vacancy</span></button>
      <button className={type === "admit_card" ? "active" : ""} onClick={() => setType("admit_card")} role="tab" aria-selected={type === "admit_card"}>🎫 <span>Admit Card</span></button>
    </div>

    {loading ? <div className="pb-announcement-empty"><span className="pb-spinner" /> Loading latest updates...</div> : !items.length ? <div className="pb-announcement-empty"><div className="pb-empty-icon">📭</div><strong>Abhi koi {type === "vacancy" ? "new vacancy" : "admit card"} update nahi hai</strong><span>New official updates yahan automatically appear honge.</span></div> : <div className="pb-announcement-grid">
      {items.map(item => <article className="pb-announcement-card" key={item.id}>
        <div className="pb-card-main">
          <div className="pb-card-icon-wrap">{item.logo_url ? <img src={item.logo_url} alt="" className="pb-announcement-logo" /> : <div className="pb-announcement-logo-placeholder">{item.type === "vacancy" ? "🧾" : "🎫"}</div>}</div>
          <div className="pb-card-content">
            <div className="pb-card-meta"><span className="pb-announcement-tag">{typeLabel(item.type)}</span><span className="pb-official-badge">✓ Official</span></div>
            <div className="pb-card-title-row">
              <h3>{item.title}</h3>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="pb-announcement-primary">{actionLabel(item.type)} <span>→</span></a>
            </div>
            {item.description && <p className="pb-card-description">{item.description}</p>}
          </div>
        </div>
        <div className="pb-card-footer">
          <span className="pb-card-source">🔗 Official application link</span>
          <button onClick={() => shareWhatsApp(item)} className="pb-announcement-whatsapp"><span>◉</span> Share on WhatsApp</button>
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
  style.textContent = `.pb-announcements-public,.pb-announcements-admin{margin:26px auto;max-width:1120px;padding:24px;border:1px solid #dfe8f8;border-radius:26px;background:linear-gradient(145deg,#ffffff 0%,#f6f9ff 100%);box-shadow:0 18px 48px rgba(30,64,120,.08);box-sizing:border-box}.pb-announcement-head,.pb-admin-announcement-title{display:flex;justify-content:space-between;gap:20px;align-items:flex-end}.pb-announcement-kicker,.pb-admin-kicker{font-size:10px;letter-spacing:1.7px;font-weight:900;color:#2563eb;margin-bottom:7px}.pb-live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22a06b;box-shadow:0 0 0 4px rgba(34,160,107,.12);margin-right:7px}.pb-announcement-head h2,.pb-admin-announcement-title h2{margin:0 0 6px;font-size:29px;letter-spacing:-.8px;color:#14213d}.pb-heading-icon{font-size:25px}.pb-announcement-head p,.pb-admin-announcement-title p{margin:0;color:#667896;font-size:14px}.pb-announcement-live{display:flex;align-items:center;gap:2px;padding:10px 14px;border:1px solid #d6f1e3;border-radius:999px;background:#effbf5;color:#168451;font-size:12px;font-weight:800;white-space:nowrap}.pb-announcement-tabs{display:flex;gap:6px;margin-top:21px;padding:5px;border:1px solid #e1e8f3;border-radius:15px;background:#f2f6fc;max-width:580px}.pb-announcement-tabs button{border:0;background:transparent;color:#667085;border-radius:11px;padding:11px 16px;cursor:pointer;font-weight:800;transition:.18s ease;white-space:nowrap;flex:1}.pb-announcement-tabs button.active{background:#2563eb;color:#fff;box-shadow:0 7px 17px rgba(37,99,235,.22)}.pb-announcement-tabs button:hover:not(.active){color:#2563eb}.pb-announcement-grid{display:grid;grid-template-columns:1fr;gap:13px;margin-top:16px}.pb-announcement-card{position:relative;overflow:hidden;padding:18px 18px 14px;border:1px solid #dfe7f4;border-radius:20px;background:rgba(255,255,255,.94);box-shadow:0 8px 24px rgba(32,56,95,.055);transition:transform .18s ease,box-shadow .18s ease}.pb-announcement-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#2563eb,#72a6ff)}.pb-announcement-card:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(32,56,95,.09)}.pb-card-main{display:flex;gap:14px;align-items:flex-start}.pb-card-icon-wrap{width:54px;height:54px;flex:0 0 54px;display:grid;place-items:center;border-radius:16px;background:linear-gradient(145deg,#edf4ff,#dce9ff);overflow:hidden}.pb-announcement-logo,.pb-announcement-logo-placeholder{width:42px;height:42px;object-fit:contain;border-radius:12px}.pb-announcement-logo-placeholder{display:grid;place-items:center;background:#fff;color:#2563eb;font-size:23px}.pb-card-content{min-width:0;flex:1}.pb-card-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.pb-announcement-tag{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;background:#edf4ff;color:#245ec4;font-size:10px;font-weight:900}.pb-official-badge{font-size:10px;font-weight:800;color:#168451;background:#effbf5;border-radius:999px;padding:5px 8px}.pb-card-title-row{display:flex;align-items:center;gap:14px;margin-top:8px}.pb-announcement-card h3{margin:0;min-width:0;flex:1;font-size:19px;line-height:1.25;color:#17233d;letter-spacing:-.2px}.pb-card-description{margin:7px 0 0;white-space:pre-wrap;line-height:1.48;color:#667896;font-size:13px}.pb-announcement-primary{border:0;border-radius:12px;padding:10px 14px;min-width:112px;text-decoration:none;cursor:pointer;font-weight:850;font-size:12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#2563eb;color:#fff;box-shadow:0 7px 16px rgba(37,99,235,.18);white-space:nowrap}.pb-announcement-primary:hover{background:#1d4ed8}.pb-card-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:15px 0 0 68px;padding-top:12px;border-top:1px solid #edf1f7}.pb-card-source{font-size:11px;color:#7b8aa3}.pb-announcement-whatsapp{border:1px solid #d5f0df;border-radius:11px;padding:9px 12px;background:#effbf5;color:#168451;cursor:pointer;font-weight:800;font-size:11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}.pb-announcement-empty{text-align:center;padding:35px 15px;color:#6b7280;display:flex;flex-direction:column;align-items:center;gap:7px}.pb-empty-icon{font-size:28px}.pb-spinner{width:22px;height:22px;border:3px solid #dbe5f6;border-top-color:#2563eb;border-radius:50%;animation:pbspin .8s linear infinite}@keyframes pbspin{to{transform:rotate(360deg)}}.pb-admin-count{min-width:82px;text-align:center;padding:9px 13px;border:1px solid #e3e9f2;border-radius:13px;background:#f8faff}.pb-admin-count strong{display:block;font-size:19px;color:#2563eb}.pb-admin-count span{display:block;font-size:10px;color:#8a94a6}.pb-announcement-form{margin-top:20px;display:grid;gap:13px;padding:19px;border:1px solid #e4e9f1;border-radius:18px;background:#f9fbff}.pb-form-section-title{font-size:13px;font-weight:850;color:#344054;margin-bottom:1px}.pb-form-row{display:grid;grid-template-columns:180px 1fr;gap:13px}.pb-announcement-form label{display:grid;gap:6px;font-weight:700;font-size:12px;color:#475467}.pb-announcement-form input,.pb-announcement-form textarea,.pb-announcement-form select{font:inherit;padding:11px 12px;border:1px solid #dbe2ec;border-radius:11px;box-sizing:border-box;width:100%;background:#fff;color:#172033;outline:none}.pb-announcement-form input:focus,.pb-announcement-form textarea:focus,.pb-announcement-form select:focus{border-color:#5b83e8;box-shadow:0 0 0 3px rgba(37,99,235,.09)}.pb-optional{font-weight:500;color:#98a2b3;margin-left:3px}.pb-check{display:flex!important;align-items:center;grid-template-columns:auto 1fr;gap:9px!important}.pb-check input{width:auto}.pb-form-actions{display:flex;gap:8px}.pb-form-actions button{border:1px solid #d8e0eb;border-radius:10px;padding:10px 14px;background:#fff;color:#475467;font-weight:750;cursor:pointer}.pb-form-actions .pb-save{background:#2563eb;color:#fff;border-color:#2563eb}.pb-admin-message{color:#166534;font-weight:650}.pb-admin-announcement-list{display:grid;gap:9px;margin-top:20px}.pb-admin-announcement-item{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px 15px;border:1px solid #e5eaf1;border-radius:14px;background:#fff}.pb-admin-item-main{min-width:0;flex:1}.pb-admin-item-main strong{display:block;font-size:14px;margin-top:5px}.pb-admin-type{font-size:10px;font-weight:850}.pb-admin-type.vacancy{color:#2563eb}.pb-admin-type.admit{color:#7c3aed}.pb-admin-item-desc{display:block;opacity:.65;font-size:11px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pb-item-actions{display:flex;gap:6px;flex-wrap:wrap}.pb-item-actions button{border:1px solid #e1e6ee;background:#f8fafc;border-radius:9px;padding:8px 10px;cursor:pointer;font-weight:700;color:#475467}.pb-item-actions .status-active{color:#147a4b;background:#edf9f1;border-color:#d4f0df}.pb-item-actions .status-inactive{color:#7b8794}.pb-item-actions .danger{color:#b42318;background:#fff3f2;border-color:#f5d3d0}@media(max-width:700px){.pb-announcements-public,.pb-announcements-admin{margin:16px 10px;padding:16px;border-radius:21px}.pb-announcement-head,.pb-admin-announcement-title{align-items:stretch;flex-direction:column;gap:13px}.pb-announcement-head h2,.pb-admin-announcement-title h2{font-size:24px}.pb-announcement-live{align-self:flex-start}.pb-announcement-tabs{width:100%;max-width:none;box-sizing:border-box;margin-top:16px}.pb-announcement-tabs button{padding:10px 7px;font-size:12px}.pb-card-main{gap:11px}.pb-card-icon-wrap{width:46px;height:46px;flex-basis:46px;border-radius:13px}.pb-announcement-logo,.pb-announcement-logo-placeholder{width:36px;height:36px}.pb-card-title-row{align-items:stretch;flex-direction:column;gap:10px}.pb-announcement-card h3{font-size:18px}.pb-announcement-primary{width:100%;box-sizing:border-box}.pb-card-footer{margin-left:57px;align-items:stretch;flex-direction:column;gap:9px}.pb-card-source{font-size:10px}.pb-announcement-whatsapp{width:100%;box-sizing:border-box}.pb-form-row{grid-template-columns:1fr}.pb-admin-count{align-self:flex-start}.pb-admin-announcement-item{align-items:stretch;flex-direction:column}.pb-item-actions{width:100%}.pb-item-actions button{flex:1}}`;
  document.head.appendChild(style);
}

export function mountAnnouncementPlatform(mode, element) { styles(); const root = createRoot(element); root.render(mode === "admin" ? <AdminAnnouncements /> : <PublicAnnouncements />); return root; }
export default function AnnouncementPlatform({ mode }) { return mode === "admin" ? <AdminAnnouncements /> : <PublicAnnouncements />; }
