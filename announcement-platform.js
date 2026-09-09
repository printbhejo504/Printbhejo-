/* PrintBhejo Announcement Platform — fail-safe loader.
   This file intentionally has no React/component imports at startup so a
   problem in the optional announcement feature can never block the main app.
*/

const mounted = new WeakSet();
let loading = false;

async function mount(mode, host) {
  if (!host || mounted.has(host) || loading) return;
  mounted.add(host);
  loading = true;
  try {
    const [{ createRoot }, { default: AnnouncementPlatform }] = await Promise.all([
      import("react-dom/client"),
      import("./AnnouncementPlatform.jsx")
    ]);
    const root = createRoot(host);
    root.render(React.createElement(AnnouncementPlatform, { mode }));
  } catch (error) {
    // Optional feature must fail silently; core PrintBhejo remains usable.
    console.warn("PrintBhejo announcements unavailable:", error);
    host.remove();
  } finally {
    loading = false;
  }
}

function findAdminAnchor() {
  const nodes = [...document.querySelectorAll("section,div,article")];
  return nodes.find(el => {
    if (el.dataset.pbAnnouncementHost || el.classList.contains("pb-announcements-admin")) return false;
    const text = (el.innerText || "").trim();
    return /^Important Links\b/i.test(text) && text.length < 1800;
  });
}

function enhance() {
  // Public module is optional and mounted only after the existing app DOM exists.
  const publicHeader = document.querySelector("header, .header");
  if (publicHeader && !document.querySelector(".pb-announcements-public") && !document.querySelector('[data-pb-announcement-host="public"]')) {
    const host = document.createElement("div");
    host.dataset.pbAnnouncementHost = "public";
    publicHeader.insertAdjacentElement("afterend", host);
    mount("public", host);
  }

  // Admin module is mounted only for an authenticated admin/staff screen.
  if (document.body.classList.contains("pb-authenticated")) {
    const anchor = findAdminAnchor();
    if (anchor && !document.querySelector(".pb-announcements-admin") && !document.querySelector('[data-pb-announcement-host="admin"]')) {
      const host = document.createElement("div");
      host.dataset.pbAnnouncementHost = "admin";
      anchor.insertAdjacentElement("beforebegin", host);
      mount("admin", host);
    }
  }
}

// Never throw during startup.
try {
  enhance();
  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(enhance, 1000);
  setTimeout(enhance, 2500);
} catch (error) {
  console.warn("PrintBhejo announcement loader skipped:", error);
}
