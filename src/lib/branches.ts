// 군대를 기다릴 때 고르는 군 종류. 전역일 계산(복무 개월)과 도착 안내판 꾸밈(색, 돌아오는 탈것)에 써요.
// 실제 부대 마크나 문장은 쓰지 않고, 색과 탈것으로만 살짝 구분해요.
import { dischargeDate } from "../discharge/calc";

export type BranchName = "육군" | "해군" | "공군" | "해병대" | "카투사" | "사회복무요원";
/** 돌아오는 탈것: 버스(집으로), 배(항구로), 비행기(활주로로) */
export type Vehicle = "bus" | "ship" | "jet";

export const ARMY: { name: BranchName; months: number; color: string; accent: string; vehicle: Vehicle; say: string }[] = [
  { name: "육군", months: 18, color: "#5C6B3C", accent: "#F1ECD2", vehicle: "bus", say: "휴가 버스를 타고 집으로" },
  { name: "해군", months: 20, color: "#1F3B6B", accent: "#F4F1E8", vehicle: "ship", say: "배를 타고 항구로" },
  { name: "공군", months: 21, color: "#2F6FA8", accent: "#F4F7FB", vehicle: "jet", say: "비행기를 타고 활주로로" },
  { name: "해병대", months: 18, color: "#9C2A24", accent: "#F2C230", vehicle: "ship", say: "배를 타고 항구로" },
  { name: "카투사", months: 18, color: "#3F4B2E", accent: "#E9E4CC", vehicle: "bus", say: "휴가 버스를 타고 집으로" },
  { name: "사회복무요원", months: 21, color: "#4D5B6B", accent: "#EEF1F4", vehicle: "bus", say: "버스를 타고 집으로" },
];

export const branchOf = (b: string | null | undefined) => ARMY.find((x) => x.name === b);

/** 입대일과 군 종류로 전역일 (YYYY-MM-DD) */
export function dischargeOf(start: string, b: string | null | undefined) {
  const br = branchOf(b);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start);
  if (!br || !m) return "";
  const d = dischargeDate(new Date(+m[1], +m[2] - 1, +m[3]), br.months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
