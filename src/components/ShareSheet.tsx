import { useState } from "react";
import type { Lantern } from "../lib/supabase";
import { badgeText, isMiss, titleOf } from "../lib/waiting";
import { makePass } from "../lib/pass";
import { track } from "../lib/track";

/** 등불 보내기: 링크 복사, (폰이면) 다른 앱으로 */
export function ShareSheet({ lantern, demo, onBack, no }: { lantern: Lantern; demo: boolean; onBack: () => void; no: string }) {
  const url = `${location.origin}/l/${lantern.id}`;
  const [msg, setMsg] = useState("");
  const [pass, setPass] = useState<{ url: string; file: File } | null>(null);
  const [making, setMaking] = useState(false);

  async function makeIt() {
    setMaking(true);
    try {
      const blob = await makePass(lantern, no);
      const file = new File([blob], `기다림항구-${lantern.who}-승선권.png`, { type: "image/png" });
      setPass({ url: URL.createObjectURL(blob), file });
      track("share_click", { how: "pass" });
    } catch {
      setMsg("승선권을 만들지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setMaking(false);
    }
  }

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

      {!isMiss(lantern) && (
        <div className="pass-box">
          <p className="section">승선권</p>
          {pass ? (
            <>
              <img className="pass-img" src={pass.url} alt={`${titleOf(lantern)}의 승선권`} />
              <div className="share-actions">
                <a className="btn" href={pass.url} download={pass.file.name}>저장하기</a>
                {typeof navigator.canShare === "function" && navigator.canShare({ files: [pass.file] }) && (
                  <button
                    className="ghost"
                    onClick={() => navigator.share({ files: [pass.file], title: "기다림 항구" }).catch(() => {})}
                  >
                    인스타·카톡으로
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="small">"{titleOf(lantern)}" 이름이 찍힌 승선권을 이미지로 만들어요. 저장해서 스토리나 프로필에 올려도 좋아요.</p>
              <button className="ghost" onClick={makeIt} disabled={making}>{making ? "만드는 중" : "승선권 만들기"}</button>
            </>
          )}
        </div>
      )}

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
