import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icon.jsx";

export function Modal({ children, className = "", label = "Dialog", labelledBy, onClose }) {
    const reference = useRef(null);

    useEffect(() => {
        const dialog = reference.current;
        dialog.showModal();
        const cancel = (event) => {
            event.preventDefault();
            onClose();
        };
        dialog.addEventListener("cancel", cancel);
        return () => dialog.removeEventListener("cancel", cancel);
    }, [onClose]);

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
