import React,{useEffect,useState} from "react";
import {BarChart3,Eye,Users} from "lucide-react";
import {supabase} from "./config";

const initial={total:0,today:0,logged_in:0,guest:0,today_logged_in:0,today_guest:0,unique_sessions:0,today_unique_sessions:0};

export default function VisitorAnalytics(){
  const [stats,setStats]=useState(initial);
  const [error,setError]=useState("");
  const load=async()=>{
    if(!supabase)return;
    const {data,error}=await supabase.rpc("get_visitor_stats");
    if(error){setError(error.message);return;}
    setStats({...initial,...(data||{})});
  };
  useEffect(()=>{load();const t=setInterval(load,60000);return()=>clearInterval(t)},[]);
  return <section className="admin-card pb-visitor-card">
    <div className="card-head"><div><h2>Website Visitors</h2><small>Login aur without-login dono visitors</small></div><button onClick={load} type="button"><BarChart3 size={17}/> Refresh</button></div>
    {error?<p className="form-error">Visitor data load nahi hua: {error}</p>:<div className="pb-visitor-grid">
      <div><Eye/><span>Total Visits</span><strong>{Number(stats.total).toLocaleString()}</strong></div>
      <div><BarChart3/><span>Today</span><strong>{Number(stats.today).toLocaleString()}</strong></div>
      <div><Users/><span>Logged-in</span><strong>{Number(stats.logged_in).toLocaleString()}</strong></div>
      <div><Eye/><span>Guest</span><strong>{Number(stats.guest).toLocaleString()}</strong></div>
      <div><Users/><span>Today Logged-in</span><strong>{Number(stats.today_logged_in).toLocaleString()}</strong></div>
      <div><Eye/><span>Today Guest</span><strong>{Number(stats.today_guest).toLocaleString()}</strong></div>
      <div><Users/><span>Unique Sessions</span><strong>{Number(stats.unique_sessions).toLocaleString()}</strong></div>
      <div><Users/><span>Today Unique</span><strong>{Number(stats.today_unique_sessions).toLocaleString()}</strong></div>
    </div>}
  </section>;
}
