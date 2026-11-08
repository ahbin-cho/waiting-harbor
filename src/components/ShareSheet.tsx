import { useState } from "react";
import type { Lantern } from "../lib/supabase";
import { badgeText, titleOf } from "../lib/waiting";
import { track } from "../lib/track";

/** 등불 보내기: 링크 복사, (폰이면) 다른 앱으로 */
export function ShareSheet({ lantern, demo, onBack }: { lantern: Lantern; demo: boolean; onBack: () => void }) {
  const url = `${location.origin}/l/${lantern.id}`;
  const [msg, setMsg] = useState("");

  async function copy() {
    track("share_click", { how: "copy" });
    try {
      await navigator.clipboard.writeText(url);
      setMsg("링크를 복사했어요. 카톡이나 인스타에 붙여 넣으면, 받은 사람이 누르는 순간 이 등불 앞으로 와요.");
    } catch {
      setMsg(url);
    }
  }

  return (
    <>
      <div className="sheet-tools">
        <button className="text-btn" onClick={onBack}>돌아가기</button>
      </div>
      <h2 id="sheet-title" className="ask">{titleOf(lantern)}의 등불 보내기</h2>
      <p className="small">{badgeText(lantern)} · 받은 사람이 링크를 누르면 이 등불 앞으로 바로 와요.</p>

      {demo ? (
        <p className="small">체험 모드에서는 보낼 수 없어요.</p>
      ) : (
        <>
          <p className="share-url">{url}</p>
          <div className="share-actions">
            <button className="btn" onClick={copy}>링크 복사</button>
            {typeof navigator.share === "function" && (
              <button
                className="ghost"
                onClick={async () => {
                  track("share_click", { how: "system" });
                  try {
                    await navigator.share({ title: "기다림 항구", text: `${titleOf(lantern)} · ${badgeText(lantern)}`, url });
                  } catch {
                    /* 닫았어요 */
                  }
                }}
              >
                다른 앱으로
              </button>
            )}
          </div>
          {msg && <p className="small shared" role="status">{msg}</p>}
        </>
      )}
    </>
  );
}
