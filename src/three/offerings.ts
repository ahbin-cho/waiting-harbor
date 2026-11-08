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
  pebble: new THREE.SphereGeometry(0.07, 7, 5).scale(1.2, 0.5, 0.9).translate(0, 0.03, 0),
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
    // 꽃 몇 송이를 눕혀 놓은 다발
    const n = kind === "국화" ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Group();
      s.add(new THREE.Mesh(GEO.stem, m.stem));
      const head = new THREE.Mesh(kind === "국화" ? GEO.bloom : GEO.petal, kind === "국화" ? m.white : i === 1 ? m.white : m.field);
      head.position.y = 0.23;
      s.add(head);
      s.rotation.set(Math.PI / 2 - 0.25, (r(i) - 0.5) * 0.8, (r(i + 3) - 0.5) * 0.4);
      s.position.set((i - (n - 1) / 2) * 0.05, 0.02, 0);
      g.add(s);
    }
  } else if (kind === "간식") {
    g.add(new THREE.Mesh(GEO.bowl, m.bowl));
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(GEO.bite, m.food);
      b.position.set((r(i) - 0.5) * 0.07, 0.065, (r(i + 5) - 0.5) * 0.07);
      g.add(b);
    }
  } else if (kind === "공") {
    g.add(new THREE.Mesh(GEO.ball, m.ball));
  } else if (kind === "종이배") {
    g.add(new THREE.Mesh(GEO.hull, m.paper), new THREE.Mesh(GEO.sail, m.paper));
  } else {
    g.add(new THREE.Mesh(GEO.pebble, m.stone));
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
