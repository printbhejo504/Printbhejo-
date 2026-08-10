import React, { Component, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { Wrench } from "lucide-react";
import App from "./App";
import "./styles.css";
import "./ui-overrides.css";
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

function Root() {
  const [converterOpen, setConverterOpen] = useState(false);
  const [toolsHost, setToolsHost] = useState(null);

  useEffect(() => {
    const target = Array.from(document.querySelectorAll(".section")).find(section => /important\s+links/i.test(section.textContent || ""));
    if (!target) return;
    const host = document.createElement("div");
    host.className = "converter-tools-slot";
    target.parentNode.insertBefore(host, target);
    setToolsHost(host);
    return () => {
      host.remove();
      setToolsHost(null);
    };
  }, []);

  return <>
    <App />
    {toolsHost && createPortal(
      <button className="converter-fab" onClick={() => setConverterOpen(true)} aria-label="Open PrintBhejo Free Tools">
        <Wrench size={18}/><span>Free Tools</span>
      </button>,
      toolsHost
    )}
    {converterOpen && <Suspense fallback={<div className="converter-loading">Opening Free Tools…</div>}><ConverterTools onClose={() => setConverterOpen(false)} /></Suspense>}
  </>;
}

createRoot(document.getElementById("root")).render(
  <AppErrorBoundary><Root /></AppErrorBoundary>
);
