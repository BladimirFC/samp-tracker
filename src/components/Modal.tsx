import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface ModalProps { title: string; children: ReactNode; onClose: () => void; wide?: boolean }

export function Modal({ title, children, onClose, wide }: ModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
