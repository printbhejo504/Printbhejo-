import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const ICE_SERVERS = [
  { urls: import.meta.env.VITE_STUN_SERVER || "stun:stun.l.google.com:19302" },
  ...(import.meta.env.VITE_TURN_SERVER
    ? [{
        urls: import.meta.env.VITE_TURN_SERVER,
        username: import.meta.env.VITE_TURN_USERNAME || "",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || ""
      }]
    : [])
];
