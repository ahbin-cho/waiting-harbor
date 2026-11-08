// 테마: 밤 / 새벽 / 시간 따라. 3D 장면 색과 화면(styles.css 의 [data-theme]) 색이 함께 바뀌어요.

export type ThemeName = "night" | "dawn";
export type ThemeChoice = ThemeName | "auto";

export const THEME_LABEL: Record<ThemeChoice, string> = { night: "밤", dawn: "새벽", auto: "시간 따라" };
export const THEME_ORDER: ThemeChoice[] = ["night", "dawn", "auto"];

/** 3D 장면 색과 빛. styles.css 의 같은 테마 토큰과 맞춰요. */
export type Palette = {
  skyTop: number; skyLow: number; fog: number; fogDensity: number;
  sea: number; land: number; landHigh: number; shore: number; landFar: number; tree: number; tree2: number;
  pier: number; tower: number; band: number; beacon: number; mist: number; mistOpacity: number;
  hemiSky: number; hemiGround: number; hemi: number; sunColor: number; sun: number;
  exposure: number; stars: number; moon: number; glow: number; lampLight: number; uiColor: string;
  /** 무지개마을: 밤에도 노을빛이 은은하게 남아 있어요 */
  rainbowLand: number; rainbowHigh: number; rainbowLight: number; bridgeGlow: number;
};

export const PALETTES: Record<ThemeName, Palette> = {
  night: {
    // 밤: 어둡지만 섬 윤곽과 나무가 읽히는 정도로 (달빛을 조금 더 밝게)
    skyTop: 0x0a1028, skyLow: 0x3a3060, fog: 0x1f1b3d, fogDensity: 0.0032,
    sea: 0x0f1a40, land: 0x1f2648, landHigh: 0x343a66, shore: 0x3a3358, landFar: 0x29275a, tree: 0x13204a, tree2: 0x203060,
    pier: 0x2c2438, tower: 0x2b3060, band: 0x1f2648, beacon: 0xf4e6c6, mist: 0x8a85b8, mistOpacity: 1,
    hemiSky: 0x7a82d0, hemiGround: 0x10142c, hemi: 1.8, sunColor: 0xc8d0ff, sun: 1.05,
    exposure: 1.25, stars: 1, moon: 1, glow: 1, lampLight: 1, uiColor: "#0A1028",
    rainbowLand: 0x435a52, rainbowHigh: 0x627b62, rainbowLight: 26, bridgeGlow: 0.7,
  },
  // 새벽: 해가 막 뜨는 항구. 하늘은 옅은 하늘색에서 복숭아빛으로, 바다는 맑은 청회색.
  dawn: {
    skyTop: 0x8fb0d9, skyLow: 0xf3d2c4, fog: 0xdcd5e2, fogDensity: 0.0042,
    sea: 0x5f84ad, land: 0x56685c, landHigh: 0x7f8c6b, shore: 0xc2b296, landFar: 0x9aa4c4, tree: 0x2c4a3f, tree2: 0x3f604e,
    pier: 0x6e5a49, tower: 0xeeeae2, band: 0xb4554b, beacon: 0xfff4e2, mist: 0xffffff, mistOpacity: 2.2,
    hemiSky: 0xe3ebff, hemiGround: 0x5d5546, hemi: 1.7, sunColor: 0xffdcbc, sun: 1.8,
    exposure: 1.0, stars: 0, moon: 0.35, glow: 0.6, lampLight: 0.5, uiColor: "#8FB0D9",
    rainbowLand: 0x7fae6e, rainbowHigh: 0xa6cc86, rainbowLight: 2.5, bridgeGlow: 0.25,
  },
};

/** 시간 따라: 오전 6시부터 오후 6시까지는 새벽, 나머지는 밤 */
export const resolveTheme = (c: ThemeChoice, hour = new Date().getHours()): ThemeName =>
  c === "auto" ? (hour >= 6 && hour < 18 ? "dawn" : "night") : c;

const KEY = "harbor-theme";
export function savedTheme(fallback: ThemeChoice = "night"): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "night" || v === "dawn" || v === "auto" ? v : fallback;
  } catch {
    return fallback;
  }
}
export function saveTheme(c: ThemeChoice) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* 저장이 막혀 있어도 이번 방문 동안은 바뀐 테마로 보여요 */
  }
}

/** 화면 쪽 테마 적용: html 의 data-theme 과 브라우저 상단 색 */
export function applyUiTheme(name: ThemeName) {
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PALETTES[name].uiColor);
}
