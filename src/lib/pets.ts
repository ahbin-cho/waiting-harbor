// 무지개마을에서 지내는 아이들. 종류마다 자기다운 모습으로 지내요.

export const SPECIES = ["강아지", "고양이", "새", "물고기", "햄스터·토끼", "거북이·도마뱀", "곤충", "그 밖의 아이"] as const;
export type Species = (typeof SPECIES)[number];

/** 등불 걸기에서 보여주는 말: [이름, 무지개마을에서 지내는 모습] */
export const SPECIES_SAY: Record<Species, string> = {
  강아지: "풀밭을 뛰어다니다 가끔 멈춰 꼬리를 흔들어요",
  고양이: "지붕 위에서 햇볕을 쬐며 졸아요",
  새: "나뭇가지에 앉아 있다가 가끔 한 바퀴 날아요",
  물고기: "작은 연못을 천천히 헤엄쳐요",
  "햄스터·토끼": "덤불 사이를 깡충깡충 오가요",
  "거북이·도마뱀": "따뜻한 바위 위에서 볕을 쬐어요",
  곤충: "큰 참나무 줄기에 붙어 지내고, 밤엔 은은하게 빛나요",
  "그 밖의 아이": "마을 가운데를 둥실둥실 떠다녀요",
};

export const speciesOf = (s: string | null | undefined): Species =>
  (SPECIES as readonly string[]).includes(s ?? "") ? (s as Species) : "그 밖의 아이";
