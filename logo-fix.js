// Use the uploaded PrintBhejo logo asset without changing the core app.
(function applyUploadedLogo(){
  const LOGO_SRC = "/printbhejo-logo.png";
  const update = () => {
    document.querySelectorAll("img.brand-logo").forEach((img) => {
      if (img.getAttribute("src") !== LOGO_SRC) img.setAttribute("src", LOGO_SRC);
      img.alt = "PrintBhejo logo";
    });
  };
  update();
  new MutationObserver(update).observe(document.documentElement, { childList: true, subtree: true });
})();
