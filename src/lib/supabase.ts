import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

export const supabase = createClient(url || "http://localhost", key || "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type Lantern = {
  /** 등불 하나하나의 아이디. 한 사람이 여러 개를 걸 수 있어요 */
  id: string;
  /** 등불을 건 사람 */
  user_id: string;
  who: string;
  kind: string;
  start_date: string;
  end_date: string;
  line: string;
  place: string;
  /** wait: 돌아올 사람을 기다려요, miss: 떠나보낸 사람을 그리워해요 */
  mode: string;
  /** 반려동물 그리움 등불: 어떤 아이였는지 (무지개마을에서 지내는 모습이 달라요) */
  species?: string | null;
  color: string;
  shape: string;
  created_at: string;
};

/** 온기: from_id 는 보낸 사람, to_id 는 받은 등불 */
export type Warmth = { from_id: string; to_id: string; day: string };

/** 기다림 일기: 등불 주인이 날마다 남기는 글 */
export type Note = { id: number; lantern_id: string; body: string; public: boolean; day: string; created_at: string };
