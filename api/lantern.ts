// /l/:id — 공유된 등불 링크. 카톡/인스타 미리보기용 정보를 담고, 사람은 바로 마을로 보내요.
import { escapeHtml, facts, getLantern, summary, titleOf } from "./_lantern";

export const config = { runtime: "edge" };

export default async function handler(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  const l = await getLantern(id);
  const home = `${u.origin}/`;
  if (!l) return Response.redirect(home, 302);

  const app = `${u.origin}/?l=${l.id}`;
  const title = `${titleOf(l)} · ${facts(l).dday} | 기다림 항구`;
  const desc = summary(l);
  const img = `${u.origin}/api/og?id=${l.id}&v=${facts(l).left}`;
  const e = escapeHtml;

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="기다림 항구">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${e(`${u.origin}/l/${l.id}`)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${e(app)}">
</head><body><a href="${e(app)}">${e(titleOf(l))}의 등불 보러 가기</a></body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-robots-tag": "noindex",
      "cache-control": "public, max-age=0, s-maxage=600",
    },
  });
}
