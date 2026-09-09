import React from "react";
import { createRoot } from "react-dom/client";
import AnnouncementPlatform from "./AnnouncementPlatform.jsx";

const mounted = new WeakSet();

function mount(mode, host) {
  if (!host || mounted.has(host)) return;
  mounted.add(host);
  const root = createRoot(host);
  root.render(React.createElement(AnnouncementPlatform, { mode }));
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
  const publicHeader = document.querySelector("header, .header");
  if (publicHeader && !document.querySelector(".pb-announcements-public")) {
    const host = document.createElement("div");
    host.dataset.pbAnnouncementHost = "public";
    publicHeader.insertAdjacentElement("afterend", host);
    mount("public", host);
  }
  if (document.body.classList.contains("pb-authenticated")) {
    const anchor = findAdminAnchor();
    if (anchor && !document.querySelector(".pb-announcements-admin")) {
      const host = document.createElement("div");
      host.dataset.pbAnnouncementHost = "admin";
      anchor.insertAdjacentElement("beforebegin", host);
      mount("admin", host);
    }
  }
}

enhance();
const observer = new MutationObserver(enhance);
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(enhance, 1000);
setTimeout(enhance, 2500);
