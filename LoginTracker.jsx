import {useEffect} from "react";
import {supabase} from "./config";

const SESSION_KEY = "pb-visitor-session";
const VISIT_KEY = "pb-visitor-recorded";

function getVisitorSessionId(){
  try{
    let id=sessionStorage.getItem(SESSION_KEY);
    if(!id){id=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem(SESSION_KEY,id);}
    return id;
  }catch{return `${Date.now()}-${Math.random().toString(36).slice(2)}`;}
}

export default function LoginTracker(){
  useEffect(()=>{
    if(!supabase)return;
    let active=true;
    const recordLogin=async(s)=>{
      if(!active||!s?.user)return;
      const key=`pb-login-${s.user.id}-${new Date().toISOString().slice(0,10)}`;
      if(sessionStorage.getItem(key))return;
      sessionStorage.setItem(key,"1");
      await supabase.from("login_events").insert({user_id:s.user.id});
      await supabase.from("profiles").update({last_login_at:new Date().toISOString()}).eq("id",s.user.id);
    };
    const recordVisit=async(s)=>{
      if(!active)return;
      try{
        if(sessionStorage.getItem(VISIT_KEY))return;
        sessionStorage.setItem(VISIT_KEY,"1");
        await supabase.from("page_visits").insert({
          session_id:getVisitorSessionId(),
          user_id:s?.user?.id||null,
          path:window.location.pathname||"/",
          is_authenticated:!!s?.user
        });
      }catch(error){console.warn("PrintBhejo visitor tracking failed:",error);}
    };
    supabase.auth.getSession().then(({data})=>{recordLogin(data.session);recordVisit(data.session);});
    const {data:l}=supabase.auth.onAuthStateChange((event,s)=>{
      if(event==="SIGNED_IN"){
        recordLogin(s);
        recordVisit(s);
      }
    });
    return()=>{active=false;l.subscription.unsubscribe()};
  },[]);
  return null;
}
