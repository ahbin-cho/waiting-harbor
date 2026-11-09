// 10초 영상: 3D 마을 화면을 세로(9:16) 캔버스에 옮겨 그리고, 아래에 이름과 한 줄을 얹어 녹화해요.

export type ClipText = { title: string; sub: string; line: string };

export const canRecord = () =>
  typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";

const TYPES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

export async function startClip(text: ClipText, width = 720, height = 1280) {
  await Promise.all([
    document.fonts.load('400 52px "Poor Story"'),
    document.fonts.load('400 40px "Nanum Pen Script"'),
    document.fonts.load('400 28px "IBM Plex Sans KR"'),
  ]).catch(() => undefined);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  const stream = out.captureStream(30);
  // 인스타에 바로 올라가는 mp4 를 먼저 써요. 다만 어떤 브라우저는 mp4 를 지원한다고 답하고도
  // 빈 파일을 만들어서, 작은 캔버스로 잠깐 녹화해 보고 실제로 데이터가 나오는 형식을 골라요.
  const type = await pickType();
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(500);

  const ease = (k: number, a: number, b: number) => Math.min(1, Math.max(0, (k - a) / (b - a)));

  return {
    ext: (rec.mimeType || type).includes("mp4") ? "mp4" : "webm",
    /** 3D 화면 한 장을 옮겨 그려요. k 는 0~1 진행도 */
    draw(src: HTMLCanvasElement, k: number) {
      // 화면을 세로 캔버스에 꽉 차게 (가운데 기준으로 잘라요)
      const s = Math.max(width / src.width, height / src.height);
      const w = src.width * s, h = src.height * s;
      ctx.drawImage(src, (width - w) / 2, (height - h) / 2, w, h);

      // 아래쪽을 살짝 어둡게 해서 글자가 읽히게
      const g = ctx.createLinearGradient(0, height * 0.55, 0, height);
      g.addColorStop(0, "rgba(5,8,26,0)");
      g.addColorStop(1, "rgba(5,8,26,0.75)");
      ctx.fillStyle = g;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);

      const pad = 56;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#EDE5D6";
      ctx.globalAlpha = ease(k, 0.08, 0.22);
      ctx.font = '400 52px "Poor Story", sans-serif';
      ctx.fillText(text.title, pad, height - 250);
      ctx.font = '400 28px "IBM Plex Sans KR", sans-serif';
      ctx.fillStyle = "#C9CBE0";
      ctx.fillText(text.sub, pad, height - 200);
      if (text.line) {
        ctx.globalAlpha = ease(k, 0.3, 0.45);
        ctx.fillStyle = "#EDE5D6";
        ctx.font = '400 42px "Nanum Pen Script", cursive';
        wrap(ctx, text.line, pad, height - 130, width - pad * 2, 46);
      }
      ctx.globalAlpha = 0.7;
      ctx.font = '400 30px "Poor Story", sans-serif';
      ctx.fillStyle = "#EDE5D6";
      ctx.fillText("기다림 항구", pad, 90);
      // 끝은 천천히 어두워지며 닫혀요
      const end = ease(k, 0.9, 1);
      if (end > 0) {
        ctx.globalAlpha = end * 0.85;
        ctx.fillStyle = "#05081A";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalAlpha = 1;
    },
    stop() {
      const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || type || "video/webm" }))));
      rec.stop();
      return done.then((b) => {
        stream.getTracks().forEach((x) => x.stop());
        if (!b.size) throw new Error("empty");
        return b;
      });
    },
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = "", row = 0;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > max && line) {
      ctx.fillText(line, x, y + row * lh);
      line = "";
      row++;
      if (row > 1) return; // 두 줄까지만
    }
    line += ch;
  }
  ctx.fillText(line, x, y + row * lh);
}

/** 실제로 녹화가 되는 형식 찾기 (형식마다 0.3초씩 시험) */
async function pickType() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  for (const t of TYPES) {
    if (!MediaRecorder.isTypeSupported(t)) continue;
    const st = c.captureStream(30);
    const ok = await new Promise<boolean>((res) => {
      let size = 0, f = 0;
      const r = new MediaRecorder(st, { mimeType: t });
      r.ondataavailable = (e) => (size += e.data.size);
      r.onstop = () => res(size > 0);
      r.onerror = () => res(false);
      const iv = setInterval(() => {
        g.fillStyle = f++ % 2 ? "#123" : "#456";
        g.fillRect(0, 0, 64, 64);
      }, 30);
      r.start(100);
      setTimeout(() => {
        clearInterval(iv);
        r.stop();
      }, 300);
    }).catch(() => false);
    st.getTracks().forEach((x) => x.stop());
    if (ok) return t;
  }
  // 기기가 바빠서 시험이 다 실패했으면, 지원한다는 첫 형식으로 녹화해요
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}
