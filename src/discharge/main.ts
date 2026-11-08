import "../styles.css";
import "./page.css";
import { BRANCHES, between, compute, pretty, ymd, type BranchId } from "./calc";
import { THEME_LABEL, applyUiTheme, resolveTheme, saveTheme, savedTheme, type ThemeChoice } from "../lib/theme";

// 테마: 앱과 같은 선택을 따르고, 처음이면 밝은 새벽으로 열려요
let choice: ThemeChoice = savedTheme("dawn");
const themeBtn = document.querySelector<HTMLButtonElement>("#theme")!;
const order: ThemeChoice[] = ["dawn", "night", "auto"];
const paintTheme = () => {
  applyUiTheme(resolveTheme(choice));
  themeBtn.textContent = THEME_LABEL[choice];
  themeBtn.setAttribute("aria-label", `테마 바꾸기. 지금은 ${THEME_LABEL[choice]}`);
};
themeBtn.addEventListener("click", () => {
  choice = order[(order.indexOf(choice) + 1) % order.length];
  saveTheme(choice);
  paintTheme();
});
paintTheme();

const startEl = document.querySelector<HTMLInputElement>("#start")!;
const chips = document.querySelector<HTMLDivElement>("#branches")!;
const out = document.querySelector<HTMLElement>("#result")!;

const q = new URLSearchParams(location.search);
let branch: BranchId = (BRANCHES.find((b) => b.id === q.get("b"))?.id ?? "army") as BranchId;
if (q.get("d")) startEl.value = q.get("d")!;

for (const b of BRANCHES) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "choice-chip";
  el.dataset.id = b.id;
  el.innerHTML = `<b></b><span></span>`;
  el.querySelector("b")!.textContent = b.name;
  el.querySelector("span")!.textContent = `${b.months}개월`;
  el.addEventListener("click", () => {
    branch = b.id;
    render();
  });
  chips.appendChild(el);
}

function text(tag: string, cls: string, t: string) {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = t;
  return el;
}

function render() {
  chips.querySelectorAll<HTMLButtonElement>("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.id === branch)));
  out.replaceChildren();
  const r = compute(startEl.value, branch);
  if (!r) {
    out.append(text("p", "hint", "입대일을 고르면 전역일이 나와요."));
    return;
  }
  // 결과를 주소에 남겨서 그대로 공유할 수 있게
  history.replaceState(null, "", `?d=${ymd(r.start)}&b=${branch}`);

  const dday = r.left > 0 ? `D-${r.left}` : r.left === 0 ? "오늘 전역해요" : `전역한 지 ${-r.left}일`;
  out.append(
    text("p", "label", `${r.branch.name} ${r.branch.months}개월 · 전역일`),
    text("p", "date", pretty(r.end)),
    text("p", "dday", dday),
  );

  const bar = document.createElement("div");
  bar.className = "bar-line";
  const fill = document.createElement("i");
  fill.style.width = `${r.pct}%`;
  bar.append(fill);
  out.append(bar);

  const facts = document.createElement("dl");
  facts.className = "facts";
  const fact = (k: string, v: string) => facts.append(text("dt", "", k), text("dd", "", v));
  fact("복무율", `${r.pct.toFixed(1)}%`);
  fact("오늘", r.served > 0 ? `복무 ${r.served}일째` : `입대까지 ${between(r.today, r.start)}일`);
  fact("전체", `${r.total}일`);
  fact("남은 날", r.left > 0 ? `${r.left}일` : "없어요");
  out.append(facts);

  const ol = document.createElement("ol");
  ol.className = "marks";
  for (const m of r.marks) {
    const li = document.createElement("li");
    if (m.date < r.today) li.className = "past";
    li.append(text("span", "", m.label), text("span", "", pretty(m.date)));
    ol.append(li);
  }
  out.append(text("p", "label", "다가오는 날들"), ol);

  // 마을로: 이 날짜를 기다리는 등불을 바로 걸 수 있게
  const go = document.createElement("a");
  go.className = "btn";
  go.href = `/?start=${ymd(r.start)}&end=${ymd(r.end)}&kind=${encodeURIComponent("군대")}`;
  go.textContent = "이 날을 기다리는 등불 걸기";
  out.append(go, text("p", "hint", "기다림 항구에서 전역일까지 등불을 걸어 두고, 매일 한 줄씩 남길 수 있어요."));
}

startEl.addEventListener("input", render);
render();
