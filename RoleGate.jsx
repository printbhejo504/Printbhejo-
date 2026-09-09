import React,{useEffect,useState} from "react";
import {LogOut} from "lucide-react";
import {supabase} from "./config";
import AuthGate from "./AuthGate";
import AdminPanel from "./AdminPanel";

export default function RoleGate({children}){
 const [session,setSession]=useState(undefined),[profile,setProfile]=useState(null);
 const load=async(s)=>{if(!s?.user||!supabase){setProfile(null);document.body.classList.remove("pb-admin-panel");return}const {data}=await supabase.from("profiles").select("id,full_name,role,disabled,permissions").eq("id",s.user.id).maybeSingle();const p=data||{id:s.user.id,full_name:s.user.user_metadata?.full_name,role:"user",disabled:false,permissions:{}};setProfile(p);document.body.classList.toggle("pb-admin-panel",p.role==="admin"||p.role==="staff")};
 useEffect(()=>{if(!supabase){setSession(null);document.body.classList.remove("pb-authenticated","pb-admin-panel");return}supabase.auth.getSession().then(({data})=>{const s=data.session||null;setSession(s);document.body.classList.toggle("pb-authenticated",!!s?.user);if(s)load(s);else document.body.classList.remove("pb-admin-panel")});const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);document.body.classList.toggle("pb-authenticated",!!s?.user);if(s)load(s);else{setProfile(null);document.body.classList.remove("pb-admin-panel")}});return()=>{l.subscription.unsubscribe();document.body.classList.remove("pb-authenticated","pb-admin-panel")}},[]);
 if(session===undefined)return <AuthGate key="guest-loading">{children}</AuthGate>;
 if(session && profile?.disabled)return <div className="auth-screen"><div className="auth-card"><h2>Account Disabled</h2><p>This account has been disabled by the administrator.</p><button className="auth-primary" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/> Logout</button></div></div>;
 if(session && (profile?.role==="admin"||profile?.role==="staff"))return <AdminPanel user={session.user} profile={profile} onLogout={()=>supabase.auth.signOut()}/>;
 return <AuthGate key={session?.user?.id||"guest"}>{children}</AuthGate>;
}
