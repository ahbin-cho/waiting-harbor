import { useEffect, useState } from "react";
import type { Lantern } from "../lib/supabase";
import { badgeText, titleOf } from "../lib/waiting";
import { track } from "../lib/track";

declare global {
  interface Window {
    Kakao?: { isInitialized(): boolean; init(key: string): void; Share: { sendScrap(o: { requestUrl: string }): void } };
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
const KAKAO_SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

/** 카카오 SDK 는 공유 화면을 열 때 한 번만 불러와요 */
function loadKakao(): Promise<NonNullable<Window["Kakao"]> | null> {
  if (!KAKAO_KEY) return Promise.resolve(null);
  if (window.Kakao) return Promise.resolve(window.Kakao);
  return new Promise((res) => {
    const s = document.createElement("script");
    s.src = KAKAO_SDK;
    s.crossOrigin = "anonymous";
    s.onload = () => res(window.Kakao ?? null);
    s.onerror = () => res(null);
    document.head.appendChild(s);
  });
}

/** 등불 보내기: 스토리용 카드 이미지, 카카오톡, 다른 앱, 링크 복사 */
export function ShareSheet({ lantern, demo, onBack }: { lantern: Lantern; demo: boolean; onBack: () => void }) {
  const url = `${location.origin}/l/${lantern.id}`;
  const day = new Date().toISOString().slice(0, 10); // 날짜가 바뀌면 D-day 가 바뀐 새 카드
  const card = `/api/og?id=${lantern.id}&s=1&v=${day}`;
  const [kakao, setKakao] = useState<NonNullable<Window["Kakao"]> | null>(null);
  const [msg, setMsg] = useState("");
  const [cardOk, setCardOk] = useState(true);

  useEffect(() => {
    loadKakao().then((k) => {
      if (!k) return;
      if (!k.isInitialized()) k.init(KAKAO_KEY!);
      setKakao(k);
    });
  }, []);

  async function saveImage() {
    track("share_click", { how: "image" });
    try {
      const blob = await (await fetch(card)).blob();
      const file = new File([blob], `기다림항구-${lantern.who}.png`, { type: blob.type || "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setMsg("이미지를 저장했어요. 인스타 스토리에 올려 보세요.");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMsg("저장하지 못했어요. 위 카드를 길게 눌러 저장해 주세요.");
    }
  }

  async function copy() {
    track("share_click", { how: "copy" });
    try {
      await navigator.clipboard.writeText(url);
      setMsg("링크를 복사했어요. 카톡이나 인스타에 붙여 넣으면 등불 카드가 같이 보여요.");
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
          {cardOk && <img className="share-card" src={card} alt={`${titleOf(lantern)} 등불 카드`} onError={() => setCardOk(false)} />}
          <p className="small">카드를 길게 눌러 저장해서 스토리에 올릴 수도 있어요.</p>
          <div className="share-actions">
            {kakao && (
              <button
                className="btn kakao"
                onClick={() => {
                  track("share_click", { how: "kakao" });
                  kakao.Share.sendScrap({ requestUrl: url });
                }}
              >
                카카오톡으로 보내기
              </button>
            )}
            <button className={kakao ? "ghost" : "btn"} onClick={saveImage}>이미지 저장</button>
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
            <button className="ghost" onClick={copy}>링크 복사</button>
          </div>
          {msg && <p className="small shared" role="status">{msg}</p>}
        </>
      )}
    </>
  );
}
