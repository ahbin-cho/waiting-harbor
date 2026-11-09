// 전역일 계산. 민법의 기간 계산(역에 의한 계산)을 따라요:
// 입대일부터 N개월 뒤의 같은 날 하루 전이 전역일이고, 그 달에 같은 날이 없으면 그 달 마지막 날이에요.

export const BRANCHES = [
  { id: "army", name: "육군", months: 18 },
  { id: "marine", name: "해병대", months: 18 },
  { id: "katusa", name: "카투사", months: 18 },
  { id: "navy", name: "해군", months: 20 },
  { id: "airforce", name: "공군", months: 21 },
  { id: "social", name: "사회복무요원", months: 21 },
] as const;
export type BranchId = (typeof BRANCHES)[number]["id"];

const DAY = 86_400_000;
export const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const between = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

export function dischargeDate(start: Date, months: number) {
  const y = start.getFullYear(), m = start.getMonth() + months, d = start.getDate();
  const last = new Date(y, m + 1, 0).getDate(); // 목표 달의 마지막 날
  return d > last ? new Date(y, m, last) : addDays(new Date(y, m, d), -1);
}

export function compute(startStr: string, branch: BranchId, now = new Date()) {
  const start = parse(startStr);
  const b = BRANCHES.find((x) => x.id === branch);
  if (!start || !b) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = dischargeDate(start, b.months);
  const total = between(start, end) + 1;
  const served = Math.min(total, Math.max(0, between(start, today) + 1));
  const left = between(today, end);
  const pct = Math.min(100, Math.max(0, (served / total) * 100));
  const marks = [
    { label: "100일", date: addDays(start, 99) },
    { label: "200일", date: addDays(start, 199) },
    { label: "300일", date: addDays(start, 299) },
    { label: "절반", date: addDays(start, Math.floor(total / 2) - 1) },
    { label: "500일", date: addDays(start, 499) },
    { label: "전역 D-100", date: addDays(end, -100) },
    { label: "전역 D-30", date: addDays(end, -30) },
  ]
    .filter((x) => x.date <= end && x.date >= start)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return { branch: b, start, end, total, served, left, pct, marks, today };
}

const WEEK = "일월화수목금토";
export const pretty = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;
