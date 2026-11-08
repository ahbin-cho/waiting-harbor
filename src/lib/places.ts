// 등불을 걸 수 있는 장소와 지형. 좌표는 3D 마을 기준 (x: 왼쪽-오른쪽, z: 안쪽-바다쪽, y: 높이).
// 섬, 부두, 등불 자리 모두 노이즈로 살짝씩 흐트러뜨려서 자로 그은 느낌이 나지 않게 해요.

export const PLACES = ["항구", "숲", "언덕", "등대"] as const;
export type Place = (typeof PLACES)[number];

// ---------- 노이즈 ----------

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
/** 0~1 사이의 부드러운 값 노이즈 */
export function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) {
    s += a * noise(x * f, y * f);
    f *= 2.1;
    a *= 0.5;
  }
  return s; // 대략 0~1
}
/** 정수 i 에서 늘 같은 -1~1 값 (등불마다 조금씩 다른 기울기, 높이) */
export const jitter = (i: number, salt: number) => hash(i * 7.31 + salt, salt * 3.17 - i) * 2 - 1;

// ---------- 섬 ----------

/** x, z: 가운데, r: 반지름, h: 높이, p: 경사 (클수록 가파름), seed: 해안선 모양 */
export const ISLANDS = {
  언덕: { x: -40, z: -14, r: 26, h: 12, p: 1.3, seed: 3 },
  숲: { x: -8, z: -4, r: 19, h: 3.2, p: 0.8, seed: 9 },
  등대: { x: 36, z: -12, r: 17, h: 9, p: 2.2, seed: 17 },
} as const;
type Island = (typeof ISLANDS)[keyof typeof ISLANDS];

function islandHeight(x: number, z: number, c: Island) {
  // 좌표를 노이즈로 휘어서 해안선이 들쭉날쭉해져요
  const k = 0.05;
  const wx = x + (noise(x * k + c.seed, z * k) - 0.5) * c.r * 0.7;
  const wz = z + (noise(x * k, z * k + c.seed * 1.7) - 0.5) * c.r * 0.7;
  const d = Math.hypot(wx - c.x, wz - c.z) / c.r;
  const s = Math.max(0, 1 - d * d);
  const bumps = (fbm(x * 0.12 + c.seed, z * 0.12) - 0.5) * 1.6 * s;
  return c.h * Math.pow(s, c.p) + bumps - 1.1;
}

/** 땅 높이. 0 아래면 바다예요. */
export function groundAt(x: number, z: number) {
  let y = -6;
  for (const c of Object.values(ISLANDS)) y = Math.max(y, islandHeight(x, z, c));
  return y;
}

// ---------- 부두: 숲 섬에서 바다로 휘어져 나가는 나무 다리 ----------

export const PIER = { len: 34, w: 3.6 };

/** 부두 위 u(0~1) 지점의 위치와 방향 */
export function pierAt(u: number) {
  const z = -1 + u * PIER.len;
  const x = 7 + Math.sin(u * 1.7) * 6 + Math.sin(u * 5.3) * 0.4;
  const dx = Math.cos(u * 1.7) * 6 * 1.7 + Math.cos(u * 5.3) * 0.4 * 5.3;
  const yaw = Math.atan2(dx, PIER.len); // 진행 방향이 z 축에서 얼마나 틀어졌는지
  const deck = 0.95 + Math.sin(u * 11) * 0.06 + u * 0.15;
  return { x, z, yaw, deck };
}

// ---------- 장소 ----------

export const PLACE_INFO: Record<Place, { x: number; z: number; blurb: string; hang: boolean }> = {
  항구: { x: pierAt(0.3).x, z: pierAt(0.3).z, blurb: "배가 들어오는 부두에 걸어요.", hang: false },
  숲: { x: ISLANDS.숲.x, z: ISLANDS.숲.z, blurb: "나무 사이, 조용한 곳에 매달아요.", hang: true },
  언덕: { x: ISLANDS.언덕.x + 2, z: ISLANDS.언덕.z + 2, blurb: "멀리까지 내다보이는 언덕에 꽂아요.", hang: false },
  등대: { x: ISLANDS.등대.x, z: ISLANDS.등대.z, blurb: "길을 비춰주는 등대 곁에 세워요.", hang: false },
};

export function placeOf(p: string | null | undefined): Place {
  return (PLACES as readonly string[]).includes(p ?? "") ? (p as Place) : "항구";
}

/**
 * 장소 안에서 i번째 등불의 자리 [x, z].
 * 가운데부터 해바라기 씨처럼 퍼지고, 조금씩 흐트러뜨려 줄이 맞지 않게 해요.
 */
export function slotOf(place: Place, i: number): [number, number] {
  if (place === "항구") {
    const u = 0.1 + i * 0.05;
    const p = pierAt(u);
    const side = (i % 2 ? 1 : -1) * (PIER.w / 2 - 0.35 + jitter(i, 1) * 0.15);
    return [p.x + Math.cos(p.yaw) * side, p.z - Math.sin(p.yaw) * side];
  }
  const c = PLACE_INFO[place];
  const k = place === "등대" ? i + 4 : i; // 등대 꼭대기는 비워둬요
  const r = (place === "숲" ? 2.4 : 2.7) * Math.sqrt(k + 0.5) + jitter(i, 2) * 0.6;
  const a = k * 2.39996 + jitter(i, 3) * 0.25;
  return [c.x + r * Math.cos(a), c.z + r * Math.sin(a)];
}
