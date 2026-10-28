import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileImage, FileOutput, FileSpreadsheet, FileText, Image as ImageIcon, Minimize2, RefreshCw, X } from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

const tools = [
  { id: "png-jpg", title: "PNG → JPEG", icon: FileImage, accept: ".png,image/png" },
  { id: "jpg-png", title: "JPEG → PNG", icon: FileImage, accept: ".jpg,.jpeg,image/jpeg" },
  { id: "img-pdf", title: "Image → PDF", icon: FileOutput, accept: "image/*", multiple: true },
  { id: "pdf-img", title: "PDF → Image", icon: FileImage, accept: ".pdf,application/pdf" },
  { id: "word-pdf", title: "Word → PDF", icon: FileText, accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { id: "pdf-word", title: "PDF → Word", icon: FileText, accept: ".pdf,application/pdf" },
  { id: "xlsx-pdf", title: "Excel → PDF", icon: FileSpreadsheet, accept: ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" },
  { id: "image-compress", title: "Image Compress", icon: Minimize2, accept: "image/*" },
  { id: "signature-compress", title: "Signature Compress", icon: Minimize2, accept: "image/*" }
];

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image could not be read.")); };
    img.src = url;
  });
}

async function canvasBlob(img, type, quality, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function compressToTarget(file, targetKB, preservePng = false) {
  const img = await loadImage(file), target = Math.max(5, Number(targetKB) || 100) * 1024;
  const type = preservePng ? "image/png" : "image/jpeg";
  let best = null;
  // Prioritize legible text: try high quality at original dimensions before shrinking pixels.
  for (let scaleStep = 0; scaleStep <= 15; scaleStep++) {
    const scale = 1 - scaleStep * 0.05;
    for (let qualityStep = 0; qualityStep <= 6; qualityStep++) {
      const q = 0.95 - qualityStep * 0.05;
      const blob = await canvasBlob(img, type, q, scale);
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= target) return blob;
    }
  }
  return best;
}

async function imagesToPdf(files) {
  const pdf = await PDFDocument.create();
  const pageWidth = 595.28, pageHeight = 841.89, margin = 24;
  for (const file of files) {
    let image;
    if (file.type === "image/png") image = await pdf.embedPng(await file.arrayBuffer());
    else if (file.type === "image/jpeg" || file.type === "image/jpg") image = await pdf.embedJpg(await file.arrayBuffer());
    else {
      // Support browser-readable formats such as WebP without needlessly lowering source resolution.
      const converted = await canvasBlob(await loadImage(file), "image/png", 1);
      image = await pdf.embedPng(await converted.arrayBuffer());
    }
    const page = pdf.addPage([pageWidth, pageHeight]);
    const fit = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height);
    const width = image.width * fit, height = image.height * fit;
    page.drawImage(image, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
  }
  return new Blob([await pdf.save({ useObjectStreams: true })], { type: "application/pdf" });
}

async function excelToPdf(file) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const pdf = await PDFDocument.create(), font = await pdf.embedFont("Helvetica");
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName], rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const safeRows = rows.length ? rows : [[sheetName]], cols = Math.max(1, ...safeRows.map(r => r.length));
    const colWidths = Array.from({ length: cols }, (_, c) => Math.min(150, Math.max(50, ...safeRows.slice(0, 200).map(r => String(r[c] ?? "").length * 5.2 + 10))));
    const pageWidth = 842, margin = 28, rowH = 18, titleH = 28; let page = pdf.addPage([pageWidth, 595]);
    let y = 595 - margin - titleH; page.drawText(sheetName, { x: margin, y, size: 14, font, color: rgb(0.1, 0.2, 0.4) }); y -= 24;
    for (let r = 0; r < safeRows.length; r++) {
      if (y < margin + rowH) { page = pdf.addPage([pageWidth, 595]); y = 595 - margin; }
      let x = margin;
      for (let c = 0; c < cols; c++) {
        const text = String(safeRows[r]?.[c] ?? "").replace(/\s+/g, " ").slice(0, 45), w = Math.min(colWidths[c], pageWidth - margin - x);
        page.drawRectangle({ x, y: y - 4, width: w, height: rowH, borderWidth: 0.5, borderColor: rgb(0.78, 0.82, 0.88), color: r === 0 ? rgb(0.93, 0.96, 1) : rgb(1, 1, 1) });
        page.drawText(text, { x: x + 4, y: y + 2, size: 7, font, color: rgb(0.12, 0.14, 0.18), maxWidth: Math.max(1, w - 8) }); x += w;
        if (x >= pageWidth - margin) break;
      }
      y -= rowH;
    }
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

async function pdfToImages(file, dpi = 300) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, outputs = [];
  // PDF.js uses 72 points per inch; render at the requested DPI for sharper small text.
  const scale = Math.max(1, Math.min(4.1667, Number(dpi) / 72 || 300 / 72));
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n), viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser could not create an image canvas.");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not export this page image.")), "image/png"));
    outputs.push({ blob, name: file.name.replace(/\.pdf$/i, "") + "-page-" + n + ".png" });
    canvas.width = 1; canvas.height = 1;
  }
  return outputs;
}

function escapeXml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function wordToPdf(file) {
  if (!/\.docx$/i.test(file.name)) throw new Error("Please select a DOCX Word file. Legacy .DOC files are not supported in browser mode.");
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { includeDefaultStyleMap: true });
  const doc = new DOMParser().parseFromString(result.value, "text/html");
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595.28, pageH = 841.89, margin = 48, maxW = pageW - margin * 2;
  let page = pdf.addPage([pageW, pageH]), y = pageH - margin;
  const newPage = () => { page = pdf.addPage([pageW, pageH]); y = pageH - margin; };
  const drawWrapped = (text, size = 11, isBold = false, indent = 0) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim(); if (!clean) { y -= size * 0.9; return; }
    const activeFont = isBold ? bold : font, words = clean.split(" "); let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (activeFont.widthOfTextAtSize(test, size) > maxW - indent && line) {
        if (y < margin + size * 1.5) newPage();
        page.drawText(line, { x: margin + indent, y, size, font: activeFont }); y -= size * 1.45; line = word;
      } else line = test;
    }
    if (line) { if (y < margin + size * 1.5) newPage(); page.drawText(line, { x: margin + indent, y, size, font: activeFont }); y -= size * 1.45; }
    y -= 4;
  };
  const elements = Array.from(doc.body.children);
  if (!elements.length) drawWrapped(doc.body.textContent || "");
  for (const el of elements) {
    const tag = el.tagName.toLowerCase(), text = el.textContent || "";
    if (/^h1$/.test(tag)) drawWrapped(text, 20, true);
    else if (/^h2$/.test(tag)) drawWrapped(text, 16, true);
    else if (/^h3$/.test(tag)) drawWrapped(text, 13, true);
    else if (tag === "li") drawWrapped("• " + text, 11, false, 10);
    else if (/^table$/.test(tag)) {
      Array.from(el.querySelectorAll("tr")).forEach(row => drawWrapped(Array.from(row.children).map(c => c.textContent.trim()).join(" | "), 9));
    } else drawWrapped(text, 11);
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

async function pdfToWord(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n), content = await page.getTextContent();
    const items = content.items.filter(x => x.str && x.str.trim());
    items.sort((a, b) => (b.transform[5] - a.transform[5]) || (a.transform[4] - b.transform[4]));
    const lines = []; let current = null;
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!current || Math.abs(current.y - y) > 4) { current = { y, text: item.str }; lines.push(current); }
      else current.text += (current.text && !/\s$/.test(current.text) ? " " : "") + item.str;
    }
    pages.push(lines.map(x => x.text).join("\n"));
  }
  const zip = new JSZip();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const pageParas = pages.map((pageText, pi) => {
    const paras = pageText.split("\n").map(line => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
    return paras + (pi < pages.length - 1 ? "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>" : "");
  }).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${pageParas}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`;
  zip.file("[Content_Types].xml", contentTypes); zip.file("_rels/.rels", rels); zip.file("word/document.xml", documentXml);
  return new Blob([await zip.generateAsync({ type: "uint8array" })], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export default function ConverterTools({ onClose, inline = false, initialTool = "png-jpg" }) {
  const [tool, setTool] = useState(initialTool);
  const [fileList, setFileList] = useState([]);
  const [targetKB, setTargetKB] = useState("100"), [quality, setQuality] = useState("95"), [pdfDpi, setPdfDpi] = useState("300");
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), [error, setError] = useState("");
  const inputRef = useRef(null), activeTool = useMemo(() => tools.find(t => t.id === tool) || tools[0], [tool]);
  useEffect(() => { setFileList([]); setResult(null); setError(""); }, [tool]);
  const choose = e => { setFileList(Array.from(e.target.files || [])); setResult(null); setError(""); e.target.value = ""; };

  async function convert() {
    if (!fileList.length) return setError("Please select a file first.");
    setBusy(true); setError(""); setResult(null);
    try {
      const f = fileList[0];
      if (tool === "png-jpg") { const b = await canvasBlob(await loadImage(f), "image/jpeg", Number(quality) / 100); setResult({ blob: b, name: f.name.replace(/\.png$/i, "") + ".jpg" }); }
      else if (tool === "jpg-png") { const b = await canvasBlob(await loadImage(f), "image/png", 1); setResult({ blob: b, name: f.name.replace(/\.(jpe?g)$/i, "") + ".png" }); }
      else if (tool === "img-pdf") { setResult({ blob: await imagesToPdf(fileList), name: "PrintBhejo-images.pdf" }); }
      else if (tool === "pdf-img") { setResult({ multiple: await pdfToImages(f, Number(pdfDpi)) }); }
      else if (tool === "word-pdf") { setResult({ blob: await wordToPdf(f), name: f.name.replace(/\.docx$/i, "") + ".pdf" }); }
      else if (tool === "pdf-word") { setResult({ blob: await pdfToWord(f), name: f.name.replace(/\.pdf$/i, "") + ".docx" }); }
      else if (tool === "xlsx-pdf") { setResult({ blob: await excelToPdf(f), name: f.name.replace(/\.(xlsx|xls)$/i, "") + ".pdf" }); }
      else { setResult({ blob: await compressToTarget(f, targetKB), name: f.name.replace(/\.[^.]+$/, "") + "-compressed.jpg" }); }
    } catch (e) { setError(e?.message || "Conversion failed. Try another file."); }
    finally { setBusy(false); }
  }

  return <div className={inline ? "converter-inline" : "converter-backdrop"} onMouseDown={e => !inline && e.target === e.currentTarget && onClose?.()}>
    <section className={inline ? "converter-panel converter-panel-inline" : "converter-panel"}>
      <div className="converter-head"><div><span className="converter-kicker">PRIVATE • BROWSER ONLY</span><h2>PrintBhejo Tools</h2><p>Files stay in your browser during these conversions.</p></div>{!inline && <button className="converter-close" onClick={onClose}><X size={20}/></button>}</div><a className="passport-tool-banner-inline" href="/passport-photo.html" aria-label="Open Passport Photo Maker"><span className="passport-tool-banner-inline-icon">📸</span><span className="passport-tool-banner-inline-copy"><strong>Passport Photo Maker</strong><small>4, 6 or 8 passport-size photos on A4</small></span><span className="passport-tool-banner-inline-action">Create Photos →</span></a>
      <div className="tool-grid">{tools.map(t => { const Icon = t.icon; return <button key={t.id} className={tool === t.id ? "tool-card active" : "tool-card"} onClick={() => setTool(t.id)}><Icon size={21}/><span>{t.title}</span></button>; })}</div>
      <div className="converter-workspace">
        <div className="drop-area" onClick={() => inputRef.current?.click()}><input ref={inputRef} hidden type="file" accept={activeTool.accept} multiple={activeTool.multiple} onChange={choose}/><ImageIcon size={34}/><strong>{fileList.length ? `${fileList.length} file${fileList.length > 1 ? "s" : ""} selected` : "Select file"}</strong><span>{activeTool.accept}</span></div>
        {(tool === "image-compress" || tool === "signature-compress") && <div className="compress-controls"><label>Target size (KB)<input type="number" min="5" value={targetKB} onChange={e => setTargetKB(e.target.value)} placeholder="100"/></label><small>Example: 50 KB, 100 KB, 200 KB. The browser reduces dimensions/quality until it reaches the target when possible.</small></div>}
        {tool === "png-jpg" && <div className="compress-controls"><label>JPEG quality (%)<input type="number" min="10" max="100" value={quality} onChange={e => setQuality(String(Math.max(10, Math.min(100, Number(e.target.value) || 10))))}/></label><small>Default 95% keeps text edges clearer. Lower values create smaller files but may soften fine details.</small></div>}
        {tool === "pdf-img" && <div className="compress-controls"><label>Image resolution (DPI)<select value={pdfDpi} onChange={e => setPdfDpi(e.target.value)}><option value="150">150 DPI — smaller files</option><option value="216">216 DPI — balanced</option><option value="300">300 DPI — sharp print quality</option></select></label><small>300 DPI is best for small text and printing; very long PDFs may take more memory.</small></div>}
        {(tool === "word-pdf" || tool === "pdf-word") && <div className="compress-controls"><small>Private browser conversion. No file upload is used. DOCX formatting, tables and PDF layouts may not be reproduced exactly.</small></div>}
        <button className="convert-btn" disabled={busy || !fileList.length} onClick={convert}>{busy ? <><RefreshCw className="spin" size={18}/> Converting…</> : <>Convert Now <FileOutput size={18}/></>}</button>
        {error && <div className="converter-error">{error}</div>}
        {result && <div className="converter-result"><div><strong>✓ Ready</strong><span>{result.multiple ? `${result.multiple.length} PNG images created` : `${result.name} • ${Math.round(result.blob.size / 1024)} KB`}</span></div>{result.multiple ? <div className="result-list">{result.multiple.map(x => <button key={x.name} onClick={() => downloadBlob(x.blob, x.name)}><Download size={16}/> {x.name}</button>)}</div> : <button onClick={() => downloadBlob(result.blob, result.name)}><Download size={17}/> Download</button>}</div>}
      </div>
      <div className="converter-note">No upload, no account, no third-party conversion API. <span>Word ↔ PDF runs in your browser.</span></div>
    </section>
  </div>;
}
