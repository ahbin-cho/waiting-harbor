// 처음 온 사람에게 등대지기가 들려주는 이야기. 장면마다 카메라가 그곳으로 움직여요.

export type Shot = "overview" | "lighthouse" | "harbor" | "forest" | "hill";

export const STORY: { shot: Shot; text: string }[] = [
  { shot: "overview", text: "바다 건너로 떠난 사람이 많은 마을이 있었어요.\n남은 사람들은 저녁마다 부두에 나와 바다 쪽을 봤어요." },
  { shot: "lighthouse", text: "저는 이 마을 등대지기예요.\n매일 밤 불을 켜요. 돌아오는 배가 길을 잃지 않게요." },
  { shot: "harbor", text: "어느 날 누군가 부두 끝에 작은 등불을 걸었어요.\n기다리는 사람 이름을 적어서요.\n다음 날엔 등불이 두 개가 됐어요." },
  { shot: "forest", text: "이제는 숲에도, 언덕에도 등불이 있어요.\n여기선 서로의 이름을 묻지 않아요.\n‘지수를 기다리는 사람’, ‘아빠를 기다리는 사람’. 그렇게 불러요." },
  { shot: "hill", text: "돌아올 날이 가까워질수록 등불은 밝아져요.\n그날이 오면 등불은 기둥을 떠나 하늘로 올라가요." },
  { shot: "overview", text: "당신은 누구를 기다리고 있어요?" },
];

const KEY = "harbor-story-seen";
export function storySeen() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
export function markStorySeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* 저장이 막혀 있으면 다음에 또 보여줘요 */
  }
}
