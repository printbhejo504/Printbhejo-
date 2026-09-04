import React,{useEffect,useState} from "react";
import {Link2} from "lucide-react";
import {supabase} from "./config";

export default function ImportantLinksLive(){
 const [links,setLinks]=useState([]);
 const load=async()=>{if(!supabase)return;const {data,error}=await supabase.from("important_links").select("id,title,url,logo_url,created_at").order("created_at",{ascending:false});if(!error)setLinks(data||[])};
 useEffect(()=>{load();const c=supabase?.channel("important-links-live").on("postgres_changes",{event:"*",schema:"public",table:"important_links"},load).subscribe();return()=>{if(c)supabase.removeChannel(c)}},[]);
 if(!links.length)return null;
 return <div className="pb-live-links" aria-label="Admin added important links">{links.map(l=><a className="pb-live-link" href={l.url} target="_blank" rel="noopener noreferrer" key={l.id}>{l.logo_url?<img src={l.logo_url} alt=""/>:<span className="pb-live-link-icon"><Link2 size={18}/></span>}<span>{l.title}</span></a>)}</div>;
}
