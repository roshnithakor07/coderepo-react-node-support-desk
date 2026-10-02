import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icon.jsx";

// A native modal dialog: Escape and a click on the backdrop close it. Focus starts on the element
// marked data-autofocus (or the first focusable one) and returns to whatever had it before.
export function Modal({ children, className = "", label = "Dialog", labelledBy, onClose }) {
    const reference = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        const dialog = reference.current;
        const previouslyFocused = document.activeElement;
        dialog.showModal();
        dialog.querySelector("[data-autofocus]")?.focus();
        const cancel = (event) => {
            event.preventDefault();
            onCloseRef.current();
        };
        dialog.addEventListener("cancel", cancel);
        return () => {
            dialog.removeEventListener("cancel", cancel);
            // Close first: while a modal dialog is open the rest of the page is inert and can't take focus.
            if (dialog.open) dialog.close();
            if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
        };
    }, []);

    function handleBackdropClick(event) {
        if (event.target === reference.current) onClose();
    }

    return (
        <dialog
            aria-label={labelledBy ? undefined : label}
            aria-labelledby={labelledBy}
            ref={reference}
            className={`modal ${className}`}
            onClick={handleBackdropClick}
        >
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
                <CloseIcon />
            </button>
            {children}
        </dialog>
    );
}
