// 공유 링크용: Supabase 에서 등불 하나를 읽고, 한국 시간 기준으로 D-day 를 계산해요.

export type SharedLantern = {
  user_id: string;
  who: string;
  kind: string;
  place: string;
  color: string;
  shape: string;
  start_date: string;
  end_date: string;
  line: string;
};

export const COLORS: Record<string, string> = {
  촛불: "#FFB867", 노을: "#FF8E6E", 달빛: "#F4E6C6", 벚꽃: "#FFB0C8", 라벤더: "#BFA8FF", 하늘: "#8FCBFF", 새싹: "#B4E58A",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getLantern(id: string | null): Promise<SharedLantern | null> {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!id || !UUID.test(id) || !url || !key) return null;
  const res = await fetch(
    `${url}/rest/v1/lanterns?user_id=eq.${id}&select=user_id,who,kind,place,color,shape,start_date,end_date,line&limit=1`,
    { headers: { apikey: key, Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as SharedLantern[];
  return rows[0] ?? null;
}

const DAY = 86_400_000;
/** 한국 시간 오늘 0시 (UTC 서버에서도 날짜가 하루 어긋나지 않게) */
function todayKST() {
  const now = new Date(Date.now() + 9 * 3600_000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function facts(l: SharedLantern) {
  const t = todayKST();
  const left = Math.round((parse(l.end_date) - t) / DAY);
  const since = Math.max(1, Math.round((t - parse(l.start_date)) / DAY) + 1);
  const dday = left > 0 ? `D-${left}` : left === 0 ? "오늘 돌아와요" : "다시 만났어요";
  return { left, since, dday };
}

export function pick(word: string, withBatchim: string, without: string) {
  const c = word.charCodeAt(word.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (has ? withBatchim : without);
}

export const titleOf = (l: SharedLantern) => `${pick(l.who.trim() || "누군가", "을", "를")} 기다리는 사람`;

export function summary(l: SharedLantern) {
  const f = facts(l);
  if (f.left > 0) return `기다린 지 ${f.since}일째, ${f.left}일 남았어요. ${l.place}에 걸린 등불이에요.`;
  if (f.left === 0) return `오늘 ${pick(l.who, "이", "가")} 돌아와요. ${l.place}에 걸린 등불이에요.`;
  return `${f.since}일을 기다려 다시 만났어요. 등불은 하늘로 올라갔어요.`;
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
