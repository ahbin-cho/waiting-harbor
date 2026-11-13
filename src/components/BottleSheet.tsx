import { useEffect, useMemo, useState } from "react";
import type { Lantern } from "../lib/supabase";
import { LETTER_ASKS, LETTER_MAX, bottleUrl, type Bottles, type Letter } from "../lib/letters";
import { daysLeft, parseDate, pick, titleOf } from "../lib/waiting";

const DAY = 86_400_000;
const md = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
/** 그 편지를 쓴 날이 기다린 지 며칠째였는지 */
function dayNo(l: Lantern, iso: string) {
  const s = parseDate(l.start_date), d = new Date(iso);
  if (!s) return "";
  const n = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - s.getTime()) / DAY) + 1;
  return n > 0 ? `기다린 지 ${n}일째 · ${md(d)}` : md(d);
}

/**
 * 병에 담은 편지.
 * 쓰는 사람(등불 주인): 편지를 써서 바다에 띄우고, 받을 사람에게 링크를 보내요.
 * 받는 사람(열쇠가 든 링크로 온 사람): 몇 병이 오고 있는지 보다가, 돌아오는 날 열어 봐요.
 */
export function BottleSheet({ lantern, count, letters, onLoad, onAdd, onRemove, onKey, openKey, onOpen, onBack, onSee, demo }: {
  lantern: Lantern;
  /** 지금 바다에 떠 있는 병의 수 */
  count: number;
  letters: Letter[] | undefined;
  onLoad: () => void;
  onAdd: (body: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onKey: () => Promise<string>;
  /** 받는 사람으로 왔을 때의 열쇠 */
  openKey?: string;
  onOpen: (key: string) => Promise<Bottles | null>;
  onBack: () => void;
  /** 등불 보러 가기 */
  onSee: () => void;
  demo: boolean;
}) {
  const who = lantern.who.trim() || "그 사람";
  const n = daysLeft(lantern);
  const end = parseDate(lantern.end_date);
  const arrived = n != null && n <= 0;
  const when = end ? md(end) : "돌아오는 날";

  // ---------- 받는 사람 ----------
  const [got, setGot] = useState<Bottles | null | undefined>(undefined);
  useEffect(() => {
    if (!openKey) return;
    let alive = true;
    onOpen(openKey).then((b) => alive && setGot(b));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, lantern.id]);

  // ---------- 쓰는 사람 ----------
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [shift, setShift] = useState(0);
  const ask = useMemo(() => LETTER_ASKS[(new Date().getDate() + shift) % LETTER_ASKS.length], [shift]);
  useEffect(() => {
    if (!openKey) onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lantern.id, openKey]);

  async function send() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setMsg("");
    try {
      await onAdd(draft.trim());
      setDraft("");
      setMsg(arrived ? "편지를 병에 담았어요. 링크를 받은 사람이 바로 열어 볼 수 있어요." : `병이 바다에 떠올랐어요. ${when}에 항구에 닿아요.`);
    } catch {
      setMsg("오늘은 세 통까지 띄울 수 있어요. 내일 또 써 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      const url = bottleUrl(lantern.id, await onKey());
      await navigator.clipboard.writeText(url);
      setMsg(`링크를 복사했어요. ${pick(who, "이", "가")} 열면 몇 병이 오고 있는지만 보이고, 편지는 ${when}에 열려요.`);
    } catch {
      setMsg("링크를 만들지 못했어요. 잠시 뒤 다시 해 주세요.");
    }
  }

  if (openKey) {
    return (
      <>
        <div className="sheet-tools">
          <button className="text-btn" onClick={onSee}>등불 보러 가기</button>
        </div>
        {got === undefined ? (
          <p className="small">병을 찾고 있어요.</p>
        ) : got === null ? (
          <>
            <h2 id="sheet-title" className="ask">이 병은 열 수 없어요</h2>
            <p className="small">링크가 잘렸거나 바뀌었을 수 있어요. 보내 준 사람에게 다시 받아 주세요.</p>
          </>
        ) : got.arrived ? (
          <>
            <h2 id="sheet-title" className="ask">병이 항구에 닿았어요</h2>
            <p className="bottle-fact">
              {titleOf(lantern)}이 기다리는 동안 쓴 편지 {got.n}통이에요. 처음 쓴 것부터 차례로 놓았어요.
            </p>
            <ol className="letters open">
              {got.letters.map((t, i) => (
                <li key={i}>
                  <span className="letter-day">{dayNo(lantern, t.created_at)}</span>
                  <p>{t.body}</p>
                </li>
              ))}
            </ol>
            {got.n === 0 && <p className="small">아직 병에 담긴 편지가 없어요.</p>}
          </>
        ) : (
          <>
            <h2 id="sheet-title" className="ask">병에 담은 편지가 오고 있어요</h2>
            <p className="bottle-fact">
              {titleOf(lantern)}이 당신에게 쓴 편지 {got.n}통이 유리병에 담겨 항구로 오고 있어요.
            </p>
            <p className="bottle-big">{n != null && n > 0 ? `${n}일 뒤에 열려요` : "곧 열려요"}</p>
            <p className="small">{when}, 돌아오는 날 항구에 닿아요. 그날 이 링크를 다시 열어 주세요. 그 전에는 누구도 열 수 없어요.</p>
            <p className="small">바다 위에 떠 있는 병이 보이나요? 날이 가까워질수록 부두 쪽으로 다가와요.</p>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className="sheet-tools">
        <button className="text-btn" onClick={onBack}>돌아가기</button>
      </div>
      <h2 id="sheet-title" className="ask">{who}에게, 병에 담은 편지</h2>
      <p className="bottle-fact">
        {count > 0 ? `지금 ${count}병이 바다 위에 있어요. ` : "아직 띄운 병이 없어요. "}
        {arrived ? "돌아오는 날이 되어서, 병은 모두 항구에 닿아 있어요." : `${when}, 돌아오는 날 항구에 닿아서 열려요.${n != null ? ` ${n}일 남았어요.` : ""}`}
      </p>

      <div className="compose">
        <p className="ask-line">
          {ask}
          <button className="text-btn" onClick={() => setShift((v) => v + 1)}>다른 질문</button>
        </p>
        <textarea
          maxLength={LETTER_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`${who}에게. 지금은 못 전하는 말을 적어요. 돌아오는 날 열려요.`}
          aria-label={`${who}에게 쓰는 편지`}
        />
        <div className="compose-foot">
          <span className="small">나만 볼 수 있어요. 하루 세 통까지.</span>
          <span className="count">{draft.length}/{LETTER_MAX}</span>
        </div>
        <button className="btn" onClick={send} disabled={busy || !draft.trim()}>병에 담아 띄우기</button>
      </div>
      {msg && <p className="small shared" role="status">{msg}</p>}

      <p className="section">받을 사람에게 알리기</p>
      <p className="small">
        링크를 보내면 {pick(who, "은", "는")} 몇 병이 오고 있는지만 볼 수 있어요. 편지는 돌아오는 날이 되어야 열려요.
      </p>
      <div className="share-actions">
        <button className="ghost" onClick={copyLink} disabled={demo}>{who}에게 보낼 링크 복사</button>
      </div>
      {demo && <p className="small">체험 모드에서는 링크를 만들 수 없어요.</p>}

      <p className="section">띄운 편지 {letters && letters.length > 0 && <small>{letters.length}</small>}</p>
      {letters === undefined ? (
        <p className="small">편지를 불러오는 중이에요.</p>
      ) : letters.length === 0 ? (
        <p className="small">첫 편지를 써 보세요. 한 줄이어도 괜찮아요.</p>
      ) : (
        <ol className="letters">
          {letters.map((t) => (
            <li key={t.id}>
              <span className="letter-day">{dayNo(lantern, t.created_at)}</span>
              <p>{t.body}</p>
              <button
                className="text-btn"
                onClick={() => {
                  if (confirm("이 편지를 병에서 꺼낼까요? 되돌릴 수 없어요.")) onRemove(t.id).catch(() => setMsg("꺼내지 못했어요."));
                }}
              >
                꺼내기
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
