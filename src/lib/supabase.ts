import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost", key ?? "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Lantern = {
  user_id: string;
  who: string;
  kind: string;
  start_date: string;
  end_date: string;
  line: string;
  place: string;
  color: string;
  shape: string;
  created_at: string;
};

export type Warmth = { from_id: string; to_id: string; day: string };
