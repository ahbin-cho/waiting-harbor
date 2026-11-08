import { useEffect, useRef } from "react";
import type { Lantern } from "../lib/supabase";
import type { Place, World } from "../lib/places";
import { Village } from "../three/Village";
import type { Shot } from "../lib/story";
import type { ThemeName } from "../lib/theme";
import { startClip, type ClipText } from "../lib/clip";
import type { ShrineInfo } from "../three/shrine";

export type Focus = { place: Place | "all"; n: number };

/** three.js 로 그린 3D 밤 마을. 이름표는 HTML 로 그 위에 얹어요. */
export function Village3D({ lanterns, me, online, pulseId, focus, shot, selectedId, shrine, onPick, theme, world, record, onClip }: {
  lanterns: Lantern[];
  me: string | null;
  online: Set<string>;
  pulseId: string | null;
  focus: Focus | null;
  shot: { name: Shot; n: number } | null;
  selectedId: string | null;
  /** 열린 등불 곁의 작은 자리 (사진, 번호, 한 줄, 작은 등 수) */
  shrine: ShrineInfo | null;
  onPick: (id: string) => void;
  theme: ThemeName;
  /** 기다림 항구 / 추모관 (이야기 중엔 모두) */
  world: World | "all";
  /** 10초 영상 찍기 요청 */
  record: { id: string; n: number; text: ClipText } | null;
  onClip: (r: { blob: Blob; ext: string } | { error: string }) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const v = useRef<Village | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const village = new Village(stage.current!, tags.current!, (id) => pick.current(id), theme);
    v.current = village;
    return () => {
      village.dispose();
      v.current = null;
    };
  }, []);

  useEffect(() => v.current?.setData(lanterns, me, online), [lanterns, me, online]);
  useEffect(() => v.current?.setTheme(theme), [theme]);
  useEffect(() => v.current?.setWorld(world), [world]);
  const clipDone = useRef(onClip);
  clipDone.current = onClip;
  useEffect(() => {
    if (!record || !v.current) return;
    const village = v.current;
    (async () => {
      try {
        const clip = await startClip(record.text);
        await village.recordOrbit(record.id, 10, (c, k) => clip.draw(c, k));
        const blob = await clip.stop();
        clipDone.current({ blob, ext: clip.ext });
      } catch {
        clipDone.current({ error: "영상을 만들지 못했어요. 다른 브라우저에서 다시 해 주세요." });
      }
    })();
  }, [record]);
  useEffect(() => v.current?.setSelected(selectedId), [selectedId]);
  const shrineKey = shrine ? [shrine.id, shrine.photo, shrine.no, shrine.who, shrine.line, shrine.color, shrine.count].join("|") : "";
  useEffect(() => v.current?.setShrine(shrine), [shrineKey, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pulseId) v.current?.pulse(pulseId);
  }, [pulseId]);
  useEffect(() => {
    if (!focus) return;
    if (focus.place === "all") v.current?.overview();
    else v.current?.focusPlace(focus.place);
  }, [focus]);

  useEffect(() => {
    if (shot) v.current?.shot(shot.name);
  }, [shot]);

  return (
    <div className="stage" ref={stage}>
      <div className="tags" ref={tags} aria-hidden="true" />
    </div>
  );
}
