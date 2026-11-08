import type { Lantern } from "./supabase";

const DAY = 86_400_000;

export const KINDS = ["군대", "장거리 연애", "해외에 있는 가족", "그 밖의 기다림"] as const;

/** 받침이 있으면 '을', 없으면 '를' */
export function josa(word: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? "을" : "를";
  return "를";
}

export function titleOf(l: Pick<Lantern, "who">) {
  const w = l.who.trim() || "누군가";
  return `${w}${josa(w)} 기다리는 사람`;
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
