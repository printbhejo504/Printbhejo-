import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://zbajuyfedkgmjmmaadiy.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const supabase = SUPABASE_PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    })
  : null;

export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  configured: Boolean(SUPABASE_PUBLISHABLE_KEY),
};
