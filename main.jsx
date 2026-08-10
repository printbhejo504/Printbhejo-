import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Wrench } from "lucide-react";
import App from "./App";
import ConverterTools from "./ConverterTools";
import "./styles.css";
import "./ui-overrides.css";
import "./converter-tools.css";

function Root() {
  const [converterOpen, setConverterOpen] = useState(false);
  return <>
    <App />
    <button className="converter-fab" onClick={() => setConverterOpen(true)} aria-label="Open PrintBhejo tools"><Wrench size={18}/><span>Tools</span></button>
    {converterOpen && <ConverterTools onClose={() => setConverterOpen(false)} />}
  </>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><Root /></React.StrictMode>
);
