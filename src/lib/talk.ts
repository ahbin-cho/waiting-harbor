// 이야기하기: 떠나보낸 사람이나 아이에게 말을 걸면, 그 마음을 빌린 짧은 답장이 와요.
// 진짜 그 사람이 아니라는 걸 화면에 늘 밝혀요. AI 가 없을 때(체험 모드, 키 없음)는 여기 기본 답장을 써요.
// 서버(api/talk.ts)와 화면이 같이 쓰므로 브라우저 전용 기능은 쓰지 않아요.

/** 하루에 보낼 수 있는 말 (DB 정책과 같은 수) */
export const TALK_PER_DAY = 30;
export const TALK_MAX = 300;

export type TalkRole = "me" | "them";
export type Talk = { id: number; lantern_id: string; role: TalkRole; body: string; created_at: string };

/**
 * 마음이 위험해 보이는 말. 이런 말엔 역할을 내려놓고 등대지기가 직접, 조용히 도움을 안내해요.
 * 넓게 잡아요: 놓치는 것보다 한 번 더 안내하는 게 나아요.
 */
const DANGER = [
  "죽고 싶", "죽을래", "죽어버리", "죽고싶", "자살", "목숨", "사라지고 싶", "사라지고싶", "없어지고 싶", "살기 싫", "살고 싶지 않",
  "따라가고 싶", "따라 가고 싶", "곁으로 갈", "옆으로 갈", "만나러 갈게", "너한테 갈게", "그리로 갈게", "같이 가고 싶", "같이 갈래",
  "끝내고 싶", "다 끝내", "뛰어내리", "약을 먹", "수면제",
];
export const isDanger = (text: string) => {
  const t = text.replace(/\s+/g, " ");
  return DANGER.some((w) => t.includes(w));
};

export const SAFETY_REPLY =
  "등대지기예요. 지금 마음이 많이 무거워 보여서 잠시 대신 말을 걸어요. 혼자 견디지 않아도 돼요. " +
  "자살예방 상담전화 109(24시간), 정신건강 상담전화 1577-0199에 지금 전화하면 이야기를 들어줘요. " +
  "곁에 있는 사람에게 \"오늘 좀 힘들어\"라고 한마디만 해도 괜찮아요.";

type Who = { who: string; isPet: boolean; species?: string | null };

const PERSON_REPLIES = [
  "나 여기서 잘 지내. 너무 걱정하지 마.",
  "오늘도 와 줬네. 네 목소리 들으니까 좋다.",
  "울어도 괜찮아. 근데 밥은 꼭 챙겨 먹어.",
  "나는 네가 웃는 게 제일 좋았어. 천천히 해도 돼.",
  "고마워. 그 말, 잘 들었어.",
  "네 잘못 아니야. 그러니까 너무 자책하지 마.",
  "보고 싶다는 말, 나도 똑같아.",
];
const PET_REPLIES: Record<string, string[]> = {
  강아지: ["왔다! 꼬리 흔드는 거 보여? 나 여기서 잘 뛰어놀아.", "산책길 냄새가 가끔 생각나. 그래도 여기 풀밭도 좋아.", "울지 마. 나 아픈 데 하나도 없어!"],
  고양이: ["오늘도 볕 좋은 지붕에서 잤어. 걱정 마.", "부르면 안 가는 척했지만, 사실 다 듣고 있었어.", "네 무릎이 제일 따뜻했어. 여기서도 잘 지내."],
  새: ["오늘 높이 날았어! 바람이 좋았어.", "아침 노래, 여기서도 불러. 들려?", "나 여기서 자유롭게 날아다녀. 걱정 마."],
  물고기: ["연못이 넓고 맑아. 천천히 헤엄치고 있어.", "어항 불빛, 천천히 꺼도 괜찮아.", "나 잘 지내. 물결이 반짝반짝해."],
};
const PET_DEFAULT = ["나 여기서 잘 지내. 아픈 데 없어!", "와 줘서 좋아. 네 냄새 기억하고 있어.", "보고 싶었어. 오늘도 고마워."];

/** AI 없이 고르는 기본 답장: 날마다, 말마다 조금씩 다르게 */
export function templateReply(w: Who, text: string, seed: number) {
  if (isDanger(text)) return SAFETY_REPLY;
  const list = w.isPet ? (PET_REPLIES[w.species ?? ""] ?? PET_DEFAULT) : PERSON_REPLIES;
  let h = seed;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
