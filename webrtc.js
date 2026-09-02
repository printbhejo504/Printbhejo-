import { ICE_SERVERS, supabase } from "./config";

const CHUNK_SIZE = 64 * 1024;
const MAX_BUFFERED = 4 * 1024 * 1024;
const LOW_BUFFERED = 1 * 1024 * 1024;
const PERMANENT_SESSION_EXPIRY = "2099-12-31T23:59:59.000Z";

export function makePeerId() { const bytes = crypto.getRandomValues(new Uint8Array(16)); return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }

function generatePin() { const letters="ABCDEFGHJKLMNPQRSTUVWXYZ"; const values=crypto.getRandomValues(new Uint32Array(4)); return letters[values[0]%letters.length]+values.slice(1).map(n=>String(n%10)).join(""); }

async function getPermanentPin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: profile, error } = await supabase.from("profiles").select("permanent_pin").eq("id", user.id).maybeSingle();
  if (error) throw error;

  if (!profile) {
    const { data: created, error: createError } = await supabase.from("profiles").insert({ id: user.id, full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "PrintBhejo User", role: "user", disabled: false }).select("permanent_pin").single();
    if (createError) throw createError;
    profile = created;
  }

  if (profile?.permanent_pin && /^[A-Z][0-9]{3}$/.test(profile.permanent_pin)) return profile.permanent_pin;

  for (let attempt = 0; attempt < 8; attempt++) {
    const pin = generatePin();
    const { data: updated, error: updateError } = await supabase.from("profiles").update({ permanent_pin: pin }).eq("id", user.id).select("permanent_pin").maybeSingle();
    if (updateError) {
      if (updateError.code === "23505") continue;
      throw updateError;
    }
    if (updated?.permanent_pin) return updated.permanent_pin;
    const { data: latest } = await supabase.from("profiles").select("permanent_pin").eq("id", user.id).maybeSingle();
    if (latest?.permanent_pin && /^[A-Z][0-9]{3}$/.test(latest.permanent_pin)) return latest.permanent_pin;
  }
  throw new Error("Permanent PIN generate nahi ho saka. Please try again.");
}

export async function createSession(pin) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const permanentPin = await getPermanentPin();
  const sessionPin = permanentPin || pin;
  const expires = permanentPin ? PERMANENT_SESSION_EXPIRY : new Date(Date.now() + 10 * 60 * 1000).toISOString();

  if (permanentPin) {
    const { data: existing, error: findError } = await supabase.from("transfer_sessions").select("id,pin,created_at,expires_at,status").eq("pin", sessionPin).eq("status", "active").gt("expires_at", new Date().toISOString()).maybeSingle();
    if (findError) throw findError;
    if (existing) return existing;
  }

  const { data, error } = await supabase.from("transfer_sessions").insert({ pin: sessionPin, expires_at: expires, status: "active" }).select("id,pin,created_at,expires_at,status").single();
  if (error) {
    if (permanentPin && error.code === "23505") {
      const { data: existing } = await supabase.from("transfer_sessions").select("id,pin,created_at,expires_at,status").eq("pin",sessionPin).eq("status","active").maybeSingle();
      if (existing) return existing;
    }
    throw error;
  }
  return data;
}

export async function findSession(pin) { if (!supabase) throw new Error("Supabase is not configured."); const {data,error}=await supabase.from("transfer_sessions").select("id,pin,created_at,expires_at,status").eq("pin",pin).eq("status","active").gt("expires_at",new Date().toISOString()).maybeSingle(); if(error)throw error; return data; }
export async function sendSignal(sessionId,senderId,type,payload){if(!supabase)throw new Error("Supabase is not configured.");const expires=new Date(Date.now()+10*60*1000).toISOString();const{error}=await supabase.from("webrtc_signals").insert({session_id:sessionId,sender_id:senderId,type,payload,expires_at:expires});if(error)throw error;}
export function subscribeSignals(sessionId,callback,onError){if(!supabase)throw new Error("Supabase is not configured.");const channel=supabase.channel(`printbhejo-signals-${sessionId}-${Math.random().toString(36).slice(2)}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"webrtc_signals",filter:`session_id=eq.${sessionId}`},payload=>callback(payload.new)).subscribe(status=>{if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")onError?.(new Error(`Supabase Realtime ${status.toLowerCase().replace("_"," ")}.`));});return()=>{supabase.removeChannel(channel);};}
function waitForBufferedAmountLow(channel){return new Promise(resolve=>{if(channel.bufferedAmount<=LOW_BUFFERED)return resolve();const previous=channel.onbufferedamountlow;channel.bufferedAmountLowThreshold=LOW_BUFFERED;channel.onbufferedamountlow=()=>{channel.onbufferedamountlow=previous;resolve();};});}
export async function sendFileOverDataChannel(channel,file,onProgress,batchId){const fileId=batchId?`${batchId}:${crypto.randomUUID()}`:crypto.randomUUID();const totalChunks=Math.ceil(file.size/CHUNK_SIZE);channel.send(JSON.stringify({type:"file-start",fileId,batchId,fileName:file.name,fileType:file.type||"application/octet-stream",fileSize:file.size,totalChunks}));let offset=0,index=0;while(offset<file.size){if(channel.readyState!=="open")throw new Error("P2P connection closed.");if(channel.bufferedAmount>MAX_BUFFERED)await waitForBufferedAmountLow(channel);const chunk=await file.slice(offset,offset+CHUNK_SIZE).arrayBuffer();channel.send(chunk);offset+=chunk.byteLength;index++;onProgress?.({sent:offset,total:file.size,percent:Math.round(offset/file.size*100)});if(index%16===0)await new Promise(r=>setTimeout(r,0));}channel.send(JSON.stringify({type:"file-complete",fileId,batchId}));}
export function createReceiverPeer({sessionId,peerId,onFile,onStatus}){const pc=new RTCPeerConnection({iceServers:ICE_SERVERS});let current=null,remoteDescriptionSet=false;const pendingIce=[],messageQueue=[];let processingQueue=false;const processMessageQueue=async()=>{if(processingQueue)return;processingQueue=true;try{while(messageQueue.length){const data=messageQueue.shift();if(typeof data==="string"){const msg=JSON.parse(data);if(msg.type==="file-start"){if(current)throw new Error("Received a new file before the previous file was finalized.");current={...msg, fileId:msg.fileId, batchId:msg.batchId||String(msg.fileId||"").split(":")[0],chunks:[],received:0};onStatus?.("receiving",0,msg.fileSize);}else if(msg.type==="file-complete"&&current?.fileId===msg.fileId){if(current.received!==current.fileSize)throw new Error(`Incomplete file received: ${current.fileName}`);const finished=current;current=null;const blob=new Blob(finished.chunks,{type:finished.fileType});await onFile?.({...finished,blob});}}else if(current){current.chunks.push(data);current.received+=data.byteLength;onStatus?.("receiving",current.received,current.fileSize);}}}catch(error){current=null;onStatus?.("error",error);}finally{processingQueue=false;if(messageQueue.length)processMessageQueue();}};const channelHandler=channel=>{channel.binaryType="arraybuffer";channel.onopen=()=>onStatus?.("connected");channel.onclose=()=>onStatus?.("disconnected");channel.onerror=()=>onStatus?.("error");channel.onmessage=event=>{messageQueue.push(event.data);processMessageQueue();};};pc.ondatachannel=e=>channelHandler(e.channel);pc.onicecandidate=e=>{if(e.candidate)sendSignal(sessionId,peerId,"ice-candidate",e.candidate.toJSON()).catch(()=>{});};return{pc,handleOffer:async offer=>{await pc.setRemoteDescription(offer);remoteDescriptionSet=true;while(pendingIce.length)await pc.addIceCandidate(pendingIce.shift());const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await sendSignal(sessionId,peerId,"answer",answer);},addIce:async candidate=>{if(!candidate)return;if(!remoteDescriptionSet)pendingIce.push(candidate);else await pc.addIceCandidate(candidate);},close:()=>pc.close()};}
export function createSenderPeer({sessionId,peerId,onStatus,onProgress}){const pc=new RTCPeerConnection({iceServers:ICE_SERVERS});const channel=pc.createDataChannel("files",{ordered:true});channel.binaryType="arraybuffer";let remoteDescriptionSet=false;const pendingIce=[];let activeBatchId=null,lastFileCompletedAt=0;channel.onopen=()=>onStatus?.("connected");channel.onclose=()=>onStatus?.("disconnected");channel.onerror=()=>onStatus?.("error");pc.onicecandidate=e=>{if(e.candidate)sendSignal(sessionId,peerId,"ice-candidate",e.candidate.toJSON()).catch(()=>{});};return{pc,channel,createOffer:async()=>{const offer=await pc.createOffer();await pc.setLocalDescription(offer);await sendSignal(sessionId,peerId,"offer",offer);},handleAnswer:async answer=>{await pc.setRemoteDescription(answer);remoteDescriptionSet=true;while(pendingIce.length)await pc.addIceCandidate(pendingIce.shift());},addIce:async candidate=>{if(!candidate)return;if(!remoteDescriptionSet)pendingIce.push(candidate);else await pc.addIceCandidate(candidate);},sendFile:async file=>{if(!activeBatchId||Date.now()-lastFileCompletedAt>500)activeBatchId=crypto.randomUUID();const batch=activeBatchId;await sendFileOverDataChannel(channel,file,onProgress,batch);lastFileCompletedAt=Date.now();return batch;},close:()=>pc.close()};}
