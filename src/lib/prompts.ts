// 일기 쓰기가 막막할 때 등대지기가 하나씩 물어봐요. 날마다 다른 질문이 나와요.
import { pick } from "./waiting";

const ASK = [
  (w: string) => `오늘 ${pick(w, "이", "가")} 생각난 순간이 있었어요?`,
  (w: string) => `${pick(w, "이", "가")} 돌아오면 제일 먼저 뭘 하고 싶어요?`,
  () => "오늘 먹은 것 중에 같이 먹고 싶었던 게 있어요?",
  (w: string) => `요즘 ${pick(w, "과", "와")} 가장 많이 나누는 이야기는 뭐예요?`,
  () => "오늘 하루를 한 문장으로 적는다면요?",
  (w: string) => `${w}에게 아직 못 한 말이 있어요?`,
  () => "기다리는 동안 새로 생긴 습관이 있어요?",
  () => "오늘 연락이 왔어요? 어떤 말이었어요?",
  (w: string) => `${pick(w, "이", "가")} 없는 동안 바뀐 게 있다면요?`,
  () => "이번 주에 가장 길게 느껴진 날은 언제였어요?",
];

// 떠나보낸 사람에게: 기억을 꺼내는 질문들. 재촉하거나 극복을 권하지 않아요.
const MISS_ASK = [
  (w: string) => `오늘 ${pick(w, "이", "가")} 생각난 순간이 있었어요?`,
  (w: string) => `${pick(w, "과", "와")} 함께한 날 중에 자주 떠오르는 장면이 있어요?`,
  (w: string) => `${pick(w, "이", "가")} 좋아하던 게 있었어요?`,
  (w: string) => `${w}에게 요즘 내 이야기를 들려준다면요?`,
  (w: string) => `${w}에게 고마웠던 일 하나를 적어 볼까요?`,
  () => "오늘 하루는 어땠어요? 짧게 적어도 괜찮아요.",
  (w: string) => `${pick(w, "이", "가")} 지금 곁에 있다면 무슨 말을 해 줄 것 같아요?`,
  () => "요즘 잠은 잘 자고 있어요?",
];

/** 오늘의 질문 (하루 동안은 같은 질문) */
export function todaysAsk(who: string, shift = 0, miss = false) {
  const list = miss ? MISS_ASK : ASK;
  const day = Math.floor(Date.now() / 86_400_000);
  return list[(((day + shift) % list.length) + list.length) % list.length](who.trim() || "그 사람");
}
