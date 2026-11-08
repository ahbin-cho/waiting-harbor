import * as THREE from "three";
import { RAINBOW, groundAt, jitter } from "../lib/places";
import type { Species } from "../lib/pets";

/**
 * 무지개마을의 아이들. 종류마다 작은 모형과 자기다운 움직임이 있어요.
 * root 는 월드 좌표에서 움직이고, head 는 이름표와 카메라가 바라보는 높이예요.
 */
export type PetRig = {
  root: THREE.Group;
  body: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  headY: number;
  update(t: number, calm: boolean): void;
};

const SPHERE = new THREE.SphereGeometry(1, 14, 10);
const CONE = new THREE.ConeGeometry(1, 1, 8);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);

function part(geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

const ground = (x: number, z: number) => Math.max(0.1, groundAt(x, z));

/** 아이 하나 만들기. i 는 같은 종류 안에서 몇 번째인지 (자리를 나누는 데 써요) */
export function makePet(species: Species, color: THREE.Color, i: number, phase: number): PetRig {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.45), roughness: 0.9 });
  const eye = new THREE.MeshBasicMaterial({ color: 0x1a1414 });
  const root = new THREE.Group();
  const j = (salt: number) => jitter(i + species.length * 13, salt);

  switch (species) {
    case "강아지": {
      // 풀밭을 둥글게 뛰다가 가끔 멈춰서 꼬리를 흔들어요
      const body = part(SPHERE, mat, 0.42, 0.28, 0.26, 0, 0.42, 0);
      const head = part(SPHERE, mat, 0.22, 0.2, 0.2, 0.42, 0.62, 0);
      const earL = part(CONE, dark, 0.07, 0.16, 0.05, 0.4, 0.82, 0.12);
      const earR = part(CONE, dark, 0.07, 0.16, 0.05, 0.4, 0.82, -0.12);
      const nose = part(SPHERE, eye, 0.04, 0.04, 0.04, 0.63, 0.62, 0);
      const tail = new THREE.Group();
      tail.position.set(-0.4, 0.5, 0);
      tail.add(part(CYL, mat, 0.04, 0.26, 0.04, 0, 0.13, 0));
      tail.rotation.z = 0.7;
      const legs = [0.22, -0.22].flatMap((x) => [0.13, -0.13].map((z) => part(CYL, mat, 0.05, 0.28, 0.05, x, 0.16, z)));
      root.add(body, head, earL, earR, nose, tail, ...legs);
      const [cx, cz] = RAINBOW.meadow;
      const r = 2.2 + j(1) * 1.2 + (i % 3) * 1.4;
      return {
        root, body, mat, headY: 1.1,
        update(t, calm) {
          const cyc = ((t * 0.12 + phase) % 1 + 1) % 1;
          const running = cyc < 0.72;
          const a = phase * 6 + (running ? cyc / 0.72 : 1) * Math.PI * 2 * 0.9 + Math.floor(t * 0.12 + phase) * 1.3;
          const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
          const bounce = running && !calm ? Math.abs(Math.sin(t * 9 + phase)) * 0.12 : 0;
          root.position.set(x, ground(x, z) + bounce, z);
          root.rotation.y = -a - Math.PI / 2 + (running ? 0 : Math.PI / 2);
          tail.rotation.x = calm ? 0 : Math.sin(t * (running ? 10 : 18)) * 0.6;
          legs.forEach((l, k) => (l.rotation.z = running && !calm ? Math.sin(t * 12 + k * Math.PI) * 0.5 : 0));
        },
      };
    }

    case "고양이": {
      // 지붕 위에서 웅크리고 졸아요. 숨 쉴 때 몸이 살짝 부풀고, 꼬리가 천천히 움직여요
      const body = part(SPHERE, mat, 0.34, 0.2, 0.24, 0, 0.2, 0);
      const head = part(SPHERE, mat, 0.17, 0.15, 0.16, 0.3, 0.3, 0);
      const earL = part(CONE, mat, 0.06, 0.12, 0.05, 0.3, 0.46, 0.08);
      const earR = part(CONE, mat, 0.06, 0.12, 0.05, 0.3, 0.46, -0.08);
      const tail = new THREE.Group();
      tail.position.set(-0.32, 0.12, 0);
      tail.add(part(CYL, mat, 0.035, 0.36, 0.035, 0, 0.18, 0));
      tail.rotation.set(0, 0, -1.2);
      root.add(body, head, earL, earR, tail);
      const [hx, hz] = RAINBOW.cottages[i % RAINBOW.cottages.length];
      const along = (Math.floor(i / RAINBOW.cottages.length) % 3 - 1) * 0.8 + j(2) * 0.2;
      const y = ground(hx, hz) + 2.55; // 지붕 꼭대기
      root.position.set(hx + along, y, hz);
      root.rotation.y = j(3) * 0.8;
      return {
        root, body, mat, headY: 0.7,
        update(t, calm) {
          if (calm) return;
          body.scale.y = 0.2 * (1 + Math.sin(t * 1.4 + phase) * 0.05);
          tail.rotation.y = Math.sin(t * 0.7 + phase) * 0.6;
          head.rotation.y = Math.sin(t * 0.15 + phase) * 0.5;
        },
      };
    }

    case "새": {
      // 나무 꼭대기에 앉아 있다가 가끔 한 바퀴 날아요
      const body = part(SPHERE, mat, 0.16, 0.14, 0.12, 0, 0, 0);
      const head = part(SPHERE, mat, 0.1, 0.1, 0.1, 0.13, 0.1, 0);
      const beak = part(CONE, dark, 0.03, 0.08, 0.03, 0.24, 0.1, 0);
      beak.rotation.z = -Math.PI / 2;
      const wingL = new THREE.Group(), wingR = new THREE.Group();
      wingL.add(part(SPHERE, mat, 0.12, 0.02, 0.16, 0, 0, 0.12));
      wingR.add(part(SPHERE, mat, 0.12, 0.02, 0.16, 0, 0, -0.12));
      root.add(body, head, beak, wingL, wingR);
      const [tx, tz] = RAINBOW.birdTrees[i % RAINBOW.birdTrees.length];
      const perch = new THREE.Vector3(tx + j(4) * 0.4, ground(tx, tz) + 4.4, tz + j(5) * 0.4);
      return {
        root, body, mat, headY: 0.45,
        update(t, calm) {
          const cyc = ((t + phase * 20) % 16 + 16) % 16;
          if (!calm && cyc < 3.2) {
            const k = cyc / 3.2, a = k * Math.PI * 2;
            root.position.set(perch.x + Math.sin(a) * 3.2, perch.y + Math.sin(k * Math.PI) * 1.8, perch.z + (1 - Math.cos(a)) * 2);
            root.rotation.y = -a;
            const flap = Math.sin(t * 22) * 0.9;
            wingL.rotation.x = flap;
            wingR.rotation.x = -flap;
          } else {
            root.position.copy(perch);
            root.rotation.y = phase;
            wingL.rotation.x = wingR.rotation.x = 0;
            head.position.y = 0.1 + (calm ? 0 : Math.abs(Math.sin(t * 2 + phase)) * 0.03);
          }
        },
      };
    }

    case "물고기": {
      // 연못을 천천히 돌며 헤엄쳐요
      const body = part(SPHERE, mat, 0.26, 0.12, 0.09, 0, 0, 0);
      const tail = new THREE.Group();
      tail.position.set(-0.24, 0, 0);
      tail.add(part(CONE, mat, 0.1, 0.16, 0.03, -0.06, 0, 0));
      tail.children[0].rotation.z = Math.PI / 2;
      root.add(body, tail);
      const [px, pz] = RAINBOW.pond;
      const y = ground(px, pz) + 0.02;
      const r = 1 + (i % 3) * 0.5 + j(6) * 0.2;
      return {
        root, body, mat, headY: 0.5,
        update(t, calm) {
          const a = phase * 6 + (calm ? 0 : t * (0.35 + j(7) * 0.1));
          root.position.set(px + Math.cos(a) * r, y + (calm ? 0 : Math.sin(t * 1.3 + phase) * 0.03), pz + Math.sin(a) * r);
          root.rotation.y = -a - Math.PI / 2;
          tail.rotation.y = calm ? 0 : Math.sin(t * 8 + phase) * 0.5;
        },
      };
    }

    case "햄스터·토끼": {
      // 덤불 사이를 깡충깡충 옮겨 다녀요
      const body = part(SPHERE, mat, 0.22, 0.2, 0.2, 0, 0.2, 0);
      const head = part(SPHERE, mat, 0.14, 0.13, 0.13, 0.17, 0.34, 0);
      const earL = part(SPHERE, mat, 0.04, 0.16, 0.06, 0.13, 0.55, 0.06);
      const earR = part(SPHERE, mat, 0.04, 0.16, 0.06, 0.13, 0.55, -0.06);
      root.add(body, head, earL, earR);
      const [bx, bz] = RAINBOW.bushes;
      const spot = (n: number) => {
        const a = jitter(n + i * 31, 11) * Math.PI, r = 1.2 + Math.abs(jitter(n + i * 17, 12)) * 2.2;
        return [bx + Math.cos(a) * r, bz + Math.sin(a) * r] as const;
      };
      return {
        root, body, mat, headY: 0.8,
        update(t, calm) {
          const s = calm ? 0 : t * 0.7 + phase * 5;
          const n = Math.floor(s), k = s - n;
          const [ax, az] = spot(n), [cx, cz] = spot(n + 1);
          const hop = Math.min(1, k / 0.35); // 앞부분에 뛰고, 나머지는 앉아서 쉬어요
          const x = ax + (cx - ax) * hop, z = az + (cz - az) * hop;
          root.position.set(x, ground(x, z) + (hop < 1 ? Math.sin(Math.PI * hop) * 0.35 : 0), z);
          root.rotation.y = -Math.atan2(cz - az, cx - ax);
          earL.rotation.z = earR.rotation.z = hop < 1 ? -0.4 : 0;
        },
      };
    }

    case "거북이·도마뱀": {
      // 바위 위에서 볕을 쬐며 아주 천천히 움직여요
      const shell = part(SPHERE, mat, 0.3, 0.18, 0.26, 0, 0.12, 0);
      const head = part(SPHERE, dark, 0.09, 0.08, 0.08, 0.32, 0.12, 0);
      const legs = [0.15, -0.15].flatMap((x) => [0.17, -0.17].map((z) => part(SPHERE, dark, 0.06, 0.04, 0.06, x, 0.03, z)));
      root.add(shell, head, ...legs);
      const [rx, rz] = RAINBOW.rocks;
      const r = 0.6 + (i % 3) * 0.6;
      return {
        root, body: shell, mat, headY: 0.6,
        update(t, calm) {
          const a = phase * 6 + (calm ? 0 : t * 0.04);
          const x = rx + Math.cos(a) * r, z = rz + Math.sin(a) * r;
          root.position.set(x, ground(x, z) + 0.75, z);
          root.rotation.y = -a - Math.PI / 2;
          head.position.x = 0.3 + (calm ? 0 : Math.max(0, Math.sin(t * 0.5 + phase)) * 0.06);
        },
      };
    }

    case "곤충": {
      // 큰 참나무 줄기에 붙어 아주 천천히 오르내려요. 등껍질이 은은하게 빛나요
      const shell = part(SPHERE, mat, 0.16, 0.06, 0.1, 0, 0, 0);
      const head = part(SPHERE, dark, 0.06, 0.05, 0.06, 0.15, 0, 0);
      const horn = part(CONE, dark, 0.02, 0.12, 0.02, 0.22, 0.04, 0);
      horn.rotation.z = -1.1;
      root.add(shell, head, horn);
      mat.emissiveIntensity = 0.6;
      const [ox, oz] = RAINBOW.oak;
      const a = phase * 6 + i * 1.3;
      const base = ground(ox, oz);
      return {
        root, body: shell, mat, headY: 0.4,
        update(t, calm) {
          const y = base + 1.2 + (calm ? 0.6 : (Math.sin(t * 0.08 + phase) * 0.5 + 0.5) * 1.6);
          root.position.set(ox + Math.cos(a) * 0.62, y, oz + Math.sin(a) * 0.62);
          // 줄기 바깥을 보고, 머리는 위를 향해요
          root.rotation.set(0, -a, Math.PI / 2);
        },
      };
    }

    default: {
      // 그 밖의 아이: 둥실둥실 떠다니는 작은 빛 덩어리
      const body = part(SPHERE, mat, 0.22, 0.22, 0.22, 0, 0, 0);
      root.add(body, part(SPHERE, eye, 0.03, 0.03, 0.03, 0.17, 0.05, 0.08), part(SPHERE, eye, 0.03, 0.03, 0.03, 0.17, 0.05, -0.08));
      mat.emissiveIntensity = 0.5;
      const [cx, cz] = RAINBOW.oak;
      const r = 3 + (i % 4) * 1.2;
      return {
        root, body, mat, headY: 0.5,
        update(t, calm) {
          const a = phase * 6 + (calm ? 0 : t * 0.12);
          const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
          root.position.set(x, ground(x, z) + 1.6 + (calm ? 0 : Math.sin(t * 0.9 + phase) * 0.3), z);
          root.rotation.y = -a;
        },
      };
    }
  }
}
