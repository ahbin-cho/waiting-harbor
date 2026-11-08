import { useEffect, useRef } from "react";
import type { Lantern } from "../lib/supabase";
import type { Place } from "../lib/places";
import { Village } from "../three/Village";
import type { Shot } from "../lib/story";

export type Focus = { place: Place | "all"; n: number };

/** three.js 로 그린 3D 밤 마을. 이름표는 HTML 로 그 위에 얹어요. */
export function Village3D({ lanterns, me, online, pulseId, focus, shot, selectedId, onPick }: {
  lanterns: Lantern[];
  me: string | null;
  online: Set<string>;
  pulseId: string | null;
  focus: Focus | null;
  shot: { name: Shot; n: number } | null;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const v = useRef<Village | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const village = new Village(stage.current!, tags.current!, (id) => pick.current(id));
    v.current = village;
    return () => {
      village.dispose();
      v.current = null;
    };
  }, []);

  useEffect(() => v.current?.setData(lanterns, me, online), [lanterns, me, online]);
  useEffect(() => v.current?.setSelected(selectedId), [selectedId]);
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
