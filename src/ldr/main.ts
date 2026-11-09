import "../styles.css";
import "../discharge/page.css";
import { applyUiTheme } from "../lib/theme";

// 장거리 연애 디데이·시차 계산기: 밝은 새벽 색의 글 페이지
applyUiTheme("dawn");

const CITIES: [string, string][] = [
  ["서울", "Asia/Seoul"], ["도쿄", "Asia/Tokyo"], ["오사카", "Asia/Tokyo"], ["베이징", "Asia/Shanghai"], ["상하이", "Asia/Shanghai"],
  ["홍콩", "Asia/Hong_Kong"], ["타이베이", "Asia/Taipei"], ["싱가포르", "Asia/Singapore"], ["방콕", "Asia/Bangkok"], ["호찌민", "Asia/Ho_Chi_Minh"],
  ["하노이", "Asia/Ho_Chi_Minh"], ["마닐라", "Asia/Manila"], ["자카르타", "Asia/Jakarta"], ["쿠알라룸푸르", "Asia/Kuala_Lumpur"], ["뉴델리", "Asia/Kolkata"],
  ["두바이", "Asia/Dubai"], ["이스탄불", "Europe/Istanbul"], ["모스크바", "Europe/Moscow"], ["런던", "Europe/London"], ["더블린", "Europe/Dublin"],
  ["파리", "Europe/Paris"], ["베를린", "Europe/Berlin"], ["암스테르담", "Europe/Amsterdam"], ["프라하", "Europe/Prague"], ["빈", "Europe/Vienna"],
  ["로마", "Europe/Rome"], ["마드리드", "Europe/Madrid"], ["바르셀로나", "Europe/Madrid"], ["취리히", "Europe/Zurich"], ["스톡홀름", "Europe/Stockholm"],
  ["시드니", "Australia/Sydney"], ["멜버른", "Australia/Melbourne"], ["브리즈번", "Australia/Brisbane"], ["퍼스", "Australia/Perth"], ["오클랜드", "Pacific/Auckland"],
  ["뉴욕", "America/New_York"], ["보스턴", "America/New_York"], ["워싱턴 D.C.", "America/New_York"], ["토론토", "America/Toronto"], ["애틀랜타", "America/New_York"],
  ["시카고", "America/Chicago"], ["댈러스", "America/Chicago"], ["휴스턴", "America/Chicago"], ["덴버", "America/Denver"], ["로스앤젤레스", "America/Los_Angeles"],
  ["샌프란시스코", "America/Los_Angeles"], ["시애틀", "America/Los_Angeles"], ["밴쿠버", "America/Vancouver"], ["호놀룰루", "Pacific/Honolulu"], ["멕시코시티", "America/Mexico_City"],
  ["상파울루", "America/Sao_Paulo"],
];

const DAY = 86_400_000;
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const between = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const pretty = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`;

/** 그 도시의 지금 UTC 와의 차이(분). 서머타임도 오늘 기준으로 반영돼요. */
function offsetMin(tz: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, +p.value]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - at.getTime()) / 60000);
}
const clock = (tz: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: tz, month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date());
const hourText = (h: number) => (h === 0 ? "자정" : h === 12 ? "낮 12시" : h < 12 ? `오전 ${h}시` : `오후 ${h - 12}시`);

const meetEl = document.querySelector<HTMLInputElement>("#meet")!;
const sinceEl = document.querySelector<HTMLInputElement>("#since")!;
const mineEl = document.querySelector<HTMLSelectElement>("#mine")!;
const theirsEl = document.querySelector<HTMLSelectElement>("#theirs")!;
const out = document.querySelector<HTMLElement>("#result")!;

for (const sel of [mineEl, theirsEl]) {
  CITIES.forEach(([name], i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = name;
    sel.append(o);
  });
}
const q = new URLSearchParams(location.search);
mineEl.value = q.get("a") ?? "0";
theirsEl.value = q.get("b") ?? String(CITIES.findIndex(([n]) => n === "뉴욕"));
if (q.get("m")) meetEl.value = q.get("m")!;
if (q.get("s")) sinceEl.value = q.get("s")!;

function text(tag: string, cls: string, t: string) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = t;
  return el;
}

function render() {
  out.replaceChildren();
  const [mineName, mineTz] = CITIES[+mineEl.value] ?? CITIES[0];
  const [theirName, theirTz] = CITIES[+theirsEl.value] ?? CITIES[0];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const meet = parse(meetEl.value), since = parse(sinceEl.value);
  const params = new URLSearchParams({ a: mineEl.value, b: theirsEl.value });
  if (meet) params.set("m", ymd(meet));
  if (since) params.set("s", ymd(since));
  history.replaceState(null, "", `?${params}`);

  // 만나는 날
  if (meet) {
    const left = between(today, meet);
    out.append(text("p", "label", "다시 만나는 날"), text("p", "date", pretty(meet)));
    out.append(text("p", "dday", left > 0 ? `D-${left}` : left === 0 ? "오늘 만나요" : `만난 지 ${-left}일`));
    if (left > 0) out.append(text("p", "hint", `${Math.floor(left / 7)}주 ${left % 7}일 남았어요.`));
  } else out.append(text("p", "hint", "다시 만나는 날을 고르면 D-day가 나와요."));

  // 사귄 날
  if (since) {
    const nthDay = between(since, today) + 1;
    const next100 = Math.ceil((nthDay + (nthDay % 100 === 0 ? 1 : 0)) / 100) * 100;
    const anniv = new Date(since.getFullYear() + Math.max(1, today.getFullYear() - since.getFullYear() + (new Date(today.getFullYear(), since.getMonth(), since.getDate()) <= today ? 1 : 0)), since.getMonth(), since.getDate());
    const facts = document.createElement("dl");
    facts.className = "facts";
    const fact = (k: string, v: string) => facts.append(text("dt", "", k), text("dd", "", v));
    fact("오늘", nthDay > 0 ? `${nthDay}일째` : "아직 전이에요");
    fact(`${next100}일`, pretty(addDays(since, next100 - 1)).replace(/^\d+년 /, ""));
    fact(`${anniv.getFullYear() - since.getFullYear()}주년`, pretty(anniv).replace(/^\d+년 /, ""));
    out.append(text("p", "label", "사귄 날"), facts);
  }

  // 시차와 지금 시간
  const diffMin = offsetMin(theirTz, now) - offsetMin(mineTz, now);
  const diffH = diffMin / 60;
  const facts = document.createElement("dl");
  facts.className = "facts two";
  const fact = (k: string, v: string) => facts.append(text("dt", "", k), text("dd", "", v));
  fact(`${mineName} 지금`, clock(mineTz));
  fact(`${theirName} 지금`, clock(theirTz));
  out.append(text("p", "label", "지금 시간"), facts);
  out.append(text("p", "hint", diffMin === 0 ? "시차가 없어요." : `${theirName}은 ${mineName}보다 ${Math.abs(diffH)}시간 ${diffH > 0 ? "빨라요" : "느려요"}.`));

  // 둘 다 깨어 있는 시간 (각자 오전 8시 ~ 자정)
  const awake = (h: number) => h >= 8 && h <= 23;
  const ok: number[] = [];
  for (let h = 0; h < 24; h++) {
    const th = (((h + diffMin / 60) % 24) + 24) % 24;
    if (awake(h) && awake(Math.floor(th))) ok.push(h);
  }
  const ranges: [number, number][] = [];
  for (const h of ok) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === h) last[1] = h + 1;
    else ranges.push([h, h + 1]);
  }
  const ol = document.createElement("ol");
  ol.className = "marks";
  if (!ranges.length) ol.append(Object.assign(document.createElement("li"), { textContent: "둘 다 깨어 있는 시간이 거의 없어요. 짧은 메시지로 하루를 이어 가요." }));
  for (const [a, b] of ranges) {
    const li = document.createElement("li");
    const ta = (((a + diffMin / 60) % 24) + 24) % 24, tb = (((b + diffMin / 60) % 24) + 24) % 24;
    li.append(text("span", "", `내 시간 ${hourText(a)}~${hourText(b % 24)}`), text("span", "", `${theirName} ${hourText(Math.floor(ta))}~${hourText(Math.floor(tb))}`));
    ol.append(li);
  }
  out.append(text("p", "label", "통화하기 좋은 시간"), ol);

  // 마을로: 만나는 날을 등불로
  if (meet && between(today, meet) > 0) {
    const go = document.createElement("a");
    go.className = "btn";
    go.href = `/?${new URLSearchParams({ start: ymd(since && since < today ? since : today), end: ymd(meet), kind: "장거리 연애" })}`;
    go.textContent = "이 날을 기다리는 등불 걸기";
    out.append(go, text("p", "hint", "기다림 항구에 등불을 걸어 두면 날이 가까워질수록 밝아지고, 공항 안내판의 비행기가 활주로로 다가와요."));
  }
}

for (const el of [meetEl, sinceEl, mineEl, theirsEl]) el.addEventListener("input", render);
render();
setInterval(render, 30_000); // 지금 시간을 새로 고쳐요
