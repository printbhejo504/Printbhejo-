/* PrintBhejo QR link flow — isolated change. */
(() => {
  const BASE = "https://printbhejo.com/";
  const qrUrl = (pin) => `${BASE}?scan=1&pin=${encodeURIComponent(pin)}`;

  function getPinFromQrImage(img) {
    const alt = img.getAttribute("alt") || "";
    const m = alt.toUpperCase().match(/\b[A-Z][0-9]{3}\b/);
    return m ? m[0] : "";
  }

  function upgradeReceiverQr() {
    document.querySelectorAll("img.qr-code").forEach((img) => {
      const pin = getPinFromQrImage(img);
      if (!pin) return;
      const desired = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(qrUrl(pin))}`;
      if (img.dataset.printbhejoQrLink !== desired) {
        img.dataset.printbhejoQrLink = desired;
        img.src = desired;
      }
    });
  }

  function triggerScanFlow() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("scan") !== "1") return;

    const pin = (params.get("pin") || "").trim().toUpperCase();
    const buttons = [...document.querySelectorAll("button")];
    const sendTab = buttons.find((b) => /Send\s*[·•-]\s*Enter PIN/i.test(b.textContent || ""));
    if (sendTab) sendTab.click();

    const run = () => {
      if (pin && /^[A-Z][0-9]{3}$/.test(pin)) {
        const input = document.querySelector('input[placeholder="Receiver PIN"]');
        const connect = [...document.querySelectorAll("button")].find((b) => /Enter PIN & Connect/i.test(b.textContent || ""));
        if (input && connect) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(input, pin);
          else input.value = pin;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          connect.click();
          return true;
        }
      }

      const scan = [...document.querySelectorAll("button")].find((b) => /Scan Receiver QR/i.test(b.textContent || ""));
      if (scan) {
        scan.click();
        return true;
      }
      return false;
    };

    let tries = 0;
    const timer = setInterval(() => {
      upgradeReceiverQr();
      if (run() || ++tries > 30) clearInterval(timer);
    }, 250);
  }

  const observer = new MutationObserver(upgradeReceiverQr);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "alt"] });
  upgradeReceiverQr();
  triggerScanFlow();
})();
