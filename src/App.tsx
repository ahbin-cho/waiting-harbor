import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { Focus } from "./components/Village3D";
// 3D 마을(three.js)은 무거워서 화면이 먼저 뜬 뒤에 따로 불러와요. 첫 화면이 빨라지고 검색 점수(속도)에도 좋아요.
const Village3D = lazy(() => import("./components/Village3D").then((m) => ({ default: m.Village3D })));
import { PLACES, neighbors, placeOf } from "./lib/places";
import { COLORS, colorOf } from "./lib/looks";
import type { ShrineInfo } from "./three/shrine";
import { LanternDetail } from "./components/LanternDetail";
import { LanternForm } from "./components/LanternForm";
import { Sheet } from "./components/Sheet";
import { Story } from "./components/Story";
import { Feedback } from "./components/Feedback";
import { ShareSheet } from "./components/ShareSheet";
import { STORY, markStorySeen, storySeen, type Shot } from "./lib/story";
import { KINDS, pick } from "./lib/waiting";
import { THEME_LABEL, THEME_ORDER, applyUiTheme, saveTheme, savedTheme, type ThemeChoice } from "./lib/theme";
import { MAX_LANTERNS, demo, useHarbor } from "./hooks/useHarbor";
import { badgeText, titleOf } from "./lib/waiting";
import { canRecord } from "./lib/clip";
import { track } from "./lib/track";

// form 에 id 가 있으면 그 등불을 고쳐요, 없으면 새 등불을 걸어요. mine 은 내 등불 목록.
type View = { type: "none" } | { type: "detail"; id: string } | { type: "form"; id?: string } | { type: "mine" } | { type: "feedback" } | { type: "clip"; id: string } | { type: "share"; id: string };

export default function App() {
  const [view, setView] = useState<View>({ type: "none" });
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [hint, setHint] = useState(
    demo ? "체험 모드라 걸어 둔 등불은 새로고침하면 사라져요." : "불빛을 누르면 그 사람의 기다림이 보여요.",
  );
  // 공유 링크(/l/아이디)로 들어오면 ?l=아이디 로 열려요. 이야기는 건너뛰고 그 등불로 바로 가요.
  // /?l=아이디 또는 /l/아이디 (서버 함수를 거치지 않고 앱이 바로 열린 경우) 둘 다 알아봐요
  const [deepLink, setDeepLink] = useState(
    () => new URLSearchParams(location.search).get("l") ?? location.pathname.match(/^\/l\/([0-9a-f-]{36})\/?$/i)?.[1] ?? null,
  );
  // 전역일 계산기에서 "이 날을 기다리는 등불 걸기"로 오면 날짜가 채워진 채로 등불 걸기가 열려요
  const [preset, setPreset] = useState(() => {
    const q = new URLSearchParams(location.search);
    const ok = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
    const start_date = ok(q.get("start")), end_date = ok(q.get("end"));
    // 무지개마을 소개 페이지에서 오면 "반려동물 그리워하기"로 바로 열려요
    if (q.get("for") === "pet") return { mode: "miss", kind: "반려동물" } as { mode: string; kind: string; start_date?: string; end_date?: string };
    return end_date ? { start_date, end_date, kind: (KINDS as readonly string[]).includes(q.get("kind") ?? "") ? q.get("kind")! : undefined } : null;
  });
  const [story, setStory] = useState<number | null>(() => (storySeen() || deepLink || preset ? null : 0));
  const [shot, setShot] = useState<{ name: Shot; n: number } | null>(null);
  // 테마: 밤 / 노을
  const [theme, setTheme] = useState<ThemeChoice>(() => savedTheme());
  useEffect(() => applyUiTheme(theme), [theme]);
  const chooseTheme = (c: ThemeChoice) => {
    setTheme(c);
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
    const go = (id: string) => {
      setView({ type: "detail", id });
      history.replaceState(null, "", "/");
      setDeepLink(null);
    };
    if (h.lanterns.some((l) => l.id === deepLink)) return go(deepLink);
    // 목록에 아직 없으면 그 등불 하나만 따로 불러와요
    h.fetchLantern(deepLink).then((l) => {
      if (l) go(l.id);
      else {
        setHint("그 등불은 이미 내려졌어요.");
        history.replaceState(null, "", "/");
        setDeepLink(null);
      }
    });
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
  // 열린 등불의 자리 번호와 앞뒤 등불, 곁에 놓일 작은 자리
  const nav = picked ? neighbors(h.lanterns, picked.id) : null;
  const shrine: ShrineInfo | null = picked
    ? {
        id: picked.id,
        who: picked.who.trim() || "그 사람",
        line: picked.line ?? "",
        no: nav?.no ?? placeOf(picked.place),
        photo: h.photoUrls[picked.id],
        count: h.warmthCount.get(picked.id) ?? 0,
        color: COLORS[colorOf(picked.color)],
      }
    : null;
  // 새 등불 걸기를 연 순간을 세요 (고치기는 빼고)
  const formNew = view.type === "form" && !view.id;
  useEffect(() => {
    if (formNew) track("form_open");
  }, [formNew]);

  // 10초 영상: 찍는 동안엔 화면의 글자와 시트를 숨기고, 다 찍으면 미리보기를 띄워요
  const [record, setRecord] = useState<{ id: string; n: number; text: { title: string; sub: string; line: string } } | null>(null);
  const [clip, setClip] = useState<{ url: string; file: File } | { error: string } | null>(null);
  const startRecord = (id: string) => {
    const l = h.lanterns.find((x) => x.id === id);
    if (!l) return;
    if (clip && "url" in clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    const where = l.place === "무지개" ? "무지개마을" : l.mode === "miss" ? "하늘" : l.place;
    setRecord({ id, n: Date.now(), text: { title: titleOf(l), sub: `${badgeText(l)} · ${where}`, line: l.line } });
    setView({ type: "clip", id });
  };
  const recording = record != null && clip == null;
  const editing = view.type === "form" && view.id ? h.lanterns.find((l) => l.id === view.id) : undefined;
  const close = useCallback(() => setView({ type: "none" }), []);
  const endStory = useCallback((then: "write" | "look") => {
    track("story_end", { then });
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
    <div className={`scene${view.type === "detail" || story != null || recording ? " focusing" : ""}${recording ? " recording" : ""}`}>
      <Suspense fallback={null}>
      <Village3D lanterns={h.lanterns} me={h.me} online={h.online} pulseId={pulseId} focus={focus} shot={shot} selectedId={view.type === "detail" ? view.id : null} shrine={shrine} onPick={(id) => !recording && setView({ type: "detail", id })} theme={theme}
        record={record}
        onClip={(r) => {
          if ("blob" in r) {
            track("clip_made", { ext: r.ext });
            const l = h.lanterns.find((x) => x.id === record?.id);
            const name = `기다림항구-${l?.who ?? "등불"}.${r.ext}`;
            setClip({ url: URL.createObjectURL(r.blob), file: new File([r.blob], name, { type: r.blob.type }) });
          } else setClip(r);
        }} />
      </Suspense>
      {recording && <p className="rec-note" role="status">영상을 만들고 있어요. 10초만 기다려 주세요.</p>}

      <header>
        <div className="title-row">
          <h1>기다림 항구</h1>
          <div className="title-tools">
            <span className="theme-switch" role="group" aria-label="테마">
              {THEME_ORDER.map((c) => (
                <button key={c} className="text-btn" aria-pressed={theme === c} onClick={() => chooseTheme(c)}>{THEME_LABEL[c]}</button>
              ))}
            </span>
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

      <Sheet open={view.type !== "none" && !recording} onClose={close} labelledBy="sheet-title">
        {view.type === "form" && (
          <LanternForm
            key={view.id ?? "new"}
            initial={editing}
            preset={preset ?? undefined}
            onSave={async (v) => {
              const saved = await h.saveLantern(v, editing?.id);
              if (!editing) {
                track("lantern_created", { mode: v.mode, place: v.place, ...(v.species ? { species: v.species } : {}), count: mine.length + 1 });
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
            me={h.me}
            no={nav?.no}
            onPrev={nav && nav.total > 1 ? () => setView({ type: "detail", id: nav.prev }) : undefined}
            onNext={nav && nav.total > 1 ? () => setView({ type: "detail", id: nav.next }) : undefined}
            messages={h.messages[picked.id]}
            onLoadMessages={() => h.loadMessages(picked.id)}
            onAddMessage={(body) => h.addMessage(picked.id, body)}
            onRemoveMessage={(id) => h.removeMessage(picked.id, id)}
            onWarm={async () => {
              await h.sendWarmth(picked.id);
              pulse(picked.id);
            }}
            onEdit={() => setView({ type: "form", id: picked.id })}
            onShare={() => setView({ type: "share", id: picked.id })}
            onRecord={canRecord() ? () => startRecord(picked.id) : undefined}
            photoUrl={h.photoUrls[picked.id]}
            onLoadPhoto={() => h.loadPhoto(picked)}
            onPhoto={(blob, open) => h.setPhoto(picked, blob, open)}
            onPhotoPublic={(open) => h.setPhotoPublic(picked, open)}
            onClose={close}
          />
        )}
        {view.type === "clip" && clip && (
          <>
            <h2 id="sheet-title" className="ask">10초 영상이 만들어졌어요</h2>
            {"error" in clip ? (
              <p className="err">{clip.error}</p>
            ) : (
              <>
                <video className="clip" src={clip.url} autoPlay loop muted playsInline controls />
                <p className="small">인스타 스토리나 릴스에 올리기 좋은 세로 영상이에요.</p>
                <div className="row">
                  <button
                    className="btn"
                    onClick={async () => {
                      const files = [clip.file];
                      if (navigator.canShare?.({ files })) {
                        try {
                          await navigator.share({ files, title: "기다림 항구" });
                          return;
                        } catch (e) {
                          if ((e as Error).name === "AbortError") return;
                        }
                      }
                      const a = document.createElement("a");
                      a.href = clip.url;
                      a.download = clip.file.name;
                      a.click();
                    }}
                  >
                    저장하거나 보내기
                  </button>
                  <button className="ghost" onClick={() => startRecord(view.id)}>다시 찍기</button>
                  <button className="ghost" onClick={() => setView({ type: "detail", id: view.id })}>돌아가기</button>
                </div>
              </>
            )}
          </>
        )}
        {view.type === "share" && (() => {
          const l = h.lanterns.find((x) => x.id === view.id);
          return l ? <ShareSheet lantern={l} demo={demo} onBack={() => setView({ type: "detail", id: l.id })} /> : null;
        })()}
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
