/* PrintBhejo Specific QR — isolated feature.
   Stable per-user URL, separate from the existing PIN/permanent QR flow. */
(() => {
  const BASE = "https://printbhejo.com";
  const isSpecific = () => /^\/send\/PB-[A-Za-z0-9_-]+\/?$/.test(window.location.pathname);

  async function resolveSpecificQr() {
    if (!isSpecific()) return;
    const code = window.location.pathname.split("/")[2] || "";
    if (!/^PB-[A-Za-z0-9_-]+$/.test(code)) return;
    const { supabase } = await import("./config.js");
    if (!supabase) return;
    const { data, error } = await supabase.rpc("resolve_specific_qr", { p_qr_code: code });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.session_id) {
      setTimeout(() => {
        const target = document.querySelector(".send-specific-status");
        if (target) target.textContent = "Receiver Offline";
      }, 0);
      return;
    }
    const buttons = [...document.querySelectorAll("button")];
    const sendTab = buttons.find(b => /Send\s*[·•-]\s*Enter PIN/i.test(b.textContent || ""));
    if (sendTab) sendTab.click();
    setTimeout(() => {
      const status = document.querySelector(".send-specific-status");
      if (status) status.textContent = "Receiver Online — connecting…";
      const input = document.querySelector('input[placeholder="Receiver PIN"]');
      if (input) input.style.display = "none";
      const connect = [...document.querySelectorAll("button")].find(b => /Enter PIN & Connect/i.test(b.textContent || ""));
      if (connect) connect.style.display = "none";
      // Reuse the existing sender/WebRTC path without changing it.
      const detail = { sessionId: row.session_id, qrCode: code };
      window.__printbhejoSpecificQrPending = detail;
      window.dispatchEvent(new CustomEvent("printbhejo:specific-qr-connect", { detail }));
    }, 150);
  }

  // Keep this feature entirely additive. The existing QR/PIN script remains untouched.
  window.PrintBhejoSpecificQr = { baseUrl: BASE, resolve: resolveSpecificQr };
  resolveSpecificQr().catch(() => {});
})();