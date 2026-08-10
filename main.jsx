import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot, createPortal } from "react-dom/client";
import { Wrench } from "lucide-react";
import App from "./App";
import "./styles.css";
import "./ui-overrides.css";
import "./converter-tools.css";
import "./free-tools-replacement.css";
import "./free-tools-placement.css";

const ConverterTools = lazy(() => import("./ConverterTools"));

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
  <React.StrictMode><Root /></React.StrictMode>
);
