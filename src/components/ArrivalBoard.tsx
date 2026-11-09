import type { Lantern } from "../lib/supabase";
import { daysLeft, fliesHome, isMiss, parseDate } from "../lib/waiting";
import { neighbors } from "../lib/places";

const md = (s: string) => {
  const d = parseDate(s);
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : "";
};

/**
 * 도착 안내판: 기다림 등불들을 항구 터미널 전광판처럼 보여줘요.
 * 오늘 도착하는 사람이 맨 위, 그다음 가까운 날 순서, 돌아온 지 일주일 안의 사람은 맨 아래에.
 * 꾸밈 없이 사실만: 자리, 이름, 어디서 오는지, 도착 날, 남은 날.
 */
export function ArrivalBoard({ lanterns, me, onPick, onClose }: {
  lanterns: Lantern[];
  me: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const rows = lanterns
    .filter((l) => !isMiss(l))
    .map((l) => ({ l, n: daysLeft(l) }))
    .filter((r) => r.n != null && r.n >= -7)
    .sort((a, b) => {
      const ka = a.n! < 0 ? 100000 - a.n! : a.n!, kb = b.n! < 0 ? 100000 - b.n! : b.n!;
      return ka - kb;
    });
  const today = rows.filter((r) => r.n === 0).length;
  const soon = rows.filter((r) => r.n! > 0 && r.n! <= 7).length;

  return (
    <>
      <div className="sheet-tools">
        <button className="text-btn" onClick={onClose}>닫기</button>
      </div>
      <h2 id="sheet-title">도착 안내판</h2>
      <p className="small">
        {today ? `오늘 ${today}명이 돌아와요. ` : ""}
        {soon ? `일주일 안에 ${soon}명이 돌아와요. ` : ""}
        누르면 그 등불 앞으로 가요.
      </p>
      {rows.length === 0 ? (
        <p className="small">아직 기다리는 등불이 없어요.</p>
      ) : (
        <ol className="arrivals" aria-label="도착 안내">
          <li className="arrivals-head" aria-hidden="true">
            <span>자리</span>
            <span>기다리는 사람</span>
            <span>도착</span>
            <span>상태</span>
          </li>
          {rows.map(({ l, n }) => {
            const from = l.kind === "군대" ? (l.branch ?? "군대") : fliesHome(l.kind) ? "하늘길" : "바닷길";
            const state = n! > 0 ? `D-${n}` : n === 0 ? "오늘 도착" : "도착했어요";
            return (
              <li key={l.id} className={n === 0 ? "today" : n! < 0 ? "landed" : n! <= 7 ? "soon" : ""}>
                <button type="button" onClick={() => onPick(l.id)}>
                  <span className="a-no">{neighbors(lanterns, l.id)?.no ?? ""}</span>
                  <span className="a-who">
                    <b>{l.who}</b>
                    {l.user_id === me && <em>내 등불</em>}
                    <small>{from}</small>
                  </span>
                  <span className="a-date">{md(l.end_date)}</span>
                  <span className="a-state">{state}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
