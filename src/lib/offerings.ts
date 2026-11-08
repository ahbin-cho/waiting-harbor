// 놓고 가는 것: 등불 앞에 하루 한 번, 작은 것 하나를 놓고 가요.
// 쌓인 것은 마을에서도 등불 발치(땅에 건 등불)와 곁의 작은 자리에 보여요. 빛은 내지 않아요.
import type { Lantern } from "./supabase";
import { isMiss } from "./waiting";

export const OFFERINGS = ["국화", "들꽃", "간식", "공", "종이배", "조약돌"] as const;
export type OfferingKind = (typeof OFFERINGS)[number];

/** 이름과 세는 말 */
export const OFFER_UNIT: Record<OfferingKind, string> = { 국화: "송이", 들꽃: "다발", 간식: "개", 공: "개", 종이배: "척", 조약돌: "개" };
/** 버튼과 안내에 쓰는 말 ("국화 한 송이") */
export const OFFER_ONE: Record<OfferingKind, string> = { 국화: "국화 한 송이", 들꽃: "들꽃 한 다발", 간식: "간식 하나", 공: "공 하나", 종이배: "종이배 하나", 조약돌: "조약돌 하나" };

/** 등불마다 놓을 수 있는 것: 기다림엔 들꽃과 종이배, 그리움엔 국화, 무지개마을 아이에겐 간식과 공도 */
export function offeringsFor(l: Pick<Lantern, "mode" | "place" | "start_date" | "end_date">): OfferingKind[] {
  if (l.place === "무지개") return ["국화", "간식", "공", "조약돌"];
  if (isMiss(l)) return ["국화", "들꽃", "조약돌"];
  return ["들꽃", "종이배", "조약돌"];
}

export const isOffering = (k: string): k is OfferingKind => (OFFERINGS as readonly string[]).includes(k);

/** "국화 12송이, 간식 3개" (많은 순) */
export function offeringSummary(counts: Partial<Record<OfferingKind, number>> | undefined) {
  if (!counts) return "";
  return (Object.entries(counts) as [OfferingKind, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}${OFFER_UNIT[k]}`)
    .join(", ");
}
