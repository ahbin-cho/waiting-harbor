// Supabase 연결 확인: npm run check:supabase
// .env 의 URL·anon key 로 익명 로그인 → 테이블 읽기 → Realtime 구독까지 확인해요.
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

const ok = (m) => console.log(`✓ ${m}`);
const fail = (m, hint) => {
  console.error(`✗ ${m}`);
  if (hint) console.error(`  → ${hint}`);
  process.exit(1);
};

if (!url || !key || url.includes("xxxx") || key === "your-anon-key") {
  fail(".env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없어요", "README 4단계: cp .env.example .env 후 값을 채워주세요");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const auth = await supabase.auth.signInAnonymously();
if (auth.error && /fetch failed|network|ENOTFOUND|ECONN/i.test(auth.error.message)) {
  fail(`Supabase 에 접속하지 못했어요: ${auth.error.message}`, ".env 의 VITE_SUPABASE_URL 주소와 인터넷 연결을 확인해 주세요 (주소 끝의 /rest/v1/ 은 빼요)");
}
if (auth.error) {
  fail(`익명 로그인 실패: ${auth.error.message}`, "README 2단계: Authentication > Sign In / Providers 에서 Anonymous sign-ins 를 켜주세요");
}
ok("익명 로그인");

for (const table of ["lanterns", "warmth"]) {
  const { error } = await supabase.from(table).select("*", { head: true, count: "exact" });
  if (error) fail(`${table} 테이블 읽기 실패: ${error.message}`, "README 3단계: SQL Editor 에서 supabase/schema.sql 을 실행해주세요");
  ok(`${table} 테이블 읽기`);
}

const status = await new Promise((resolve) => {
  const ch = supabase
    .channel("check")
    .on("postgres_changes", { event: "*", schema: "public", table: "lanterns" }, () => {})
    .subscribe((s) => {
      if (s !== "SUBSCRIBED" && s !== "CHANNEL_ERROR" && s !== "TIMED_OUT") return;
      supabase.removeChannel(ch);
      resolve(s);
    });
  setTimeout(() => resolve("TIMED_OUT"), 10000);
});
if (status !== "SUBSCRIBED") fail(`Realtime 구독 실패 (${status})`, "schema.sql 마지막 '실시간 반영' 부분이 실행됐는지 확인해주세요");
ok("Realtime 구독");

// 확인용으로 만든 익명 사용자는 로그아웃만 해요 (대시보드 Authentication > Users 에서 지울 수 있어요)
await supabase.auth.signOut();
console.log("\n연결 완료! npm run dev 로 실행해보세요.");
process.exit(0);
