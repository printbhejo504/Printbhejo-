/* PrintBhejo Announcement Platform — fail-safe lazy loader. */

const mounted = new WeakSet();
const loadingModes = new Set();

function ensureAnnouncementUiStyles() {
  if (document.getElementById("pb-announcement-ui-overrides")) return;
  const style = document.createElement("style");
  style.id = "pb-announcement-ui-overrides";
  style.textContent = `
    .pb-announcements-public {
      margin: 22px auto !important;
      max-width: 1120px !important;
      padding: 20px !important;
      border: 1px solid #e6ebf3 !important;
      border-radius: 24px !important;
      background: linear-gradient(145deg,#ffffff,#f7faff) !important;
      box-shadow: 0 14px 38px rgba(31,45,72,.07) !important;
      box-sizing: border-box !important;
    }
    .pb-announcement-head {
      display:flex !important;
      justify-content:space-between !important;
      align-items:flex-end !important;
      gap:18px !important;
      padding-bottom:16px !important;
    }
    .pb-announcement-kicker {
      font-size:10px !important;
      letter-spacing:1.5px !important;
      font-weight:800 !important;
      color:#3568dc !important;
      margin-bottom:5px !important;
    }
    .pb-announcement-head h2 {
      margin:0 0 5px !important;
      font-size:25px !important;
      line-height:1.2 !important;
      letter-spacing:-.5px !important;
      color:#172033 !important;
    }
    .pb-announcement-head p {
      margin:0 !important;
      color:#718096 !important;
      font-size:13px !important;
    }
    .pb-announcement-tabs {
      display:flex !important;
      gap:5px !important;
      padding:4px !important;
      border:1px solid #e1e7f0 !important;
      border-radius:13px !important;
      background:#f3f6fb !important;
      flex-shrink:0 !important;
    }
    .pb-announcement-tabs button {
      border:0 !important;
      background:transparent !important;
      color:#697586 !important;
      border-radius:9px !important;
      padding:9px 12px !important;
      cursor:pointer !important;
      font-weight:750 !important;
      font-size:12px !important;
      white-space:nowrap !important;
    }
    .pb-announcement-tabs button.active {
      background:#fff !important;
      color:#1f5edb !important;
      box-shadow:0 3px 10px rgba(30,64,175,.10) !important;
    }
    .pb-announcement-grid {
      display:grid !important;
      grid-template-columns:repeat(auto-fit,minmax(290px,1fr)) !important;
      gap:14px !important;
      margin-top:4px !important;
    }
    .pb-announcement-card {
      position:relative !important;
      overflow:hidden !important;
      display:grid !important;
      grid-template-columns:minmax(0,1fr) auto !important;
      padding:17px !important;
      border:1px solid #e3e9f2 !important;
      border-radius:18px !important;
      background:#fff !important;
      box-shadow:0 7px 22px rgba(30,41,59,.055) !important;
      transition:transform .18s ease,box-shadow .18s ease !important;
    }
    .pb-announcement-card:before {
      content:"" !important;
      position:absolute !important;
      left:0 !important;
      top:0 !important;
      right:0 !important;
      height:3px !important;
      background:linear-gradient(90deg,#2563eb,#60a5fa) !important;
    }
    .pb-announcement-card:hover {
      transform:translateY(-2px) !important;
      box-shadow:0 12px 28px rgba(30,41,59,.09) !important;
    }
    .pb-card-top { grid-column:1 / -1 !important; grid-row:1 !important; display:flex !important; justify-content:space-between !important; align-items:flex-start !important; min-height:43px !important; }
    .pb-announcement-tag { border-radius:999px !important; padding:5px 9px !important; background:#eff5ff !important; color:#2f63c8 !important; font-size:10px !important; font-weight:850 !important; }
    .pb-announcement-logo,.pb-announcement-logo-placeholder { width:42px !important; height:42px !important; border-radius:11px !important; object-fit:contain !important; flex:0 0 42px !important; }
    .pb-announcement-logo { background:#f7f9fc !important; border:1px solid #edf0f4 !important; }
    .pb-announcement-logo-placeholder { display:grid !important; place-items:center !important; background:#eef4ff !important; color:#2f66d6 !important; font-size:11px !important; font-weight:900 !important; }
    .pb-announcement-card h3 {
      grid-column:1 !important;
      grid-row:2 !important;
      align-self:center !important;
      margin:13px 10px 7px 0 !important;
      font-size:18px !important;
      line-height:1.25 !important;
      color:#172033 !important;
    }
    .pb-announcement-actions { display:contents !important; }
    .pb-announcement-primary {
      grid-column:2 !important;
      grid-row:2 !important;
      align-self:center !important;
      display:inline-flex !important;
      align-items:center !important;
      justify-content:center !important;
      gap:5px !important;
      min-width:105px !important;
      border:0 !important;
      border-radius:10px !important;
      padding:10px 12px !important;
      text-decoration:none !important;
      background:#2563eb !important;
      color:#fff !important;
      font-size:12px !important;
      font-weight:800 !important;
      box-shadow:0 5px 13px rgba(37,99,235,.18) !important;
    }
    .pb-announcement-primary:hover { background:#1d4ed8 !important; }
    .pb-announcement-card p {
      grid-column:1 / -1 !important;
      grid-row:3 !important;
      margin:0 !important;
      min-height:0 !important;
      white-space:pre-wrap !important;
      line-height:1.5 !important;
      color:#697586 !important;
      font-size:13px !important;
      padding-top:2px !important;
    }
    .pb-card-divider { grid-column:1 / -1 !important; grid-row:4 !important; height:1px !important; background:#edf0f4 !important; margin:13px 0 10px !important; }
    .pb-announcement-whatsapp {
      grid-column:1 / -1 !important;
      grid-row:5 !important;
      width:100% !important;
      box-sizing:border-box !important;
      border:1px solid #d8efdf !important;
      border-radius:10px !important;
      padding:9px 11px !important;
      background:#effaf2 !important;
      color:#18703b !important;
      font-size:12px !important;
      font-weight:750 !important;
      cursor:pointer !important;
    }
    @media(max-width:700px) {
      .pb-announcements-public { margin:15px 10px !important; padding:15px !important; border-radius:19px !important; }
      .pb-announcement-head { flex-direction:column !important; align-items:stretch !important; gap:12px !important; }
      .pb-announcement-head h2 { font-size:22px !important; }
      .pb-announcement-tabs { width:100% !important; box-sizing:border-box !important; }
      .pb-announcement-tabs button { flex:1 !important; padding:9px 6px !important; }
      .pb-announcement-grid { grid-template-columns:1fr !important; }
      .pb-announcement-card { grid-template-columns:minmax(0,1fr) auto !important; padding:15px !important; }
      .pb-announcement-card h3 { font-size:17px !important; margin-right:7px !important; }
      .pb-announcement-primary { min-width:96px !important; padding:9px 9px !important; font-size:11px !important; }
    }
  `;
  document.head.appendChild(style);
}

async function mount(mode, host) {
  if (!host || mounted.has(host) || loadingModes.has(mode)) return;
  mounted.add(host);
  loadingModes.add(mode);
  try {
    ensureAnnouncementUiStyles();
    const [{ default: React }, { createRoot }, { default: AnnouncementPlatform }] = await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("./AnnouncementPlatform.jsx")
    ]);
    const root = createRoot(host);
    root.render(React.createElement(AnnouncementPlatform, { mode }));
  } catch (error) {
    console.warn("PrintBhejo announcements unavailable:", error);
    host.remove();
    mounted.delete(host);
  } finally {
    loadingModes.delete(mode);
  }
}

function findHeading(text) {
  return [...document.querySelectorAll("h1,h2,h3")].find(el =>
    (el.textContent || "").trim().toLowerCase() === text.toLowerCase()
  );
}

function findSectionByHeading(text) {
  const heading = findHeading(text);
  return heading?.closest("section") || null;
}

function createHost(mode) {
  const host = document.createElement("div");
  host.dataset.pbAnnouncementHost = mode;
  return host;
}

function enhancePublic() {
  if (document.querySelector('[data-pb-announcement-host="public"]')) return;

  const toolsSection = findSectionByHeading("Free Tools") || findSectionByHeading("PrintBhejo Tools");
  const receivedSection = findSectionByHeading("📥 Received Files") || findHeading("Received Files")?.closest("section");
  const host = createHost("public");

  if (toolsSection) {
    toolsSection.insertAdjacentElement("beforebegin", host);
    mount("public", host);
    return;
  }
  if (receivedSection) {
    receivedSection.insertAdjacentElement("afterend", host);
    mount("public", host);
  }
}

function enhanceAdmin() {
  if (document.querySelector('[data-pb-announcement-host="admin"]')) return;
  const adminMain = document.querySelector(".admin-main");
  if (!adminMain) return;

  const host = createHost("admin");
  const heading = adminMain.querySelector(".admin-heading");
  if (heading) heading.insertAdjacentElement("afterend", host);
  else adminMain.prepend(host);
  mount("admin", host);
}

function enhance() {
  try {
    enhanceAdmin();
    if (!document.querySelector(".admin-shell")) enhancePublic();
  } catch (error) {
    console.warn("PrintBhejo announcement enhancement skipped:", error);
  }
}

try {
  enhance();
  const observer = new MutationObserver(() => {
    clearTimeout(window.__pbAnnouncementEnhanceTimer);
    window.__pbAnnouncementEnhanceTimer = setTimeout(enhance, 40);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(enhance, 500);
  setTimeout(enhance, 1500);
  setTimeout(enhance, 3000);
} catch (error) {
  console.warn("PrintBhejo announcement loader skipped:", error);
}
