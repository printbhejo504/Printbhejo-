import "./qr-polyfill";
import React, { Component, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import RoleGate from "./RoleGate";
import LoginTracker from "./LoginTracker";
import "./styles.css";
import "./ui-overrides.css";
import "./scroll-fix.css";
import "./batch-ui.css";
import "./converter-tools.css";
import "./free-tools-replacement.css";
import "./free-tools-placement.css";

class AppErrorBoundary extends Component { state={error:null}; static getDerivedStateFromError(error){return{error}} componentDidCatch(error,info){console.error("PrintBhejo runtime error:",error,info)} render(){if(!this.state.error)return this.props.children;return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,fontFamily:"system-ui,sans-serif",background:"#f6f8fc",color:"#111827"}}><div style={{maxWidth:520,width:"100%",background:"#fff",borderRadius:20,padding:24,boxShadow:"0 12px 40px rgba(0,0,0,.10)"}}><h2>PrintBhejo couldn't load</h2><p>A browser-side error occurred.</p><pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:12,background:"#f3f4f6",padding:12,borderRadius:12,overflow:"auto"}}>{String(this.state.error?.message||this.state.error)}</pre><button onClick={()=>window.location.reload()}>Reload PrintBhejo</button></div></div>}}

let converterRoot=null;
let converterMounting=false;
async function mountModernConverter(){
  if(converterMounting)return;
  const linksSection=Array.from(document.querySelectorAll("section")).find(s=>/important\s+links/i.test(s.textContent||""));
  if(!linksSection)return;
  let slot=document.querySelector(".converter-tools-slot");
  if(!slot){slot=document.createElement("div");slot.className="converter-tools-slot";linksSection.parentNode?.insertBefore(slot,linksSection);}
  if(converterRoot)return;
  converterMounting=true;
  try{const mod=await import("./ConverterTools.jsx");converterRoot=createRoot(slot);converterRoot.render(<mod.default inline/>);}catch(error){console.error("PrintBhejo converter tools failed to load:",error);slot.remove();}finally{converterMounting=false;}
}

async function downloadPermanentQr(img,pin){
  try{
    const response=await fetch(img.src,{mode:"cors",cache:"no-store"});
    if(!response.ok)throw new Error("QR image could not be downloaded.");
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`PrintBhejo-Permanent-QR-${pin}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(error){
    const a=document.createElement("a");a.href=img.src;a.target="_blank";a.rel="noopener";a.download=`PrintBhejo-Permanent-QR-${pin}.png`;document.body.appendChild(a);a.click();a.remove();
  }
}

function enhancePermanentQrUI(){
  const loggedIn=document.body.classList.contains("pb-authenticated");
  const panel=document.querySelector(".pin-panel");
  const img=panel?.querySelector(".qr-code");
  if(!panel||!img)return;
  const expiry=panel.querySelector(".expiry");
  const strong=Array.from(panel.querySelectorAll("strong")).find(el=>/Receiver PIN auto-generated/i.test(el.textContent||""));
  let downloadBtn=panel.querySelector(".pb-download-qr");
  if(loggedIn){
    if(expiry)expiry.style.display="none";
    if(strong)strong.textContent="Permanent PIN • QR code stays active with your account";
    const note=panel.querySelector(".qr-wrap span");
    if(note)note.textContent="Permanent QR • sender scan karke connect kar sakta hai";
    if(!downloadBtn){
      downloadBtn=document.createElement("button");downloadBtn.type="button";downloadBtn.className="secondary pb-download-qr";downloadBtn.textContent="Download Permanent QR";
      downloadBtn.addEventListener("click",()=>downloadPermanentQr(img,img.alt.match(/[A-Z0-9]{4}$/)?.[0]||"PIN"));
      const copy=panel.querySelector("button");copy?.after(downloadBtn);
    }
  }else{
    if(expiry)expiry.style.display="";
    if(strong)strong.textContent="Receiver PIN auto-generated • Sender PIN enter ya QR scan kare";
    const note=panel.querySelector(".qr-wrap span");
    if(note)note.textContent="Sender QR scan karke bhi connect kar sakta hai";
    downloadBtn?.remove();
  }
}

function enhanceTransferUI(){
 const tabs=document.querySelector(".tabs");
 if(tabs){const buttons=Array.from(tabs.querySelectorAll("button")),send=buttons.find(b=>/send/i.test(b.textContent||"")),receive=buttons.find(b=>/receive/i.test(b.textContent||""));if(send&&receive){const loggedIn=document.body.classList.contains("pb-authenticated");send.style.order=loggedIn?"2":"1";receive.style.order=loggedIn?"1":"2";tabs.dataset.pbOrderSet="1"}}
 const uploadArea=document.querySelector(".upload-area");
 if(uploadArea){const success=document.querySelector(".notice")?.textContent?.includes("Files sent successfully");if(success){document.querySelectorAll(".selected-list .selected > button").forEach(btn=>btn.click());if(!uploadArea.querySelector(".pb-send-again")){const btn=document.createElement("button");btn.className="secondary pb-send-again";btn.type="button";btn.textContent="＋ Send Another File";btn.addEventListener("click",()=>{const input=uploadArea.querySelector('.dropzone input[type="file"]');if(input){input.value="";input.click()}});uploadArea.appendChild(btn)}}}
 const grids=Array.from(document.querySelectorAll(".file-grid"));
 if(grids.length){import("./idb").then(async({listFiles})=>{const records=(await listFiles()).filter(f=>f.expiresAt>Date.now()).sort((a,b)=>b.receivedAt-a.receivedAt);grids.forEach(grid=>{const cards=Array.from(grid.querySelectorAll(":scope > .file-card"));cards.forEach((card,i)=>{const record=records[i];if(!record)return;const batch=record.batchId||`legacy-${record.id}`;card.dataset.pbBatch=batch;card.dataset.pbBatchFirst="0";card.removeAttribute("data-pb-batch-label");const batchRecords=records.filter(r=>(r.batchId||`legacy-${r.id}`)===batch);if(i===records.findIndex(r=>(r.batchId||`legacy-${r.id}`)===batch)){card.dataset.pbBatchFirst="1";card.dataset.pbBatchLabel=`Batch • ${batchRecords.length} ${batchRecords.length===1?"file":"files"}`}})})}).catch(()=>{})}
 enhancePermanentQrUI();
 mountModernConverter();
}

function Root(){useEffect(()=>{const observer=new MutationObserver(()=>{window.clearTimeout(window.__pbEnhanceTimer);window.__pbEnhanceTimer=window.setTimeout(enhanceTransferUI,40)});observer.observe(document.body,{childList:true,subtree:true});enhanceTransferUI();return()=>{observer.disconnect();window.clearTimeout(window.__pbEnhanceTimer);converterRoot?.unmount?.();converterRoot=null}},[]);return <><LoginTracker/><RoleGate><App/></RoleGate></>}
createRoot(document.getElementById("root")).render(<AppErrorBoundary><Root/></AppErrorBoundary>);
