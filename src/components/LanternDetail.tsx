import { useEffect, useRef, useState } from "react";
import type { Lantern, Message, Note } from "../lib/supabase";
import type { DailyWord } from "../lib/daily";
import { OFFER_ONE, offeringSummary, offeringsFor, type OfferingKind } from "../lib/offerings";
import { daysGone, daysLeft, daysSince, ddayText, isMiss, nextAnniversary, parseDate, pick, progressOf, titleOf, togetherDays } from "../lib/waiting";
import { placeOf } from "../lib/places";
import { todaysAsk } from "../lib/prompts";
import { shrinkPhoto } from "../lib/photo";

const md = (s: string) => {
  const d = parseDate(s);
  return d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : "";
};

/** 일기를 쓴 날이 돌아오는 날로부터 며칠 전이었는지 */
function dayLabel(note: Note, end: string, miss: boolean) {
  const a = parseDate(note.day), b = parseDate(end);
  if (!a || !b) return md(note.day);
  const n = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (miss) return `떠난 지 ${Math.max(0, -n)}일 · ${md(note.day)}`;
  return `${n > 0 ? `D-${n}` : n === 0 ? "그날" : "다시 만난 뒤"} · ${md(note.day)}`;
}

export function LanternDetail({ lantern, me, daily, offerings, myOffer, onOffer, no, onPrev, onNext, isMine, isHere, warmth, sent, notes, onLoadNotes, onAddNote, onRemoveNote, messages, onLoadMessages, onAddMessage, onRemoveMessage, onWarm, onEdit, onClose, onShare, onRecord, photoUrl, onLoadPhoto, onPhoto, onPhotoPublic }: {
  lantern: Lantern;
  /** 지금 보는 사람 (자기가 남긴 말을 지울 수 있게) */
  me: string | null;
  /** 내 등불이면 오늘의 한마디 */
  daily?: DailyWord;
  /** 놓고 간 것들 (종류별 수), 오늘 내가 놓은 것, 놓기 */
  offerings?: Partial<Record<OfferingKind, number>>;
  myOffer?: OfferingKind;
  onOffer: (kind: OfferingKind) => Promise<void>;
  /** 자리 번호 ("항구 12")와 같은 장소의 이전·다음 등불로 가기 */
  no?: string;
  onPrev?: () => void;
  onNext?: () => void;
  isMine: boolean;
  isHere: boolean;
  warmth: number;
  sent: boolean;
  notes: Note[] | undefined;
  onLoadNotes: () => void;
  onAddNote: (body: string, isPublic: boolean) => Promise<void>;
  onRemoveNote: (id: number) => Promise<void>;
  /** 남긴 마음: 다른 사람들이 등불 앞에 남긴 응원과 추모의 말 */
  messages: Message[] | undefined;
  onLoadMessages: () => void;
  onAddMessage: (body: string) => Promise<void>;
  onRemoveMessage: (id: number) => Promise<void>;
  onWarm: () => Promise<void>;
  onEdit: () => void;
  onClose: () => void;
  /** 보내기 화면 열기 */
  onShare: () => void;
  /** 10초 영상 만들기 (지원하지 않는 브라우저면 없음) */
  onRecord?: () => void;
  /** 사진: 볼 수 있는 주소(없으면 없거나 나만 보기), 불러오기, 넣기·지우기, 공개 여부 */
  photoUrl?: string;
  onLoadPhoto: () => void;
  onPhoto: (blob: Blob | null, isPublic: boolean) => Promise<void>;
  onPhotoPublic: (isPublic: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(true);
  const [askShift, setAskShift] = useState(0);
  const [writing, setWriting] = useState(false);
  const [say, setSay] = useState("");
  const [saying, setSaying] = useState(false);
  const sayRef = useRef<HTMLTextAreaElement>(null);
  const said = messages ?? [];
  const [offering, setOffering] = useState(false);
  async function offer(kind: OfferingKind) {
    setOffering(true);
    setErr("");
    try {
      await onOffer(kind);
    } catch {
      setErr("놓지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setOffering(false);
    }
  }
  const laid = offeringSummary(offerings);
  const n = daysLeft(lantern);
  const since = daysSince(lantern);
  const pct = Math.round(progressOf(lantern) * 100);
  const who = lantern.who.trim() || "그 사람";
  const list = notes ?? [];
  const miss = isMiss(lantern);
  const gone = daysGone(lantern);
  const ann = nextAnniversary(lantern);

  const [photoBusy, setPhotoBusy] = useState(false);
  const photoPublic = !!lantern.photo_public;
  async function pickPhoto(file?: File) {
    if (!file) return;
    setPhotoBusy(true);
    setErr("");
    try {
      await onPhoto(await shrinkPhoto(file), lantern.photo_path ? photoPublic : false);
    } catch {
      setErr("사진을 올리지 못했어요. 다른 사진으로 다시 해 주세요.");
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    onLoadPhoto();
    onLoadNotes();
    onLoadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lantern.id]);

  async function warm() {
    setBusy(true);
    setErr("");
    try {
      await onWarm();
    } catch {
      setErr(miss ? "추모를 전하지 못했어요. 잠시 뒤 다시 눌러 주세요." : "온기를 보내지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    const body = say.trim();
    if (!body) return setErr("한 글자라도 적어 주세요.");
    setSaying(true);
    setErr("");
    try {
      await onAddMessage(body);
      setSay("");
    } catch {
      setErr("오늘은 이 등불에 세 번까지 남길 수 있어요. 내일 다시 남겨 주세요.");
    } finally {
      setSaying(false);
    }
  }

  async function write() {
    const body = draft.trim();
    if (!body) return setErr("한 글자라도 적어 주세요.");
    setWriting(true);
    setErr("");
    try {
      await onAddNote(body, open);
      setDraft("");
    } catch {
      setErr("기록을 남기지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    } finally {
      setWriting(false);
    }
  }

  const story = miss
    ? ann.days === 0
      ? `오늘은 ${who}의 ${ann.label}이에요.`
      : `${pick(who, "과", "와")} 함께한 날은 ${togetherDays(lantern).toLocaleString()}일이에요. ${ann.label}까지 ${ann.days}일 남았어요.`
    : n == null ? ""
    : n > 0 ? `기다린 지 ${since}일째예요. ${n}일 남았어요.`
    : n === 0 ? `오늘 ${pick(who, "이", "가")} 돌아와요.`
    : "다시 만났어요. 등불은 하늘로 올라가는 중이에요.";

  return (
    <>
      {/* 오른쪽 위: 고치기, 보내기, 영상, 닫기 */}
      <div className="sheet-tools">
        {isMine && <button className="text-btn" onClick={onEdit}>고치기</button>}
        <button className="text-btn" onClick={onShare}>보내기</button>
        {onRecord && <button className="text-btn" onClick={onRecord}>10초 영상</button>}
        <button className="text-btn" onClick={onClose} aria-label="닫기">닫기</button>
      </div>
      {no && (
        <nav className="lantern-nav" aria-label="같은 곳의 다른 등불">
          {onPrev && <button className="text-btn" onClick={onPrev}>← 이전</button>}
          <span>{no}번 등불</span>
          {onNext && <button className="text-btn" onClick={onNext}>다음 →</button>}
        </nav>
      )}
      <p className="where">
        {lantern.place === "무지개" ? `무지개마을에서 지내요 · ${lantern.species ?? "반려동물"}` : miss ? `추모관 하늘에 띄운 풍등 · ${lantern.kind}` : `${placeOf(lantern.place)}에 걸린 등불 · ${lantern.kind}`}
      </p>
      <h2 id="sheet-title">{titleOf(lantern)}</h2>
      {isMine && <p className="here-now">당신의 등불이에요.</p>}
      {isHere && !isMine && <p className="here-now">이 사람도 지금 항구에 와 있어요.</p>}

      {(photoUrl || isMine) && (
        <div className={`photo-box${photoUrl ? "" : " none"}`}>
          {photoUrl ? (
            <img className="photo" src={photoUrl} alt={`${who} 사진`} />
          ) : isMine && lantern.photo_path ? (
            <div className="photo photo-empty">사진을 불러오는 중이에요.</div>
          ) : null}
          {isMine && (
            <div className="photo-tools">
              <label className="text-btn file-btn">
                {photoBusy ? "올리는 중" : lantern.photo_path ? "사진 바꾸기" : "사진 한 장 넣기"}
                <input type="file" accept="image/*" disabled={photoBusy} onChange={(e) => pickPhoto(e.target.files?.[0] ?? undefined)} />
              </label>
              {lantern.photo_path && (
                <>
                  <small className="photo-who">{photoPublic ? "마을 사람들도 봐요" : "나만 봐요"}</small>
                  <label className="toggle">
                    <input type="checkbox" checked={photoPublic} onChange={(e) => onPhotoPublic(e.target.checked).catch(() => setErr("바꾸지 못했어요."))} />
                    마을 사람들에게도 보여요
                  </label>
                  <button className="text-btn" onClick={() => onPhoto(null, false).catch(() => setErr("사진을 지우지 못했어요."))}>지우기</button>
                </>
              )}
            </div>
          )}
          {isMine && !lantern.photo_path && <p className="small">{who} 사진을 한 장 넣어 두세요. 처음엔 나만 보여요. 넣은 뒤에 마을 사람들에게 보일지 정할 수 있어요.</p>}
        </div>
      )}


      <div className="big">{miss ? `떠난 지 ${gone}일` : ddayText(n)}</div>
      <p className="small">{story}</p>
      {daily && (
        <div className="daily-in">
          <p className="daily-from">오늘의 한마디 · {daily.from}</p>
          <p className="daily-text">{daily.text}</p>
          {daily.facts && <p className="daily-facts">{daily.facts}</p>}
        </div>
      )}
      {!isMine && (
        <div className="row warm-row">
          <button className="btn" onClick={warm} disabled={busy || sent}>
            {miss ? (sent ? "오늘 추모했어요" : "추모하기") : sent ? "오늘 온기를 보냈어요" : "온기 보내기"}
          </button>
          <button className="ghost" onClick={() => sayRef.current?.focus()}>
            {miss ? "추모의 말 남기기" : "응원의 말 남기기"}
          </button>
        </div>
      )}
      <div className="offer">
        <p className="section">놓고 가기 <small>하루에 하나</small></p>
        {myOffer ? (
          <p className="small">오늘 {pick(OFFER_ONE[myOffer], "을", "를")} 놓았어요. 내일 또 놓을 수 있어요.</p>
        ) : (
          <div className="chips">
            {offeringsFor(lantern).map((k) => (
              <button key={k} type="button" className="chip" disabled={offering} onClick={() => offer(k)}>
                {OFFER_ONE[k]}
              </button>
            ))}
          </div>
        )}
        <p className="small">{laid ? `${pick(laid, "이", "가")} 놓여 있어요.` : "아직 놓인 것이 없어요."}</p>
      </div>
      <p className="small warmth-line">
        {miss
          ? warmth ? `이 등불 앞에서 ${warmth}번 추모했어요. 추모할 때마다 곁에 작은 등이 하나씩 놓여요.` : "아직 추모한 사람이 없어요. 추모하면 곁에 작은 등이 하나 놓여요."
          : warmth ? `이 등불에 온기가 ${warmth}번 닿았어요. 온기마다 곁에 작은 등이 하나씩 놓여요.` : "아직 닿은 온기가 없어요. 온기를 보내면 곁에 작은 등이 하나 놓여요."}
      </p>

      {/* 기다림의 길: 시작한 날 → 오늘 → 돌아오는 날 (그리움은 함께한 시간) */}
      {miss ? (
        <div className="journey">
          <div className="journey-line"><i style={{ width: "100%" }} /></div>
          <div className="journey-ends">
            <span>{md(lantern.start_date)} 처음 만난 날</span>
            <span>{md(lantern.end_date)} 떠난 날</span>
          </div>
        </div>
      ) : (
      <div className="journey" aria-label={`기다림의 ${pct}%를 지나왔어요`}>
        <div className="journey-line">
          <i style={{ width: `${pct}%` }} />
          <b style={{ left: `${pct}%` }} />
        </div>
        <div className="journey-ends">
          <span>{md(lantern.start_date)} 시작</span>
          <span>{md(lantern.end_date)} 돌아와요</span>
        </div>
      </div>
      )}

      {lantern.line && (
        <>
          <p className="section">등불에 적힌 한 줄</p>
          <p className="note-line">{lantern.line}</p>
        </>
      )}

      <p className="section">{miss ? "추모의 말" : "응원의 말"} {said.length > 0 && <small>{said.length}</small>}</p>
      {!isMine && (
        <div className="compose say">
          <textarea
            ref={sayRef}
            maxLength={200}
            value={say}
            onChange={(e) => setSay(e.target.value)}
            placeholder={miss ? `${who}에게, 또는 ${who}를 그리워하는 사람에게 한마디 남겨요.` : `${who}를 기다리는 사람에게 한마디 남겨요.`}
            aria-label={miss ? "추모의 말" : "응원의 말"}
          />
          <div className="compose-foot">
            <span className="small">마을 사람 누구나 읽을 수 있어요.</span>
            <span className="count">{say.length}/200</span>
          </div>
          <button className="btn" onClick={leave} disabled={saying}>남기기</button>
        </div>
      )}
      {messages === undefined ? (
        <p className="small">남겨진 말을 불러오는 중이에요.</p>
      ) : said.length === 0 ? (
        <p className="small">{isMine ? "아직 남겨진 말이 없어요." : miss ? "첫 추모의 말을 남겨 주세요." : "첫 응원의 말을 남겨 주세요."}</p>
      ) : (
        <ol className="diary said">
          {said.map((m) => (
            <li key={m.id}>
              <span className="diary-day">
                {md(m.created_at.slice(0, 10))}
                {m.from_id === me && <em>내가 남긴 말</em>}
              </span>
              <p className="diary-body">{m.body}</p>
              {(isMine || m.from_id === me) && (
                <button className="text-btn" onClick={() => onRemoveMessage(m.id).catch(() => setErr("지우지 못했어요."))}>지우기</button>
              )}
            </li>
          ))}
        </ol>
      )}

      {isMine && (
        <div className="compose">
          <p className="section">{miss ? `보내지 못한 편지 · 떠난 지 ${gone}일` : `오늘의 기록 · 기다린 지 ${since}일째`}</p>
          <p className="ask-line">
            {todaysAsk(who, askShift, miss)}
            <button className="text-btn" onClick={() => setAskShift((s) => s + 1)}>다른 질문</button>
          </p>
          <textarea
            id="note"
            maxLength={300}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`${who}에게, 혹은 나에게. 오늘 있었던 일을 적어요.`}
            aria-label="오늘의 기록"
          />
          <div className="compose-foot">
            <label className="toggle">
              <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
              {open ? "마을 사람들에게도 보여요" : "나만 봐요"}
            </label>
            <span className="count">{draft.length}/300</span>
          </div>
          <button className="btn" onClick={write} disabled={writing}>기록 남기기</button>
        </div>
      )}

      <p className="section">{miss ? "그리움 일기" : "기다림 일기"} {list.length > 0 && <small>{list.length}</small>}</p>
      {notes === undefined ? (
        <p className="small">일기를 불러오는 중이에요.</p>
      ) : list.length === 0 ? (
        <p className="small">{isMine ? "아직 남긴 기록이 없어요. 오늘 첫 줄을 적어 보세요." : "아직 공개된 기록이 없어요."}</p>
      ) : (
        <ol className="diary">
          {list.map((note) => (
            <li key={note.id}>
              <span className="diary-day">
                {dayLabel(note, lantern.end_date, miss)}
                {!note.public && <em>나만 봐요</em>}
              </span>
              <p className="diary-body">{note.body}</p>
              {isMine && (
                <button className="text-btn" onClick={() => onRemoveNote(note.id).catch(() => setErr("기록을 지우지 못했어요."))}>지우기</button>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="err" role="alert">{err}</div>

      {miss && (
        <p className="small help-line">
          마음이 너무 무거운 날엔 혼자 견디지 않아도 돼요. 자살예방 상담전화 109 (24시간), 정신건강 상담전화 1577-0199.
        </p>
      )}
    </>
  );
}
