import { useEffect, useRef, type ReactNode } from "react";

export function Sheet({ open, onClose, labelledBy, children }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // 시트 자체에 초점을 둬요 (첫 버튼에 초점 테두리가 생기지 않게). 입력칸이 있으면 각 화면이 알아서 옮겨요.
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`veil${open ? " open" : ""}`} onClick={onClose} />
      <section ref={ref} className={`sheet${open ? " open" : ""}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-hidden={!open}>
        {open && children}
      </section>
    </>
  );
}
