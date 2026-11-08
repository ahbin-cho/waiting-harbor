import { useCallback, useEffect, useMemo, useState } from "react";
import { configured, supabase, type Lantern, type Warmth } from "../lib/supabase";
import { today, ymd } from "../lib/waiting";
import { DEMO_ME, demoLanterns, demoOnline, demoWarmth } from "../lib/demo";

/** Supabase 설정이 없으면 체험 모드로 열려요. 아무것도 저장되지 않아요. */
export const demo = !configured;

export type Status = "loading" | "ready" | "error" | "unconfigured";

export function useHarbor(onWarmed?: () => void) {
  const [me, setMe] = useState<string | null>(demo ? DEMO_ME : null);
  const [lanterns, setLanterns] = useState<Lantern[]>(demo ? demoLanterns : []);
  const [warmth, setWarmth] = useState<Warmth[]>(demo ? demoWarmth : []);
  const [online, setOnline] = useState<Set<string>>(demo ? demoOnline : () => new Set());
  const [hereCount, setHereCount] = useState(demo ? 4 : 1);
  const [status, setStatus] = useState<Status>(demo ? "ready" : "loading");

  // 1. 로그인: 회원가입 없이 익명으로 들어와요
  useEffect(() => {
    if (!configured) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return setMe(data.session.user.id);
      const res = await supabase.auth.signInAnonymously();
      if (res.error || !res.data.user) return setStatus("error");
      setMe(res.data.user.id);
    })();
  }, []);

  // 2. 등불과 온기 불러오기 + 실시간 반영
  useEffect(() => {
    if (!configured || !me) return;
    let alive = true;
    (async () => {
      const [l, w] = await Promise.all([
        supabase.from("lanterns").select("*").order("created_at"),
        supabase.from("warmth").select("from_id,to_id,day"),
      ]);
      if (!alive) return;
      if (l.error || w.error) return setStatus("error");
      setLanterns(l.data as Lantern[]);
      setWarmth(w.data as Warmth[]);
      setStatus("ready");
    })();

    const db = supabase
      .channel("harbor-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "lanterns" }, (p) => {
        setLanterns((prev) => {
          if (p.eventType === "DELETE") return prev.filter((x) => x.user_id !== (p.old as Lantern).user_id);
          const row = p.new as Lantern;
          const rest = prev.filter((x) => x.user_id !== row.user_id);
          return [...rest, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "warmth" }, (p) => {
        const row = p.new as Warmth;
        setWarmth((prev) => [...prev, row]);
        if (row.to_id === me) onWarmed?.();
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

  const sentToday = useCallback(
    (to: string) => warmth.some((w) => w.from_id === me && w.to_id === to && w.day === ymd(today())),
    [warmth, me],
  );

  const saveLantern = useCallback(
    async (v: Pick<Lantern, "who" | "kind" | "start_date" | "end_date" | "line" | "place" | "color" | "shape">) => {
      if (!me) throw new Error("no-user");
      if (demo) {
        const prev = lanterns.find((x) => x.user_id === me);
        const row: Lantern = { user_id: me, created_at: prev?.created_at ?? new Date().toISOString(), ...v };
        setLanterns((all) => [...all.filter((x) => x.user_id !== me), row]);
        return;
      }
      const { data, error } = await supabase
        .from("lanterns")
        .upsert({ user_id: me, ...v })
        .select()
        .single();
      if (error) throw error;
      setLanterns((prev) => {
        const rest = prev.filter((x) => x.user_id !== me);
        return [...rest, data as Lantern].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    },
    [me, lanterns],
  );

  const removeLantern = useCallback(async () => {
    if (!me) return;
    if (demo) return setLanterns((prev) => prev.filter((x) => x.user_id !== me));
    const { error } = await supabase.from("lanterns").delete().eq("user_id", me);
    if (error) throw error;
    setLanterns((prev) => prev.filter((x) => x.user_id !== me));
  }, [me]);

  const sendWarmth = useCallback(
    async (to: string) => {
      if (!me || to === me) return;
      const row = { from_id: me, to_id: to, day: ymd(today()) };
      if (demo) {
        if (!warmth.some((w) => w.from_id === me && w.to_id === to && w.day === row.day)) setWarmth((prev) => [...prev, row]);
        return;
      }
      const { error } = await supabase.from("warmth").insert(row);
      // 23505 = 오늘 이미 보냄. 실패가 아니라 그냥 무시해요.
      if (error && error.code !== "23505") throw error;
    },
    [me, warmth],
  );

  return { me, lanterns, online, hereCount, status, warmthCount, sentToday, saveLantern, removeLantern, sendWarmth };
}
