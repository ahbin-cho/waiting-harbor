// 등불 앞 작은 자리: 등불을 열면 그 곁에 나타나요.
// 액자에 든 사진(없으면 이름), 등불에 적힌 한 줄을 적은 쪽지, 번호와 이름이 적힌 이름판,
// 그리고 추모(온기)가 닿을 때마다 하나씩 놓이는 작은 등. 빛을 내는 건 작은 등뿐이에요.
import * as THREE from "three";
import type { Palette } from "../lib/theme";

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
};

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

  constructor(info: ShrineInfo, p: Palette, glowTex: THREE.Texture, floating: boolean) {
    this.floating = floating;
    this.glowTex = glowTex;
    const g = this.group;
    const keep = <T extends { dispose(): void }>(x: T) => (this.trash.push(x), x);
    const wood = keep(new THREE.MeshStandardMaterial({ color: p.pier, roughness: 1 }));
    const boardMat = keep(new THREE.MeshStandardMaterial({ color: p.shrine, roughness: 0.95 }));
    const lift = floating ? 0 : 0.32;

    // 받침 (하늘과 무지개마을에선 떠 있으니 받침 없이)
    if (!floating) {
      const base = new THREE.Mesh(keep(new THREE.BoxGeometry(3.0, 0.32, 1.15)), wood);
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
    const boardGeo = keep(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 24 }));
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, lift, -0.3);
    board.rotation.z = 0.012;
    g.add(board);

    const hasLine = !!info.line.trim();
    const photoX = hasLine ? -0.5 : 0;

    // 액자와 사진
    const frame = new THREE.Mesh(keep(new THREE.BoxGeometry(1.32, 1.62, 0.07)), wood);
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
        c.font = '700 64px "Gaegu", sans-serif';
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
          c.font = '700 46px "Gaegu", sans-serif';
          c.fillText(`${info.no} · ${info.who}`.slice(0, 22), 256, 44);
        })),
      })),
    );
    if (floating) plate.position.set(0, 0.3, -0.17);
    else plate.position.set(0.05, 0.16, 0.76);
    g.add(plate);

    // 작은 등 자리: 받침 앞쪽에 한 줄, 넘치면 뒤에 한 줄 (조금씩 흐트러지게)
    for (let i = 0; i < MAX_LAMPS; i++) {
      const row = i < 8 ? 0 : 1, k = row ? i - 8 : i, n = row ? 6 : 8;
      const x = -1.25 + (k + 0.5) * (2.5 / n) + Math.sin(i * 12.9) * 0.05;
      const z = floating ? 0.15 + row * 0.1 : row ? 0.12 : 0.5;
      const y = floating ? 0.05 - row * 0.2 + Math.sin(i * 7.1) * 0.04 : lift + 0.07;
      this.lampSpots.push(new THREE.Vector3(x, y, z));
    }
    this.lampMat = keep(new THREE.MeshStandardMaterial({ color: info.color, emissive: info.color, emissiveIntensity: 1.6, roughness: 0.6 }));
    g.add(this.lamps);
    this.setCount(info.count);
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
