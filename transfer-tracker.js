import { supabase } from "./config";

export async function recordTransfer({sessionId,fileName,fileSize,status="completed"}){
  if(!supabase)return;
  try{
    const {data:{user}}=await supabase.auth.getUser();
    const {error}=await supabase.from("transfer_events").insert({
      user_id:user?.id||null,
      session_id:sessionId||null,
      file_name:String(fileName||"File"),
      file_size:Number(fileSize||0),
      status
    });
    if(error)console.warn("PrintBhejo transfer tracking failed:",error.message);
  }catch(error){
    console.warn("PrintBhejo transfer tracking failed:",error?.message||error);
  }
}
