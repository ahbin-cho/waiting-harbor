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

/** 오늘의 질문 (하루 동안은 같은 질문) */
export function todaysAsk(who: string, shift = 0) {
  const day = Math.floor(Date.now() / 86_400_000);
  return ASK[(((day + shift) % ASK.length) + ASK.length) % ASK.length](who.trim() || "그 사람");
}
