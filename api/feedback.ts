// /api/feedback — "의견 남기기". Supabase 에 저장하고, 설정돼 있으면 운영자에게 메일로도 보내요.
// 메일: Resend (RESEND_API_KEY), 받는 주소는 FEEDBACK_TO, 보내는 주소는 FEEDBACK_FROM (없으면 Resend 테스트 주소).

export const config = { runtime: "edge" };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export default async function handler(req: Request) {
  if (req.method !== "POST") return json(405, { error: "method" });
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return json(503, { error: "not-configured" });

  let input: { body?: unknown; contact?: unknown; page?: unknown; website?: unknown };
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "bad-json" });
  }
  // 사람 눈엔 안 보이는 칸. 채워져 있으면 자동 입력 봇이에요. 조용히 성공한 척해요.
  if (typeof input.website === "string" && input.website) return json(200, { ok: true });

  const body = typeof input.body === "string" ? input.body.trim() : "";
  const contact = typeof input.contact === "string" ? input.contact.trim() : "";
  const page = typeof input.page === "string" ? input.page.slice(0, 200) : "";
  if (!body || body.length > 1000 || contact.length > 100) return json(400, { error: "invalid" });

  // 익명 로그인한 사람의 토큰으로 저장해요. 하루 5개 제한 같은 규칙은 DB(RLS)가 지켜요.
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "no-session" });
  const saved = await fetch(`${url}/rest/v1/feedback`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ body, contact, page }),
  });
  if (!saved.ok) return json(saved.status === 401 ? 401 : 429, { error: "rejected" });

  // 메일은 실패해도 의견은 이미 저장됐으니 성공으로 답해요
  const resend = process.env.RESEND_API_KEY, to = process.env.FEEDBACK_TO;
  if (resend && to) {
    const when = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM || "기다림 항구 <onboarding@resend.dev>",
        to: [to],
        subject: `[기다림 항구] 의견: ${body.slice(0, 30)}${body.length > 30 ? "…" : ""}`,
        text: `${body}\n\n---\n답장 받을 곳: ${contact || "(남기지 않음)"}\n보낸 화면: ${page || "-"}\n받은 시각: ${when}`,
        ...(contact.includes("@") ? { reply_to: contact } : {}),
      }),
    }).catch(() => undefined);
  }
  return json(200, { ok: true });
}
