import { ICE_SERVERS, supabase } from "./config";

const CHUNK_SIZE = 64 * 1024;
const MAX_BUFFERED = 4 * 1024 * 1024;
const LOW_BUFFERED = 1 * 1024 * 1024;
const MAX_SENDERS_PER_RECEIVER = 8;
const PEER_CLEANUP_DELAY = 15_000;
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
    if (updateError) { if (updateError.code === "23505") continue; throw updateError; }
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
    const { data: ensured, error: ensureError } = await supabase.rpc("ensure_permanent_transfer_session", { p_pin: permanentPin });
    if (ensureError) throw ensureError;
    if (ensured) { const row = Array.isArray(ensured) ? ensured[0] : ensured; if (row?.id) return row; }
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

export async function findSession(pin) { if (!supabase) throw new Error("Supabase is not configured."); const normalized=String(pin||"").trim().toUpperCase(); const {data,error}=await supabase.from("transfer_sessions").select("id,pin,created_at,expires_at,status").eq("pin",normalized).eq("status","active").gt("expires_at",new Date().toISOString()).maybeSingle(); if(error)throw error; return data; }
export async function sendSignal(sessionId,senderId,type,payload){if(!supabase)throw new Error("Supabase is not configured.");const expires=new Date(Date.now()+10*60*1000).toISOString();const{error}=await supabase.from("webrtc_signals").insert({session_id:sessionId,sender_id:senderId,type,payload,expires_at:expires});if(error)throw error;}
export function subscribeSignals(sessionId,callback,onError){if(!supabase)throw new Error("Supabase is not configured.");const channel=supabase.channel(`printbhejo-signals-${sessionId}-${Math.random().toString(36).slice(2)}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"webrtc_signals",filter:`session_id=eq.${sessionId}`},payload=>callback(payload.new)).subscribe(status=>{if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")onError?.(new Error(`Supabase Realtime ${status.toLowerCase().replace("_"," ")}.`));});return()=>{supabase.removeChannel(channel);};}

function assertWebRTCSupport(){if(typeof window==="undefined"||typeof window.RTCPeerConnection!=="function")throw new Error("This browser does not support WebRTC file transfer. Please use a newer browser.");if(!window.isSecureContext)throw new Error("Secure connection (HTTPS) is required for browser-to-browser transfer.");}
function attachConnectionDiagnostics(pc,onStatus){
  const report=()=>{const state=pc.connectionState||pc.iceConnectionState;if(state==="connected"||state==="completed")onStatus?.("connected");else if(state==="failed")onStatus?.("error",new Error("WebRTC network connection failed. Try another network or enable TURN on the server."));else if(state==="disconnected")onStatus?.("disconnected");};
  pc.onconnectionstatechange=report;
  pc.oniceconnectionstatechange=report;
  pc.onicecandidateerror=()=>{};
}

async function waitForBufferedAmountLow(channel){while(channel.bufferedAmount>LOW_BUFFERED){if(channel.readyState!=="open")throw new Error("P2P connection closed while sending.");await new Promise(resolve=>setTimeout(resolve,20));}}

export async function sendFileOverDataChannel(channel,file,onProgress,batchId,waitForAck,fileIdOverride){
  if(channel.readyState!=="open")throw new Error("P2P connection is not ready. Please reconnect.");
  const fileId=fileIdOverride||(batchId?`${batchId}:${crypto.randomUUID()}`:crypto.randomUUID());
  const totalChunks=Math.ceil(file.size/CHUNK_SIZE);
  channel.send(JSON.stringify({type:"file-start",fileId,batchId,fileName:file.name,fileType:file.type||"application/octet-stream",fileSize:file.size,totalChunks}));
  let offset=0,index=0;
  while(offset<file.size){
    if(channel.readyState!=="open")throw new Error("P2P connection closed.");
    if(channel.bufferedAmount>MAX_BUFFERED)await waitForBufferedAmountLow(channel);
    const chunk=await file.slice(offset,offset+CHUNK_SIZE).arrayBuffer();
    channel.send(chunk); offset+=chunk.byteLength; index++;
    onProgress?.({sent:offset,total:file.size,percent:Math.round(offset/file.size*100)});
    if(index%16===0)await new Promise(r=>setTimeout(r,0));
  }
  channel.send(JSON.stringify({type:"file-complete",fileId,batchId}));
  if(waitForAck)await waitForAck(fileId);
}

export function createReceiverPeer({sessionId,peerId,onFile,onStatus,onPeersChange}){
  assertWebRTCSupport();
  const peers=new Map();
  const notifyPeers=()=>onPeersChange?.(Array.from(peers.entries()).map(([id,state])=>({peerId:id,connectionState:state.pc.connectionState||state.pc.iceConnectionState||"new",connected:state.connected,connectedAt:state.connectedAt}))); 
  const scheduleCleanup=(senderPeerId,state)=>{if(state.cleanupTimer)clearTimeout(state.cleanupTimer);state.cleanupTimer=setTimeout(()=>{const current=peers.get(senderPeerId);if(current!==state)return;state.channels.forEach(ch=>{try{ch.close()}catch{}});try{state.pc.close()}catch{};peers.delete(senderPeerId);notifyPeers();},PEER_CLEANUP_DELAY);};
  const makeReceiver=(senderPeerId)=>{
    if(peers.has(senderPeerId))return peers.get(senderPeerId);
    if(peers.size>=MAX_SENDERS_PER_RECEIVER)throw new Error(`Receiver is full. Maximum ${MAX_SENDERS_PER_RECEIVER} senders can be connected at once.`);
    const pc=new RTCPeerConnection({iceServers:ICE_SERVERS});
    const state={pc,remoteDescriptionSet:false,pendingIce:[],channels:new Set(),connected:false,connectedAt:null,cleanupTimer:null};
    peers.set(senderPeerId,state); notifyPeers();
    const channelHandler=channel=>{
      state.channels.add(channel); if(state.cleanupTimer)clearTimeout(state.cleanupTimer); channel.binaryType="arraybuffer";
      let current=null; const messageQueue=[]; let processingQueue=false;
      const processMessageQueue=async()=>{
        if(processingQueue)return; processingQueue=true;
        try{
          while(messageQueue.length){
            const item=messageQueue.shift(); const data=item.data;
            if(typeof data==="string"){
              const msg=JSON.parse(data);
              if(msg.type==="file-start"){
                if(current)throw new Error("Received a new file before the previous file was finalized.");
                current={...msg,fileId:msg.fileId,batchId:msg.batchId||String(msg.fileId||"").split(":")[0],chunks:[],received:0};
                onStatus?.("receiving",0,msg.fileSize,senderPeerId);
              }else if(msg.type==="file-complete"&&current?.fileId===msg.fileId){
                if(current.received!==current.fileSize)throw new Error(`Incomplete file received: ${current.fileName}`);
                const finished=current; current=null;
                const blob=new Blob(finished.chunks,{type:finished.fileType});
                await onFile?.({...finished,blob,senderPeerId});
                if(channel.readyState==="open")channel.send(JSON.stringify({type:"file-ack",fileId:finished.fileId,batchId:finished.batchId}));
                onStatus?.("file-complete",finished.received,finished.fileSize,senderPeerId);
              }
            }else if(current){current.chunks.push(data);current.received+=data.byteLength;onStatus?.("receiving",current.received,current.fileSize,senderPeerId);}
          }
        }catch(error){current=null;onStatus?.("error",error,senderPeerId);}
        finally{processingQueue=false;if(messageQueue.length)processMessageQueue();}
      };
      channel.onopen=()=>{state.connected=true;state.connectedAt=state.connectedAt||Date.now();if(state.cleanupTimer)clearTimeout(state.cleanupTimer);notifyPeers();onStatus?.("connected",undefined,undefined,senderPeerId);};
      channel.onclose=()=>{state.channels.delete(channel);if(state.channels.size===0){state.connected=false;notifyPeers();scheduleCleanup(senderPeerId,state);}onStatus?.("disconnected",undefined,undefined,senderPeerId);};
      channel.onerror=()=>onStatus?.("error",new Error("P2P data channel error."),senderPeerId);
      channel.onmessage=event=>{messageQueue.push({data:event.data});processMessageQueue();};
    };
    pc.ondatachannel=e=>channelHandler(e.channel);
    pc.onicecandidate=e=>{if(e.candidate)sendSignal(sessionId,peerId,"ice-candidate",{...e.candidate.toJSON(),toPeerId:senderPeerId,fromPeerId:peerId}).catch(()=>{});};
    attachConnectionDiagnostics(pc,(stateName,error)=>{if(stateName==="connected"){state.connected=true;state.connectedAt=state.connectedAt||Date.now();if(state.cleanupTimer)clearTimeout(state.cleanupTimer);}if(stateName==="disconnected"||stateName==="error"){if(stateName==="disconnected")scheduleCleanup(senderPeerId,state);}notifyPeers();onStatus?.(stateName,error,undefined,senderPeerId);});
    return state;
  };
  return {
    pc:null,
    getPeerCount:()=>Array.from(peers.values()).filter(p=>p.connected).length,
    getPeers:()=>Array.from(peers.entries()).map(([id,state])=>({peerId:id,connected:state.connected,connectedAt:state.connectedAt,connectionState:state.pc.connectionState||state.pc.iceConnectionState||"new"})),
    handleOffer:async offer=>{
      const senderPeerId=offer?.fromPeerId||offer?.peerId;
      if(!senderPeerId)throw new Error("Sender identity missing from offer.");
      const state=makeReceiver(senderPeerId); if(state.cleanupTimer)clearTimeout(state.cleanupTimer);
      await state.pc.setRemoteDescription({type:offer.type,sdp:offer.sdp}); state.remoteDescriptionSet=true;
      while(state.pendingIce.length)await state.pc.addIceCandidate(state.pendingIce.shift());
      const answer=await state.pc.createAnswer(); await state.pc.setLocalDescription(answer);
      await sendSignal(sessionId,peerId,"answer",{type:answer.type,sdp:answer.sdp,toPeerId:senderPeerId,fromPeerId:peerId});
    },
    addIce:async candidate=>{
      const senderPeerId=candidate?.fromPeerId;
      if(!senderPeerId)return;
      const state=makeReceiver(senderPeerId); const clean={candidate:candidate.candidate,sdpMid:candidate.sdpMid,sdpMLineIndex:candidate.sdpMLineIndex,usernameFragment:candidate.usernameFragment};
      if(!state.remoteDescriptionSet)state.pendingIce.push(clean);else await state.pc.addIceCandidate(clean);
    },
    close:()=>{peers.forEach(({pc,channels,cleanupTimer})=>{if(cleanupTimer)clearTimeout(cleanupTimer);channels.forEach(ch=>{try{ch.close()}catch{}});try{pc.close()}catch{}});peers.clear();notifyPeers();}
  };
}

export function createSenderPeer({sessionId,peerId,onStatus,onProgress}){
  assertWebRTCSupport();
  const pc=new RTCPeerConnection({iceServers:ICE_SERVERS});
  const channel=pc.createDataChannel("files",{ordered:true}); channel.binaryType="arraybuffer";
  let remoteDescriptionSet=false;const pendingIce=[];let activeBatchId=null;let sendQueue=Promise.resolve();
  const pendingAcks=new Map();
  const waitForAck=fileId=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingAcks.delete(fileId);reject(new Error("Receiver did not confirm the file. Please try sending again."));},30000);pendingAcks.set(fileId,{resolve,reject,timer});});
  channel.onmessage=event=>{if(typeof event.data!=="string")return;try{const msg=JSON.parse(event.data);if(msg.type==="file-ack"){const pending=pendingAcks.get(msg.fileId);if(pending){clearTimeout(pending.timer);pendingAcks.delete(msg.fileId);pending.resolve();}}}catch{}};
  channel.onopen=()=>onStatus?.("connected");
  channel.onclose=()=>{pendingAcks.forEach(p=>{clearTimeout(p.timer);p.reject(new Error("P2P connection closed."));});pendingAcks.clear();onStatus?.("disconnected");};
  channel.onerror=()=>onStatus?.("error",new Error("P2P data channel error."));
  pc.onicecandidate=e=>{if(e.candidate)sendSignal(sessionId,peerId,"ice-candidate",{...e.candidate.toJSON(),fromPeerId:peerId,toPeerId:null}).catch(()=>{});};
  attachConnectionDiagnostics(pc,onStatus);
  return{
    pc,channel,
    createOffer:async()=>{const offer=await pc.createOffer();await pc.setLocalDescription(offer);await sendSignal(sessionId,peerId,"offer",{type:offer.type,sdp:offer.sdp,fromPeerId:peerId});},
    handleAnswer:async answer=>{if(answer?.toPeerId&&answer.toPeerId!==peerId)return;await pc.setRemoteDescription({type:answer.type,sdp:answer.sdp});remoteDescriptionSet=true;while(pendingIce.length)await pc.addIceCandidate(pendingIce.shift());},
    addIce:async candidate=>{if(candidate?.toPeerId&&candidate.toPeerId!==peerId)return;const clean={candidate:candidate.candidate,sdpMid:candidate.sdpMid,sdpMLineIndex:candidate.sdpMLineIndex,usernameFragment:candidate.usernameFragment};if(!remoteDescriptionSet)pendingIce.push(clean);else await pc.addIceCandidate(clean);},
    sendFile:file=>{sendQueue=sendQueue.catch(()=>{}).then(async()=>{if(channel.readyState!=="open")throw new Error("P2P connection is not ready. Please reconnect.");if(!activeBatchId)activeBatchId=crypto.randomUUID();const batch=activeBatchId;const fileId=`${batch}:${crypto.randomUUID()}`;const ackPromise=waitForAck(fileId);await sendFileOverDataChannel(channel,file,onProgress,batch,()=>ackPromise,fileId);return batch;});return sendQueue;},
    close:()=>pc.close()
  };
}
