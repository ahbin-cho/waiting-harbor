// 놓고 간 것들의 작은 모형: 국화, 들꽃, 간식, 공, 종이배, 조약돌.
// 등불 발치와 곁의 작은 자리에 흐트러지게 놓여요. 빛은 내지 않아요 (빛은 등불만).
import * as THREE from "three";
import type { Palette } from "../lib/theme";
import type { OfferingKind } from "../lib/offerings";

const GEO = {
  stem: new THREE.CylinderGeometry(0.012, 0.016, 0.22, 4).translate(0, 0.11, 0),
  bloom: new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.7, 1),
  petal: new THREE.SphereGeometry(0.045, 6, 5),
  bowl: new THREE.CylinderGeometry(0.09, 0.065, 0.06, 10).translate(0, 0.03, 0),
  bite: new THREE.SphereGeometry(0.035, 6, 5),
  ball: new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0.075, 0),
  hull: new THREE.ConeGeometry(0.11, 0.1, 4).rotateX(Math.PI).rotateY(Math.PI / 4).scale(1.6, 1, 0.7).translate(0, 0.05, 0),
  sail: new THREE.ConeGeometry(0.06, 0.12, 3).translate(0, 0.16, 0),
  pebble: new THREE.SphereGeometry(0.07, 10, 7).scale(1.2, 0.5, 0.9).translate(0, 0.03, 0),
  // 꽃다발 포장지: 아래가 좁은 고깔
  wrap: new THREE.ConeGeometry(0.075, 0.2, 10, 1, true).rotateX(Math.PI).translate(0, 0.1, 0),
  ribbon: new THREE.TorusGeometry(0.035, 0.012, 6, 12),
  // 간식 봉지: 위가 오므라진 말랑한 주머니
  pouch: new THREE.SphereGeometry(0.075, 12, 10).scale(0.95, 1.15, 0.7).translate(0, 0.08, 0),
  tie: new THREE.ConeGeometry(0.035, 0.05, 8).translate(0, 0.18, 0),
  stripe: new THREE.TorusGeometry(0.076, 0.012, 6, 20).rotateX(Math.PI / 2).translate(0, 0.075, 0),
};

const BOX = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

const mats = new WeakMap<Palette, Record<string, THREE.Material>>();
function matsOf(p: Palette) {
  let m = mats.get(p);
  if (!m) {
    const std = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });
    m = {
      stem: std(p.tree2),
      white: std(p.beacon, 0.8),
      field: std(p.shrine),
      bowl: std(p.pier),
      food: std(p.shrine),
      ball: std(p.band, 0.7),
      wrap: new THREE.MeshStandardMaterial({ color: p.beacon, roughness: 0.9, side: THREE.DoubleSide }),
      paper: std(p.beacon, 0.95),
      stone: std(p.landHigh, 1),
    };
    mats.set(p, m);
  }
  return m;
}

/** 놓인 것 하나. 크기는 등불 기둥 옆에 둘 만큼 작아요. */
export function makeOffering(kind: OfferingKind, p: Palette, seed: number): THREE.Object3D {
  const m = matsOf(p);
  const g = new THREE.Group();
  const r = (k: number) => Math.abs(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1;
  if (kind === "국화" || kind === "들꽃") {
    // 포장지에 싼 꽃다발을 비스듬히 눕혀 놓아요
    const bunch = new THREE.Group();
    bunch.add(new THREE.Mesh(GEO.wrap, m.wrap));
    const n = kind === "국화" ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r(i);
      const head = new THREE.Mesh(kind === "국화" ? GEO.bloom : GEO.petal, kind === "국화" ? m.white : i % 2 ? m.white : m.field);
      head.position.set(Math.cos(a) * 0.045, 0.22 + r(i + 2) * 0.03, Math.sin(a) * 0.045);
      head.scale.setScalar(kind === "국화" ? 0.75 : 0.9);
      bunch.add(head);
    }
    const bow = new THREE.Mesh(GEO.ribbon, m.field);
    bow.position.set(0, 0.07, 0.07);
    bunch.add(bow);
    bunch.rotation.set(Math.PI / 2 - 0.35, 0, (r(4) - 0.5) * 0.3);
    bunch.position.y = 0.06;
    g.add(bunch);
  } else if (kind === "간식") {
    // 간식 봉지 하나와 작은 그릇
    const pouch = new THREE.Group();
    pouch.add(new THREE.Mesh(GEO.pouch, m.food), new THREE.Mesh(GEO.tie, m.food));
    pouch.position.set(0.05, 0, 0);
    pouch.rotation.z = (r(2) - 0.5) * 0.3;
    g.add(pouch);
    const bowl = new THREE.Group();
    bowl.add(new THREE.Mesh(GEO.bowl, m.bowl));
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(GEO.bite, m.food);
      b.position.set((r(i) - 0.5) * 0.06, 0.065, (r(i + 5) - 0.5) * 0.06);
      bowl.add(b);
    }
    bowl.position.set(-0.11, 0, 0.06);
    bowl.scale.setScalar(0.8);
    g.add(bowl);
  } else if (kind === "공") {
    // 줄무늬 하나 두른 공
    g.add(new THREE.Mesh(GEO.ball, m.white), new THREE.Mesh(GEO.stripe, m.ball));
  } else if (kind === "종이배") {
    g.add(new THREE.Mesh(GEO.hull, m.paper), new THREE.Mesh(GEO.sail, m.paper));
  } else if (kind === "편지") {
    // 봉투: 납작한 종이와 덮개 삼각형
    const env = new THREE.Mesh(BOX(0.2, 0.012, 0.14), m.paper);
    env.position.y = 0.008;
    const flap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.07, 3).rotateX(-Math.PI / 2).scale(1, 1, 0.12).translate(0, 0.016, -0.02), m.food);
    g.add(env, flap);
  } else if (kind === "위문상자" || kind === "도시락") {
    // 상자와 리본 (도시락은 낮고 둥근 뚜껑)
    const lunch = kind === "도시락";
    const box = new THREE.Mesh(BOX(0.16, lunch ? 0.07 : 0.12, 0.12), lunch ? m.bowl : m.food);
    box.position.y = lunch ? 0.035 : 0.06;
    const r1 = new THREE.Mesh(BOX(0.165, lunch ? 0.075 : 0.125, 0.02), m.field);
    r1.position.copy(box.position);
    const r2 = new THREE.Mesh(BOX(0.02, lunch ? 0.075 : 0.125, 0.125), m.field);
    r2.position.copy(box.position);
    g.add(box, r1, r2);
  } else if (kind === "핫팩") {
    const pack = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6).scale(1, 0.22, 1.3).translate(0, 0.02, 0), m.paper);
    g.add(pack);
  } else if (kind === "종이비행기") {
    const v = new Float32Array([0, 0.03, 0.11, -0.08, 0.035, -0.07, 0, 0.03, -0.07, 0, 0.03, 0.11, 0, 0.03, -0.07, 0.08, 0.035, -0.07, 0, 0.03, 0.11, 0, 0.03, -0.07, 0, 0.0, -0.06]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, m.wrap));
  } else if (kind === "풍선") {
    // 실에 묶여 둥실 떠 있는 풍선 (빛은 내지 않아요)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10).scale(1, 1.2, 1).translate(0, 0.42, 0), m.ball);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.34, 4).translate(0, 0.17, 0), m.stem);
    g.add(ball, string);
  } else if (kind === "찻잔") {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 12).translate(0, 0.035, 0), m.white);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 10).translate(0.055, 0.04, 0), m.white);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.008, 14), m.white);
    g.add(cup, handle, plate);
  } else if (kind === "츄르") {
    [0, 1].forEach((k) => {
      const st = new THREE.Mesh(BOX(0.025, 0.012, 0.16), m.food);
      st.position.set(k * 0.035, 0.006, (r(k) - 0.5) * 0.03);
      st.rotation.y = (r(k + 2) - 0.5) * 0.4;
      g.add(st);
    });
  } else if (kind === "상자") {
    // 고양이가 좋아하는 빈 상자: 위가 열린 상자
    const sides = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.13).translate(0, 0.05, 0), m.bowl);
    const inside = new THREE.Mesh(BOX(0.15, 0.002, 0.11), m.food);
    inside.position.y = 0.101;
    g.add(sides, inside);
  } else if (kind === "해바라기씨" || kind === "먹이") {
    for (let k = 0; k < 9; k++) {
      const seed = new THREE.Mesh(GEO.bite, kind === "먹이" ? m.food : m.stone);
      seed.scale.set(0.45, 0.3, kind === "먹이" ? 0.45 : 0.7);
      seed.position.set((r(k) - 0.5) * 0.08, 0.01 + (k > 5 ? 0.012 : 0), (r(k + 9) - 0.5) * 0.08);
      g.add(seed);
    }
  } else if (kind === "방울") {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8).translate(0, 0.035, 0), m.food);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 10).translate(0, 0.075, 0), m.food);
    g.add(bell, ring);
  } else if (kind === "당근") {
    const root = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 8).rotateZ(Math.PI / 2).translate(0, 0.025, 0), m.food);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 5).rotateZ(-Math.PI / 2).translate(-0.1, 0.03, 0), m.stem);
    g.add(root, top);
  } else if (kind === "상추") {
    for (let k = 0; k < 3; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6).scale(1, 0.18, 1.3).translate(0, 0.01 + k * 0.008, 0), m.stem);
      leaf.rotation.y = k * 1.1;
      g.add(leaf);
    }
  } else if (kind === "뼈다귀") {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 8).rotateZ(Math.PI / 2).translate(0, 0.02, 0), m.white);
    g.add(shaft);
    for (const [x, z] of [[-0.07, -0.015], [-0.07, 0.015], [0.07, -0.015], [0.07, 0.015]]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), m.white);
      knob.position.set(x, 0.02, z);
      g.add(knob);
    }
  } else {
    // 조약돌 셋을 작게 쌓아 올려요
    [0, 1, 2].forEach((k) => {
      const st = new THREE.Mesh(GEO.pebble, m.stone);
      st.position.set((r(k) - 0.5) * 0.02, k * 0.045, 0);
      st.scale.setScalar(1 - k * 0.25);
      st.rotation.y = r(k + 7) * 3;
      g.add(st);
    });
  }
  g.rotation.y = r(9) * Math.PI * 2;
  return g;
}

/** 놓인 것들을 max 개까지, 많은 종류가 더 많이, 같은 것끼리 몰리지 않게 번갈아 늘어놓을 목록으로 */
export function spread(counts: Partial<Record<OfferingKind, number>>, max: number): OfferingKind[] {
  const entries = (Object.entries(counts) as [OfferingKind, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  if (!total) return [];
  const want = Math.min(max, total);
  const quota = entries.map(([k, n]) => ({ k, left: Math.max(1, Math.round((n / total) * want)) }));
  const out: OfferingKind[] = [];
  while (out.length < want && quota.some((q) => q.left > 0)) {
    for (const q of quota) if (q.left > 0 && out.length < want) (out.push(q.k), q.left--);
  }
  return out;
}
