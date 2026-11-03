import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

// Pop-up window for the Fleet page's record forms. Closes on Esc, the X
// button or a click on the dimmed background; focuses the first field when
// it opens and stops the page behind it from scrolling.
export function FleetModal({ title, description, onClose, children }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  // Latest onClose without re-running the effect below (which would steal
  // focus back to the first field on every parent render).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement;
    dialogRef.current?.querySelector("input, select, textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.(); // back to the button that opened it
    };
  }, []);

  return (
    <div className="fleet-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="fleet-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="fleet-modal-head">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="btn sm ghost" aria-label="Close" onClick={onClose}><X size={14} /></button>
        </div>
        {description && <p className="fleet-modal-description">{description}</p>}
        <div className="fleet-modal-body">{children}</div>
      </div>
    </div>
  );
}
