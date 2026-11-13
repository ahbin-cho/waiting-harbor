// 병에 담은 편지: 기다리는 사람이 돌아올 사람에게 쓰는 편지.
// 유리병에 담겨 바다를 건너 항구로 떠 오다가, 돌아오는 날 닿아서 열려요.
// 쓴 사람만 읽고 지울 수 있고, 받을 사람은 열쇠가 든 링크로 "몇 병이 오고 있는지"만 보다가 그날 열어 봐요.

export type Letter = { id: number; lantern_id: string; body: string; created_at: string };

/** 받을 사람이 링크로 열어 본 병 */
export type Bottles = { n: number; arrived: boolean; letters: { body: string; created_at: string }[] };

export const LETTER_MAX = 1000;
export const LETTERS_A_DAY = 3;

/** 받을 사람에게 보내는 주소 (/l/아이디?k=열쇠) */
export const bottleUrl = (lanternId: string, key: string) => `${location.origin}/l/${lanternId}?k=${key}`;

/** 편지를 쓸 때 건네는 말: 날마다 다른 물음 */
export const LETTER_ASKS = [
  "오늘 있었던 일 중에 꼭 들려주고 싶은 게 있나요?",
  "돌아오면 제일 먼저 같이 하고 싶은 건 뭔가요?",
  "요즘 자주 듣는 노래가 있나요?",
  "오늘 그 사람 생각이 난 순간은 언제였나요?",
  "그동안 말 못 한 고마운 일이 있나요?",
  "돌아오는 날 뭘 먹으러 갈까요?",
  "오늘 날씨는 어땠나요? 그쪽은 어떨까요?",
];
