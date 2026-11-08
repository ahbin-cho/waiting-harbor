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
};

export const PALETTES: Record<ThemeName, Palette> = {
  night: {
    skyTop: 0x05081a, skyLow: 0x2b2446, fog: 0x17142e, fogDensity: 0.0038,
    sea: 0x080f2a, land: 0x141833, landHigh: 0x252848, shore: 0x2a2440, landFar: 0x1c1a42, tree: 0x0b132d, tree2: 0x16203f,
    pier: 0x1c1726, tower: 0x1d2140, band: 0x141833, beacon: 0xf4e6c6, mist: 0x8a85b8, mistOpacity: 1,
    hemiSky: 0x5a60a8, hemiGround: 0x080a18, hemi: 1.3, sunColor: 0xbfc6ff, sun: 0.7,
    exposure: 1.1, stars: 1, moon: 1, glow: 1, lampLight: 1, uiColor: "#05081A",
  },
  // 새벽: 해가 막 뜨는 항구. 하늘은 옅은 하늘색에서 복숭아빛으로, 바다는 맑은 청회색.
  dawn: {
    skyTop: 0x8fb0d9, skyLow: 0xf3d2c4, fog: 0xdcd5e2, fogDensity: 0.0042,
    sea: 0x5f84ad, land: 0x56685c, landHigh: 0x7f8c6b, shore: 0xc2b296, landFar: 0x9aa4c4, tree: 0x2c4a3f, tree2: 0x3f604e,
    pier: 0x6e5a49, tower: 0xeeeae2, band: 0xb4554b, beacon: 0xfff4e2, mist: 0xffffff, mistOpacity: 2.2,
    hemiSky: 0xe3ebff, hemiGround: 0x5d5546, hemi: 1.7, sunColor: 0xffdcbc, sun: 1.8,
    exposure: 1.0, stars: 0, moon: 0.35, glow: 0.6, lampLight: 0.5, uiColor: "#8FB0D9",
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
