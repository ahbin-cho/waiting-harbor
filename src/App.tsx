import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { Focus } from "./components/Village3D";
// 3D 마을(three.js)은 무거워서 화면이 먼저 뜬 뒤에 따로 불러와요. 첫 화면이 빨라지고 검색 점수(속도)에도 좋아요.
const Village3D = lazy(() => import("./components/Village3D").then((m) => ({ default: m.Village3D })));
import { PLACE_LABEL, WORLD_NAME, WORLD_PLACES, neighbors, placeOf, worldOf, type World } from "./lib/places";
import { COLORS, colorOf } from "./lib/looks";
import type { ShrineInfo } from "./three/shrine";
import { dailyWord, type DailyWord } from "./lib/daily";
import { branchOf } from "./lib/branches";
import { daysLeft, fliesHome, isMiss, parseDate, progressOf, today as todayDate, ymd as ymdOf } from "./lib/waiting";
import { LanternDetail } from "./components/LanternDetail";
import { LanternForm } from "./components/LanternForm";
import { Sheet } from "./components/Sheet";
import { Story } from "./components/Story";
import { Feedback } from "./components/Feedback";
import { ShareSheet } from "./components/ShareSheet";
import { TalkSheet } from "./components/TalkSheet";
import { ArrivalBoard } from "./components/ArrivalBoard";
import { STORY, markStorySeen, storySeen, type Shot } from "./lib/story";
import { KINDS, pick } from "./lib/waiting";
import { THEME_LABEL, THEME_ORDER, applyUiTheme, saveTheme, savedTheme, type ThemeChoice } from "./lib/theme";
import { MAX_LANTERNS, demo, useHarbor } from "./hooks/useHarbor";
import { badgeText, titleOf } from "./lib/waiting";
import { canRecord } from "./lib/clip";
import { track } from "./lib/track";

// form 에 id 가 있으면 그 등불을 고쳐요, 없으면 새 등불을 걸어요. mine 은 내 등불 목록.
type View = { type: "none" } | { type: "detail"; id: string } | { type: "form"; id?: string } | { type: "mine" } | { type: "feedback" } | { type: "clip"; id: string } | { type: "share"; id: string } | { type: "talk"; id: string } | { type: "tools" } | { type: "arrivals" };

export default function App() {
  const [view, setView] = useState<View>({ type: "none" });
  const [pulseId, setPulseId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus | null>(null);
  // 바닥 한 줄 안내. 따로 알릴 게 없으면 지금 있는 곳(기다림 항구/추모관)에 맞는 말을 보여요.
  const [hint, setHint] = useState<string | null>(null);
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
    // 무지개마을 소개·49재 계산기에서 오면 그리움 등불 걸기로 바로 열려요 (떠난 날이 있으면 채워서)
    if (q.get("for") === "pet" || q.get("for") === "miss")
      return { mode: "miss", kind: q.get("for") === "pet" ? "반려동물" : "가족", ...(end_date ? { end_date } : {}) } as { mode: string; kind: string; start_date?: string; end_date?: string };
    return end_date ? { start_date, end_date, kind: (KINDS as readonly string[]).includes(q.get("kind") ?? "") ? q.get("kind")! : undefined } : null;
  });
  const [story, setStory] = useState<number | null>(() => (storySeen() || deepLink || preset ? null : 0));
  // 기다림 항구 / 추모관: 마지막에 있던 곳을 기억해요. 반려동물 소개 글에서 오면 추모관으로.
  const [world, setWorldState] = useState<World>(() => {
    if (preset && "mode" in preset && preset.mode === "miss") return "miss";
    try {
      return localStorage.getItem("harbor.world") === "miss" ? "miss" : "wait";
    } catch {
      return "wait";
    }
  });
  useEffect(() => setWorldForTheme(story != null ? "wait" : world), [world, story]);
  const setWorld = useCallback((w: World) => {
    setWorldState(w);
    try {
      localStorage.setItem("harbor.world", w);
    } catch {
      /* 저장 못 해도 괜찮아요 */
    }
  }, []);
  const [shot, setShot] = useState<{ name: Shot; n: number } | null>(null);
  // 테마: 밤 / 노을
  const [theme, setTheme] = useState<ThemeChoice>(() => savedTheme());
  // 추모관은 늘 포근한 낮(haven), 기다림 항구는 고른 테마(밤/노을)
  const [worldForTheme, setWorldForTheme] = useState<"wait" | "miss">("wait");
  const sceneTheme = worldForTheme === "miss" ? "haven" : theme;
  useEffect(() => applyUiTheme(sceneTheme), [sceneTheme]);
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

  // 하루 한마디: 어제 다녀간 흔적과 함께, 내 등불에 하루 한 번 건네는 말
  const dayStr = ymdOf(todayDate());
  const warmYesterday = (() => {
    const y = todayDate();
    y.setDate(y.getDate() - 1);
    const ys = ymdOf(y), m = new Map<string, number>();
    for (const w of h.warmth) if (w.day === ys) m.set(w.to_id, (m.get(w.to_id) ?? 0) + 1);
    return m;
  })();
  const wordFor = (l: (typeof mine)[number]): DailyWord =>
    dailyWord(l, { warmYesterday: warmYesterday.get(l.id) ?? 0, offerYesterday: h.offerings.yesterday.get(l.id) ?? 0 }, dayStr);
  const [dailySeen, setDailySeen] = useState(() => {
    try {
      return localStorage.getItem("harbor.daily") ?? "";
    } catch {
      return "";
    }
  });
  const seeDaily = () => {
    setDailySeen(dayStr);
    try {
      localStorage.setItem("harbor.daily", dayStr);
    } catch {
      /* 저장 못 해도 괜찮아요 */
    }
  };
  // 등불이 여럿이면 날마다 돌아가며 하나씩
  const dailyLantern = mine.length ? mine[Number(dayStr.replace(/-/g, "")) % mine.length] : undefined;
  const daily = h.status === "ready" && dailyLantern && dailySeen !== dayStr && story == null && view.type === "none" && !preset ? wordFor(dailyLantern) : null;
  const full = mine.length >= MAX_LANTERNS;
  const openMine = () => setView(mine.length === 1 ? { type: "detail", id: mine[0].id } : { type: "mine" });

  useEffect(() => {
    if (!deepLink || h.status !== "ready") return;
    const go = (id: string) => {
      setInvitedId(id);
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
  // 시트를 닫아도 그 등불 곁에 머물러요: 카메라와 작은 자리는 그대로, 아래 시트만 닫혀요.
  // 다른 장소나 전체로 옮겨 갈 때 놓아줘요.
  const [kept, setKept] = useState<string | null>(null);
  // 누가 보내 준 링크로 연 등불: 온기를 보내 달라고, 그다음엔 등불을 걸어 보라고 알려 줘요
  const [invitedId, setInvitedId] = useState<string | null>(null);
  useEffect(() => setKept(null), [focus, story]);
  // 상세·이야기하기·보내기 중에는 그 등불에 머물러요. 닫으면 마지막에 본 등불 곁에 그대로 남아요.
  const viewId = view.type === "detail" || view.type === "talk" || view.type === "share" ? view.id : null;
  useEffect(() => {
    if (viewId) setKept(viewId);
  }, [viewId]);
  const focusId = viewId ?? kept;
  const focused = focusId ? h.lanterns.find((l) => l.id === focusId) : undefined;
  // 등불을 열면 그 등불이 있는 곳으로 (공유 링크로 들어온 그리움 등불이면 추모관)
  const pickedWorld = picked ? worldOf(picked) : null;
  useEffect(() => {
    if (pickedWorld && pickedWorld !== world) setWorld(pickedWorld);
  }, [pickedWorld, world, setWorld]);
  const here = h.lanterns.filter((l) => worldOf(l) === world);
  // 열린 등불의 자리 번호와 앞뒤 등불, 곁에 놓일 작은 자리
  const nav = picked ? neighbors(h.lanterns, picked.id) : null;
  const shrine: ShrineInfo | null = focused
    ? {
        id: focused.id,
        who: focused.who.trim() || "그 사람",
        line: focused.line ?? "",
        no: neighbors(h.lanterns, focused.id)?.no ?? placeOf(focused.place),
        photo: h.photoUrls[focused.id],
        count: h.warmthCount.get(focused.id) ?? 0,
        color: COLORS[colorOf(focused.color)],
        offerings: h.offerings.counts.get(focused.id),
        pet: placeOf(focused.place) === "무지개",
        wait: isMiss(focused) ? undefined : (() => {
          const n = daysLeft(focused);
          const d = parseDate(focused.end_date);
          const date = d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : "";
          return {
            dday: n == null ? "" : n > 0 ? `D-${n}` : n === 0 ? "오늘!" : "만났어요",
            arrive: focused.kind === "군대" && focused.branch
              ? `${date} 전역${n != null && n < 0 ? "" : " 예정"} · ${focused.branch}`
              : n != null && n < 0 ? `${date} 도착 · ${focused.kind}` : `${date} 도착 예정 · ${focused.kind}`,
            pct: progressOf(focused),
            arrived: n != null && n <= 0,
            mode: fliesHome(focused.kind) ? ("plane" as const) : ("ship" as const),
            branch: (() => {
              const b = focused.kind === "군대" ? branchOf(focused.branch) : undefined;
              return b ? { name: b.name, color: b.color, accent: b.accent, vehicle: b.vehicle } : undefined;
            })(),
          };
        })(),
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
  const close = useCallback(() => {
    setView((v) => {
      if (v.type === "detail") setKept(v.id);
      return { type: "none" };
    });
  }, []);
  const endStory = useCallback((then: "write" | "look") => {
    track("story_end", { then });
    markStorySeen();
    setStory(null);
    setFocus({ place: "all", n: Date.now() });
    if (then === "write") setView({ type: "form" });
  }, []);

  // 배가 항구에 닿았어요: 마을이 그려지고 등불을 불러오면 로딩 화면을 걷어요
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => {
    if (!sceneReady || h.status === "loading") return;
    const el = document.getElementById("arrive");
    if (!el) return;
    el.classList.add("docked");
    const t = setTimeout(() => el.remove(), 800);
    return () => clearTimeout(t);
  }, [sceneReady, h.status]);

  // 추모관 안내: 떠나보낸 사람(아이)과 이야기할 수 있다는 걸 처음 몇 번 알려요
  const [talkTip, setTalkTip] = useState(false);
  const showTalkTip = useCallback(() => {
    let n = 0;
    try {
      n = Number(localStorage.getItem("harbor.talktip") ?? 0);
      if (n >= 3) return;
      localStorage.setItem("harbor.talktip", String(n + 1));
    } catch {
      /* 저장이 막혀 있으면 그냥 보여줘요 */
    }
    setTalkTip(true);
  }, []);
  useEffect(() => {
    if (!talkTip) return;
    const t = setTimeout(() => setTalkTip(false), 9000);
    return () => clearTimeout(t);
  }, [talkTip]);
  // 처음부터 추모관으로 들어온 사람(공유 링크, 반려동물 소개 글)에게도
  useEffect(() => {
    if (world === "miss" && h.status === "ready" && story == null) showTalkTip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.status]);
  const myMiss = mine.find((l) => l.mode === "miss");

  const empty =
    h.status === "unconfigured" ? "Supabase 설정이 아직 없어요. README의 1~3단계를 따라 .env 파일을 만들어주세요."
    : h.status === "error" ? "항구에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해주세요."
    : h.status === "loading" ? "등불을 불러오는 중이에요."
    : world === "miss"
      ? "아직 띄운 등불이 없어요. 떠나보낸 사람이나 아이를 위해 첫 등불을 띄워 주세요."
      : "아직 걸린 등불이 없어요. 첫 등불을 걸어 주세요.";

  return (
    <div className={`scene${view.type === "detail" || story != null || recording ? " focusing" : ""}${recording ? " recording" : ""}`}>
      <Suspense fallback={null}>
      <Village3D lanterns={h.lanterns} me={h.me} online={h.online} pulseId={pulseId} focus={focus} shot={shot} selectedId={focusId} shrine={shrine} offerings={h.offerings.counts} cover={view.type === "detail" && !recording ? 0.52 : 0} onPick={(id) => !recording && setView({ type: "detail", id })} theme={sceneTheme} world={story != null ? "all" : world} onReady={() => setSceneReady(true)}
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
            {world === "wait" && <span className="theme-switch" role="group" aria-label="테마">
              {THEME_ORDER.map((c) => (
                <button key={c} className="text-btn" aria-pressed={theme === c} onClick={() => chooseTheme(c)}>{THEME_LABEL[c]}</button>
              ))}
            </span>}
            <button className="text-btn" onClick={() => setStory(0)}>이야기</button>
            <button className="text-btn" onClick={() => setView({ type: "tools" })}>계산기</button>
            <button className="text-btn" onClick={() => setView({ type: "feedback" })}>의견</button>
          </div>
        </div>
        <div className="worlds" role="group" aria-label="기다림 항구와 추모관">
          {(["wait", "miss"] as const).map((w) => (
            <button
              key={w}
              aria-pressed={world === w}
              onClick={() => {
                if (w === world) return;
                setWorld(w);
                if (w === "miss") showTalkTip();
                if (view.type === "detail") close();
                setFocus({ place: "all", n: Date.now() });
              }}
            >
              {WORLD_NAME[w]}
            </button>
          ))}
        </div>
        <p className="stats">
          {world === "wait"
            ? <>기다림 등불 {here.length}개, 지금 {h.hereCount}명이 깨어 있어요. <button className="text-btn stats-link" onClick={() => setView({ type: "arrivals" })}>도착 안내판</button></>
            : `풍등 ${here.filter((l) => placeOf(l.place) !== "무지개").length}개, 무지개마을 아이 ${here.filter((l) => placeOf(l.place) === "무지개").length}명. 지금 ${h.hereCount}명이 함께 있어요.`}
        </p>
        <nav className="places" aria-label="장소로 이동">
          <button className="place" onClick={() => setFocus({ place: "all", n: Date.now() })}>전체</button>
          {WORLD_PLACES[world].map((p) => (
            <button key={p} className="place" onClick={() => setFocus({ place: p, n: Date.now() })}>
              {PLACE_LABEL[p]} <small>{h.lanterns.filter((l) => placeOf(l.place) === p).length}</small>
            </button>
          ))}
        </nav>
      </header>
      {h.status !== "ready" || !here.length ? <p className="empty">{empty}</p> : null}

      {talkTip && world === "miss" && view.type === "none" && story == null && (
        <aside className="daily talk-tip" role="status">
          <p className="daily-from">추모관에서는</p>
          <p className="daily-text">
            {myMiss
              ? `${myMiss.who}에게 말을 걸 수 있어요. 고른 말에 ${myMiss.who}의 마음을 빌린 짧은 답장이 와요.`
              : "떠나보낸 사람이나 아이의 풍등을 띄우면, 말을 걸고 짧은 답장을 받을 수 있어요."}
          </p>
          <div className="daily-tools">
            {myMiss ? (
              <button className="btn" onClick={() => (setTalkTip(false), setView({ type: "talk", id: myMiss.id }))}>말 걸러 가기</button>
            ) : (
              <button className="btn" onClick={() => (setTalkTip(false), setPreset({ mode: "miss", kind: "가족" }), setView({ type: "form" }))}>풍등 띄우기</button>
            )}
            <button className="text-btn" onClick={() => setTalkTip(false)}>닫기</button>
          </div>
        </aside>
      )}
      {daily && !(talkTip && world === "miss") && (
        <aside className="daily" aria-label="하루 한마디">
          <p className="daily-from">{daily.from}</p>
          <p className="daily-text">{daily.text}</p>
          {daily.facts && <p className="daily-facts">{daily.facts}</p>}
          <div className="daily-tools">
            <button
              className="btn"
              onClick={() => {
                seeDaily();
                setView({ type: "detail", id: daily.lanternId });
              }}
            >
              보러 가기
            </button>
            <button className="text-btn" onClick={seeDaily}>닫기</button>
          </div>
        </aside>
      )}
      {/* 상세를 닫고도 그 등불 곁에 머무는 중: 곁의 자리가 남고 아이는 멈춰 있어요. 떠나면 다시 움직여요. */}
      {view.type === "none" && focused && story == null && !recording && (
        <div className="staying" role="status">
          <span>
            <b>{focused.who}</b> 곁에 머무는 중
          </span>
          <button className="text-btn" onClick={() => setView({ type: "detail", id: focused.id })}>다시 보기</button>
          <button className="text-btn" onClick={() => setKept(null)}>떠나기</button>
        </div>
      )}
      <div className="bar">
        <span className="hint">
          {hint ?? (demo ? "체험 모드라 걸어 둔 등불은 새로고침하면 사라져요." : world === "miss" ? "풍등이나 무지개마을 아이를 누르면 그 이야기가 보여요." : "불빛을 누르면 그 사람의 기다림이 보여요.")}
        </span>
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
            preset={preset ?? (world === "miss" && !editing ? { mode: "miss", kind: "가족" } : undefined)}
            onSave={async (v) => {
              const saved = await h.saveLantern(v, editing?.id);
              if (!editing) {
                track("lantern_created", { mode: v.mode, place: v.place, ...(v.species ? { species: v.species } : {}), count: mine.length + 1 });
                // 새 등불이 켜지면 그 앞으로 날아가요
                setHint(
                  v.place === "무지개" ? `${pick(v.who, "이", "가")} 무지개마을에 도착했어요.`
                  : v.mode === "miss" ? `${pick(v.who, "을", "를")} 그리워하는 풍등을 추모관 하늘에 띄웠어요.`
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
            daily={picked.user_id === h.me ? wordFor(picked) : undefined}
            invited={invitedId === picked.id}
            onHang={mine.length === 0 ? () => setView({ type: "form" }) : undefined}
            offerings={h.offerings.counts.get(picked.id)}
            myOffer={h.myOffers[picked.id]}
            onOffer={async (kind) => {
              await h.leaveOffering(picked.id, kind);
              pulse(picked.id);
            }}
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
            onTalk={picked.user_id === h.me && picked.mode === "miss" ? () => setView({ type: "talk", id: picked.id }) : undefined}
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
        {view.type === "talk" && (() => {
          const l = h.lanterns.find((x) => x.id === view.id);
          return l ? (
            <TalkSheet
              lantern={l}
              photoUrl={h.photoUrls[l.id]}
              talks={h.talks[l.id]}
              onLoad={() => h.loadTalks(l.id)}
              onSend={(text, reply) => h.sendTalk(l.id, text, reply)}
              onClear={() => h.clearTalks(l.id)}
              myOffer={h.myOffers[l.id]}
              onOffer={async (k) => {
                await h.leaveOffering(l.id, k);
                pulse(l.id);
              }}
              onBack={() => setView({ type: "detail", id: l.id })}
              onClose={close}
              demo={demo}
            />
          ) : null;
        })()}
        {view.type === "share" && (() => {
          const l = h.lanterns.find((x) => x.id === view.id);
          return l ? <ShareSheet lantern={l} demo={demo} no={neighbors(h.lanterns, l.id)?.no ?? ""} onBack={() => setView({ type: "detail", id: l.id })} /> : null;
        })()}
        {view.type === "arrivals" && <ArrivalBoard lanterns={h.lanterns} me={h.me} onPick={(id) => setView({ type: "detail", id })} onClose={close} />}
        {view.type === "feedback" && <Feedback onSend={h.sendFeedback} onClose={close} demo={demo} />}
        {view.type === "tools" && (
          <>
            <div className="sheet-tools">
              <button className="text-btn" onClick={close}>닫기</button>
            </div>
            <h2 id="sheet-title">날짜 계산기</h2>
            <p className="small">기다리는 날과 기억하는 날을 세어 봐요. 계산한 날짜로 바로 등불을 걸 수 있어요.</p>
            <ul className="tool-list">
              <li>
                <a href="/discharge/">
                  <b>전역일 계산기</b>
                  <span>입대일과 군별로 전역일, D-day, 복무율</span>
                </a>
              </li>
              <li>
                <a href="/ldr/">
                  <b>장거리 연애 디데이·시차 계산기</b>
                  <span>만나는 날, 그 사람의 지금 시간, 통화하기 좋은 시간</span>
                </a>
              </li>
              <li>
                <a href="/memorial/">
                  <b>49재·기일 계산기</b>
                  <span>초재부터 49재, 100일, 1주기 (반려동물도)</span>
                </a>
              </li>
              <li>
                <a href="/rainbow/">
                  <b>무지개마을 이야기</b>
                  <span>무지개다리 건넌 아이들이 지내는 곳</span>
                </a>
              </li>
            </ul>
          </>
        )}
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
