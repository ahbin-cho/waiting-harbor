// 등불 앞 작은 자리: 등불을 열면 그 곁에 나타나요.
// 액자에 든 사진(없으면 이름), 등불에 적힌 한 줄을 적은 쪽지, 번호와 이름이 적힌 이름판,
// 그리고 추모(온기)가 닿을 때마다 하나씩 놓이는 작은 등. 빛을 내는 건 작은 등뿐이에요.
import * as THREE from "three";
import { RAINBOW_BANDS, type Palette } from "../lib/theme";
import type { OfferingKind } from "../lib/offerings";
import { makeOffering, spread } from "./offerings";

export type ShrineInfo = {
  id: string;
  who: string;
  line: string;
  /** "항구 12" 같은 자리 번호 */
  no: string;
  /** 볼 수 있는 사진 주소 (없거나 나만 보기면 없음) */
  photo?: string;
  /** 지금까지 닿은 추모·온기 수 */
  count: number;
  /** 등불 색 (#rrggbb) */
  color: string;
  /** 놓고 간 것들 (종류별 수) */
  offerings?: Partial<Record<OfferingKind, number>>;
  /** 무지개마을 아이면 작은 곰인형이 곁에 앉아 있어요 */
  pet?: boolean;
  /**
   * 기다림 등불이면 추모의 등판 대신 항구 터미널의 "도착 안내판"이 서요.
   * dday: "D-145" 같은 말, arrive: "4월 2일 도착", pct: 기다린 만큼(0~1, 바다의 작은 배 자리), arrived: 돌아왔는지
   */
  wait?: {
    dday: string; arrive: string; pct: number; arrived: boolean; mode: "ship" | "plane";
    /** 군대: 군 종류의 색과 돌아오는 탈것 (안내판 머리띠, 작은 깃발, 버스·배·비행기) */
    branch?: { name: string; color: string; accent: string; vehicle: "bus" | "ship" | "jet" };
  };
};

/** 모서리가 둥근 판: 가로 w, 세로 h 는 둥글게, 두께 d 는 앞뒤로 (액자, 이름판 받침) */
function roundedPanel(w: number, h: number, d: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const b = Math.min(r, d) * 0.5;
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 8 });
  g.center();
  return g;
}
/** 모서리가 둥근 받침: 위에서 본 모양이 둥근 직사각형, 높이 h */
const roundedSlab = (w: number, h: number, d: number, r: number) => roundedPanel(w, d, h, r).rotateX(-Math.PI / 2);

const MAX_LAMPS = 14;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const INK = "#241712";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const paint = () => {
    g.clearRect(0, 0, w, h);
    draw(g);
    tex.needsUpdate = true;
  };
  paint();
  // 손글씨 글꼴이 늦게 오면 한 번 더 그려요
  document.fonts?.ready.then(paint).catch(() => {});
  return tex;
}

/** 글자 단위로 줄을 나눠요 (한국어는 띄어쓰기가 적어도 자연스럽게) */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (g.measureText(cur + ch).width > width && cur) {
      lines.push(cur);
      cur = ch.trimStart();
      if (lines.length === max) break;
    } else cur += ch;
  }
  if (lines.length < max && cur) lines.push(cur);
  else if (lines.length === max && cur) lines[max - 1] = lines[max - 1].slice(0, -1) + "…";
  return lines;
}

export class Shrine {
  readonly group = new THREE.Group();
  readonly floating: boolean;
  private lamps = new THREE.Group();
  private lampSpots: THREE.Vector3[] = [];
  private lampMat: THREE.MeshStandardMaterial;
  private glowTex: THREE.Texture;
  private shown = 0;
  private motes: { s: THREE.Sprite; v: THREE.Vector3; t0: number }[] = [];
  private born = performance.now();
  private trash: { dispose(): void }[] = [];
  private offerGroup = new THREE.Group();
  private offerKey = "";
  private palette: Palette;
  private pet: boolean;
  /** 기다림의 도착 안내판인지 (놓고 간 것이 땅에 놓여요) */
  private arrival = false;

  constructor(info: ShrineInfo, p: Palette, glowTex: THREE.Texture, floating: boolean) {
    this.floating = floating;
    this.glowTex = glowTex;
    this.palette = p;
    this.pet = !!info.pet;
    const g = this.group;
    const keep = <T extends { dispose(): void }>(x: T) => (this.trash.push(x), x);
    this.lampMat = keep(new THREE.MeshStandardMaterial({ color: info.color, emissive: info.color, emissiveIntensity: 1.6, roughness: 0.6 }));
    // 기다림: 도착 안내판 (추모처럼 보이지 않게, 설레는 항구 터미널 느낌으로)
    if (info.wait && !floating) {
      this.arrival = true;
      this.buildArrival(info, p, keep);
      g.add(this.lamps, this.offerGroup);
      this.setCount(info.count);
      this.setOfferings(info.offerings);
      return;
    }
    // 말랑한 점토 같은 느낌: 거칠기를 조금 낮추고 모서리는 다 둥글게
    const wood = keep(new THREE.MeshStandardMaterial({ color: p.pier, roughness: 0.85 }));
    const boardMat = keep(new THREE.MeshStandardMaterial({ color: p.shrine, roughness: 0.8 }));
    const lift = floating ? 0 : 0.32;

    // 떠 있는 자리(추모관의 하늘과 무지개마을): 구름 위에 무지개 층을 쌓은 받침.
    // 작은 등과 놓고 간 것이 맨 위 하얀 판에 올라가요.
    if (floating) {
      const cloudMat = keep(new THREE.MeshStandardMaterial({ color: p.cloud, roughness: 0.9 }));
      const top = new THREE.Mesh(keep(roundedSlab(2.95, 0.1, 0.85, 0.3)), cloudMat);
      top.position.set(0, -0.05, 0.16);
      g.add(top);
      RAINBOW_BANDS.forEach((c, k) => {
        const band = new THREE.Mesh(keep(roundedSlab(2.9 - k * 0.07, 0.05, 0.82 - k * 0.02, 0.28)), keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })));
        band.position.set(0, -0.125 - k * 0.05, 0.16);
        g.add(band);
      });
      const puff = keep(new THREE.SphereGeometry(1, 14, 10));
      [[-1.55, -0.42, 0.2, 0.42], [-0.95, -0.55, 0.35, 0.5], [-0.25, -0.6, 0.3, 0.55], [0.45, -0.58, 0.32, 0.52], [1.1, -0.5, 0.28, 0.48], [1.62, -0.4, 0.15, 0.38], [0.1, -0.5, -0.1, 0.5], [-0.8, -0.45, -0.05, 0.42], [0.95, -0.45, -0.05, 0.42]].forEach(([x, y, z, r]) => {
        const m = new THREE.Mesh(puff, cloudMat);
        m.position.set(x, y, z);
        m.scale.set(r * 1.25, r * 0.72, r);
        g.add(m);
      });
    }
    // 땅에 놓는 자리(기다림 항구): 모서리가 둥근 나무 받침
    if (!floating) {
      const base = new THREE.Mesh(keep(roundedSlab(3.0, 0.32, 1.15, 0.16)), wood);
      base.position.set(0.05, 0.16, 0.18);
      base.rotation.y = 0.012;
      g.add(base);
    }

    // 둥근 등판: 아래는 곧고 위는 둥글게, 아주 조금 기울어요
    const s = new THREE.Shape();
    s.moveTo(-1.25, 0);
    s.lineTo(1.25, 0);
    s.lineTo(1.25, 1.5);
    s.absarc(0, 1.5, 1.25, 0, Math.PI, false);
    s.lineTo(-1.25, 0);
    // 두툼하고 둥근 테두리 (앞면은 z -0.21 에 와요)
    const boardGeo = keep(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 4, curveSegments: 32 }));
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, lift, -0.38);
    board.rotation.z = 0.012;
    g.add(board);

    const hasLine = !!info.line.trim();
    const photoX = hasLine ? -0.5 : 0;

    // 액자와 사진
    const frame = new THREE.Mesh(keep(roundedPanel(1.32, 1.62, 0.07, 0.1)), wood);
    frame.position.set(photoX, lift + 1.42, -0.15);
    frame.rotation.z = -0.018;
    g.add(frame);
    const PW = 1.16, PH = 1.46;
    const photoMat = keep(new THREE.MeshBasicMaterial({ color: 0xdedede }));
    const photo = new THREE.Mesh(keep(new THREE.PlaneGeometry(PW, PH)), photoMat);
    photo.position.set(0, 0, 0.04);
    frame.add(photo);
    const nameCard = () =>
      keep(canvasTex(256, 320, (c) => {
        c.fillStyle = hex(p.beacon);
        c.fillRect(0, 0, 256, 320);
        c.fillStyle = INK;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.font = '400 64px "Gowun Dodum", sans-serif';
        const lines = wrap(c, info.who || "그 사람", 220, 2);
        lines.forEach((t, i) => c.fillText(t, 128, 160 + (i - (lines.length - 1) / 2) * 70));
      }));
    photoMat.map = nameCard();
    if (info.photo) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(info.photo, (tex) => {
        if (!this.trash.length) return tex.dispose(); // 이미 닫혔어요
        tex.colorSpace = THREE.SRGBColorSpace;
        // 액자에 꽉 차게 가운데를 잘라요
        const img = tex.image as { width: number; height: number };
        const want = PW / PH, have = img.width / img.height;
        if (have > want) {
          tex.repeat.set(want / have, 1);
          tex.offset.set((1 - want / have) / 2, 0);
        } else {
          tex.repeat.set(1, have / want);
          tex.offset.set(0, (1 - have / want) / 2);
        }
        photoMat.map?.dispose();
        photoMat.map = keep(tex);
        photoMat.color.set(0xe6e6e6);
        photoMat.needsUpdate = true;
      });
    }

    // 쪽지: 등불에 적힌 한 줄
    if (hasLine) {
      const note = new THREE.Mesh(
        keep(new THREE.PlaneGeometry(0.98, 1.2)),
        keep(new THREE.MeshBasicMaterial({
          color: 0xd9d9d9,
          map: keep(canvasTex(256, 314, (c) => {
            c.fillStyle = hex(p.beacon);
            c.fillRect(0, 0, 256, 314);
            c.fillStyle = INK;
            c.font = '40px "Nanum Pen Script", cursive';
            c.textBaseline = "top";
            wrap(c, info.line.trim(), 220, 6).forEach((t, i) => c.fillText(t, 20, 22 + i * 46));
          })),
        })),
      );
      note.position.set(0.72, lift + 1.5, -0.16);
      note.rotation.z = -0.05;
      g.add(note);
    }

    // 이름판: 번호와 이름
    const plate = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(1.6, 0.26)),
      keep(new THREE.MeshBasicMaterial({
        color: 0xd4d4d4,
        map: keep(canvasTex(512, 84, (c) => {
          c.fillStyle = hex(p.beacon);
          c.fillRect(0, 0, 512, 84);
          c.fillStyle = INK;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.font = '400 46px "Gowun Dodum", sans-serif';
          c.fillText(`${info.no} · ${info.who}`.slice(0, 22), 256, 44);
        })),
      })),
    );
    // 등판 앞면(z -0.17)보다 조금 앞에: 같은 면에 겹치면 깜빡여요
    if (floating) plate.position.set(0, 0.3, -0.11);
    else plate.position.set(0.05, 0.16, 0.76);
    g.add(plate);

    // 작은 등 자리: 받침 앞쪽에 한 줄, 넘치면 뒤에 한 줄 (조금씩 흐트러지게)
    for (let i = 0; i < MAX_LAMPS; i++) {
      const row = i < 8 ? 0 : 1, k = row ? i - 8 : i, n = row ? 6 : 8;
      // 곰인형이 앉은 왼쪽 끝은 비워요
      const x0 = info.pet ? -0.8 : -1.25, w = info.pet ? 2.05 : 2.5;
      const x = x0 + (k + 0.5) * (w / n) + Math.sin(i * 12.9) * 0.05;
      const z = floating ? (row ? 0.0 : 0.38) : row ? 0.12 : 0.5;
      const y = floating ? 0.07 : lift + 0.07;
      this.lampSpots.push(new THREE.Vector3(x, y, z));
    }
    // 무지개마을 아이 곁엔 작은 곰인형이 앉아 있어요
    if (info.pet) {
      const fur = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(p.shrine).multiplyScalar(0.82), roughness: 0.95 }));
      const snout = keep(new THREE.MeshStandardMaterial({ color: p.beacon, roughness: 0.95 }));
      const ball = keep(new THREE.SphereGeometry(1, 12, 10));
      const bear = new THREE.Group();
      const part = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => {
        const o = new THREE.Mesh(ball, m);
        o.position.set(x, y, z);
        o.scale.set(sx, sy, sz);
        bear.add(o);
      };
      part(fur, 0, 0.16, 0, 0.17, 0.19, 0.15); // 몸
      part(fur, 0, 0.42, 0.01, 0.14); // 머리
      part(fur, -0.1, 0.53, 0, 0.05); // 귀
      part(fur, 0.1, 0.53, 0, 0.05);
      part(snout, 0, 0.39, 0.12, 0.055, 0.045, 0.04); // 주둥이
      part(fur, -0.16, 0.2, 0.06, 0.06, 0.08, 0.06); // 팔
      part(fur, 0.16, 0.2, 0.06, 0.06, 0.08, 0.06);
      part(fur, -0.09, 0.03, 0.12, 0.07, 0.05, 0.08); // 다리
      part(fur, 0.09, 0.03, 0.12, 0.07, 0.05, 0.08);
      bear.position.set(-1.12, floating ? 0 : lift, 0.3);
      bear.rotation.y = 0.35;
      bear.scale.setScalar(1.25);
      g.add(bear);
    }
    g.add(this.lamps, this.offerGroup);
    this.setCount(info.count);
    this.setOfferings(info.offerings);
  }

  /**
   * 도착 안내판: 두 기둥에 걸린 항구 터미널의 안내판.
   * 왼쪽엔 테이프로 붙인 폴라로이드 사진, 오른쪽엔 "입항 예정", 이름, D-day, 도착 날짜, 한 줄.
   * 아래 바다에선 작은 배가 기다린 만큼 항구 쪽으로 와 있어요. 온기는 안내판 위 꼬마전구로 켜져요.
   */
  private buildArrival(info: ShrineInfo, p: Palette, keep: <T extends { dispose(): void }>(x: T) => T) {
    const g = this.group;
    const w = info.wait!;
    const wood = keep(new THREE.MeshStandardMaterial({ color: p.pier, roughness: 0.85 }));
    const BW = 2.9, BH = 1.95, CY = 1.85;

    // 기둥 두 개 (조금씩 기울어요)
    const postGeo = keep(new THREE.CylinderGeometry(0.06, 0.08, CY + BH / 2 + 0.15, 10).translate(0, (CY + BH / 2 + 0.15) / 2, 0));
    [[-1.24, 0.012], [1.26, -0.009]].forEach(([x, rz]) => {
      const m = new THREE.Mesh(postGeo, wood);
      m.position.set(x, 0, -0.06);
      m.rotation.z = rz;
      g.add(m);
    });
    // 군대면 오른쪽 기둥 위에 그 군의 색 작은 깃발
    if (w.branch) {
      const tip = CY + BH / 2 + 0.15;
      const flagShape = new THREE.Shape();
      flagShape.moveTo(0, 0);
      flagShape.lineTo(0.5, -0.13);
      flagShape.lineTo(0, -0.27);
      flagShape.closePath();
      const flag = new THREE.Mesh(keep(new THREE.ShapeGeometry(flagShape)), keep(new THREE.MeshStandardMaterial({ color: w.branch.color, roughness: 0.8, side: THREE.DoubleSide })));
      flag.position.set(1.28, tip + 0.36, -0.06);
      flag.rotation.y = -0.25;
      const stick = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6).translate(0, 0.21, 0)), wood);
      stick.position.set(1.27, tip, -0.06);
      g.add(flag, stick);
    }
    // 테두리
    const frame = new THREE.Mesh(keep(roundedPanel(BW + 0.14, BH + 0.14, 0.1, 0.12)), wood);
    frame.position.set(0, CY, -0.01);
    frame.rotation.z = -0.008;
    g.add(frame);

    // 안내판 글자: 바탕이 밝으면 짙은 글씨, 어두우면 밝은 글씨
    const bg = new THREE.Color(p.tower);
    const light = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114 > 0.55;
    const ink = light ? "#24304A" : hex(p.beacon);
    const soft = light ? "rgba(36,48,74,.62)" : "rgba(255,247,234,.7)";
    const tex = keep(canvasTex(1024, 688, (c) => {
      c.fillStyle = hex(p.tower);
      c.fillRect(0, 0, 1024, 688);
      // 머리띠: 입항 예정 / 도착 예정 / 전역 예정 (군대면 그 군의 색으로)
      const br = w.branch;
      c.fillStyle = br ? br.color : light ? "rgba(36,48,74,.08)" : "rgba(255,247,234,.08)";
      c.fillRect(0, 0, 1024, 104);
      c.fillStyle = br ? br.accent : ink;
      c.textBaseline = "middle";
      c.font = '400 60px "Gowun Dodum", sans-serif';
      c.fillText(br ? (w.arrived ? "전역했어요" : "전역 예정") : w.arrived ? "도착했어요" : w.mode === "plane" ? "도착 예정" : "입항 예정", 40, 56);
      c.textAlign = "right";
      c.font = '400 44px "Gowun Dodum", sans-serif';
      c.fillStyle = br ? br.accent : soft;
      c.fillText(br ? `${br.name} · ${info.no}` : info.no, 984, 56);
      // 오른쪽: 이름, D-day, 도착 날짜, 한 줄
      c.textAlign = "left";
      const x0 = 420;
      c.fillStyle = ink;
      c.font = '400 88px "Gowun Dodum", sans-serif';
      c.fillText((info.who || "그 사람").slice(0, 8), x0, 186);
      c.fillStyle = info.color;
      c.font = '400 136px "Gowun Dodum", sans-serif';
      c.fillText(w.dday, x0 - 4, 320);
      c.fillStyle = soft;
      c.font = '500 40px "IBM Plex Sans KR", sans-serif';
      c.fillText(w.arrive, x0, 424);
      if (info.line.trim()) {
        c.fillStyle = ink;
        c.font = '44px "Nanum Pen Script", cursive';
        const [first] = wrap(c, info.line.trim(), 560, 1);
        c.fillText(first ?? "", x0, 492);
      }
      const t = Math.max(0, Math.min(1, w.arrived ? 1 : w.pct));
      const vehicle = w.branch?.vehicle ?? (w.mode === "plane" ? "jet" : "ship");
      if (vehicle === "bus") {
        // 길: 왼쪽에서 오른쪽 집까지, 기다린 만큼 다가온 휴가 버스
        const roadY = 640;
        c.fillStyle = soft;
        c.fillRect(30, roadY + 18, 870, 4);
        for (let x = 40; x < 880; x += 60) c.fillRect(x, roadY + 34, 30, 3);
        // 집: 지붕과 문, 창문은 불을 켜지 않아요
        c.fillStyle = ink;
        c.fillRect(916, roadY - 50, 70, 70);
        c.beginPath();
        c.moveTo(904, roadY - 48); c.lineTo(951, roadY - 92); c.lineTo(998, roadY - 48); c.closePath();
        c.fill();
        c.fillStyle = hex(p.tower);
        c.fillRect(942, roadY - 16, 18, 36);
        // 버스
        const bx = 70 + t * 760;
        c.fillStyle = w.branch?.color ?? info.color;
        c.beginPath();
        c.roundRect(bx - 58, roadY - 42, 116, 56, 12);
        c.fill();
        c.fillStyle = w.branch?.accent ?? hex(p.beacon);
        for (let k = 0; k < 4; k++) c.fillRect(bx - 48 + k * 26, roadY - 34, 18, 16);
        c.fillStyle = ink;
        for (const wx of [bx - 32, bx + 32]) {
          c.beginPath();
          c.arc(wx, roadY + 16, 10, 0, Math.PI * 2);
          c.fill();
        }
      } else if (vehicle === "jet") {
        // 하늘길: 왼쪽 위에서 오른쪽 활주로로 내려오는 점선, 기다린 만큼 다가온 비행기
        const ax = 50, ay = 520, bx2 = 880, by = 640;
        const arc = (u: number) => ({ x: ax + (bx2 - ax) * u, y: ay + (by - ay) * u * u - Math.sin(Math.PI * u) * 40 });
        c.strokeStyle = soft;
        c.lineWidth = 4;
        c.setLineDash([14, 14]);
        c.beginPath();
        for (let u = 0; u <= 1.0001; u += 0.02) {
          const q = arc(u);
          if (u === 0) c.moveTo(q.x, q.y);
          else c.lineTo(q.x, q.y);
        }
        c.stroke();
        c.setLineDash([]);
        // 활주로와 관제탑
        c.fillStyle = ink;
        c.fillRect(870, 648, 130, 8);
        for (let k = 0; k < 4; k++) c.fillRect(880 + k * 30, 662, 16, 4);
        c.fillRect(968, 560, 14, 84);
        c.fillRect(956, 548, 38, 18);
        // 비행기: 점선을 따라, 진행 방향으로 기울어요
        const at = arc(t), nx = arc(Math.min(1, t + 0.01));
        const ang = t >= 1 ? 0 : Math.atan2(nx.y - at.y, nx.x - at.x);
        c.save();
        c.translate(at.x, t >= 1 ? 632 : at.y);
        c.rotate(ang);
        c.fillStyle = w.branch?.color ?? info.color;
        c.beginPath();
        c.ellipse(0, 0, 50, 10, 0, 0, Math.PI * 2); // 몸통
        c.fill();
        c.beginPath();
        c.moveTo(6, -4); c.lineTo(-14, -42); c.lineTo(-24, -42); c.lineTo(-10, -4); c.closePath(); // 위 날개
        c.moveTo(6, 4); c.lineTo(-14, 42); c.lineTo(-24, 42); c.lineTo(-10, 4); c.closePath(); // 아래 날개
        c.moveTo(-38, -4); c.lineTo(-50, -22); c.lineTo(-56, -22); c.lineTo(-48, -2); c.closePath(); // 꼬리
        c.fill();
        c.restore();
      } else {
        // 아래 바다: 물결과 오른쪽 항구, 기다린 만큼 다가온 작은 배
        const seaY = 612;
        c.strokeStyle = soft;
        c.lineWidth = 3;
        for (const dy of [0, 22]) {
          c.beginPath();
          for (let x = 30; x <= 900; x += 6) {
            const y = seaY + dy + Math.sin(x / 28 + dy) * 5;
            if (x === 30) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }
        // 항구: 부두와 작은 등대
        c.fillStyle = ink;
        c.fillRect(912, seaY - 6, 82, 10);
        c.fillRect(958, seaY - 74, 18, 68);
        c.beginPath();
        c.moveTo(952, seaY - 74); c.lineTo(982, seaY - 74); c.lineTo(967, seaY - 96); c.closePath();
        c.fill();
        // 작은 배 (도착하면 항구 바로 앞)
        const bx = 60 + t * 790;
        c.fillStyle = w.branch?.color ?? info.color;
        c.beginPath();
        c.moveTo(bx - 46, seaY - 18); c.lineTo(bx + 46, seaY - 18); c.lineTo(bx + 30, seaY + 6); c.lineTo(bx - 30, seaY + 6); c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(bx - 2, seaY - 22); c.lineTo(bx - 2, seaY - 84); c.lineTo(bx + 36, seaY - 26); c.closePath();
        c.fill();
        // 지나온 물살
        c.fillStyle = soft;
        for (let k = 1; k <= 4; k++) c.fillRect(bx - 46 - k * 26, seaY - 4 + (k % 2) * 4, 12, 3);
      }
    }));
    const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(BW, BH)), keep(new THREE.MeshBasicMaterial({ map: tex, color: 0xe2e2e2 })));
    face.position.set(0, CY, 0.05);
    face.rotation.z = -0.008;
    g.add(face);

    // 폴라로이드: 하얀 테두리 안에 사진(없으면 이름), 위에 테이프 한 조각
    const pol = new THREE.Group();
    pol.position.set(-0.86, CY + 0.05, 0.08);
    pol.rotation.z = 0.06;
    const paper = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.98, 1.16)), keep(new THREE.MeshBasicMaterial({ color: 0xe8e4dc })));
    const photoMat = keep(new THREE.MeshBasicMaterial({ color: 0xdedede }));
    photoMat.map = keep(canvasTex(256, 256, (c) => {
      c.fillStyle = hex(p.beacon);
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = INK;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = '400 60px "Gowun Dodum", sans-serif';
      c.fillText((info.who || "그 사람").slice(0, 4), 128, 128);
    }));
    const PW = 0.84, PH = 0.84;
    const photo = new THREE.Mesh(keep(new THREE.PlaneGeometry(PW, PH)), photoMat);
    photo.position.set(0, 0.1, 0.004);
    const tape = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.4, 0.13)), keep(new THREE.MeshBasicMaterial({ color: p.shrine, transparent: true, opacity: 0.8 })));
    tape.position.set(0.02, 0.58, 0.008);
    tape.rotation.z = -0.12;
    pol.add(paper, photo, tape);
    g.add(pol);
    if (info.photo) {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(info.photo, (t) => {
        if (!this.trash.length) return t.dispose();
        t.colorSpace = THREE.SRGBColorSpace;
        const img = t.image as { width: number; height: number };
        const have = img.width / img.height;
        if (have > 1) {
          t.repeat.set(1 / have, 1);
          t.offset.set((1 - 1 / have) / 2, 0);
        } else {
          t.repeat.set(1, have);
          t.offset.set(0, (1 - have) / 2);
        }
        photoMat.map?.dispose();
        photoMat.map = keep(t);
        photoMat.color.set(0xe6e6e6);
        photoMat.needsUpdate = true;
      });
    }

    // 꼬마전구 자리: 안내판 위 테두리를 따라 (온기가 닿은 만큼 켜져요)
    for (let i = 0; i < MAX_LAMPS; i++) {
      const x = -1.32 + (i + 0.5) * (2.64 / MAX_LAMPS) + Math.sin(i * 12.9) * 0.02;
      this.lampSpots.push(new THREE.Vector3(x, CY + BH / 2 + 0.16 + Math.sin(i * 1.9) * 0.02, 0.04));
    }
  }

  /** 닿은 추모 수만큼 작은 등을 놓아요 (최대 14개) */
  setCount(count: number) {
    const n = Math.min(MAX_LAMPS, count);
    if (n === this.shown) return;
    for (const c of [...this.lamps.children]) {
      this.lamps.remove(c);
      if (c instanceof THREE.Sprite) c.material.dispose();
    }
    const geo = this.lampGeo ??= new THREE.SphereGeometry(0.075, 10, 8).scale(1, 1.25, 1);
    for (let i = 0; i < n; i++) {
      const spot = this.lampSpots[i];
      const m = new THREE.Mesh(geo, this.lampMat);
      m.position.copy(spot);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this.lampMat.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(spot);
      glow.scale.setScalar(0.42);
      glow.userData.ph = i * 1.7;
      this.lamps.add(m, glow);
    }
    this.shown = n;
  }
  private lampGeo?: THREE.BufferGeometry;

  /** 놓고 간 것들을 받침(또는 선반) 위, 작은 등 줄 사이에 흐트러지게 놓아요 (최대 12개) */
  setOfferings(counts: ShrineInfo["offerings"]) {
    const key = JSON.stringify(counts ?? {});
    if (key === this.offerKey) return;
    this.offerKey = key;
    this.offerGroup.clear();
    const list = spread(counts ?? {}, 12);
    const top = this.arrival ? 0 : this.floating ? -0.015 : 0.32;
    list.forEach((k, i) => {
      const o = makeOffering(k, this.palette, i + 1);
      const x0 = this.pet ? -0.75 : -1.2, w = this.pet ? 1.95 : 2.4;
      const x = x0 + ((i + 0.5) / Math.max(list.length, 6)) * w + Math.sin(i * 4.7) * 0.08;
      o.position.set(x, top, (this.arrival ? 0.45 : 0.27) + Math.sin(i * 2.3) * 0.05);
      o.scale.setScalar(2.1);
      this.offerGroup.add(o);
    });
  }

  /** 추모(온기)를 보내면 작은 빛 알갱이가 등판 앞에서 피어올라요 */
  burst() {
    const now = performance.now();
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: this.lampMat.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.set((Math.random() - 0.5) * 2.4, (this.floating ? 0 : 0.4) + Math.random() * 0.3, 0.3 + Math.random() * 0.4);
      s.scale.setScalar(0.18 + Math.random() * 0.12);
      this.group.add(s);
      this.motes.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.7 + Math.random() * 0.7, (Math.random() - 0.5) * 0.2), t0: now + Math.random() * 400 });
    }
  }

  update(now: number, calm: boolean) {
    // 처음 나타날 때 살짝 솟아오르듯
    const k = Math.min(1, (now - this.born) / 600);
    this.group.scale.setScalar((this.floating ? 0.85 : 1) * (0.85 + 0.15 * (1 - Math.pow(1 - k, 3))));
    for (const c of this.lamps.children) {
      if (c instanceof THREE.Sprite) c.material.opacity = calm ? 0.55 : 0.45 + 0.15 * Math.sin(now / 600 + c.userData.ph);
    }
    this.motes = this.motes.filter((m) => {
      const t = (now - m.t0) / 1000;
      if (t < 0) return true;
      if (t > 2.4) {
        this.group.remove(m.s);
        m.s.material.dispose();
        return false;
      }
      m.s.position.addScaledVector(m.v, 0.016);
      m.s.material.opacity = Math.sin(Math.PI * (t / 2.4)) * 0.9;
      return true;
    });
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      if (o instanceof THREE.Sprite) o.material.dispose();
    });
    this.lampGeo?.dispose();
    for (const d of this.trash) d.dispose();
    this.trash = [];
  }
}
