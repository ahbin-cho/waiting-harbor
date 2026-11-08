import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { configured, supabase, type Lantern, type Message, type Note, type OfferingCount, type Warmth } from "../lib/supabase";
import { today, ymd } from "../lib/waiting";
import { track, trackReady } from "../lib/track";
import { isOffering, type OfferingKind } from "../lib/offerings";
import { templateReply, type Talk } from "../lib/talk";
import { speciesOf } from "../lib/pets";
import { DEMO_ME, demoLanterns, demoMessages, demoMissing, demoNotes, demoOfferings, demoOnline, demoWarmth } from "../lib/demo";

/** Supabase 설정이 없으면 체험 모드로 열려요. 아무것도 저장되지 않아요. */
export const demo = !configured;

export type Status = "loading" | "ready" | "error" | "unconfigured";

/** 한 사람이 걸 수 있는 등불 수 (DB 정책에서도 같은 수로 막아요) */
export const MAX_LANTERNS = 5;

type LanternValues = Pick<Lantern, "who" | "kind" | "start_date" | "end_date" | "line" | "place" | "color" | "shape" | "mode" | "species">;

export function useHarbor(onWarmed?: (lanternId: string) => void) {
  const [me, setMe] = useState<string | null>(demo ? DEMO_ME : null);
  const [lanterns, setLanterns] = useState<Lantern[]>(demo ? () => [...demoLanterns(), ...demoMissing()] : []);
  const [warmth, setWarmth] = useState<Warmth[]>(demo ? demoWarmth : []);
  // 놓고 간 것: 등불마다 종류별 수와 어제 놓인 수, 그리고 오늘 내가 놓은 것
  const [offerRows, setOfferRows] = useState<OfferingCount[]>(demo ? demoOfferings : []);
  const [myOffers, setMyOffers] = useState<Record<string, OfferingKind>>({});
  const [online, setOnline] = useState<Set<string>>(demo ? demoOnline : () => new Set());
  const [hereCount, setHereCount] = useState(demo ? 4 : 1);
  const [status, setStatus] = useState<Status>(demo ? "ready" : "loading");
  const lanternsRef = useRef(lanterns);
  lanternsRef.current = lanterns;

  // 1. 로그인: 회원가입 없이 익명으로 들어와요
  useEffect(() => {
    if (!configured) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setMe(data.session.user.id);
        return trackReady();
      }
      const res = await supabase.auth.signInAnonymously();
      if (res.error || !res.data.user) return setStatus("error");
      setMe(res.data.user.id);
      trackReady();
    })();
  }, []);

  // 2. 등불과 온기 불러오기 + 실시간 반영
  useEffect(() => {
    if (!configured || !me) return;
    let alive = true;
    (async () => {
      const [l, w, o, mine] = await Promise.all([
        supabase.from("lanterns").select("*").order("created_at"),
        supabase.from("warmth").select("from_id,to_id,day"),
        supabase.rpc("offering_counts"),
        supabase.from("offerings").select("lantern_id,kind").eq("from_id", me).eq("day", ymd(today())),
      ]);
      if (!alive) return;
      if (l.error || w.error) return setStatus("error");
      setLanterns(l.data as Lantern[]);
      setWarmth(w.data as Warmth[]);
      // 놓고 간 것은 schema 를 아직 다시 실행하지 않았으면 없을 수 있어요. 그래도 마을은 열어요.
      if (!o.error) setOfferRows((o.data as OfferingCount[]).map((r) => ({ ...r, n: Number(r.n), yesterday: Number(r.yesterday) })));
      if (!mine.error) setMyOffers(Object.fromEntries((mine.data as { lantern_id: string; kind: OfferingKind }[]).map((r) => [r.lantern_id, r.kind])));
      setStatus("ready");
    })();

    const db = supabase
      .channel("harbor-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "lanterns" }, (p) => {
        setLanterns((prev) => {
          if (p.eventType === "DELETE") return prev.filter((x) => x.id !== (p.old as Lantern).id);
          const row = p.new as Lantern;
          const rest = prev.filter((x) => x.id !== row.id);
          return [...rest, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "warmth" }, (p) => {
        const row = p.new as Warmth;
        setWarmth((prev) => [...prev, row]);
        // 내 등불 중 하나에 온기가 닿았어요
        if (lanternsRef.current.some((l) => l.id === row.to_id && l.user_id === me)) onWarmed?.(row.to_id);
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(db);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // 3. 지금 항구에 있는 사람 (presence)
  useEffect(() => {
    if (!configured || !me) return;
    const room = supabase.channel("harbor-room", { config: { presence: { key: me } } });
    room
      .on("presence", { event: "sync" }, () => {
        const ids = Object.keys(room.presenceState());
        setOnline(new Set(ids));
        setHereCount(Math.max(1, ids.length));
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") room.track({ at: Date.now() });
      });
    return () => {
      supabase.removeChannel(room);
    };
  }, [me]);

  const warmthCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of warmth) m.set(w.to_id, (m.get(w.to_id) ?? 0) + 1);
    return m;
  }, [warmth]);

  // ---------- 기다림 일기 ----------
  const [notes, setNotes] = useState<Record<string, Note[]>>(() => {
    if (!demo) return {};
    const m: Record<string, Note[]> = {};
    for (const n of demoNotes()) (m[n.lantern_id] ??= []).push(n);
    return m;
  });

  /** 등불을 열 때 그 등불의 일기를 불러와요 (최근 50개) */
  const loadNotes = useCallback(async (lanternId: string) => {
    if (demo) return setNotes((m) => (m[lanternId] ? m : { ...m, [lanternId]: [] }));
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("lantern_id", lanternId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setNotes((m) => ({ ...m, [lanternId]: data as Note[] }));
  }, []);

  const addNote = useCallback(
    async (lanternId: string, body: string, isPublic: boolean) => {
      if (!me) throw new Error("no-user");
      const row = { lantern_id: lanternId, body, public: isPublic, day: ymd(today()) };
      if (demo) {
        const n: Note = { ...row, id: Date.now(), created_at: new Date().toISOString() };
        setNotes((m) => ({ ...m, [lanternId]: [n, ...(m[lanternId] ?? [])] }));
        return;
      }
      const { data, error } = await supabase.from("notes").insert(row).select().single();
      if (error) throw error;
      track("note_written", { public: isPublic });
      setNotes((m) => ({ ...m, [lanternId]: [data as Note, ...(m[lanternId] ?? [])] }));
    },
    [me],
  );

  const removeNote = useCallback(async (lanternId: string, id: number) => {
    if (!demo) {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    }
    setNotes((m) => ({ ...m, [lanternId]: (m[lanternId] ?? []).filter((n) => n.id !== id) }));
  }, []);

  // ---------- 남긴 마음: 다른 사람이 등불 앞에 남기는 응원과 추모의 말 ----------
  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    if (!demo) return {};
    const m: Record<string, Message[]> = {};
    for (const n of demoMessages()) (m[n.lantern_id] ??= []).push(n);
    return m;
  });

  /** 등불을 열 때 남긴 마음을 불러와요 (최근 50개) */
  const loadMessages = useCallback(async (lanternId: string) => {
    if (demo) return setMessages((m) => (m[lanternId] ? m : { ...m, [lanternId]: [] }));
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("lantern_id", lanternId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setMessages((m) => ({ ...m, [lanternId]: data as Message[] }));
  }, []);

  const addMessage = useCallback(
    async (lanternId: string, body: string) => {
      if (!me) throw new Error("no-user");
      if (demo) {
        const n: Message = { id: Date.now(), lantern_id: lanternId, from_id: me, body, created_at: new Date().toISOString() };
        setMessages((m) => ({ ...m, [lanternId]: [n, ...(m[lanternId] ?? [])] }));
        return;
      }
      const { data, error } = await supabase.from("messages").insert({ lantern_id: lanternId, from_id: me, body }).select().single();
      if (error) throw error;
      track("message_left");
      setMessages((m) => ({ ...m, [lanternId]: [data as Message, ...(m[lanternId] ?? [])] }));
    },
    [me],
  );

  const removeMessage = useCallback(async (lanternId: string, id: number) => {
    if (!demo) {
      const { error } = await supabase.from("messages").delete().eq("id", id);
      if (error) throw error;
    }
    setMessages((m) => ({ ...m, [lanternId]: (m[lanternId] ?? []).filter((n) => n.id !== id) }));
  }, []);

  // ---------- 놓고 가는 것 ----------
  /** 등불마다 { 종류: 수 } 와 어제 놓인 수 */
  const offerings = useMemo(() => {
    const counts = new Map<string, Partial<Record<OfferingKind, number>>>();
    const yesterday = new Map<string, number>();
    for (const r of offerRows) {
      if (!isOffering(r.kind)) continue;
      const c = counts.get(r.lantern_id) ?? {};
      c[r.kind] = (c[r.kind] ?? 0) + r.n;
      counts.set(r.lantern_id, c);
      yesterday.set(r.lantern_id, (yesterday.get(r.lantern_id) ?? 0) + r.yesterday);
    }
    return { counts, yesterday };
  }, [offerRows]);

  /** 등불 앞에 오늘 하나를 놓아요 (한 사람이 등불마다 하루 하나) */
  const leaveOffering = useCallback(
    async (lanternId: string, kind: OfferingKind) => {
      if (!me) throw new Error("no-user");
      if (myOffers[lanternId]) return;
      if (!demo) {
        const { error } = await supabase.from("offerings").insert({ lantern_id: lanternId, from_id: me, kind, day: ymd(today()) });
        if (error) throw error;
        track("offering_left", { kind });
      }
      setMyOffers((m) => ({ ...m, [lanternId]: kind }));
      setOfferRows((rows) => [...rows, { lantern_id: lanternId, kind, n: 1, yesterday: 0 }]);
    },
    [me, myOffers],
  );

  const sentToday = useCallback(
    (to: string) => warmth.some((w) => w.from_id === me && w.to_id === to && w.day === ymd(today())),
    [warmth, me],
  );

  /** 새 등불을 걸거나(id 없음), 내 등불 하나를 고쳐요(id 있음). 저장된 등불을 돌려줘요. */
  const saveLantern = useCallback(
    async (v: LanternValues, id?: string): Promise<Lantern> => {
      if (!me) throw new Error("no-user");
      if (demo) {
        const prev = id ? lanterns.find((x) => x.id === id) : undefined;
        const row: Lantern = { id: id ?? `demo-mine-${Date.now()}`, user_id: me, created_at: prev?.created_at ?? new Date().toISOString(), ...v };
        setLanterns((all) => [...all.filter((x) => x.id !== row.id), row]);
        return row;
      }
      const q = id
        ? supabase.from("lanterns").update(v).eq("id", id).select().single()
        : supabase.from("lanterns").insert({ user_id: me, ...v }).select().single();
      const { data, error } = await q;
      if (error) throw error;
      const row = data as Lantern;
      setLanterns((prev) => [...prev.filter((x) => x.id !== row.id), row].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      return row;
    },
    [me, lanterns],
  );

  const removeLantern = useCallback(async (id: string) => {
    if (!demo) {
      // 등불을 내리면 사진 파일도 같이 지워요 (저장 공간이 쌓이지 않게)
      const photo = lanternsRef.current.find((x) => x.id === id)?.photo_path;
      const { error } = await supabase.from("lanterns").delete().eq("id", id);
      if (error) throw error;
      if (photo) await supabase.storage.from("photos").remove([photo]);
    }
    setLanterns((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const sendWarmth = useCallback(
    async (to: string) => {
      if (!me || lanterns.some((l) => l.id === to && l.user_id === me)) return;
      const row = { from_id: me, to_id: to, day: ymd(today()) };
      if (demo) {
        if (!warmth.some((w) => w.from_id === me && w.to_id === to && w.day === row.day)) setWarmth((prev) => [...prev, row]);
        return;
      }
      const { error } = await supabase.from("warmth").insert(row);
      // 23505 = 오늘 이미 보냄. 실패가 아니라 그냥 무시해요.
      if (error && error.code !== "23505") throw error;
      if (!error) track("warmth_sent");
    },
    [me, warmth, lanterns],
  );

  /** 의견 남기기: 서버(/api/feedback)가 저장하고 운영자에게 메일로 보내요 */
  const sendFeedback = useCallback(async (body: string, contact: string, website: string) => {
    if (demo) throw new Error("demo");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ body, contact, website, page: location.pathname }),
    });
    if (!res.ok) throw new Error(res.status === 429 ? "limit" : "failed");
    track("feedback_sent");
  }, []);

  // ---------- 이야기하기 (그리움 등불의 주인만) ----------
  const [talks, setTalks] = useState<Record<string, Talk[]>>({});
  const talksRef = useRef(talks);
  talksRef.current = talks;

  /** 지난 이야기를 불러와요 (최근 100개, 오래된 것부터) */
  const loadTalks = useCallback(async (lanternId: string) => {
    if (demo) return setTalks((m) => (m[lanternId] ? m : { ...m, [lanternId]: [] }));
    const { data, error } = await supabase.from("talks").select("*").eq("lantern_id", lanternId).order("created_at", { ascending: false }).limit(100);
    if (!error) setTalks((m) => ({ ...m, [lanternId]: (data as Talk[]).reverse() }));
  }, []);

  /** 말을 보내면 내 말이 바로 보이고, 답장이 오면 이어 붙어요 */
  const sendTalk = useCallback(
    async (lanternId: string, text: string) => {
      const now = new Date().toISOString();
      const mine: Talk = { id: -Date.now(), lantern_id: lanternId, role: "me", body: text, created_at: now };
      setTalks((m) => ({ ...m, [lanternId]: [...(m[lanternId] ?? []), mine] }));
      let reply: string;
      if (demo) {
        const l = lanternsRef.current.find((x) => x.id === lanternId);
        await new Promise((r) => setTimeout(r, 900));
        const recent = (talksRef.current[lanternId] ?? []).filter((t) => t.role === "them").slice(-4).map((t) => t.body);
        reply = templateReply({ who: l?.who ?? "", isPet: l?.place === "무지개", species: speciesOf(l?.species) }, text, Date.now() >>> 10, recent);
      } else {
        const { data } = await supabase.auth.getSession();
        const res = await fetch("/api/talk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
          body: JSON.stringify({ lanternId, text }),
        });
        if (!res.ok) {
          // 보내지 못한 말은 거둬요
          setTalks((m) => ({ ...m, [lanternId]: (m[lanternId] ?? []).filter((t) => t.id !== mine.id) }));
          throw new Error(res.status === 429 ? "limit" : "failed");
        }
        reply = ((await res.json()) as { reply: string }).reply;
        track("talk_sent");
      }
      const them: Talk = { id: -Date.now() - 1, lantern_id: lanternId, role: "them", body: reply, created_at: new Date().toISOString() };
      setTalks((m) => ({ ...m, [lanternId]: [...(m[lanternId] ?? []), them] }));
    },
    [],
  );

  /** 이야기를 모두 지워요 */
  const clearTalks = useCallback(async (lanternId: string) => {
    if (!demo) {
      const { error } = await supabase.from("talks").delete().eq("lantern_id", lanternId);
      if (error) throw error;
    }
    setTalks((m) => ({ ...m, [lanternId]: [] }));
  }, []);

  // ---------- 등불 사진 ----------
  /** 볼 수 있는 사진 주소 (Storage 의 임시 주소, 한 시간짜리) */
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  /** 공유 링크로 들어왔는데 목록에 없을 때: 그 등불 하나만 불러와서 목록에 더해요 */
  const fetchLantern = useCallback(async (id: string): Promise<Lantern | null> => {
    if (demo || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data } = await supabase.from("lanterns").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const row = data as Lantern;
    setLanterns((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row].sort((a, b) => a.created_at.localeCompare(b.created_at))));
    return row;
  }, []);

  const loadPhoto = useCallback(async (l: Lantern) => {
    if (demo || !l.photo_path) return;
    // 같은 사진 주소를 일주일 동안 다시 써요. 주소가 같으면 브라우저가 기억해 둔 사진을 써서 다시 내려받지 않아요.
    // (사진을 바꾸면 파일 이름이 바뀌어서 옛 사진이 보이는 일은 없어요)
    const key = `harbor-photo:${l.photo_path}`;
    try {
      const hit = JSON.parse(localStorage.getItem(key) ?? "null") as { url: string; until: number } | null;
      if (hit && hit.until > Date.now()) return setPhotoUrls((m) => ({ ...m, [l.id]: hit.url }));
    } catch {
      /* 저장소를 못 쓰면 매번 새 주소를 받아요 */
    }
    // 볼 권한이 없으면(나만 보기 사진) 주소를 못 받아요. 그 경우 사진 칸을 비워 둬요.
    const week = 7 * 24 * 3600;
    const { data } = await supabase.storage.from("photos").createSignedUrl(l.photo_path, week);
    if (!data?.signedUrl) return;
    setPhotoUrls((m) => ({ ...m, [l.id]: data.signedUrl }));
    try {
      localStorage.setItem(key, JSON.stringify({ url: data.signedUrl, until: Date.now() + (week - 3600) * 1000 }));
    } catch {
      /* 괜찮아요 */
    }
  }, []);

  /** 사진 넣기·바꾸기(blob), 지우기(null) */
  const setPhoto = useCallback(
    async (l: Lantern, blob: Blob | null, isPublic: boolean) => {
      if (!me) throw new Error("no-user");
      const patch = (p: Partial<Lantern>) => setLanterns((all) => all.map((x) => (x.id === l.id ? { ...x, ...p } : x)));
      if (demo) {
        setPhotoUrls((m) => {
          const n = { ...m };
          if (blob) n[l.id] = URL.createObjectURL(blob);
          else delete n[l.id];
          return n;
        });
        patch({ photo_path: blob ? `demo/${l.id}.jpg` : null, photo_public: isPublic });
        return;
      }
      // 바꿀 때마다 새 파일 이름: 브라우저가 사진을 오래 기억해도 옛 사진이 보이지 않아요
      const path = `${me}/${l.id}-${Date.now().toString(36)}.jpg`;
      if (blob) {
        const up = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
      }
      // 예전 사진 파일은 지워요 (바꿨을 때도, 지웠을 때도)
      if (l.photo_path) await supabase.storage.from("photos").remove([l.photo_path]);
      const { error } = await supabase.from("lanterns").update({ photo_path: blob ? path : null, photo_public: isPublic }).eq("id", l.id);
      if (error) throw error;
      if (blob) track("photo_added");
      patch({ photo_path: blob ? path : null, photo_public: isPublic });
      setPhotoUrls((m) => {
        const n = { ...m };
        if (blob) n[l.id] = URL.createObjectURL(blob);
        else delete n[l.id];
        return n;
      });
    },
    [me],
  );

  const setPhotoPublic = useCallback(async (l: Lantern, isPublic: boolean) => {
    if (!demo) {
      const { error } = await supabase.from("lanterns").update({ photo_public: isPublic }).eq("id", l.id);
      if (error) throw error;
    }
    setLanterns((all) => all.map((x) => (x.id === l.id ? { ...x, photo_public: isPublic } : x)));
  }, []);

  return { fetchLantern, photoUrls, loadPhoto, setPhoto, setPhotoPublic, sendFeedback, me, lanterns, online, hereCount, status, warmthCount, sentToday, saveLantern, removeLantern, sendWarmth, notes, loadNotes, addNote, removeNote, messages, loadMessages, addMessage, removeMessage, warmth, offerings, myOffers, leaveOffering, talks, loadTalks, sendTalk, clearTalks };
}
