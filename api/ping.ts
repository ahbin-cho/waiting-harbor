// /api/ping — 하루 한 번 Vercel Cron 이 불러요. Supabase 무료 프로젝트는 1주일 동안 활동이 없으면
// 일시정지되는데, 아주 가벼운 읽기 한 번으로 깨어 있게 해요.
export const config = { runtime: "edge" };

export default async function handler() {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return new Response("not configured", { status: 503 });
  const res = await fetch(`${url}/rest/v1/lanterns?select=id&limit=1`, { headers: { apikey: key } });
  return new Response(res.ok ? "ok" : `supabase ${res.status}`, { status: res.ok ? 200 : 502, headers: { "cache-control": "no-store" } });
}
