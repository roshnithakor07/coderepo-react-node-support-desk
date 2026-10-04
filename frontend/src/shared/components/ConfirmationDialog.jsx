import { useId } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./Modal.jsx";

// Asks before a destructive or hard-to-undo action. Cancel has focus first, so Enter or Escape never
// confirms by accident; focus returns to the button that opened the dialog.
//
// It can also be a plain notice: `confirmLabel={null}` leaves only the close button, for something that
// cannot go ahead and only needs explaining. `children` carries detail the message line cannot, and
// `confirmDisabled` holds the confirm button while something it depends on is still loading.
export function ConfirmationDialog({
    title,
    message,
    children,
    confirmLabel = "Continue",
    cancelLabel = "Cancel",
    confirmDisabled = false,
    danger = false,
    onCancel,
    onConfirm,
}) {
    const titleId = `confirmation-${useId().replace(/:/g, "")}`;
    return createPortal(
        <Modal className="confirmation-dialog-modal" labelledBy={titleId} onClose={onCancel}>
            <section className="confirmation-dialog">
                <h2 id={titleId}>{title}</h2>
                {message && <p>{message}</p>}
                {children}
                <footer>
                    <button type="button" className="button-secondary" data-autofocus onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    {confirmLabel !== null && (
                        <button
                            type="button"
                            className={danger ? "button-danger" : "button-primary"}
                            onClick={onConfirm}
                            disabled={confirmDisabled}
                        >
                            {confirmLabel}
                        </button>
                    )}
                </footer>
            </section>
        </Modal>,
        document.body,
    );
}
