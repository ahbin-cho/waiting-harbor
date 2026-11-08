import { useEffect } from "react";
import { STORY } from "../lib/story";

/** 등대지기의 이야기. 화면을 누르면 다음 장면으로 넘어가요. */
export function Story({ step, onStep, onDone }: {
  step: number;
  onStep: (i: number) => void;
  onDone: (then: "write" | "look") => void;
}) {
  const last = step === STORY.length - 1;
  const next = () => (last ? undefined : onStep(step + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone("look");
      else if ((e.key === "Enter" || e.key === " " || e.key === "ArrowRight") && !last) onStep(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, last, onStep, onDone]);

  return (
    <div className="story" onClick={next} role="dialog" aria-modal="true" aria-label="등대지기의 이야기">
      <button className="story-skip" onClick={(e) => (e.stopPropagation(), onDone("look"))}>건너뛰기</button>
      <div className="story-card">
        <p key={step} className="story-text" aria-live="polite">{STORY[step].text}</p>
        {last ? (
          <div className="row">
            <button className="btn" onClick={(e) => (e.stopPropagation(), onDone("write"))}>등불 걸러 가기</button>
            <button className="ghost" onClick={(e) => (e.stopPropagation(), onDone("look"))}>먼저 둘러볼게요</button>
          </div>
        ) : (
          <p className="story-more">화면을 누르면 이어져요</p>
        )}
        <ol className="story-dots" aria-hidden="true">
          {STORY.map((_, i) => <li key={i} className={i === step ? "on" : ""} />)}
        </ol>
      </div>
    </div>
  );
}
