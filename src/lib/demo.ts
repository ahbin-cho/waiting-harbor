// Supabase 설정이 없을 때 보여주는 체험용 등불. 저장되지 않아요.
import type { Lantern, Message, Note, OfferingCount, Warmth } from "./supabase";
import { today, ymd } from "./waiting";

export const DEMO_ME = "demo-me";

const shift = (days: number) => {
  const d = today();
  d.setDate(d.getDate() + days);
  return ymd(d);
};

const sample: [string, string, number, number, string, string, string, string][] = [
  ["지수", "군대", -400, 145, "오늘도 편지 한 장 썼어요.", "언덕", "유채", "초롱"],
  ["민호", "장거리 연애", -60, 9, "공항 가는 길을 벌써 외웠어요.", "항구", "벚꽃", "별"],
  ["엄마", "해외에 있는 가족", -200, 30, "김치 담가 놓을게요.", "등대", "노을", "집"],
  ["하준", "군대", -500, 1, "내일이에요. 잠이 안 와요.", "항구", "달빛", "둥근"],
  ["서연", "장거리 연애", -30, 80, "같은 달을 보고 있대요.", "숲", "라벤더", "달"],
  ["아빠", "해외에 있는 가족", -300, -2, "드디어 다시 만났어요.", "등대", "촛불", "네모"],
  ["유나", "장거리 연애", -90, 40, "전화 끊고 한참 서 있었어요.", "숲", "하늘", "별"],
  ["태윤", "군대", -320, 220, "휴가 날짜만 세고 있어요.", "언덕", "새싹", "연꽃"],
  ["할머니", "해외에 있는 가족", -150, 60, "", "항구", "바다", "초롱"],
];

export const demoLanterns = (): Lantern[] =>
  sample.map(([who, kind, start, end, line, place, color, shape], i) => ({
    id: `demo-${i}`,
    user_id: `demo-${i}`,
    who,
    kind,
    start_date: shift(start),
    end_date: shift(end),
    line,
    place,
    color,
    shape,
    mode: "wait",
    created_at: new Date(Date.now() - (sample.length - i) * 60_000).toISOString(),
  }));

/** 체험용 그리움 등불: 하늘에 떠 있어요 */
const missing: [string, string, number, number, string, string][] = [
  ["할아버지", "가족", -9000, -400, "할아버지가 깎아 주던 사과 모양을 아직 기억해요.", "달빛"],
  ["콩이", "반려동물", -4200, -88, "산책 시간이 되면 아직도 현관을 봐요.", "노을"],
];
/** 무지개마을의 아이들: [이름, 종류, 처음 만난 날, 떠난 날, 한 줄, 색] */
const pets: [string, string, number, number, string, string][] = [
  ["나비", "고양이", -5100, -200, "햇볕 드는 창가에 아직 방석이 있어요.", "라벤더"],
  ["보리", "새", -2600, -45, "아침마다 너 노래로 깼는데.", "하늘"],
  ["꼬북", "거북이·도마뱀", -7300, -500, "20년 동안 고마웠어.", "새싹"],
  ["장수", "곤충", -400, -30, "여름 내내 같이 있어 줘서 고마워.", "촛불"],
  ["금비", "물고기", -900, -12, "어항 물소리가 없으니 방이 조용해.", "노을"],
  ["뭉치", "햄스터·토끼", -1100, -150, "해바라기씨 볼 때마다 생각나.", "벚꽃"],
];
export const demoMissing = (): Lantern[] => [
  ...missing.map(([who, kind, start, end, line, color], i) => ({
    id: `demo-miss-${i}`, user_id: `demo-miss-${i}`, who, kind, start_date: shift(start), end_date: shift(end), line,
    // 콩이(반려동물)는 무지개마을의 강아지, 할아버지는 하늘의 풍등
    place: kind === "반려동물" ? "무지개" : "하늘", color, shape: "풍등", mode: "miss", species: kind === "반려동물" ? "강아지" : null,
    created_at: new Date(Date.now() - (10 + i) * 60_000).toISOString(),
  })),
  ...pets.map(([who, species, start, end, line, color], i) => ({
    id: `demo-pet-${i}`, user_id: `demo-pet-${i}`, who, kind: "반려동물", start_date: shift(start), end_date: shift(end), line,
    place: "무지개", color, shape: "둥근", mode: "miss", species,
    created_at: new Date(Date.now() - (20 + i) * 60_000).toISOString(),
  })),
];

export const demoWarmth = (): Warmth[] =>
  ["demo-0", "demo-0", "demo-1", "demo-3", "demo-3", "demo-3"].map((to_id, i) => ({
    from_id: `demo-${(i + 1) % sample.length}`,
    to_id,
    day: ymd(today()),
  }));

export const demoOnline = () => new Set(["demo-1", "demo-3", "demo-6", DEMO_ME]);

/** 체험용 기다림 일기 */
export const demoNotes = (): Note[] => {
  const rows: [string, number, string][] = [
    ["demo-1", -1, "오늘 영상통화 하다가 둘 다 잠들었어요. 깨 보니 화면에 천장만 보였어요."],
    ["demo-1", -3, "비행기표 캡처해서 배경화면으로 해 뒀어요. 볼 때마다 숫자가 줄어 있으면 좋겠다."],
    ["demo-1", -8, "시차 때문에 내 아침이 그쪽 밤이에요. 잘 자라는 말로 하루를 시작해요."],
    ["demo-0", -2, "편지 왔어요. 훈련 끝나고 쓴 거라 글씨가 엉망인데 그게 더 좋았어요."],
    ["demo-0", -10, "100일째. 달력에 동그라미 치는 손이 익숙해졌어요."],
    ["demo-2", -4, "엄마가 보내준 반찬 사진에 김치가 세 통이에요. 한 통은 내 거래요."],
    ["demo-3", 0, "내일이에요. 공항 가는 첫차 시간 세 번 확인했어요."],
    ["demo-miss-1", -1, "오늘 공원에서 너랑 닮은 강아지를 봤어. 한참 따라 걸었어."],
    ["demo-miss-1", -30, "사료 그릇을 아직 못 치웠어. 치우면 정말 끝나는 것 같아서."],
    ["demo-miss-0", -5, "할아버지 기일이 다가와요. 올해는 제가 사과를 깎아 갈게요."],
  ];
  return rows.map(([lantern_id, d, body], i) => ({ id: -(i + 1), lantern_id, body, public: true, day: shift(d), created_at: new Date(Date.now() + d * 86_400_000).toISOString() }));
};

/** 체험용 남긴 마음 */
export const demoMessages = (): Message[] => {
  const rows: [string, number, string][] = [
    ["demo-3", -1, "저도 내일 공항 가요. 같은 날이라 괜히 반가워요."],
    ["demo-3", -2, "하루만 더요. 첫차 놓치지 마세요."],
    ["demo-1", -4, "저희도 시차 7시간이에요. 아침 인사가 잘 자라는 말인 거 알아요."],
    ["demo-0", -6, "편지 글씨 엉망인 거, 저희 집도 똑같았어요."],
    ["demo-miss-1", -2, "저도 작년에 보냈어요. 그릇은 저도 한참 못 치웠어요."],
    ["demo-miss-1", -9, "무지개마을에서 신나게 뛰어놀고 있을 거예요."],
    ["demo-miss-0", -3, "할아버지께 사과 꼭 깎아 드리세요."],
  ];
  return rows.map(([lantern_id, d, body], i) => ({ id: -(i + 1), lantern_id, from_id: `demo-v${i}`, body, created_at: new Date(Date.now() + d * 86_400_000).toISOString() }));
};

/** 체험용 놓고 간 것 */
export const demoOfferings = (): OfferingCount[] => [
  { lantern_id: "demo-0", kind: "들꽃", n: 4, yesterday: 1 },
  { lantern_id: "demo-0", kind: "조약돌", n: 2, yesterday: 0 },
  { lantern_id: "demo-1", kind: "종이배", n: 3, yesterday: 1 },
  { lantern_id: "demo-3", kind: "들꽃", n: 6, yesterday: 2 },
  { lantern_id: "demo-3", kind: "종이배", n: 2, yesterday: 1 },
  { lantern_id: "demo-8", kind: "조약돌", n: 3, yesterday: 0 },
  { lantern_id: "demo-miss-0", kind: "국화", n: 7, yesterday: 2 },
  { lantern_id: "demo-pet-0", kind: "간식", n: 3, yesterday: 1 },
  { lantern_id: "demo-pet-0", kind: "공", n: 2, yesterday: 0 },
  { lantern_id: "demo-pet-1", kind: "국화", n: 4, yesterday: 1 },
  { lantern_id: "demo-pet-1", kind: "간식", n: 2, yesterday: 1 },
];
