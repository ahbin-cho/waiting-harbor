// 놓고 가는 것: 등불 앞에 하루 한 번, 작은 것 하나를 놓고 가요.
// 쌓인 것은 마을에서도 등불 발치(땅에 건 등불)와 곁의 작은 자리에 보여요. 빛은 내지 않아요.
import type { Lantern } from "./supabase";
import { isMiss } from "./waiting";

export const OFFERINGS = [
  "국화", "들꽃", "간식", "공", "종이배", "조약돌",
  "편지", "위문상자", "핫팩", "종이비행기", "풍선", "도시락", "찻잔",
  "츄르", "상자", "해바라기씨", "방울", "먹이", "당근", "상추", "뼈다귀",
] as const;
export type OfferingKind = (typeof OFFERINGS)[number];

/** 이름과 세는 말 */
export const OFFER_UNIT: Record<OfferingKind, string> = {
  국화: "송이", 들꽃: "다발", 간식: "개", 공: "개", 종이배: "척", 조약돌: "개",
  편지: "통", 위문상자: "상자", 핫팩: "개", 종이비행기: "개", 풍선: "개", 도시락: "개", 찻잔: "잔",
  츄르: "개", 상자: "개", 해바라기씨: "줌", 방울: "개", 먹이: "줌", 당근: "개", 상추: "장", 뼈다귀: "개",
};
/** 버튼과 안내에 쓰는 말 ("국화 한 송이") */
export const OFFER_ONE: Record<OfferingKind, string> = {
  국화: "국화 한 송이", 들꽃: "들꽃 한 다발", 간식: "간식 하나", 공: "공 하나", 종이배: "종이배 하나", 조약돌: "조약돌 하나",
  편지: "편지 한 통", 위문상자: "위문 상자 하나", 핫팩: "핫팩 하나", 종이비행기: "종이비행기 하나", 풍선: "풍선 하나", 도시락: "도시락 하나", 찻잔: "차 한 잔",
  츄르: "츄르 하나", 상자: "빈 상자 하나", 해바라기씨: "해바라기씨 한 줌", 방울: "방울 하나", 먹이: "먹이 한 줌", 당근: "당근 하나", 상추: "상추 한 장", 뼈다귀: "뼈다귀 장난감 하나",
};

/**
 * 등불마다 놓을 수 있는 것: 그 기다림, 그 사람, 그 아이에게 어울리는 것으로.
 * 군대엔 편지·위문 상자·핫팩, 멀리 있는 사람엔 종이비행기, 해외 가족엔 도시락,
 * 그리운 사람엔 국화·편지·차 한 잔, 무지개마을 아이는 종류마다 좋아하던 것.
 */
export function offeringsFor(l: Pick<Lantern, "mode" | "place" | "kind"> & { species?: string | null }): OfferingKind[] {
  if (l.place === "무지개") {
    switch (l.species) {
      case "강아지": return ["국화", "간식", "공", "뼈다귀"];
      case "고양이": return ["국화", "츄르", "상자", "공"];
      case "새": return ["국화", "해바라기씨", "방울"];
      case "물고기": return ["국화", "먹이", "조약돌"];
      case "햄스터·토끼": return ["국화", "해바라기씨", "당근"];
      case "거북이·도마뱀": return ["국화", "상추", "조약돌"];
      case "곤충": return ["국화", "들꽃", "상추"];
      default: return ["국화", "간식", "공"];
    }
  }
  if (isMiss(l)) return ["국화", "들꽃", "편지", "찻잔"];
  switch (l.kind) {
    case "군대": return ["편지", "위문상자", "핫팩"];
    case "장거리 연애": return ["편지", "종이비행기", "풍선"];
    case "해외에 있는 가족": return ["편지", "종이비행기", "도시락"];
    default: return ["편지", "들꽃", "풍선"];
  }
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
