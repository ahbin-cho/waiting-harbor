import type { Lantern } from "./supabase";

const DAY = 86_400_000;

export const KINDS = ["군대", "장거리 연애", "해외에 있는 가족", "그 밖의 기다림"] as const;
/** 그리움 등불: 떠나보낸 사람이 어떤 사람이었는지 */
export const MISS_KINDS = ["가족", "친구", "반려동물", "그 밖의 그리움"] as const;

export const isMiss = (l: { mode?: string | null }) => l.mode === "miss";

/** 받침이 있으면 '을', 없으면 '를' */
export function josa(word: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? "을" : "를";
  return "를";
}

export function titleOf(l: Pick<Lantern, "who"> & { mode?: string | null }) {
  const w = l.who.trim() || "누군가";
  return `${w}${josa(w)} ${isMiss(l) ? "그리워하는" : "기다리는"} 사람`;
}

export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return y ? new Date(y, m - 1, d) : null;
}

export function daysLeft(l: Lantern) {
  const e = parseDate(l.end_date);
  return e ? Math.round((e.getTime() - today().getTime()) / DAY) : null;
}

export function progressOf(l: Lantern) {
  const s = parseDate(l.start_date);
  const e = parseDate(l.end_date);
  if (!s || !e || e <= s) return 0;
  return Math.min(1, Math.max(0, (today().getTime() - s.getTime()) / (e.getTime() - s.getTime())));
}

export function ddayText(n: number | null) {
  if (n == null) return "";
  if (n > 0) return `D-${n}`;
  if (n === 0) return "오늘 돌아와요";
  return "다시 만났어요";
}

/** 받침에 따라 조사를 골라요. 예: pick("지수", "은", "는") → "지수는" */
export function pick(word: string, withBatchim: string, without: string) {
  const c = word.charCodeAt(word.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return word + (has ? withBatchim : without);
}

/** 기다리기 시작한 날부터 오늘까지 며칠째인지 */
export function daysSince(l: Lantern) {
  const s = parseDate(l.start_date);
  return s ? Math.max(1, Math.round((today().getTime() - s.getTime()) / DAY) + 1) : null;
}

// ---------- 그리움 등불 ----------

/** 떠난 날부터 오늘까지 며칠 (떠난 날 당일은 0) */
export function daysGone(l: Lantern) {
  const e = parseDate(l.end_date);
  return e ? Math.max(0, Math.round((today().getTime() - e.getTime()) / DAY)) : 0;
}

/** 처음 만난 날부터 떠난 날까지 함께한 날 */
export function togetherDays(l: Lantern) {
  const s = parseDate(l.start_date), e = parseDate(l.end_date);
  return s && e ? Math.max(1, Math.round((e.getTime() - s.getTime()) / DAY) + 1) : 0;
}

/** 다음 기념일까지 며칠: 기일(떠난 날)과 처음 만난 날 중 가까운 쪽 */
export function nextAnniversary(l: Lantern) {
  const t = today();
  const until = (s: string) => {
    const d = parseDate(s);
    if (!d) return Infinity;
    let next = new Date(t.getFullYear(), d.getMonth(), d.getDate());
    if (next < t) next = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
    return Math.round((next.getTime() - t.getTime()) / DAY);
  };
  const gone = until(l.end_date), met = until(l.start_date);
  return gone <= met ? { days: gone, label: "기일" } : { days: met, label: "처음 만난 날" };
}

/**
 * 등불 밝기 0.3~1.
 * 기다림: 돌아올 날이 가까울수록. 그리움: 떠난 날이나 처음 만난 날이 다가올수록 (한 달 전부터).
 */
export function glowOf(l: Lantern) {
  if (isMiss(l)) return 0.45 + 0.55 * Math.max(0, 1 - nextAnniversary(l).days / 30);
  const n = daysLeft(l);
  return n != null && n <= 0 ? 1 : 0.3 + 0.7 * progressOf(l);
}

/** 이름표 아래 작은 글씨 */
export function badgeText(l: Lantern) {
  return isMiss(l) ? `떠난 지 ${daysGone(l)}일` : ddayText(daysLeft(l));
}
