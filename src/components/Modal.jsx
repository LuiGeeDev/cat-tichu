import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Modal({ open, onClose, title, subtitle, children, footer, className = '', dismissable = true }) {
  useEffect(() => {
    if (!open || !dismissable) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissable) onClose?.();
      }}
    >
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="modal__head">
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            {dismissable && (
              <button type="button" className="modal__close" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            )}
          </div>
        )}
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
