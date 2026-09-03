import { supabase } from "./config";
let pin="";
async function load(){try{const {data:{user}}=await supabase.auth.getUser();if(!user)return;const {data}=await supabase.from("profiles").select("permanent_pin").eq("id",user.id).maybeSingle();if(data?.permanent_pin)pin=data.permanent_pin;}catch{}}
async function wire(){if(!pin)await load();if(!pin)return;document.querySelectorAll("button").forEach(b=>{if(b.textContent.trim()==="Copy PIN"&&!b.dataset.permanentCopy){b.dataset.permanentCopy="1";b.addEventListener("click",async e=>{e.preventDefault();e.stopImmediatePropagation();try{await navigator.clipboard.writeText(pin);b.textContent="PIN Copied ✓";setTimeout(()=>{b.textContent="Copy PIN"},1500);}catch{}},true);}})}
wire();new MutationObserver(wire).observe(document.documentElement,{childList:true,subtree:true});
