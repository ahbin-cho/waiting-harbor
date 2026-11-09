// 테마: 밤 / 노을. 3D 장면 색과 화면(styles.css 의 [data-theme]) 색이 함께 바뀌어요.
// (dawn 은 전역일 계산기 같은 밝은 글 페이지에서만, haven 은 추모관에서만 써요)

export type ThemeName = "night" | "dusk" | "dawn" | "haven";
export type ThemeChoice = "night" | "dusk";

export const THEME_LABEL: Record<ThemeChoice, string> = { night: "밤", dusk: "노을" };
export const THEME_ORDER: ThemeChoice[] = ["dusk", "night"];

/** 3D 장면 색과 빛. styles.css 의 같은 테마 토큰과 맞춰요. */
export type Palette = {
  skyTop: number; skyLow: number; fog: number; fogDensity: number;
  sea: number; land: number; landHigh: number; shore: number; landFar: number; tree: number; tree2: number;
  pier: number; tower: number; band: number; beacon: number; mist: number; mistOpacity: number;
  /** 등불 곁 작은 자리의 등판 (사진과 쪽지가 잘 보이게 따뜻하고 밝은 쪽으로) */
  shrine: number;
  /** 추모관 섬: 낮은 곳과 높은 곳의 땅빛 (차분하게) */
  memLand: number; memHigh: number;
  /** 구름: 추모관(haven)에서만 섬 둘레와 하늘에 몽글몽글 */
  clouds: number; cloud: number;
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
    rainbowLand: 0x435a52, rainbowHigh: 0x627b62, rainbowLight: 26, bridgeGlow: 0.7, shrine: 0x8a7468, memLand: 0x2c3150, memHigh: 0x454a70, clouds: 0, cloud: 0xffffff,
  },
  // 노을: 해가 막 진 항구. 수평선은 주황빛, 위는 보랏빛, 바다엔 붉은 기운. 등불도 잘 보여요.
  dusk: {
    skyTop: 0x2d3566, skyLow: 0xf09a6e, fog: 0x7d5f7e, fogDensity: 0.0034,
    sea: 0x2f3f70, land: 0x3b3550, landHigh: 0x56496a, shore: 0x8a6a6a, landFar: 0x6b5577, tree: 0x23253f, tree2: 0x33304f,
    pier: 0x4a3a3e, tower: 0xd9d0c8, band: 0xa8524a, beacon: 0xfff1d6, mist: 0xffc9a8, mistOpacity: 1.6,
    hemiSky: 0xffb48a, hemiGround: 0x2a2140, hemi: 1.6, sunColor: 0xff9a5c, sun: 1.6,
    exposure: 1.15, stars: 0.25, moon: 0.6, glow: 0.9, lampLight: 0.8, uiColor: "#2D3566",
    rainbowLand: 0x5a6a52, rainbowHigh: 0x7a8a62, rainbowLight: 14, bridgeGlow: 0.5, shrine: 0xd6b79a, memLand: 0x4b4258, memHigh: 0x6d6078, clouds: 0, cloud: 0xffffff,
  },
  // 새벽: 밝은 글 페이지용 하늘은 옅은 하늘색에서 복숭아빛으로, 바다는 맑은 청회색.
  dawn: {
    skyTop: 0x8fb0d9, skyLow: 0xf3d2c4, fog: 0xdcd5e2, fogDensity: 0.0042,
    sea: 0x5f84ad, land: 0x56685c, landHigh: 0x7f8c6b, shore: 0xc2b296, landFar: 0x9aa4c4, tree: 0x2c4a3f, tree2: 0x3f604e,
    pier: 0x6e5a49, tower: 0xeeeae2, band: 0xb4554b, beacon: 0xfff4e2, mist: 0xffffff, mistOpacity: 2.2,
    hemiSky: 0xe3ebff, hemiGround: 0x5d5546, hemi: 1.7, sunColor: 0xffdcbc, sun: 1.8,
    exposure: 1.0, stars: 0, moon: 0.35, glow: 0.6, lampLight: 0.5, uiColor: "#8FB0D9",
    rainbowLand: 0x7fae6e, rainbowHigh: 0xa6cc86, rainbowLight: 2.5, bridgeGlow: 0.25, shrine: 0xe8d4bd, memLand: 0x8c9a98, memHigh: 0xb2bfb8, clouds: 0, cloud: 0xffffff,
  },
  // 추모관: 해가 높은 낮. 연한 하늘빛에서 복숭아빛으로, 구름 위에 떠 있는 듯한 섬.
  // 무겁지 않고 포근하게. 등불과 풍등은 낮에도 은은하게 보여요.
  haven: {
    skyTop: 0x9fd2ec, skyLow: 0xfae3d4, fog: 0xe6eef6, fogDensity: 0.0026,
    sea: 0x9ccbe2, land: 0x9fc79e, landHigh: 0xc6dfb2, shore: 0xf3e6cb, landFar: 0xcfdcef, tree: 0x76a582, tree2: 0x98c49a,
    pier: 0xb48d72, tower: 0xf6efe6, band: 0xeaa293, beacon: 0xfff7ea, mist: 0xffffff, mistOpacity: 2.6,
    hemiSky: 0xf4f8ff, hemiGround: 0xb6c3a6, hemi: 2.1, sunColor: 0xfff2e0, sun: 1.9,
    exposure: 1.0, stars: 0, moon: 0.15, glow: 0.55, lampLight: 0.35, uiColor: "#9FD2EC",
    rainbowLand: 0xa6d690, rainbowHigh: 0xcae8a8, rainbowLight: 1.5, bridgeGlow: 0.2, shrine: 0xf2d3b4,
    memLand: 0xb7dbb3, memHigh: 0xdcefc8, clouds: 1, cloud: 0xffffff,
  },
};

const KEY = "harbor-theme";
export function savedTheme(fallback: ThemeChoice = "dusk"): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "night" || v === "dusk" ? v : fallback; // 처음 온 사람은 노을로 시작해요
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
/** 무지개다리와 작은 자리의 무지개 층: 일곱 빛깔 (파스텔) */
export const RAINBOW_BANDS = [0xff8f8f, 0xffb27e, 0xffe08e, 0xa2e2a4, 0x8fcaff, 0xa9a2ff, 0xd8a8ff];

export function applyUiTheme(name: ThemeName) {
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PALETTES[name].uiColor);
}
