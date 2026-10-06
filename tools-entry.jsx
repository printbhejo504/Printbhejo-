import React from "react";
import { createRoot } from "react-dom/client";
import ConverterTools from "./ConverterTools.jsx";
import "./converter-tools.css";
import "./tools-page.css";

const root = document.getElementById("tools-root");
if (root) createRoot(root).render(<ConverterTools inline />);
