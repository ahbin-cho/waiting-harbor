// 등불 꾸미기: 사람마다 고르는 불빛 색과 등 모양

export const COLORS = {
  촛불: "#FFB867",
  노을: "#FF8E6E",
  달빛: "#F4E6C6",
  벚꽃: "#FFB0C8",
  라벤더: "#BFA8FF",
  하늘: "#8FCBFF",
  새싹: "#B4E58A",
} as const;
export type LampColor = keyof typeof COLORS;
export const COLOR_NAMES = Object.keys(COLORS) as LampColor[];

export const SHAPES = ["둥근", "네모", "별"] as const;
export type LampShape = (typeof SHAPES)[number];

export const colorOf = (c: string | null | undefined): LampColor =>
  c && c in COLORS ? (c as LampColor) : "촛불";
export const shapeOf = (s: string | null | undefined): LampShape =>
  (SHAPES as readonly string[]).includes(s ?? "") ? (s as LampShape) : "둥근";
