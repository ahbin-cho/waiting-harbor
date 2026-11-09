// 승선권: 기다림 등불을 "○○를 기다리는 사람" 이름이 찍힌 탑승권 이미지로 만들어요.
// 화면에서 바로 그려서 저장하거나 공유해요 (서버를 거치지 않아요).
import type { Lantern } from "./supabase";
import { COLORS, colorOf } from "./looks";
import { daysLeft, fliesHome, parseDate, pick } from "./waiting";
import { branchOf } from "./branches";

const W = 1080, H = 1350;

export async function makePass(l: Lantern, no: string): Promise<Blob> {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const color = branchOf(l.branch)?.color ?? COLORS[colorOf(l.color)];
  const plane = fliesHome(l.kind);
  const n = daysLeft(l);
  const d = (s: string) => {
    const x = parseDate(s);
    return x ? `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}` : "";
  };

  // 밤바다 바탕
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0A1028");
  bg.addColorStop(1, "#151C42");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // 승선권 종이
  const x0 = 90, y0 = 170, pw = W - 180, ph = 1010;
  g.fillStyle = "#F7F3EA";
  g.beginPath();
  g.roundRect(x0, y0, pw, ph, 36);
  g.fill();
  // 머리띠
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x0, y0, pw, 170, [36, 36, 0, 0]);
  g.fill();
  g.fillStyle = "#F7F3EA";
  g.font = '400 64px "Poor Story", sans-serif';
  g.textBaseline = "middle";
  g.fillText(plane ? "탑승권" : l.kind === "군대" ? "귀향권" : "승선권", x0 + 56, y0 + 70);
  g.font = '500 30px "IBM Plex Sans KR", sans-serif';
  g.globalAlpha = 0.85;
  g.fillText(plane ? "BOARDING PASS" : "WAITING HARBOR", x0 + 58, y0 + 125);
  g.globalAlpha = 1;
  g.textAlign = "right";
  g.font = '400 44px "Poor Story", sans-serif';
  g.fillText("기다림 항구", x0 + pw - 56, y0 + 88);
  g.textAlign = "left";

  const ink = "#1E2436", soft = "#6B7189";
  const label = (t: string, x: number, y: number) => {
    g.fillStyle = soft;
    g.font = '500 28px "IBM Plex Sans KR", sans-serif';
    g.fillText(t, x, y);
  };
  const value = (t: string, x: number, y: number, size = 52, font = "IBM Plex Sans KR", weight = 500) => {
    g.fillStyle = ink;
    g.font = `${weight} ${size}px "${font}", sans-serif`;
    g.fillText(t, x, y);
  };

  // 승객: ○○를 기다리는 사람
  label("승객", x0 + 56, y0 + 250);
  value(`${pick(l.who.trim() || "그 사람", "을", "를")} 기다리는 사람`, x0 + 56, y0 + 320, 66, "Poor Story", 700);

  // 출발 → 도착
  label("기다린 날부터", x0 + 56, y0 + 430);
  value(d(l.start_date), x0 + 56, y0 + 490);
  label(l.kind === "군대" ? "전역하는 날" : "돌아오는 날", x0 + pw / 2 + 20, y0 + 430);
  value(d(l.end_date), x0 + pw / 2 + 20, y0 + 490);
  // 가운데 화살표 (탈것)
  g.fillStyle = color;
  g.font = '400 54px "IBM Plex Sans KR", sans-serif';
  g.textAlign = "center";
  g.fillText(plane ? "✈" : "→", x0 + pw / 2 - 20, y0 + 486);
  g.textAlign = "left";

  // 자리 / 종류 / 남은 날
  label("자리", x0 + 56, y0 + 600);
  value(no, x0 + 56, y0 + 660, 48);
  label(l.kind === "군대" ? "군" : "기다림", x0 + 330, y0 + 600);
  value(l.kind === "군대" ? (l.branch ?? "군대") : l.kind, x0 + 330, y0 + 660, 44);
  label("남은 날", x0 + pw - 300, y0 + 600);
  value(n == null ? "" : n > 0 ? `D-${n}` : n === 0 ? "오늘!" : "도착", x0 + pw - 300, y0 + 664, 64, "Poor Story", 700);

  // 절취선
  g.strokeStyle = "#C9C2B2";
  g.lineWidth = 4;
  g.setLineDash([16, 14]);
  g.beginPath();
  g.moveTo(x0 + 40, y0 + 760);
  g.lineTo(x0 + pw - 40, y0 + 760);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "#0A1028";
  for (const cx of [x0, x0 + pw]) {
    g.beginPath();
    g.arc(cx, y0 + 760, 30, 0, Math.PI * 2);
    g.fill();
  }

  // 아래: 한 줄 (손글씨)
  if (l.line.trim()) {
    g.fillStyle = ink;
    g.font = '52px "Nanum Pen Script", cursive';
    const text = l.line.trim().slice(0, 30);
    g.fillText(`“${text}”`, x0 + 56, y0 + 860);
  }
  g.fillStyle = soft;
  g.font = '500 28px "IBM Plex Sans KR", sans-serif';
  g.fillText("waiting-harbor-one.vercel.app", x0 + 56, y0 + 950);

  // 아래 바깥: 작은 문구
  g.fillStyle = "#B9BED8";
  g.textAlign = "center";
  g.font = '400 46px "Poor Story", sans-serif';
  g.fillText("돌아오는 날까지, 등불 하나", W / 2, 1270);

  return new Promise((ok, no2) => c.toBlob((b) => (b ? ok(b) : no2(new Error("blob"))), "image/png"));
}

/**
 * 추모 카드: 그리움 등불을 조용한 카드 이미지로. 카운트다운 없이 함께한 날로만 말해요.
 * 사람은 "추모관 하늘의 풍등", 반려동물은 "무지개마을 주민 카드".
 */
export async function makeMemoryCard(l: Lantern, no: string): Promise<Blob> {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const pet = l.place === "무지개";
  const color = COLORS[colorOf(l.color)];
  const d = (s: string) => {
    const x = parseDate(s);
    return x ? `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}` : "";
  };
  const a = parseDate(l.start_date), b = parseDate(l.end_date);
  const together = a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1 : 0;

  // 포근한 낮 하늘 바탕
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#9FD2EC");
  bg.addColorStop(1, "#FAE3D4");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // 구름 몇 송이
  g.fillStyle = "rgba(255,255,255,.75)";
  for (const [x, y, r] of [[160, 120, 60], [230, 110, 80], [310, 130, 55], [820, 1250, 70], [900, 1235, 90], [985, 1260, 60]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // 카드
  const x0 = 90, y0 = 200, pw = W - 180, ph = 960;
  g.fillStyle = "#FFFAF4";
  g.beginPath();
  g.roundRect(x0, y0, pw, ph, 40);
  g.fill();
  // 무지개 띠 (반려동물) 또는 등불 색 띠 (사람)
  if (pet) {
    ["#ff8f8f", "#ffb27e", "#ffe08e", "#a2e2a4", "#8fcaff", "#a9a2ff", "#d8a8ff"].forEach((col, k) => {
      g.fillStyle = col;
      g.fillRect(x0 + 40 + k * ((pw - 80) / 7), y0 + 36, (pw - 80) / 7, 14);
    });
  } else {
    g.fillStyle = color;
    g.fillRect(x0 + 40, y0 + 36, pw - 80, 14);
  }

  const ink = "#24304A", soft = "#6B7189";
  g.textBaseline = "middle";
  g.fillStyle = ink;
  g.font = '400 60px "Poor Story", sans-serif';
  g.fillText(pet ? "무지개마을 주민 카드" : "추모관 풍등 카드", x0 + 56, y0 + 120);
  g.fillStyle = soft;
  g.font = '500 28px "IBM Plex Sans KR", sans-serif';
  g.fillText(pet ? `${no} · ${l.species ?? "반려동물"}` : `${no} · ${l.kind}`, x0 + 58, y0 + 175);

  const label = (t: string, x: number, y: number) => {
    g.fillStyle = soft;
    g.font = '500 28px "IBM Plex Sans KR", sans-serif';
    g.fillText(t, x, y);
  };
  const value = (t: string, x: number, y: number, size = 50, font = "IBM Plex Sans KR") => {
    g.fillStyle = ink;
    g.font = `${font === "Poor Story" ? 400 : 500} ${size}px "${font}", sans-serif`;
    g.fillText(t, x, y);
  };

  label(pet ? "보호자" : "이름", x0 + 56, y0 + 270);
  value(`${pick(l.who.trim() || "그 사람", "을", "를")} 그리워하는 사람`, x0 + 56, y0 + 340, 64, "Poor Story");

  label("처음 만난 날", x0 + 56, y0 + 450);
  value(d(l.start_date), x0 + 56, y0 + 510);
  label(pet ? "무지개다리 건넌 날" : "떠난 날", x0 + pw / 2 + 20, y0 + 450);
  value(d(l.end_date), x0 + pw / 2 + 20, y0 + 510);

  label("함께한 날", x0 + 56, y0 + 620);
  value(together ? `${together.toLocaleString()}일` : "", x0 + 56, y0 + 690, 72, "Poor Story");
  label(pet ? "지내는 곳" : "있는 곳", x0 + pw / 2 + 20, y0 + 620);
  value(pet ? "무지개마을" : "추모관 하늘", x0 + pw / 2 + 20, y0 + 684, 46);

  // 점선
  g.strokeStyle = "#E3D9CB";
  g.lineWidth = 4;
  g.setLineDash([16, 14]);
  g.beginPath();
  g.moveTo(x0 + 40, y0 + 780);
  g.lineTo(x0 + pw - 40, y0 + 780);
  g.stroke();
  g.setLineDash([]);

  if (l.line.trim()) {
    g.fillStyle = ink;
    g.font = '52px "Nanum Pen Script", cursive';
    g.fillText(`“${l.line.trim().slice(0, 30)}”`, x0 + 56, y0 + 860);
  }
  g.fillStyle = soft;
  g.font = '500 28px "IBM Plex Sans KR", sans-serif';
  g.fillText("waiting-harbor-one.vercel.app", x0 + 56, y0 + 920);

  g.fillStyle = "#4F5B74";
  g.textAlign = "center";
  g.font = '400 46px "Poor Story", sans-serif';
  g.fillText(pet ? "무지개다리 건너, 잘 지내고 있어요" : "함께한 날들을 기억해요", W / 2, 1240);

  return new Promise((ok, no2) => c.toBlob((bl) => (bl ? ok(bl) : no2(new Error("blob"))), "image/png"));
}
