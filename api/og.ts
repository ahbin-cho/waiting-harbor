// /api/og?id=… — 등불 공유 카드 이미지 (1200×630). 카톡/인스타 미리보기에 쓰여요.
import { ImageResponse } from "@vercel/og";
import { COLORS, facts, getLantern, titleOf } from "./_lantern";

export const config = { runtime: "edge" };

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children },
});

/** 카드에 쓰는 글자만 담은 작은 폰트를 Google Fonts 에서 받아요 */
// Google 은 요청한 브라우저에 따라 글꼴 형식을 바꿔 줘요. 카드 생성기는 woff2 를 못 읽어서,
// 오래된 사파리처럼 요청해 TTF 를 받아요. 그래도 실패하면 null (기본 글꼴로 그려요).
const OLD_SAFARI = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-us) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
async function font(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`, {
      headers: { "User-Agent": OLD_SAFARI },
    });
    const css = await res.text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype|woff)'\)/)?.[1];
    if (!src) return null;
    return await (await fetch(src)).arrayBuffer();
  } catch {
    return null;
  }
}

/** 받아 온 글꼴만 넘겨요 */
const fontsOf = (list: { name: string; data: ArrayBuffer | null; weight: 400 | 700 }[]) =>
  list.filter((f) => f.data).map((f) => ({ name: f.name, data: f.data as ArrayBuffer, weight: f.weight, style: "normal" as const }));

/** 사이트 대표 카드 (등불 여러 개가 걸린 밤 마을). public/og.png 로 저장해서 써요. */
async function homeCard() {
  const title = "기다림 항구";
  const sub = "돌아올 사람을 기다리는 사람들이 등불을 걸어두는 밤 마을";
  const [gaegu, plex] = await Promise.all([font("Gaegu", 700, title), font("IBM+Plex+Sans+KR", 400, sub)]);
  const lamps: [string, number, number, number][] = [
    ["#FFB867", 150, 452, 1], ["#FFB0C8", 330, 430, 0.7], ["#8FCBFF", 500, 458, 0.5], ["#F4E6C6", 700, 436, 0.9], ["#BFA8FF", 880, 455, 0.6], ["#B4E58A", 1050, 440, 0.45],
  ];
  const card = h(
    "div",
    { width: "100%", height: "100%", position: "relative", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#05081A 0%,#0E1433 50%,#2B2446 74%,#080F2A 75%,#03061A 100%)", color: "#EDE5D6" },
    ...lamps.map(([c, x, y, g]) =>
      h("div", { position: "absolute", left: `${x - 60}px`, top: `${y - 60}px`, width: "120px", height: "120px", alignItems: "center", justifyContent: "center", opacity: 0.45 + 0.55 * g },
        h("div", { position: "absolute", width: "120px", height: "120px", borderRadius: "60px", background: `radial-gradient(circle, ${c}99 0%, ${c}22 50%, transparent 72%)` }),
        h("div", { width: "34px", height: "42px", borderRadius: "50%", background: `radial-gradient(circle at 50% 55%, #FFF6E6 0%, ${c} 55%)` }),
      ),
    ),
    h("div", { fontFamily: "Gaegu", fontSize: "130px", letterSpacing: "-0.08em", marginTop: "-190px" }, title),
    h("div", { fontFamily: "Plex", fontSize: "32px", color: "#9499BA", marginTop: "10px" }, sub),
  );
  return new ImageResponse(card as never, {
    width: 1200, height: 630,
    fonts: fontsOf([{ name: "Gaegu", data: gaegu, weight: 700 }, { name: "Plex", data: plex, weight: 400 }]),
  });
}

export default async function handler(req: Request) {
  // 실패하면 빈 오류 대신 어디서 막혔는지 글자로 보여줘요 (비밀 값은 담지 않아요)
  try {
    return await draw(req);
  } catch (e) {
    return new Response(`card error: ${(e as Error).message}`, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}

async function draw(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id");
  if (!id) return homeCard();
  const l = await getLantern(id);
  if (!l) return new Response("not found: 등불을 찾지 못했어요 (아이디를 확인해 주세요)", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  if (q.get("s") === "1") return storyCard(l, new URL(req.url).host);

  const f = facts(l);
  const color = COLORS[l.color] ?? COLORS.촛불;
  const title = titleOf(l);
  const line = l.line.length > 26 ? `${l.line.slice(0, 25)}…` : l.line;
  const meta = l.place === "무지개" ? `무지개마을에서 지내요 · 함께한 날 ${f.together.toLocaleString()}일`
    : f.miss ? `하늘에 띄운 풍등 · 함께한 날 ${f.together.toLocaleString()}일` : `${l.place}에 걸린 등불 · 기다린 지 ${f.since}일째`;
  const brand = "기다림 항구";

  const [gaegu, pen, plex] = await Promise.all([
    font("Gaegu", 700, title + f.dday + brand),
    font("Nanum+Pen+Script", 400, line || " "),
    font("IBM+Plex+Sans+KR", 400, meta),
  ]);

  const card = h(
    "div",
    { width: "100%", height: "100%", background: "linear-gradient(180deg,#05081A 0%,#0E1433 55%,#2B2446 78%,#080F2A 79%,#03061A 100%)", color: "#EDE5D6", padding: "64px 72px", alignItems: "center", gap: "64px" },
    // 등불
    h(
      "div",
      { width: "300px", height: "420px", alignItems: "center", justifyContent: "center", position: "relative" },
      h("div", { position: "absolute", width: "420px", height: "420px", borderRadius: "210px", background: `radial-gradient(circle, ${color}88 0%, ${color}22 45%, transparent 70%)` }),
      h(
        "div",
        { flexDirection: "column", alignItems: "center" },
        h("div", { width: "70px", height: "14px", borderRadius: "4px", background: "#241712" }),
        h("div", { width: "170px", height: "210px", borderRadius: "50%", marginTop: "-6px", background: `radial-gradient(circle at 50% 55%, #FFF6E6 0%, ${color} 50%, ${color}AA 100%)` }),
        h("div", { width: "70px", height: "14px", borderRadius: "4px", background: "#241712", marginTop: "-6px" }),
      ),
    ),
    // 글
    h(
      "div",
      { flexDirection: "column", flex: 1, gap: "6px" },
      h("div", { fontFamily: "Plex", fontSize: "26px", color: "#9499BA" }, meta),
      h("div", { fontFamily: "Gaegu", fontSize: "66px", lineHeight: 1.15, marginTop: "8px", letterSpacing: "-0.06em" }, title),
      h("div", { fontFamily: "Gaegu", fontSize: f.miss ? "104px" : "150px", lineHeight: 1, color, marginTop: "4px", letterSpacing: "-0.08em" }, f.dday),
      ...(line ? [h("div", { fontFamily: "Pen", fontSize: "52px", marginTop: "18px", color: "#EDE5D6" }, line)] : []),
      h("div", { fontFamily: "Gaegu", fontSize: "30px", color: "#9499BA", marginTop: "28px", letterSpacing: "-0.04em" }, brand),
    ),
  );

  return new ImageResponse(card as never, {
    width: 1200,
    height: 630,
    fonts: fontsOf([
      { name: "Gaegu", data: gaegu, weight: 700 },
      { name: "Pen", data: pen, weight: 400 },
      { name: "Plex", data: plex, weight: 400 },
    ]),
    headers: { "cache-control": "public, max-age=3600, s-maxage=3600" },
  });
}

/** 인스타 스토리 크기(1080×1920) 세로 카드: 가운데 등불, 아래 이름과 날짜, 한 줄 */
async function storyCard(l: Awaited<ReturnType<typeof getLantern>> & object, host: string) {
  const f = facts(l);
  const color = COLORS[l.color] ?? COLORS.촛불;
  const title = titleOf(l);
  const line = l.line.length > 30 ? `${l.line.slice(0, 29)}…` : l.line;
  const where = l.place === "무지개" ? "무지개마을에서 지내요" : f.miss ? "하늘에 띄운 풍등" : `${l.place}에 걸린 등불`;
  const brand = "기다림 항구";
  const [gaegu, pen, plex] = await Promise.all([
    font("Gaegu", 700, title + f.dday + brand),
    font("Nanum+Pen+Script", 400, line || " "),
    font("IBM+Plex+Sans+KR", 400, where + host),
  ]);
  const card = h(
    "div",
    { width: "100%", height: "100%", flexDirection: "column", alignItems: "center", background: "linear-gradient(180deg,#0A1028 0%,#151C42 45%,#3A3060 70%,#0F1A40 71%,#05081A 100%)", color: "#EDE5D6", padding: "140px 90px 120px" },
    h("div", { fontFamily: "Gaegu", fontSize: "52px", color: "#9499BA", letterSpacing: "-0.04em" }, brand),
    h(
      "div",
      { width: "560px", height: "720px", alignItems: "center", justifyContent: "center", position: "relative", marginTop: "60px" },
      h("div", { position: "absolute", width: "640px", height: "640px", borderRadius: "320px", background: `radial-gradient(circle, ${color}88 0%, ${color}22 45%, transparent 70%)` }),
      h(
        "div",
        { flexDirection: "column", alignItems: "center" },
        h("div", { width: "110px", height: "22px", borderRadius: "6px", background: "#241712" }),
        h("div", { width: "270px", height: "330px", borderRadius: "50%", marginTop: "-8px", background: `radial-gradient(circle at 50% 55%, #FFF6E6 0%, ${color} 50%, ${color}AA 100%)` }),
        h("div", { width: "110px", height: "22px", borderRadius: "6px", background: "#241712", marginTop: "-8px" }),
      ),
    ),
    h("div", { fontFamily: "Plex", fontSize: "34px", color: "#9499BA", marginTop: "40px" }, where),
    h("div", { fontFamily: "Gaegu", fontSize: "84px", marginTop: "18px", letterSpacing: "-0.06em", textAlign: "center" }, title),
    h("div", { fontFamily: "Gaegu", fontSize: f.miss ? "120px" : "180px", lineHeight: 1, color, marginTop: "18px", letterSpacing: "-0.08em" }, f.dday),
    ...(line ? [h("div", { fontFamily: "Pen", fontSize: "64px", marginTop: "40px", textAlign: "center" }, line)] : []),
    h("div", { fontFamily: "Plex", fontSize: "30px", color: "#646A90", marginTop: "auto" }, host),
  );
  return new ImageResponse(card as never, {
    width: 1080,
    height: 1920,
    fonts: fontsOf([
      { name: "Gaegu", data: gaegu, weight: 700 },
      { name: "Pen", data: pen, weight: 400 },
      { name: "Plex", data: plex, weight: 400 },
    ]),
    headers: { "cache-control": "public, max-age=3600, s-maxage=3600" },
  });
}
