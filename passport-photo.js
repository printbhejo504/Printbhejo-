(() => {
  function init() {
    const input = document.getElementById("photoInput");
    const upload = document.getElementById("uploadPanel");
    const editor = document.getElementById("editorPanel");
    const preview = document.getElementById("previewCanvas");
    const sheet = document.getElementById("sheetCanvas");
    const zoom = document.getElementById("zoomRange");
    const countLabel = document.getElementById("countLabel");
    if (!input || !upload || !editor || !preview || !sheet || !zoom) return;

    let image = null;
    let count = 4;
    let imageData = "";

    const PHOTO_W = 413, PHOTO_H = 531;
    const SHEET_W = 2480, SHEET_H = 3508;

    function drawCrop(canvas, w, h) {
      if (!image) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const target = w / h;
      const source = image.width / image.height;
      const z = Math.max(1, Number(zoom.value) || 1);
      let sw, sh, sx, sy;

      if (source > target) {
        sh = image.height / z;
        sw = sh * target;
        sx = (image.width - sw) / 2;
        sy = (image.height - sh) / 2;
      } else {
        sw = image.width / z;
        sh = sw / target;
        sx = (image.width - sw) / 2;
        sy = (image.height - sh) / 2;
      }

      sx = Math.max(0, sx);
      sy = Math.max(0, sy);
      sw = Math.min(sw, image.width - sx);
      sh = Math.min(sh, image.height - sy);
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
    }

    function render() {
      if (!image) return;
      drawCrop(preview, PHOTO_W, PHOTO_H);

      sheet.width = SHEET_W;
      sheet.height = SHEET_H;
      const ctx = sheet.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, SHEET_W, SHEET_H);

      const gap = 70, margin = 150;
      const cols = count === 4 ? 2 : count === 6 ? 3 : 4;
      const rows = count / cols;
      const maxW = (SHEET_W - 2 * margin - (cols - 1) * gap) / cols;
      const maxH = (SHEET_H - 2 * margin - (rows - 1) * gap) / rows;
      const scale = Math.min(maxW / PHOTO_W, maxH / PHOTO_H);
      const pw = Math.round(PHOTO_W * scale);
      const ph = Math.round(PHOTO_H * scale);
      const totalW = cols * pw + (cols - 1) * gap;
      const totalH = rows * ph + (rows - 1) * gap;
      const startX = Math.round((SHEET_W - totalW) / 2);
      const startY = Math.round((SHEET_H - totalH) / 2);

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.drawImage(preview, startX + col * (pw + gap), startY + row * (ph + gap), pw, ph);
      }
      if (countLabel) countLabel.textContent = count + " photos";
    }

    function loadFile(file) {
      if (!file || !file.type.startsWith("image/")) {
        alert("Please select a JPG, PNG or WebP photo.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        imageData = String(reader.result || "");
        const img = new Image();
        img.onload = () => {
          image = img;
          upload.hidden = true;
          editor.hidden = false;
          zoom.value = "1";
          render();
        };
        img.onerror = () => {
          image = null;
          alert("Photo could not be loaded. Please choose another JPG/PNG/WebP image.");
        };
        img.src = imageData;
      };
      reader.onerror = () => alert("Could not read this photo. Please try again.");
      reader.readAsDataURL(file);
    }

    input.addEventListener("change", () => loadFile(input.files && input.files[0]));

    document.querySelectorAll(".count-button").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".count-button").forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        count = Number(button.dataset.count) || 4;
        render();
      });
    });

    zoom.addEventListener("input", render);

    document.getElementById("changePhoto")?.addEventListener("click", () => input.click());

    document.getElementById("resetBtn")?.addEventListener("click", () => {
      image = null;
      imageData = "";
      editor.hidden = true;
      upload.hidden = false;
      input.value = "";
    });

    document.getElementById("downloadBtn")?.addEventListener("click", () => {
      if (!image) return;
      const a = document.createElement("a");
      a.download = "printbhejo-passport-photos-" + count + ".jpg";
      a.href = sheet.toDataURL("image/jpeg", 0.94);
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    document.getElementById("printBtn")?.addEventListener("click", () => {
      if (!image) return;
      const url = sheet.toDataURL("image/jpeg", 0.94);
      const w = window.open("", "_blank");
      if (!w) {
        alert("Please allow pop-ups to print the photo sheet.");
        return;
      }
      w.document.write('<!doctype html><html><head><title>PrintBhejo Passport Photos</title><style>@page{size:A4;margin:0}html,body{margin:0;width:210mm;height:297mm}img{width:210mm;height:297mm;display:block}</style></head><body><img src="' + url + '"></body></html>');
      w.document.close();
      w.onload = () => { w.focus(); w.print(); };
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();