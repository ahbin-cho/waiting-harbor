import { useState } from "react";

/** 의견 남기기: 등대지기(운영자)에게 한마디 */
export function Feedback({ onSend, onClose, demo }: {
  onSend: (body: string, contact: string, website: string) => Promise<void>;
  onClose: () => void;
  demo: boolean;
}) {
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState(""); // 봇 거르기용 숨은 칸
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");

  async function send() {
    if (!body.trim()) return setErr("한 글자라도 적어 주세요.");
    setState("sending");
    setErr("");
    try {
      await onSend(body.trim(), contact.trim(), website);
      setState("sent");
    } catch (e) {
      setState("idle");
      const m = (e as Error).message;
      setErr(
        m === "demo" ? "체험 모드에서는 보낼 수 없어요."
        : m === "limit" ? "오늘은 의견을 충분히 받았어요. 내일 다시 보내 주세요."
        : "보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.",
      );
    }
  }

  if (state === "sent") {
    return (
      <>
        <h2 id="sheet-title" className="ask">잘 받았어요. 고마워요.</h2>
        <p className="small">{contact ? "남겨 주신 곳으로 답장을 드릴게요." : "보내 주신 말은 마을을 고치는 데 쓸게요."}</p>
        <div className="row"><button className="ghost" onClick={onClose}>닫기</button></div>
      </>
    );
  }

  return (
    <>
      <h2 id="sheet-title" className="ask">등대지기에게 한마디</h2>
      <p className="small">불편했던 것, 있었으면 하는 것, 아무 말이나 괜찮아요.</p>
      <label htmlFor="fb-body">하고 싶은 말</label>
      <textarea id="fb-body" className="plain" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="무지개마을에 고양이 집이 하나 더 있으면 좋겠어요." />
      <label htmlFor="fb-contact">답장 받을 곳 (선택)</label>
      <input id="fb-contact" maxLength={100} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="이메일이나 인스타 아이디" autoComplete="email" />
      <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <div className="err" role="alert">{err}</div>
      <div className="row">
        <button className="btn" onClick={send} disabled={state === "sending" || demo}>{state === "sending" ? "보내는 중" : "보내기"}</button>
        <button className="ghost" onClick={onClose}>닫기</button>
      </div>
      {demo && <p className="small">체험 모드에서는 보낼 수 없어요.</p>}
    </>
  );
}
