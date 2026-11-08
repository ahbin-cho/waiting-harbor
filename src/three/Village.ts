import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Lantern } from "../lib/supabase";
import { COLORS, colorOf, shapeOf, type LampShape } from "../lib/looks";
import { ISLANDS, PIER, PLACE_INFO, fbm, groundAt, jitter, pierAt, placeOf, slotOf, type Place } from "../lib/places";
import { daysLeft, ddayText, progressOf } from "../lib/waiting";
import type { Shot } from "../lib/story";

// 장면 색. styles.css 의 :root 토큰과 같은 값이에요.
const C = {
  skyTop: 0x05081a, skyLow: 0x2b2446, fog: 0x17142e,
  sea: 0x080f2a, land: 0x141833, landHigh: 0x252848, shore: 0x2a2440, landFar: 0x1c1a42, tree: 0x0b132d, tree2: 0x16203f, mist: 0x8a85b8,
  pier: 0x1c1726, tower: 0x1d2140, moon: 0xf4e6c6,
};

const LIGHT_POOL = 6;   // 진짜 빛을 내는 등불 수 (가까운 순)
const LABEL_NEAR = 38;  // 이 거리 안에서 이름이 또렷해요
const LABEL_FAR = 52;   // 이 거리 밖에서는 이름이 사라져요
const LAMP_SCALE = 1.7; // 마을 크기에 맞춘 등불 크기
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

const GEO: Record<LampShape, THREE.BufferGeometry> = {
  둥근: new THREE.SphereGeometry(0.32, 14, 10).scale(1, 1.25, 1),
  네모: new THREE.CylinderGeometry(0.3, 0.3, 0.62, 4, 1).rotateY(Math.PI / 4),
  별: starGeometry(),
};
const CAP = new THREE.CylinderGeometry(0.14, 0.18, 0.08, 10);
const POLE = new THREE.CylinderGeometry(0.035, 0.045, 1, 6).translate(0, 0.5, 0);
const CORD = new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, 0.5, 0);
const HIT = new THREE.SphereGeometry(0.9, 8, 6);

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
  private down: { x: number; y: number; t: number } | null = null;
  private ro: ResizeObserver;
  private paused = false;
  private waterTime = { value: 0 };
  private mist: THREE.Sprite[] = [];
  private lighthouse = new THREE.Vector3();
  private lastTouch = performance.now();

  constructor(
    private host: HTMLElement,
    private tags: HTMLElement,
    private onPick: (id: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    host.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(C.fog, 0.0038);
    this.buildSky();
    this.buildLand();

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
        uniforms: { top: { value: new THREE.Color(C.skyTop) }, low: { value: new THREE.Color(C.skyLow) } },
        vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
        fragmentShader: "uniform vec3 top; uniform vec3 low; varying float h; void main(){ gl_FragColor = vec4(mix(low, top, smoothstep(-.02, .45, h)), 1.); }",
      }),
    );
    this.scene.add(sky);

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
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff4de, size: 1.5 * Math.min(2, window.devicePixelRatio || 1), sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    this.scene.add(this.stars);

    // 달
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), fog: false, transparent: true }));
    moon.position.set(-70, 130, -420);
    moon.scale.setScalar(46);
    this.scene.add(moon);

    this.scene.add(new THREE.HemisphereLight(0x5a60a8, 0x080a18, 1.3));
    const moonLight = new THREE.DirectionalLight(0xbfc6ff, 0.7);
    moonLight.position.set(-70, 130, -420).normalize().multiplyScalar(100);
    this.scene.add(moonLight);
  }

  private buildLand() {
    const landMat = new THREE.MeshStandardMaterial({ color: C.land, roughness: 1 });

    // 바다: 천천히 일렁이는 물결 (셰이더에서 높이와 기울기를 함께 바꿔요)
    const waterMat = new THREE.MeshStandardMaterial({ color: C.sea, roughness: 0.78, metalness: 0.05 });
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
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.sea, roughness: 0.6, metalness: 0.1 }));
    ocean.position.y = -0.7;
    this.scene.add(water, ocean);

    // 땅: 섬 세 개를 하나의 높이 지도로. 해안선이 들쭉날쭉하고 작은 언덕들이 있어요.
    const W = 150, D = 90;
    const geo = new THREE.PlaneGeometry(W, D, 200, 120).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const base = new THREE.Color(C.land), high = new THREE.Color(C.landHigh), shore = new THREE.Color(C.shore);
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
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    // 먼 산: 둥글게 눌린 언덕들
    const farMat = new THREE.MeshStandardMaterial({ color: C.landFar, roughness: 1 });
    const rand = rng(11);
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), farMat);
      m.scale.set(30 + rand() * 50, 14 + rand() * 30, 20 + rand() * 30);
      m.position.set(-300 + i * 36 + rand() * 24, -6, -200 - rand() * 90);
      m.rotation.y = rand() * 3;
      this.scene.add(m);
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
    const cA = new THREE.Color(C.tree), cB = new THREE.Color(C.tree2);
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
    this.scene.add(trunk, ...meshes);

    // 부두: 휘어진 길을 따라 널빤지를 하나씩. 높이와 기울기가 조금씩 달라요.
    const prand = rng(5);
    const plankN = Math.round(PIER.len / 0.55);
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(PIER.w, 0.1, 0.48), new THREE.MeshStandardMaterial({ color: C.pier, roughness: 0.95 }), plankN);
    for (let i = 0; i < plankN; i++) {
      const at = pierAt(i / plankN);
      e.set((prand() - 0.5) * 0.05, at.yaw + (prand() - 0.5) * 0.05, (prand() - 0.5) * 0.06);
      planks.setMatrixAt(i, m4.compose(p.set(at.x, at.deck - 0.05 + (prand() - 0.5) * 0.04, at.z), q.setFromEuler(e), sc.set(1 - prand() * 0.08, 1, 1)));
    }
    const postN = Math.round(PIER.len / 3) * 2;
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.14, 1, 6).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ color: C.pier, roughness: 1 }), postN);
    for (let i = 0; i < postN; i++) {
      const at = pierAt(Math.floor(i / 2) / (postN / 2) + 0.02);
      const side = (i % 2 ? 1 : -1) * (PIER.w / 2 - 0.05);
      e.set((prand() - 0.5) * 0.14, 0, (prand() - 0.5) * 0.14);
      posts.setMatrixAt(i, m4.compose(p.set(at.x + Math.cos(at.yaw) * side, at.deck + 0.25 + prand() * 0.2, at.z - Math.sin(at.yaw) * side), q.setFromEuler(e), sc.set(1, 2.6, 1)));
    }
    this.scene.add(planks, posts);

    // 작은 배
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.8, 0.5, 2), landMat);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3, 5).translate(0, 1.5, 0), landMat);
    mast.rotation.z = 0.06;
    boat.add(hull, mast);
    const end = pierAt(0.85);
    boat.position.set(end.x + 4.2, 0.1, end.z);
    boat.rotation.y = 0.4;
    this.boat = boat;
    this.scene.add(boat);

    // 등대: 섬에서 가장 높은 곳에, 아주 조금 기울어서
    let best: { x: number; z: number; y: number } = { x: ISLANDS.등대.x, z: ISLANDS.등대.z, y: -9 };
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      const x = ISLANDS.등대.x + dx, z = ISLANDS.등대.z + dz, y = groundAt(x, z);
      if (y > best.y) best = { x, z, y };
    }
    this.lighthouse.set(best.x, best.y, best.z);
    const towerMat = new THREE.MeshStandardMaterial({ color: C.tower, roughness: 0.85 });
    const lh = new THREE.Group();
    lh.position.set(best.x, best.y - 0.3, best.z);
    lh.rotation.set(0.02, 0, -0.025);
    lh.add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.3, 7.5, 16).translate(0, 3.75, 0), towerMat),
      new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.13, 0.8, 16).translate(0, 3, 0), landMat),
      new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 12).translate(0, 7.95, 0), new THREE.MeshBasicMaterial({ color: C.moon })),
      new THREE.Mesh(new THREE.ConeGeometry(0.95, 1, 12).translate(0, 8.9, 0), towerMat),
    );
    this.scene.add(lh);
    const pivot = new THREE.Group();
    pivot.position.set(best.x, best.y + 7.6, best.z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: C.moon, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(5);
    pivot.add(halo);
    this.beam = pivot;
    this.scene.add(pivot);

    // 물 위를 흘러가는 옅은 안개
    const mrand = rng(23);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: C.mist, transparent: true, opacity: 0.025 + mrand() * 0.025, depthWrite: false }));
      s.scale.set(40 + mrand() * 30, 6 + mrand() * 4, 1);
      s.position.set(-70 + mrand() * 130, 1.5 + mrand() * 2, -20 + mrand() * 40);
      s.userData.speed = 0.4 + mrand() * 0.5;
      this.mist.push(s);
      this.scene.add(s);
    }
  }

  // ---------- 등불 ----------

  setData(lanterns: Lantern[], me: string | null, online: Set<string>) {
    this.me = me;
    this.online = online;
    const seen = new Set<string>();
    const count = new Map<Place, number>();
    for (const l of [...lanterns].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const place = placeOf(l.place);
      const i = count.get(place) ?? 0;
      count.set(place, i + 1);
      seen.add(l.user_id);
      this.upsert(l, place, i);
    }
    for (const [id, it] of this.items) if (!seen.has(id)) this.remove(it);
  }

  private upsert(l: Lantern, place: Place, i: number) {
    const look = `${colorOf(l.color)}/${shapeOf(l.shape)}/${place}`;
    let it = this.items.get(l.user_id);
    if (it && it.look !== look) {
      this.remove(it);
      it = undefined;
    }
    if (!it) it = this.create(l, place, look);
    it.data = l;

    // 자리
    const [x, z] = slotOf(place, i);
    const info = PLACE_INFO[place];
    const pierU = (0.1 + i * 0.05);
    const ground = place === "항구" ? pierAt(pierU).deck : Math.max(0.2, groundAt(x, z));
    it.idx = i;
    it.group.position.set(x, ground, z);
    // 기둥은 조금씩 기울고, 높이도 조금씩 달라요
    it.group.rotation.set(jitter(i + place.length * 31, 4) * 0.07, 0, jitter(i + place.length * 31, 5) * 0.07);
    it.baseY = (info.hang ? 2.6 : 1.45) + jitter(i + place.length * 31, 6) * (info.hang ? 0.5 : 0.15);

    // 밝기: 돌아올 날이 가까울수록. 그날이 지나면 기둥을 떠나 하늘로 올라가요.
    const n = daysLeft(l);
    it.glowLevel = n != null && n <= 0 ? 1 : 0.3 + 0.7 * progressOf(l);
    it.lift = n != null && n < 0 ? Math.min(6, 1.5 + -n * 0.8) : 0;
    it.swing.position.y = it.baseY + it.lift;
    it.lamp.set(x, ground + it.swing.position.y * LAMP_SCALE, z);

    // 이름표
    it.tag.className = `tag${l.user_id === this.me ? " mine" : ""}`;
    it.tag.replaceChildren();
    const b = document.createElement("b");
    b.textContent = l.who;
    const s = document.createElement("span");
    s.textContent = ddayText(n);
    it.tag.append(b, s);
  }

  private create(l: Lantern, place: Place, look: string): Item {
    const color = new THREE.Color(COLORS[colorOf(l.color)]);
    const shape = shapeOf(l.shape);
    const hang = PLACE_INFO[place].hang;
    const group = new THREE.Group();
    group.scale.setScalar(LAMP_SCALE);
    const swing = new THREE.Group();
    group.add(swing);

    if (hang) {
      const cord = new THREE.Mesh(CORD, new THREE.MeshBasicMaterial({ color: 0x8a8070 }));
      cord.scale.y = 1.4;
      cord.position.y = 0.35;
      swing.add(cord);
    } else {
      // 기둥은 땅에서 등 아래까지 (등 가운데 높이 1.45)
      const pole = new THREE.Mesh(POLE, new THREE.MeshStandardMaterial({ color: C.pier, roughness: 1 }));
      pole.scale.y = 1.05;
      group.add(pole);
    }

    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1, roughness: 0.6 });
    const body = new THREE.Mesh(GEO[shape], mat);
    swing.add(body);
    if (shape !== "별") {
      const capMat = new THREE.MeshStandardMaterial({ color: 0x241712, roughness: 1 });
      const top = new THREE.Mesh(CAP, capMat);
      top.position.y = 0.38;
      const bottom = new THREE.Mesh(CAP, capMat);
      bottom.position.y = -0.38;
      swing.add(top, bottom);
    }

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    swing.add(glow);

    const hit = new THREE.Mesh(HIT, new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.id = l.user_id;
    swing.add(hit);

    this.scene.add(group);
    const tag = document.createElement("div");
    this.tags.appendChild(tag);

    const it: Item = {
      id: l.user_id, data: l, place, group, swing, body, mat, glow, hit,
      lamp: new THREE.Vector3(), tag, glowLevel: 0.5, phase: Math.random() * 10, idx: 0, baseY: 1.45, lift: 0, look,
    };
    this.items.set(l.user_id, it);
    return it;
  }

  private remove(it: Item) {
    this.scene.remove(it.group);
    it.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      m?.dispose();
    });
    it.tag.remove();
    this.items.delete(it.id);
  }

  pulse(id: string) {
    this.pulses.set(id, performance.now());
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
  overview(instant = false) {
    const target = new THREE.Vector3(-2, 0, -10);
    const dir = new THREE.Vector3(0.22, 0.52, 0.83).normalize();
    const pos = target.clone().addScaledVector(dir, this.narrow ? 185 : 100);
    if (instant) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
    } else this.flyTo(pos, target, 1600);
  }

  focusPlace(place: Place) {
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
    const off = (place === "숲" ? new THREE.Vector3(3, 15, 17) : place === "항구" ? new THREE.Vector3(12, 8, 18) : new THREE.Vector3(5, 8, 22)).multiplyScalar(this.narrow ? 1.3 : 1);
    this.flyTo(target.clone().add(off), target);
  }

  setSelected(id: string | null) {
    const was = this.selected;
    this.selected = id;
    if (id) {
      const it = this.items.get(id);
      if (!it) return;
      // 등불에 바짝 다가가요. 아래쪽 시트에 가리지 않게 등불이 화면 위쪽에 오도록 조금 아래를 봐요.
      const flat = this.camera.position.clone().sub(it.lamp).setY(0).normalize();
      if (!flat.lengthSq()) flat.set(0, 0, 1);
      const pos = it.lamp.clone().addScaledVector(flat, 20).add(new THREE.Vector3(0, 3.5, 0));
      const target = it.lamp.clone().add(new THREE.Vector3(0, -3.2, 0));
      this.flyTo(pos, target, 1100);
    } else if (was) {
      const it = this.items.get(was);
      if (it) this.focusPlace(it.place);
    }
  }

  /** 이야기 장면마다 카메라가 천천히 그곳으로 가요 */
  shot(name: Shot) {
    const slow = 2800;
    if (name === "overview") return this.overview();
    if (name === "forest") return this.focusPlace("숲");
    if (name === "hill") return this.focusPlace("언덕");
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
    // 마을 밖으로 너무 멀리 가지 않게
    const tg = this.controls.target;
    tg.x = THREE.MathUtils.clamp(tg.x, -75, 65);
    tg.z = THREE.MathUtils.clamp(tg.z, -45, 45);
    tg.y = THREE.MathUtils.clamp(tg.y, -2, 14);
    this.controls.update();

    // 가만히 두면 아주 천천히 둘러봐요
    this.controls.autoRotate = !calm && !this.tween && !this.selected && now - this.lastTouch > 7000;
    if (!calm) {
      this.waterTime.value = t;
      for (const m of this.mist) {
        m.position.x += m.userData.speed * 0.016;
        if (m.position.x > 80) m.position.x = -90;
      }
      (this.stars.material as THREE.PointsMaterial).opacity = 0.75 + 0.15 * Math.sin(t * 0.7);
      (this.beam.children[0] as THREE.Sprite).material.opacity = 0.45 + 0.2 * Math.sin(t * 0.8);
      this.boat.position.y = 0.15 + Math.sin(t * 1.1) * 0.06;
      this.boat.rotation.z = Math.sin(t * 0.9) * 0.04;
    }

    const focus = this.selected;
    for (const it of this.items.values()) {
      const here = this.online.has(it.id);
      const home = it.glowLevel >= 1;
      let flick = 1;
      if (here && !calm) {
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
      if (!calm) it.body.rotation.y = t * 0.25 + it.phase;
      // 하늘로 올라간 등불은 천천히 오르내려요
      if (it.lift > 0) it.swing.position.y = it.baseY + it.lift + (calm ? 0 : Math.sin(t * 0.6 + it.phase) * 0.25);

      const dim = focus && focus !== it.id ? 0.25 : 1;
      it.mat.emissiveIntensity = (0.35 + 1.5 * it.glowLevel) * flick * dim * (home ? 1.2 : 1);
      const gm = it.glow.material as THREE.SpriteMaterial;
      gm.opacity = (0.2 + 0.4 * it.glowLevel) * dim;
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
      it.body.scale.setScalar(scale);
      it.glow.scale.setScalar(s);
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
      l.intensity = it ? (l.userData.base as number) * (focus && focus !== it.id ? 0.3 : 1) : 0;
    }

    this.placeTags();
    this.renderer.render(this.scene, this.camera);
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
    this.paused = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.ro.disconnect();
    this.controls.dispose();
    for (const it of [...this.items.values()]) this.remove(it);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
