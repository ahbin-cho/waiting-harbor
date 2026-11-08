import { useEffect, useState } from "react";
import type { Lantern, Note } from "../lib/supabase";
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

export function LanternDetail({ lantern, isMine, isHere, warmth, sent, notes, onLoadNotes, onAddNote, onRemoveNote, onWarm, onEdit, onClose, onShare, onRecord, photoUrl, onLoadPhoto, onPhoto, onPhotoPublic }: {
  lantern: Lantern;
  isMine: boolean;
  isHere: boolean;
  warmth: number;
  sent: boolean;
  notes: Note[] | undefined;
  onLoadNotes: () => void;
  onAddNote: (body: string, isPublic: boolean) => Promise<void>;
  onRemoveNote: (id: number) => Promise<void>;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lantern.id]);

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
      <p className="where">
        {lantern.place === "무지개" ? `무지개마을에서 지내요 · ${lantern.species ?? "반려동물"}` : miss ? `하늘에 띄운 풍등 · ${lantern.kind}` : `${placeOf(lantern.place)}에 걸린 등불 · ${lantern.kind}`}
      </p>
      <h2 id="sheet-title">{titleOf(lantern)}</h2>
      {isMine && <p className="here-now">당신의 등불이에요.</p>}
      {isHere && !isMine && <p className="here-now">이 사람도 지금 항구에 와 있어요.</p>}

      <div className="big">{miss ? `떠난 지 ${gone}일` : ddayText(n)}</div>
      <p className="small">{story}</p>
      {!isMine && (
        <div className="row warm-row">
          <button className="btn" onClick={warm} disabled={busy || sent}>
            {sent ? "오늘 온기를 보냈어요" : "온기 보내기"}
          </button>
        </div>
      )}

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

      {(photoUrl || isMine) && (
        <div className="photo-box">
          <p className="section">사진{isMine && lantern.photo_path && <small>{photoPublic ? "마을 사람들도 봐요" : "나만 봐요"}</small>}</p>
          {photoUrl && <img className="photo" src={photoUrl} alt={`${who} 사진`} />}
          {isMine && (
            <div className="photo-tools">
              <label className="text-btn file-btn">
                {photoBusy ? "올리는 중" : lantern.photo_path ? "사진 바꾸기" : "사진 한 장 넣기"}
                <input type="file" accept="image/*" disabled={photoBusy} onChange={(e) => pickPhoto(e.target.files?.[0] ?? undefined)} />
              </label>
              {lantern.photo_path && (
                <>
                  <label className="toggle">
                    <input type="checkbox" checked={photoPublic} onChange={(e) => onPhotoPublic(e.target.checked).catch(() => setErr("바꾸지 못했어요."))} />
                    마을 사람들에게도 보여요
                  </label>
                  <button className="text-btn" onClick={() => onPhoto(null, false).catch(() => setErr("사진을 지우지 못했어요."))}>지우기</button>
                </>
              )}
            </div>
          )}
          {isMine && !lantern.photo_path && <p className="small">처음엔 나만 보여요. 넣은 뒤에 마을 사람들에게 보일지 정할 수 있어요.</p>}
        </div>
      )}

      {lantern.line && (
        <>
          <p className="section">등불에 적힌 한 줄</p>
          <p className="note-line">{lantern.line}</p>
        </>
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

      <p className="small warmth-line">{warmth ? `이 등불에 온기가 ${warmth}번 닿았어요.` : "아직 닿은 온기가 없어요."}</p>
      <div className="err" role="alert">{err}</div>

      {miss && (
        <p className="small help-line">
          마음이 너무 무거운 날엔 혼자 견디지 않아도 돼요. 자살예방 상담전화 109 (24시간), 정신건강 상담전화 1577-0199.
        </p>
      )}
    </>
  );
}
