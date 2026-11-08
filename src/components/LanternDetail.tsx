import { useState } from "react";
import type { Lantern } from "../lib/supabase";
import { daysLeft, daysSince, ddayText, pick, titleOf } from "../lib/waiting";
import { placeOf } from "../lib/places";

export function LanternDetail({ lantern, isMine, isHere, warmth, sent, onWarm, onEdit, onClose }: {
  lantern: Lantern;
  isMine: boolean;
  isHere: boolean;
  warmth: number;
  sent: boolean;
  onWarm: () => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = daysLeft(lantern);
  const since = daysSince(lantern);
  const who = lantern.who.trim() || "그 사람";

  async function warm() {
    setBusy(true);
    setErr("");
    try {
      await onWarm();
    } catch {
      setErr("온기를 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const story =
    n == null ? ""
    : n > 0 ? `기다린 지 ${since}일째예요. ${n}일 남았어요.`
    : n === 0 ? `오늘 ${pick(who, "이", "가")} 돌아와요.`
    : "다시 만났어요. 등불은 하늘로 올라가는 중이에요.";

  return (
    <>
      <p className="where">{placeOf(lantern.place)}에 걸린 등불 · {lantern.kind}</p>
      <h2 id="sheet-title">{titleOf(lantern)}</h2>
      {isMine && <p className="here-now">당신의 등불이에요.</p>}
      {isHere && !isMine && <p className="here-now">이 사람도 지금 항구에 와 있어요.</p>}
      <div className="big">{ddayText(n)}</div>
      <p className="small">{story}</p>
      {lantern.line && <p className="note-line">{lantern.line}</p>}
      <p className="small">{warmth ? `이 등불에 온기가 ${warmth}번 닿았어요.` : "아직 닿은 온기가 없어요."}</p>
      <div className="err" role="alert">{err}</div>
      <div className="row">
        {isMine ? (
          <button className="btn" onClick={onEdit}>오늘의 한 줄 남기기</button>
        ) : (
          <button className="btn" onClick={warm} disabled={busy || sent}>
            {sent ? "오늘 온기를 보냈어요" : "온기 보내기"}
          </button>
        )}
        <button className="ghost" onClick={onClose}>닫기</button>
      </div>
    </>
  );
}
