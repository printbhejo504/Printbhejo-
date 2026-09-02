import React,{useEffect,useState} from "react";
import {LogIn,LogOut} from "lucide-react";
import {supabase} from "./config";
import AuthGate from "./AuthGate";
import AdminPanel from "./AdminPanel";

export default function RoleGate({children}){
 const [session,setSession]=useState(undefined),[profile,setProfile]=useState(null);
 const load=async(s)=>{if(!s?.user||!supabase){setProfile(null);return}const {data}=await supabase.from("profiles").select("id,full_name,role,disabled").eq("id",s.user.id).maybeSingle();setProfile(data||{id:s.user.id,full_name:s.user.user_metadata?.full_name,role:"user",disabled:false})};
 useEffect(()=>{if(!supabase){setSession(null);return}supabase.auth.getSession().then(({data})=>{const s=data.session||null;setSession(s);if(s)load(s)});const {data:l}=supabase.auth.onAuthStateChange((e,s)=>{setSession(s);if(s)load(s);else setProfile(null)});return()=>l.subscription.unsubscribe()},[]);
 if(session===undefined)return <div className="auth-loading">PrintBhejo loading…</div>;
 if(!session)return <AuthGate>{children}</AuthGate>;
 if(profile?.disabled)return <div className="auth-screen"><div className="auth-card"><h2>Account Disabled</h2><p>This account has been disabled by the administrator.</p><button className="auth-primary" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/> Logout</button></div></div>;
 if(profile?.role==="admin")return <AdminPanel user={session.user} onLogout={()=>supabase.auth.signOut()}/>;
 return <AuthGate>{children}</AuthGate>;
}
