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
