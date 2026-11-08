// 숫자 세기: 어떤 행동이 몇 번 일어났는지만 Supabase events 에 남겨요.
// 이름, 일기, 사진 같은 내용은 절대 넣지 않아요. 실패해도 화면에는 아무 영향이 없어요.
import { configured, supabase } from "./supabase";

export type EventName =
  | "visit" | "story_end" | "form_open" | "lantern_created" | "note_written" | "warmth_sent"
  | "share_click" | "clip_made" | "photo_added" | "feedback_sent";

let ready = false;
const queue: { name: EventName; props: Record<string, string | number | boolean> }[] = [];
let via = "";

/** 어디서 왔는지: 공유 링크, 글 페이지, utm_source, 검색 사이트 이름 */
export function detectVia() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("l")) return "share";
    if (q.get("for") === "pet") return "rainbow";
    if (q.get("start") || q.get("end")) return "discharge";
    const utm = q.get("utm_source");
    if (utm) return utm.slice(0, 60);
    const ref = document.referrer ? new URL(document.referrer).hostname : "";
    if (!ref || ref === location.hostname) return "";
    return ref.replace(/^www\./, "").replace(/^m\./, "").slice(0, 60);
  } catch {
    return "";
  }
}
via = typeof location !== "undefined" ? detectVia() : "";

function send(name: EventName, props: Record<string, string | number | boolean>) {
  void supabase.from("events").insert({ name, props, via }).then(() => undefined, () => undefined);
}

/** 익명 로그인이 끝난 뒤 불러요. 그 전에 쌓인 것도 이때 보내요. */
export function trackReady() {
  if (!configured || ready) return;
  ready = true;
  // 같은 탭에서 새로고침할 때마다 방문을 세지 않게, 탭마다 한 번만
  let first = true;
  try {
    first = !sessionStorage.getItem("harbor-visit");
    sessionStorage.setItem("harbor-visit", "1");
  } catch {
    /* 그냥 세요 */
  }
  if (first) send("visit", {});
  queue.splice(0).forEach((e) => send(e.name, e.props));
}

export function track(name: EventName, props: Record<string, string | number | boolean> = {}) {
  if (!configured) return; // 체험 모드는 세지 않아요
  if (!ready) queue.push({ name, props });
  else send(name, props);
}
