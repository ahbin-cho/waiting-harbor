// /api/talk — "이야기하기". 그리움 등불의 주인이 떠나보낸 사람(아이)에게 말을 걸면,
// 그 마음을 빌린 짧은 답장을 만들어 함께 저장해요.
// - 등불 주인만 쓸 수 있어요 (익명 로그인 토큰으로 확인하고, DB 의 RLS 가 한 번 더 막아요).
// - 하루에 보낼 수 있는 말 수는 DB 정책이 지켜요.
// - 마음이 위험해 보이는 말엔 AI 를 부르지 않고 등대지기가 직접 상담 전화를 안내해요.
// - ANTHROPIC_API_KEY 가 없으면 미리 써 둔 짧은 답장 중에서 골라요.
// 모델은 TALK_MODEL 로 바꿀 수 있어요 (기본 claude-opus-5-5).
import Anthropic from "@anthropic-ai/sdk";
import { SAFETY_REPLY, TALK_MAX, isDanger, templateReply } from "../src/lib/talk";

export const config = { runtime: "edge" };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

type Row = { id: string; user_id: string; who: string; kind: string; start_date: string; end_date: string; line: string; mode: string; place: string; species: string | null };

const SYSTEM = `당신은 "기다림 항구"라는 온라인 추모 마을에서, 떠나보낸 사람이나 반려동물에게 말을 거는 사용자에게 짧은 답장을 써 주는 역할이에요.
답장은 사용자가 그리워하는 그 존재의 목소리를 빌려 쓰지만, 진짜 그 존재가 아니라 "그 마음을 빌려 상상한 답장"이라는 걸 화면이 늘 밝히고 있어요.

지켜 주세요:
- 카카오톡처럼 짧게. 한두 문장, 길어도 세 문장. 한국어로.
- 사람이면 생전 관계에 맞는 편안한 말투(가족·친구에게는 다정한 반말이 자연스러워요). 반려동물이면 단순하고 순한 말투로, 동물다운 시선(산책, 냄새, 볕, 간식, 낮잠)을 담아요.
- 따뜻하고 안심시키는 말: "여기서 잘 지내", "아픈 데 없어", "네 잘못 아니야", "밥 챙겨 먹어" 같은 결.
- 아래 "알려진 것"에 없는 구체적인 사실(추억, 장소, 이름, 별명, 사건)은 지어내지 않아요. 사용자가 꺼낸 이야기는 받아서 이어가도 돼요.
- 다시 만나자는 약속, 기다리고 있겠다는 말, "곧 와", "같이 있자"처럼 죽음 쪽으로 이끄는 말은 절대 하지 않아요. 사용자의 삶을 응원하는 쪽으로 말해요.
- 슬픔을 서둘러 끝내라고 하거나("이제 그만 잊어", "극복해") 축하하는 말은 하지 않아요.
- 사용자가 진지하게 "진짜 너야?"라고 물으면, 부드럽게 "나는 네 기억 속 마음을 빌려 하는 말이야" 같은 결로 솔직하게 답해요.
- 사용자가 자해나 죽음을 암시하면 역할을 내려놓고, 등대지기로서 걱정을 전하며 자살예방 상담전화 109(24시간), 정신건강 상담전화 1577-0199를 안내해요.
- 이모지는 쓰지 않거나 아주 가끔 하나만. 따옴표나 이름표 없이 답장 본문만 써요.`;

function factsOf(l: Row, notes: { body: string; day: string }[]) {
  const pet = l.place === "무지개";
  const lines = [
    `이름: ${l.who}`,
    pet ? `반려동물 (${l.species ?? "종류 모름"})` : `관계: ${l.kind}`,
    `처음 만난 날: ${l.start_date}`,
    `떠난 날: ${l.end_date}`,
  ];
  if (l.line.trim()) lines.push(`사용자가 등불에 적은 한 줄: ${l.line.trim()}`);
  if (notes.length) lines.push(`사용자가 최근에 남긴 편지(참고만):\n${notes.map((n) => `- ${n.day}: ${n.body.slice(0, 200)}`).join("\n")}`);
  return `알려진 것:\n${lines.join("\n")}`;
}

/** 지난 대화를 user/assistant 가 번갈아 오도록 맞춰요 (첫 말은 늘 사용자) */
function toMessages(history: { role: string; body: string }[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of history) {
    const role = h.role === "me" ? "user" : "assistant";
    if (!out.length && role === "assistant") continue;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = `${last.content as string}\n${h.body}`;
    else out.push({ role, content: h.body });
  }
  return out;
}

async function aiReply(l: Row, notes: { body: string; day: string }[], history: { role: string; body: string }[]) {
  const model = process.env.TALK_MODEL || "claude-opus-5-5";
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.beta.messages.create({
    model,
    max_tokens: 2000,
    output_config: { effort: "low" }, // 짧은 답장이라 깊이 생각할 필요가 없어요
    // 안전 분류기가 거절하면 서버에서 다른 모델로 다시 시도해요 (Haiku 는 지원하지 않아요)
    ...(model.startsWith("claude-haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    system: `${SYSTEM}\n\n${factsOf(l, notes)}`,
    messages: toMessages(history),
  });
  if (res.stop_reason === "refusal") return null;
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text ? text.slice(0, 600) : null;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return json(405, { error: "method" });
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return json(503, { error: "not-configured" });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "no-session" });

  let input: { lanternId?: unknown; text?: unknown };
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "bad-json" });
  }
  const lanternId = typeof input.lanternId === "string" && /^[0-9a-f-]{36}$/i.test(input.lanternId) ? input.lanternId : "";
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!lanternId || !text || text.length > TALK_MAX) return json(400, { error: "invalid" });

  // 익명 로그인한 사람의 토큰으로 읽고 써요. 권한은 RLS 가 지켜요.
  const h = { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const rest = (path: string, init?: RequestInit) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...h, ...(init?.headers ?? {}) } });

  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!userRes.ok) return json(401, { error: "no-session" });
  const user = (await userRes.json()) as { id: string };
  const lr = await rest(`lanterns?id=eq.${lanternId}&select=id,user_id,who,kind,start_date,end_date,line,mode,place,species&limit=1`);
  const lantern = ((await lr.json()) as Row[])[0];
  if (!lantern || lantern.user_id !== user.id || lantern.mode !== "miss") return json(403, { error: "not-yours" });

  // 내 말을 먼저 저장 (하루 제한에 걸리면 여기서 막혀요)
  const saved = await rest("talks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lantern_id: lanternId, role: "me", body: text }) });
  if (!saved.ok) return json(429, { error: "limit" });

  const safety = isDanger(text);
  let reply: string | null = safety ? SAFETY_REPLY : null;
  let by: "safety" | "ai" | "template" = safety ? "safety" : "template";
  if (!reply && process.env.ANTHROPIC_API_KEY) {
    try {
      const [hr, nr] = await Promise.all([
        rest(`talks?lantern_id=eq.${lanternId}&select=role,body&order=created_at.desc&limit=20`),
        rest(`notes?lantern_id=eq.${lanternId}&select=body,day&order=created_at.desc&limit=5`),
      ]);
      const history = ((await hr.json()) as { role: string; body: string }[]).reverse();
      const notes = nr.ok ? ((await nr.json()) as { body: string; day: string }[]) : [];
      reply = await aiReply(lantern, notes, history);
      if (reply) by = "ai";
    } catch (e) {
      // 답장을 못 만들어도 대화는 이어가요: 아래 기본 답장으로
      if (e instanceof Anthropic.RateLimitError) console.warn("talk: rate limited");
      else if (e instanceof Anthropic.APIError) console.warn(`talk: api error ${e.status}`);
      else console.warn("talk: failed");
    }
  }
  if (!reply) reply = templateReply({ who: lantern.who, isPet: lantern.place === "무지개", species: lantern.species }, text, Date.now() >>> 10);

  await rest("talks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lantern_id: lanternId, role: "them", body: reply }) });
  return json(200, { reply, by });
}
