// PrintBhejo multi-file sender UX fix.
// The current React sender sends selected[0] and removes it after each ACK.
// This bridge automatically continues by clicking Send File again until the
// whole selected batch has been acknowledged, without touching WebRTC logic.
(function () {
  let running = false;
  let lastBatch = null;
  let timer = null;

  const textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

  function findSendButton() {
    return [...document.querySelectorAll("button")].find((b) => {
      const t = textOf(b).toLowerCase();
      return t === "send file" || t.includes("send file") && !t.includes("another");
    });
  }

  function hasSelectedFiles() {
    return !!document.querySelector(".upload-area input[type=file]") &&
      !!document.querySelector(".upload-area") &&
      [...document.querySelectorAll(".upload-area *")].some((el) => {
        const t = textOf(el).toLowerCase();
        return t.includes("selected") || t.includes("file") && t.includes("send");
      });
  }

  function scheduleNext() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const button = findSendButton();
      if (!running || !button || button.disabled) {
        if (running) scheduleNext();
        return;
      }
      button.click();
      scheduleNext();
    }, 700);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("button");
    if (!button) return;
    const t = textOf(button).toLowerCase();
    if (t !== "send file" && !(t.includes("send file") && !t.includes("another"))) return;

    // Let React perform the first transfer. Then keep advancing through the
    // remaining selected files after each transfer completes.
    running = true;
    lastBatch = Date.now();
    clearTimeout(timer);
    scheduleNext();
  }, true);

  const observer = new MutationObserver(() => {
    if (!running) return;
    const bodyText = textOf(document.body).toLowerCase();
    const completed = bodyText.includes("file sent successfully");
    const button = findSendButton();

    // The React code removes the completed file from selected[]. If another
    // file remains, Send File is rendered again. Continue automatically.
    if (completed && button && !button.disabled) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = findSendButton();
        if (running && next && !next.disabled) next.click();
      }, 250);
    }

    // Once the picker/dropzone is back and no Send File button exists, the
    // batch is finished. Leave the normal React success message visible.
    if (!button && Date.now() - lastBatch > 500) {
      running = false;
      clearTimeout(timer);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();
