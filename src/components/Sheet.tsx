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
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input,button")?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`veil${open ? " open" : ""}`} onClick={onClose} />
      <section ref={ref} className={`sheet${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-hidden={!open}>
        {open && children}
      </section>
    </>
  );
}
