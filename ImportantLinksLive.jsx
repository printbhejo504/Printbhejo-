import React,{useEffect,useState} from "react";
import {Link2} from "lucide-react";
import {supabase} from "./config";

export default function ImportantLinksLive(){
 const [links,setLinks]=useState([]);
 const load=async()=>{if(!supabase)return;const {data,error}=await supabase.from("important_links").select("id,title,url,logo_url,created_at").order("created_at",{ascending:false});if(!error)setLinks(data||[])};
 useEffect(()=>{load();const c=supabase?.channel("important-links-live").on("postgres_changes",{event:"*",schema:"public",table:"important_links"},load).subscribe();return()=>{if(c)supabase.removeChannel(c)}},[]);
 if(!links.length)return null;
 return <>{links.map(l=>{let domain="";try{domain=new URL(l.url).hostname.replace(/^www\\./,"")}catch{}return <a className="link-card pb-live-link" href={l.url} target="_blank" rel="noopener noreferrer" key={l.id}>{l.logo_url?<img className="link-logo" src={l.logo_url} alt=""/>:<span className="pb-live-link-icon"><Link2 size={22}/></span>}<div><strong>{l.title}</strong><span>Official website</span><small>{domain||l.url}</small></div><Link2 size={20}/></a>})}</>;
}
