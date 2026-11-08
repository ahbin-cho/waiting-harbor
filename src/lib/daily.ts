// 하루 한마디: 내 등불에 하루 한 번 건네는 짧은 말.
// 무지개마을 아이는 아이의 말로, 기다림과 떠나보낸 사람의 등불은 등대지기의 말로.
// 꾸미는 말보다 사실(며칠째, 며칠 남음, 어제 몇 명이 들렀는지)을 담아요.
// 그리움 등불엔 축하나 극복을 권하는 말, 카운트다운을 쓰지 않아요.
import type { Lantern } from "./supabase";
import { daysLeft, daysSince, isMiss, nextAnniversary, pick, progressOf } from "./waiting";
import { speciesOf, type Species } from "./pets";

export type DailyWord = { lanternId: string; from: string; text: string; facts: string };

const PET_LINES: Record<Species, string[]> = {
  강아지: [
    "오늘은 풀밭을 오래 뛰었어요. 멈춰서 꼬리를 흔들 때마다 그쪽 생각을 해요.",
    "여기 풀밭은 발바닥이 아프지 않아요. 같이 걷던 산책길이 가끔 생각나요.",
    "낮잠을 길게 잤어요. 꿈에서 현관문 열리는 소리를 들었어요.",
    "오늘은 다른 친구들이랑 나란히 누워서 하늘을 봤어요.",
  ],
  고양이: [
    "지붕 위 볕이 좋아서 오래 누워 있었어요.",
    "여기에도 창가 자리가 있어요. 그래도 그 집 창가가 제일 좋았어요.",
    "오늘은 꼬리를 세우고 마을을 한 바퀴 천천히 돌았어요.",
    "따뜻한 데를 찾아서 동그랗게 말고 잤어요.",
  ],
  새: [
    "오늘은 나뭇가지 꼭대기까지 날아 올라갔어요. 바람이 좋았어요.",
    "아침마다 하던 노래, 여기서도 불러요.",
    "높은 데서 보면 바다 건너 항구 불빛이 작게 보여요.",
  ],
  물고기: [
    "연못 물이 맑아서 하늘이 비쳐요. 천천히 여러 바퀴 돌았어요.",
    "오늘은 연못가 그늘에서 오래 쉬었어요.",
    "물 위로 떨어지는 빛 알갱이를 따라 헤엄쳤어요.",
  ],
  "햄스터·토끼": [
    "덤불 아래에 맛있는 걸 잔뜩 모아 뒀어요.",
    "오늘은 굴을 하나 더 팠어요. 아주 아늑해요.",
    "코를 오물오물하면서 풀밭을 구경했어요.",
  ],
  "거북이·도마뱀": [
    "바위 위에서 볕을 쬐었어요. 여기선 서두를 일이 하나도 없어요.",
    "오늘은 연못까지 천천히 걸어갔다 왔어요.",
    "따뜻한 돌 위에서 꾸벅꾸벅 졸았어요.",
  ],
  곤충: [
    "큰 참나무 줄기에 붙어서 하루를 보냈어요.",
    "오늘은 풀잎 끝까지 올라가서 바람을 맞았어요.",
  ],
  "그 밖의 아이": [
    "여기서는 아픈 데가 없어요. 천천히 지내요.",
    "오늘은 마을을 조용히 둘러봤어요.",
    "볕이 드는 자리를 찾아서 오래 쉬었어요.",
  ],
};

/** 같은 날, 같은 등불이면 늘 같은 값 (날마다 바뀌어요) */
function dayHash(day: string, id: string) {
  let h = 2166136261;
  for (const c of day + id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

const md = (s: string) => {
  const [, m, d] = s.split("-").map(Number);
  return `${m}월 ${d}일`;
};

/** 어제 다녀간 흔적: "어제 3명이 온기를 보냈고, 2명이 무언가를 놓고 갔어요." */
function factsOf(miss: boolean, warmYesterday: number, offerYesterday: number) {
  const w = warmYesterday ? `${warmYesterday}명이 ${miss ? "추모했" : "온기를 보냈"}` : "";
  const o = offerYesterday ? `${offerYesterday}명이 무언가를 놓고 갔` : "";
  if (w && o) return `어제 ${w}고, ${o}어요.`;
  if (w || o) return `어제 ${w || o}어요.`;
  return "";
}

export function dailyWord(l: Lantern, f: { warmYesterday: number; offerYesterday: number }, day: string): DailyWord {
  const who = l.who.trim() || "그 사람";
  const h = dayHash(day, l.id);
  const miss = isMiss(l);
  const facts = factsOf(miss, f.warmYesterday, f.offerYesterday);

  if (l.place === "무지개") {
    const lines = PET_LINES[speciesOf(l.species)];
    return { lanternId: l.id, from: `무지개마을의 ${who}`, text: lines[h % lines.length], facts };
  }

  if (miss) {
    const ann = nextAnniversary(l);
    const t =
      ann.days === 0 ? `오늘은 ${who}의 ${ann.label}이에요. 풍등이 조금 더 밝아요.`
      : ann.days <= 7 ? `다가오는 ${md(ann.label === "기일" ? l.end_date : l.start_date)}은 ${who}의 ${ann.label}이에요.`
      : [`${who}의 풍등은 오늘도 추모관 하늘에 떠 있어요.`, `추모관 정자 위로 ${who}의 풍등이 천천히 흔들려요.`, `오늘도 ${who}의 풍등 곁을 지나왔어요.`][h % 3];
    return { lanternId: l.id, from: "등대지기", text: t, facts };
  }

  const n = daysLeft(l), since = daysSince(l) ?? 0;
  const pct = progressOf(l);
  let t: string;
  if (n == null) t = `${pick(who, "을", "를")} 기다리는 등불이 오늘도 켜져 있어요.`;
  else if (n < 0) t = `${pick(who, "과", "와")} 다시 만난 지 ${-n}일째예요. 등불은 하늘에 떠 있어요.`;
  else if (n === 0) t = `오늘 ${pick(who, "이", "가")} 돌아와요.`;
  else if (n === 1) t = `내일 ${pick(who, "이", "가")} 돌아와요. 기다린 지 ${since}일째예요.`;
  else if (since > 0 && since % 100 === 0) t = `오늘로 ${pick(who, "을", "를")} 기다린 지 ${since}일이에요. ${n}일 남았어요.`;
  else if (n <= 30) t = `${n}일 남았어요. 이제 한 달이 안 남았어요.`;
  else if (pct >= 0.5 && pct < 0.5 + 1 / Math.max(2, since + n)) t = `오늘 기다림의 절반을 지났어요. ${n}일 남았어요.`;
  else t = [`${pick(who, "을", "를")} 기다린 지 ${since}일째예요. ${n}일 남았어요.`, `등불이 어제보다 조금 더 밝아졌어요. ${n}일 남았어요.`][h % 2];
  return { lanternId: l.id, from: "등대지기", text: t, facts };
}
