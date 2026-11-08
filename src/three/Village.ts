import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Lantern } from "../lib/supabase";
import { COLORS, colorOf, shapeOf, type LampShape } from "../lib/looks";
import { ISLANDS, PIER, PLACE_INFO, RAINBOW, fbm, groundAt, harborSlot, jitter, pierAt, placeOf, skyY, slotOf, type Place } from "../lib/places";
import { speciesOf } from "../lib/pets";
import { makePet, type PetRig } from "./pets";
import { Shrine, type ShrineInfo } from "./shrine";
import { badgeText, daysLeft, glowOf, isMiss } from "../lib/waiting";
import type { Shot } from "../lib/story";
import { PALETTES, type Palette, type ThemeName } from "../lib/theme";


const LIGHT_POOL = 6;   // 진짜 빛을 내는 등불 수 (가까운 순)
const LABEL_NEAR = 38;  // 이 거리 안에서 이름이 또렷해요
const LABEL_FAR = 52;   // 이 거리 밖에서는 이름이 사라져요
const LAMP_SCALE = 1.7; // 마을 크기에 맞춘 등불 크기
const PET_SCALE = 1.6;  // 무지개마을 아이들 크기
const OPEN_NEAR = 46;   // 이보다 멀리서 누르면 먼저 그 장소로 다가가요

type Item = {
  id: string;
  data: Lantern;
  place: Place;
  group: THREE.Group;    // 위치
  swing: THREE.Group;    // 흔들리는 부분
  body: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  hit: THREE.Mesh;
  lamp: THREE.Vector3;   // 등 가운데의 월드 좌표
  tag: HTMLDivElement;
  glowLevel: number;     // 0.3~1, 돌아올 날이 가까울수록 커요
  phase: number;
  idx: number;
  baseY: number;         // 기둥 위 등 높이
  lift: number;          // 돌아온 사람의 등불이 하늘로 올라간 높이
  look: string;          // 색+모양, 바뀌면 다시 만들어요
  pet?: PetRig;          // 무지개마을의 아이 (등불 대신 작은 모형)
  refl?: THREE.Mesh;     // 항구 등불: 물 위에 비친 불빛
};

type Tween = { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t0: number; dur: number };

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function radialTexture(inner = "rgba(255,255,255,1)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.25, "rgba(255,255,255,.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function moonTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#F4E6C6";
  g.beginPath();
  g.arc(64, 64, 40, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.arc(48, 54, 38, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.16 : 0.36;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const p = [Math.cos(a) * r, Math.sin(a) * r] as const;
    if (i) s.lineTo(...p);
    else s.moveTo(...p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  g.center();
  return g;
}

/** 초승달: 큰 원에서 비켜 놓인 작은 원을 덜어낸 모양 */
function moonGeometry() {
  const R = 0.36, c = new THREE.Vector2(0.17, 0.08), r = 0.31, th = Math.atan2(c.y, c.x);
  const pts: THREE.Vector2[] = [];
  for (let i = 1; i < 96; i++) {
    const a = th + (i / 96) * Math.PI * 2;
    const p = new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R);
    if (p.distanceTo(c) > r) pts.push(p);
  }
  for (let i = 96; i > 0; i--) {
    const a = th + (i / 96) * Math.PI * 2;
    const p = new THREE.Vector2(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
    if (p.length() < R) pts.push(p);
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  g.center();
  return g.rotateZ(0.35);
}

/** 연꽃 등: 바깥 꽃잎 여덟 장, 안쪽 다섯 장이 조금씩 다르게 벌어져요 */
function lotusGeometry() {
  const parts: THREE.BufferGeometry[] = [new THREE.SphereGeometry(0.3, 12, 6).scale(1, 0.32, 1).translate(0, -0.12, 0)];
  for (let k = 0; k < 8; k++) parts.push(new THREE.SphereGeometry(0.15, 8, 6).scale(0.75, 1.55, 0.42).translate(0, 0.2, 0).rotateX(0.62 + (k % 3) * 0.06).rotateY((k / 8) * Math.PI * 2 + 0.2).translate(0, -0.12, 0));
  for (let k = 0; k < 5; k++) parts.push(new THREE.SphereGeometry(0.12, 8, 6).scale(0.75, 1.6, 0.45).translate(0, 0.18, 0).rotateX(0.28).rotateY((k / 5) * Math.PI * 2 + 0.6).translate(0, -0.08, 0));
  return mergeGeometries(parts)!;
}

/** 작은 집 모양 등: 돌아올 집 */
function houseGeometry() {
  return mergeGeometries([
    new THREE.BoxGeometry(0.46, 0.38, 0.4).translate(0, -0.08, 0),
    new THREE.ConeGeometry(0.41, 0.3, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.92).translate(0, 0.26, 0),
  ])!;
}

const GEO: Record<LampShape, THREE.BufferGeometry> = {
  둥근: new THREE.SphereGeometry(0.32, 14, 10).scale(1, 1.25, 1),
  네모: new THREE.CylinderGeometry(0.3, 0.3, 0.62, 4, 1).rotateY(Math.PI / 4),
  초롱: new THREE.CylinderGeometry(0.25, 0.25, 0.7, 10),
  별: starGeometry(),
  달: moonGeometry(),
  연꽃: lotusGeometry(),
  집: houseGeometry(),
  // 풍등: 위는 좁고 아래가 트인 종이 등. 안쪽 불빛이 비쳐 보여요.
  풍등: new THREE.CylinderGeometry(0.27, 0.36, 0.78, 16, 1, true),
};
const CAP = new THREE.CylinderGeometry(0.14, 0.18, 0.08, 10);
const POLE = new THREE.CylinderGeometry(0.035, 0.045, 1, 6).translate(0, 0.5, 0);
const CORD = new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, 0.5, 0);
const HIT = new THREE.SphereGeometry(0.9, 8, 6);
// 물에 비친 불빛: 바닥에 눕힌 판. 앞(+z)으로 길게 늘여 보는 사람 쪽으로 돌려요
const REFL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.45);

export class Village {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
  private controls: OrbitControls;
  private items = new Map<string, Item>();
  private lights: THREE.PointLight[] = [];
  private glowTex = radialTexture();
  private raycaster = new THREE.Raycaster();
  private tween: Tween | null = null;
  private selected: string | null = null;
  private pulses = new Map<string, number>();
  private me: string | null = null;
  private online = new Set<string>();
  private raf = 0;
  private frame = 0;
  private stars!: THREE.Points;
  private beam!: THREE.Object3D;
  private boat!: THREE.Object3D;
  /** 배가 들어오는 길: 먼 바다 → 부두 끝 → 다시 먼 바다 */
  private ferry!: { arrive: THREE.QuadraticBezierCurve3; leave: THREE.QuadraticBezierCurve3; dock: THREE.Vector3; heading: number };
  /** 물 위에서 흔들리는 것들 (매어 둔 배, 부표) */
  private bobs: { o: THREE.Object3D; y: number; ph: number; roll: number }[] = [];
  /** 열린 등불 곁의 작은 자리 */
  private shrine: Shrine | null = null;
  private shrineInfo: ShrineInfo | null = null;
  private shrineKey = "";
  /** 나무: 등불을 열면 카메라와 등불 사이를 가리는 나무를 잠시 비켜 둬요 */
  private trees: { spots: [number, number, number][]; meshes: THREE.InstancedMesh[]; saved: THREE.Matrix4[][] } | null = null;
  private treeClear: { eye: THREE.Vector3; lamp: THREE.Vector3; spot: THREE.Vector3 } | null = null;
  /** 열린 등불에서 카메라 쪽 (바닥 방향) */
  private selFlat = new THREE.Vector3(0, 0, 1);
  private down: { x: number; y: number; t: number } | null = null;
  private ro: ResizeObserver;
  private paused = false;
  /** 상세를 보는 동안 움직이는 아이를 따라가기 위한 직전 위치 */
  private follow: THREE.Vector3 | null = null;
  /** 10초 영상 찍는 중: 등불 주위를 천천히 돌아요 */
  private cine: { id: string; t0: number; dur: number; a0: number; onFrame: (c: HTMLCanvasElement, k: number) => void; done: () => void } | null = null;
  private p: Palette = PALETTES.night;
  private env = new THREE.Group(); // 하늘과 땅. 테마를 바꾸면 통째로 다시 만들어요
  private moonSprite!: THREE.Sprite;
  private waterTime = { value: 0 };
  private mist: THREE.Sprite[] = [];
  private lighthouse = new THREE.Vector3();
  private lastTouch = performance.now();

  constructor(
    private host: HTMLElement,
    private tags: HTMLElement,
    private onPick: (id: string) => void,
    theme: ThemeName = "night",
  ) {
    this.p = PALETTES[theme];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.p.exposure;
    host.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(this.p.fog, this.p.fogDensity);
    this.scene.add(this.env);
    this.buildSky();
    this.buildLand();
    this.buildRainbow();

    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xffb867, 0, 11, 1.8);
      this.lights.push(l);
      this.scene.add(l);
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 230;
    this.controls.maxPolarAngle = 1.42;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener("start", () => {
      this.tween = null;
      this.controls.autoRotate = false;
      this.lastTouch = performance.now();
    });
    this.controls.addEventListener("end", () => (this.lastTouch = performance.now()));
    this.controls.autoRotateSpeed = -0.25;

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.overview(true);

    document.addEventListener("visibilitychange", this.onVisibility);
    this.loop();
  }

  // ---------- 장면 ----------

  private buildSky() {
    // 하늘: 위는 깊은 남색, 수평선은 보랏빛
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(this.p.skyTop) }, low: { value: new THREE.Color(this.p.skyLow) } },
        vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
        fragmentShader: "uniform vec3 top; uniform vec3 low; varying float h; void main(){ gl_FragColor = vec4(mix(low, top, smoothstep(-.02, .45, h)), 1.); }",
      }),
    );
    this.env.add(sky);

    // 별
    const rand = rng(7);
    const pos: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const u = rand(), v = rand();
      const th = u * Math.PI * 2, y = 0.06 + v * v * 0.94;
      const r = Math.sqrt(1 - y * y);
      pos.push(Math.cos(th) * r * 520, y * 520, Math.sin(th) * r * 520);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ visible: this.p.stars > 0, color: 0xfff4de, size: 1.5 * Math.min(2, window.devicePixelRatio || 1), sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    this.env.add(this.stars);

    // 달
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, transparent: true, opacity: this.p.moon }));
    this.moonSprite = moon;
    moon.position.set(-70, 130, -420);
    moon.scale.setScalar(46);
    this.env.add(moon);

    this.env.add(new THREE.HemisphereLight(this.p.hemiSky, this.p.hemiGround, this.p.hemi));
    const moonLight = new THREE.DirectionalLight(this.p.sunColor, this.p.sun);
    moonLight.position.set(-70, 130, -420).normalize().multiplyScalar(100);
    this.env.add(moonLight);
  }

  private buildLand() {
    const landMat = new THREE.MeshStandardMaterial({ color: this.p.land, roughness: 1 });

    // 바다: 천천히 일렁이는 물결 (셰이더에서 높이와 기울기를 함께 바꿔요)
    const waterMat = new THREE.MeshStandardMaterial({ color: this.p.sea, roughness: 0.78, metalness: 0.05 });
    waterMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.waterTime;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `float a1 = position.x*0.16 + uTime*0.8, a2 = position.z*0.21 - uTime*0.6, a3 = (position.x+position.z)*0.37 + uTime*1.2;
           float dx = cos(a1)*0.16*0.14 + cos(a3)*0.37*0.05;
           float dz = cos(a2)*0.21*0.11 + cos(a3)*0.37*0.05;
           vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));`,
        )
        .replace(
          "#include <begin_vertex>",
          "vec3 transformed = position; transformed.y += sin(a1)*0.14 + sin(a2)*0.11 + sin(a3)*0.05;",
        );
    };
    const water = new THREE.Mesh(new THREE.PlaneGeometry(260, 200, 110, 85).rotateX(-Math.PI / 2), waterMat);
    water.position.set(-2, 0, 0);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: this.p.sea, roughness: 0.6, metalness: 0.1 }));
    ocean.position.y = -0.7;
    this.env.add(water, ocean);

    // 땅: 섬 세 개를 하나의 높이 지도로. 해안선이 들쭉날쭉하고 작은 언덕들이 있어요.
    const W = 150, D = 90;
    const geo = new THREE.PlaneGeometry(W, D, 200, 120).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const base = new THREE.Color(this.p.land), high = new THREE.Color(this.p.landHigh), shore = new THREE.Color(this.p.shore);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) - 4, z = pos.getZ(i) - 10;
      const y = groundAt(x, z);
      pos.setXYZ(i, x, Math.max(y, -3), z);
      const k = THREE.MathUtils.clamp(y / 10, 0, 1);
      tmp.copy(base).lerp(high, k * 0.6 + (fbm(x * 0.3, z * 0.3) - 0.5) * 0.25);
      if (y < 0.5) tmp.lerp(shore, THREE.MathUtils.clamp(1 - (y + 0.3) / 0.8, 0, 1) * 0.6);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.env.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    // 먼 산: 둥글게 눌린 언덕들
    const farMat = new THREE.MeshStandardMaterial({ color: this.p.landFar, roughness: 1 });
    const rand = rng(11);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), farMat);
      m.scale.set(30 + rand() * 50, 14 + rand() * 30, 20 + rand() * 30);
      m.position.set(-300 + i * 36 + rand() * 24, -6, -200 - rand() * 90);
      m.rotation.y = rand() * 3;
      this.env.add(m);
    }

    // 소나무: 세 층, 조금씩 기울고 색과 크기가 달라요
    const trand = rng(3);
    const spots: [number, number, number][] = [];
    for (let n = 0; spots.length < 110 && n < 2000; n++) {
      const pick = trand();
      const c = pick < 0.72 ? ISLANDS.숲 : ISLANDS.언덕;
      const a = trand() * Math.PI * 2, r = Math.sqrt(trand()) * c.r * 0.85;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (c === ISLANDS.언덕 && z > c.z - 2) continue; // 언덕 앞쪽은 비워서 등불이 보이게
      if (groundAt(x, z) < 0.4) continue;
      spots.push([x, z, 0.6 + trand() * 0.9]);
    }
    const tiers = [
      { geo: new THREE.ConeGeometry(1.3, 2.4, 9), y: 1.2 },
      { geo: new THREE.ConeGeometry(1.0, 2.1, 9), y: 2.5 },
      { geo: new THREE.ConeGeometry(0.62, 1.8, 9), y: 3.6 },
    ];
    const treeMat = new THREE.MeshStandardMaterial({ roughness: 1 });
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6).translate(0, 0.5, 0), landMat, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    const cA = new THREE.Color(this.p.tree), cB = new THREE.Color(this.p.tree2);
    const meshes = tiers.map((t) => new THREE.InstancedMesh(t.geo, treeMat, spots.length));
    spots.forEach(([x, z, s], i) => {
      const y = groundAt(x, z) - 0.1;
      e.set((trand() - 0.5) * 0.12, trand() * 6, (trand() - 0.5) * 0.12);
      q.setFromEuler(e);
      sc.set(s * (0.85 + trand() * 0.3), s * (0.9 + trand() * 0.35), s * (0.85 + trand() * 0.3));
      const col = cA.clone().lerp(cB, trand());
      trunk.setMatrixAt(i, m4.compose(p.set(x, y, z), q, sc));
      tiers.forEach((t, k) => {
        // 기운 방향을 따라 층을 올려요
        const up = new THREE.Vector3(0, t.y * sc.y, 0).applyQuaternion(q);
        meshes[k].setMatrixAt(i, m4.compose(p.set(x + up.x, y + up.y, z + up.z), q, sc));
        meshes[k].setColorAt(i, col);
      });
    });
    this.env.add(trunk, ...meshes);
    const all = [trunk, ...meshes];
    this.trees = { spots, meshes: all, saved: all.map((m) => spots.map((_, i) => { const x = new THREE.Matrix4(); m.getMatrixAt(i, x); return x; })) };
    this.applyTreeClear();

    // 부두: 휘어진 길을 따라 널빤지를 하나씩. 높이와 기울기가 조금씩 달라요.
    const prand = rng(5);
    const plankN = Math.round(PIER.len / 0.55);
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(PIER.w, 0.1, 0.48), new THREE.MeshStandardMaterial({ color: this.p.pier, roughness: 0.95 }), plankN);
    for (let i = 0; i < plankN; i++) {
      const at = pierAt(i / plankN);
      e.set((prand() - 0.5) * 0.05, at.yaw + (prand() - 0.5) * 0.05, (prand() - 0.5) * 0.06);
      planks.setMatrixAt(i, m4.compose(p.set(at.x, at.deck - 0.05 + (prand() - 0.5) * 0.04, at.z), q.setFromEuler(e), sc.set(1 - prand() * 0.08, 1, 1)));
    }
    const postN = Math.round(PIER.len / 3) * 2;
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.14, 1, 6).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ color: this.p.pier, roughness: 1 }), postN);
    for (let i = 0; i < postN; i++) {
      const at = pierAt(Math.floor(i / 2) / (postN / 2) + 0.02);
      const side = (i % 2 ? 1 : -1) * (PIER.w / 2 - 0.05);
      e.set((prand() - 0.5) * 0.14, 0, (prand() - 0.5) * 0.14);
      posts.setMatrixAt(i, m4.compose(p.set(at.x + Math.cos(at.yaw) * side, at.deck + 0.25 + prand() * 0.2, at.z - Math.sin(at.yaw) * side), q.setFromEuler(e), sc.set(1, 2.6, 1)));
    }
    this.env.add(planks, posts);

    this.buildHarbor(landMat);

    // 등대: 섬에서 가장 높은 곳에, 아주 조금 기울어서
    let best: { x: number; z: number; y: number } = { x: ISLANDS.등대.x, z: ISLANDS.등대.z, y: -9 };
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      const x = ISLANDS.등대.x + dx, z = ISLANDS.등대.z + dz, y = groundAt(x, z);
      if (y > best.y) best = { x, z, y };
    }
    this.lighthouse.set(best.x, best.y, best.z);
    const towerMat = new THREE.MeshStandardMaterial({ color: this.p.tower, roughness: 0.85 });
    const lh = new THREE.Group();
    lh.position.set(best.x, best.y - 0.3, best.z);
    lh.rotation.set(0.02, 0, -0.025);
    lh.add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 7.5, 16).translate(0, 3.75, 0), towerMat),
      new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.13, 0.8, 16).translate(0, 3, 0), new THREE.MeshStandardMaterial({ color: this.p.band, roughness: 0.9 })),
      new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 12).translate(0, 7.95, 0), new THREE.MeshBasicMaterial({ color: this.p.beacon })),
      new THREE.Mesh(new THREE.ConeGeometry(0.95, 1, 12).translate(0, 8.9, 0), towerMat),
    );
    this.env.add(lh);
    const pivot = new THREE.Group();
    pivot.position.set(best.x, best.y + 7.6, best.z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this.p.beacon, transparent: true, opacity: 0.6 * this.p.glow, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(5);
    pivot.add(halo);
    this.beam = pivot;
    this.env.add(pivot);

    // 물 위를 흘러가는 옅은 안개
    const mrand = rng(23);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this.p.mist, transparent: true, opacity: (0.025 + mrand() * 0.025) * this.p.mistOpacity, depthWrite: false }));
      s.scale.set(40 + mrand() * 30, 6 + mrand() * 4, 1);
      s.position.set(-70 + mrand() * 130, 1.5 + mrand() * 2, -20 + mrand() * 40);
      s.userData.speed = 0.4 + mrand() * 0.5;
      this.mist.push(s);
      this.env.add(s);
    }
  }

  /** 무지개마을: 바다 건너 풀밭 섬, 작은 집, 연못, 나무, 바위, 그리고 등대에서 이어지는 무지개다리 */
  /** 항구: 부두 끝 쉼터와 의자, 대합실, 매어 둔 작은 배, 부표, 난간 밧줄, 드나드는 배 */
  private buildHarbor(landMat: THREE.MeshStandardMaterial) {
    this.bobs = [];
    const r = rng(17);
    const pierMat = new THREE.MeshStandardMaterial({ color: this.p.pier, roughness: 1 });
    const ropeMat = new THREE.LineBasicMaterial({ color: this.p.shore, transparent: true, opacity: 0.7 });
    const right = (yaw: number) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const fwd = (yaw: number) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const onPier = (u: number, side: number, up = 0) => {
      const a = pierAt(u);
      return new THREE.Vector3(a.x, a.deck + up, a.z).addScaledVector(right(a.yaw), side);
    };
    const rope = (pts: THREE.Vector3[]) => this.env.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeMat));

    // 난간 밧줄: 기둥 사이로 조금씩 처져요
    const postN = Math.round(PIER.len / 3);
    for (const sd of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < postN; k++) {
        const u0 = k / postN + 0.02, u1 = Math.min(0.97, (k + 1) / postN + 0.02);
        if (u0 >= u1) break;
        for (let j = 0; j <= 6; j++) {
          const w = j / 6;
          pts.push(onPier(u0 + (u1 - u0) * w, sd * (PIER.w / 2 - 0.05), 0.36 - Math.sin(Math.PI * w) * (0.13 + r() * 0.05)));
        }
      }
      rope(pts);
    }

    // 부두 끝: 조금 넓은 쉼터와, 바다 쪽을 보는 긴 의자 하나
    const end = pierAt(0.985);
    const head = new THREE.Group();
    head.position.set(end.x, end.deck, end.z);
    head.rotation.set(0.01, end.yaw + 0.04, -0.015);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(PIER.w + 3.4, 0.12, 2.8), pierMat);
    deck.position.set(0.4, -0.06, 0.2);
    head.add(deck);
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.46), pierMat);
    seat.position.y = 0.46;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.06), pierMat);
    back.position.set(0, 0.76, -0.22);
    back.rotation.x = -0.12;
    bench.add(seat, back);
    for (const lx of [-0.8, 0.8]) for (const lz of [-0.17, 0.17]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.07), pierMat);
      leg.position.set(lx, 0.23, lz);
      bench.add(leg);
    }
    bench.position.set(0.9, 0, 0.5);
    bench.rotation.y = -0.07;
    head.add(bench);
    // 배를 매는 말뚝
    for (const [bx, bz] of [[-2.3, 1.2], [2.9, 1.0], [2.6, -0.9]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.42, 8), pierMat);
      b.position.set(bx, 0.21, bz);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.07, 8), pierMat);
      cap.position.set(bx, 0.44, bz);
      head.add(b, cap);
    }
    this.env.add(head);

    // 부두 들머리: 상자와 통 몇 개
    for (let i = 0; i < 5; i++) {
      const sd = (i < 3 ? -1 : 1) * (PIER.w / 2 - 0.5 - r() * 0.3);
      const at = onPier(0.015 + r() * 0.04, sd);
      const m = i % 2
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.7, 10).translate(0, 0.35, 0), landMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.62).translate(0, 0.275, 0), pierMat);
      m.position.copy(at);
      m.rotation.y = r() * 3;
      if (i === 2) m.position.y += 0.55; // 하나는 위에 얹어요
      this.env.add(m);
    }

    // 대합실: 부두가 시작되는 언덕 자락의 작은 집. 창에는 불이 없어요 (빛은 등불만)
    const root = pierAt(0);
    let spot = { x: root.x - 5, z: root.z - 4, y: groundAt(root.x - 5, root.z - 4), d: 1e9 };
    for (let dx = -10; dx <= 2; dx += 0.5) for (let dz = -10; dz <= 1; dz += 0.5) {
      const x = root.x + dx, z = root.z + dz, y = groundAt(x, z);
      const flat = Math.abs(groundAt(x + 1.5, z) - y) + Math.abs(groundAt(x, z + 1.5) - y);
      const d = Math.hypot(dx + 5, dz + 3) + flat * 4;
      if (y > 0.6 && y < 3 && d < spot.d) spot = { x, z, y, d };
    }
    const hut = new THREE.Group();
    hut.position.set(spot.x, spot.y - 0.15, spot.z);
    hut.rotation.set(0.015, root.yaw + 0.5, -0.02);
    const wallMat = new THREE.MeshStandardMaterial({ color: this.p.tower, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: this.p.band, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: this.p.tree, roughness: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.9, 2.2).translate(0, 0.95, 0), wallMat);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.15, 4).rotateY(Math.PI / 4).scale(1.05, 1, 0.82).translate(0, 2.45, 0), roofMat);
    roof.rotation.z = 0.03;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.15, 0.05).translate(0, 0.58, 1.12), darkMat);
    door.position.x = -0.6;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.05).translate(0.65, 1.15, 1.12), darkMat);
    const bench2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.36).translate(0.6, 0.42, 1.4), pierMat);
    hut.add(body, roof, door, win, bench2);
    this.env.add(hut);

    // 매어 둔 작은 배 두 척과 부표
    const hullGeo = (w: number, h: number, l: number) => new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(w, h, l);
    for (const [u, sd, turn] of [[0.48, -1, 0.12], [0.66, 1, -0.2]] as const) {
      const a = pierAt(u);
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(hullGeo(0.55, 0.32, 1.35), pierMat);
      hull.rotation.x = Math.PI; // 속이 빈 쪽이 위로
      hull.position.y = 0.32;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.22), landMat);
      plank.position.y = 0.26;
      boat.add(hull, plank);
      const pos = onPier(u, sd * (PIER.w / 2 + 1.25));
      boat.position.set(pos.x, 0.05, pos.z);
      boat.rotation.y = a.yaw + turn;
      this.env.add(boat);
      this.bobs.push({ o: boat, y: 0.05, ph: u * 9, roll: 0.06 });
      // 뱃머리에서 가까운 기둥으로 밧줄
      const bow = boat.position.clone().addScaledVector(fwd(a.yaw + turn), 1.1).setY(0.4);
      const post = onPier(u + 0.03, sd * (PIER.w / 2 - 0.05), 0.35);
      const mid = bow.clone().lerp(post, 0.5).setY(Math.min(bow.y, post.y) - 0.2);
      rope([bow, mid, post]);
    }
    const buoyMat = new THREE.MeshStandardMaterial({ color: this.p.band, roughness: 0.8 });
    for (const [u, sd] of [[0.78, -1], [1.05, 1], [1.12, -1]] as const) {
      const pos = onPier(Math.min(u, 1), sd * (PIER.w / 2 + 4 + r() * 2)).addScaledVector(fwd(pierAt(1).yaw), (u - 1) * 30 * (u > 1 ? 1 : 0));
      const buoy = new THREE.Group();
      buoy.add(
        new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8).scale(1, 0.8, 1), buoyMat),
        new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6).translate(0, 0.45, 0), buoyMat),
      );
      buoy.position.set(pos.x, 0.12, pos.z);
      this.env.add(buoy);
      this.bobs.push({ o: buoy, y: 0.12, ph: u * 17, roll: 0.12 });
    }

    // 드나드는 배: 먼 바다에서 들어와 부두 끝에 잠시 머물다 다시 나가요
    const ferry = new THREE.Group();
    const fh = new THREE.Mesh(hullGeo(1.25, 0.62, 3.4), pierMat);
    fh.rotation.x = Math.PI;
    fh.position.y = 0.5;
    const deckTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 5.2), landMat);
    deckTop.position.y = 0.48;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 1.7).translate(0, 1.0, -0.9), wallMat);
    const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, 1.95).translate(0, 1.58, -0.9), roofMat);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 3.2, 5).translate(0, 1.6, 0.9), landMat);
    mast.rotation.z = 0.05;
    ferry.add(fh, deckTop, cabin, cabinRoof, mast);
    const dockU = pierAt(0.95);
    const dock = onPier(0.95, PIER.w / 2 + 1.75).setY(0);
    const f = fwd(dockU.yaw), rt = right(dockU.yaw);
    const arrive = new THREE.QuadraticBezierCurve3(
      dock.clone().addScaledVector(f, 210).addScaledVector(rt, 95),
      dock.clone().addScaledVector(f, 16).addScaledVector(rt, 1.5),
      dock.clone(),
    );
    const leave = new THREE.QuadraticBezierCurve3(
      dock.clone(),
      dock.clone().addScaledVector(rt, 10).addScaledVector(f, 6),
      dock.clone().addScaledVector(f, 200).addScaledVector(rt, -45),
    );
    const tan = arrive.getTangent(1);
    const heading = Math.atan2(tan.x, tan.z);
    ferry.position.copy(dock);
    ferry.rotation.y = heading;
    this.ferry = { arrive, leave, dock, heading };
    this.boat = ferry;
    this.env.add(ferry);
  }

  /** 드나드는 배 움직이기. t 가 없으면(움직임 줄이기) 부두에 매어 둔 채로 */
  private sailFerry(t: number | null) {
    const f = this.ferry, b = this.boat;
    if (!f) return;
    if (t == null) {
      b.visible = true;
      b.position.set(f.dock.x, 0.12, f.dock.z);
      b.rotation.set(0, f.heading, 0);
      return;
    }
    const CYCLE = 150, k = (t % CYCLE) / CYCLE;
    const pos = new THREE.Vector3(), tan = new THREE.Vector3();
    if (k < 0.35) {
      const s = 1 - Math.pow(1 - k / 0.35, 3); // 들어올 땐 천천히 멈추듯
      f.arrive.getPoint(s, pos);
      f.arrive.getTangent(s, tan);
    } else if (k < 0.6) {
      pos.copy(f.dock);
      tan.set(Math.sin(f.heading), 0, Math.cos(f.heading));
    } else if (k < 0.95) {
      const s = Math.pow((k - 0.6) / 0.35, 2); // 나갈 땐 천천히 출발해서
      f.leave.getPoint(s, pos);
      f.leave.getTangent(s, tan);
    } else {
      b.visible = false;
      return;
    }
    const want = Math.atan2(tan.x, tan.z);
    if (!b.visible) b.rotation.y = want;
    b.visible = true;
    let d = want - b.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    b.rotation.y += d * 0.025;
    b.position.set(pos.x, 0.12 + Math.sin(t * 1.1) * 0.06, pos.z);
    b.rotation.z = Math.sin(t * 0.9) * 0.03;
  }

  private buildRainbow() {
    const isl = ISLANDS.무지개;
    const p = this.p;

    // 섬 땅: 부드러운 풀빛, 높은 곳은 조금 더 밝게
    const geo = new THREE.PlaneGeometry(64, 64, 110, 110).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const low = new THREE.Color(p.rainbowLand), high = new THREE.Color(p.rainbowHigh), sand = new THREE.Color(p.shore), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + isl.x, z = pos.getZ(i) + isl.z, y = groundAt(x, z);
      pos.setXYZ(i, x, Math.max(y, -3), z);
      tmp.copy(low).lerp(high, THREE.MathUtils.clamp(y / 2.5, 0, 1) * 0.7 + (fbm(x * 0.3, z * 0.3) - 0.5) * 0.3);
      if (y < 0.4) tmp.lerp(sand, THREE.MathUtils.clamp(1 - (y + 0.3) / 0.7, 0, 1) * 0.7);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.env.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    // 섬 위의 따뜻한 빛 (밤에도 노을빛이 남아 있어요)
    const warm = new THREE.PointLight(0xffd2a8, p.rainbowLight, 60, 1.2);
    warm.position.set(isl.x - 2, 14, isl.z + 4);
    this.env.add(warm);

    const g = (x: number, z: number) => Math.max(0.1, groundAt(x, z));
    const rand = rng(41);

    // 작은 집: 고양이들이 지붕에서 졸아요
    const wall = new THREE.MeshStandardMaterial({ color: 0xefe3d3, roughness: 0.9 });
    const roofs = [0xc77b68, 0x7e9fc9, 0xd2ae5c];
    RAINBOW.cottages.forEach(([x, z], k) => {
      const h = new THREE.Group();
      h.position.set(x, g(x, z) - 0.1, z);
      h.rotation.y = rand() * 0.6 - 0.3;
      h.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2).translate(0, 0.8, 0), wall));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.95, 1.1, 4).rotateY(Math.PI / 4).translate(0, 2.15, 0), new THREE.MeshStandardMaterial({ color: roofs[k % roofs.length], roughness: 0.85 }));
      roof.scale.set(1, 1, 0.8);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.8).translate(0, 0.4, 1.01), new THREE.MeshStandardMaterial({ color: 0x7a5a44 }));
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4).translate(0.7, 1, 1.01), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
      h.add(roof, door, win);
      this.env.add(h);
    });

    // 연못: 물고기가 헤엄쳐요
    const [px, pz] = RAINBOW.pond;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(2.9, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5f9fc4, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }));
    pond.position.set(px, g(px, pz) + 0.04, pz);
    pond.scale.set(1, 1, 0.8);
    this.env.add(pond);

    // 나무들: 새가 꼭대기에 앉아요
    const leaf = new THREE.MeshStandardMaterial({ color: 0x4f8a5a, roughness: 1 });
    const bark = new THREE.MeshStandardMaterial({ color: 0x6b4e3a, roughness: 1 });
    for (const [x, z] of RAINBOW.birdTrees) {
      const y = g(x, z);
      this.env.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7).translate(x, y + 1.3, z), bark));
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), leaf);
        m.scale.setScalar(1.3 - k * 0.25);
        m.position.set(x + (rand() - 0.5) * 0.6, y + 2.6 + k * 0.6, z + (rand() - 0.5) * 0.6);
        this.env.add(m);
      }
    }

    // 큰 참나무: 곤충들이 줄기에 붙어 지내요
    const [ox, oz] = RAINBOW.oak, oy = g(ox, oz);
    this.env.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 4.2, 9).translate(ox, oy + 2.1, oz), bark));
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), leaf);
      const a = k * 1.3;
      m.scale.set(2 + rand(), 1.4 + rand() * 0.6, 2 + rand());
      m.position.set(ox + Math.cos(a) * 1.5, oy + 4.6 + rand() * 0.8, oz + Math.sin(a) * 1.5);
      this.env.add(m);
    }

    // 덤불: 햄스터와 토끼가 오가요
    const [bx, bz] = RAINBOW.bushes;
    for (let k = 0; k < 9; k++) {
      const a = rand() * Math.PI * 2, r = 0.8 + rand() * 3.4;
      const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), leaf);
      m.scale.set(0.6 + rand() * 0.4, 0.45 + rand() * 0.25, 0.6 + rand() * 0.4);
      m.position.set(x, g(x, z) + 0.15, z);
      this.env.add(m);
    }

    // 볕 드는 바위: 거북이와 도마뱀
    const stone = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.95, flatShading: true });
    const [rx, rz] = RAINBOW.rocks;
    const big = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 0), stone);
    big.scale.set(1.3, 0.42, 1.1);
    big.position.set(rx, g(rx, rz) + 0.3, rz);
    this.env.add(big);

    // 무지개다리: 등대 절벽에서 섬까지 일곱 빛깔 아치
    const [ax, az] = RAINBOW.bridge.from, [cx, cz] = RAINBOW.bridge.to;
    const dx = cx - ax, dz = cz - az, len = Math.hypot(dx, dz);
    const arch = new THREE.Group();
    arch.position.set((ax + cx) / 2, -0.4, (az + cz) / 2);
    arch.rotation.y = -Math.atan2(dz, dx);
    arch.scale.y = 0.55;
    ["#ff8f8f", "#ffb27e", "#ffe08e", "#a2e2a4", "#8fcaff", "#a9a2ff", "#d8a8ff"].forEach((c, k) => {
      const col = new THREE.Color(c);
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(len / 2 - k * 0.45, 0.24, 8, 80, Math.PI),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: p.bridgeGlow, roughness: 0.6, transparent: true, opacity: 0.88 }),
      );
      arch.add(m);
    });
    this.env.add(arch);
  }

  // ---------- 등불 ----------

  setData(lanterns: Lantern[], me: string | null, online: Set<string>) {
    this.me = me;
    this.online = online;
    const seen = new Set<string>();
    const count = new Map<Place, number>();
    for (const l of [...lanterns].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const place = placeOf(l.place);
      // 무지개마을은 같은 종류끼리 자리를 나눠요 (강아지는 풀밭, 고양이는 지붕…)
      const key = (place === "무지개" ? `무지개/${speciesOf(l.species)}` : place) as Place;
      const i = count.get(key) ?? 0;
      count.set(key, i + 1);
      seen.add(l.id);
      this.upsert(l, place, i);
    }
    for (const [id, it] of this.items) if (!seen.has(id)) this.remove(it);
  }

  private upsert(l: Lantern, place: Place, i: number) {
    const look = `${colorOf(l.color)}/${shapeOf(l.shape)}/${place}/${l.mode}/${l.species ?? ""}`;
    let it = this.items.get(l.id);
    if (it && it.look !== look) {
      this.remove(it);
      it = undefined;
    }
    if (!it) it = this.create(l, place, look, i);
    it.data = l;

    if (it.pet) {
      // 무지개마을의 아이는 스스로 움직여요. 밝기와 이름표만 맞춰요.
      it.idx = i;
      it.glowLevel = glowOf(l);
      this.setTag(it, l);
      return;
    }

    // 자리
    const [x, z] = slotOf(place, i);
    const info = PLACE_INFO[place];
    const ground = place === "항구" ? harborSlot(i).deck : place === "하늘" ? skyY(i) : Math.max(0.2, groundAt(x, z));
    it.idx = i;
    it.group.position.set(x, ground, z);
    // 기둥은 조금씩 기울고, 높이도 조금씩 달라요
    it.group.rotation.set(jitter(i + place.length * 31, 4) * 0.07, 0, jitter(i + place.length * 31, 5) * 0.07);
    it.baseY = place === "하늘" ? 0 : (info.hang ? 2.6 : 1.45) + jitter(i + place.length * 31, 6) * (info.hang ? 0.5 : 0.15);

    // 밝기: 기다림은 돌아올 날이 가까울수록, 그리움은 떠난 날이나 처음 만난 날이 다가올수록.
    // 돌아온 사람의 등불은 기둥을 떠나 하늘로 올라가요.
    it.glowLevel = glowOf(l);
    const left = isMiss(l) ? 1 : daysLeft(l) ?? 1;
    it.lift = !isMiss(l) && left < 0 ? Math.min(6, 1.5 + -left * 0.8) : 0;
    it.swing.position.y = it.baseY + it.lift;
    it.lamp.set(x, ground + it.swing.position.y * LAMP_SCALE, z);
    if (it.refl) {
      // 부두 바깥 물 위로 조금 비켜서
      const h = harborSlot(i);
      const out = Math.sign(h.side) * (PIER.w / 2 - Math.abs(h.side) + 1.2);
      it.refl.position.set(x + Math.cos(h.yaw) * out, 0.36, z - Math.sin(h.yaw) * out);
    }

    this.setTag(it, l);
  }

  private setTag(it: Item, l: Lantern) {
    it.tag.className = `tag${l.user_id === this.me ? " mine" : ""}`;
    it.tag.replaceChildren();
    const b = document.createElement("b");
    b.textContent = l.who;
    const s = document.createElement("span");
    s.textContent = badgeText(l);
    it.tag.append(b, s);
  }

  private create(l: Lantern, place: Place, look: string, i: number): Item {
    if (place === "무지개") return this.createPet(l, place, look, i);
    const color = new THREE.Color(COLORS[colorOf(l.color)]);
    const shape = shapeOf(l.shape);
    const hang = PLACE_INFO[place].hang;
    const sky = place === "하늘";
    const group = new THREE.Group();
    group.scale.setScalar(LAMP_SCALE);
    const swing = new THREE.Group();
    group.add(swing);

    if (sky) {
      // 하늘 등불은 기둥도 끈도 없이 떠 있어요
    } else if (hang) {
      const cord = new THREE.Mesh(CORD, new THREE.MeshBasicMaterial({ color: 0x8a8070 }));
      cord.scale.y = 1.4;
      cord.position.y = 0.35;
      swing.add(cord);
    } else {
      // 기둥은 땅에서 등 아래까지 (등 가운데 높이 1.45)
      const pole = new THREE.Mesh(POLE, new THREE.MeshStandardMaterial({ color: this.p.pier, roughness: 1 }));
      pole.scale.y = 1.05;
      pole.userData.pole = true;
      group.add(pole);
    }

    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1, roughness: 0.6, side: shape === "풍등" ? THREE.DoubleSide : THREE.FrontSide });
    const body = new THREE.Mesh(GEO[shape], mat);
    swing.add(body);
    if (shape === "풍등") {
      // 아래쪽에 작은 불씨
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1d0 }));
      flame.position.y = -0.3;
      swing.add(flame);
    } else if (shape === "둥근" || shape === "네모" || shape === "초롱") {
      const capMat = new THREE.MeshStandardMaterial({ color: 0x241712, roughness: 1 });
      const top = new THREE.Mesh(CAP, capMat);
      top.position.y = 0.38;
      const bottom = new THREE.Mesh(CAP, capMat);
      bottom.position.y = -0.38;
      swing.add(top, bottom);
      if (shape === "초롱") {
        // 초롱 아래로 늘어진 술
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 6).translate(0, -0.55, 0), capMat);
        swing.add(tassel);
      }
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    swing.add(glow);

    const hit = new THREE.Mesh(HIT, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.id = l.id;
    swing.add(hit);

    this.scene.add(group);
    const tag = document.createElement("div");
    this.tags.appendChild(tag);

    let refl: THREE.Mesh | undefined;
    if (place === "항구") {
      refl = new THREE.Mesh(REFL, new THREE.MeshBasicMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      refl.renderOrder = 1;
      this.scene.add(refl);
    }

    const it: Item = {
      id: l.id, data: l, place, group, swing, body, mat, glow, hit, refl,
      lamp: new THREE.Vector3(), tag, glowLevel: 0.5, phase: Math.random() * 10, idx: 0, baseY: 1.45, lift: 0, look,
    };
    this.items.set(l.id, it);
    return it;
  }

  /** 무지개마을의 아이 하나 */
  private createPet(l: Lantern, place: Place, look: string, i: number): Item {
    const color = new THREE.Color(COLORS[colorOf(l.color)]);
    const phase = Math.random() * 10;
    const pet = makePet(speciesOf(l.species), color, i, phase);
    pet.update(performance.now() / 1000, false); // 처음부터 제자리에 두어서, 바로 다가갈 수 있게
    const group = new THREE.Group();
    group.add(pet.root, ...pet.extras);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.y = pet.headY * 0.5;
    const hit = new THREE.Mesh(HIT, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.id = l.id;
    hit.position.y = pet.headY * 0.5;
    pet.root.add(glow, hit);
    this.scene.add(group);
    const tag = document.createElement("div");
    this.tags.appendChild(tag);
    const it: Item = {
      // mat 은 근처 빛(PointLight) 색을 정하는 데만 써요. 아이 자체는 빛 재질(pets.ts)로 그려요.
      id: l.id, data: l, place, group, swing: pet.root, body: pet.body, mat: new THREE.MeshStandardMaterial({ color }), glow, hit,
      lamp: pet.root.position.clone().setY(pet.root.position.y + pet.headY * 0.6 * PET_SCALE), tag, glowLevel: 0.5, phase, idx: i, baseY: 0, lift: 0, look, pet,
    };
    this.items.set(l.id, it);
    return it;
  }

  private remove(it: Item) {
    this.scene.remove(it.group);
    if (it.refl) {
      this.scene.remove(it.refl);
      (it.refl.material as THREE.Material).dispose();
    }
    it.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      m?.dispose();
    });
    it.tag.remove();
    this.items.delete(it.id);
  }

  /** 테마 바꾸기: 하늘과 땅을 새 색으로 다시 만들고, 등불 기둥 색도 맞춰요 */
  setTheme(name: ThemeName) {
    const p = PALETTES[name];
    if (p === this.p) return;
    this.p = p;
    // 작은 자리도 새 색으로 다시
    this.shrine?.dispose();
    this.shrine = null;
    this.shrineKey = "";
    queueMicrotask(() => this.setShrine(this.shrineInfo));
    this.env.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((x) => x.dispose());
    });
    this.env.clear();
    this.mist = [];
    (this.scene.fog as THREE.FogExp2).color.set(p.fog);
    (this.scene.fog as THREE.FogExp2).density = p.fogDensity;
    this.renderer.toneMappingExposure = p.exposure;
    this.buildSky();
    this.buildLand();
    this.buildRainbow();
    for (const it of this.items.values()) {
      it.group.traverse((o) => {
        if (o.userData.pole) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(p.pier);
      });
    }
  }

  pulse(id: string) {
    this.pulses.set(id, performance.now());
    if (this.shrineInfo?.id === id) this.shrine?.burst();
  }

  // ---------- 등불 곁의 작은 자리 ----------

  /** 카메라에서 볼 때 화면 오른쪽 (바닥 방향) */
  private rightOf(flat: THREE.Vector3) {
    return new THREE.Vector3().crossVectors(flat.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
  }

  /** 열린 등불 곁에 작은 자리를 놓아요. 사진·번호·한 줄이 바뀌면 다시 만들어요. */
  setShrine(info: ShrineInfo | null) {
    this.shrineInfo = info;
    const it = info ? this.items.get(info.id) : undefined;
    if (!info || !it || this.selected !== info.id) {
      this.shrine?.dispose();
      this.shrine = null;
      this.shrineKey = "";
      return;
    }
    const key = [info.id, info.photo ?? "", info.no, info.who, info.line, info.color, this.selFlat.toArray().join()].join("|");
    if (key !== this.shrineKey) {
      this.shrine?.dispose();
      this.shrine = new Shrine(info, this.p, this.glowTex, it.place === "하늘" || !!it.pet);
      this.shrineKey = key;
      this.scene.add(this.shrine.group);
      this.shrine.group.rotation.y = Math.atan2(this.selFlat.x, this.selFlat.z) - 0.12;
      this.placeShrine();
    }
    this.shrine?.setCount(info.count);
  }

  /** 카메라와 등불·작은 자리 사이를 가리는 나무를 숨기거나(열었을 때) 되돌려요(닫았을 때) */
  private applyTreeClear() {
    const tr = this.trees;
    if (!tr) return;
    const c = this.treeClear;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    // 바닥에서 점 p 와 선분 a-b 사이 거리, 그리고 선분 위 위치(0~1)
    const seg = (px: number, pz: number, a: THREE.Vector3, b: THREE.Vector3) => {
      const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1;
      const t = THREE.MathUtils.clamp(((px - a.x) * dx + (pz - a.z) * dz) / L, 0, 1);
      return { d: Math.hypot(a.x + dx * t - px, a.z + dz * t - pz), t };
    };
    tr.spots.forEach(([x, z, sc], i) => {
      let hide = false;
      if (c) {
        const r = 1.3 * sc + 0.7;
        const toLamp = seg(x, z, c.eye, c.lamp), toSpot = seg(x, z, c.eye, c.spot);
        hide =
          (toLamp.d < r && toLamp.t < 0.97) ||
          (toSpot.d < r && toSpot.t < 0.97) ||
          Math.hypot(x - c.spot.x, z - c.spot.z) < r + 1.4 ||
          Math.hypot(x - c.lamp.x, z - c.lamp.z) < r * 0.8;
      }
      tr.meshes.forEach((m, k) => m.setMatrixAt(i, hide ? zero : tr.saved[k][i]));
    });
    tr.meshes.forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    });
  }

  /** 작은 자리가 놓일 곳 (받침 바닥 기준). 카메라에서 볼 때 등불 오른쪽, 항구에선 부두 위 */
  private shrineSpot(it: Item, flat: THREE.Vector3) {
    const right = this.rightOf(flat);
    if (it.place === "하늘" || it.pet) return it.lamp.clone().addScaledVector(right, 2.1).add(new THREE.Vector3(0, -1.7, 0));
    if (it.place === "항구") {
      // 부두 가운데, 카메라에서 조금 먼 쪽으로 부두를 따라 옮겨서 물 위에 뜨지 않게
      const h = harborSlot(it.idx);
      const fw = new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
      const way = fw.dot(flat) > 0 ? -1 : 1;
      return new THREE.Vector3(it.group.position.x - Math.cos(h.yaw) * h.side, h.deck, it.group.position.z + Math.sin(h.yaw) * h.side).addScaledVector(fw, way * 1.6);
    }
    const p = it.group.position.clone().addScaledVector(right, 2.1).addScaledVector(flat, 0.7);
    p.y = Math.max(0.2, groundAt(p.x, p.z)) - 0.05;
    return p;
  }

  private placeShrine() {
    const sh = this.shrine, info = this.shrineInfo;
    const it = info ? this.items.get(info.id) : undefined;
    if (!sh || !it) {
      if (info && !sh) this.setShrine(info);
      return;
    }
    const flat = this.selFlat;
    sh.group.position.copy(this.shrineSpot(it, flat));
  }

  // ---------- 카메라 ----------

  private get narrow() {
    return this.camera.aspect < 1;
  }

  private flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 1300) {
    if (still()) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.tween = null;
      return;
    }
    this.tween = { from: [this.camera.position.clone(), this.controls.target.clone()], to: [pos, target], t0: performance.now(), dur };
    this.lastTouch = performance.now() + dur;
  }

  /** 바다 쪽 비스듬한 곳에서 마을 전체를 내려다봐요 */
  /** 닫은 뒤 다른 곳으로 옮겨 갈 때 비켜 둔 나무를 되돌려요 */
  private releaseTrees() {
    if (!this.treeClear || this.selected) return;
    this.treeClear = null;
    this.applyTreeClear();
  }

  overview(instant = false) {
    this.releaseTrees();
    const target = new THREE.Vector3(-2, 0, -10);
    const dir = new THREE.Vector3(0.22, 0.52, 0.83).normalize();
    const pos = target.clone().addScaledVector(dir, this.narrow ? 185 : 100);
    if (instant) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
    } else this.flyTo(pos, target, 1600);
  }

  focusPlace(place: Place) {
    this.releaseTrees();
    const c = PLACE_INFO[place];
    const y = place === "항구" ? pierAt(0.3).deck : Math.max(0, groundAt(c.x, c.z));
    const target = new THREE.Vector3(c.x, y + 2.2, c.z);
    // 실제로 걸린 등불들의 가운데를 봐요
    const here = [...this.items.values()].filter((i) => i.place === place);
    if (here.length) {
      target.set(0, 0, 0);
      for (const i of here) target.add(i.lamp);
      target.divideScalar(here.length).add(new THREE.Vector3(0, -0.6, 0));
    }
    // 숲은 나무에 가리지 않게 조금 더 위에서 내려다봐요
    if (place === "무지개") {
      // 무지개마을은 섬 가운데를, 무지개다리가 보이게 조금 비스듬히
      const c2 = new THREE.Vector3(ISLANDS.무지개.x, Math.max(0, groundAt(ISLANDS.무지개.x, ISLANDS.무지개.z)) + 1.5, ISLANDS.무지개.z);
      // 등대 쪽에서 바라보면 무지개다리가 앞에 걸쳐 보여요
      return this.flyTo(c2.clone().add(new THREE.Vector3(-30, 13, 20).multiplyScalar(this.narrow ? 1.25 : 1)), c2);
    }
    if (place === "하늘") {
      // 하늘 등불은 바다 쪽 낮은 곳에서 올려다봐요
      return this.flyTo(target.clone().add(new THREE.Vector3(4, -9, 30).multiplyScalar(this.narrow ? 1.25 : 1)), target);
    }
    if (place === "항구") {
      // 항구는 바다 쪽, 부두 끝 너머에서 마을을 돌아봐요: 앞에는 의자와 드나드는 배, 그 너머로 걸린 등불들
      const at = here.length ? target.clone() : (() => { const q = pierAt(0.3); return new THREE.Vector3(q.x, q.deck + 2, q.z); })();
      const end = pierAt(1), k = this.narrow ? 1.2 : 1;
      const look = at.clone().lerp(new THREE.Vector3(end.x, end.deck, end.z), 0.3);
      const eye = new THREE.Vector3(end.x + 8 * k, end.deck + 9.5 * k, end.z + 16 * k);
      return this.flyTo(eye, look);
    }
    const off = (place === "숲" ? new THREE.Vector3(3, 15, 17) : new THREE.Vector3(5, 8, 22)).multiplyScalar(this.narrow ? 1.3 : 1);
    this.flyTo(target.clone().add(off), target);
  }

  setSelected(id: string | null) {
    const was = this.selected;
    this.selected = id;
    if (id) {
      const it = this.items.get(id);
      if (!it) return;
      // 등불에 다가가요. 곁에 작은 자리(사진, 쪽지, 작은 등)가 함께 보이게 조금 오른쪽을 보고,
      // 아래쪽 시트(화면 아래 절반)에 가리지 않게 등불이 화면 위쪽에 오도록 아래를 봐요.
      const flat = this.camera.position.clone().sub(it.lamp).setY(0).normalize();
      if (!flat.lengthSq()) flat.set(0, 0, 1);
      this.selFlat.copy(flat);
      // 등불과 곁의 작은 자리 사이 가운데를 봐요
      const spot = this.shrineSpot(it, flat).add(new THREE.Vector3(0, 1.5, 0));
      const mid = it.lamp.clone().lerp(spot, 0.5);
      const d = this.narrow ? 15 : 13;
      // 숲은 나무 위에서 조금 더 내려다봐요
      const pos = mid.clone().addScaledVector(flat, d).add(new THREE.Vector3(0, it.place === "숲" ? 8 : 4.6, 0));
      this.treeClear = { eye: pos.clone(), lamp: it.lamp.clone(), spot: spot.clone() };
      this.applyTreeClear();
      // 숲은 등불이 높이 매달려 있어서 위아래로 길어요. 조금 더 아래를 봐서 자리 받침까지 시트 위에 오게
      const target = mid.clone().add(new THREE.Vector3(0, (this.narrow ? -3.3 : -2.9) - (PLACE_INFO[it.place].hang ? 1.1 : 0), 0));
      this.flyTo(pos, target, 1100);
      this.placeShrine();
      this.follow = it.pet ? it.lamp.clone() : null;
    } else if (was) {
      this.follow = null;
      this.setShrine(null);
      // 닫아도 멀리 물러나지 않아요. 그 자리에서 시트가 사라진 만큼 등불을 화면 가운데로 올려 볼 뿐.
      // 가리던 나무는 다른 곳으로 옮겨 갈 때 되돌려요.
      const it = this.items.get(was);
      if (it) this.flyTo(this.camera.position.clone(), it.lamp.clone().add(new THREE.Vector3(0, -0.8, 0)), 700);
    }
  }

  /** 이야기 장면마다 카메라가 천천히 그곳으로 가요 */
  shot(name: Shot) {
    const slow = 2800;
    if (name === "overview") return this.overview();
    if (name === "forest") return this.focusPlace("숲");
    if (name === "hill") return this.focusPlace("언덕");
    if (name === "sky") return this.focusPlace("하늘");
    if (name === "rainbow") return this.focusPlace("무지개");
    if (name === "lighthouse") {
      const top = this.lighthouse.clone().add(new THREE.Vector3(0, 5.5, 0));
      return this.flyTo(top.clone().add(new THREE.Vector3(-12, 1.5, 17).multiplyScalar(this.narrow ? 1.3 : 1)), top, slow);
    }
    if (name === "harbor") {
      const end = pierAt(0.9), near = pierAt(0.25);
      const target = new THREE.Vector3(near.x, near.deck + 1.6, near.z);
      return this.flyTo(new THREE.Vector3(end.x + 6, 3.2, end.z + 9), target, slow);
    }
  }

  /** 등불(또는 아이) 주위를 seconds 동안 천천히 돌면서, 매 장면을 onFrame 으로 넘겨요 */
  recordOrbit(id: string, seconds: number, onFrame: (c: HTMLCanvasElement, k: number) => void) {
    const it = this.items.get(id);
    if (!it) return Promise.resolve();
    this.tween = null;
    this.controls.autoRotate = false;
    const off = this.camera.position.clone().sub(it.lamp);
    return new Promise<void>((resolve) => {
      this.cine = { id, t0: performance.now(), dur: seconds * 1000, a0: Math.atan2(off.z, off.x), onFrame, done: resolve };
    });
  }

  // ---------- 입력 ----------

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.items.values()].map((i) => i.hit), false);
    const id = hits[0]?.object.userData.id as string | undefined;
    if (!id) return;
    const it = this.items.get(id)!;
    if (this.camera.position.distanceTo(it.lamp) > OPEN_NEAR) this.focusPlace(it.place);
    else this.onPick(id);
  };

  private onVisibility = () => {
    this.paused = document.hidden;
    if (!this.paused) this.loop();
  };

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- 매 프레임 ----------

  private loop = () => {
    if (this.paused) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const t = now / 1000;
    const calm = still();

    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur);
      const e = ease(k);
      this.camera.position.lerpVectors(this.tween.from[0], this.tween.to[0], e);
      // 직선이 아니라 살짝 떠올랐다 내려오는 곡선으로 날아가요
      const lift = this.tween.from[0].distanceTo(this.tween.to[0]) * 0.16;
      this.camera.position.y += Math.sin(Math.PI * e) * lift;
      this.controls.target.lerpVectors(this.tween.from[1], this.tween.to[1], e);
      if (k >= 1) this.tween = null;
    }
    // 영상 찍는 중: 카메라를 직접 움직여요 (사람 조작과 자동 둘러보기는 잠시 멈춰요)
    if (this.cine) {
      const c = this.cine, it = this.items.get(c.id);
      const k = Math.min(1, (now - c.t0) / c.dur);
      if (it) {
        const a = c.a0 + k * 1.1;
        const dist = 17 - k * 5, up = 4.2 - k * 1.6;
        this.camera.position.set(it.lamp.x + Math.cos(a) * dist, it.lamp.y + up, it.lamp.z + Math.sin(a) * dist);
        this.controls.target.copy(it.lamp).add(new THREE.Vector3(0, -1.2, 0));
      }
    }
    // 무지개마을 아이를 보는 동안: 아이가 움직인 만큼 카메라도 같이 옮겨요
    if (this.follow && this.selected && !this.cine) {
      const it = this.items.get(this.selected);
      if (it) {
        const d = it.lamp.clone().sub(this.follow);
        this.follow.copy(it.lamp);
        if (this.tween) {
          this.tween.to[0].add(d);
          this.tween.to[1].add(d);
        } else {
          this.camera.position.add(d);
          this.controls.target.add(d);
        }
      }
    }
    // 마을 밖으로 너무 멀리 가지 않게
    const tg = this.controls.target;
    tg.x = THREE.MathUtils.clamp(tg.x, -75, 120);
    tg.z = THREE.MathUtils.clamp(tg.z, -70, 45);
    tg.y = THREE.MathUtils.clamp(tg.y, -2, 14);
    if (!this.cine) this.controls.update();
    else this.camera.lookAt(this.controls.target);

    // 가만히 두면 아주 천천히 둘러봐요
    this.controls.autoRotate = !calm && !this.tween && !this.cine && !this.selected && now - this.lastTouch > 7000;
    if (!calm) {
      this.waterTime.value = t;
      for (const m of this.mist) {
        m.position.x += m.userData.speed * 0.016;
        if (m.position.x > 80) m.position.x = -90;
      }
      (this.stars.material as THREE.PointsMaterial).opacity = (0.75 + 0.15 * Math.sin(t * 0.7)) * this.p.stars;
      (this.beam.children[0] as THREE.Sprite).material.opacity = 0.45 + 0.2 * Math.sin(t * 0.8);
      for (const b of this.bobs) {
        b.o.position.y = b.y + Math.sin(t * 1.1 + b.ph) * 0.07;
        b.o.rotation.z = Math.sin(t * 0.9 + b.ph) * b.roll;
      }
    }
    this.sailFerry(calm ? null : t);
    if (this.shrine) {
      if (this.shrine.floating) this.placeShrine(); // 하늘 등불과 아이들은 움직이니 따라가요
      // 사람이 마을을 돌려 봐도 작은 자리는 늘 이쪽을 바라봐요
      const g = this.shrine.group, cp = this.camera.position;
      const want = Math.atan2(cp.x - g.position.x, cp.z - g.position.z) - 0.12;
      const dy = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y));
      g.rotation.y += dy * (calm ? 1 : 0.12);
      this.shrine.update(now, calm);
    }

    const focus = this.selected;
    for (const it of this.items.values()) {
      if (it.pet) {
        it.pet.update(t, calm);
        it.lamp.copy(it.pet.root.position).setY(it.pet.root.position.y + it.pet.headY * 0.6 * PET_SCALE);
      }
      const here = this.online.has(it.data.user_id); // 지금 접속한 사람의 등불
      const home = it.glowLevel >= 1;
      let flick = 1;
      if (it.pet) {
        // 아이들은 각자 움직여요
      } else if (here && !calm) {
        it.swing.rotation.z = Math.sin(t * 1.4 + it.phase) * 0.09;
        it.swing.rotation.x = Math.sin(t * 1.1 + it.phase * 2) * 0.05;
        flick = 1 + 0.12 * Math.sin(t * 7 + it.phase) + 0.06 * Math.sin(t * 13 + it.phase);
      } else if (!calm) {
        // 접속하지 않은 등불도 바람에 아주 조금 흔들려요
        it.swing.rotation.z = Math.sin(t * 0.8 + it.phase) * 0.03;
        it.swing.rotation.x = Math.sin(t * 0.6 + it.phase * 1.7) * 0.02;
      } else {
        it.swing.rotation.set(0, 0, 0);
      }
      if (!calm && !it.pet) it.body.rotation.y = t * 0.25 + it.phase;
      // 하늘 등불은 바람을 타고 천천히 오르내려요
      if (it.pet) { /* 무지개마을 */ } else if (it.place === "하늘") it.swing.position.y = calm ? 0 : Math.sin(t * 0.35 + it.phase) * 0.35;
      // 하늘로 올라간 등불은 천천히 오르내려요
      else if (it.lift > 0) it.swing.position.y = it.baseY + it.lift + (calm ? 0 : Math.sin(t * 0.6 + it.phase) * 0.25);

      const dim = focus && focus !== it.id ? 0.25 : 1;
      if (it.pet) {
        const d = this.camera.position.distanceTo(it.lamp);
        it.pet.setLook(it.glowLevel, THREE.MathUtils.clamp(1 - (d - 10) / 40, 0, 1), dim);
      } else it.mat.emissiveIntensity = (0.35 + 1.5 * it.glowLevel) * flick * dim * (home ? 1.2 : 1);
      const gm = it.glow.material as THREE.SpriteMaterial;
      gm.opacity = (0.2 + 0.4 * it.glowLevel) * dim * this.p.glow;
      let s = 0.9 + 1.5 * it.glowLevel;

      const p0 = this.pulses.get(it.id);
      let scale = focus === it.id ? 1.3 : 1;
      if (p0 != null) {
        const k = (now - p0) / 1200;
        if (k >= 1) this.pulses.delete(it.id);
        else {
          const bump = Math.sin(Math.PI * k) * 0.5;
          scale += bump;
          s *= 1 + bump;
        }
      }
      if (it.pet) it.pet.root.scale.setScalar(scale * PET_SCALE);
      else it.body.scale.setScalar(scale);
      it.glow.scale.setScalar(it.pet ? s * 0.6 : s);

      if (it.refl) {
        // 물에 비친 불빛은 늘 보는 사람 쪽으로 길게 늘어져요
        const rp = it.refl.position, cp = this.camera.position;
        it.refl.rotation.y = Math.atan2(cp.x - rp.x, cp.z - rp.z);
        const shimmer = calm ? 1 : 0.8 + 0.2 * Math.sin(t * 2.3 + it.phase) * Math.sin(t * 1.7 + it.phase * 3);
        it.refl.scale.set((0.8 + 0.7 * it.glowLevel) * (calm ? 1 : 0.9 + 0.1 * Math.sin(t * 3.1 + it.phase)), 1, 2.6 + 3.4 * it.glowLevel);
        (it.refl.material as THREE.MeshBasicMaterial).opacity = (0.14 + 0.4 * it.glowLevel) * shimmer * dim * this.p.glow * (it.lift > 0 ? 0.35 : 1);
      }
    }

    // 가까운 등불 몇 개에만 진짜 빛을 줘요
    if (this.frame++ % 8 === 0) {
      const near = [...this.items.values()]
        .map((it) => ({ it, d: it.lamp.distanceToSquared(this.controls.target) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, LIGHT_POOL);
      this.lights.forEach((l, i) => {
        const n = near[i];
        if (!n) return void (l.intensity = 0);
        l.position.copy(n.it.lamp);
        l.color.copy(n.it.mat.color);
        l.userData.base = 0.8 + 2.4 * n.it.glowLevel;
        l.userData.id = n.it.id;
      });
    }
    for (const l of this.lights) {
      const it = l.userData.id ? this.items.get(l.userData.id) : undefined;
      l.intensity = it ? (l.userData.base as number) * (focus && focus !== it.id ? 0.3 : 1) * this.p.lampLight : 0;
    }

    this.placeTags();
    this.renderer.render(this.scene, this.camera);
    if (this.cine) {
      // 그린 직후에 옮겨 그려야 화면이 비지 않아요
      const c = this.cine, k = Math.min(1, (now - c.t0) / c.dur);
      c.onFrame(this.renderer.domElement, k);
      if (k >= 1) {
        this.cine = null;
        c.done();
      }
    }
  };

  private v = new THREE.Vector3();
  private placeTags() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    for (const it of this.items.values()) {
      const d = this.camera.position.distanceTo(it.lamp);
      let o = d < LABEL_NEAR ? 1 : d > LABEL_FAR ? 0 : 1 - (d - LABEL_NEAR) / (LABEL_FAR - LABEL_NEAR);
      if (this.selected && this.selected !== it.id) o *= 0.3;
      this.v.copy(it.lamp).setY(it.lamp.y + 0.75 * LAMP_SCALE).project(this.camera);
      if (this.v.z > 1 || o <= 0.01) {
        it.tag.style.opacity = "0";
        continue;
      }
      const x = (this.v.x * 0.5 + 0.5) * w, y = (-this.v.y * 0.5 + 0.5) * h;
      it.tag.style.opacity = o.toFixed(2);
      it.tag.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.shrine?.dispose();
    this.paused = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ro.disconnect();
    this.controls.dispose();
    for (const it of [...this.items.values()]) this.remove(it);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
