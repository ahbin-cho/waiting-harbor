import { useEffect, useMemo, useRef, useState } from "react";
import type { Lantern } from "../lib/supabase";
import { SAFETY_REPLY, TALK_MAX, type Talk } from "../lib/talk";
import { choicesOf, lineOf, type Speaker } from "../lib/talkTree";

const hm = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/**
 * 이야기하기: 떠나보낸 사람(아이)과 선택지를 골라 가며 이야기해요. 무료, AI 없이.
 * 하고 싶은 말이 따로 있으면 "직접 쓰기"로 써도 돼요.
 * 진짜 그 사람이 아니라는 걸 늘 밝혀 두고, 상담 전화를 조용히 안내해요.
 */
export function TalkSheet({ lantern, photoUrl, talks, onLoad, onSend, onClear, onBack, onClose, demo }: {
  lantern: Lantern;
  photoUrl?: string;
  talks: Talk[] | undefined;
  onLoad: () => void;
  /** text: 내가 한 말, reply: 정해진 답장 (없으면 무료 답장으로 골라요) */
  onSend: (text: string, reply?: string) => Promise<void>;
  onClear: () => Promise<void>;
  onBack: () => void;
  onClose: () => void;
  demo: boolean;
}) {
  const who = lantern.who.trim() || "그 사람";
  const sp: Speaker = useMemo(() => ({ isPet: lantern.place === "무지개", species: lantern.species }), [lantern.place, lantern.species]);
  const seed = useMemo(() => Number(new Date().toISOString().slice(0, 10).replace(/-/g, "")), []);
  const [node, setNode] = useState("start");
  const [greeting] = useState(() => lineOf("start", sp, seed + Math.floor(Math.random() * 97)));
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const log = useRef<HTMLOListElement>(null);
  const list = talks ?? [];

  useEffect(() => {
    onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lantern.id]);

  // 새 말이 오면 맨 아래로
  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [list.length, busy, node]);

  async function say(text: string, to?: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    const recent = list.filter((t) => t.role === "them").slice(-6).map((t) => t.body);
    const reply = to ? lineOf(to, sp, seed + list.length, recent) : undefined;
    try {
      await onSend(text.trim(), reply);
      setNode(to ?? "menu");
      setDraft("");
    } catch (e) {
      setErr((e as Error).message === "limit" ? "오늘은 여기까지 이야기할 수 있어요. 내일 다시 와 주세요." : "말을 전하지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const avatar = photoUrl ? <img className="talk-face" src={photoUrl} alt="" /> : <span className="talk-face" aria-hidden="true">{who.slice(0, 1)}</span>;
  const theirs = (key: string | number, body: string, at?: string) =>
    body === SAFETY_REPLY ? (
      // 마음이 위험해 보일 땐 그 사람의 말이 아니라 등대지기의 안내로 보여요
      <li key={key} className="talk-keeper" role="note">
        <b>등대지기</b>
        <p>{body.replace(/^등대지기예요\. /, "")}</p>
      </li>
    ) : (
      <li key={key} className="talk-row them">
        {avatar}
        <div>
          <span className="talk-name">{who}</span>
          <p className="bubble them">{body}</p>
        </div>
        {at && <span className="talk-time">{hm(at)}</span>}
      </li>
    );

  return (
    <>
      <div className="sheet-tools">
        <button className="text-btn" onClick={onBack}>돌아가기</button>
        <button className="text-btn" onClick={onClose}>닫기</button>
      </div>
      <h2 id="sheet-title">{who}에게 말 걸기</h2>
      <p className="small talk-note">{who}의 마음을 빌려 상상한 답장이에요. 진짜 {who}가 보내는 말은 아니에요.</p>

      <ol className="talk-log" ref={log} aria-live="polite">
        {list.map((t) =>
          t.role === "me" ? (
            <li key={t.id} className="talk-row me">
              <span className="talk-time">{hm(t.created_at)}</span>
              <p className="bubble me">{t.body}</p>
            </li>
          ) : (
            theirs(t.id, t.body, t.created_at)
          ),
        )}
        {/* 들어오면 먼저 반겨 줘요 (저장하지 않는 인사) */}
        {node === "start" && !busy && theirs("hello", greeting)}
        {busy && (
          <li className="talk-row them">
            {avatar}
            <p className="bubble them typing" aria-label="답장을 쓰는 중">···</p>
          </li>
        )}
      </ol>

      {/* 고를 수 있는 말 */}
      <div className="talk-choices" role="group" aria-label="고를 수 있는 말">
        {choicesOf(node, sp).map((c) => (
          <button key={c.to + c.label} type="button" className="choice-pill" disabled={busy} onClick={() => say(c.label, c.to)}>
            {c.label}
          </button>
        ))}
        <button type="button" className="choice-pill write" disabled={busy} onClick={() => setTyping((v) => !v)} aria-expanded={typing}>
          {typing ? "선택지로 할게" : "직접 쓰기"}
        </button>
      </div>

      {typing && (
        <div className="talk-input">
          <textarea
            rows={1}
            maxLength={TALK_MAX}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                say(draft);
              }
            }}
            placeholder={`${who}에게`}
            aria-label={`${who}에게 보낼 말`}
          />
          <button className="btn" onClick={() => say(draft)} disabled={busy || !draft.trim()}>보내기</button>
        </div>
      )}
      <div className="err" role="alert">{err}</div>

      <p className="small help-line">
        마음이 너무 무거운 날엔 혼자 견디지 않아도 돼요. 자살예방 상담전화 109 (24시간), 정신건강 상담전화 1577-0199.
      </p>
      {list.length > 0 && (
        <button
          className="text-btn"
          onClick={() => {
            if (confirm("이야기를 모두 지울까요? 되돌릴 수 없어요.")) onClear().catch(() => setErr("지우지 못했어요."));
          }}
        >
          이야기 모두 지우기
        </button>
      )}
      {demo && <p className="small">체험 모드라 이야기는 저장되지 않아요.</p>}
    </>
  );
}
