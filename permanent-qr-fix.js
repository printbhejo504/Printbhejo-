import { supabase } from "./config";

const PIN_RE = /^[A-Z][0-9]{3}$/;
let permanentPin = "";
let loading = false;

async function loadPermanentPin() {
  if (loading || permanentPin) return permanentPin;
  loading = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const { data } = await supabase.from("profiles").select("permanent_pin").eq("id", user.id).maybeSingle();
    if (data?.permanent_pin && PIN_RE.test(data.permanent_pin)) permanentPin = data.permanent_pin;
  } finally { loading = false; }
  return permanentPin;
}

function applyPin(pin) {
  if (!pin) return;
  document.querySelectorAll(".big-pin").forEach(el => { if (el.textContent !== pin) el.textContent = pin; });
  document.querySelectorAll(".qr-code").forEach(img => {
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(pin)}`;
    if (img.src !== src) img.src = src;
    img.alt = `QR code for receiver PIN ${pin}`;
  });
}

async function sync() { const pin = await loadPermanentPin(); if (pin) applyPin(pin); }

sync();
const observer = new MutationObserver(() => { if (permanentPin) applyPin(permanentPin); else sync(); });
observer.observe(document.documentElement, { childList: true, subtree: true });
