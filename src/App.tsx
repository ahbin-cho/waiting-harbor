import { useCallback, useEffect, useState } from "react";
import { Village3D, type Focus } from "./components/Village3D";
import { PLACES, placeOf } from "./lib/places";
import { LanternDetail } from "./components/LanternDetail";
import { LanternForm } from "./components/LanternForm";
import { Sheet } from "./components/Sheet";
import { Story } from "./components/Story";
import { Feedback } from "./components/Feedback";
import { STORY, markStorySeen, storySeen, type Shot } from "./lib/story";
import { KINDS, pick } from "./lib/waiting";
import { THEME_LABEL, THEME_ORDER, applyUiTheme, resolveTheme, saveTheme, savedTheme, type ThemeChoice } from "./lib/theme";
import { MAX_LANTERNS, demo, useHarbor } from "./hooks/useHarbor";
import { badgeText, titleOf } from "./lib/waiting";

// form 에 id 가 있으면 그 등불을 고쳐요, 없으면 새 등불을 걸어요. mine 은 내 등불 목록.
type View = { type: "none" } | { type: "detail"; id: string } | { type: "form"; id?: string } | { type: "mine" } | { type: "feedback" };

export default function App() {
  const [view, setView] = useState<View>({ type: "none" });
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [hint, setHint] = useState(
    demo ? "체험 모드라 걸어 둔 등불은 새로고침하면 사라져요." : "불빛을 누르면 그 사람의 기다림이 보여요.",
  );
  // 공유 링크(/l/아이디)로 들어오면 ?l=아이디 로 열려요. 이야기는 건너뛰고 그 등불로 바로 가요.
  const [deepLink, setDeepLink] = useState(() => new URLSearchParams(location.search).get("l"));
  // 전역일 계산기에서 "이 날을 기다리는 등불 걸기"로 오면 날짜가 채워진 채로 등불 걸기가 열려요
  const [preset, setPreset] = useState(() => {
    const q = new URLSearchParams(location.search);
    const ok = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
    const start_date = ok(q.get("start")), end_date = ok(q.get("end"));
    return end_date ? { start_date, end_date, kind: (KINDS as readonly string[]).includes(q.get("kind") ?? "") ? q.get("kind")! : undefined } : null;
  });
  const [story, setStory] = useState<number | null>(() => (storySeen() || deepLink || preset ? null : 0));
  const [shot, setShot] = useState<{ name: Shot; n: number } | null>(null);
  // 테마: 밤 / 새벽 / 시간 따라. 시간 따라는 10분마다 다시 확인해요.
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() => savedTheme());
  const [clock, setClock] = useState(() => new Date().getHours());
  const theme = resolveTheme(themeChoice, clock);
  useEffect(() => applyUiTheme(theme), [theme]);
  useEffect(() => {
    if (themeChoice !== "auto") return;
    const t = setInterval(() => setClock(new Date().getHours()), 600_000);
    return () => clearInterval(t);
  }, [themeChoice]);
  const nextTheme = () => {
    const c = THEME_ORDER[(THEME_ORDER.indexOf(themeChoice) + 1) % THEME_ORDER.length];
    setThemeChoice(c);
    saveTheme(c);
  };
  useEffect(() => {
    if (story != null) setShot({ name: STORY[story].shot, n: Date.now() });
  }, [story]);

  const pulse = useCallback((id: string) => {
    setPulseId(null);
    requestAnimationFrame(() => setPulseId(id));
    setTimeout(() => setPulseId((p) => (p === id ? null : p)), 1300);
  }, []);

  const h = useHarbor((lanternId) => {
    setHint("방금 누군가 당신의 등불에 온기를 보냈어요.");
    pulse(lanternId);
  });

  // 한 사람이 등불을 여러 개 걸 수 있어요 (기다리는 사람, 그리워하는 사람, 무지개마을의 아이…)
  const mine = h.lanterns.filter((l) => l.user_id === h.me);
  const full = mine.length >= MAX_LANTERNS;
  const openMine = () => setView(mine.length === 1 ? { type: "detail", id: mine[0].id } : { type: "mine" });

  useEffect(() => {
    if (!deepLink || h.status !== "ready") return;
    const found = h.lanterns.some((l) => l.id === deepLink);
    if (found) setView({ type: "detail", id: deepLink });
    else setHint("그 등불은 이미 내려졌어요.");
    history.replaceState(null, "", location.pathname);
    setDeepLink(null);
  }, [deepLink, h.status, h.lanterns]);

  useEffect(() => {
    if (!preset || h.status !== "ready") return;
    history.replaceState(null, "", location.pathname);
    // 새 등불 걸기를 날짜가 채워진 채로 열어요 (자리가 꽉 찼으면 내 등불 목록)
    setView(full ? { type: "mine" } : { type: "form" });
    if (full) setPreset(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, h.status]);
  const picked = view.type === "detail" ? h.lanterns.find((l) => l.id === view.id) : undefined;
  const editing = view.type === "form" && view.id ? h.lanterns.find((l) => l.id === view.id) : undefined;
  const close = useCallback(() => setView({ type: "none" }), []);
  const endStory = useCallback((then: "write" | "look") => {
    markStorySeen();
    setStory(null);
    setFocus({ place: "all", n: Date.now() });
    if (then === "write") setView({ type: "form" });
  }, []);

  const empty =
    h.status === "unconfigured" ? "Supabase 설정이 아직 없어요. README의 1~3단계를 따라 .env 파일을 만들어주세요."
    : h.status === "error" ? "항구에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해주세요."
    : h.status === "loading" ? "등불을 불러오는 중이에요."
    : "아직 걸린 등불이 없어요. 첫 등불을 걸어 주세요.";

  return (
    <div className={`scene${view.type === "detail" || story != null ? " focusing" : ""}`}>
      <Village3D lanterns={h.lanterns} me={h.me} online={h.online} pulseId={pulseId} focus={focus} shot={shot} selectedId={view.type === "detail" ? view.id : null} onPick={(id) => setView({ type: "detail", id })} theme={theme} />

      <header>
        <div className="title-row">
          <h1>기다림 항구</h1>
          <div className="title-tools">
            <button className="text-btn" onClick={nextTheme} aria-label={`테마 바꾸기. 지금은 ${THEME_LABEL[themeChoice]}`}>{THEME_LABEL[themeChoice]}</button>
            <button className="text-btn" onClick={() => setStory(0)}>이야기</button>
            <button className="text-btn" onClick={() => setView({ type: "feedback" })}>의견</button>
          </div>
        </div>
        <p className="stats">등불 {h.lanterns.length}개, 지금 {h.hereCount}명이 깨어 있어요.</p>
        <nav className="places" aria-label="장소로 이동">
          <button className="place" onClick={() => setFocus({ place: "all", n: Date.now() })}>전체</button>
          {PLACES.map((p) => (
            <button key={p} className="place" onClick={() => setFocus({ place: p, n: Date.now() })}>
              {p} <small>{h.lanterns.filter((l) => placeOf(l.place) === p).length}</small>
            </button>
          ))}
        </nav>
      </header>
      {h.status !== "ready" || !h.lanterns.length ? <p className="empty">{empty}</p> : null}

      <div className="bar">
        <span className="hint">{hint}</span>
        {mine.length > 0 && (
          <button className="ghost bar-ghost" disabled={h.status !== "ready"} onClick={openMine}>
            내 등불 {mine.length > 1 && <small>{mine.length}</small>}
          </button>
        )}
        <button className="btn" disabled={h.status !== "ready"} onClick={() => setView(full ? { type: "mine" } : { type: "form" })}>
          {mine.length ? "하나 더 걸기" : "등불 걸기"}
        </button>
      </div>

      <Sheet open={view.type !== "none"} onClose={close} labelledBy="sheet-title">
        {view.type === "form" && (
          <LanternForm
            key={view.id ?? "new"}
            initial={editing}
            preset={preset ?? undefined}
            onSave={async (v) => {
              const saved = await h.saveLantern(v, editing?.id);
              if (!editing) {
                // 새 등불이 켜지면 그 앞으로 날아가요
                setHint(
                  v.place === "무지개" ? `${pick(v.who, "이", "가")} 무지개마을에 도착했어요.`
                  : v.mode === "miss" ? `${pick(v.who, "을", "를")} 그리워하는 풍등을 하늘에 띄웠어요.`
                  : `${pick(v.who, "을", "를")} 기다리는 등불이 켜졌어요.`,
                );
                const id = saved.id;
                setTimeout(() => {
                  setView({ type: "detail", id });
                  pulse(id);
                }, 350);
              }
            }}
            onRemove={async () => {
              if (editing) await h.removeLantern(editing.id);
            }}
            onClose={() => {
              setPreset(null);
              close();
            }}
          />
        )}
        {view.type === "detail" && picked && (
          <LanternDetail
            lantern={picked}
            isMine={picked.user_id === h.me}
            isHere={h.online.has(picked.user_id)}
            warmth={h.warmthCount.get(picked.id) ?? 0}
            sent={h.sentToday(picked.id)}
            notes={h.notes[picked.id]}
            onLoadNotes={() => h.loadNotes(picked.id)}
            onAddNote={(body, open) => h.addNote(picked.id, body, open)}
            onRemoveNote={(id) => h.removeNote(picked.id, id)}
            onWarm={async () => {
              await h.sendWarmth(picked.id);
              pulse(picked.id);
            }}
            onEdit={() => setView({ type: "form", id: picked.id })}
            canShare={!demo}
            onClose={close}
          />
        )}
        {view.type === "feedback" && <Feedback onSend={h.sendFeedback} onClose={close} demo={demo} />}
        {view.type === "mine" && (
          <>
            <h2 id="sheet-title">내 등불</h2>
            <p className="small">
              {full ? `등불은 한 사람이 ${MAX_LANTERNS}개까지 걸 수 있어요. 새로 걸려면 하나를 내려 주세요.` : `한 사람이 ${MAX_LANTERNS}개까지 걸 수 있어요.`}
            </p>
            <ul className="my-list">
              {mine.map((l) => (
                <li key={l.id}>
                  <button className="choice" onClick={() => setView({ type: "detail", id: l.id })}>
                    <b>{titleOf(l)}</b>
                    <span>{l.place === "무지개" ? "무지개마을" : l.place} · {badgeText(l)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="row">
              {!full && <button className="btn" onClick={() => setView({ type: "form" })}>하나 더 걸기</button>}
              <button className="ghost" onClick={close}>닫기</button>
            </div>
          </>
        )}
      </Sheet>

      {story != null && <Story step={story} onStep={setStory} onDone={endStory} />}
    </div>
  );
}
