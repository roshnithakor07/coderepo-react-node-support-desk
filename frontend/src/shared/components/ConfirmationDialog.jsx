import { useId } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./Modal.jsx";

// Asks before a destructive or hard-to-undo action. Cancel has focus first, so Enter or Escape never
// confirms by accident; focus returns to the button that opened the dialog.
export function ConfirmationDialog({ title, message, confirmLabel = "Continue", danger = false, onCancel, onConfirm }) {
    const titleId = `confirmation-${useId().replace(/:/g, "")}`;
    return createPortal(
        <Modal className="confirmation-dialog-modal" labelledBy={titleId} onClose={onCancel}>
            <section className="confirmation-dialog">
                <h2 id={titleId}>{title}</h2>
                {message && <p>{message}</p>}
                <footer>
                    <button type="button" className="button-secondary" data-autofocus onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" className={danger ? "button-danger" : "button-primary"} onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </footer>
            </section>
        </Modal>,
        document.body,
    );
}
