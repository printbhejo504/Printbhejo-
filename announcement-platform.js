/* PrintBhejo Announcement Platform — fail-safe lazy loader.
   The core PrintBhejo app is intentionally independent of this optional module.
*/

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
  } finally {
    loadingModes.delete(mode);
  }
}

function findImportantLinksAnchor() {
  const nodes = [...document.querySelectorAll("section,div,article")];
  return nodes.find(el => {
    if (el.dataset.pbAnnouncementHost || el.classList.contains("pb-announcements-public") || el.classList.contains("pb-announcements-admin")) return false;
    const text = (el.innerText || "").trim();
    return /^Important Links\b/i.test(text) && text.length < 1800;
  });
}

function enhance() {
  try {
    // Public announcement list is always visible to normal visitors/users.
    // Keep it directly ABOVE the existing Important Links section.
    const importantLinks = findImportantLinksAnchor();
    const publicHost = document.querySelector('[data-pb-announcement-host="public"]');
    if (!publicHost) {
      const fallbackHeader = document.querySelector("header, .header");
      if (importantLinks || fallbackHeader) {
        const host = document.createElement("div");
        host.dataset.pbAnnouncementHost = "public";
        if (importantLinks) importantLinks.insertAdjacentElement("beforebegin", host);
        else fallbackHeader.insertAdjacentElement("afterend", host);
        mount("public", host);
      }
    }

    // The link-generation/management form is ADMIN-ONLY.
    // Regular authenticated users must never receive the admin component.
    if (document.body.classList.contains("pb-admin-panel") && importantLinks && !document.querySelector('[data-pb-announcement-host="admin"]')) {
      const host = document.createElement("div");
      host.dataset.pbAnnouncementHost = "admin";
      importantLinks.insertAdjacentElement("beforebegin", host);
      mount("admin", host);
    }
  } catch (error) {
    console.warn("PrintBhejo announcement enhancement skipped:", error);
  }
}

try {
  enhance();
  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(enhance, 1000);
  setTimeout(enhance, 2500);
} catch (error) {
  console.warn("PrintBhejo announcement loader skipped:", error);
}
