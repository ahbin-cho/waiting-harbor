import { useEffect, useRef, useState } from "react";
import type { Lantern } from "../lib/supabase";
import { KINDS, parseDate, pick, today, ymd } from "../lib/waiting";
import { PLACES, PLACE_INFO, placeOf } from "../lib/places";
import { COLORS, COLOR_NAMES, SHAPES, colorOf, shapeOf } from "../lib/looks";

type Values = Pick<Lantern, "who" | "kind" | "start_date" | "end_date" | "line" | "place" | "color" | "shape">;

// 기다림 종류는 DB 값 그대로 두고, 묻는 말만 사람 말투로
const KIND_SAY: Record<(typeof KINDS)[number], string> = {
  군대: "군대에 있어요",
  "장거리 연애": "멀리 떨어져 지내요",
  "해외에 있는 가족": "다른 나라에 있어요",
  "그 밖의 기다림": "다른 이유로 떨어져 있어요",
};

const STEPS = ["who", "kind", "dates", "look", "place", "line"] as const;
type Step = (typeof STEPS)[number];

/**
 * 등불 걸기. 등대지기가 한 번에 하나씩 물어봐요.
 * 고칠 때는 마지막 질문(한 줄)부터 열리고, 이전으로 돌아가 다른 것도 고칠 수 있어요.
 */
export function LanternForm({ initial, onSave, onRemove, onClose }: {
  initial?: Lantern;
  onSave: (v: Values) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<number>(initial ? STEPS.length - 1 : 0);
  const [who, setWho] = useState(initial?.who ?? "");
  const [kind, setKind] = useState(initial?.kind ?? KINDS[0]);
  const [start, setStart] = useState(initial?.start_date ?? ymd(today()));
  const [end, setEnd] = useState(initial?.end_date ?? "");
  const [line, setLine] = useState(initial?.line ?? "");
  const [place, setPlace] = useState(placeOf(initial?.place));
  const [color, setColor] = useState(colorOf(initial?.color));
  const [shape, setShape] = useState(shapeOf(initial?.shape));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const name = who.trim() || "그 사람";
  const at: Step = STEPS[step];
  const last = step === STEPS.length - 1;

  useEffect(() => {
    setErr("");
    const t = setTimeout(() => box.current?.querySelector<HTMLElement>("input,textarea,[aria-pressed='true'],[aria-checked='true']")?.focus(), 80);
    return () => clearTimeout(t);
  }, [step]);

  function check(s: Step) {
    if (s === "who" && !who.trim()) return "이름을 적어 주세요. 애칭이나 한 글자도 괜찮아요.";
    if (s === "dates") {
      if (!end) return `${pick(name, "이", "가")} 돌아오는 날을 골라 주세요.`;
      const a = parseDate(start), b = parseDate(end);
      if (a && b && b <= a) return "돌아오는 날은 기다리기 시작한 날보다 뒤여야 해요.";
    }
    return "";
  }

  async function next() {
    const e = check(at);
    if (e) return setErr(e);
    if (!last) return setStep(step + 1);
    for (const s of STEPS) {
      const m = check(s);
      if (m) {
        setStep(STEPS.indexOf(s));
        return setErr(m);
      }
    }
    setBusy(true);
    try {
      await onSave({ who: who.trim(), kind, start_date: start, end_date: end, line: line.trim(), place, color, shape });
      onClose();
    } catch {
      setErr("등불을 걸지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!sure) return setSure(true);
    setBusy(true);
    try {
      await onRemove();
      onClose();
    } catch {
      setErr("등불을 내리지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  const ask: Record<Step, [string, string]> = {
    who: ["누구를 기다리고 있어요?", "등불에 이 이름이 적혀요. 여기선 당신을 이 이름으로 불러요."],
    kind: [`${pick(name, "은", "는")} 지금 어디에 있어요?`, ""],
    dates: ["언제부터 기다렸어요?\n그리고 언제 돌아와요?", "그날이 가까워질수록 등불이 밝아져요."],
    look: [`${name}에게 걸어 둘 등불을 골라요.`, ""],
    place: ["어디에 걸어 둘까요?", ""],
    line: ["등불에 한 줄 남겨요.", `${name}에게 하고 싶은 말이나 오늘 있었던 일. 매일 바꿔 적을 수 있어요.`],
  };

  return (
    <div
      ref={box}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          next();
        }
      }}
    >
      <ol className="steps" aria-label={`${STEPS.length}단계 중 ${step + 1}단계`}>
        {STEPS.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "on" : ""} />)}
      </ol>
      <h2 id="sheet-title" className="ask">{ask[at][0]}</h2>
      {ask[at][1] && <p className="small">{ask[at][1]}</p>}

      <div className="answer">
        {at === "who" && (
          <input id="who" maxLength={10} value={who} onChange={(e) => setWho(e.target.value)} placeholder="지수, 우리 아빠, 오빠" autoComplete="off" aria-label="기다리는 사람" />
        )}

        {at === "kind" && (
          <div className="choices">
            {KINDS.map((k) => (
              <button key={k} type="button" className="choice" aria-pressed={k === kind} onClick={() => setKind(k)}>{KIND_SAY[k]}</button>
            ))}
          </div>
        )}

        {at === "dates" && (
          <div className="two">
            <div>
              <label htmlFor="sd">기다리기 시작한 날</label>
              <input id="sd" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ed">돌아오는 날</label>
              <input id="ed" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        )}

        {at === "look" && (
          <div className="look">
            <span className={`preview shape-${shape}`} style={{ ["--c" as string]: COLORS[color] }} aria-hidden="true" />
            <div className="look-pick">
              <div className="swatches" role="radiogroup" aria-label="불빛 색">
                {COLOR_NAMES.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={c} title={c} className="swatch" style={{ ["--c" as string]: COLORS[c] }} onClick={() => setColor(c)} />
                ))}
              </div>
              <div className="small">{color} 빛</div>
              <div className="chips">
                {SHAPES.map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={s === shape} onClick={() => setShape(s)}>{s} 등</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {at === "place" && (
          <div className="choices">
            {PLACES.map((p) => (
              <button key={p} type="button" className="choice" aria-pressed={p === place} onClick={() => setPlace(p)}>
                <b>{p}</b>
                <span>{PLACE_INFO[p].blurb}</span>
              </button>
            ))}
          </div>
        )}

        {at === "line" && (
          <textarea id="line" maxLength={60} value={line} onChange={(e) => setLine(e.target.value)} placeholder="오늘 편지가 왔어. 밥은 잘 먹는대." aria-label="한 줄" />
        )}
      </div>

      <div className="err" role="alert">{err}</div>
      <div className="row">
        <button className="btn" onClick={next} disabled={busy}>
          {!last ? "다음" : initial ? "다시 걸기" : "등불 켜기"}
        </button>
        {step > 0 ? (
          <button className="ghost" onClick={() => setStep(step - 1)} disabled={busy}>이전</button>
        ) : (
          <button className="ghost" onClick={onClose}>그만두기</button>
        )}
        {initial && last && (
          <button className="text-btn" onClick={remove} disabled={busy}>
            {sure ? "정말 내릴까요? 한 번 더 누르면 내려요" : "등불 내리기"}
          </button>
        )}
      </div>
    </div>
  );
}
