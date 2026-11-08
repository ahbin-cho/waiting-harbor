import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// 아이폰 사파리: 마을 화면에서 손가락 두 개로 페이지 전체가 확대되지 않게 (3D 마을 확대는 따로 돼요)
for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });

// 키보드가 올라오면(아이폰 사파리) 보이는 영역만 줄어들어요. 화면을 그 영역에 딱 맞춰서
// 바텀시트가 키보드 바로 위에 붙고, 사이에 빈 띠가 생기지 않게 해요.
const vv = window.visualViewport;
if (vv) {
  const fit = () => {
    const root = document.getElementById("root");
    if (!root) return;
    const kb = vv.height < window.innerHeight - 120; // 키보드가 열렸어요
    document.documentElement.classList.toggle("kb", kb);
    root.style.height = `${vv.height}px`;
    root.style.bottom = "auto";
    root.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : "";
    // 쓰고 있는 칸이 가려지지 않게
    const el = document.activeElement;
    if (kb && el instanceof HTMLElement && el.matches("input, textarea")) el.scrollIntoView({ block: "center" });
  };
  vv.addEventListener("resize", fit);
  vv.addEventListener("scroll", fit);
  fit();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
