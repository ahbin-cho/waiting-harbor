import "../styles.css";
import "../discharge/page.css";
import { applyUiTheme } from "../lib/theme";

// 49재·기일 계산기: 글로 읽는 페이지라 밝은 새벽 색으로 보여줘요
applyUiTheme("dawn");

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
/** 이듬해 같은 날 (2월 29일이면 2월 28일) */
const yearsLater = (d: Date, n: number) => {
  const t = new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
  return t.getMonth() === d.getMonth() ? t : new Date(d.getFullYear() + n, d.getMonth() + 1, 0);
};

const goneEl = document.querySelector<HTMLInputElement>("#gone")!;
const whoEl = document.querySelector<HTMLDivElement>("#who")!;
const out = document.querySelector<HTMLElement>("#result")!;

const q = new URLSearchParams(location.search);
let pet = q.get("pet") === "1";
if (q.get("d")) goneEl.value = q.get("d")!;

for (const [isPet, name] of [[false, "사람"], [true, "반려동물"]] as const) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "choice-chip";
  el.dataset.pet = String(isPet);
  el.textContent = name;
  el.addEventListener("click", () => {
    pet = isPet;
    render();
  });
  whoEl.appendChild(el);
}

function text(tag: string, cls: string, t: string) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = t;
  return el;
}

function render() {
  whoEl.querySelectorAll<HTMLButtonElement>("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pet === String(pet))));
  out.replaceChildren();
  const gone = parse(goneEl.value);
  if (!gone) {
    out.append(text("p", "hint", "떠난 날을 고르면 49재와 기일이 나와요."));
    return;
  }
  history.replaceState(null, "", `?d=${ymd(gone)}${pet ? "&pet=1" : ""}`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nth = (n: number) => addDays(gone, n - 1); // 떠난 날을 첫째 날로 세어 n번째 날
  const day49 = nth(49);
  const since = between(gone, today) + 1;

  out.append(text("p", "label", "49재"), text("p", "date", pretty(day49)));
  const left49 = between(today, day49);
  out.append(text("p", "hint", left49 > 0 ? `49재까지 ${left49}일 남았어요.` : left49 === 0 ? "오늘이 49재예요." : `떠난 날로부터 ${since}일째예요.`));

  const marks: { label: string; date: Date }[] = [];
  for (let k = 1; k <= 7; k++) marks.push({ label: k === 1 ? "초재 (7일)" : k === 7 ? "7재 · 49재" : `${k}재 (${k * 7}일)`, date: nth(k * 7) });
  marks.push({ label: "100일", date: nth(100) });
  for (let y = 1; y <= 3; y++) marks.push({ label: `${y}주기 기일`, date: yearsLater(gone, y) });

  const ol = document.createElement("ol");
  ol.className = "marks";
  for (const m of marks) {
    const li = document.createElement("li");
    if (m.date < today) li.className = "past";
    li.append(text("span", "", m.label), text("span", "", pretty(m.date)));
    ol.append(li);
  }
  out.append(text("p", "label", "다가오는 날들"), ol);

  // 마을로: 추모관에 풍등(또는 무지개마을의 아이)으로
  const go = document.createElement("a");
  go.className = "btn";
  go.href = `/?for=${pet ? "pet" : "miss"}&end=${ymd(gone)}`;
  go.textContent = pet ? "무지개마을에 아이의 자리 만들기" : "추모관에 풍등 띄우기";
  out.append(go, text("p", "hint", pet ? "아이가 무지개마을에서 지내는 모습을 보고, 하루 한 번 안부를 들을 수 있어요." : "기일이 다가오면 풍등이 조금 더 밝아지고, 하루 한 번 등대지기가 안부를 전해요."));
}

goneEl.addEventListener("input", render);
render();
