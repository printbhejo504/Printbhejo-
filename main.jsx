import React, { Component, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import App from "./App";
import "./styles.css";
import "./ui-overrides.css";
import "./batch-ui.css";
import "./converter-tools.css";
import "./free-tools-replacement.css";
import "./free-tools-placement.css";

const ConverterTools = lazy(() => import("./ConverterTools"));

class AppErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("PrintBhejo runtime error:", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,fontFamily:"system-ui,sans-serif",background:"#f6f8fc",color:"#111827"}}>
        <div style={{maxWidth:520,width:"100%",background:"#fff",borderRadius:20,padding:24,boxShadow:"0 12px 40px rgba(0,0,0,.10)"}}>
          <h2 style={{margin:"0 0 8px"}}>PrintBhejo couldn't load</h2>
          <p style={{margin:"0 0 14px",color:"#4b5563"}}>A browser-side error occurred. Your files are not uploaded by this error screen.</p>
          <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:12,background:"#f3f4f6",padding:12,borderRadius:12,overflow:"auto"}}>{String(this.state.error?.message || this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{marginTop:14,border:0,borderRadius:12,padding:"11px 16px",fontWeight:700,cursor:"pointer"}}>Reload PrintBhejo</button>
        </div>
      </div>
    );
  }
}

function enhanceTransferUI() {
  const tabs = document.querySelector(".tabs");
  if (tabs) {
    const buttons = Array.from(tabs.querySelectorAll("button"));
    const send = buttons.find(b => /send/i.test(b.textContent || ""));
    const receive = buttons.find(b => /receive/i.test(b.textContent || ""));
    if (send && receive) {
      send.style.order = "1";
      receive.style.order = "2";
      if (!tabs.dataset.pbOrderSet) {
        tabs.dataset.pbOrderSet = "1";
        setTimeout(() => send.click(), 80);
      }
    }
  }

  const uploadArea = document.querySelector(".upload-area");
  if (uploadArea) {
    const success = document.querySelector(".notice")?.textContent?.includes("Files sent successfully");
    if (success) {
      document.querySelectorAll(".selected-list .selected > button").forEach(btn => btn.click());
      if (!uploadArea.querySelector(".pb-send-again")) {
        const btn = document.createElement("button");
        btn.className = "secondary pb-send-again";
        btn.type = "button";
        btn.textContent = "＋ Send Another File";
        btn.addEventListener("click", () => uploadArea.querySelector('.dropzone input[type="file"]')?.click());
        uploadArea.appendChild(btn);
      }
    }
  }

  const grids = Array.from(document.querySelectorAll(".file-grid"));
  if (grids.length) {
    import("./idb").then(async ({listFiles}) => {
      const records = (await listFiles()).filter(f => f.expiresAt > Date.now()).sort((a,b) => b.receivedAt-a.receivedAt);
      grids.forEach(grid => {
        const cards = Array.from(grid.querySelectorAll(":scope > .file-card"));
        cards.forEach((card, i) => {
          const record = records[i];
          if (!record) return;
          const batch = record.batchId || `legacy-${record.id}`;
          card.dataset.pbBatch = batch;
          card.dataset.pbBatchFirst = "0";
          card.removeAttribute("data-pb-batch-label");
          const batchRecords = records.filter(r => (r.batchId || `legacy-${r.id}`) === batch);
          if (i === records.findIndex(r => (r.batchId || `legacy-${r.id}`) === batch)) {
            card.dataset.pbBatchFirst = "1";
            card.dataset.pbBatchLabel = `Batch • ${batchRecords.length} ${batchRecords.length === 1 ? "file" : "files"}`;
          }
        });
      });
    }).catch(() => {});
  }
}

function Root() {
  const [toolsHost, setToolsHost] = useState(null);

  useEffect(() => {
    const target = Array.from(document.querySelectorAll(".section")).find(section => /important\s+links/i.test(section.textContent || ""));
    if (!target) return;
    const host = document.createElement("div");
    host.className = "converter-tools-slot";
    target.parentNode.insertBefore(host, target);
    setToolsHost(host);
    return () => { host.remove(); setToolsHost(null); };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      window.clearTimeout(window.__pbEnhanceTimer);
      window.__pbEnhanceTimer = window.setTimeout(enhanceTransferUI, 40);
    });
    observer.observe(document.body, {childList:true, subtree:true});
    enhanceTransferUI();
    return () => { observer.disconnect(); window.clearTimeout(window.__pbEnhanceTimer); };
  }, []);

  return <>
    <App />
    {toolsHost && createPortal(
      <Suspense fallback={<div className="converter-loading">Loading Free Tools…</div>}>
        <ConverterTools inline />
      </Suspense>,
      toolsHost
    )}
  </>;
}

createRoot(document.getElementById("root")).render(<AppErrorBoundary><Root /></AppErrorBoundary>);
