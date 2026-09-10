/* PrintBhejo Announcement Platform — fail-safe lazy loader. */

const mounted = new WeakSet();
const loadingModes = new Set();

async function mount(mode, host) {
  if (!host || mounted.has(host) || loadingModes.has(mode)) return;
  mounted.add(host);
  loadingModes.add(mode);
  try {
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

  // Latest Updates goes between Received Files and Free Tools. This does not
  // depend on Important Links or on the Important Links database having data.
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

  // AdminPanel has a stable .admin-main root. Do not depend on an old body
  // class because RoleGate/AdminPanel can render without that class.
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
