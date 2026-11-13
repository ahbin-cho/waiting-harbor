import { useState } from "react";
import type { Lantern } from "../lib/supabase";
import { badgeText, isMiss, milestoneOf, titleOf } from "../lib/waiting";
import { makeMemoryCard, makeMilestone, makePass } from "../lib/pass";
import { track } from "../lib/track";
import { kakaoReady, shareKakao } from "../lib/kakao";

/** 등불 보내기: 링크 복사, (폰이면) 다른 앱으로 */
export function ShareSheet({ lantern, demo, onBack, no }: { lantern: Lantern; demo: boolean; onBack: () => void; no: string }) {
  const url = `${location.origin}/l/${lantern.id}`;
  const [msg, setMsg] = useState("");
  const [pass, setPass] = useState<{ url: string; file: File; story: { url: string; file: File } } | null>(null);
  const [making, setMaking] = useState(false);
  // 오늘이 100일, 절반, D-30 같은 날이면 기념 카드를 먼저 권해요
  const stone = milestoneOf(lantern);
  const [stoneCard, setStoneCard] = useState<{ url: string; file: File } | null>(null);
  async function makeStone() {
    if (!stone) return;
    setMaking(true);
    try {
      const blob = await makeMilestone(lantern, stone);
      setStoneCard({ url: URL.createObjectURL(blob), file: new File([blob], `기다림항구-${lantern.who}-${stone.title}.png`, { type: "image/png" }) });
      track("share_click", { how: "milestone" });
    } catch {
      setMsg("카드를 만들지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setMaking(false);
    }
  }
  const miss = isMiss(lantern);
  const pet = lantern.place === "무지개";
  const cardName = miss ? (pet ? "무지개마을 주민 카드" : "추모 카드") : lantern.kind === "군대" ? "귀향권" : lantern.kind === "장거리 연애" || lantern.kind === "해외에 있는 가족" ? "탑승권" : "승선권";

  async function makeIt() {
    setMaking(true);
    try {
      const make = miss ? makeMemoryCard : makePass;
      const [blob, tall] = await Promise.all([make(lantern, no), make(lantern, no, true)]);
      const name = `기다림항구-${lantern.who}-${miss ? "추모카드" : "승선권"}`;
      const file = new File([blob], `${name}.png`, { type: "image/png" });
      const sfile = new File([tall], `${name}-스토리.png`, { type: "image/png" });
      setPass({ url: URL.createObjectURL(blob), file, story: { url: URL.createObjectURL(tall), file: sfile } });
      track("share_click", { how: miss ? "card" : "pass" });
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

      {stone && (
        <div className="pass-box">
          <p className="section">오늘의 기념 카드 · {stone.title}</p>
          {stoneCard ? (
            <>
              <img className="pass-img" src={stoneCard.url} alt={`${titleOf(lantern)}, ${stone.title}`} />
              <div className="share-actions">
                <a className="btn" href={stoneCard.url} download={stoneCard.file.name}>저장하기</a>
                {typeof navigator.canShare === "function" && navigator.canShare({ files: [stoneCard.file] }) && (
                  <button className="ghost" onClick={() => navigator.share({ files: [stoneCard.file], title: "기다림 항구" }).catch(() => {})}>스토리에 올리기</button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="small">오늘은 {stone.title}인 날이에요. {stone.sub}. 오늘만 만들 수 있는 카드예요.</p>
              <button className="btn" onClick={makeStone} disabled={making}>{making ? "만드는 중" : "기념 카드 만들기"}</button>
            </>
          )}
        </div>
      )}
      {(
        <div className="pass-box">
          <p className="section">{cardName}</p>
          {pass ? (
            <>
              <img className="pass-img" src={pass.url} alt={`${titleOf(lantern)}의 ${cardName}`} />
              <div className="share-actions">
                <a className="btn" href={pass.url} download={pass.file.name} onClick={() => track("share_click", { how: "save_feed" })}>피드용 저장</a>
                <a className="ghost" href={pass.story.url} download={pass.story.file.name} onClick={() => track("share_click", { how: "save_story" })}>스토리용 저장 (세로)</a>
                {typeof navigator.canShare === "function" && navigator.canShare({ files: [pass.story.file] }) && (
                  <button
                    className="ghost"
                    onClick={() => {
                      track("share_click", { how: "story" });
                      navigator.share({ files: [pass.story.file], title: "기다림 항구" }).catch(() => {});
                    }}
                  >
                    스토리에 올리기
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="small">
                {miss
                  ? `"${titleOf(lantern)}" 이름과 함께한 날이 적힌 카드를 이미지로 만들어요. 기억하고 싶은 사람들과 나눠도 좋아요.`
                  : `"${titleOf(lantern)}" 이름이 찍힌 ${cardName}을 이미지로 만들어요. 저장해서 스토리나 프로필에 올려도 좋아요.`}
              </p>
              <button className="ghost" onClick={makeIt} disabled={making}>{making ? "만드는 중" : `${cardName} 만들기`}</button>
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
            {kakaoReady() && (
              <button
                className="btn kakao"
                onClick={() => {
                  track("share_click", { how: "kakao" });
                  shareKakao(url).catch(() => setMsg("카카오톡을 열지 못했어요. 링크 복사로 보내 주세요."));
                }}
              >
                카카오톡으로 보내기
              </button>
            )}
            <button className={kakaoReady() ? "ghost" : "btn"} onClick={copy}>링크 복사</button>
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
